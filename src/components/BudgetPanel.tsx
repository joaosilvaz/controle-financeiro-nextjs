"use client";

import { useMemo, useState, type FormEvent } from "react";
import { CATEGORIAS_DESPESA, CAT_MAP, fmtMoeda, mesDe, mesLabel } from "@/src/lib/categories";
import { mesAnterior, mesAtual, tipoDe } from "@/src/lib/finance";
import type {
  NovoOrcamentoMensal,
  OrcamentoMensal,
  Transacao,
} from "@/src/lib/types";

type BudgetPanelProps = {
  orcamentos: OrcamentoMensal[];
  transacoes: Transacao[];
  mes: string;
  onMonthChange: (mes: string) => void;
  onAdd: (dados: NovoOrcamentoMensal) => Promise<unknown>;
  onAddMany: (dados: NovoOrcamentoMensal[]) => Promise<unknown>;
  onUpdate: (id: string, dados: NovoOrcamentoMensal) => Promise<unknown>;
  onDelete: (id: string) => Promise<unknown>;
};

function percentualUsado(gasto: number, limite: number): number {
  return limite > 0 ? (gasto / limite) * 100 : 0;
}

export default function BudgetPanel({
  orcamentos,
  transacoes,
  mes,
  onMonthChange,
  onAdd,
  onAddMany,
  onUpdate,
  onDelete,
}: BudgetPanelProps) {
  const [formAberto, setFormAberto] = useState(false);
  const [editing, setEditing] = useState<OrcamentoMensal | null>(null);
  const [categoria, setCategoria] = useState(CATEGORIAS_DESPESA[0].nome as string);
  const [limite, setLimite] = useState("");
  const [alertaPercentual, setAlertaPercentual] = useState("80");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  const gastosPorCategoria = useMemo(() => {
    const gastos = new Map<string, number>();
    transacoes.forEach((transacao) => {
      if (tipoDe(transacao) !== "despesa" || mesDe(transacao.data) !== mes) return;
      gastos.set(
        transacao.categoria,
        (gastos.get(transacao.categoria) ?? 0) + (transacao.valor || 0)
      );
    });
    return gastos;
  }, [mes, transacoes]);

  const orcamentosDoMes = useMemo(
    () =>
      orcamentos
        .filter((orcamento) => orcamento.mes === mes)
        .sort((a, b) => a.categoria.localeCompare(b.categoria, "pt-BR")),
    [mes, orcamentos]
  );

  const categoriasOrcadas = useMemo(
    () => new Set(orcamentosDoMes.map((orcamento) => orcamento.categoria)),
    [orcamentosDoMes]
  );

  const gastosSemOrcamento = useMemo(
    () =>
      [...gastosPorCategoria.entries()]
        .filter(([nome, valor]) => valor > 0 && !categoriasOrcadas.has(nome))
        .sort((a, b) => b[1] - a[1]),
    [categoriasOrcadas, gastosPorCategoria]
  );

  const agora = new Date();
  const periodoAtual = mes === mesAtual(agora);
  const diasNoMes = periodoAtual
    ? new Date(agora.getFullYear(), agora.getMonth() + 1, 0).getDate()
    : 0;
  const fatorProjecao = periodoAtual ? diasNoMes / Math.max(1, agora.getDate()) : 1;

  const resumo = useMemo(() => {
    let limiteTotal = 0;
    let gastoTotal = 0;
    let emAlerta = 0;
    let estourados = 0;

    orcamentosDoMes.forEach((orcamento) => {
      const gasto = gastosPorCategoria.get(orcamento.categoria) ?? 0;
      const percentual = percentualUsado(gasto, orcamento.limite);
      limiteTotal += orcamento.limite;
      gastoTotal += gasto;
      if (percentual >= 100) estourados += 1;
      else if (percentual >= orcamento.alertaPercentual) emAlerta += 1;
    });

    return { limiteTotal, gastoTotal, emAlerta, estourados };
  }, [gastosPorCategoria, orcamentosDoMes]);

  function abrirNovo() {
    const primeiraDisponivel = CATEGORIAS_DESPESA.find(
      (item) => !categoriasOrcadas.has(item.nome)
    );
    setEditing(null);
    setCategoria(primeiraDisponivel?.nome ?? CATEGORIAS_DESPESA[0].nome);
    setLimite("");
    setAlertaPercentual("80");
    setErro("");
    setFormAberto(true);
  }

  function abrirEdicao(orcamento: OrcamentoMensal) {
    setEditing(orcamento);
    setCategoria(orcamento.categoria);
    setLimite(String(orcamento.limite));
    setAlertaPercentual(String(orcamento.alertaPercentual));
    setErro("");
    setFormAberto(true);
  }

  function fecharForm() {
    setEditing(null);
    setErro("");
    setFormAberto(false);
  }

  async function salvar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const limiteNumero = Number(limite.replace(",", "."));
    const alertaNumero = Number(alertaPercentual);

    if (!categoria || !Number.isFinite(limiteNumero) || limiteNumero <= 0) {
      setErro("Informe uma categoria e um limite maior que zero.");
      return;
    }
    if (alertaNumero < 50 || alertaNumero > 100) {
      setErro("O alerta deve ficar entre 50% e 100%.");
      return;
    }
    if (!editing && categoriasOrcadas.has(categoria)) {
      setErro("Essa categoria já possui orçamento neste mês.");
      return;
    }

    const dados: NovoOrcamentoMensal = {
      mes,
      categoria,
      limite: limiteNumero,
      alertaPercentual: alertaNumero,
    };

    try {
      setSalvando(true);
      if (editing) await onUpdate(editing.id, dados);
      else await onAdd(dados);
      fecharForm();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível salvar o orçamento.");
    } finally {
      setSalvando(false);
    }
  }

  async function copiarMesAnterior() {
    const anterior = mesAnterior(mes);
    const origem = orcamentos.filter((orcamento) => orcamento.mes === anterior);
    const novos = origem
      .filter((orcamento) => !categoriasOrcadas.has(orcamento.categoria))
      .map(({ categoria: nome, limite: valor, alertaPercentual: alerta }) => ({
        mes,
        categoria: nome,
        limite: valor,
        alertaPercentual: alerta,
      }));

    if (!origem.length) {
      setErro(`Não há orçamento em ${mesLabel(anterior)} para copiar.`);
      return;
    }
    if (!novos.length) {
      setErro("Todas as categorias do mês anterior já estão configuradas.");
      return;
    }

    try {
      setErro("");
      setSalvando(true);
      await onAddMany(novos);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível copiar o orçamento.");
    } finally {
      setSalvando(false);
    }
  }

  async function excluir(orcamento: OrcamentoMensal) {
    if (!confirm(`Remover o orçamento de ${orcamento.categoria}?`)) return;
    try {
      await onDelete(orcamento.id);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível remover o orçamento.");
    }
  }

  return (
    <div className="panel budget-panel">
      <div className="panel-title-row budget-heading">
        <div>
          <h2>Orçamento mensal</h2>
          <p>Defina limites por categoria e acompanhe os alertas antes de estourar.</p>
        </div>
        <div className="budget-heading-actions">
          <label>
            Mês
            <input
              type="month"
              value={mes}
              onChange={(event) => {
                if (event.target.value) onMonthChange(event.target.value);
              }}
              aria-label="Mês do orçamento"
            />
          </label>
          <button type="button" className="secondary" onClick={copiarMesAnterior} disabled={salvando}>
            Copiar mês anterior
          </button>
          <button type="button" onClick={abrirNovo} disabled={categoriasOrcadas.size >= CATEGORIAS_DESPESA.length}>
            Novo limite
          </button>
        </div>
      </div>

      <div className="budget-summary" aria-label={`Resumo do orçamento de ${mesLabel(mes)}`}>
        <div>
          <span>Planejado</span>
          <strong>{fmtMoeda(resumo.limiteTotal)}</strong>
        </div>
        <div>
          <span>Gasto orçado</span>
          <strong>{fmtMoeda(resumo.gastoTotal)}</strong>
        </div>
        <div>
          <span>Disponível</span>
          <strong className={resumo.limiteTotal - resumo.gastoTotal < 0 ? "negative" : ""}>
            {fmtMoeda(resumo.limiteTotal - resumo.gastoTotal)}
          </strong>
        </div>
        <div>
          <span>Alertas</span>
          <strong className={resumo.emAlerta + resumo.estourados > 0 ? "warning" : ""}>
            {resumo.emAlerta + resumo.estourados}
          </strong>
        </div>
      </div>

      {erro ? <div className="budget-message" role="alert">{erro}</div> : null}

      {formAberto ? (
        <form className="budget-form" onSubmit={salvar}>
          <div>
            <label htmlFor="budget-category">Categoria</label>
            <select
              id="budget-category"
              value={categoria}
              onChange={(event) => setCategoria(event.target.value)}
              disabled={Boolean(editing)}
            >
              {CATEGORIAS_DESPESA.map((item) => (
                <option
                  key={item.nome}
                  value={item.nome}
                  disabled={!editing && categoriasOrcadas.has(item.nome)}
                >
                  {item.nome}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="budget-limit">Limite mensal (R$)</label>
            <input
              id="budget-limit"
              type="number"
              min="0.01"
              step="0.01"
              inputMode="decimal"
              value={limite}
              onChange={(event) => setLimite(event.target.value)}
              placeholder="0,00"
              autoFocus
            />
          </div>
          <div>
            <label htmlFor="budget-alert">Alertar ao atingir</label>
            <select
              id="budget-alert"
              value={alertaPercentual}
              onChange={(event) => setAlertaPercentual(event.target.value)}
            >
              <option value="50">50%</option>
              <option value="70">70%</option>
              <option value="80">80%</option>
              <option value="90">90%</option>
              <option value="100">100%</option>
            </select>
          </div>
          <div className="budget-form-actions">
            <button type="button" className="secondary" onClick={fecharForm}>Cancelar</button>
            <button type="submit" disabled={salvando}>{salvando ? "Salvando…" : "Salvar limite"}</button>
          </div>
        </form>
      ) : null}

      {orcamentosDoMes.length ? (
        <div className="budget-grid">
          {orcamentosDoMes.map((orcamento) => {
            const gasto = gastosPorCategoria.get(orcamento.categoria) ?? 0;
            const percentual = percentualUsado(gasto, orcamento.limite);
            const percentualBarra = Math.min(100, percentual);
            const projecao = gasto * fatorProjecao;
            const estourado = percentual >= 100;
            const alerta = !estourado && percentual >= orcamento.alertaPercentual;
            const riscoProjetado = !estourado && !alerta && periodoAtual && projecao > orcamento.limite;
            const status = estourado ? "over" : alerta || riscoProjetado ? "warning" : "ok";
            const statusTexto = estourado
              ? "Limite ultrapassado"
              : alerta
                ? `Alerta de ${orcamento.alertaPercentual}% atingido`
                : riscoProjetado
                  ? "Projeção acima do limite"
                  : "Dentro do planejado";

            return (
              <article className={`budget-card ${status}`} key={orcamento.id}>
                <div className="budget-card-head">
                  <span className="budget-category-dot" style={{ backgroundColor: CAT_MAP[orcamento.categoria] ?? "#5b636e" }} />
                  <div>
                    <h3>{orcamento.categoria}</h3>
                    <span className={`budget-status ${status}`}>{statusTexto}</span>
                  </div>
                  <strong>{Math.round(percentual)}%</strong>
                </div>
                <div
                  className="budget-progress"
                  role="progressbar"
                  aria-label={`Uso do orçamento de ${orcamento.categoria}`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(percentualBarra)}
                >
                  <span style={{ width: `${percentualBarra}%` }} />
                </div>
                <div className="budget-values">
                  <div><span>Gasto</span><strong>{fmtMoeda(gasto)}</strong></div>
                  <div><span>Limite</span><strong>{fmtMoeda(orcamento.limite)}</strong></div>
                  <div><span>Restante</span><strong>{fmtMoeda(orcamento.limite - gasto)}</strong></div>
                </div>
                {periodoAtual && gasto > 0 ? (
                  <p className="budget-projection">Projeção no fim do mês: <strong>{fmtMoeda(projecao)}</strong></p>
                ) : null}
                <div className="budget-card-actions">
                  <button type="button" className="link" onClick={() => abrirEdicao(orcamento)}>Editar</button>
                  <button type="button" className="link danger" onClick={() => excluir(orcamento)}>Excluir</button>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="budget-empty">
          <strong>Nenhum limite definido para {mesLabel(mes)}.</strong>
          <span>Crie o primeiro orçamento ou copie a estrutura do mês anterior.</span>
        </div>
      )}

      {gastosSemOrcamento.length ? (
        <div className="unbudgeted-box">
          <div>
            <strong>Gastos sem orçamento</strong>
            <span>Estas categorias ainda não possuem um limite em {mesLabel(mes)}.</span>
          </div>
          <div className="unbudgeted-list">
            {gastosSemOrcamento.slice(0, 4).map(([nome, valor]) => (
              <span key={nome}>{nome} <strong>{fmtMoeda(valor)}</strong></span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
