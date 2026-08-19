import type {
  CartaoCredito,
  ContaFinanceira,
  NovaRecorrenciaFinanceira,
  NovaTransacao,
  RecorrenciaFinanceira,
  TipoTransacao,
  Transacao,
} from "@/src/lib/types";

export function tipoDe(transacao: Pick<Transacao, "tipo">): TipoTransacao {
  return transacao.tipo ?? "despesa";
}

export function somaPorTipo(transacoes: Transacao[], tipo: TipoTransacao): number {
  return transacoes.reduce(
    (total, transacao) =>
      tipoDe(transacao) === tipo ? total + (transacao.valor || 0) : total,
    0
  );
}

export function mesAnterior(mes: string): string {
  const [ano, numeroMes] = mes.split("-").map(Number);
  if (!ano || !numeroMes) return "";
  const data = new Date(ano, numeroMes - 2, 1);
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}`;
}

export function mesAtual(agora = new Date()): string {
  return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}`;
}

export function resumoFinanceiro(
  transacoes: Transacao[],
  todasTransacoes: Transacao[],
  periodo: string,
  agora = new Date()
) {
  const receitas = somaPorTipo(transacoes, "receita");
  const despesas = somaPorTipo(transacoes, "despesa");
  const transferencias = somaPorTipo(transacoes, "transferencia");
  const resultado = receitas - despesas;

  const periodoAnterior = mesAnterior(periodo);
  const despesasAnteriores = periodoAnterior
    ? somaPorTipo(
        todasTransacoes.filter((transacao) => transacao.data?.startsWith(periodoAnterior)),
        "despesa"
      )
    : 0;

  const variacaoDespesas = despesasAnteriores
    ? ((despesas - despesasAnteriores) / despesasAnteriores) * 100
    : null;

  let despesasProjetadas = despesas;
  let resultadoProjetado = resultado;
  const periodoAtual = periodo === mesAtual(agora);

  if (periodoAtual) {
    const diasNoMes = new Date(agora.getFullYear(), agora.getMonth() + 1, 0).getDate();
    const diasDecorridos = Math.max(1, agora.getDate());
    despesasProjetadas = (despesas / diasDecorridos) * diasNoMes;
    resultadoProjetado = receitas - despesasProjetadas;
  }

  return {
    receitas,
    despesas,
    transferencias,
    resultado,
    despesasAnteriores,
    variacaoDespesas,
    despesasProjetadas,
    resultadoProjetado,
    periodoAtual,
  };
}

export function calcularSaldosContas(
  contas: ContaFinanceira[],
  transacoes: Transacao[],
  ateData?: string
): Record<string, number> {
  const saldos = Object.fromEntries(
    contas.map((conta) => [conta.id, conta.saldoInicial || 0])
  ) as Record<string, number>;

  transacoes.forEach((transacao) => {
    if (ateData && transacao.data && transacao.data > ateData) return;

    const valor = transacao.valor || 0;
    const tipo = tipoDe(transacao);

    if (tipo === "receita" && transacao.contaId && transacao.contaId in saldos) {
      saldos[transacao.contaId] += valor;
      return;
    }

    if (
      tipo === "despesa" &&
      !transacao.cartaoId &&
      transacao.contaId &&
      transacao.contaId in saldos
    ) {
      saldos[transacao.contaId] -= valor;
      return;
    }

    if (tipo === "transferencia") {
      if (transacao.contaId && transacao.contaId in saldos) {
        saldos[transacao.contaId] -= valor;
      }
      if (transacao.contaDestinoId && transacao.contaDestinoId in saldos) {
        saldos[transacao.contaDestinoId] += valor;
      }
    }
  });

  return saldos;
}

export function saldoConsolidado(
  contas: ContaFinanceira[],
  transacoes: Transacao[],
  ateData?: string
): number {
  const saldos = calcularSaldosContas(contas, transacoes, ateData);
  return contas
    .filter((conta) => conta.ativa)
    .reduce((total, conta) => total + (saldos[conta.id] || 0), 0);
}

export function adicionarMesesAoMes(mes: string, quantidade: number): string {
  const [ano, numeroMes] = mes.split("-").map(Number);
  const data = new Date(ano, numeroMes - 1 + quantidade, 1);
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}`;
}

export function adicionarMesesAData(dataTexto: string, quantidade: number): string {
  const [ano, mes, dia] = dataTexto.split("-").map(Number);
  const primeiroDia = new Date(ano, mes - 1 + quantidade, 1);
  const ultimoDia = new Date(
    primeiroDia.getFullYear(),
    primeiroDia.getMonth() + 1,
    0
  ).getDate();
  const diaAjustado = Math.min(dia, ultimoDia);
  return `${primeiroDia.getFullYear()}-${String(primeiroDia.getMonth() + 1).padStart(2, "0")}-${String(diaAjustado).padStart(2, "0")}`;
}

export function dataDaCompetencia(mes: string, dia: number): string {
  const [ano, numeroMes] = mes.split("-").map(Number);
  const ultimoDia = new Date(ano, numeroMes, 0).getDate();
  return `${mes}-${String(Math.min(Math.max(1, dia), ultimoDia)).padStart(2, "0")}`;
}

export function recorrenciaVigenteNoMes(
  recorrencia: Pick<RecorrenciaFinanceira, "ativa" | "inicioMes" | "fimMes">,
  mes: string
): boolean {
  return Boolean(
    recorrencia.ativa &&
      recorrencia.inicioMes <= mes &&
      (!recorrencia.fimMes || recorrencia.fimMes >= mes)
  );
}

export function criarTransacaoRecorrente(
  recorrencia: RecorrenciaFinanceira | (NovaRecorrenciaFinanceira & { id: string }),
  competencia: string,
  cartao?: CartaoCredito
): NovaTransacao {
  const data = dataDaCompetencia(competencia, recorrencia.diaVencimento);
  const usaCartao = recorrencia.tipo === "despesa" && Boolean(recorrencia.cartaoId);

  return {
    data,
    desc: recorrencia.descricao,
    categoria: recorrencia.categoria,
    pessoa: recorrencia.pessoa,
    valor: recorrencia.valor,
    tipo: recorrencia.tipo,
    contaId: usaCartao ? "" : recorrencia.contaId ?? "",
    contaDestinoId: "",
    cartaoId: usaCartao ? recorrencia.cartaoId : "",
    cartao: usaCartao ? cartao?.nome ?? recorrencia.cartao ?? "" : "",
    dataCompra: usaCartao ? data : "",
    faturaMes: usaCartao && cartao ? mesDaFatura(cartao, data) : "",
    parcelaAtual: 1,
    totalParcelas: 1,
    recorrenciaId: recorrencia.id,
    competenciaRecorrencia: competencia,
  };
}

export function mesDaFatura(cartao: CartaoCredito, dataCompra: string): string {
  const [ano, mes, dia] = dataCompra.split("-").map(Number);
  const deslocamentoFechamento = dia > cartao.diaFechamento ? 1 : 0;
  const deslocamentoVencimento = cartao.diaVencimento <= cartao.diaFechamento ? 1 : 0;
  const mesBase = `${ano}-${String(mes).padStart(2, "0")}`;
  return adicionarMesesAoMes(
    mesBase,
    deslocamentoFechamento + deslocamentoVencimento
  );
}

export function criarParcelasCartao(
  dados: NovaTransacao,
  cartao: CartaoCredito,
  grupoParcelamentoId: string,
  parcelasPagas = 0,
  primeiraParcelaPendenteMes?: string
): NovaTransacao[] {
  const quantidade = Math.max(1, Math.min(48, dados.totalParcelas ?? 1));
  const quantidadePaga = Math.max(0, Math.min(quantidade - 1, parcelasPagas));
  const totalCentavos = Math.round((dados.valor || 0) * 100);
  const baseCentavos = Math.floor(totalCentavos / quantidade);
  const centavosRestantes = totalCentavos - baseCentavos * quantidade;
  const primeiraFatura = mesDaFatura(cartao, dados.data);
  const valorTotalCompra = totalCentavos / 100;
  const diaCompra = Number(dados.data.split("-")[2]) || 1;
  const usaMesPendenteExplicito = quantidadePaga > 0 &&
    Boolean(primeiraParcelaPendenteMes?.match(/^\d{4}-\d{2}$/));

  return Array.from({ length: quantidade }, (_, indice) => {
    const indicePendente = indice - quantidadePaga;
    const faturaMes = usaMesPendenteExplicito && indice >= quantidadePaga
      ? adicionarMesesAoMes(primeiraParcelaPendenteMes!, indicePendente)
      : adicionarMesesAoMes(primeiraFatura, indice);
    const dataParcela = usaMesPendenteExplicito && indice >= quantidadePaga
      ? dataDaCompetencia(faturaMes, diaCompra)
      : adicionarMesesAData(dados.data, indice);

    return {
      ...dados,
      data: dataParcela,
      dataCompra: dados.data,
      valor: (baseCentavos + (indice < centavosRestantes ? 1 : 0)) / 100,
      contaId: dados.contaId ?? "",
      contaDestinoId: "",
      cartaoId: cartao.id,
      cartao: cartao.nome,
      faturaMes,
      parcelaAtual: indice + 1,
      totalParcelas: quantidade,
      valorTotalCompra,
      grupoParcelamentoId,
    };
  }).slice(quantidadePaga);
}
