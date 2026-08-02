"use client";

import { fmtMoeda } from "@/src/lib/categories";
import type { Transacao } from "@/src/lib/types";

export default function StatsGrid({ transacoes }: { transacoes: Transacao[] }) {
  const total = transacoes.reduce((s, t) => s + (t.valor || 0), 0);

  const porCartao: Record<string, number> = {};
  const porPessoa: Record<string, number> = {};
  transacoes.forEach((t) => {
    porCartao[t.cartao] = (porCartao[t.cartao] || 0) + (t.valor || 0);
    porPessoa[t.pessoa] = (porPessoa[t.pessoa] || 0) + (t.valor || 0);
  });

  const maiorCartao = Object.entries(porCartao).sort((a, b) => b[1] - a[1])[0];
  const maiorPessoa = Object.entries(porPessoa).sort((a, b) => b[1] - a[1])[0];

  return (
    <div className="stats">
      <div className="stat">
        <div className="label">Total no período</div>
        <div className="value">{fmtMoeda(total)}</div>
      </div>
      <div className="stat">
        <div className="label">Lançamentos</div>
        <div className="value">{transacoes.length}</div>
      </div>
      {maiorCartao && (
        <div className="stat">
          <div className="label">Maior fatura</div>
          <div className="value">{fmtMoeda(maiorCartao[1])}</div>
          <div className="sub">{maiorCartao[0]}</div>
        </div>
      )}
      {maiorPessoa && (
        <div className="stat">
          <div className="label">Quem mais gastou</div>
          <div className="value">{fmtMoeda(maiorPessoa[1])}</div>
          <div className="sub">{maiorPessoa[0]}</div>
        </div>
      )}
    </div>
  );
}
