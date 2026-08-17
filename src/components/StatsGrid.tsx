"use client";

import { fmtMoeda } from "@/src/lib/categories";
import { resumoFinanceiro, tipoDe } from "@/src/lib/finance";
import type { Transacao } from "@/src/lib/types";

function formatarVariacao(valor: number | null) {
  if (valor === null) return "Sem histórico no mês anterior";
  if (Math.abs(valor) < 0.05) return "Mesmo nível do mês anterior";
  return `${Math.abs(valor).toFixed(1)}% ${valor > 0 ? "acima" : "abaixo"} do mês anterior`;
}

export default function StatsGrid({
  transacoes,
  todasTransacoes,
  periodo,
  saldoAtual,
  quantidadeContas,
}: {
  transacoes: Transacao[];
  todasTransacoes: Transacao[];
  periodo: string;
  saldoAtual: number;
  quantidadeContas: number;
}) {
  const resumo = resumoFinanceiro(transacoes, todasTransacoes, periodo);

  return (
    <div className="stats">
      <div className="stat stat-total-balance">
        <div className="stat-topline">
          <div className="label">Saldo consolidado</div>
          <span className="stat-icon" aria-hidden="true">$</span>
        </div>
        <div className={`value ${saldoAtual >= 0 ? "positive" : "negative"}`}>
          {fmtMoeda(saldoAtual)}
        </div>
        <div className="sub">{quantidadeContas} conta{quantidadeContas === 1 ? "" : "s"} ativa{quantidadeContas === 1 ? "" : "s"}</div>
      </div>
      <div className="stat stat-income">
        <div className="stat-topline">
          <div className="label">Receitas</div>
          <span className="stat-icon" aria-hidden="true">↗</span>
        </div>
        <div className="value positive">{fmtMoeda(resumo.receitas)}</div>
        <div className="sub">{transacoes.filter((t) => tipoDe(t) === "receita").length} entradas no período</div>
      </div>
      <div className="stat stat-expense">
        <div className="stat-topline">
          <div className="label">Despesas</div>
          <span className="stat-icon" aria-hidden="true">↘</span>
        </div>
        <div className="value negative">{fmtMoeda(resumo.despesas)}</div>
        <div className={`sub${(resumo.variacaoDespesas ?? 0) > 0 ? " warning" : ""}`}>
          {formatarVariacao(resumo.variacaoDespesas)}
        </div>
      </div>
      <div className="stat stat-balance">
        <div className="stat-topline">
          <div className="label">Resultado do mês</div>
          <span className="stat-icon" aria-hidden="true">=</span>
        </div>
        <div className={`value ${resumo.resultado >= 0 ? "positive" : "negative"}`}>
          {fmtMoeda(resumo.resultado)}
        </div>
        <div className="sub">Receitas menos despesas</div>
      </div>
      <div className="stat stat-projection">
        <div className="stat-topline">
          <div className="label">Resultado projetado</div>
          <span className="stat-icon" aria-hidden="true">⌁</span>
        </div>
        <div className={`value ${resumo.resultadoProjetado >= 0 ? "positive" : "negative"}`}>
          {fmtMoeda(resumo.resultadoProjetado)}
        </div>
        <div className="sub">
          {resumo.periodoAtual
            ? `Despesas estimadas em ${fmtMoeda(resumo.despesasProjetadas)}`
            : "Período fechado ou fora do mês atual"}
        </div>
      </div>
    </div>
  );
}
