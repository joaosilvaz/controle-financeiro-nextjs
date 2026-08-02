export type Transacao = {
  id: string;
  data: string;
  desc: string;
  categoria: string;
  cartao: string;
  pessoa: string;
  valor: number;
};

export type NovaTransacao = Omit<Transacao, "id">;
