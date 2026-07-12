"use client";

import { useState } from "react";
import { CAT_MAP, fmtMoeda, hexToBg, mesLabel } from "@/lib/categories";
import type { Transacao } from "@/lib/types";

const ROWS_PER_PAGE = 8;

export default function TransactionsTable({
  transacoes,
  cartoes,
  pessoas,
  mesesDisponiveis,
  filterMonth,
  filterCartao,
  filterPessoa,
  onFilterMonth,
  onFilterCartao,
  onFilterPessoa,
  onEdit,
  onDelete,
  onClear,
  onExport,
}: {
  transacoes: Transacao[];
  cartoes: string[];
  pessoas: string[];
  mesesDisponiveis: string[];
  filterMonth: string;
  filterCartao: string;
  filterPessoa: string;
  onFilterMonth: (v: string) => void;
  onFilterCartao: (v: string) => void;
  onFilterPessoa: (v: string) => void;
  onEdit: (t: Transacao) => void;
  onDelete: (id: string) => void;
  onClear: () => void;
  onExport: () => void;
}) {
  // O pai passa key={filterMonth-filterCartao-filterPessoa}, então trocar de
  // filtro remonta esta tabela e a página volta pra 1 automaticamente —
  // não precisa de useEffect pra isso.
  const [page, setPage] = useState(1);

  const totalPaginas = Math.max(1, Math.ceil(transacoes.length / ROWS_PER_PAGE));
  const paginaAtual = Math.min(page, totalPaginas);
  const inicio = (paginaAtual - 1) * ROWS_PER_PAGE;
  const pagina = transacoes.slice(inicio, inicio + ROWS_PER_PAGE);

  return (
    <div className="panel">
      <div className="toolbar">
        <h2>Lançamentos</h2>
        <div className="filters">
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
        <table>
          <thead>
            <tr>
              <th>Data</th>
              <th>Descrição</th>
              <th>Categoria</th>
              <th>Cartão</th>
              <th>Pessoa</th>
              <th className="num">Valor</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {pagina.map((t) => {
              const cor = CAT_MAP[t.categoria];
              return (
                <tr key={t.id}>
                  <td>{(t.data || "").split("-").reverse().join("/")}</td>
                  <td>{t.desc}</td>
                  <td>
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
                  <td>{t.cartao || "—"}</td>
                  <td className="pessoa-tag">{t.pessoa || "—"}</td>
                  <td className="num">{fmtMoeda(t.valor)}</td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <button className="link" onClick={() => onEdit(t)}>
                      Editar
                    </button>
                    <button className="link danger" onClick={() => onDelete(t.id)}>
                      Excluir
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
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
