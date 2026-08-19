"use client";

import { useMemo, useState, type CSSProperties, type FormEvent } from "react";
import { fmtMoeda, mesDe, mesLabel } from "@/src/lib/categories";
import { adicionarMesesAoMes, dataDaCompetencia, mesAtual, tipoDe } from "@/src/lib/finance";
import type {
  CartaoCredito,
  ContaFinanceira,
  FaturaCartao,
  NovoCartaoCredito,
  NovaFaturaCartao,
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

function hojeLocal(): string {
  const agora = new Date();
  return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}-${String(agora.getDate()).padStart(2, "0")}`;
}

export default function CardsPanel({
  cartoes,
  transacoes,
  contas,
  faturas,
  onAdd,
  onUpdate,
  onDelete,
  onCloseInvoice,
  onPayInvoice,
  onReopenInvoice,
}: {
  cartoes: CartaoCredito[];
  transacoes: Transacao[];
  contas: ContaFinanceira[];
  faturas: FaturaCartao[];
  onAdd: (dados: NovoCartaoCredito) => Promise<unknown>;
  onUpdate: (id: string, dados: NovoCartaoCredito) => Promise<unknown>;
  onDelete: (id: string) => Promise<unknown>;
  onCloseInvoice: (dados: NovaFaturaCartao) => Promise<unknown>;
  onPayInvoice: (
    fatura: FaturaCartao,
    pagamento: { contaId: string; data: string; valor: number; cartaoNome: string }
  ) => Promise<unknown>;
  onReopenInvoice: (fatura: FaturaCartao) => Promise<unknown>;
}) {
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<NovoCartaoCredito>(CARTAO_INICIAL);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [paymentInvoice, setPaymentInvoice] = useState<FaturaCartao | null>(null);
  const [paymentAccount, setPaymentAccount] = useState("");
  const [paymentDate, setPaymentDate] = useState(() => hojeLocal());
  const [paymentValue, setPaymentValue] = useState("");
  const mesReferencia = mesAtual();
  const hoje = hojeLocal();
  const proximosMeses = useMemo(
    () => Array.from({ length: 6 }, (_, indice) => adicionarMesesAoMes(mesReferencia, indice)),
    [mesReferencia]
  );
  const mesesCiclo = useMemo(
    () => Array.from({ length: 8 }, (_, indice) => adicionarMesesAoMes(mesReferencia, indice - 2)),
    [mesReferencia]
  );
  const cartoesMap = useMemo(
    () => new Map(cartoes.map((cartao) => [cartao.id, cartao])),
    [cartoes]
  );
  const cartoesPorNome = useMemo(
    () => new Map(cartoes.map((cartao) => [cartao.nome, cartao])),
    [cartoes]
  );
  const faturasMap = useMemo(
    () => new Map(faturas.map((fatura) => [`${fatura.cartaoId}:${fatura.mes}`, fatura])),
    [faturas]
  );

  const { totais, comprometidoPorCartao } = useMemo(() => {
    const porCartaoMes = new Map<string, number>();
    const futuroPorCartao = new Map<string, number>();
    transacoes.forEach((transacao) => {
      if (tipoDe(transacao) !== "despesa") return;
      const cartao = transacao.cartaoId
        ? cartoesMap.get(transacao.cartaoId)
        : cartoesPorNome.get(transacao.cartao);
      if (!cartao) return;
      const mes = transacao.faturaMes ?? mesDe(transacao.data);
      const chave = `${cartao.id}:${mes}`;
      porCartaoMes.set(chave, (porCartaoMes.get(chave) || 0) + (transacao.valor || 0));
      if (mes >= mesReferencia && faturasMap.get(chave)?.status !== "paga") {
        futuroPorCartao.set(
          cartao.id,
          (futuroPorCartao.get(cartao.id) || 0) + (transacao.valor || 0)
        );
      }
    });
    return { totais: porCartaoMes, comprometidoPorCartao: futuroPorCartao };
  }, [cartoesMap, cartoesPorNome, faturasMap, mesReferencia, transacoes]);

  const faturasVisiveis = useMemo(() => {
    return cartoes.flatMap((cartao) =>
      mesesCiclo.flatMap((mes) => {
        const fatura = faturasMap.get(`${cartao.id}:${mes}`);
        const valorAtual = totais.get(`${cartao.id}:${mes}`) || 0;
        if (!fatura && valorAtual <= 0) return [];
        const dataVencimento = fatura?.dataVencimento ?? dataDaCompetencia(mes, cartao.diaVencimento);
        const status = fatura?.status === "paga"
          ? "paga"
          : dataVencimento < hoje
            ? "atrasada"
            : fatura
              ? "fechada"
              : "aberta";
        return [{ cartao, mes, fatura, valorAtual, dataVencimento, status }];
      })
    ).sort((a, b) => a.dataVencimento.localeCompare(b.dataVencimento));
  }, [cartoes, faturasMap, hoje, mesesCiclo, totais]);

  function totalFatura(cartaoId: string, mes: string) {
    return totais.get(`${cartaoId}:${mes}`) || 0;
  }

  async function fecharFatura(cartao: CartaoCredito, mes: string, valor: number) {
    if (valor <= 0) return;
    try {
      setSaving(true);
      setError("");
      await onCloseInvoice({
        cartaoId: cartao.id,
        mes,
        status: "fechada",
        valorFechado: valor,
        dataVencimento: dataDaCompetencia(mes, cartao.diaVencimento),
        fechadaEm: hoje,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível fechar a fatura.");
    } finally {
      setSaving(false);
    }
  }

  function abrirPagamento(fatura: FaturaCartao) {
    const contaVinculada = transacoes.find((transacao) =>
      transacao.cartaoId === fatura.cartaoId &&
      transacao.faturaMes === fatura.mes &&
      Boolean(transacao.contaId)
    )?.contaId;
    setPaymentInvoice(fatura);
    setPaymentAccount(
      contas.find((conta) => conta.id === contaVinculada && conta.ativa)?.id ??
      contas.find((conta) => conta.ativa)?.id ??
      ""
    );
    setPaymentDate(hoje);
    setPaymentValue(String(fatura.valorFechado));
    setError("");
  }

  function fecharPagamento() {
    setPaymentInvoice(null);
    setPaymentAccount("");
    setPaymentValue("");
  }

  async function pagarFatura(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!paymentInvoice) return;
    const valor = Number(paymentValue.replace(",", "."));
    const cartao = cartoesMap.get(paymentInvoice.cartaoId);
    if (!paymentAccount || !paymentDate || !Number.isFinite(valor) || valor <= 0 || !cartao) {
      setError("Selecione a conta, a data e informe um valor válido.");
      return;
    }
    try {
      setSaving(true);
      setError("");
      await onPayInvoice(paymentInvoice, {
        contaId: paymentAccount,
        data: paymentDate,
        valor,
        cartaoNome: cartao.nome,
      });
      fecharPagamento();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível pagar a fatura.");
    } finally {
      setSaving(false);
    }
  }

  async function reabrirFatura(fatura: FaturaCartao) {
    const acao = fatura.status === "paga" ? "estornar o pagamento e reabrir" : "reabrir";
    if (!confirm(`Deseja ${acao} esta fatura?`)) return;
    try {
      setSaving(true);
      setError("");
      await onReopenInvoice(fatura);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível reabrir a fatura.");
    } finally {
      setSaving(false);
    }
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
          const faturaRegistrada = faturasMap.get(`${cartao.id}:${mesReferencia}`);
          const vencimentoAtual = faturaRegistrada?.dataVencimento ?? dataDaCompetencia(mesReferencia, cartao.diaVencimento);
          const statusAtual = faturaRegistrada?.status === "paga"
            ? "Paga"
            : vencimentoAtual < hoje
              ? "Atrasada"
              : faturaRegistrada
                ? "Fechada"
                : "Aberta";
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
              <span className={`card-invoice-status ${statusAtual.toLowerCase()}`}>{statusAtual}</span>
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

      <div className="invoice-control">
        <div className="invoice-control-title">
          <div>
            <h3>Controle de faturas</h3>
            <p>Feche a competência e registre o pagamento pela conta utilizada.</p>
          </div>
        </div>
        {faturasVisiveis.length ? (
          <div className="invoice-control-list">
            {faturasVisiveis.map(({ cartao, mes, fatura, valorAtual, dataVencimento, status }) => {
              // O valor exibido sempre vem dos lançamentos atuais. O fechamento é
              // apenas o registro do estado da fatura, não uma segunda fonte de total.
              const valorExibido = valorAtual;
              const diferencaPagamento = fatura?.status === "paga"
                ? (fatura.valorPago ?? fatura.valorFechado) - valorAtual
                : 0;
              return (
                <article className={`invoice-control-row ${status}`} key={`${cartao.id}:${mes}`}>
                  <span className="invoice-card-dot" style={{ backgroundColor: cartao.cor }} />
                  <div className="invoice-control-main">
                    <strong>{cartao.nome} · {mesLabel(mes)}</strong>
                    <span>Vence em {dataVencimento.split("-").reverse().join("/")}</span>
                  </div>
                  <div className="invoice-control-value">
                    <strong>{fmtMoeda(valorExibido)}</strong>
                    {fatura?.status === "paga" ? (
                      <span>Pago {fmtMoeda(fatura.valorPago ?? fatura.valorFechado)}</span>
                    ) : valorAtual !== valorExibido ? (
                      <span>Compras atuais {fmtMoeda(valorAtual)}</span>
                    ) : null}
                    {diferencaPagamento !== 0 ? (
                      <span>Ajuste {diferencaPagamento > 0 ? "+" : "−"}{fmtMoeda(Math.abs(diferencaPagamento))}</span>
                    ) : null}
                  </div>
                  <span className={`invoice-status ${status}`}>
                    {status === "paga" ? "Paga" : status === "fechada" ? "Fechada" : status === "atrasada" ? "Atrasada" : "Aberta"}
                  </span>
                  <div className="invoice-control-actions">
                    {!fatura ? (
                      <button type="button" className="secondary" disabled={saving} onClick={() => fecharFatura(cartao, mes, valorAtual)}>Fechar fatura</button>
                    ) : fatura.status === "fechada" ? (
                      <>
                        <button
                          type="button"
                          disabled={saving || valorAtual <= 0}
                          onClick={() => abrirPagamento({ ...fatura, valorFechado: valorAtual })}
                        >
                          Registrar pagamento
                        </button>
                        <button type="button" className="link" disabled={saving} onClick={() => reabrirFatura(fatura)}>Reabrir</button>
                      </>
                    ) : (
                      <button type="button" className="link" disabled={saving} onClick={() => reabrirFatura(fatura)}>Estornar e reabrir</button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        ) : <div className="invoice-empty">Nenhuma fatura encontrada neste período.</div>}
      </div>

      {paymentInvoice ? (
        <form className="invoice-payment-form" onSubmit={pagarFatura}>
          <div className="invoice-payment-heading">
            <strong>Registrar pagamento de {mesLabel(paymentInvoice.mes)}</strong>
            <span>O valor será descontado da conta sem duplicar a despesa.</span>
          </div>
          <div>
            <label htmlFor="invoice-account">Conta utilizada</label>
            <select id="invoice-account" required value={paymentAccount} onChange={(event) => setPaymentAccount(event.target.value)}>
              <option value="">Selecione</option>
              {contas.filter((conta) => conta.ativa || conta.id === paymentAccount).map((conta) => (
                <option key={conta.id} value={conta.id}>{conta.nome}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="invoice-payment-date">Data do pagamento</label>
            <input id="invoice-payment-date" type="date" required value={paymentDate} onChange={(event) => setPaymentDate(event.target.value)} />
          </div>
          <div>
            <label htmlFor="invoice-payment-value">Valor pago</label>
            <input id="invoice-payment-value" type="number" min="0.01" step="0.01" required value={paymentValue} onChange={(event) => setPaymentValue(event.target.value)} />
          </div>
          <div className="invoice-payment-actions">
            <button type="button" className="secondary" onClick={fecharPagamento}>Cancelar</button>
            <button type="submit" disabled={saving}>{saving ? "Registrando…" : "Confirmar pagamento"}</button>
          </div>
        </form>
      ) : null}

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
