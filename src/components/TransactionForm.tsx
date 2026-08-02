"use client";

import { useState, type FormEvent } from "react";
import { CATEGORIAS } from "@/src/lib/categories";
import type { NovaTransacao, Transacao } from "@/src/lib/types";

function estadoInicial(
  editing: Transacao | null,
  cartoes: string[],
  pessoas: string[]
): NovaTransacao {
  if (editing) {
    return {
      data: editing.data,
      desc: editing.desc,
      categoria: editing.categoria,
      cartao: editing.cartao,
      pessoa: editing.pessoa,
      valor: editing.valor,
    };
  }
  return {
    data: new Date().toISOString().slice(0, 10),
    desc: "",
    categoria: CATEGORIAS[0].nome,
    cartao: cartoes[0] || "",
    pessoa: pessoas[0] || "",
    valor: 0,
  };
}

export default function TransactionForm({
  cartoes,
  pessoas,
  editing,
  onSubmit,
  onCancelEdit,
  onAddCartao,
  onAddPessoa,
}: {
  cartoes: string[];
  pessoas: string[];
  editing: Transacao | null;
  onSubmit: (dados: NovaTransacao) => Promise<unknown>;
  onCancelEdit: () => void;
  onAddCartao: (nome: string) => Promise<unknown>;
  onAddPessoa: (nome: string) => Promise<unknown>;
}) {
  // Este componente recebe key={editing?.id ?? "novo"} do componente pai:
  // trocar de "adicionar" para "editar" (ou entre itens diferentes) remonta
  // o formulário, então o estado inicial abaixo já nasce correto sem precisar
  // sincronizar via useEffect.
  const [form, setForm] = useState<NovaTransacao>(() =>
    estadoInicial(editing, cartoes, pessoas)
  );

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    await onSubmit(form);
    if (!editing) {
      setForm(estadoInicial(null, cartoes, pessoas));
    }
  }

  async function handleNovoCartao() {
    const nome = prompt("Nome do novo cartão ou forma de pagamento:");
    if (nome && nome.trim() && !cartoes.includes(nome.trim())) {
      await onAddCartao(nome.trim());
      setForm((f) => ({ ...f, cartao: nome.trim() }));
    }
  }

  async function handleNovaPessoa() {
    const nome = prompt("Nome da nova pessoa:");
    if (nome && nome.trim() && !pessoas.includes(nome.trim())) {
      await onAddPessoa(nome.trim());
      setForm((f) => ({ ...f, pessoa: nome.trim() }));
    }
  }

  return (
    <div className="panel">
      <h2>Novo lançamento</h2>
      {editing && (
        <div className="editing-banner">
          Editando lançamento — altere os campos e clique em &quot;Salvar alterações&quot;.
        </div>
      )}
      <form id="txForm" onSubmit={handleSubmit}>
        <div>
          <label>Data</label>
          <input
            type="date"
            required
            value={form.data}
            onChange={(e) => setForm((f) => ({ ...f, data: e.target.value }))}
          />
        </div>
        <div className="span2">
          <label>Descrição</label>
          <input
            type="text"
            placeholder="Ex: Mercado, Uber, Netflix"
            required
            value={form.desc}
            onChange={(e) => setForm((f) => ({ ...f, desc: e.target.value }))}
          />
        </div>
        <div>
          <label>Categoria</label>
          <select
            value={form.categoria}
            onChange={(e) => setForm((f) => ({ ...f, categoria: e.target.value }))}
          >
            {CATEGORIAS.map((c) => (
              <option key={c.nome}>{c.nome}</option>
            ))}
          </select>
        </div>
        <div>
          <label>Cartão / Forma</label>
          <select
            value={form.cartao}
            onChange={(e) => setForm((f) => ({ ...f, cartao: e.target.value }))}
          >
            {cartoes.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <label>Pessoa</label>
          <select
            value={form.pessoa}
            onChange={(e) => setForm((f) => ({ ...f, pessoa: e.target.value }))}
          >
            {pessoas.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </div>
        <div>
          <label>Valor (R$)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            placeholder="0,00"
            required
            value={form.valor || ""}
            onChange={(e) => setForm((f) => ({ ...f, valor: parseFloat(e.target.value) || 0 }))}
          />
        </div>
        <div className="full row-actions">
          <button type="submit">{editing ? "Salvar alterações" : "Adicionar"}</button>
          {editing && (
            <button type="button" className="secondary" onClick={onCancelEdit}>
              Cancelar edição
            </button>
          )}
          <button type="button" className="secondary" onClick={handleNovoCartao}>
            + Novo cartão/forma
          </button>
          <button type="button" className="secondary" onClick={handleNovaPessoa}>
            + Nova pessoa
          </button>
        </div>
      </form>
    </div>
  );
}
