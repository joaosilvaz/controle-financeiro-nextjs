"use client";

import { useMemo, useRef, useState, type ChangeEvent } from "react";
import { fmtMoeda } from "@/src/lib/categories";
import {
  classificarItensImportacao,
  converterItemExtrato,
  lerExtrato,
  type ResultadoLeituraExtrato,
} from "@/src/lib/statement-import";
import type {
  ContaFinanceira,
  NovaTransacao,
  Transacao,
} from "@/src/lib/types";

const LIMITE_ARQUIVO = 5 * 1024 * 1024;

function dataLabel(data: string): string {
  return data.split("-").reverse().join("/");
}

export default function StatementImportPanel({
  transacoes,
  contas,
  pessoas,
  onImport,
}: {
  transacoes: Transacao[];
  contas: ContaFinanceira[];
  pessoas: string[];
  onImport: (itens: NovaTransacao[]) => Promise<unknown>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [resultado, setResultado] = useState<ResultadoLeituraExtrato | null>(null);
  const [nomeArquivo, setNomeArquivo] = useState("");
  const [contaId, setContaId] = useState(() => contas.find((conta) => conta.ativa)?.id ?? "");
  const [pessoa, setPessoa] = useState(() => pessoas[0] ?? "");
  const [selecionados, setSelecionados] = useState<Set<string>>(() => new Set());
  const [processando, setProcessando] = useState(false);
  const [mensagem, setMensagem] = useState<{ tipo: "success" | "error"; texto: string } | null>(null);

  const previa = useMemo(
    () => resultado
      ? classificarItensImportacao(resultado.itens, transacoes, contaId)
      : [],
    [contaId, resultado, transacoes]
  );

  const { resumo, itensSelecionados } = useMemo(() => {
    const totais = { novos: 0, semelhantes: 0, importados: 0 };
    const escolhidos: typeof previa = [];
    previa.forEach((entrada) => {
      if (entrada.status === "novo") totais.novos += 1;
      else if (entrada.status === "possivel_duplicado") totais.semelhantes += 1;
      else totais.importados += 1;
      if (entrada.status !== "ja_importado" && selecionados.has(entrada.item.id)) {
        escolhidos.push(entrada);
      }
    });
    return { resumo: totais, itensSelecionados: escolhidos };
  }, [previa, selecionados]);

  function selecionarNovos(
    leitura: ResultadoLeituraExtrato,
    contaSelecionada: string
  ): Set<string> {
    return new Set(
      classificarItensImportacao(leitura.itens, transacoes, contaSelecionada)
        .filter(({ status }) => status === "novo")
        .map(({ item }) => item.id)
    );
  }

  async function carregarArquivo(evento: ChangeEvent<HTMLInputElement>) {
    const arquivo = evento.target.files?.[0];
    if (!arquivo) return;

    setMensagem(null);
    if (arquivo.size > LIMITE_ARQUIVO) {
      setMensagem({ tipo: "error", texto: "O arquivo precisa ter no máximo 5 MB." });
      evento.target.value = "";
      return;
    }

    setProcessando(true);
    try {
      const leitura = lerExtrato(await arquivo.text(), arquivo.name);
      if (!leitura.itens.length) {
        throw new Error("Nenhum lançamento válido foi encontrado no arquivo.");
      }
      setResultado(leitura);
      setNomeArquivo(arquivo.name);
      setSelecionados(selecionarNovos(leitura, contaId));
    } catch (erro) {
      setResultado(null);
      setNomeArquivo("");
      setSelecionados(new Set());
      setMensagem({
        tipo: "error",
        texto: erro instanceof Error ? erro.message : "Não foi possível ler o arquivo.",
      });
      evento.target.value = "";
    } finally {
      setProcessando(false);
    }
  }

  function alterarConta(novaContaId: string) {
    setContaId(novaContaId);
    if (resultado) setSelecionados(selecionarNovos(resultado, novaContaId));
  }

  function alternarItem(id: string) {
    setSelecionados((atuais) => {
      const proximos = new Set(atuais);
      if (proximos.has(id)) proximos.delete(id);
      else proximos.add(id);
      return proximos;
    });
  }

  function limparArquivo() {
    setResultado(null);
    setNomeArquivo("");
    setSelecionados(new Set());
    setMensagem(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function importarSelecionados() {
    if (!contaId) {
      setMensagem({ tipo: "error", texto: "Selecione a conta relacionada ao extrato." });
      return;
    }
    if (!itensSelecionados.length) {
      setMensagem({ tipo: "error", texto: "Selecione ao menos um lançamento novo." });
      return;
    }

    setProcessando(true);
    setMensagem(null);
    try {
      const transacoesNovas = itensSelecionados.map(({ item }) =>
        converterItemExtrato(item, contaId, pessoa)
      );
      await onImport(transacoesNovas);
      const quantidade = transacoesNovas.length;
      limparArquivo();
      setMensagem({
        tipo: "success",
        texto: `${quantidade} ${quantidade === 1 ? "lançamento importado" : "lançamentos importados"}. As categorias genéricas já estão na Central de revisão.`,
      });
    } catch (erro) {
      setMensagem({
        tipo: "error",
        texto: `Não foi possível importar: ${erro instanceof Error ? erro.message : String(erro)}`,
      });
    } finally {
      setProcessando(false);
    }
  }

  return (
    <div className="panel statement-import-panel">
      <div className="panel-title-row import-heading">
        <div>
          <span className="import-eyebrow">Entrada de dados</span>
          <h2>Importar extrato</h2>
          <p>Traga movimentações bancárias em CSV ou OFX com verificação antes de salvar.</p>
        </div>
        <div className="import-formats" aria-label="Formatos aceitos">
          <span>CSV</span>
          <span>OFX</span>
        </div>
      </div>

      {!resultado ? (
        <div className="import-upload">
          <div className="import-upload-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 16V4M7 9l5-5 5 5" />
              <path d="M5 14v5h14v-5" />
            </svg>
          </div>
          <div>
            <strong>Selecione o arquivo do seu banco</strong>
            <span>O processamento acontece somente neste dispositivo · máximo de 5 MB</span>
          </div>
          <label className="import-file-button" htmlFor="statement-file">
            {processando ? "Lendo arquivo…" : "Escolher arquivo"}
          </label>
          <input
            ref={inputRef}
            id="statement-file"
            className="import-file-input"
            type="file"
            accept=".csv,.ofx,text/csv,application/x-ofx"
            disabled={processando}
            onChange={carregarArquivo}
          />
        </div>
      ) : (
        <>
          <div className="import-file-summary">
            <div className="import-file-meta">
              <span className="import-file-type">{resultado.formato.toUpperCase()}</span>
              <div>
                <strong>{nomeArquivo}</strong>
                <span>{resultado.itens.length} linhas reconhecidas</span>
              </div>
            </div>
            <button type="button" className="link" onClick={limparArquivo}>Trocar arquivo</button>
          </div>

          <div className="import-settings">
            <label>
              Conta do extrato
              <select value={contaId} onChange={(evento) => alterarConta(evento.target.value)} required>
                <option value="">Selecione uma conta</option>
                {contas.filter((conta) => conta.ativa || conta.id === contaId).map((conta) => (
                  <option value={conta.id} key={conta.id}>{conta.nome}</option>
                ))}
              </select>
            </label>
            <label>
              Pessoa responsável
              <select value={pessoa} onChange={(evento) => setPessoa(evento.target.value)}>
                <option value="">Não informar</option>
                {pessoas.map((nome) => <option value={nome} key={nome}>{nome}</option>)}
              </select>
            </label>
          </div>

          <div className="import-summary" aria-label="Resumo do arquivo">
            <div><span>Novos</span><strong>{resumo.novos}</strong></div>
            <div className="warning"><span>Semelhantes</span><strong>{resumo.semelhantes}</strong></div>
            <div><span>Já importados</span><strong>{resumo.importados}</strong></div>
            <div><span>Ignorados</span><strong>{resultado.linhasIgnoradas}</strong></div>
          </div>

          <div className="import-preview-head">
            <div>
              <strong>Prévia dos lançamentos</strong>
              <span>{itensSelecionados.length} selecionados para importar</span>
            </div>
            <button type="button" className="link" onClick={() => setSelecionados(selecionarNovos(resultado, contaId))}>Selecionar somente novos</button>
          </div>

          <div className="import-preview">
            {previa.slice(0, 30).map(({ item, status }) => (
              <label className={`import-row ${status}`} key={item.id}>
                <input
                  type="checkbox"
                  checked={status !== "ja_importado" && selecionados.has(item.id)}
                  disabled={status === "ja_importado"}
                  onChange={() => alternarItem(item.id)}
                />
                <span className="import-row-date">{dataLabel(item.data)}</span>
                <span className="import-row-description">{item.descricao}</span>
                <span className={`import-row-type ${item.tipo}`}>{item.tipo === "receita" ? "Receita" : "Despesa"}</span>
                <strong className={item.tipo}>{item.tipo === "receita" ? "+ " : "− "}{fmtMoeda(item.valor)}</strong>
                <span className={`import-row-status ${status}`}>
                  {status === "novo" ? "Novo" : status === "ja_importado" ? "Já importado" : "Conferir"}
                </span>
              </label>
            ))}
          </div>
          {previa.length > 30 ? <p className="import-preview-limit">A prévia mostra 30 de {previa.length} itens. Todos os selecionados serão importados.</p> : null}

          <div className="import-actions">
            <button type="button" className="secondary" onClick={limparArquivo} disabled={processando}>Cancelar</button>
            <button type="button" onClick={importarSelecionados} disabled={processando || !itensSelecionados.length || !contaId}>
              {processando ? "Importando…" : `Importar ${itensSelecionados.length} ${itensSelecionados.length === 1 ? "lançamento" : "lançamentos"}`}
            </button>
          </div>
        </>
      )}

      {mensagem ? <div className={`import-message ${mensagem.tipo}`} role="status">{mensagem.texto}</div> : null}
      <p className="import-disclaimer">Transferências podem aparecer como entrada ou saída no extrato. Revise-as após a importação para manter os saldos corretos.</p>
    </div>
  );
}
