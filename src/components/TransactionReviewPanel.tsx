"use client";

import { useMemo, useState } from "react";
import { fmtMoeda } from "@/src/lib/categories";
import { useCategoryCatalog } from "@/src/components/CategoryCatalogProvider";
import { tipoDe } from "@/src/lib/finance";
import {
  analisarTransacoesParaRevisao,
  type MotivoRevisao,
} from "@/src/lib/transaction-review";
import type {
  ContaFinanceira,
  NovaTransacao,
  Transacao,
} from "@/src/lib/types";

type FiltroRevisao = "todos" | MotivoRevisao;

const MOTIVO_LABEL: Record<MotivoRevisao, string> = {
  dados_incompletos: "Dados incompletos",
  categoria_generica: "Categoria genérica",
  possivel_duplicidade: "Possível duplicidade",
};

function dataLabel(data: string): string {
  return data ? data.split("-").reverse().join("/") : "Sem data";
}

export default function TransactionReviewPanel({
  transacoes,
  contas,
  onUpdate,
  onEdit,
  onDelete,
}: {
  transacoes: Transacao[];
  contas: ContaFinanceira[];
  onUpdate: (id: string, dados: NovaTransacao) => Promise<unknown>;
  onEdit: (transacao: Transacao) => void;
  onDelete: (id: string) => Promise<void>;
}) {
  const { despesas: categoriasDespesa, receitas: categoriasReceita } = useCategoryCatalog();
  const [filtro, setFiltro] = useState<FiltroRevisao>("todos");
  const [salvandoId, setSalvandoId] = useState("");
  const [mensagem, setMensagem] = useState("");

  const itens = useMemo(
    () => analisarTransacoesParaRevisao(transacoes),
    [transacoes]
  );

  const itensVisiveis = useMemo(
    () => itens.filter((item) => filtro === "todos" || item.motivos.includes(filtro)),
    [filtro, itens]
  );

  const resumo = useMemo(
    () => ({
      incompletos: itens.filter((item) => item.motivos.includes("dados_incompletos")).length,
      categorias: itens.filter((item) => item.motivos.includes("categoria_generica")).length,
      duplicados: itens.filter((item) => item.motivos.includes("possivel_duplicidade")).length,
    }),
    [itens]
  );

  const contasPorId = useMemo(
    () => new Map(contas.map((conta) => [conta.id, conta.nome])),
    [contas]
  );

  async function atualizarCategoria(transacao: Transacao, categoria: string) {
    const { id, ...dados } = transacao;
    setSalvandoId(id);
    setMensagem("");
    try {
      await onUpdate(id, { ...dados, categoria });
      setMensagem(`Categoria de “${transacao.desc}” atualizada.`);
    } catch (erro) {
      setMensagem(`Não foi possível atualizar: ${erro instanceof Error ? erro.message : String(erro)}`);
    } finally {
      setSalvandoId("");
    }
  }

  return (
    <div className="panel review-panel">
      <div className="panel-title-row review-heading">
        <div>
          <span className="review-eyebrow">Qualidade dos dados</span>
          <h2>Central de revisão</h2>
          <p>Corrija categorias, vínculos ausentes e lançamentos possivelmente repetidos.</p>
        </div>
        <div className={`review-status${itens.length ? " pending" : " complete"}`}>
          <strong>{itens.length}</strong>
          <span>{itens.length === 1 ? "pendência" : "pendências"}</span>
        </div>
      </div>

      <div className="review-summary" aria-label="Resumo da revisão">
        <div>
          <span>Dados incompletos</span>
          <strong>{resumo.incompletos}</strong>
        </div>
        <div>
          <span>Categorias genéricas</span>
          <strong>{resumo.categorias}</strong>
        </div>
        <div>
          <span>Possíveis duplicados</span>
          <strong>{resumo.duplicados}</strong>
        </div>
      </div>

      {itens.length ? (
        <>
          <div className="review-toolbar">
            <div>
              <strong>Itens para conferir</strong>
              <span>{itensVisiveis.length} no filtro atual</span>
            </div>
            <div className="review-filters" role="group" aria-label="Filtrar pendências">
              <button type="button" className={filtro === "todos" ? "active" : ""} aria-pressed={filtro === "todos"} onClick={() => setFiltro("todos")}>Todas</button>
              <button type="button" className={filtro === "dados_incompletos" ? "active" : ""} aria-pressed={filtro === "dados_incompletos"} onClick={() => setFiltro("dados_incompletos")}>Incompletas</button>
              <button type="button" className={filtro === "categoria_generica" ? "active" : ""} aria-pressed={filtro === "categoria_generica"} onClick={() => setFiltro("categoria_generica")}>Categorias</button>
              <button type="button" className={filtro === "possivel_duplicidade" ? "active" : ""} aria-pressed={filtro === "possivel_duplicidade"} onClick={() => setFiltro("possivel_duplicidade")}>Duplicadas</button>
            </div>
          </div>

          {mensagem ? <div className="review-message" role="status">{mensagem}</div> : null}

          {itensVisiveis.length ? (
            <div className="review-list">
              {itensVisiveis.slice(0, 12).map(({ transacao, motivos, camposAusentes }) => {
                const tipo = tipoDe(transacao);
                const categorias = tipo === "receita" ? categoriasReceita : categoriasDespesa;
                const origem = transacao.cartao || (transacao.contaId ? contasPorId.get(transacao.contaId) : "");
                return (
                  <article className="review-item" key={transacao.id}>
                    <div className="review-item-main">
                      <div className="review-item-topline">
                        <span>{dataLabel(transacao.data)}</span>
                        <span>{tipo === "receita" ? "Receita" : tipo === "transferencia" ? "Transferência" : "Despesa"}</span>
                        {origem ? <span>{origem}</span> : null}
                      </div>
                      <h3>{transacao.desc || "Lançamento sem descrição"}</h3>
                      <strong className={`review-amount ${tipo}`}>{tipo === "receita" ? "+ " : tipo === "despesa" ? "− " : ""}{fmtMoeda(transacao.valor)}</strong>
                      <div className="review-reasons">
                        {motivos.map((motivo) => <span className={motivo} key={motivo}>{MOTIVO_LABEL[motivo]}</span>)}
                      </div>
                      {camposAusentes.length ? <p>Falta informar: {camposAusentes.join(", ")}.</p> : null}
                    </div>

                    <div className="review-item-actions">
                      {motivos.includes("categoria_generica") && tipo !== "transferencia" ? (
                        <label>
                          <span>Corrigir categoria</span>
                          <select
                            value={transacao.categoria || ""}
                            disabled={salvandoId === transacao.id}
                            onChange={(evento) => atualizarCategoria(transacao, evento.target.value)}
                          >
                            <option value="" disabled>Selecione</option>
                            {categorias.map((categoria) => <option value={categoria.nome} key={categoria.nome}>{categoria.nome}</option>)}
                          </select>
                        </label>
                      ) : null}
                      <button type="button" className="secondary" onClick={() => onEdit(transacao)}>Revisar detalhes</button>
                      {motivos.includes("possivel_duplicidade") ? (
                        <button type="button" className="danger-outline" onClick={() => onDelete(transacao.id)}>Excluir duplicado</button>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="review-filter-empty">Nenhuma pendência neste filtro.</div>
          )}
        </>
      ) : (
        <div className="review-empty">
          <span aria-hidden="true">✓</span>
          <div>
            <strong>Tudo revisado</strong>
            <p>Seus lançamentos estão completos e sem duplicidades aparentes.</p>
          </div>
        </div>
      )}

      <p className="review-disclaimer">A detecção compara data, descrição, valor e origem. Confirme antes de excluir um lançamento.</p>
    </div>
  );
}
