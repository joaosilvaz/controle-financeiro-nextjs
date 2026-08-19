"use client";

import { useMemo, useState, type ReactNode } from "react";
import { fmtMoeda } from "@/src/lib/categories";
import { gerarAlertasFinanceiros } from "@/src/lib/alerts";
import type { DashboardSection } from "@/src/lib/navigation";
import type {
  CartaoCredito,
  ContaFinanceira,
  FaturaCartao,
  MetaFinanceira,
  MovimentoMeta,
  NivelAlertaFinanceiro,
  OrcamentoMensal,
  RecorrenciaFinanceira,
  Transacao,
} from "@/src/lib/types";

type AlertFilter = "todos" | NivelAlertaFinanceiro;

const LEVEL_LABELS: Record<NivelAlertaFinanceiro, string> = {
  critico: "Urgente",
  atencao: "Atenção",
  lembrete: "Lembrete",
};

const ORIGIN_LABELS = {
  saldo: "Saldo",
  fatura: "Fatura",
  orcamento: "Orçamento",
  recorrencia: "Recorrência",
  meta: "Meta",
  fechamento: "Fechamento",
} as const;

function alertIcon(origin: keyof typeof ORIGIN_LABELS): ReactNode {
  if (origin === "fatura") return <path d="M4 5h16v14H4zM4 9h16M8 14h4" />;
  if (origin === "orcamento") return <path d="M4 18V6M10 18v-8M16 18V3M22 18H2" />;
  if (origin === "saldo") return <path d="M3 7h18v12H3zM16 13h5M7 11h4" />;
  if (origin === "recorrencia") return <><path d="M20 7h-5V2" /><path d="M20 7a8 8 0 1 0 1 8" /></>;
  if (origin === "meta") return <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4" /><path d="m15 9 5-5" /></>;
  return <><path d="M5 4h14v16H5zM8 8h8M8 12h8M8 16h5" /></>;
}

function todayLocal(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export default function AlertsPanel({
  transacoes,
  contas,
  saldos,
  cartoes,
  faturas,
  orcamentos,
  recorrencias,
  metas,
  movimentosMetas,
  alertasOcultos,
  onSnooze,
  onRestore,
  onNavigate,
}: {
  transacoes: Transacao[];
  contas: ContaFinanceira[];
  saldos: Record<string, number>;
  cartoes: CartaoCredito[];
  faturas: FaturaCartao[];
  orcamentos: OrcamentoMensal[];
  recorrencias: RecorrenciaFinanceira[];
  metas: MetaFinanceira[];
  movimentosMetas: MovimentoMeta[];
  alertasOcultos: Record<string, string>;
  onSnooze: (id: string, days: number) => Promise<unknown>;
  onRestore: (id: string) => Promise<unknown>;
  onNavigate: (section: DashboardSection) => void;
}) {
  const [today] = useState(todayLocal);
  const [filter, setFilter] = useState<AlertFilter>("todos");
  const [showSnoozed, setShowSnoozed] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");

  const alerts = useMemo(
    () => gerarAlertasFinanceiros({
      hoje: today,
      transacoes,
      contas,
      saldos,
      cartoes,
      faturas,
      orcamentos,
      recorrencias,
      metas,
      movimentosMetas,
    }),
    [cartoes, contas, faturas, metas, movimentosMetas, orcamentos, recorrencias, saldos, today, transacoes]
  );

  const snoozed = alerts.filter((alert) => (alertasOcultos[alert.id] ?? "") > today);
  const active = alerts.filter((alert) => (alertasOcultos[alert.id] ?? "") <= today);
  const filtered = filter === "todos" ? active : active.filter((alert) => alert.nivel === filter);
  const counts = active.reduce(
    (total, alert) => ({ ...total, [alert.nivel]: total[alert.nivel] + 1 }),
    { critico: 0, atencao: 0, lembrete: 0 }
  );

  async function snooze(id: string) {
    try {
      setBusyId(id);
      setError("");
      await onSnooze(id, 7);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível adiar o lembrete.");
    } finally {
      setBusyId("");
    }
  }

  async function restore(id: string) {
    try {
      setBusyId(id);
      setError("");
      await onRestore(id);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível restaurar o lembrete.");
    } finally {
      setBusyId("");
    }
  }

  return (
    <div className="alerts-panel">
      <section className="alerts-overview panel">
        <div className="alerts-overview-copy">
          <span className="alerts-kicker">Monitoramento automático</span>
          <h2>{active.length ? `${active.length} ponto${active.length === 1 ? "" : "s"} para acompanhar` : "Tudo sob controle"}</h2>
          <p>Os alertas são recalculados com base nos seus lançamentos, vencimentos e planejamentos.</p>
        </div>
        <div className="alerts-summary" aria-label="Resumo dos alertas">
          <div className="critical"><strong>{counts.critico}</strong><span>Urgentes</span></div>
          <div className="warning"><strong>{counts.atencao}</strong><span>Atenção</span></div>
          <div className="reminder"><strong>{counts.lembrete}</strong><span>Lembretes</span></div>
        </div>
      </section>

      <section className="panel alerts-list-panel">
        <div className="alerts-toolbar">
          <div>
            <h2>Central de alertas</h2>
            <p>Prioridades financeiras ordenadas por urgência.</p>
          </div>
          <div className="alerts-filters" aria-label="Filtrar alertas">
            {([
              ["todos", "Todos", active.length],
              ["critico", "Urgentes", counts.critico],
              ["atencao", "Atenção", counts.atencao],
              ["lembrete", "Lembretes", counts.lembrete],
            ] as const).map(([value, label, count]) => (
              <button
                type="button"
                key={value}
                className={filter === value ? "active" : ""}
                onClick={() => setFilter(value)}
              >
                {label}<span>{count}</span>
              </button>
            ))}
          </div>
        </div>

        {error ? <div className="alerts-error" role="alert">{error}</div> : null}

        {filtered.length ? (
          <div className="alerts-list">
            {filtered.map((alert) => (
              <article className={`alert-item ${alert.nivel}`} key={alert.id}>
                <div className="alert-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    {alertIcon(alert.origem)}
                  </svg>
                </div>
                <div className="alert-main">
                  <div className="alert-meta">
                    <span className={`alert-level ${alert.nivel}`}>{LEVEL_LABELS[alert.nivel]}</span>
                    <span>{ORIGIN_LABELS[alert.origem]}</span>
                  </div>
                  <h3>{alert.titulo}</h3>
                  <p>{alert.descricao}</p>
                </div>
                <div className="alert-side">
                  {alert.valor !== undefined ? <strong>{fmtMoeda(alert.valor)}</strong> : null}
                  <button type="button" onClick={() => onNavigate(alert.destino)}>{alert.acao}</button>
                  <button
                    type="button"
                    className="link"
                    disabled={busyId === alert.id}
                    onClick={() => snooze(alert.id)}
                  >
                    Lembrar em 7 dias
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="alerts-empty">
            <span>✓</span>
            <strong>Nenhum alerta neste filtro</strong>
            <p>Quando algo precisar da sua atenção, aparecerá aqui automaticamente.</p>
          </div>
        )}

        {snoozed.length ? (
          <div className="snoozed-alerts">
            <button type="button" className="snoozed-toggle" onClick={() => setShowSnoozed((current) => !current)}>
              <span>{snoozed.length} lembrete{snoozed.length === 1 ? " adiado" : "s adiados"}</span>
              <span>{showSnoozed ? "Ocultar" : "Mostrar"}</span>
            </button>
            {showSnoozed ? (
              <div className="snoozed-list">
                {snoozed.map((alert) => (
                  <div key={alert.id}>
                    <span><strong>{alert.titulo}</strong> até {alertasOcultos[alert.id].split("-").reverse().join("/")}</span>
                    <button type="button" className="link" disabled={busyId === alert.id} onClick={() => restore(alert.id)}>Restaurar</button>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </section>
    </div>
  );
}
