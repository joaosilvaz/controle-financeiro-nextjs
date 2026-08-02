"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ChartsPanel from "@/src/components/ChartsPanel";
import PinGate from "@/src/components/PinGate";
import Sidebar from "@/src/components/Sidebar";
import StatsGrid from "@/src/components/StatsGrid";
import TransactionForm from "@/src/components/TransactionForm";
import TransactionsTable from "@/src/components/TransactionsTable";
import SetupGate from "@/src/components/SetupGate";
import { useAppData } from "@/src/hooks/useAppData";
import { firebaseConfigured } from "@/src/lib/firebase";
import { mesDe, mesLabel } from "@/src/lib/categories";
import type { NovaTransacao, Transacao } from "@/src/lib/types";

const SECTIONS = ["visao-geral", "novo", "lancamentos", "resumo"];

export default function Home() {
  const data = useAppData();

  const [storageChecked, setStorageChecked] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [editing, setEditing] = useState<Transacao | null>(null);
  const [filterMonth, setFilterMonth] = useState("");
  const [filterCartao, setFilterCartao] = useState("");
  const [filterPessoa, setFilterPessoa] = useState("");
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
    return [...new Set(data.transacoes.map((t) => mesDe(t.data)))].sort().reverse();
  }, [data.transacoes]);

  const transacoesFiltradas = useMemo(() => {
    return data.transacoes
      .filter((t) => !filterMonth || mesDe(t.data) === filterMonth)
      .filter((t) => !filterCartao || t.cartao === filterCartao)
      .filter((t) => !filterPessoa || t.pessoa === filterPessoa)
      .sort((a, b) => (b.data || "").localeCompare(a.data || ""));
  }, [data.transacoes, filterMonth, filterCartao, filterPessoa]);

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
        await data.updateTransacao(editing.id, dados);
        setEditing(null);
      } else {
        await data.addTransacao(dados);
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
    const linhas = ["Data,Descrição,Categoria,Cartão,Pessoa,Valor"];
    transacoesFiltradas.forEach((t) => {
      linhas.push(
        `${t.data},"${(t.desc || "").replace(/"/g, '""')}",${t.categoria},${t.cartao},${t.pessoa},${(t.valor || 0).toFixed(2)}`
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
              <div className="sub">Lançamentos, faturas de cartão e gastos por pessoa</div>
            </div>
            <span className="tag">{partesTag.join(" · ")}</span>
          </header>

          <section id="visao-geral" ref={(el) => { sectionRefs.current["visao-geral"] = el; }}>
            <StatsGrid transacoes={transacoesFiltradas} />
          </section>

          <section id="novo" ref={(el) => { sectionRefs.current["novo"] = el; }}>
            <TransactionForm
              key={editing?.id ?? "novo"}
              cartoes={data.cartoes}
              pessoas={data.pessoas}
              editing={editing}
              onSubmit={handleSubmit}
              onCancelEdit={() => setEditing(null)}
              onAddCartao={data.addCartao}
              onAddPessoa={data.addPessoa}
            />
          </section>

          <section id="lancamentos" ref={(el) => { sectionRefs.current["lancamentos"] = el; }}>
            <TransactionsTable
              key={`${filterMonth}-${filterCartao}-${filterPessoa}`}
              transacoes={transacoesFiltradas}
              cartoes={data.cartoes}
              pessoas={data.pessoas}
              mesesDisponiveis={mesesDisponiveis}
              filterMonth={filterMonth}
              filterCartao={filterCartao}
              filterPessoa={filterPessoa}
              onFilterMonth={setFilterMonth}
              onFilterCartao={setFilterCartao}
              onFilterPessoa={setFilterPessoa}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onClear={handleClear}
              onExport={handleExport}
            />
          </section>

          <section id="resumo" ref={(el) => { sectionRefs.current["resumo"] = el; }}>
            <ChartsPanel transacoes={transacoesFiltradas} />
          </section>
        </div>
      </main>
    </div>
  );
}
