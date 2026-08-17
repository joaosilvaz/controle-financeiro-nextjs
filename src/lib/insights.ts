import { fmtMoeda, mesDe, mesLabel } from "@/src/lib/categories";
import { adicionarMesesAoMes, mesAtual, tipoDe } from "@/src/lib/finance";
import type {
  FaturaCartao,
  MetaFinanceira,
  MovimentoMeta,
  OrcamentoMensal,
  RecorrenciaFinanceira,
  Transacao,
} from "@/src/lib/types";

export type NivelInsight = "critico" | "atencao" | "oportunidade" | "positivo";

export type InsightFinanceiro = {
  id: string;
  nivel: NivelInsight;
  titulo: string;
  descricao: string;
  valor?: number;
  acaoLabel: string;
  acaoDestino: string;
  impacto: number;
};

export type AnaliseFinanceira = {
  insights: InsightFinanceiro[];
  pontuacao: number;
  resumo: {
    criticos: number;
    atencao: number;
    oportunidades: number;
    positivos: number;
  };
};

type DadosAnalise = {
  transacoes: Transacao[];
  orcamentos: OrcamentoMensal[];
  recorrencias: RecorrenciaFinanceira[];
  faturas: FaturaCartao[];
  metas: MetaFinanceira[];
  movimentosMetas: MovimentoMeta[];
  agora?: Date;
};

const PRIORIDADE: Record<NivelInsight, number> = {
  critico: 0,
  atencao: 1,
  oportunidade: 2,
  positivo: 3,
};

function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\d+/g, "")
    .replace(/[^a-z]+/g, " ")
    .trim();
}

function mediana(valores: number[]): number {
  if (!valores.length) return 0;
  const ordenados = [...valores].sort((a, b) => a - b);
  const meio = Math.floor(ordenados.length / 2);
  return ordenados.length % 2
    ? ordenados[meio]
    : (ordenados[meio - 1] + ordenados[meio]) / 2;
}

function dataLocal(data: Date): string {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(data.getDate()).padStart(2, "0")}`;
}

function somarPorCategoria(transacoes: Transacao[], mes: string): Map<string, number> {
  const totais = new Map<string, number>();
  transacoes.forEach((transacao) => {
    if (tipoDe(transacao) !== "despesa" || mesDe(transacao.data) !== mes) return;
    totais.set(
      transacao.categoria,
      (totais.get(transacao.categoria) ?? 0) + (transacao.valor || 0)
    );
  });
  return totais;
}

export function gerarAnaliseFinanceira({
  transacoes,
  orcamentos,
  recorrencias,
  faturas,
  metas,
  movimentosMetas,
  agora = new Date(),
}: DadosAnalise): AnaliseFinanceira {
  const insights: InsightFinanceiro[] = [];
  const mes = mesAtual(agora);
  const anterior = adicionarMesesAoMes(mes, -1);
  const hoje = dataLocal(agora);
  const gastosAtuais = somarPorCategoria(transacoes, mes);
  const gastosAnteriores = somarPorCategoria(transacoes, anterior);

  gastosAtuais.forEach((atual, categoria) => {
    const passado = gastosAnteriores.get(categoria) ?? 0;
    if (atual < 150 || passado < 100) return;
    const variacao = ((atual - passado) / passado) * 100;
    if (variacao < 25) return;
    insights.push({
      id: `crescimento-${mes}-${normalizar(categoria)}`,
      nivel: variacao >= 60 ? "critico" : "atencao",
      titulo: `${categoria} cresceu ${Math.round(variacao)}%`,
      descricao: `O gasto passou de ${fmtMoeda(passado)} em ${mesLabel(anterior)} para ${fmtMoeda(atual)} neste mês.`,
      valor: atual - passado,
      acaoLabel: "Revisar orçamento",
      acaoDestino: "orcamentos",
      impacto: variacao >= 60 ? 12 : 7,
    });
  });

  const inicioHistorico = adicionarMesesAoMes(mes, -6);
  const historicoPorCategoria = new Map<string, number[]>();
  transacoes.forEach((transacao) => {
    const competencia = mesDe(transacao.data);
    if (
      tipoDe(transacao) !== "despesa" ||
      competencia >= mes ||
      competencia < inicioHistorico
    ) return;
    const valores = historicoPorCategoria.get(transacao.categoria) ?? [];
    valores.push(transacao.valor || 0);
    historicoPorCategoria.set(transacao.categoria, valores);
  });

  transacoes
    .filter((transacao) => tipoDe(transacao) === "despesa" && mesDe(transacao.data) === mes)
    .map((transacao) => {
      const historico = historicoPorCategoria.get(transacao.categoria) ?? [];
      const valorMediano = mediana(historico);
      return { transacao, historico, valorMediano };
    })
    .filter(
      ({ transacao, historico, valorMediano }) =>
        historico.length >= 3 &&
        valorMediano > 0 &&
        transacao.valor >= Math.max(150, valorMediano * 2.5)
    )
    .sort((a, b) => b.transacao.valor - a.transacao.valor)
    .slice(0, 2)
    .forEach(({ transacao, valorMediano }) => {
      insights.push({
        id: `anomalia-${transacao.id}`,
        nivel: transacao.valor >= valorMediano * 4 ? "critico" : "atencao",
        titulo: `Gasto fora do padrão em ${transacao.categoria}`,
        descricao: `“${transacao.desc}” foi ${fmtMoeda(transacao.valor)}, enquanto a mediana recente da categoria é ${fmtMoeda(valorMediano)}.`,
        valor: transacao.valor,
        acaoLabel: "Ver lançamento",
        acaoDestino: "lancamentos",
        impacto: 8,
      });
    });

  const recorrenciasConhecidas = new Set(
    recorrencias.map((recorrencia) => normalizar(recorrencia.descricao))
  );
  const gruposCobranca = new Map<string, Transacao[]>();
  transacoes.forEach((transacao) => {
    if (
      tipoDe(transacao) !== "despesa" ||
      transacao.recorrenciaId ||
      (transacao.totalParcelas ?? 1) > 1
    ) return;
    const competencia = mesDe(transacao.data);
    if (competencia < adicionarMesesAoMes(mes, -8) || competencia > mes) return;
    const chave = normalizar(transacao.desc);
    if (chave.length < 3 || recorrenciasConhecidas.has(chave)) return;
    const grupo = gruposCobranca.get(chave) ?? [];
    grupo.push(transacao);
    gruposCobranca.set(chave, grupo);
  });

  [...gruposCobranca.entries()]
    .flatMap(([chave, grupo]) => {
      const meses = new Set(grupo.map((transacao) => mesDe(transacao.data)));
      const valores = grupo.map((transacao) => transacao.valor || 0);
      const media = valores.reduce((total, valor) => total + valor, 0) / valores.length;
      const maiorDesvio = media > 0
        ? Math.max(...valores.map((valor) => Math.abs(valor - media) / media))
        : 1;
      const ultimaCompetencia = [...meses].sort().at(-1) ?? "";
      const categoriaAssinatura = grupo.some((transacao) => transacao.categoria === "Assinaturas");
      const repeticoesMinimas = categoriaAssinatura ? 2 : 3;
      if (
        meses.size < repeticoesMinimas ||
        maiorDesvio > 0.15 ||
        ultimaCompetencia < anterior
      ) return [];
      return [{ chave, grupo, media, meses: meses.size }];
    })
    .sort((a, b) => b.media - a.media)
    .slice(0, 3)
    .forEach(({ chave, grupo, media, meses: repeticoes }) => {
      insights.push({
        id: `assinatura-${chave}`,
        nivel: "oportunidade",
        titulo: `Possível assinatura: ${grupo[0].desc}`,
        descricao: `Cobrança semelhante apareceu em ${repeticoes} meses, por cerca de ${fmtMoeda(media)}. Ela ainda não está cadastrada como recorrência.`,
        valor: media,
        acaoLabel: "Criar recorrência",
        acaoDestino: "recorrencias",
        impacto: 3,
      });
    });

  orcamentos
    .filter((orcamento) => orcamento.mes === mes)
    .map((orcamento) => {
      const gasto = gastosAtuais.get(orcamento.categoria) ?? 0;
      const percentual = orcamento.limite > 0 ? (gasto / orcamento.limite) * 100 : 0;
      return { orcamento, gasto, percentual };
    })
    .filter(({ orcamento, percentual }) => percentual >= orcamento.alertaPercentual)
    .sort((a, b) => b.percentual - a.percentual)
    .slice(0, 3)
    .forEach(({ orcamento, gasto, percentual }) => {
      insights.push({
        id: `orcamento-${mes}-${normalizar(orcamento.categoria)}`,
        nivel: percentual >= 100 ? "critico" : "atencao",
        titulo: percentual >= 100
          ? `Orçamento de ${orcamento.categoria} ultrapassado`
          : `${orcamento.categoria} atingiu ${Math.round(percentual)}% do limite`,
        descricao: `Foram gastos ${fmtMoeda(gasto)} de ${fmtMoeda(orcamento.limite)} planejados.`,
        valor: gasto - orcamento.limite,
        acaoLabel: "Ver orçamento",
        acaoDestino: "orcamentos",
        impacto: percentual >= 100 ? 14 : 7,
      });
    });

  faturas
    .filter((fatura) => fatura.status !== "paga" && fatura.dataVencimento < hoje)
    .slice(0, 3)
    .forEach((fatura) => {
      insights.push({
        id: `fatura-atrasada-${fatura.id}`,
        nivel: "critico",
        titulo: `Fatura de ${mesLabel(fatura.mes)} está atrasada`,
        descricao: `O vencimento foi em ${fatura.dataVencimento.split("-").reverse().join("/")} e o valor fechado é ${fmtMoeda(fatura.valorFechado)}.`,
        valor: fatura.valorFechado,
        acaoLabel: "Registrar pagamento",
        acaoDestino: "cartoes",
        impacto: 16,
      });
    });

  const mesesMedia = Array.from(
    { length: 3 },
    (_, indice) => adicionarMesesAoMes(mes, -(indice + 1))
  );
  const mediaDespesas = mesesMedia.reduce((total, competencia) => {
    return total + [...somarPorCategoria(transacoes, competencia).values()].reduce(
      (soma, valor) => soma + valor,
      0
    );
  }, 0) / mesesMedia.length;
  const reserva = metas.find((meta) => meta.tipo === "reserva" && meta.ativa);

  if (mediaDespesas > 0 && !reserva) {
    insights.push({
      id: "reserva-ausente",
      nivel: "atencao",
      titulo: "Reserva de emergência ainda não criada",
      descricao: `Com despesas médias de ${fmtMoeda(mediaDespesas)}, a referência de seis meses seria ${fmtMoeda(mediaDespesas * 6)}.`,
      acaoLabel: "Criar reserva",
      acaoDestino: "metas",
      impacto: 9,
    });
  } else if (mediaDespesas > 0 && reserva) {
    const movimentosReserva = movimentosMetas
      .filter((movimento) => movimento.metaId === reserva.id)
      .reduce((total, movimento) => total + movimento.valor, 0);
    const valorReserva = reserva.valorInicial + movimentosReserva;
    const mesesCobertos = valorReserva / mediaDespesas;
    if (mesesCobertos < 3) {
      insights.push({
        id: "reserva-baixa",
        nivel: "atencao",
        titulo: "Reserva cobre menos de três meses",
        descricao: `A cobertura atual é de ${mesesCobertos.toFixed(1)} meses. O ideal configurado para o diagnóstico é chegar a seis meses.`,
        valor: mediaDespesas * 6 - valorReserva,
        acaoLabel: "Acompanhar reserva",
        acaoDestino: "metas",
        impacto: 9,
      });
    } else if (mesesCobertos >= 6) {
      insights.push({
        id: "reserva-completa",
        nivel: "positivo",
        titulo: "Reserva de emergência saudável",
        descricao: `Sua reserva cobre aproximadamente ${mesesCobertos.toFixed(1)} meses da média de despesas.`,
        acaoLabel: "Ver metas",
        acaoDestino: "metas",
        impacto: -4,
      });
    }
  }

  const receitasMes = transacoes.reduce(
    (total, transacao) =>
      tipoDe(transacao) === "receita" && mesDe(transacao.data) === mes
        ? total + (transacao.valor || 0)
        : total,
    0
  );
  const despesasMes = [...gastosAtuais.values()].reduce((total, valor) => total + valor, 0);
  if (receitasMes > 0) {
    const taxaPoupanca = ((receitasMes - despesasMes) / receitasMes) * 100;
    if (taxaPoupanca >= 20) {
      insights.push({
        id: `poupanca-positiva-${mes}`,
        nivel: "positivo",
        titulo: `Taxa de economia em ${Math.round(taxaPoupanca)}%`,
        descricao: `A diferença entre receitas e despesas no mês está em ${fmtMoeda(receitasMes - despesasMes)}.`,
        valor: receitasMes - despesasMes,
        acaoLabel: "Ver resumo",
        acaoDestino: "resumo",
        impacto: -3,
      });
    }
  }

  insights.sort((a, b) => {
    const porNivel = PRIORIDADE[a.nivel] - PRIORIDADE[b.nivel];
    return porNivel || b.impacto - a.impacto;
  });

  const resumo = insights.reduce(
    (total, insight) => {
      if (insight.nivel === "critico") total.criticos += 1;
      else if (insight.nivel === "atencao") total.atencao += 1;
      else if (insight.nivel === "oportunidade") total.oportunidades += 1;
      else total.positivos += 1;
      return total;
    },
    { criticos: 0, atencao: 0, oportunidades: 0, positivos: 0 }
  );
  const impactoTotal = insights.reduce((total, insight) => total + insight.impacto, 0);

  return {
    insights,
    pontuacao: Math.max(0, Math.min(100, 100 - impactoTotal)),
    resumo,
  };
}
