"use client";

import { useMemo, useState, type FormEvent } from "react";
import { fmtMoeda, mesDe } from "@/src/lib/categories";
import { adicionarMesesAoMes, mesAtual, tipoDe } from "@/src/lib/finance";
import type {
  ContaFinanceira,
  MetaFinanceira,
  MovimentoMeta,
  NovaMetaFinanceira,
  NovoMovimentoMeta,
  TipoMetaFinanceira,
  Transacao,
} from "@/src/lib/types";

type GoalsPanelProps = {
  metas: MetaFinanceira[];
  movimentos: MovimentoMeta[];
  transacoes: Transacao[];
  contas: ContaFinanceira[];
  saldosContas: Record<string, number>;
  onAdd: (dados: NovaMetaFinanceira) => Promise<unknown>;
  onUpdate: (id: string, dados: NovaMetaFinanceira) => Promise<unknown>;
  onDelete: (id: string) => Promise<unknown>;
  onAddMovement: (dados: NovoMovimentoMeta) => Promise<unknown>;
  onDeleteMovement: (id: string) => Promise<unknown>;
};

const TIPOS_META: Array<{ valor: TipoMetaFinanceira; nome: string }> = [
  { valor: "reserva", nome: "Reserva de emergência" },
  { valor: "viagem", nome: "Viagem" },
  { valor: "compra", nome: "Compra" },
  { valor: "divida", nome: "Quitar dívida" },
  { valor: "outro", nome: "Outro objetivo" },
];
const TIPOS_META_LABEL = Object.fromEntries(
  TIPOS_META.map((item) => [item.valor, item.nome])
) as Record<TipoMetaFinanceira, string>;

function hojeLocal(): string {
  const agora = new Date();
  return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}-${String(agora.getDate()).padStart(2, "0")}`;
}

function dadosSemId(meta: MetaFinanceira): NovaMetaFinanceira {
  return {
    nome: meta.nome,
    tipo: meta.tipo,
    valorAlvo: meta.valorAlvo,
    valorInicial: meta.valorInicial,
    dataAlvo: meta.dataAlvo,
    contaId: meta.contaId,
    cor: meta.cor,
    ativa: meta.ativa,
  };
}

function mesesAte(dataAlvo: string, hoje: string): number {
  if (!dataAlvo) return 0;
  const [anoAlvo, mesAlvo] = dataAlvo.slice(0, 7).split("-").map(Number);
  const [anoAtual, mesAtualNumero] = hoje.slice(0, 7).split("-").map(Number);
  return Math.max(0, (anoAlvo - anoAtual) * 12 + mesAlvo - mesAtualNumero + 1);
}

export default function GoalsPanel({
  metas,
  movimentos,
  transacoes,
  contas,
  saldosContas,
  onAdd,
  onUpdate,
  onDelete,
  onAddMovement,
  onDeleteMovement,
}: GoalsPanelProps) {
  const hoje = hojeLocal();
  const competenciaAtual = mesAtual();
  const [formAberto, setFormAberto] = useState(false);
  const [editing, setEditing] = useState<MetaFinanceira | null>(null);
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState<TipoMetaFinanceira>("reserva");
  const [valorAlvo, setValorAlvo] = useState("");
  const [valorInicial, setValorInicial] = useState("");
  const [dataAlvo, setDataAlvo] = useState("");
  const [contaId, setContaId] = useState("");
  const [cor, setCor] = useState("#2f7a4f");
  const [ativa, setAtiva] = useState(true);
  const [movementMeta, setMovementMeta] = useState<MetaFinanceira | null>(null);
  const [movementType, setMovementType] = useState<"aporte" | "retirada">("aporte");
  const [movementValue, setMovementValue] = useState("");
  const [movementDate, setMovementDate] = useState(hoje);
  const [movementDescription, setMovementDescription] = useState("");
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [salvando, setSalvando] = useState(false);

  const contasMap = useMemo(
    () => new Map(contas.map((conta) => [conta.id, conta])),
    [contas]
  );
  const metasMap = useMemo(
    () => new Map(metas.map((meta) => [meta.id, meta])),
    [metas]
  );

  const movimentosPorMeta = useMemo(() => {
    const porMeta = new Map<string, MovimentoMeta[]>();
    movimentos.forEach((movimento) => {
      const lista = porMeta.get(movimento.metaId) ?? [];
      lista.push(movimento);
      porMeta.set(movimento.metaId, lista);
    });
    return porMeta;
  }, [movimentos]);

  const valoresAtuais = useMemo(() => {
    return new Map(
      metas.map((meta) => [
        meta.id,
        meta.valorInicial + (movimentosPorMeta.get(meta.id) ?? []).reduce(
          (total, movimento) => total + (movimento.valor || 0),
          0
        ),
      ])
    );
  }, [metas, movimentosPorMeta]);

  const mediaDespesas = useMemo(() => {
    const meses = Array.from(
      { length: 3 },
      (_, indice) => adicionarMesesAoMes(competenciaAtual, -(indice + 1))
    );
    const totais = new Map(meses.map((mes) => [mes, 0]));
    transacoes.forEach((transacao) => {
      const mes = mesDe(transacao.data);
      if (tipoDe(transacao) !== "despesa" || !totais.has(mes)) return;
      totais.set(mes, (totais.get(mes) ?? 0) + (transacao.valor || 0));
    });
    return meses.reduce((total, mes) => total + (totais.get(mes) ?? 0), 0) / meses.length;
  }, [competenciaAtual, transacoes]);

  const reservaSugerida = mediaDespesas * 6;
  const resumo = useMemo(() => {
    return metas.reduce(
      (total, meta) => {
        if (!meta.ativa) return total;
        const atual = valoresAtuais.get(meta.id) ?? meta.valorInicial;
        total.alvo += meta.valorAlvo;
        total.guardado += atual;
        total.ativas += 1;
        if (atual >= meta.valorAlvo) total.concluidas += 1;
        return total;
      },
      { alvo: 0, guardado: 0, ativas: 0, concluidas: 0 }
    );
  }, [metas, valoresAtuais]);

  function abrirNova(tipoInicial: TipoMetaFinanceira = "outro") {
    setEditing(null);
    setNome(tipoInicial === "reserva" ? "Reserva de emergência" : "");
    setTipo(tipoInicial);
    setValorAlvo(tipoInicial === "reserva" && reservaSugerida > 0 ? reservaSugerida.toFixed(2) : "");
    setValorInicial("");
    setDataAlvo("");
    setContaId("");
    setCor(tipoInicial === "reserva" ? "#2f7a4f" : "#5b4fc4");
    setAtiva(true);
    setErro("");
    setMensagem("");
    setFormAberto(true);
  }

  function abrirEdicao(meta: MetaFinanceira) {
    setEditing(meta);
    setNome(meta.nome);
    setTipo(meta.tipo);
    setValorAlvo(String(meta.valorAlvo));
    setValorInicial(String(meta.valorInicial));
    setDataAlvo(meta.dataAlvo ?? "");
    setContaId(meta.contaId ?? "");
    setCor(meta.cor);
    setAtiva(meta.ativa);
    setErro("");
    setMensagem("");
    setFormAberto(true);
  }

  function fecharForm() {
    setEditing(null);
    setFormAberto(false);
    setErro("");
  }

  async function salvarMeta(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const alvo = Number(valorAlvo.replace(",", "."));
    const inicial = Number(valorInicial.replace(",", ".")) || 0;
    if (!nome.trim() || !Number.isFinite(alvo) || alvo <= 0 || inicial < 0) {
      setErro("Informe um nome, um valor-alvo maior que zero e um valor inicial válido.");
      return;
    }
    if (dataAlvo && dataAlvo < hoje) {
      setErro("A data-alvo precisa ser hoje ou uma data futura.");
      return;
    }
    const dados: NovaMetaFinanceira = {
      nome: nome.trim(),
      tipo,
      valorAlvo: alvo,
      valorInicial: inicial,
      dataAlvo,
      contaId,
      cor,
      ativa,
    };
    try {
      setSalvando(true);
      if (editing) await onUpdate(editing.id, dados);
      else await onAdd(dados);
      fecharForm();
      setMensagem("Meta salva com sucesso.");
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível salvar a meta.");
    } finally {
      setSalvando(false);
    }
  }

  function abrirMovimento(meta: MetaFinanceira, movimento: "aporte" | "retirada") {
    setMovementMeta(meta);
    setMovementType(movimento);
    setMovementValue("");
    setMovementDate(hoje);
    setMovementDescription("");
    setErro("");
    setMensagem("");
  }

  function fecharMovimento() {
    setMovementMeta(null);
    setMovementValue("");
    setErro("");
  }

  async function salvarMovimento(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!movementMeta) return;
    const valorNumero = Number(movementValue.replace(",", "."));
    const atual = valoresAtuais.get(movementMeta.id) ?? movementMeta.valorInicial;
    if (!Number.isFinite(valorNumero) || valorNumero <= 0 || !movementDate) {
      setErro("Informe uma data e um valor maior que zero.");
      return;
    }
    if (movementType === "retirada" && valorNumero > atual) {
      setErro("A retirada não pode ser maior que o valor reservado.");
      return;
    }
    try {
      setSalvando(true);
      await onAddMovement({
        metaId: movementMeta.id,
        data: movementDate,
        valor: movementType === "aporte" ? valorNumero : -valorNumero,
        descricao: movementDescription.trim() || (movementType === "aporte" ? "Aporte" : "Retirada"),
      });
      fecharMovimento();
      setMensagem(`${movementType === "aporte" ? "Aporte" : "Retirada"} registrado(a).`);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível registrar o movimento.");
    } finally {
      setSalvando(false);
    }
  }

  async function alternarMeta(meta: MetaFinanceira) {
    try {
      await onUpdate(meta.id, { ...dadosSemId(meta), ativa: !meta.ativa });
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível alterar a meta.");
    }
  }

  async function excluirMeta(meta: MetaFinanceira) {
    const possuiMovimentos = (movimentosPorMeta.get(meta.id)?.length ?? 0) > 0;
    if (possuiMovimentos) {
      setErro("Exclua primeiro o histórico de aportes e retiradas desta meta.");
      return;
    }
    if (!confirm(`Excluir a meta “${meta.nome}”?`)) return;
    try {
      await onDelete(meta.id);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível excluir a meta.");
    }
  }

  async function excluirMovimento(movimento: MovimentoMeta) {
    if (!confirm(`Excluir “${movimento.descricao}” do histórico?`)) return;
    try {
      await onDeleteMovement(movimento.id);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível excluir o movimento.");
    }
  }

  return (
    <div className="panel goals-panel">
      <div className="panel-title-row goals-heading">
        <div>
          <h2>Metas financeiras</h2>
          <p>Organize reservas e objetivos sem duplicar movimentações bancárias.</p>
        </div>
        <button type="button" onClick={() => abrirNova()}>Nova meta</button>
      </div>

      <div className="goals-summary">
        <div><span>Total guardado</span><strong>{fmtMoeda(resumo.guardado)}</strong></div>
        <div><span>Objetivo total</span><strong>{fmtMoeda(resumo.alvo)}</strong></div>
        <div><span>Metas ativas</span><strong>{resumo.ativas}</strong></div>
        <div><span>Concluídas</span><strong className="positive">{resumo.concluidas}</strong></div>
      </div>

      <div className="emergency-insight">
        <div className="emergency-insight-main">
          <span>Reserva de emergência sugerida</span>
          <strong>{mediaDespesas > 0 ? fmtMoeda(reservaSugerida) : "Aguardando histórico"}</strong>
          <small>{mediaDespesas > 0 ? `6 meses da média de despesas (${fmtMoeda(mediaDespesas)}/mês)` : "São necessários três meses anteriores de despesas para calcular."}</small>
        </div>
        {!metas.some((meta) => meta.tipo === "reserva") ? (
          <button type="button" className="secondary" onClick={() => abrirNova("reserva")}>Criar reserva sugerida</button>
        ) : null}
      </div>

      {erro ? <div className="goals-message error" role="alert">{erro}</div> : null}
      {mensagem ? <div className="goals-message success" role="status">{mensagem}</div> : null}

      {formAberto ? (
        <form className="goal-form" onSubmit={salvarMeta}>
          <div className="span2">
            <label htmlFor="goal-name">Nome da meta</label>
            <input id="goal-name" value={nome} onChange={(event) => setNome(event.target.value)} placeholder="Ex: Reserva, viagem, carro" autoFocus />
          </div>
          <div>
            <label htmlFor="goal-type">Tipo</label>
            <select id="goal-type" value={tipo} onChange={(event) => setTipo(event.target.value as TipoMetaFinanceira)}>
              {TIPOS_META.map((item) => <option key={item.valor} value={item.valor}>{item.nome}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="goal-target">Valor-alvo</label>
            <input id="goal-target" type="number" min="0.01" step="0.01" value={valorAlvo} onChange={(event) => setValorAlvo(event.target.value)} />
          </div>
          <div>
            <label htmlFor="goal-initial">Já reservado</label>
            <input id="goal-initial" type="number" min="0" step="0.01" value={valorInicial} onChange={(event) => setValorInicial(event.target.value)} />
          </div>
          <div>
            <label htmlFor="goal-date">Data-alvo opcional</label>
            <input id="goal-date" type="date" min={hoje} value={dataAlvo} onChange={(event) => setDataAlvo(event.target.value)} />
          </div>
          <div>
            <label htmlFor="goal-account">Conta de referência</label>
            <select id="goal-account" value={contaId} onChange={(event) => setContaId(event.target.value)}>
              <option value="">Sem vínculo</option>
              {contas.filter((conta) => conta.ativa || conta.id === contaId).map((conta) => <option key={conta.id} value={conta.id}>{conta.nome}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="goal-color">Cor</label>
            <input id="goal-color" className="color-input" type="color" value={cor} onChange={(event) => setCor(event.target.value)} />
          </div>
          <label className="goal-active"><input type="checkbox" checked={ativa} onChange={(event) => setAtiva(event.target.checked)} /> Meta ativa</label>
          <div className="goal-form-actions">
            <button type="button" className="secondary" onClick={fecharForm}>Cancelar</button>
            <button type="submit" disabled={salvando}>{salvando ? "Salvando…" : "Salvar meta"}</button>
          </div>
        </form>
      ) : null}

      {movementMeta ? (
        <form className="goal-movement-form" onSubmit={salvarMovimento}>
          <div className="goal-movement-heading"><strong>{movementType === "aporte" ? "Novo aporte" : "Nova retirada"} · {movementMeta.nome}</strong><span>Esse registro não movimenta novamente o saldo da conta.</span></div>
          <div>
            <label htmlFor="goal-movement-date">Data</label>
            <input id="goal-movement-date" type="date" value={movementDate} onChange={(event) => setMovementDate(event.target.value)} />
          </div>
          <div>
            <label htmlFor="goal-movement-value">Valor</label>
            <input id="goal-movement-value" type="number" min="0.01" step="0.01" value={movementValue} onChange={(event) => setMovementValue(event.target.value)} autoFocus />
          </div>
          <div>
            <label htmlFor="goal-movement-description">Observação</label>
            <input id="goal-movement-description" value={movementDescription} onChange={(event) => setMovementDescription(event.target.value)} placeholder="Ex: Aporte mensal" />
          </div>
          <div className="goal-movement-actions"><button type="button" className="secondary" onClick={fecharMovimento}>Cancelar</button><button type="submit" disabled={salvando}>Confirmar</button></div>
        </form>
      ) : null}

      {metas.length ? (
        <div className="goals-grid">
          {metas.map((meta) => {
            const atual = valoresAtuais.get(meta.id) ?? meta.valorInicial;
            const percentual = meta.valorAlvo > 0 ? (atual / meta.valorAlvo) * 100 : 0;
            const restante = Math.max(0, meta.valorAlvo - atual);
            const mesesRestantes = meta.dataAlvo ? mesesAte(meta.dataAlvo, hoje) : 0;
            const necessarioMensal = mesesRestantes > 0 ? restante / mesesRestantes : 0;
            const mesesCobertos = meta.tipo === "reserva" && mediaDespesas > 0 ? atual / mediaDespesas : 0;
            const conta = meta.contaId ? contasMap.get(meta.contaId) : undefined;
            const saldoConta = conta ? saldosContas[conta.id] ?? 0 : 0;
            const movimentosDaMeta = movimentosPorMeta.get(meta.id) ?? [];
            return (
              <article className={`goal-card${meta.ativa ? "" : " inactive"}`} key={meta.id} style={{ borderTopColor: meta.cor }}>
                <div className="goal-card-head"><div><span>{TIPOS_META_LABEL[meta.tipo]}</span><h3>{meta.nome}</h3></div><strong>{Math.round(percentual)}%</strong></div>
                <div className="goal-progress" role="progressbar" aria-label={`Progresso de ${meta.nome}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(Math.min(100, percentual))}><span style={{ width: `${Math.min(100, percentual)}%`, backgroundColor: meta.cor }} /></div>
                <div className="goal-values"><div><span>Guardado</span><strong>{fmtMoeda(atual)}</strong></div><div><span>Meta</span><strong>{fmtMoeda(meta.valorAlvo)}</strong></div><div><span>Falta</span><strong>{fmtMoeda(restante)}</strong></div></div>
                {meta.tipo === "reserva" ? <p className="goal-insight">Sua reserva cobre <strong>{mesesCobertos.toFixed(1)} meses</strong> da média de despesas.</p> : null}
                {meta.dataAlvo && restante > 0 ? <p className="goal-insight">Até {new Date(`${meta.dataAlvo}T12:00:00`).toLocaleDateString("pt-BR")}: reserve <strong>{fmtMoeda(necessarioMensal)}/mês</strong>.</p> : null}
                {conta ? <p className={`goal-account${atual > saldoConta ? " warning" : ""}`}>Em {conta.nome}: saldo de {fmtMoeda(saldoConta)}{atual > saldoConta ? " · valor reservado acima do saldo" : ""}</p> : null}
                {atual >= meta.valorAlvo ? <span className="goal-complete">Meta concluída</span> : null}
                <div className="goal-card-actions">
                  <button type="button" disabled={!meta.ativa} onClick={() => abrirMovimento(meta, "aporte")}>Aportar</button>
                  <button type="button" className="secondary" disabled={!meta.ativa || atual <= 0} onClick={() => abrirMovimento(meta, "retirada")}>Retirar</button>
                  <button type="button" className="link" onClick={() => abrirEdicao(meta)}>Editar</button>
                  <button type="button" className="link" onClick={() => alternarMeta(meta)}>{meta.ativa ? "Arquivar" : "Ativar"}</button>
                  <button type="button" className="link danger" disabled={movimentosDaMeta.length > 0} title={movimentosDaMeta.length ? "Exclua primeiro o histórico da meta" : "Excluir meta"} onClick={() => excluirMeta(meta)}>Excluir</button>
                </div>
              </article>
            );
          })}
        </div>
      ) : <div className="goals-empty"><strong>Nenhuma meta financeira criada.</strong><span>Comece pela reserva de emergência ou por um objetivo da família.</span></div>}

      {movimentos.length ? (
        <div className="goal-history">
          <h3>Movimentações recentes</h3>
          <div className="goal-history-list">
            {movimentos.slice(0, 8).map((movimento) => {
              const meta = metasMap.get(movimento.metaId);
              return (
                <div className="goal-history-row" key={movimento.id}><div><strong>{movimento.descricao}</strong><span>{meta?.nome ?? "Meta removida"} · {movimento.data.split("-").reverse().join("/")}</span></div><strong className={movimento.valor >= 0 ? "positive" : "negative"}>{movimento.valor >= 0 ? "+" : "−"}{fmtMoeda(Math.abs(movimento.valor))}</strong><button type="button" className="link danger" onClick={() => excluirMovimento(movimento)}>Excluir</button></div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
