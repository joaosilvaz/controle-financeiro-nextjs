"use client";

import { useState, type FormEvent } from "react";
import { fmtMoeda } from "@/src/lib/categories";
import type { ContaFinanceira, NovaConta, TipoConta, Transacao } from "@/src/lib/types";

const CONTA_INICIAL: NovaConta = {
  nome: "",
  tipo: "corrente",
  saldoInicial: 0,
  cor: "#3568b8",
  ativa: true,
};

const NOMES_TIPO: Record<TipoConta, string> = {
  corrente: "Conta corrente",
  poupanca: "Poupança",
  dinheiro: "Dinheiro",
  investimento: "Investimentos",
};

export default function AccountsPanel({
  contas,
  saldos,
  transacoes,
  onAdd,
  onUpdate,
  onDelete,
}: {
  contas: ContaFinanceira[];
  saldos: Record<string, number>;
  transacoes: Transacao[];
  onAdd: (dados: NovaConta) => Promise<unknown>;
  onUpdate: (id: string, dados: NovaConta) => Promise<unknown>;
  onDelete: (id: string) => Promise<unknown>;
}) {
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<NovaConta>(CONTA_INICIAL);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const naoVinculadas = transacoes.filter(
    (transacao) => !transacao.contaId && transacao.tipo !== "transferencia"
  ).length;

  function abrirNova() {
    setEditingId(null);
    setForm(CONTA_INICIAL);
    setError("");
    setFormOpen(true);
  }

  function abrirEdicao(conta: ContaFinanceira) {
    setEditingId(conta.id);
    setForm({
      nome: conta.nome,
      tipo: conta.tipo,
      saldoInicial: conta.saldoInicial,
      cor: conta.cor,
      ativa: conta.ativa,
    });
    setError("");
    setFormOpen(true);
  }

  function fecharForm() {
    setEditingId(null);
    setFormOpen(false);
    setError("");
  }

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      if (editingId) await onUpdate(editingId, form);
      else await onAdd(form);
      fecharForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar a conta.");
    } finally {
      setSaving(false);
    }
  }

  async function excluir(conta: ContaFinanceira) {
    const emUso = transacoes.some(
      (transacao) =>
        transacao.contaId === conta.id || transacao.contaDestinoId === conta.id
    );
    if (emUso) return;
    if (!confirm(`Excluir a conta “${conta.nome}”?`)) return;
    setError("");
    try {
      await onDelete(conta.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível excluir a conta.");
      setFormOpen(true);
    }
  }

  return (
    <div className="panel accounts-panel">
      <div className="panel-title-row">
        <div>
          <h2>Contas e saldos</h2>
          <p>O saldo atual considera o saldo inicial e os lançamentos vinculados.</p>
        </div>
        <button type="button" onClick={abrirNova}>+ Nova conta</button>
      </div>

      {naoVinculadas > 0 ? (
        <div className="account-warning">
          {naoVinculadas} lançamento{naoVinculadas === 1 ? "" : "s"} ainda sem conta vinculada.
          Edite-os para refletir no saldo.
        </div>
      ) : null}

      <div className="account-grid">
        {contas.map((conta) => {
          const emUso = transacoes.some(
            (transacao) =>
              transacao.contaId === conta.id || transacao.contaDestinoId === conta.id
          );
          return (
            <article className={`account-card${conta.ativa ? "" : " inactive"}`} key={conta.id}>
              <div className="account-card-top">
                <span className="account-color" style={{ background: conta.cor }} />
                <span className="account-type">{NOMES_TIPO[conta.tipo]}</span>
              </div>
              <h3>{conta.nome}</h3>
              <div className={`account-balance ${(saldos[conta.id] || 0) < 0 ? "negative" : ""}`}>
                {fmtMoeda(saldos[conta.id] || 0)}
              </div>
              <div className="account-initial">Inicial: {fmtMoeda(conta.saldoInicial)}</div>
              <div className="account-actions">
                <button type="button" className="link" onClick={() => abrirEdicao(conta)}>
                  Editar
                </button>
                <button
                  type="button"
                  className="link danger"
                  disabled={emUso}
                  title={emUso ? "Remova ou altere os lançamentos vinculados primeiro" : "Excluir conta"}
                  onClick={() => excluir(conta)}
                >
                  Excluir
                </button>
              </div>
            </article>
          );
        })}
      </div>

      {formOpen ? (
        <form className="account-form" onSubmit={salvar}>
          <div>
            <label htmlFor="account-name">Nome</label>
            <input
              id="account-name"
              required
              value={form.nome}
              onChange={(e) => setForm((atual) => ({ ...atual, nome: e.target.value }))}
              placeholder="Ex: Nubank, Itaú, Carteira"
            />
          </div>
          <div>
            <label htmlFor="account-type">Tipo</label>
            <select
              id="account-type"
              value={form.tipo}
              onChange={(e) => setForm((atual) => ({ ...atual, tipo: e.target.value as TipoConta }))}
            >
              {Object.entries(NOMES_TIPO).map(([valor, nome]) => (
                <option key={valor} value={valor}>{nome}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="account-initial">Saldo inicial</label>
            <input
              id="account-initial"
              type="number"
              step="0.01"
              value={form.saldoInicial || ""}
              onChange={(e) => setForm((atual) => ({
                ...atual,
                saldoInicial: Number(e.target.value) || 0,
              }))}
            />
          </div>
          <div>
            <label htmlFor="account-color">Cor</label>
            <input
              id="account-color"
              className="color-input"
              type="color"
              value={form.cor}
              onChange={(e) => setForm((atual) => ({ ...atual, cor: e.target.value }))}
            />
          </div>
          <label className="account-active">
            <input
              type="checkbox"
              checked={form.ativa}
              onChange={(e) => setForm((atual) => ({ ...atual, ativa: e.target.checked }))}
            />
            Incluir no saldo consolidado
          </label>
          <div className="account-form-actions">
            <button disabled={saving} type="submit">
              {saving ? "Salvando…" : editingId ? "Salvar alterações" : "Criar conta"}
            </button>
            <button type="button" className="secondary" onClick={fecharForm}>Cancelar</button>
          </div>
          {error ? <div className="form-error" role="alert">{error}</div> : null}
        </form>
      ) : null}
    </div>
  );
}
