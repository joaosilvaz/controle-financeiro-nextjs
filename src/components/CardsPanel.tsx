"use client";

import { useMemo, useState, type CSSProperties, type FormEvent } from "react";
import { fmtMoeda, mesDe, mesLabel } from "@/src/lib/categories";
import { adicionarMesesAoMes, mesAtual, tipoDe } from "@/src/lib/finance";
import type {
  CartaoCredito,
  NovoCartaoCredito,
  Transacao,
} from "@/src/lib/types";

const CARTAO_INICIAL: NovoCartaoCredito = {
  nome: "",
  bandeira: "Visa",
  limite: 0,
  diaFechamento: 25,
  diaVencimento: 5,
  cor: "#5b4fc4",
  ativo: true,
};

const BANDEIRAS = ["Visa", "Mastercard", "Elo", "American Express", "Hipercard", "Outra"];

export default function CardsPanel({
  cartoes,
  transacoes,
  onAdd,
  onUpdate,
  onDelete,
}: {
  cartoes: CartaoCredito[];
  transacoes: Transacao[];
  onAdd: (dados: NovoCartaoCredito) => Promise<unknown>;
  onUpdate: (id: string, dados: NovoCartaoCredito) => Promise<unknown>;
  onDelete: (id: string) => Promise<unknown>;
}) {
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<NovoCartaoCredito>(CARTAO_INICIAL);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const mesReferencia = mesAtual();
  const proximosMeses = useMemo(
    () => Array.from({ length: 6 }, (_, indice) => adicionarMesesAoMes(mesReferencia, indice)),
    [mesReferencia]
  );

  const { totais, comprometidoPorCartao } = useMemo(() => {
    const porCartaoMes = new Map<string, number>();
    const futuroPorCartao = new Map<string, number>();
    transacoes.forEach((transacao) => {
      if (tipoDe(transacao) !== "despesa") return;
      const cartao = transacao.cartaoId
        ? cartoes.find((item) => item.id === transacao.cartaoId)
        : cartoes.find((item) => item.nome === transacao.cartao);
      if (!cartao) return;
      const mes = transacao.faturaMes ?? mesDe(transacao.data);
      const chave = `${cartao.id}:${mes}`;
      porCartaoMes.set(chave, (porCartaoMes.get(chave) || 0) + (transacao.valor || 0));
      if (mes >= mesReferencia) {
        futuroPorCartao.set(
          cartao.id,
          (futuroPorCartao.get(cartao.id) || 0) + (transacao.valor || 0)
        );
      }
    });
    return { totais: porCartaoMes, comprometidoPorCartao: futuroPorCartao };
  }, [cartoes, mesReferencia, transacoes]);

  function totalFatura(cartaoId: string, mes: string) {
    return totais.get(`${cartaoId}:${mes}`) || 0;
  }

  function abrirNova() {
    setEditingId(null);
    setForm(CARTAO_INICIAL);
    setError("");
    setFormOpen(true);
  }

  function abrirEdicao(cartao: CartaoCredito) {
    setEditingId(cartao.id);
    setForm({
      nome: cartao.nome,
      bandeira: cartao.bandeira,
      limite: cartao.limite,
      diaFechamento: cartao.diaFechamento,
      diaVencimento: cartao.diaVencimento,
      cor: cartao.cor,
      ativo: cartao.ativo,
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
      setError(err instanceof Error ? err.message : "Não foi possível salvar o cartão.");
    } finally {
      setSaving(false);
    }
  }

  async function excluir(cartao: CartaoCredito) {
    const emUso = transacoes.some(
      (transacao) => transacao.cartaoId === cartao.id || transacao.cartao === cartao.nome
    );
    if (emUso || !confirm(`Excluir o cartão “${cartao.nome}”?`)) return;
    try {
      await onDelete(cartao.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível excluir o cartão.");
      setFormOpen(true);
    }
  }

  return (
    <div className="panel cards-panel">
      <div className="panel-title-row">
        <div>
          <h2>Cartões e faturas</h2>
          <p>Acompanhe limites, fechamento e parcelas já comprometidas.</p>
        </div>
        <button type="button" onClick={abrirNova}>+ Novo cartão</button>
      </div>

      <div className="credit-card-grid">
        {cartoes.map((cartao) => {
          const faturaAtual = totalFatura(cartao.id, mesReferencia);
          const comprometido = comprometidoPorCartao.get(cartao.id) || 0;
          const disponivel = Math.max(0, cartao.limite - comprometido);
          const percentual = cartao.limite > 0
            ? Math.min(100, (comprometido / cartao.limite) * 100)
            : 0;
          const emUso = transacoes.some(
            (transacao) => transacao.cartaoId === cartao.id || transacao.cartao === cartao.nome
          );

          return (
            <article
              className={`credit-card${cartao.ativo ? "" : " inactive"}`}
              key={cartao.id}
              style={{ "--card-color": cartao.cor } as CSSProperties}
            >
              <div className="credit-card-head">
                <div>
                  <span>{cartao.bandeira}</span>
                  <h3>{cartao.nome}</h3>
                </div>
                <div className="card-chip" aria-hidden="true" />
              </div>
              <div className="card-invoice-label">Fatura de {mesLabel(mesReferencia)}</div>
              <div className="card-invoice-value">{fmtMoeda(faturaAtual)}</div>
              <div className="card-limit-row">
                <span>Disponível {fmtMoeda(disponivel)}</span>
                <span>Limite {fmtMoeda(cartao.limite)}</span>
              </div>
              <div className="card-limit-track">
                <span style={{ width: `${percentual}%` }} />
              </div>
              <div className="card-dates">
                Fecha dia {cartao.diaFechamento} · vence dia {cartao.diaVencimento}
              </div>
              <div className="account-actions card-actions">
                <button type="button" className="link" onClick={() => abrirEdicao(cartao)}>Editar</button>
                <button
                  type="button"
                  className="link danger"
                  disabled={emUso}
                  title={emUso ? "Há lançamentos vinculados a este cartão" : "Excluir cartão"}
                  onClick={() => excluir(cartao)}
                >
                  Excluir
                </button>
              </div>
            </article>
          );
        })}
      </div>

      <div className="invoice-forecast">
        <h3>Próximas faturas</h3>
        <div className="invoice-months">
          {proximosMeses.map((mes) => {
            const total = cartoes.reduce(
              (soma, cartao) => soma + totalFatura(cartao.id, mes),
              0
            );
            return (
              <div className="invoice-month" key={mes}>
                <span>{mesLabel(mes)}</span>
                <strong>{fmtMoeda(total)}</strong>
              </div>
            );
          })}
        </div>
      </div>

      {formOpen ? (
        <form className="card-form" onSubmit={salvar}>
          <div>
            <label htmlFor="card-name">Nome</label>
            <input
              id="card-name"
              required
              value={form.nome}
              onChange={(e) => setForm((atual) => ({ ...atual, nome: e.target.value }))}
              placeholder="Ex: Nubank Ultravioleta"
            />
          </div>
          <div>
            <label htmlFor="card-brand">Bandeira</label>
            <select
              id="card-brand"
              value={form.bandeira}
              onChange={(e) => setForm((atual) => ({ ...atual, bandeira: e.target.value }))}
            >
              {BANDEIRAS.map((bandeira) => <option key={bandeira}>{bandeira}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="card-limit">Limite</label>
            <input
              id="card-limit"
              type="number"
              min="0"
              step="0.01"
              required
              value={form.limite || ""}
              onChange={(e) => setForm((atual) => ({ ...atual, limite: Number(e.target.value) || 0 }))}
            />
          </div>
          <div>
            <label htmlFor="card-close">Fechamento</label>
            <input
              id="card-close"
              type="number"
              min="1"
              max="31"
              required
              value={form.diaFechamento}
              onChange={(e) => setForm((atual) => ({ ...atual, diaFechamento: Number(e.target.value) }))}
            />
          </div>
          <div>
            <label htmlFor="card-due">Vencimento</label>
            <input
              id="card-due"
              type="number"
              min="1"
              max="31"
              required
              value={form.diaVencimento}
              onChange={(e) => setForm((atual) => ({ ...atual, diaVencimento: Number(e.target.value) }))}
            />
          </div>
          <div>
            <label htmlFor="card-color">Cor</label>
            <input
              id="card-color"
              className="color-input"
              type="color"
              value={form.cor}
              onChange={(e) => setForm((atual) => ({ ...atual, cor: e.target.value }))}
            />
          </div>
          <label className="account-active">
            <input
              type="checkbox"
              checked={form.ativo}
              onChange={(e) => setForm((atual) => ({ ...atual, ativo: e.target.checked }))}
            />
            Cartão ativo
          </label>
          <div className="account-form-actions">
            <button disabled={saving} type="submit">
              {saving ? "Salvando…" : editingId ? "Salvar alterações" : "Criar cartão"}
            </button>
            <button type="button" className="secondary" onClick={fecharForm}>Cancelar</button>
          </div>
          {error ? <div className="form-error" role="alert">{error}</div> : null}
        </form>
      ) : null}
    </div>
  );
}
