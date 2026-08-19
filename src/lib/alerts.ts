import { mesDe } from "@/src/lib/categories";
import {
  dataDaCompetencia,
  mesAtual,
  recorrenciaVigenteNoMes,
  tipoDe,
} from "@/src/lib/finance";
import type {
  AlertaFinanceiro,
  CartaoCredito,
  ContaFinanceira,
  FaturaCartao,
  MetaFinanceira,
  MovimentoMeta,
  OrcamentoMensal,
  RecorrenciaFinanceira,
  Transacao,
} from "@/src/lib/types";

type AlertInput = {
  hoje: string;
  transacoes: Transacao[];
  contas: ContaFinanceira[];
  saldos: Record<string, number>;
  cartoes: CartaoCredito[];
  faturas: FaturaCartao[];
  orcamentos: OrcamentoMensal[];
  recorrencias: RecorrenciaFinanceira[];
  metas: MetaFinanceira[];
  movimentosMetas: MovimentoMeta[];
};

const PRIORIDADE = { critico: 0, atencao: 1, lembrete: 2 } as const;

function diferencaEmDias(data: string, hoje: string): number {
  const destino = Date.parse(`${data}T12:00:00Z`);
  const inicio = Date.parse(`${hoje}T12:00:00Z`);
  if (!Number.isFinite(destino) || !Number.isFinite(inicio)) return Number.POSITIVE_INFINITY;
  return Math.round((destino - inicio) / 86_400_000);
}

function dataLegivel(data: string): string {
  const [ano, mes, dia] = data.split("-");
  return dia && mes && ano ? `${dia}/${mes}/${ano}` : data;
}

export function gerarAlertasFinanceiros({
  hoje,
  transacoes,
  contas,
  saldos,
  cartoes,
  faturas,
  orcamentos,
  recorrencias,
  metas,
  movimentosMetas,
}: AlertInput): AlertaFinanceiro[] {
  const alertas: AlertaFinanceiro[] = [];
  const competencia = hoje.slice(0, 7) || mesAtual();

  contas.forEach((conta) => {
    const saldo = saldos[conta.id] ?? conta.saldoInicial ?? 0;
    if (!conta.ativa || saldo >= 0) return;
    alertas.push({
      id: `saldo-negativo-${conta.id}`,
      nivel: "critico",
      origem: "saldo",
      titulo: `${conta.nome} está com saldo negativo`,
      descricao: "Revise os lançamentos ou transfira recursos para evitar encargos e pagamentos recusados.",
      destino: "contas",
      acao: "Ver conta",
      valor: Math.abs(saldo),
    });
  });

  const gastosPorCategoria = new Map<string, number>();
  transacoes.forEach((transacao) => {
    if (tipoDe(transacao) !== "despesa" || mesDe(transacao.data) !== competencia) return;
    gastosPorCategoria.set(
      transacao.categoria,
      (gastosPorCategoria.get(transacao.categoria) ?? 0) + (transacao.valor || 0)
    );
  });

  orcamentos.forEach((orcamento) => {
    if (orcamento.mes !== competencia || orcamento.limite <= 0) return;
    const gasto = gastosPorCategoria.get(orcamento.categoria) ?? 0;
    const percentual = (gasto / orcamento.limite) * 100;
    if (percentual < orcamento.alertaPercentual) return;
    const estourado = percentual >= 100;
    alertas.push({
      id: `orcamento-${orcamento.id}`,
      nivel: estourado ? "critico" : "atencao",
      origem: "orcamento",
      titulo: estourado
        ? `Orçamento de ${orcamento.categoria} ultrapassado`
        : `${orcamento.categoria} chegou a ${Math.round(percentual)}% do limite`,
      descricao: estourado
        ? `O gasto do mês excedeu o limite em R$ ${(gasto - orcamento.limite).toFixed(2).replace(".", ",")}.`
        : "Vale reduzir os próximos gastos para manter o planejamento do mês.",
      destino: "orcamentos",
      acao: "Ver orçamento",
      valor: gasto,
    });
  });

  const cartoesPorNome = new Map(cartoes.map((cartao) => [cartao.nome, cartao]));
  const cartoesPorId = new Map(cartoes.map((cartao) => [cartao.id, cartao]));
  const totaisFatura = new Map<string, number>();
  transacoes.forEach((transacao) => {
    if (tipoDe(transacao) !== "despesa" || transacao.faturaPagamentoId) return;
    const cartao = transacao.cartaoId
      ? cartoesPorId.get(transacao.cartaoId)
      : cartoesPorNome.get(transacao.cartao);
    if (!cartao) return;
    const mesFatura = transacao.faturaMes || mesDe(transacao.data);
    const chave = `${cartao.id}::${mesFatura}`;
    totaisFatura.set(chave, (totaisFatura.get(chave) ?? 0) + (transacao.valor || 0));
  });
  const faturasPorChave = new Map(
    faturas.map((fatura) => [`${fatura.cartaoId}::${fatura.mes}`, fatura])
  );

  totaisFatura.forEach((total, chave) => {
    const [cartaoId, mesFatura] = chave.split("::");
    const cartao = cartoesPorId.get(cartaoId);
    const fatura = faturasPorChave.get(chave);
    if (!cartao || fatura?.status === "paga" || total <= 0) return;
    const vencimento = fatura?.dataVencimento || dataDaCompetencia(mesFatura, cartao.diaVencimento);
    const dias = diferencaEmDias(vencimento, hoje);
    if (dias > 7) return;
    const atrasada = dias < 0;
    alertas.push({
      id: `fatura-${cartaoId}-${mesFatura}`,
      nivel: atrasada ? "critico" : dias <= 3 ? "atencao" : "lembrete",
      origem: "fatura",
      titulo: atrasada
        ? `Fatura ${cartao.nome} está atrasada`
        : dias === 0
          ? `Fatura ${cartao.nome} vence hoje`
          : `Fatura ${cartao.nome} vence em ${dias} dias`,
      descricao: `Vencimento em ${dataLegivel(vencimento)}. Confira o valor e programe o pagamento.`,
      destino: "cartoes",
      acao: "Ver fatura",
      dataReferencia: vencimento,
      valor: fatura?.valorFechado || total,
    });
  });

  const ocorrenciasExistentes = new Set(
    transacoes
      .filter((transacao) => transacao.recorrenciaId && transacao.competenciaRecorrencia)
      .map((transacao) => `${transacao.recorrenciaId}::${transacao.competenciaRecorrencia}`)
  );
  recorrencias.forEach((recorrencia) => {
    if (
      !recorrenciaVigenteNoMes(recorrencia, competencia) ||
      ocorrenciasExistentes.has(`${recorrencia.id}::${competencia}`)
    ) return;
    const vencimento = dataDaCompetencia(competencia, recorrencia.diaVencimento);
    const dias = diferencaEmDias(vencimento, hoje);
    if (dias > 5) return;
    const atrasada = dias < 0;
    alertas.push({
      id: `recorrencia-${recorrencia.id}-${competencia}`,
      nivel: atrasada ? "critico" : dias <= 2 ? "atencao" : "lembrete",
      origem: "recorrencia",
      titulo: atrasada
        ? `Lançamento pendente: ${recorrencia.descricao}`
        : dias === 0
          ? `${recorrencia.descricao} está previsto para hoje`
          : `${recorrencia.descricao} está próximo`,
      descricao: atrasada
        ? `O vencimento previsto era ${dataLegivel(vencimento)}.`
        : `Lançamento previsto para ${dataLegivel(vencimento)}.`,
      destino: "recorrencias",
      acao: "Gerar lançamento",
      dataReferencia: vencimento,
      valor: recorrencia.valor,
    });
  });

  const movimentosPorMeta = new Map<string, number>();
  movimentosMetas.forEach((movimento) => {
    movimentosPorMeta.set(
      movimento.metaId,
      (movimentosPorMeta.get(movimento.metaId) ?? 0) + (movimento.valor || 0)
    );
  });
  metas.forEach((meta) => {
    if (!meta.ativa || !meta.dataAlvo || meta.valorAlvo <= 0) return;
    const acumulado = meta.valorInicial + (movimentosPorMeta.get(meta.id) ?? 0);
    if (acumulado >= meta.valorAlvo) return;
    const dias = diferencaEmDias(meta.dataAlvo, hoje);
    if (dias > 30) return;
    const vencida = dias < 0;
    alertas.push({
      id: `meta-${meta.id}-${meta.dataAlvo}`,
      nivel: vencida ? "critico" : dias <= 7 ? "atencao" : "lembrete",
      origem: "meta",
      titulo: vencida
        ? `A meta ${meta.nome} passou do prazo`
        : `A meta ${meta.nome} vence em ${dias} dias`,
      descricao: `Ainda faltam R$ ${(meta.valorAlvo - acumulado).toFixed(2).replace(".", ",")} para concluir o objetivo.`,
      destino: "metas",
      acao: "Ver meta",
      dataReferencia: meta.dataAlvo,
      valor: meta.valorAlvo - acumulado,
    });
  });

  const diaDoMes = Number(hoje.slice(8, 10));
  if (diaDoMes >= 25) {
    alertas.push({
      id: `fechamento-${competencia}`,
      nivel: "lembrete",
      origem: "fechamento",
      titulo: "Hora de revisar o fechamento do mês",
      descricao: "Confira despesas, categorias e lançamentos pendentes antes de gerar o relatório mensal.",
      destino: "resumo",
      acao: "Revisar mês",
    });
  }

  return alertas.sort((a, b) => {
    const porNivel = PRIORIDADE[a.nivel] - PRIORIDADE[b.nivel];
    if (porNivel !== 0) return porNivel;
    return (a.dataReferencia ?? "9999").localeCompare(b.dataReferencia ?? "9999");
  });
}
