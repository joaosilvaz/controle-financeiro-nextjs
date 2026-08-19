"use client";

import { useMemo, useState } from "react";
import { fmtMoeda, mesDe, mesLabel } from "@/src/lib/categories";
import { mesAnterior, mesAtual, tipoDe } from "@/src/lib/finance";
import type {
  CartaoCredito,
  ContaFinanceira,
  OrcamentoMensal,
  Transacao,
} from "@/src/lib/types";

function percentualVariacao(atual: number, anterior: number): number | null {
  return anterior > 0 ? ((atual - anterior) / anterior) * 100 : null;
}

function variacaoLabel(value: number | null): string {
  if (value === null) return "Sem base anterior";
  if (Math.abs(value) < 0.5) return "Estável vs. mês anterior";
  return `${value > 0 ? "+" : ""}${value.toFixed(1).replace(".", ",")}% vs. mês anterior`;
}

function escapeCsv(value: string | number): string {
  const text = String(value).replaceAll('"', '""');
  return `"${text}"`;
}

export default function MonthlyReportPanel({
  transacoes,
  contas,
  cartoes,
  orcamentos,
  mesesDisponiveis,
}: {
  transacoes: Transacao[];
  contas: ContaFinanceira[];
  cartoes: CartaoCredito[];
  orcamentos: OrcamentoMensal[];
  mesesDisponiveis: string[];
}) {
  const [month, setMonth] = useState(() => mesesDisponiveis[0] || mesAtual());

  const report = useMemo(() => {
    const previousMonth = mesAnterior(month);
    const currentTransactions = transacoes.filter((transaction) => mesDe(transaction.data) === month);
    const previousTransactions = transacoes.filter((transaction) => mesDe(transaction.data) === previousMonth);
    const totals = currentTransactions.reduce(
      (result, transaction) => {
        const type = tipoDe(transaction);
        result[type] += transaction.valor || 0;
        return result;
      },
      { receita: 0, despesa: 0, transferencia: 0 }
    );
    const previousTotals = previousTransactions.reduce(
      (result, transaction) => {
        const type = tipoDe(transaction);
        if (type === "receita" || type === "despesa") result[type] += transaction.valor || 0;
        return result;
      },
      { receita: 0, despesa: 0 }
    );
    const result = totals.receita - totals.despesa;
    const savingsRate = totals.receita > 0 ? (result / totals.receita) * 100 : 0;

    const categoriesMap = new Map<string, number>();
    const cardsMap = new Map<string, number>();
    const accountsMap = new Map(
      contas.map((account) => [account.id, { account, income: 0, expense: 0, transfers: 0 }])
    );

    currentTransactions.forEach((transaction) => {
      const type = tipoDe(transaction);
      if (type === "despesa") {
        categoriesMap.set(
          transaction.categoria || "Sem categoria",
          (categoriesMap.get(transaction.categoria || "Sem categoria") ?? 0) + (transaction.valor || 0)
        );
        if (transaction.cartao) {
          cardsMap.set(transaction.cartao, (cardsMap.get(transaction.cartao) ?? 0) + (transaction.valor || 0));
        }
      }
      if (transaction.contaId && accountsMap.has(transaction.contaId)) {
        const movement = accountsMap.get(transaction.contaId)!;
        if (type === "receita") movement.income += transaction.valor || 0;
        else if (type === "despesa" && !transaction.cartaoId) {
          movement.expense += transaction.valor || 0;
        }
        else movement.transfers -= transaction.valor || 0;
      }
      if (type === "transferencia" && transaction.contaDestinoId && accountsMap.has(transaction.contaDestinoId)) {
        accountsMap.get(transaction.contaDestinoId)!.transfers += transaction.valor || 0;
      }
    });

    const categories = [...categoriesMap.entries()]
      .map(([name, value]) => ({ name, value, share: totals.despesa > 0 ? (value / totals.despesa) * 100 : 0 }))
      .sort((a, b) => b.value - a.value);
    const cards = [...cardsMap.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
    const accounts = [...accountsMap.values()]
      .filter((movement) => movement.income || movement.expense || movement.transfers)
      .sort((a, b) => (b.income + b.expense) - (a.income + a.expense));
    const largestExpenses = currentTransactions
      .filter((transaction) => tipoDe(transaction) === "despesa")
      .sort((a, b) => (b.valor || 0) - (a.valor || 0))
      .slice(0, 5);

    const monthBudgets = orcamentos.filter((budget) => budget.mes === month);
    const budgetLimit = monthBudgets.reduce((sum, budget) => sum + budget.limite, 0);
    const budgetSpent = monthBudgets.reduce(
      (sum, budget) => sum + (categoriesMap.get(budget.categoria) ?? 0),
      0
    );
    const observations: Array<{ tone: "positive" | "warning" | "neutral"; text: string }> = [];
    if (result >= 0 && totals.receita > 0) observations.push({ tone: "positive", text: `O mês fechou positivo, com ${savingsRate.toFixed(1).replace(".", ",")}% da renda preservada.` });
    if (result < 0) observations.push({ tone: "warning", text: `As despesas ficaram ${fmtMoeda(Math.abs(result))} acima das receitas.` });
    const expenseVariation = percentualVariacao(totals.despesa, previousTotals.despesa);
    if (expenseVariation !== null && expenseVariation > 10) observations.push({ tone: "warning", text: `As despesas cresceram ${expenseVariation.toFixed(1).replace(".", ",")}% em relação ao mês anterior.` });
    if (expenseVariation !== null && expenseVariation < -5) observations.push({ tone: "positive", text: `As despesas diminuíram ${Math.abs(expenseVariation).toFixed(1).replace(".", ",")}% em relação ao mês anterior.` });
    if (categories[0] && categories[0].share >= 35) observations.push({ tone: "neutral", text: `${categories[0].name} concentrou ${categories[0].share.toFixed(0)}% das despesas do mês.` });
    if (!observations.length) observations.push({ tone: "neutral", text: "Ainda não há movimentação suficiente para destacar uma tendência neste mês." });

    return {
      currentTransactions,
      totals,
      previousTotals,
      result,
      savingsRate,
      incomeVariation: percentualVariacao(totals.receita, previousTotals.receita),
      expenseVariation,
      categories,
      cards,
      accounts,
      largestExpenses,
      budgetLimit,
      budgetSpent,
      observations,
    };
  }, [contas, month, orcamentos, transacoes]);

  function exportCsv() {
    const header = ["Data", "Descrição", "Tipo", "Categoria", "Conta", "Cartão", "Pessoa", "Lançado por", "Valor"];
    const accountNames = new Map(contas.map((account) => [account.id, account.nome]));
    const rows = report.currentTransactions.map((transaction) => [
      transaction.data,
      transaction.desc,
      tipoDe(transaction),
      transaction.categoria,
      transaction.contaId ? accountNames.get(transaction.contaId) ?? "" : "",
      transaction.cartao,
      transaction.pessoa,
      transaction.criadoPorNome ?? "",
      transaction.valor.toFixed(2).replace(".", ","),
    ]);
    const csv = [header, ...rows].map((row) => row.map(escapeCsv).join(";")).join("\n");
    const url = URL.createObjectURL(new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `relatorio-financeiro-${month}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const maxCategory = report.categories[0]?.value || 1;
  const availableMonths = [...new Set([month, ...mesesDisponiveis])].sort().reverse();

  return (
    <div className="monthly-report" id="monthly-report">
      <section className="panel report-controls no-print">
        <div>
          <span className="report-kicker">Relatório consolidado</span>
          <h2>Fechamento mensal</h2>
          <p>Compare resultados, entenda os gastos e compartilhe uma visão clara do mês.</p>
        </div>
        <div className="report-actions">
          <label>
            <span>Mês do relatório</span>
            <select value={month} onChange={(event) => setMonth(event.target.value)}>
              {availableMonths.map((item) => <option key={item} value={item}>{mesLabel(item)}</option>)}
            </select>
          </label>
          <button type="button" className="secondary" onClick={exportCsv}>Exportar CSV</button>
          <button type="button" onClick={() => window.print()}>Imprimir / salvar PDF</button>
        </div>
      </section>

      <div className="report-print-header">
        <div className="brand-mark">CF</div>
        <div><strong>Controle Financeiro</strong><span>Relatório mensal · {mesLabel(month)}</span></div>
      </div>

      <section className="report-hero panel">
        <div>
          <span>Resultado de {mesLabel(month)}</span>
          <strong className={report.result >= 0 ? "positive" : "negative"}>{fmtMoeda(report.result)}</strong>
          <small>{report.currentTransactions.length} lançamento{report.currentTransactions.length === 1 ? "" : "s"} no período</small>
        </div>
        <div className="report-hero-metrics">
          <article><span>Receitas</span><strong className="positive">{fmtMoeda(report.totals.receita)}</strong><small>{variacaoLabel(report.incomeVariation)}</small></article>
          <article><span>Despesas</span><strong className="negative">{fmtMoeda(report.totals.despesa)}</strong><small>{variacaoLabel(report.expenseVariation)}</small></article>
          <article><span>Taxa de economia</span><strong>{report.savingsRate.toFixed(1).replace(".", ",")}%</strong><small>Resultado ÷ receitas</small></article>
        </div>
      </section>

      <section className="report-grid-main">
        <article className="panel report-section report-categories">
          <div className="report-section-title"><div><h2>Despesas por categoria</h2><p>Onde o dinheiro ficou concentrado.</p></div><strong>{fmtMoeda(report.totals.despesa)}</strong></div>
          {report.categories.length ? (
            <div className="report-category-list">
              {report.categories.slice(0, 7).map((category) => (
                <div key={category.name}>
                  <div><strong>{category.name}</strong><span>{category.share.toFixed(0)}% · {fmtMoeda(category.value)}</span></div>
                  <div className="report-bar"><span style={{ width: `${(category.value / maxCategory) * 100}%` }} /></div>
                </div>
              ))}
            </div>
          ) : <div className="report-empty">Nenhuma despesa registrada neste mês.</div>}
        </article>

        <article className="panel report-section report-reading">
          <div className="report-section-title"><div><h2>Leitura do mês</h2><p>Destaques calculados automaticamente.</p></div></div>
          <div className="report-observations">
            {report.observations.map((observation, index) => (
              <div className={observation.tone} key={`${observation.tone}-${index}`}><span>{observation.tone === "positive" ? "✓" : observation.tone === "warning" ? "!" : "i"}</span><p>{observation.text}</p></div>
            ))}
          </div>
          {report.budgetLimit > 0 ? (
            <div className="report-budget">
              <div><span>Orçamento acompanhado</span><strong>{fmtMoeda(report.budgetSpent)} de {fmtMoeda(report.budgetLimit)}</strong></div>
              <div><span style={{ width: `${Math.min(100, (report.budgetSpent / report.budgetLimit) * 100)}%` }} /></div>
            </div>
          ) : null}
        </article>
      </section>

      <section className="report-grid-secondary">
        <article className="panel report-section">
          <div className="report-section-title"><div><h2>Movimentação por conta</h2><p>Entradas e saídas do período.</p></div></div>
          <div className="report-account-list">
            {report.accounts.length ? report.accounts.map(({ account, income, expense, transfers }) => (
              <div key={account.id}>
                <span className="report-account-color" style={{ background: account.cor }} />
                <strong>{account.nome}</strong>
                <span className="positive">+ {fmtMoeda(income)}</span>
                <span className="negative">− {fmtMoeda(expense)}</span>
                <small>Transferências: {fmtMoeda(transfers)}</small>
              </div>
            )) : <div className="report-empty">Sem contas movimentadas no período.</div>}
          </div>
        </article>

        <article className="panel report-section">
          <div className="report-section-title"><div><h2>Cartões utilizados</h2><p>Compras registradas no mês.</p></div></div>
          <div className="report-card-list">
            {report.cards.length ? report.cards.map((card) => {
              const color = cartoes.find((item) => item.nome === card.name)?.cor ?? "#667085";
              return <div key={card.name}><span style={{ background: color }} /><strong>{card.name}</strong><b>{fmtMoeda(card.value)}</b></div>;
            }) : <div className="report-empty">Nenhuma compra em cartão neste mês.</div>}
          </div>
        </article>
      </section>

      <section className="panel report-section report-largest">
        <div className="report-section-title"><div><h2>Maiores despesas</h2><p>Os lançamentos com maior impacto no mês.</p></div></div>
        {report.largestExpenses.length ? (
          <div className="report-largest-list">
            {report.largestExpenses.map((transaction, index) => (
              <div key={transaction.id}><span>{index + 1}</span><div><strong>{transaction.desc}</strong><small>{transaction.categoria} · {transaction.data.split("-").reverse().join("/")}</small></div><b>{fmtMoeda(transaction.valor)}</b></div>
            ))}
          </div>
        ) : <div className="report-empty">Nenhuma despesa registrada neste mês.</div>}
      </section>
    </div>
  );
}
