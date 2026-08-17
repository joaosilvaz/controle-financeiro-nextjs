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

  function ocultar(id: string) {
    setOcultos((atuais) => {
      const proximos = new Set(atuais);
      proximos.add(id);
      return proximos;
    });
  }

  return (
    <div className="panel insights-panel">
      <div className="panel-title-row insights-heading">
        <div>
          <h2>Insights automáticos</h2>
          <p>Análise explicável dos seus dados, executada somente neste dispositivo.</p>
        </div>
        <div className={`financial-score ${classePontuacao}`} aria-label={`Pontuação financeira ${analise.pontuacao} de 100`}>
          <strong>{analise.pontuacao}</strong>
          <span>de 100</span>
        </div>
      </div>

      <div className="insights-summary">
        <div className="critical"><span>Prioridade alta</span><strong>{analise.resumo.criticos}</strong></div>
        <div className="warning"><span>Atenção</span><strong>{analise.resumo.atencao}</strong></div>
        <div className="opportunity"><span>Oportunidades</span><strong>{analise.resumo.oportunidades}</strong></div>
        <div className="positive"><span>Pontos positivos</span><strong>{analise.resumo.positivos}</strong></div>
      </div>

      <div className="insights-toolbar" role="group" aria-label="Filtrar insights">
        <button type="button" className={filtro === "todos" ? "active" : ""} onClick={() => setFiltro("todos")}>Todos</button>
        <button type="button" className={filtro === "prioridades" ? "active" : ""} onClick={() => setFiltro("prioridades")}>Prioridades</button>
        <button type="button" className={filtro === "oportunidades" ? "active" : ""} onClick={() => setFiltro("oportunidades")}>Oportunidades</button>
        {ocultos.size ? <button type="button" className="link restore" onClick={() => setOcultos(new Set())}>Restaurar {ocultos.size} oculto(s)</button> : null}
      </div>

      {insightsVisiveis.length ? (
        <div className="insights-grid">
          {insightsVisiveis.slice(0, 10).map((insight) => (
            <article className={`insight-card ${insight.nivel}`} key={insight.id}>
              <div className="insight-card-head">
                <span className={`insight-level ${insight.nivel}`}>{NIVEL_LABEL[insight.nivel]}</span>
                <button type="button" className="insight-dismiss" aria-label={`Ocultar insight: ${insight.titulo}`} title="Ocultar por enquanto" onClick={() => ocultar(insight.id)}>×</button>
              </div>
              <h3>{insight.titulo}</h3>
              <p>{insight.descricao}</p>
              <div className="insight-card-footer">
                {typeof insight.valor === "number" && insight.valor > 0 ? <strong>{fmtMoeda(insight.valor)}</strong> : <span />}
                <button type="button" className="link" onClick={() => onNavigate(insight.acaoDestino)}>{insight.acaoLabel} →</button>
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
