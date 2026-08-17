"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import AccountsPanel from "@/src/components/AccountsPanel";
import BudgetPanel from "@/src/components/BudgetPanel";
import CardsPanel from "@/src/components/CardsPanel";
import ChartsPanel from "@/src/components/ChartsPanel";
import GoalsPanel from "@/src/components/GoalsPanel";
import InsightsPanel from "@/src/components/InsightsPanel";
import PinGate from "@/src/components/PinGate";
import RecurringPanel from "@/src/components/RecurringPanel";
import Sidebar from "@/src/components/Sidebar";
import StatsGrid from "@/src/components/StatsGrid";
import TransactionForm from "@/src/components/TransactionForm";
import TransactionsTable from "@/src/components/TransactionsTable";
import SetupGate from "@/src/components/SetupGate";
import { useAppData } from "@/src/hooks/useAppData";
import { firebaseConfigured } from "@/src/lib/firebase";
import { mesDe, mesLabel } from "@/src/lib/categories";
import {
  adicionarMesesAoMes,
  calcularSaldosContas,
  criarParcelasCartao,
  mesAtual,
  mesDaFatura,
  tipoDe,
} from "@/src/lib/finance";
import type { NovaTransacao, TipoTransacao, Transacao } from "@/src/lib/types";

const SECTIONS = ["visao-geral", "insights", "contas", "cartoes", "orcamentos", "recorrencias", "metas", "novo", "lancamentos", "resumo"];

export default function Home() {
  const data = useAppData();

  const [storageChecked, setStorageChecked] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [editing, setEditing] = useState<Transacao | null>(null);
  const [filterMonth, setFilterMonth] = useState(() => mesAtual());
  const [budgetMonth, setBudgetMonth] = useState(() => mesAtual());
  const [filterCartao, setFilterCartao] = useState("");
  const [filterPessoa, setFilterPessoa] = useState("");
  const [filterConta, setFilterConta] = useState("");
  const [filterTipo, setFilterTipo] = useState<TipoTransacao | "">("");
  const [activeSection, setActiveSection] = useState("visao-geral");

  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => {
    // Leitura única do localStorage (só existe no navegador) para saber se
    // esta aba já foi desbloqueada antes — padrão comum e intencional de
    // sincronizar estado do React com um sistema externo no primeiro render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUnlocked(localStorage.getItem("cf_desbloqueado") === "sim");
    setStorageChecked(true);
  }, []);

  useEffect(() => {
    if (!unlocked) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const id = entry.target.getAttribute("id");
            if (id) setActiveSection(id);
          }
        });
      },
      { rootMargin: "-20% 0px -70% 0px" }
    );
    SECTIONS.forEach((id) => {
      const el = sectionRefs.current[id];
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [unlocked]);

  const mesesDisponiveis = useMemo(() => {
    return [...new Set([
      mesAtual(),
      ...data.transacoes.map((t) => mesDe(t.data)),
      ...data.orcamentos.map((orcamento) => orcamento.mes),
    ])]
      .filter(Boolean)
      .sort()
      .reverse();
  }, [data.orcamentos, data.transacoes]);

  const cartoesDisponiveis = useMemo(
    () => [...new Set([
      ...data.cartoesCredito.map((cartao) => cartao.nome),
      ...data.cartoes,
      ...data.transacoes.map((transacao) => transacao.cartao).filter(Boolean),
    ])],
    [data.cartoes, data.cartoesCredito, data.transacoes]
  );

  const transacoesComparacao = useMemo(() => {
    return data.transacoes
      .filter((t) => !filterCartao || t.cartao === filterCartao)
      .filter((t) => !filterPessoa || t.pessoa === filterPessoa)
      .filter((t) =>
        !filterConta || t.contaId === filterConta || t.contaDestinoId === filterConta
      );
  }, [data.transacoes, filterCartao, filterConta, filterPessoa]);

  const transacoesDoPeriodo = useMemo(() => {
    return transacoesComparacao
      .filter((t) => !filterMonth || mesDe(t.data) === filterMonth)
      .sort((a, b) => (b.data || "").localeCompare(a.data || ""));
  }, [transacoesComparacao, filterMonth]);

  const transacoesFiltradas = useMemo(() => {
    return transacoesDoPeriodo
      .filter((t) => !filterTipo || tipoDe(t) === filterTipo)
      .sort((a, b) => (b.data || "").localeCompare(a.data || ""));
  }, [transacoesDoPeriodo, filterTipo]);

  const saldosContas = useMemo(() => {
    const agora = new Date();
    const hoje = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}-${String(agora.getDate()).padStart(2, "0")}`;
    return calcularSaldosContas(data.contas, data.transacoes, hoje);
  }, [data.contas, data.transacoes]);

  const saldoAtual = data.contas
    .filter((conta) => conta.ativa)
    .reduce((total, conta) => total + (saldosContas[conta.id] || 0), 0);

  if (!firebaseConfigured) {
    return <SetupGate />;
  }

  if (!storageChecked || !data.ready) {
    return (
      <div className="gate">
        <div className="gate-card" style={{ textAlign: "center" }}>
          <div className="brand-mark" style={{ margin: "0 auto 14px" }}>
            CF
          </div>
          <p style={{ margin: 0 }}>Conectando ao banco de dados da família…</p>
          {data.authError && (
            <p style={{ color: "var(--danger)", marginTop: 10 }}>{data.authError}</p>
          )}
        </div>
      </div>
    );
  }

  if (!unlocked) {
    return (
      <PinGate
        pinCorreto={data.pin}
        onSucesso={() => {
          localStorage.setItem("cf_desbloqueado", "sim");
          setUnlocked(true);
        }}
      />
    );
  }

  function handleNavigate(target: string) {
    sectionRefs.current[target]?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function handleLock() {
    localStorage.removeItem("cf_desbloqueado");
    setUnlocked(false);
  }

  async function handleChangePin() {
    const atual = prompt("Digite o PIN atual:");
    if (atual === null) return;
    if (atual !== data.pin) {
      alert("PIN atual incorreto.");
      return;
    }
    const novo = prompt("Digite o novo PIN:");
    if (novo && novo.trim()) {
      await data.updatePin(novo.trim());
      alert("PIN atualizado.");
    }
  }

  async function handleSubmit(dados: NovaTransacao) {
    try {
      if (editing) {
        const cartao = dados.cartaoId
          ? data.cartoesCredito.find((item) => item.id === dados.cartaoId)
          : undefined;
        const dadosAtualizados = cartao
          ? {
              ...dados,
              contaId: "",
              cartao: cartao.nome,
              faturaMes: adicionarMesesAoMes(
                mesDaFatura(cartao, dados.dataCompra || dados.data),
                (dados.parcelaAtual ?? 1) - 1
              ),
            }
          : {
              ...dados,
              cartao: "",
              cartaoId: "",
              dataCompra: "",
              faturaMes: "",
              parcelaAtual: 1,
              totalParcelas: 1,
              grupoParcelamentoId: "",
            };
        await data.updateTransacao(editing.id, dadosAtualizados);
        setEditing(null);
      } else {
        const cartao = dados.cartaoId
          ? data.cartoesCredito.find((item) => item.id === dados.cartaoId)
          : undefined;
        if (cartao) {
          const grupoId = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
          await data.addTransacoes(criarParcelasCartao(dados, cartao, grupoId));
        } else {
          await data.addTransacao({
            ...dados,
            cartao: "",
            cartaoId: "",
            totalParcelas: 1,
          });
        }
      }
    } catch (err) {
      alert("Erro ao salvar: " + (err instanceof Error ? err.message : String(err)));
    }
  }

  function handleEdit(t: Transacao) {
    setEditing(t);
    sectionRefs.current["novo"]?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function handleDelete(id: string) {
    if (!confirm("Excluir este lançamento?")) return;
    await data.deleteTransacao(id);
    if (editing?.id === id) setEditing(null);
  }

  async function handleClear() {
    if (!confirm("Isso vai apagar TODOS os lançamentos salvos, para todo mundo. Tem certeza?")) return;
    await data.clearAll();
    setEditing(null);
  }

  function handleExport() {
    const escaparCsv = (valor: string | number) =>
      `"${String(valor).replace(/"/g, '""')}"`;
    const linhas = ["Data,Tipo,Descrição,Categoria,Conta origem,Conta destino,Cartão ou forma,Pessoa,Valor"];
    transacoesFiltradas.forEach((t) => {
      const contaOrigem = data.contas.find((conta) => conta.id === t.contaId)?.nome ?? "";
      const contaDestino = data.contas.find((conta) => conta.id === t.contaDestinoId)?.nome ?? "";
      linhas.push(
        [
          t.data,
          t.faturaPagamentoId ? "pagamento_fatura" : tipoDe(t),
          t.desc || "",
          t.categoria || "",
          contaOrigem,
          contaDestino,
          t.cartao || "",
          t.pessoa || "",
          (t.valor || 0).toFixed(2),
        ].map(escaparCsv).join(",")
      );
    });
    const blob = new Blob([linhas.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "lancamentos.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const partesTag: string[] = [];
  partesTag.push(filterMonth ? mesLabel(filterMonth) : "Todos os períodos");
  if (filterCartao) partesTag.push(filterCartao);
  if (filterPessoa) partesTag.push(filterPessoa);
  if (filterConta) {
    partesTag.push(data.contas.find((conta) => conta.id === filterConta)?.nome ?? "Conta");
  }
  if (filterTipo) {
    partesTag.push(
      filterTipo === "receita"
        ? "Receitas"
        : filterTipo === "transferencia"
          ? "Transferências"
          : "Despesas"
    );
  }

  return (
    <div className="app">
      <Sidebar
        activeSection={activeSection}
        onNavigate={handleNavigate}
        synced={data.ready}
        onLock={handleLock}
        onChangePin={handleChangePin}
      />
      <main className="main">
        <div className="wrap">
          <header className="top">
            <div>
              <h1>Controle Financeiro</h1>
              <div className="sub">Saldos, movimentações e gastos compartilhados da família</div>
            </div>
            <span className="tag">{partesTag.join(" · ")}</span>
          </header>

          <section id="visao-geral" ref={(el) => { sectionRefs.current["visao-geral"] = el; }}>
            <StatsGrid
              transacoes={transacoesDoPeriodo}
              todasTransacoes={transacoesComparacao}
              periodo={filterMonth}
              saldoAtual={saldoAtual}
              quantidadeContas={data.contas.filter((conta) => conta.ativa).length}
            />
          </section>

          <section id="insights" ref={(el) => { sectionRefs.current["insights"] = el; }}>
            <InsightsPanel
              transacoes={data.transacoes}
              orcamentos={data.orcamentos}
              recorrencias={data.recorrencias}
              faturas={data.faturas}
              metas={data.metas}
              movimentosMetas={data.movimentosMetas}
              onNavigate={handleNavigate}
            />
          </section>

          <section id="contas" ref={(el) => { sectionRefs.current["contas"] = el; }}>
            <AccountsPanel
              contas={data.contas}
              saldos={saldosContas}
              transacoes={data.transacoes}
              onAdd={data.addConta}
              onUpdate={data.updateConta}
              onDelete={data.deleteConta}
            />
          </section>

          <section id="cartoes" ref={(el) => { sectionRefs.current["cartoes"] = el; }}>
            <CardsPanel
              cartoes={data.cartoesCredito}
              transacoes={data.transacoes}
              contas={data.contas}
              faturas={data.faturas}
              onAdd={data.addCartaoCredito}
              onUpdate={data.updateCartaoCredito}
              onDelete={data.deleteCartaoCredito}
              onCloseInvoice={data.fecharFatura}
              onPayInvoice={data.pagarFatura}
              onReopenInvoice={data.reabrirFatura}
            />
          </section>

          <section id="orcamentos" ref={(el) => { sectionRefs.current["orcamentos"] = el; }}>
            <BudgetPanel
              key={budgetMonth}
              orcamentos={data.orcamentos}
              transacoes={data.transacoes}
              mes={budgetMonth}
              onMonthChange={setBudgetMonth}
              onAdd={data.addOrcamento}
              onAddMany={data.addOrcamentos}
              onUpdate={data.updateOrcamento}
              onDelete={data.deleteOrcamento}
            />
          </section>

          <section id="recorrencias" ref={(el) => { sectionRefs.current["recorrencias"] = el; }}>
            <RecurringPanel
              recorrencias={data.recorrencias}
              transacoes={data.transacoes}
              contas={data.contas}
              cartoes={data.cartoesCredito}
              pessoas={data.pessoas}
              saldoAtual={saldoAtual}
              onAdd={data.addRecorrencia}
              onUpdate={data.updateRecorrencia}
              onDelete={data.deleteRecorrencia}
              onGenerate={data.gerarTransacoesRecorrentes}
            />
          </section>

          <section id="metas" ref={(el) => { sectionRefs.current["metas"] = el; }}>
            <GoalsPanel
              metas={data.metas}
              movimentos={data.movimentosMetas}
              transacoes={data.transacoes}
              contas={data.contas}
              saldosContas={saldosContas}
              onAdd={data.addMeta}
              onUpdate={data.updateMeta}
              onDelete={data.deleteMeta}
              onAddMovement={data.addMovimentoMeta}
              onDeleteMovement={data.deleteMovimentoMeta}
            />
          </section>

          <section id="novo" ref={(el) => { sectionRefs.current["novo"] = el; }}>
            <TransactionForm
              key={editing?.id ?? "novo"}
              cartoes={data.cartoesCredito}
              pessoas={data.pessoas}
              contas={data.contas}
              editing={editing}
              onSubmit={handleSubmit}
              onCancelEdit={() => setEditing(null)}
              onAddPessoa={data.addPessoa}
            />
          </section>

          <section id="lancamentos" ref={(el) => { sectionRefs.current["lancamentos"] = el; }}>
            <TransactionsTable
              key={`${filterMonth}-${filterCartao}-${filterPessoa}-${filterConta}-${filterTipo}`}
              transacoes={transacoesFiltradas}
              cartoes={cartoesDisponiveis}
              pessoas={data.pessoas}
              contas={data.contas}
              mesesDisponiveis={mesesDisponiveis}
              filterMonth={filterMonth}
              filterCartao={filterCartao}
              filterPessoa={filterPessoa}
              filterConta={filterConta}
              filterTipo={filterTipo}
              onFilterMonth={setFilterMonth}
              onFilterCartao={setFilterCartao}
              onFilterPessoa={setFilterPessoa}
              onFilterConta={setFilterConta}
              onFilterTipo={setFilterTipo}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onClear={handleClear}
              onExport={handleExport}
            />
          </section>

          <section id="resumo" ref={(el) => { sectionRefs.current["resumo"] = el; }}>
            <ChartsPanel
              transacoes={transacoesDoPeriodo}
              todasTransacoes={transacoesComparacao}
            />
          </section>
        </div>
      </main>
    </div>
  );
}
