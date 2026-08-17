"use client";

import { useState, type FormEvent } from "react";
import {
  CATEGORIAS_DESPESA,
  CATEGORIAS_RECEITA,
  CATEGORIAS_TRANSFERENCIA,
} from "@/src/lib/categories";
import { tipoDe } from "@/src/lib/finance";
import type {
  CartaoCredito,
  ContaFinanceira,
  NovaTransacao,
  TipoTransacao,
  Transacao,
} from "@/src/lib/types";

function estadoInicial(
  editing: Transacao | null,
  cartoes: CartaoCredito[],
  pessoas: string[],
  contas: ContaFinanceira[]
): NovaTransacao {
  if (editing) {
    return {
      data: editing.data,
      desc: editing.desc,
      categoria: editing.categoria,
      cartao: editing.cartao,
      cartaoId:
        editing.cartaoId ?? cartoes.find((cartao) => cartao.nome === editing.cartao)?.id ?? "",
      pessoa: editing.pessoa,
      valor: editing.valor,
      tipo: tipoDe(editing),
      contaId: editing.contaId ?? "",
      contaDestinoId: editing.contaDestinoId ?? "",
      dataCompra: editing.dataCompra,
      faturaMes: editing.faturaMes,
      parcelaAtual: editing.parcelaAtual,
      totalParcelas: editing.totalParcelas ?? 1,
      grupoParcelamentoId: editing.grupoParcelamentoId,
    };
  }
  return {
    data: new Date().toISOString().slice(0, 10),
    desc: "",
    categoria: CATEGORIAS_DESPESA[0].nome,
    cartao: "",
    pessoa: pessoas[0] || "",
    valor: 0,
    tipo: "despesa",
    contaId: contas.find((conta) => conta.ativa)?.id ?? "",
    contaDestinoId: "",
    cartaoId: "",
    totalParcelas: 1,
  };
}

function categoriasPorTipo(tipo: TipoTransacao) {
  if (tipo === "receita") return CATEGORIAS_RECEITA;
  if (tipo === "transferencia") return CATEGORIAS_TRANSFERENCIA;
  return CATEGORIAS_DESPESA;
}

export default function TransactionForm({
  cartoes,
  pessoas,
  contas,
  editing,
  onSubmit,
  onCancelEdit,
  onAddPessoa,
}: {
  cartoes: CartaoCredito[];
  pessoas: string[];
  contas: ContaFinanceira[];
  editing: Transacao | null;
  onSubmit: (dados: NovaTransacao) => Promise<unknown>;
  onCancelEdit: () => void;
  onAddPessoa: (nome: string) => Promise<unknown>;
}) {
  // Este componente recebe key={editing?.id ?? "novo"} do componente pai:
  // trocar de "adicionar" para "editar" (ou entre itens diferentes) remonta
  // o formulário, então o estado inicial abaixo já nasce correto sem precisar
  // sincronizar via useEffect.
  const [form, setForm] = useState<NovaTransacao>(() =>
    estadoInicial(editing, cartoes, pessoas, contas)
  );
  const [formError, setFormError] = useState("");
  const tipo = form.tipo ?? "despesa";
  const categorias = categoriasPorTipo(tipo);
  const contasAtivas = contas.filter((conta) => conta.ativa || conta.id === form.contaId);
  const cartoesAtivos = cartoes.filter((cartao) => cartao.ativo || cartao.id === form.cartaoId);
  const pagamentoSelecionado = form.cartaoId
    ? `cartao:${form.cartaoId}`
    : form.contaId
      ? `conta:${form.contaId}`
      : "";

  function handlePagamento(valor: string) {
    const [origem, id] = valor.split(":");
    if (origem === "cartao") {
      const cartao = cartoes.find((item) => item.id === id);
      setForm((atual) => ({
        ...atual,
        contaId: "",
        cartaoId: id,
        cartao: cartao?.nome ?? "",
      }));
    } else if (origem === "conta") {
      setForm((atual) => ({
        ...atual,
        contaId: id,
        cartaoId: "",
        cartao: "",
        totalParcelas: 1,
      }));
    } else {
      setForm((atual) => ({
        ...atual,
        contaId: "",
        cartaoId: "",
        cartao: "",
        totalParcelas: 1,
      }));
    }
  }

  function handleTipo(tipoSelecionado: TipoTransacao) {
    const categoriasDoTipo = categoriasPorTipo(tipoSelecionado);
    setForm((formAtual) => ({
      ...formAtual,
      tipo: tipoSelecionado,
      categoria: categoriasDoTipo[0].nome,
      contaDestinoId: tipoSelecionado === "transferencia" ? formAtual.contaDestinoId : "",
      cartaoId: tipoSelecionado === "despesa" ? formAtual.cartaoId : "",
      cartao: tipoSelecionado === "despesa" ? formAtual.cartao : "",
      totalParcelas: tipoSelecionado === "despesa" ? formAtual.totalParcelas : 1,
    }));
    setFormError("");
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (tipo === "transferencia") {
      if (!form.contaId || !form.contaDestinoId) {
        setFormError("Selecione as contas de origem e destino.");
        return;
      }
      if (form.contaId === form.contaDestinoId) {
        setFormError("A conta de destino precisa ser diferente da conta de origem.");
        return;
      }
    }
    setFormError("");
    await onSubmit(form);
    if (!editing) {
      setForm(estadoInicial(null, cartoes, pessoas, contas));
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
          <label>Tipo</label>
          <select
            value={tipo}
            onChange={(e) => handleTipo(e.target.value as TipoTransacao)}
          >
            <option value="despesa">Despesa</option>
            <option value="receita">Receita</option>
            <option value="transferencia">Transferência</option>
          </select>
        </div>
        <div>
          <label>Data</label>
          <input
            type="date"
            required
            value={form.data}
            onChange={(e) => setForm((f) => ({ ...f, data: e.target.value }))}
          />
        </div>
        {tipo === "despesa" ? (
          <div>
            <label>Forma de pagamento</label>
            <select value={pagamentoSelecionado} onChange={(e) => handlePagamento(e.target.value)}>
              <option value="">Sem vínculo</option>
              <optgroup label="Contas e dinheiro">
                {contasAtivas.map((conta) => (
                  <option key={conta.id} value={`conta:${conta.id}`}>{conta.nome}</option>
                ))}
              </optgroup>
              <optgroup label="Cartões de crédito">
                {cartoesAtivos.map((cartao) => (
                  <option key={cartao.id} value={`cartao:${cartao.id}`}>{cartao.nome}</option>
                ))}
              </optgroup>
            </select>
          </div>
        ) : tipo === "receita" ? (
          <div>
            <label>Conta de entrada</label>
            <select
              value={form.contaId ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, contaId: e.target.value }))}
            >
              <option value="">Sem vínculo</option>
              {contasAtivas.map((conta) => (
                <option key={conta.id} value={conta.id}>{conta.nome}</option>
              ))}
            </select>
          </div>
        ) : (
          <div>
          <label>Conta de origem</label>
          <select
            required
            value={form.contaId ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, contaId: e.target.value }))}
          >
            <option value="">Sem vínculo</option>
            {contasAtivas.map((conta) => (
              <option key={conta.id} value={conta.id}>{conta.nome}</option>
            ))}
          </select>
          </div>
        )}
        {tipo === "transferencia" ? (
          <div>
            <label>Conta de destino</label>
            <select
              required
              value={form.contaDestinoId ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, contaDestinoId: e.target.value }))}
            >
              <option value="">Selecione</option>
              {contas.filter((conta) => conta.ativa).map((conta) => (
                <option key={conta.id} value={conta.id}>{conta.nome}</option>
              ))}
            </select>
          </div>
        ) : null}
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
            {categorias.map((c) => (
              <option key={c.nome}>{c.nome}</option>
            ))}
          </select>
        </div>
        {tipo === "despesa" && form.cartaoId ? (
          <div>
            <label>{editing ? "Parcelamento" : "Número de parcelas"}</label>
            {editing ? (
              <input
                disabled
                value={`${form.parcelaAtual ?? 1}/${form.totalParcelas ?? 1}`}
              />
            ) : (
              <select
                value={form.totalParcelas ?? 1}
                onChange={(e) => setForm((f) => ({ ...f, totalParcelas: Number(e.target.value) }))}
              >
                {Array.from({ length: 24 }, (_, indice) => indice + 1).map((numero) => (
                  <option key={numero} value={numero}>{numero}x</option>
                ))}
              </select>
            )}
          </div>
        ) : null}
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
          <label>
            {!editing && (form.totalParcelas ?? 1) > 1 ? "Valor total (R$)" : "Valor (R$)"}
          </label>
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
          <button type="button" className="secondary" onClick={handleNovaPessoa}>
            + Nova pessoa
          </button>
        </div>
        {formError ? <div className="full form-error" role="alert">{formError}</div> : null}
      </form>
    </div>
  );
}
