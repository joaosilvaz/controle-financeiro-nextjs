export type TipoTransacao = "despesa" | "receita" | "transferencia";
export type TipoConta = "corrente" | "poupanca" | "dinheiro" | "investimento";

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
};

export type NovaTransacao = Omit<Transacao, "id">;
