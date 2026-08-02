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
import { CAT_MAP } from "@/src/lib/categories";
import type { Transacao } from "@/src/lib/types";

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend);

export default function ChartsPanel({ transacoes }: { transacoes: Transacao[] }) {
  const { catLabels, catData, catColors, cardLabels, cardData } = useMemo(() => {
    const porCategoria: Record<string, number> = {};
    const porCartao: Record<string, number> = {};
    transacoes.forEach((t) => {
      porCategoria[t.categoria] = (porCategoria[t.categoria] || 0) + (t.valor || 0);
      porCartao[t.cartao] = (porCartao[t.cartao] || 0) + (t.valor || 0);
    });
    const catLabels = Object.keys(porCategoria);
    return {
      catLabels,
      catData: Object.values(porCategoria),
      catColors: catLabels.map((l) => CAT_MAP[l] || "#999"),
      cardLabels: Object.keys(porCartao),
      cardData: Object.values(porCartao),
    };
  }, [transacoes]);

  return (
    <div className="panel">
      <h2>Resumo visual</h2>
      <div className="charts">
        <div className="chart-box">
          <h3>Gasto por categoria</h3>
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
              },
              cutout: "62%",
            }}
          />
        </div>
        <div className="chart-box">
          <h3>Gasto por cartão / forma</h3>
          <Bar
            data={{
              labels: cardLabels,
              datasets: [
                { label: "Total", data: cardData, backgroundColor: "#1f3a5f", borderRadius: 4, maxBarThickness: 38 },
              ],
            }}
            options={{
              plugins: { legend: { display: false } },
              scales: {
                x: { ticks: { color: "#6b7280", font: { size: 11, family: "Poppins" } }, grid: { display: false } },
                y: {
                  ticks: { color: "#6b7280", font: { size: 11, family: "Poppins" } },
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
