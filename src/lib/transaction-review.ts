import { tipoDe } from "@/src/lib/finance";
import type { Transacao } from "@/src/lib/types";

export type MotivoRevisao =
  | "categoria_generica"
  | "dados_incompletos"
  | "possivel_duplicidade";

export type ItemRevisaoTransacao = {
  transacao: Transacao;
  motivos: MotivoRevisao[];
  camposAusentes: string[];
};

const CATEGORIAS_GENERICAS = new Set(["outros", "outras receitas", ""]);

function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function chaveDuplicidade(transacao: Transacao): string {
  const tipo = tipoDe(transacao);
  const origem = transacao.cartaoId || transacao.cartao || transacao.contaId || "sem-origem";
  const valorCentavos = Math.round((transacao.valor || 0) * 100);
  return [
    transacao.data,
    tipo,
    normalizar(transacao.desc || ""),
    valorCentavos,
    origem,
  ].join("|");
}

function camposAusentes(transacao: Transacao): string[] {
  const ausentes: string[] = [];
  const tipo = tipoDe(transacao);

  if (!transacao.data) ausentes.push("data");
  if (!transacao.desc?.trim()) ausentes.push("descrição");
  if (!(transacao.valor > 0)) ausentes.push("valor");

  if (tipo === "receita" && !transacao.contaId) {
    ausentes.push("conta de entrada");
  }

  if (
    tipo === "despesa" &&
    !transacao.contaId &&
    !transacao.cartaoId &&
    !transacao.cartao
  ) {
    ausentes.push("forma de pagamento");
  }

  if (tipo === "transferencia" && !transacao.contaId) {
    ausentes.push("conta de origem");
  }

  if (
    tipo === "transferencia" &&
    !transacao.faturaPagamentoId &&
    !transacao.contaDestinoId
  ) {
    ausentes.push("conta de destino");
  }

  return ausentes;
}

export function analisarTransacoesParaRevisao(
  transacoes: Transacao[]
): ItemRevisaoTransacao[] {
  const gruposDuplicados = new Map<string, Transacao[]>();

  transacoes.forEach((transacao) => {
    if (!transacao.data || !transacao.desc?.trim() || !(transacao.valor > 0)) return;
    const chave = chaveDuplicidade(transacao);
    const grupo = gruposDuplicados.get(chave) ?? [];
    grupo.push(transacao);
    gruposDuplicados.set(chave, grupo);
  });

  const idsDuplicados = new Set<string>();
  gruposDuplicados.forEach((grupo) => {
    if (grupo.length < 2) return;
    const ordenado = [...grupo].sort((a, b) => a.id.localeCompare(b.id));
    ordenado.slice(1).forEach((transacao) => idsDuplicados.add(transacao.id));
  });

  return transacoes
    .map((transacao): ItemRevisaoTransacao | null => {
      const ausentes = camposAusentes(transacao);
      const motivos: MotivoRevisao[] = [];
      const categoriaNormalizada = normalizar(transacao.categoria || "");

      if (ausentes.length) motivos.push("dados_incompletos");
      if (
        tipoDe(transacao) !== "transferencia" &&
        CATEGORIAS_GENERICAS.has(categoriaNormalizada)
      ) {
        motivos.push("categoria_generica");
      }
      if (idsDuplicados.has(transacao.id)) motivos.push("possivel_duplicidade");

      return motivos.length ? { transacao, motivos, camposAusentes: ausentes } : null;
    })
    .filter((item): item is ItemRevisaoTransacao => Boolean(item))
    .sort((a, b) => {
      const prioridadeA = a.motivos.includes("possivel_duplicidade") ? 0 : a.motivos.includes("dados_incompletos") ? 1 : 2;
      const prioridadeB = b.motivos.includes("possivel_duplicidade") ? 0 : b.motivos.includes("dados_incompletos") ? 1 : 2;
      if (prioridadeA !== prioridadeB) return prioridadeA - prioridadeB;
      return (b.transacao.data || "").localeCompare(a.transacao.data || "");
    });
}

