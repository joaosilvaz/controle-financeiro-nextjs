"use client";

import { useMemo, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import AccountsPanel from "@/src/components/AccountsPanel";
import AlertsPanel from "@/src/components/AlertsPanel";
import BudgetPanel from "@/src/components/BudgetPanel";
import CardsPanel from "@/src/components/CardsPanel";
import CategorizationRulesPanel from "@/src/components/CategorizationRulesPanel";
import { CategoryCatalogProvider } from "@/src/components/CategoryCatalogProvider";
import ChartsPanel from "@/src/components/ChartsPanel";
import CustomCategoriesPanel from "@/src/components/CustomCategoriesPanel";
import GoalsPanel from "@/src/components/GoalsPanel";
import FamilyAuthGate from "@/src/components/FamilyAuthGate";
import FamilyManager from "@/src/components/FamilyManager";
import InsightsPanel from "@/src/components/InsightsPanel";
import MonthlyReportPanel from "@/src/components/MonthlyReportPanel";
import RecurringPanel from "@/src/components/RecurringPanel";
import RegistryManager from "@/src/components/RegistryManager";
import SectionTabs from "@/src/components/SectionTabs";
import Sidebar from "@/src/components/Sidebar";
import StatsGrid from "@/src/components/StatsGrid";
import TransactionForm from "@/src/components/TransactionForm";
import TransactionReviewPanel from "@/src/components/TransactionReviewPanel";
import TransactionsTable from "@/src/components/TransactionsTable";
import SetupGate from "@/src/components/SetupGate";
import StatementImportPanel from "@/src/components/StatementImportPanel";
import { useAppData } from "@/src/hooks/useAppData";
import { firebaseConfigured } from "@/src/lib/firebase";
import { mesDe, mesLabel } from "@/src/lib/categories";
import {
  dashboardPath,
  isDashboardSection,
  sectionFromPathname,
  SECTION_META,
} from "@/src/lib/navigation";
import {
  adicionarMesesAoMes,
  calcularSaldosContas,
  criarParcelasCartao,
  mesAtual,
  mesDaFatura,
  tipoDe,
} from "@/src/lib/finance";
import type { NovaTransacao, TipoTransacao, Transacao } from "@/src/lib/types";

export default function FinanceApp({ children }: { children: ReactNode }) {
  const data = useAppData();
  const pathname = usePathname();
  const router = useRouter();
  const activeSection = sectionFromPathname(pathname);

  const [editing, setEditing] = useState<Transacao | null>(null);
  const [filterMonth, setFilterMonth] = useState(() => mesAtual());
  const [budgetMonth, setBudgetMonth] = useState(() => mesAtual());
  const [filterCartao, setFilterCartao] = useState("");
  const [filterPessoa, setFilterPessoa] = useState("");
  const [filterConta, setFilterConta] = useState("");
  const [filterTipo, setFilterTipo] = useState<TipoTransacao | "">("");
  const [filterTag, setFilterTag] = useState("");
  const [registryOpen, setRegistryOpen] = useState(false);
  const [familyManagerOpen, setFamilyManagerOpen] = useState(false);

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
      .filter((t) => !filterTag || t.tags?.includes(filterTag))
      .sort((a, b) => (b.data || "").localeCompare(a.data || ""));
  }, [filterTag, transacoesDoPeriodo, filterTipo]);

  const tagsDisponiveis = useMemo(
    () => [...new Set(data.transacoes.flatMap((transacao) => transacao.tags ?? []))].sort((a, b) => a.localeCompare(b, "pt-BR")),
    [data.transacoes]
  );

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

  if (!data.authReady || (data.user && !data.user.isAnonymous && !data.perfilReady)) {
    return (
      <div className="gate">
        <div className="gate-card" style={{ textAlign: "center" }}>
          <div className="brand-mark" style={{ margin: "0 auto 14px" }}>
            CF
          </div>
          <p style={{ margin: 0 }}>Verificando o acesso da família…</p>
          {data.authError && (
            <p style={{ color: "var(--danger)", marginTop: 10 }}>{data.authError}</p>
          )}
        </div>
      </div>
    );
  }

  if (!data.user || data.user.isAnonymous || !data.perfil) {
    return (
      <FamilyAuthGate
        usuarioAutenticado={Boolean(data.user && !data.user.isAnonymous)}
        nomeInicial={data.user?.displayName ?? undefined}
        emailInicial={data.user?.email ?? undefined}
        authError={data.authError}
        onLogin={data.entrar}
        onRegister={data.cadastrarUsuario}
        onResetPassword={data.recuperarSenha}
        onConfigureFamily={data.configurarFamilia}
        onLogout={data.sair}
      />
    );
  }

  if (!data.perfil.ativo) {
    return (
      <div className="family-auth-screen"><div className="family-auth-card"><div className="family-auth-brand"><div className="brand-mark">CF</div><div><strong>Acesso pausado</strong><span>Peça a um administrador da família para reativar seu perfil.</span></div></div><button type="button" onClick={data.sair}>Sair desta conta</button></div></div>
    );
  }

  if (!data.ready) {
    return (
      <div className="gate"><div className="gate-card" style={{ textAlign: "center" }}><div className="brand-mark" style={{ margin: "0 auto 14px" }}>CF</div><p style={{ margin: 0 }}>Sincronizando os dados da família…</p>{data.authError ? <p style={{ color: "var(--danger)", marginTop: 10 }}>{data.authError}</p> : null}</div></div>
    );
  }

  function handleNavigate(target: string) {
    if (isDashboardSection(target)) router.push(dashboardPath(target));
  }

  async function handleSubmit(
    dados: NovaTransacao,
    opcoes?: { parcelasPagas?: number; primeiraParcelaPendenteMes?: string }
  ) {
    try {
      if (editing) {
        const cartao = dados.cartaoId
          ? data.cartoesCredito.find((item) => item.id === dados.cartaoId)
          : undefined;
        const dadosAtualizados = cartao
          ? {
              ...dados,
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
          await data.addTransacoes(
            criarParcelasCartao(
              dados,
              cartao,
              grupoId,
              opcoes?.parcelasPagas ?? 0,
              opcoes?.primeiraParcelaPendenteMes
            )
          );
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
    router.push(dashboardPath("novo"));
  }

  async function handleDelete(id: string) {
    const transacao = data.transacoes.find((item) => item.id === id);
    const parcelas = transacao?.grupoParcelamentoId
      ? data.transacoes.filter(
          (item) => item.grupoParcelamentoId === transacao.grupoParcelamentoId
        )
      : [];
    let idsParaExcluir = [id];

    if (parcelas.length > 1) {
      const totalParcelas = transacao?.totalParcelas ?? parcelas.length;
      const excluirTodas = confirm(
        `Esta é uma compra de ${totalParcelas} parcelas e há ${parcelas.length} lançamentos cadastrados.\n\n` +
        "Clique em OK para excluir a compra completa ou em Cancelar para escolher somente esta parcela."
      );
      if (excluirTodas) {
        idsParaExcluir = parcelas.map((parcela) => parcela.id);
      } else if (!confirm("Excluir somente esta parcela?")) {
        return;
      }
    } else if (!confirm("Excluir este lançamento?")) {
      return;
    }

    try {
      await data.deleteTransacoes(idsParaExcluir);
      if (editing && idsParaExcluir.includes(editing.id)) setEditing(null);
    } catch (err) {
      alert("Erro ao excluir: " + (err instanceof Error ? err.message : String(err)));
    }
  }

  async function handleClear() {
    if (!confirm("Isso vai apagar TODOS os lançamentos salvos, para todo mundo. Tem certeza?")) return;
    await data.clearAll();
    setEditing(null);
  }

  function handleExport() {
    const escaparCsv = (valor: string | number) =>
      `"${String(valor).replace(/"/g, '""')}"`;
    const linhas = ["Data,Tipo,Descrição,Categoria,Conta origem,Conta destino,Cartão ou forma,Pessoa,Lançado por,Tags,Nota,Valor"];
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
          t.criadoPorNome || "",
          (t.tags ?? []).join(" | "),
          t.nota || "",
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
  if (filterTag) partesTag.push(`#${filterTag}`);

  const pageMeta = SECTION_META[activeSection];

  function renderActiveSection() {
    switch (activeSection) {
      case "visao-geral":
        return (
          <StatsGrid
            transacoes={transacoesDoPeriodo}
            todasTransacoes={transacoesComparacao}
            periodo={filterMonth}
            saldoAtual={saldoAtual}
            quantidadeContas={data.contas.filter((conta) => conta.ativa).length}
          />
        );
      case "insights":
        return (
          <InsightsPanel
            transacoes={data.transacoes}
            orcamentos={data.orcamentos}
            recorrencias={data.recorrencias}
            faturas={data.faturas}
            metas={data.metas}
            movimentosMetas={data.movimentosMetas}
            onNavigate={handleNavigate}
          />
        );
      case "alertas":
        return (
          <AlertsPanel
            transacoes={data.transacoes}
            contas={data.contas}
            saldos={saldosContas}
            cartoes={data.cartoesCredito}
            faturas={data.faturas}
            orcamentos={data.orcamentos}
            recorrencias={data.recorrencias}
            metas={data.metas}
            movimentosMetas={data.movimentosMetas}
            alertasOcultos={data.alertasOcultos}
            onSnooze={data.snoozeAlerta}
            onRestore={data.restoreAlerta}
            onNavigate={handleNavigate}
          />
        );
      case "revisao":
        return (
          <TransactionReviewPanel
            transacoes={data.transacoes}
            contas={data.contas}
            onUpdate={data.updateTransacao}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        );
      case "regras":
        return (
          <CategorizationRulesPanel
            regras={data.regrasCategorizacao}
            transacoes={data.transacoes}
            onAdd={data.addRegraCategorizacao}
            onUpdate={data.updateRegraCategorizacao}
            onDelete={data.deleteRegraCategorizacao}
            onApply={data.aplicarRegraCategorizacaoExistentes}
          />
        );
      case "categorias":
        return (
          <CustomCategoriesPanel
            categorias={data.categoriasPersonalizadas}
            transacoes={data.transacoes}
            orcamentos={data.orcamentos}
            recorrencias={data.recorrencias}
            regras={data.regrasCategorizacao}
            onAdd={data.addCategoriaPersonalizada}
            onUpdate={data.updateCategoriaPersonalizada}
            onDelete={data.deleteCategoriaPersonalizada}
          />
        );
      case "importar":
        return (
          <StatementImportPanel
            transacoes={data.transacoes}
            contas={data.contas}
            pessoas={data.pessoas}
            onImport={data.addTransacoes}
          />
        );
      case "contas":
        return (
          <AccountsPanel
            contas={data.contas}
            saldos={saldosContas}
            transacoes={data.transacoes}
            onAdd={data.addConta}
            onUpdate={data.updateConta}
            onDelete={data.deleteConta}
          />
        );
      case "cartoes":
        return (
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
        );
      case "orcamentos":
        return (
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
        );
      case "recorrencias":
        return (
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
        );
      case "metas":
        return (
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
        );
      case "novo":
        return (
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
        );
      case "lancamentos":
        return (
          <TransactionsTable
            key={`${filterMonth}-${filterCartao}-${filterPessoa}-${filterConta}-${filterTipo}-${filterTag}`}
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
            filterTag={filterTag}
            tagsDisponiveis={tagsDisponiveis}
            onFilterMonth={setFilterMonth}
            onFilterCartao={setFilterCartao}
            onFilterPessoa={setFilterPessoa}
            onFilterConta={setFilterConta}
            onFilterTipo={setFilterTipo}
            onFilterTag={setFilterTag}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onClear={handleClear}
            onExport={handleExport}
            onManageRegistries={() => setRegistryOpen(true)}
          />
        );
      case "resumo":
        return (
          <ChartsPanel
            transacoes={transacoesDoPeriodo}
            todasTransacoes={transacoesComparacao}
          />
        );
      case "relatorios-mensais":
        return (
          <MonthlyReportPanel
            transacoes={data.transacoes}
            contas={data.contas}
            cartoes={data.cartoesCredito}
            orcamentos={data.orcamentos}
            mesesDisponiveis={mesesDisponiveis}
          />
        );
    }
  }

  return (
    <CategoryCatalogProvider personalizadas={data.categoriasPersonalizadas}>
      <div className="app">
        <Sidebar
          activeSection={activeSection}
          synced={data.ready}
          profile={data.perfil}
          familyName={data.familia?.nome}
          onOpenFamily={() => setFamilyManagerOpen(true)}
          onLogout={data.sair}
        />
        <main className="main">
          <div className="wrap">
            <header className="top">
              <div>
                <h1>{pageMeta.titulo}</h1>
                <div className="sub">{pageMeta.descricao}</div>
              </div>
              <span className="tag">{partesTag.join(" · ")}</span>
            </header>

            <SectionTabs activeSection={activeSection} />

            <section id={activeSection} className="dashboard-page">
              {renderActiveSection()}
            </section>
            <RegistryManager
              open={registryOpen}
              pessoas={data.pessoas}
              cartoes={data.cartoesCredito}
              contas={data.contas}
              transacoes={data.transacoes}
              onClose={() => setRegistryOpen(false)}
              onNavigate={handleNavigate}
              onAddPessoa={data.addPessoa}
              onUpdatePessoa={async (nomeAtual, novoNome) => {
                await data.updatePessoa(nomeAtual, novoNome);
                if (filterPessoa === nomeAtual) setFilterPessoa(novoNome.trim());
              }}
              onDeletePessoa={async (nome) => {
                await data.deletePessoa(nome);
                if (filterPessoa === nome) setFilterPessoa("");
              }}
              onUpdateCartao={data.updateCartaoCredito}
              onDeleteCartao={data.deleteCartaoCredito}
              onUpdateConta={data.updateConta}
              onDeleteConta={data.deleteConta}
            />
            <FamilyManager
              open={familyManagerOpen}
              familia={data.familia}
              perfil={data.perfil}
              membros={data.membros}
              onClose={() => setFamilyManagerOpen(false)}
              onUpdateMember={data.updateMembro}
              onRenewInvite={data.renovarCodigoConvite}
            />
            {children}
          </div>
        </main>
      </div>
    </CategoryCatalogProvider>
  );
}
