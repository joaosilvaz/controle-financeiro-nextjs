export type TipoTransacao = "despesa" | "receita" | "transferencia";
export type TipoConta = "corrente" | "poupanca" | "dinheiro" | "investimento";
export type CorrespondenciaRegra = "contem" | "comeca" | "exata";

export type ContaFinanceira = {
  id: string;
  nome: string;
  tipo: TipoConta;
  saldoInicial: number;
  cor: string;
  ativa: boolean;
};

export type NovaConta = Omit<ContaFinanceira, "id">;

export type CartaoCredito = {
  id: string;
  nome: string;
  bandeira: string;
  limite: number;
  diaFechamento: number;
  diaVencimento: number;
  cor: string;
  ativo: boolean;
};

export type NovoCartaoCredito = Omit<CartaoCredito, "id">;

export type StatusFatura = "fechada" | "paga";

export type FaturaCartao = {
  id: string;
  cartaoId: string;
  mes: string;
  status: StatusFatura;
  valorFechado: number;
  dataVencimento: string;
  fechadaEm: string;
  pagaEm?: string;
  contaPagamentoId?: string;
  valorPago?: number;
  transacaoPagamentoId?: string;
};

export type NovaFaturaCartao = Omit<FaturaCartao, "id">;

export type OrcamentoMensal = {
  id: string;
  mes: string;
  categoria: string;
  limite: number;
  alertaPercentual: number;
};

export type NovoOrcamentoMensal = Omit<OrcamentoMensal, "id">;

export type TipoRecorrencia = "despesa" | "receita";

export type RecorrenciaFinanceira = {
  id: string;
  descricao: string;
  categoria: string;
  pessoa: string;
  valor: number;
  tipo: TipoRecorrencia;
  diaVencimento: number;
  inicioMes: string;
  fimMes?: string;
  contaId?: string;
  cartaoId?: string;
  cartao?: string;
  ativa: boolean;
};

export type NovaRecorrenciaFinanceira = Omit<RecorrenciaFinanceira, "id">;

export type TipoMetaFinanceira = "reserva" | "viagem" | "compra" | "divida" | "outro";

export type MetaFinanceira = {
  id: string;
  nome: string;
  tipo: TipoMetaFinanceira;
  valorAlvo: number;
  valorInicial: number;
  dataAlvo?: string;
  contaId?: string;
  cor: string;
  ativa: boolean;
};

export type NovaMetaFinanceira = Omit<MetaFinanceira, "id">;

export type MovimentoMeta = {
  id: string;
  metaId: string;
  data: string;
  valor: number;
  descricao: string;
};

export type NovoMovimentoMeta = Omit<MovimentoMeta, "id">;

export type RegraCategorizacao = {
  id: string;
  termo: string;
  correspondencia: CorrespondenciaRegra;
  tipo: Exclude<TipoTransacao, "transferencia">;
  categoria: string;
  renomearPara?: string;
  ativa: boolean;
};

export type NovaRegraCategorizacao = Omit<RegraCategorizacao, "id">;

export type CategoriaPersonalizada = {
  id: string;
  nome: string;
  tipo: Exclude<TipoTransacao, "transferencia">;
  cor: string;
  ativa: boolean;
};

export type NovaCategoriaPersonalizada = Omit<CategoriaPersonalizada, "id">;

export type Transacao = {
  id: string;
  data: string;
  desc: string;
  categoria: string;
  cartao: string;
  pessoa: string;
  valor: number;
  /** Lançamentos antigos não possuem este campo e são tratados como despesa. */
  tipo?: TipoTransacao;
  /** Conta de origem ou conta movimentada. Ausente em lançamentos antigos. */
  contaId?: string;
  /** Usada somente em transferências entre contas. */
  contaDestinoId?: string;
  /** Cartão de crédito associado. O campo `cartao` preserva o nome legado. */
  cartaoId?: string;
  dataCompra?: string;
  faturaMes?: string;
  parcelaAtual?: number;
  totalParcelas?: number;
  grupoParcelamentoId?: string;
  recorrenciaId?: string;
  competenciaRecorrencia?: string;
  faturaPagamentoId?: string;
  /** Identificador estável do lançamento no arquivo de origem, usado para evitar reimportações. */
  importacaoId?: string;
  origemImportacao?: "csv" | "ofx";
  descricaoOriginal?: string;
  regraCategorizacaoId?: string;
  tags?: string[];
  nota?: string;
};

export type NovaTransacao = Omit<Transacao, "id">;
