"use client";

import { useMemo, useState } from "react";
import { fmtMoeda, hexToBg, mesLabel } from "@/src/lib/categories";
import { useCategoryCatalog } from "@/src/components/CategoryCatalogProvider";
import { tipoDe } from "@/src/lib/finance";
import type { ContaFinanceira, TipoTransacao, Transacao } from "@/src/lib/types";

const ROWS_PER_PAGE = 8;

export default function TransactionsTable({
  transacoes,
  cartoes,
  pessoas,
  contas,
  mesesDisponiveis,
  filterMonth,
  filterCartao,
  filterPessoa,
  filterConta,
  filterTipo,
  filterTag,
  tagsDisponiveis,
  onFilterMonth,
  onFilterCartao,
  onFilterPessoa,
  onFilterConta,
  onFilterTipo,
  onFilterTag,
  onEdit,
  onDelete,
  onClear,
  onExport,
}: {
  transacoes: Transacao[];
  cartoes: string[];
  pessoas: string[];
  contas: ContaFinanceira[];
  mesesDisponiveis: string[];
  filterMonth: string;
  filterCartao: string;
  filterPessoa: string;
  filterConta: string;
  filterTipo: TipoTransacao | "";
  filterTag: string;
  tagsDisponiveis: string[];
  onFilterMonth: (v: string) => void;
  onFilterCartao: (v: string) => void;
  onFilterPessoa: (v: string) => void;
  onFilterConta: (v: string) => void;
  onFilterTipo: (v: TipoTransacao | "") => void;
  onFilterTag: (v: string) => void;
  onEdit: (t: Transacao) => void;
  onDelete: (id: string) => void;
  onClear: () => void;
  onExport: () => void;
}) {
  const { cores: coresCategorias } = useCategoryCatalog();
  // O pai passa key={filterMonth-filterCartao-filterPessoa}, então trocar de
  // filtro remonta esta tabela e a página volta pra 1 automaticamente —
  // não precisa de useEffect pra isso.
  const [page, setPage] = useState(1);

  const totalPaginas = Math.max(1, Math.ceil(transacoes.length / ROWS_PER_PAGE));
  const paginaAtual = Math.min(page, totalPaginas);
  const inicio = (paginaAtual - 1) * ROWS_PER_PAGE;
  const pagina = transacoes.slice(inicio, inicio + ROWS_PER_PAGE);
  const contasPorId = useMemo(
    () => new Map(contas.map((conta) => [conta.id, conta])),
    [contas]
  );

  return (
    <div className="panel">
      <div className="toolbar">
        <h2>Lançamentos</h2>
        <div className="filters">
          <select
            aria-label="Filtrar por tipo"
            value={filterTipo}
            onChange={(e) => onFilterTipo(e.target.value as TipoTransacao | "")}
          >
            <option value="">Todos os tipos</option>
            <option value="despesa">Despesas</option>
            <option value="receita">Receitas</option>
            <option value="transferencia">Transferências</option>
          </select>
          <select aria-label="Filtrar por tag" value={filterTag} onChange={(e) => onFilterTag(e.target.value)}>
            <option value="">Todas as tags</option>
            {tagsDisponiveis.map((tag) => <option value={tag} key={tag}>#{tag}</option>)}
          </select>
          <select value={filterMonth} onChange={(e) => onFilterMonth(e.target.value)}>
            <option value="">Todos os meses</option>
            {mesesDisponiveis.map((m) => (
              <option key={m} value={m}>
                {mesLabel(m)}
              </option>
            ))}
          </select>
          <select value={filterCartao} onChange={(e) => onFilterCartao(e.target.value)}>
            <option value="">Todos os cartões</option>
            {cartoes.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select value={filterPessoa} onChange={(e) => onFilterPessoa(e.target.value)}>
            <option value="">Todas as pessoas</option>
            {pessoas.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <select value={filterConta} onChange={(e) => onFilterConta(e.target.value)}>
            <option value="">Todas as contas</option>
            {contas.map((conta) => (
              <option key={conta.id} value={conta.id}>{conta.nome}</option>
            ))}
          </select>
        </div>
        <div className="actions-inline">
          <button className="secondary" onClick={onExport}>
            Exportar CSV
          </button>
          <button className="danger-outline" onClick={onClear}>
            Limpar tudo
          </button>
        </div>
      </div>

      {transacoes.length === 0 ? (
        <div className="empty">Nenhum lançamento encontrado para esse filtro.</div>
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Descrição</th>
                <th>Tipo</th>
                <th>Categoria</th>
                <th>Conta</th>
                <th>Cartão</th>
                <th>Fatura</th>
                <th>Pessoa</th>
                <th className="num">Valor</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {pagina.map((t) => {
                const cor = coresCategorias[t.categoria];
                const tipo = tipoDe(t);
                const pagamentoFatura = Boolean(t.faturaPagamentoId);
                const contaOrigem = t.contaId ? contasPorId.get(t.contaId) : undefined;
                const contaDestino = t.contaDestinoId ? contasPorId.get(t.contaDestinoId) : undefined;
                return (
                  <tr key={t.id}>
                    <td data-label="Data">{(t.data || "").split("-").reverse().join("/")}</td>
                    <td data-label="Descrição">
                      <span className="transaction-description">{t.desc}</span>
                      {t.tags?.length ? (
                        <span className="transaction-tags">
                          {t.tags.map((tag) => <span key={tag}>#{tag}</span>)}
                        </span>
                      ) : null}
                      {t.nota ? <span className="transaction-note" title={t.nota}>Nota: {t.nota}</span> : null}
                    </td>
                    <td data-label="Tipo">
                      <span className={`type-chip ${pagamentoFatura ? "pagamento-fatura" : tipo}`}>
                        {pagamentoFatura
                          ? "Pagamento de fatura"
                          : tipo === "receita"
                          ? "Receita"
                          : tipo === "transferencia"
                            ? "Transferência"
                            : "Despesa"}
                      </span>
                    </td>
                    <td data-label="Categoria">
                      <span
                        className="chip"
                        style={{
                          background: cor ? hexToBg(cor) : "#eee",
                          color: cor || "#333",
                        }}
                      >
                        <span className="dot" style={{ background: cor || "#999" }} />
                        {t.categoria || "—"}
                      </span>
                    </td>
                    <td data-label="Conta" className="account-cell">
                      {contaOrigem?.nome ?? "Não vinculada"}
                      {tipo === "transferencia" && !pagamentoFatura && contaDestino ? ` → ${contaDestino.nome}` : ""}
                    </td>
                    <td data-label="Cartão">
                      {t.cartao || "—"}
                      {(t.totalParcelas ?? 1) > 1
                        ? ` · ${t.parcelaAtual ?? 1}/${t.totalParcelas}`
                        : ""}
                    </td>
                    <td data-label="Fatura">{t.faturaMes ? mesLabel(t.faturaMes) : "—"}</td>
                    <td data-label="Pessoa" className="pessoa-tag">{t.pessoa || "—"}</td>
                    <td data-label="Valor" className={`num tx-value ${pagamentoFatura ? "pagamento-fatura" : tipo}`}>
                      {tipo === "receita" ? "+ " : tipo === "despesa" || pagamentoFatura ? "− " : ""}
                      {fmtMoeda(t.valor)}
                    </td>
                    <td data-label="" style={{ whiteSpace: "nowrap" }}>
                      <div className="row-icon-actions">
                        {pagamentoFatura ? (
                          <span className="managed-transaction" title="Gerencie este pagamento pela seção de cartões">Gerenciado pela fatura</span>
                        ) : (
                          <>
                        <button aria-label={`Editar ${t.desc}`} className="btn-action edit" onClick={() => onEdit(t)}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 20h9" />
                            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
                          </svg>
                          Editar
                        </button>
                        <button aria-label={`Excluir ${t.desc}`} className="btn-action delete" onClick={() => onDelete(t.id)}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 6h18" />
                            <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                            <path d="M10 11v6M14 11v6" />
                          </svg>
                          Excluir
                        </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {transacoes.length > 0 && (
        <div className="pagination">
          <div>
            Mostrando {inicio + 1}–{Math.min(inicio + ROWS_PER_PAGE, transacoes.length)} de{" "}
            {transacoes.length}
          </div>
          <div className="pg-btns">
            <button
              className="secondary"
              disabled={paginaAtual <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Anterior
            </button>
            <button
              className="secondary"
              disabled
              style={{ opacity: 1, color: "var(--text)", background: "var(--surface-alt)" }}
            >
              Página {paginaAtual} de {totalPaginas}
            </button>
            <button
              className="secondary"
              disabled={paginaAtual >= totalPaginas}
              onClick={() => setPage((p) => p + 1)}
            >
              Próxima
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
