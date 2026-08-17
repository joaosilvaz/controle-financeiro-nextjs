"use client";

import { useMemo, useState } from "react";
import { fmtMoeda } from "@/src/lib/categories";
import { gerarAnaliseFinanceira, type NivelInsight } from "@/src/lib/insights";
import type {
  FaturaCartao,
  MetaFinanceira,
  MovimentoMeta,
  OrcamentoMensal,
  RecorrenciaFinanceira,
  Transacao,
} from "@/src/lib/types";

type InsightsPanelProps = {
  transacoes: Transacao[];
  orcamentos: OrcamentoMensal[];
  recorrencias: RecorrenciaFinanceira[];
  faturas: FaturaCartao[];
  metas: MetaFinanceira[];
  movimentosMetas: MovimentoMeta[];
  onNavigate: (target: string) => void;
};

const NIVEL_LABEL: Record<NivelInsight, string> = {
  critico: "Prioridade alta",
  atencao: "Atenção",
  oportunidade: "Oportunidade",
  positivo: "Ponto positivo",
};

const NIVEL_ICONE: Record<NivelInsight, string> = {
  critico: "!",
  atencao: "!",
  oportunidade: "↗",
  positivo: "✓",
};

export default function InsightsPanel({
  transacoes,
  orcamentos,
  recorrencias,
  faturas,
  metas,
  movimentosMetas,
  onNavigate,
}: InsightsPanelProps) {
  const [agora] = useState(() => new Date());
  const [ocultos, setOcultos] = useState<Set<string>>(() => new Set());
  const [filtro, setFiltro] = useState<"todos" | "prioridades" | "oportunidades">("todos");

  const analise = useMemo(
    () =>
      gerarAnaliseFinanceira({
        transacoes,
        orcamentos,
        recorrencias,
        faturas,
        metas,
        movimentosMetas,
        agora,
      }),
    [agora, faturas, metas, movimentosMetas, orcamentos, recorrencias, transacoes]
  );

  const insightsVisiveis = useMemo(() => {
    return analise.insights.filter((insight) => {
      if (ocultos.has(insight.id)) return false;
      if (filtro === "prioridades") {
        return insight.nivel === "critico" || insight.nivel === "atencao";
      }
      if (filtro === "oportunidades") {
        return insight.nivel === "oportunidade" || insight.nivel === "positivo";
      }
      return true;
    });
  }, [analise.insights, filtro, ocultos]);

  const classePontuacao = analise.pontuacao >= 80
    ? "good"
    : analise.pontuacao >= 55
      ? "warning"
      : "danger";

  const labelPontuacao = analise.pontuacao >= 80
    ? "Boa organização"
    : analise.pontuacao >= 55
      ? "Pontos de atenção"
      : "Ação recomendada";

  const totalInsights = insightsVisiveis.length;

  function ocultar(id: string) {
    setOcultos((atuais) => {
      const proximos = new Set(atuais);
      proximos.add(id);
      return proximos;
    });
  }

  return (
    <div className="panel insights-panel">
      <div className="insights-overview">
        <div className="insights-intro">
          <span className="insights-eyebrow">Diagnóstico financeiro</span>
          <h2>Insights automáticos</h2>
          <p>Recomendações objetivas a partir dos seus lançamentos e planejamentos.</p>
        </div>
        <div className={`financial-score ${classePontuacao}`} aria-label={`Saúde financeira: ${analise.pontuacao} de 100, ${labelPontuacao}`}>
          <div className="financial-score-number">
            <strong>{analise.pontuacao}</strong>
            <span>/100</span>
          </div>
          <div className="financial-score-copy">
            <span>Saúde financeira</span>
            <strong>{labelPontuacao}</strong>
          </div>
        </div>
      </div>

      <div className="insights-summary" aria-label="Resumo dos insights">
        <div className="critical"><i aria-hidden="true" /><span>Prioridade alta</span><strong>{analise.resumo.criticos}</strong></div>
        <div className="warning"><i aria-hidden="true" /><span>Atenção</span><strong>{analise.resumo.atencao}</strong></div>
        <div className="opportunity"><i aria-hidden="true" /><span>Oportunidades</span><strong>{analise.resumo.oportunidades}</strong></div>
        <div className="positive"><i aria-hidden="true" /><span>Pontos positivos</span><strong>{analise.resumo.positivos}</strong></div>
      </div>

      <div className="insights-content-head">
        <div>
          <h3>Recomendações</h3>
          <span>{totalInsights} {totalInsights === 1 ? "insight disponível" : "insights disponíveis"}</span>
        </div>
        <div className="insights-toolbar" role="group" aria-label="Filtrar insights">
          <button type="button" className={filtro === "todos" ? "active" : ""} aria-pressed={filtro === "todos"} onClick={() => setFiltro("todos")}>Todos</button>
          <button type="button" className={filtro === "prioridades" ? "active" : ""} aria-pressed={filtro === "prioridades"} onClick={() => setFiltro("prioridades")}>Prioridades</button>
          <button type="button" className={filtro === "oportunidades" ? "active" : ""} aria-pressed={filtro === "oportunidades"} onClick={() => setFiltro("oportunidades")}>Oportunidades</button>
        </div>
      </div>

      {ocultos.size ? (
        <button type="button" className="link insights-restore" onClick={() => setOcultos(new Set())}>
          Restaurar {ocultos.size} {ocultos.size === 1 ? "insight oculto" : "insights ocultos"}
        </button>
      ) : null}

      {insightsVisiveis.length ? (
        <div className="insights-list">
          {insightsVisiveis.slice(0, 10).map((insight) => (
            <article className={`insight-card ${insight.nivel}`} key={insight.id}>
              <div className={`insight-indicator ${insight.nivel}`} aria-hidden="true">
                {NIVEL_ICONE[insight.nivel]}
              </div>
              <div className="insight-card-body">
                <div className="insight-card-head">
                  <span className={`insight-level ${insight.nivel}`}>{NIVEL_LABEL[insight.nivel]}</span>
                  <button type="button" className="insight-dismiss" aria-label={`Ocultar insight: ${insight.titulo}`} title="Ocultar por enquanto" onClick={() => ocultar(insight.id)}>×</button>
                </div>
                <h3>{insight.titulo}</h3>
                <p>{insight.descricao}</p>
              </div>
              <div className="insight-card-side">
                {typeof insight.valor === "number" && insight.valor > 0 ? (
                  <div className="insight-value">
                    <span>Valor relacionado</span>
                    <strong>{fmtMoeda(insight.valor)}</strong>
                  </div>
                ) : null}
                <button type="button" className="secondary insight-action" onClick={() => onNavigate(insight.acaoDestino)}>
                  {insight.acaoLabel} <span aria-hidden="true">→</span>
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="insights-empty">
          <strong>Nenhum insight neste filtro.</strong>
          <span>Os indicadores são atualizados automaticamente quando lançamentos e planejamentos mudam.</span>
        </div>
      )}

      <p className="insights-disclaimer">Os insights usam regras estatísticas e servem como apoio à decisão; confirme valores e contexto antes de agir.</p>
    </div>
  );
}
