"use client";

import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Tooltip,
} from "chart.js";
import { useMemo } from "react";
import { Bar, Doughnut } from "react-chartjs-2";
import { CAT_MAP, fmtMoeda, mesDe, mesLabel } from "@/src/lib/categories";
import { mesAtual, tipoDe } from "@/src/lib/finance";
import type { Transacao } from "@/src/lib/types";

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend);

export default function ChartsPanel({
  transacoes,
  todasTransacoes,
}: {
  transacoes: Transacao[];
  todasTransacoes: Transacao[];
}) {
  const { catLabels, catData, catColors, monthLabels, incomeData, expenseData } = useMemo(() => {
    const porCategoria: Record<string, number> = {};
    transacoes.forEach((t) => {
      if (tipoDe(t) === "despesa") {
        porCategoria[t.categoria] = (porCategoria[t.categoria] || 0) + (t.valor || 0);
      }
    });
    const catLabels = Object.keys(porCategoria);

    const meses = [...new Set(todasTransacoes.map((t) => mesDe(t.data)).filter(Boolean))]
      .sort()
      .slice(-6);
    if (meses.length === 0) meses.push(mesAtual());

    const receitasPorMes = Object.fromEntries(meses.map((mes) => [mes, 0]));
    const despesasPorMes = Object.fromEntries(meses.map((mes) => [mes, 0]));
    todasTransacoes.forEach((t) => {
      const mes = mesDe(t.data);
      if (!(mes in receitasPorMes)) return;
      if (tipoDe(t) === "receita") receitasPorMes[mes] += t.valor || 0;
      if (tipoDe(t) === "despesa") despesasPorMes[mes] += t.valor || 0;
    });

    return {
      catLabels,
      catData: Object.values(porCategoria),
      catColors: catLabels.map((l) => CAT_MAP[l] || "#999"),
      monthLabels: meses.map(mesLabel),
      incomeData: Object.values(receitasPorMes),
      expenseData: Object.values(despesasPorMes),
    };
  }, [todasTransacoes, transacoes]);

  return (
    <div className="panel">
      <h2>Resumo visual</h2>
      <div className="charts">
        <div className="chart-box">
          <h3>Gasto por categoria</h3>
          {catData.length > 0 ? (
            <Doughnut
              data={{
                labels: catLabels,
                datasets: [{ data: catData, backgroundColor: catColors, borderWidth: 2, borderColor: "#fff" }],
              }}
              options={{
                plugins: {
                  legend: {
                    position: "bottom",
                    labels: { color: "#4b5563", font: { size: 11, family: "Poppins" }, boxWidth: 10, padding: 12 },
                  },
                  tooltip: {
                    callbacks: { label: (context) => ` ${context.label}: ${fmtMoeda(context.parsed)}` },
                  },
                },
                cutout: "62%",
              }}
            />
          ) : (
            <div className="chart-empty">Nenhuma despesa neste período.</div>
          )}
        </div>
        <div className="chart-box">
          <h3>Receitas x despesas · últimos 6 meses</h3>
          <Bar
            data={{
              labels: monthLabels,
              datasets: [
                { label: "Receitas", data: incomeData, backgroundColor: "#35a77a", borderRadius: 4, maxBarThickness: 28 },
                { label: "Despesas", data: expenseData, backgroundColor: "#d6635d", borderRadius: 4, maxBarThickness: 28 },
              ],
            }}
            options={{
              plugins: {
                legend: {
                  position: "bottom",
                  labels: { color: "#4b5563", font: { size: 11, family: "Poppins" }, boxWidth: 10, padding: 12 },
                },
                tooltip: {
                  callbacks: { label: (context) => ` ${context.dataset.label}: ${fmtMoeda(context.parsed.y)}` },
                },
              },
              scales: {
                x: { ticks: { color: "#6b7280", font: { size: 11, family: "Poppins" } }, grid: { display: false } },
                y: {
                  ticks: {
                    color: "#6b7280",
                    font: { size: 11, family: "Poppins" },
                    callback: (value) => Number(value).toLocaleString("pt-BR", { notation: "compact" }),
                  },
                  grid: { color: "#eef0f2" },
                  beginAtZero: true,
                },
              },
            }}
          />
        </div>
      </div>
    </div>
  );
}
