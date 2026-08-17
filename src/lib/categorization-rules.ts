import type {
  NovaRegraCategorizacao,
  NovaTransacao,
  RegraCategorizacao,
  Transacao,
} from "@/src/lib/types";

type TransacaoParaRegra = NovaTransacao | Transacao;

export function normalizarTextoRegra(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function regraCombinaComTransacao(
  regra: NovaRegraCategorizacao | RegraCategorizacao,
  transacao: TransacaoParaRegra
): boolean {
  if (!regra.ativa || (transacao.tipo ?? "despesa") !== regra.tipo) return false;
  const descricao = normalizarTextoRegra(
    transacao.descricaoOriginal || transacao.desc || ""
  );
  const termo = normalizarTextoRegra(regra.termo);
  if (!descricao || !termo) return false;

  if (regra.correspondencia === "exata") return descricao === termo;
  if (regra.correspondencia === "comeca") return descricao.startsWith(termo);
  return descricao.includes(termo);
}

function prioridadeCorrespondencia(regra: RegraCategorizacao): number {
  if (regra.correspondencia === "exata") return 3;
  if (regra.correspondencia === "comeca") return 2;
  return 1;
}

export function encontrarRegraCategorizacao(
  transacao: TransacaoParaRegra,
  regras: RegraCategorizacao[]
): RegraCategorizacao | undefined {
  let melhor: RegraCategorizacao | undefined;
  regras.forEach((regra) => {
    if (!regraCombinaComTransacao(regra, transacao)) return;
    if (!melhor) {
      melhor = regra;
      return;
    }
    const prioridadeAtual = prioridadeCorrespondencia(regra);
    const prioridadeMelhor = prioridadeCorrespondencia(melhor);
    if (
      prioridadeAtual > prioridadeMelhor ||
      (prioridadeAtual === prioridadeMelhor && regra.termo.length > melhor.termo.length)
    ) {
      melhor = regra;
    }
  });
  return melhor;
}

export function aplicarRegrasCategorizacao(
  transacao: NovaTransacao,
  regras: RegraCategorizacao[]
): NovaTransacao {
  const regra = encontrarRegraCategorizacao(transacao, regras);
  if (!regra) return transacao;

  const novoNome = regra.renomearPara?.trim();
  return {
    ...transacao,
    categoria: regra.categoria,
    desc: novoNome || transacao.desc,
    descricaoOriginal: novoNome
      ? transacao.descricaoOriginal || transacao.desc
      : transacao.descricaoOriginal,
    regraCategorizacaoId: regra.id,
  };
}

export function contarCorrespondenciasRegra(
  regra: NovaRegraCategorizacao | RegraCategorizacao,
  transacoes: Transacao[]
): number {
  const regraParaAvaliacao = { ...regra, ativa: true };
  return transacoes.reduce(
    (total, transacao) => total + (regraCombinaComTransacao(regraParaAvaliacao, transacao) ? 1 : 0),
    0
  );
}
