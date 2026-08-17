export const CATEGORIAS_DESPESA = [
  { nome: "Alimentação", cor: "#2f7a4f" },
  { nome: "Transporte", cor: "#1f6fa8" },
  { nome: "Moradia", cor: "#8a6a2e" },
  { nome: "Saúde", cor: "#b3453f" },
  { nome: "Lazer", cor: "#6f4fa8" },
  { nome: "Assinaturas", cor: "#a8791f" },
  { nome: "Compras", cor: "#a8306e" },
  { nome: "Educação", cor: "#1f8a7a" },
  { nome: "Outros", cor: "#5b636e" },
] as const;

export const CATEGORIAS_RECEITA = [
  { nome: "Salário", cor: "#16835f" },
  { nome: "Renda extra", cor: "#2d8f72" },
  { nome: "Reembolso", cor: "#3e8ab8" },
  { nome: "Rendimentos", cor: "#7868c8" },
  { nome: "Outras receitas", cor: "#5b636e" },
] as const;

export const CATEGORIAS_TRANSFERENCIA = [
  { nome: "Transferência", cor: "#7b8492" },
] as const;

export const CATEGORIAS = [
  ...CATEGORIAS_DESPESA,
  ...CATEGORIAS_RECEITA,
  ...CATEGORIAS_TRANSFERENCIA,
] as const;

export const CAT_MAP: Record<string, string> = Object.fromEntries(
  CATEGORIAS.map((c) => [c.nome, c.cor])
);

export function hexToBg(hex: string, alpha = 0.12): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export function fmtMoeda(v: number | undefined | null): string {
  return (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function mesDe(dataStr: string): string {
  return dataStr ? dataStr.slice(0, 7) : "";
}

export function mesLabel(m: string): string {
  if (!m) return "";
  const [ano, mes] = m.split("-");
  const nomes = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  return `${nomes[parseInt(mes, 10) - 1]}/${ano}`;
}
