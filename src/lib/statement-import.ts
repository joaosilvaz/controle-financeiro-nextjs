import type { NovaTransacao, TipoTransacao, Transacao } from "@/src/lib/types";

export type FormatoExtrato = "csv" | "ofx";
export type StatusItemImportacao = "novo" | "possivel_duplicado" | "ja_importado";

export type ItemExtrato = {
  id: string;
  importacaoId: string;
  data: string;
  descricao: string;
  valor: number;
  tipo: Exclude<TipoTransacao, "transferencia">;
  formato: FormatoExtrato;
};

export type ResultadoLeituraExtrato = {
  formato: FormatoExtrato;
  itens: ItemExtrato[];
  linhasIgnoradas: number;
};

const CABECALHOS_DATA = ["data", "date", "dtposted", "data lancamento", "data movimento"];
const CABECALHOS_DESCRICAO = ["descricao", "description", "historico", "memo", "nome", "lancamento", "estabelecimento", "detalhes"];
const CABECALHOS_VALOR = ["valor", "amount", "trnamt", "montante", "valor lancamento"];
const CABECALHOS_DEBITO = ["debito", "debit", "saida", "saidas", "valor debito"];
const CABECALHOS_CREDITO = ["credito", "credit", "entrada", "entradas", "valor credito"];

function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function limparDescricao(texto: string): string {
  return texto.replace(/\s+/g, " ").trim();
}

function converterData(valor: string): string {
  const texto = valor.trim().replace(/^"|"$/g, "");
  const apenasData = texto.split(/[ T]/)[0];

  if (/^\d{8}/.test(apenasData)) {
    return `${apenasData.slice(0, 4)}-${apenasData.slice(4, 6)}-${apenasData.slice(6, 8)}`;
  }

  const iso = apenasData.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (iso) {
    return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  }

  const brasileira = apenasData.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (brasileira) {
    return `${brasileira[3]}-${brasileira[2].padStart(2, "0")}-${brasileira[1].padStart(2, "0")}`;
  }

  if (/^\d{5}$/.test(apenasData)) {
    const serial = Number(apenasData);
    const data = new Date(Date.UTC(1899, 11, 30 + serial));
    return data.toISOString().slice(0, 10);
  }

  return "";
}

function converterValor(valor: string): number | null {
  let texto = valor.trim().replace(/[^0-9,().+\-]/g, "");
  if (!texto) return null;

  const negativoPorParenteses = texto.startsWith("(") && texto.endsWith(")");
  texto = texto.replace(/[()]/g, "");

  const ultimaVirgula = texto.lastIndexOf(",");
  const ultimoPonto = texto.lastIndexOf(".");
  if (ultimaVirgula >= 0 && ultimoPonto >= 0) {
    texto = ultimaVirgula > ultimoPonto
      ? texto.replace(/\./g, "").replace(",", ".")
      : texto.replace(/,/g, "");
  } else if (ultimaVirgula >= 0) {
    texto = texto.replace(/\./g, "").replace(",", ".");
  } else if ((texto.match(/\./g) ?? []).length > 1) {
    const partes = texto.split(".");
    const decimal = partes.pop();
    texto = `${partes.join("")}.${decimal}`;
  }

  const numero = Number(texto);
  if (!Number.isFinite(numero)) return null;
  return negativoPorParenteses ? -Math.abs(numero) : numero;
}

function separarCsv(conteudo: string, delimitador: string): string[][] {
  const linhas: string[][] = [];
  let linha: string[] = [];
  let campo = "";
  let entreAspas = false;

  for (let indice = 0; indice < conteudo.length; indice += 1) {
    const caractere = conteudo[indice];
    const proximo = conteudo[indice + 1];

    if (caractere === '"') {
      if (entreAspas && proximo === '"') {
        campo += '"';
        indice += 1;
      } else {
        entreAspas = !entreAspas;
      }
      continue;
    }

    if (caractere === delimitador && !entreAspas) {
      linha.push(campo.trim());
      campo = "";
      continue;
    }

    if ((caractere === "\n" || caractere === "\r") && !entreAspas) {
      if (caractere === "\r" && proximo === "\n") indice += 1;
      linha.push(campo.trim());
      if (linha.some(Boolean)) linhas.push(linha);
      linha = [];
      campo = "";
      continue;
    }

    campo += caractere;
  }

  linha.push(campo.trim());
  if (linha.some(Boolean)) linhas.push(linha);
  return linhas;
}

function indiceCabecalho(cabecalhos: string[], opcoes: string[]): number {
  return cabecalhos.findIndex((cabecalho) => opcoes.includes(cabecalho));
}

function lerCsv(conteudo: string): ResultadoLeituraExtrato {
  const texto = conteudo.replace(/^\uFEFF/, "");
  const candidatos = [";", ",", "\t"];
  const delimitador = candidatos
    .map((item) => ({ item, colunas: separarCsv(texto, item)[0]?.length ?? 0 }))
    .sort((a, b) => b.colunas - a.colunas)[0]?.item ?? ";";
  const linhas = separarCsv(texto, delimitador);
  if (linhas.length < 2) throw new Error("O CSV não possui lançamentos para importar.");

  const cabecalhos = linhas[0].map(normalizar);
  const colunaData = indiceCabecalho(cabecalhos, CABECALHOS_DATA);
  const colunaDescricao = indiceCabecalho(cabecalhos, CABECALHOS_DESCRICAO);
  const colunaValor = indiceCabecalho(cabecalhos, CABECALHOS_VALOR);
  const colunaDebito = indiceCabecalho(cabecalhos, CABECALHOS_DEBITO);
  const colunaCredito = indiceCabecalho(cabecalhos, CABECALHOS_CREDITO);

  if (colunaData < 0 || colunaDescricao < 0 || (colunaValor < 0 && colunaDebito < 0 && colunaCredito < 0)) {
    throw new Error("Não reconheci as colunas do CSV. Use cabeçalhos como Data, Descrição e Valor.");
  }

  let linhasIgnoradas = 0;
  const itens = linhas.slice(1).flatMap((linha, indice) => {
    const data = converterData(linha[colunaData] ?? "");
    const descricao = limparDescricao(linha[colunaDescricao] ?? "");
    let valor = colunaValor >= 0 ? converterValor(linha[colunaValor] ?? "") : null;

    if (valor === null && colunaDebito >= 0) {
      const debito = converterValor(linha[colunaDebito] ?? "");
      if (debito !== null && debito !== 0) valor = -Math.abs(debito);
    }
    if ((valor === null || valor === 0) && colunaCredito >= 0) {
      const credito = converterValor(linha[colunaCredito] ?? "");
      if (credito !== null && credito !== 0) valor = Math.abs(credito);
    }

    if (!data || !descricao || valor === null || valor === 0) {
      linhasIgnoradas += 1;
      return [];
    }

    const valorAbsoluto = Math.abs(valor);
    const assinatura = `${data}|${normalizar(descricao)}|${Math.round(valor * 100)}|${indice}`;
    return [{
      id: `csv-${indice}-${data}`,
      importacaoId: `csv:${assinatura}`,
      data,
      descricao,
      valor: valorAbsoluto,
      tipo: valor > 0 ? "receita" as const : "despesa" as const,
      formato: "csv" as const,
    }];
  });

  return { formato: "csv", itens, linhasIgnoradas };
}

function valorTag(bloco: string, tag: string): string {
  const expressao = new RegExp(`<${tag}>([^<\\r\\n]+)`, "i");
  return bloco.match(expressao)?.[1]?.trim() ?? "";
}

function decodificarOfx(texto: string): string {
  return texto
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function lerOfx(conteudo: string): ResultadoLeituraExtrato {
  const blocos = [...conteudo.matchAll(/<STMTTRN>([\s\S]*?)(?=<STMTTRN>|<\/BANKTRANLIST>|$)/gi)];
  if (!blocos.length) throw new Error("O OFX não possui lançamentos bancários reconhecíveis.");

  let linhasIgnoradas = 0;
  const itens = blocos.flatMap((resultado, indice) => {
    const bloco = resultado[1];
    const data = converterData(valorTag(bloco, "DTPOSTED"));
    const valor = converterValor(valorTag(bloco, "TRNAMT"));
    const descricao = limparDescricao(decodificarOfx(valorTag(bloco, "MEMO") || valorTag(bloco, "NAME")));
    const fitId = valorTag(bloco, "FITID");

    if (!data || !descricao || valor === null || valor === 0) {
      linhasIgnoradas += 1;
      return [];
    }

    return [{
      id: `ofx-${fitId || "sem-id"}-${indice}`,
      importacaoId: `ofx:${fitId || `${data}|${Math.round(valor * 100)}|${normalizar(descricao)}|${indice}`}`,
      data,
      descricao,
      valor: Math.abs(valor),
      tipo: valor > 0 ? "receita" as const : "despesa" as const,
      formato: "ofx" as const,
    }];
  });

  return { formato: "ofx", itens, linhasIgnoradas };
}

export function lerExtrato(conteudo: string, nomeArquivo: string): ResultadoLeituraExtrato {
  const formatoOfx = nomeArquivo.toLowerCase().endsWith(".ofx") || /<OFX>/i.test(conteudo);
  return formatoOfx ? lerOfx(conteudo) : lerCsv(conteudo);
}

function chaveComparacao(
  transacao: Pick<Transacao, "data" | "desc" | "valor" | "tipo" | "contaId">,
  contaId: string
): string {
  return [
    transacao.data,
    transacao.tipo ?? "despesa",
    normalizar(transacao.desc || ""),
    Math.round((transacao.valor || 0) * 100),
    transacao.contaId || contaId,
  ].join("|");
}

export function statusItemImportacao(
  item: ItemExtrato,
  transacoesExistentes: Transacao[],
  contaId: string
): StatusItemImportacao {
  return classificarItensImportacao([item], transacoesExistentes, contaId)[0].status;
}

export function classificarItensImportacao(
  itens: ItemExtrato[],
  transacoesExistentes: Transacao[],
  contaId: string
): Array<{ item: ItemExtrato; status: StatusItemImportacao }> {
  const idsExistentes = new Set(
    transacoesExistentes.map((transacao) => transacao.importacaoId).filter(Boolean)
  );
  const chavesExistentes = new Set(
    transacoesExistentes.map((transacao) => chaveComparacao(transacao, contaId))
  );
  const idsNoArquivo = new Set<string>();
  const chavesNoArquivo = new Set<string>();

  return itens.map((item) => {
    const chave = chaveComparacao(
      { data: item.data, desc: item.descricao, valor: item.valor, tipo: item.tipo, contaId },
      contaId
    );
    let status: StatusItemImportacao = "novo";

    if (idsExistentes.has(item.importacaoId)) {
      status = "ja_importado";
    } else if (
      idsNoArquivo.has(item.importacaoId) ||
      chavesExistentes.has(chave) ||
      chavesNoArquivo.has(chave)
    ) {
      status = "possivel_duplicado";
    }

    idsNoArquivo.add(item.importacaoId);
    chavesNoArquivo.add(chave);
    return { item, status };
  });
}

export function converterItemExtrato(
  item: ItemExtrato,
  contaId: string,
  pessoa: string
): NovaTransacao {
  return {
    data: item.data,
    desc: item.descricao,
    categoria: item.tipo === "receita" ? "Outras receitas" : "Outros",
    cartao: "",
    pessoa,
    valor: item.valor,
    tipo: item.tipo,
    contaId,
    contaDestinoId: "",
    cartaoId: "",
    totalParcelas: 1,
    importacaoId: item.importacaoId,
    origemImportacao: item.formato,
  };
}
