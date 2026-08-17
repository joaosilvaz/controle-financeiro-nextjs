"use client";

import { useMemo, useState, type FormEvent } from "react";
import {
  fmtMoeda,
  mesDe,
  mesLabel,
} from "@/src/lib/categories";
import { useCategoryCatalog } from "@/src/components/CategoryCatalogProvider";
import {
  adicionarMesesAoMes,
  criarTransacaoRecorrente,
  mesAtual,
  recorrenciaVigenteNoMes,
  tipoDe,
} from "@/src/lib/finance";
import type {
  CartaoCredito,
  ContaFinanceira,
  NovaRecorrenciaFinanceira,
  NovaTransacao,
  RecorrenciaFinanceira,
  TipoRecorrencia,
  Transacao,
} from "@/src/lib/types";

type OcorrenciaPendente = {
  recorrenciaId: string;
  competencia: string;
  dados: NovaTransacao;
};

type RecurringPanelProps = {
  recorrencias: RecorrenciaFinanceira[];
  transacoes: Transacao[];
  contas: ContaFinanceira[];
  cartoes: CartaoCredito[];
  pessoas: string[];
  saldoAtual: number;
  onAdd: (dados: NovaRecorrenciaFinanceira) => Promise<unknown>;
  onUpdate: (id: string, dados: NovaRecorrenciaFinanceira) => Promise<unknown>;
  onDelete: (id: string) => Promise<unknown>;
  onGenerate: (itens: OcorrenciaPendente[]) => Promise<unknown>;
};

function dadosSemId(recorrencia: RecorrenciaFinanceira): NovaRecorrenciaFinanceira {
  return {
    descricao: recorrencia.descricao,
    categoria: recorrencia.categoria,
    pessoa: recorrencia.pessoa,
    valor: recorrencia.valor,
    tipo: recorrencia.tipo,
    diaVencimento: recorrencia.diaVencimento,
    inicioMes: recorrencia.inicioMes,
    fimMes: recorrencia.fimMes,
    contaId: recorrencia.contaId,
    cartaoId: recorrencia.cartaoId,
    cartao: recorrencia.cartao,
    ativa: recorrencia.ativa,
  };
}

export default function RecurringPanel({
  recorrencias,
  transacoes,
  contas,
  cartoes,
  pessoas,
  saldoAtual,
  onAdd,
  onUpdate,
  onDelete,
  onGenerate,
}: RecurringPanelProps) {
  const { despesas: categoriasDespesa, receitas: categoriasReceita, cores: coresCategorias } = useCategoryCatalog();
  const categoriasPorTipo = (tipoSelecionado: TipoRecorrencia) =>
    tipoSelecionado === "receita" ? categoriasReceita : categoriasDespesa;
  const competenciaAtual = mesAtual();
  const hoje = new Date().toISOString().slice(0, 10);
  const [formAberto, setFormAberto] = useState(false);
  const [editing, setEditing] = useState<RecorrenciaFinanceira | null>(null);
  const [tipo, setTipo] = useState<TipoRecorrencia>("despesa");
  const [descricao, setDescricao] = useState("");
  const [categoria, setCategoria] = useState(categoriasDespesa[0].nome);
  const [valor, setValor] = useState("");
  const [diaVencimento, setDiaVencimento] = useState("10");
  const [inicioMes, setInicioMes] = useState(competenciaAtual);
  const [fimMes, setFimMes] = useState("");
  const [pagamento, setPagamento] = useState("");
  const [pessoa, setPessoa] = useState(pessoas[0] ?? "");
  const [ativa, setAtiva] = useState(true);
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [salvando, setSalvando] = useState(false);
  const categoriasAtuaisBase = categoriasPorTipo(tipo);
  const categoriasAtuais = categoria && !categoriasAtuaisBase.some((item) => item.nome === categoria)
    ? [...categoriasAtuaisBase, { nome: categoria, cor: coresCategorias[categoria] ?? "#5b636e" }]
    : categoriasAtuaisBase;

  const contasMap = useMemo(
    () => new Map(contas.map((conta) => [conta.id, conta])),
    [contas]
  );
  const cartoesMap = useMemo(
    () => new Map(cartoes.map((cartao) => [cartao.id, cartao])),
    [cartoes]
  );
  const ocorrenciasExistentes = useMemo(
    () =>
      new Set(
        transacoes
          .filter((transacao) => transacao.recorrenciaId && transacao.competenciaRecorrencia)
          .map(
            (transacao) =>
              `${transacao.recorrenciaId}::${transacao.competenciaRecorrencia}`
          )
      ),
    [transacoes]
  );

  const mesesPrevisao = useMemo(
    () => Array.from({ length: 6 }, (_, indice) => adicionarMesesAoMes(competenciaAtual, indice)),
    [competenciaAtual]
  );

  const previsao = useMemo(() => {
    const linhas = mesesPrevisao.map((mes) => ({ mes, receitas: 0, despesas: 0 }));
    const linhasMap = new Map(linhas.map((linha) => [linha.mes, linha]));

    transacoes.forEach((transacao) => {
      const mes = mesDe(transacao.data);
      const linha = linhasMap.get(mes);
      const tipo = tipoDe(transacao);
      if (!linha || tipo === "transferencia") return;
      if (mes === competenciaAtual && transacao.data <= hoje) return;
      if (tipo === "receita") linha.receitas += transacao.valor || 0;
      else linha.despesas += transacao.valor || 0;
    });

    recorrencias.forEach((recorrencia) => {
      mesesPrevisao.forEach((mes) => {
        if (!recorrenciaVigenteNoMes(recorrencia, mes)) return;
        if (ocorrenciasExistentes.has(`${recorrencia.id}::${mes}`)) return;
        const linha = linhasMap.get(mes);
        if (!linha) return;
        if (recorrencia.tipo === "receita") linha.receitas += recorrencia.valor || 0;
        else linha.despesas += recorrencia.valor || 0;
      });
    });

    let saldoProjetado = saldoAtual;
    return linhas.map((linha) => {
      const resultado = linha.receitas - linha.despesas;
      saldoProjetado += resultado;
      return { ...linha, resultado, saldoProjetado };
    });
  }, [competenciaAtual, hoje, mesesPrevisao, ocorrenciasExistentes, recorrencias, saldoAtual, transacoes]);

  const resumoFixo = useMemo(() => {
    return recorrencias.reduce(
      (totais, recorrencia) => {
        if (!recorrenciaVigenteNoMes(recorrencia, competenciaAtual)) return totais;
        if (recorrencia.tipo === "receita") totais.receitas += recorrencia.valor || 0;
        else totais.despesas += recorrencia.valor || 0;
        return totais;
      },
      { receitas: 0, despesas: 0 }
    );
  }, [competenciaAtual, recorrencias]);

  const ocorrenciasPendentes = useMemo(() => {
    const meses = Array.from(
      { length: 3 },
      (_, indice) => adicionarMesesAoMes(competenciaAtual, indice)
    );
    const pendentes: OcorrenciaPendente[] = [];

    recorrencias.forEach((recorrencia) => {
      meses.forEach((competencia) => {
        if (!recorrenciaVigenteNoMes(recorrencia, competencia)) return;
        if (ocorrenciasExistentes.has(`${recorrencia.id}::${competencia}`)) return;
        pendentes.push({
          recorrenciaId: recorrencia.id,
          competencia,
          dados: criarTransacaoRecorrente(
            recorrencia,
            competencia,
            recorrencia.cartaoId ? cartoesMap.get(recorrencia.cartaoId) : undefined
          ),
        });
      });
    });
    return pendentes;
  }, [cartoesMap, competenciaAtual, ocorrenciasExistentes, recorrencias]);

  function abrirNovo() {
    setEditing(null);
    setTipo("despesa");
    setDescricao("");
    setCategoria(categoriasDespesa[0].nome);
    setValor("");
    setDiaVencimento("10");
    setInicioMes(competenciaAtual);
    setFimMes("");
    setPagamento("");
    setPessoa(pessoas[0] ?? "");
    setAtiva(true);
    setErro("");
    setMensagem("");
    setFormAberto(true);
  }

  function abrirEdicao(recorrencia: RecorrenciaFinanceira) {
    setEditing(recorrencia);
    setTipo(recorrencia.tipo);
    setDescricao(recorrencia.descricao);
    setCategoria(recorrencia.categoria);
    setValor(String(recorrencia.valor));
    setDiaVencimento(String(recorrencia.diaVencimento));
    setInicioMes(recorrencia.inicioMes);
    setFimMes(recorrencia.fimMes ?? "");
    setPagamento(
      recorrencia.cartaoId
        ? `cartao:${recorrencia.cartaoId}`
        : recorrencia.contaId
          ? `conta:${recorrencia.contaId}`
          : ""
    );
    setPessoa(recorrencia.pessoa);
    setAtiva(recorrencia.ativa);
    setErro("");
    setMensagem("");
    setFormAberto(true);
  }

  function fecharForm() {
    setEditing(null);
    setErro("");
    setFormAberto(false);
  }

  function alterarTipo(novoTipo: TipoRecorrencia) {
    setTipo(novoTipo);
    setCategoria(categoriasPorTipo(novoTipo)[0].nome);
    if (novoTipo === "receita" && pagamento.startsWith("cartao:")) setPagamento("");
  }

  async function salvar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const valorNumero = Number(valor.replace(",", "."));
    const diaNumero = Number(diaVencimento);
    if (!descricao.trim() || !Number.isFinite(valorNumero) || valorNumero <= 0) {
      setErro("Informe uma descrição e um valor maior que zero.");
      return;
    }
    if (diaNumero < 1 || diaNumero > 31) {
      setErro("O dia precisa ficar entre 1 e 31.");
      return;
    }
    if (!inicioMes || (fimMes && fimMes < inicioMes)) {
      setErro("Confira o período de início e término da recorrência.");
      return;
    }

    const [origem, origemId] = pagamento.split(":");
    const cartao = origem === "cartao" ? cartoesMap.get(origemId) : undefined;
    const dados: NovaRecorrenciaFinanceira = {
      descricao: descricao.trim(),
      categoria,
      pessoa,
      valor: valorNumero,
      tipo,
      diaVencimento: diaNumero,
      inicioMes,
      fimMes,
      contaId: origem === "conta" ? origemId : "",
      cartaoId: origem === "cartao" ? origemId : "",
      cartao: cartao?.nome ?? "",
      ativa,
    };

    try {
      setSalvando(true);
      if (editing) await onUpdate(editing.id, dados);
      else await onAdd(dados);
      fecharForm();
      setMensagem("Recorrência salva. Gere as ocorrências pendentes quando desejar.");
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível salvar a recorrência.");
    } finally {
      setSalvando(false);
    }
  }

  async function alternarAtiva(recorrencia: RecorrenciaFinanceira) {
    try {
      await onUpdate(recorrencia.id, {
        ...dadosSemId(recorrencia),
        ativa: !recorrencia.ativa,
      });
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível alterar a recorrência.");
    }
  }

  async function excluir(recorrencia: RecorrenciaFinanceira) {
    if (!confirm(`Excluir a recorrência “${recorrencia.descricao}”? Os lançamentos já gerados serão mantidos.`)) return;
    try {
      await onDelete(recorrencia.id);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível excluir a recorrência.");
    }
  }

  async function gerarPendentes() {
    if (!ocorrenciasPendentes.length) return;
    try {
      setSalvando(true);
      setErro("");
      await onGenerate(ocorrenciasPendentes);
      setMensagem(`${ocorrenciasPendentes.length} lançamento(s) recorrente(s) gerado(s) sem duplicação.`);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível gerar os lançamentos.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="panel recurring-panel">
      <div className="panel-title-row recurring-heading">
        <div>
          <h2>Recorrências e previsão</h2>
          <p>Automatize contas fixas e antecipe o resultado dos próximos seis meses.</p>
        </div>
        <div className="recurring-heading-actions">
          <button type="button" className="secondary" onClick={gerarPendentes} disabled={!ocorrenciasPendentes.length || salvando}>
            Gerar próximos 3 meses ({ocorrenciasPendentes.length})
          </button>
          <button type="button" onClick={abrirNovo}>Nova recorrência</button>
        </div>
      </div>

      <div className="recurring-summary">
        <div><span>Receitas fixas/mês</span><strong className="positive">{fmtMoeda(resumoFixo.receitas)}</strong></div>
        <div><span>Despesas fixas/mês</span><strong className="negative">{fmtMoeda(resumoFixo.despesas)}</strong></div>
        <div><span>Resultado fixo</span><strong className={resumoFixo.receitas - resumoFixo.despesas < 0 ? "negative" : "positive"}>{fmtMoeda(resumoFixo.receitas - resumoFixo.despesas)}</strong></div>
        <div><span>Pendentes</span><strong>{ocorrenciasPendentes.length}</strong></div>
      </div>

      {erro ? <div className="recurring-message error" role="alert">{erro}</div> : null}
      {mensagem ? <div className="recurring-message success" role="status">{mensagem}</div> : null}

      {formAberto ? (
        <form className="recurring-form" onSubmit={salvar}>
          <div>
            <label htmlFor="recurring-type">Tipo</label>
            <select id="recurring-type" value={tipo} onChange={(event) => alterarTipo(event.target.value as TipoRecorrencia)}>
              <option value="despesa">Despesa</option>
              <option value="receita">Receita</option>
            </select>
          </div>
          <div className="span2">
            <label htmlFor="recurring-description">Descrição</label>
            <input id="recurring-description" value={descricao} onChange={(event) => setDescricao(event.target.value)} placeholder="Ex: Aluguel, salário, Netflix" autoFocus />
          </div>
          <div>
            <label htmlFor="recurring-value">Valor (R$)</label>
            <input id="recurring-value" type="number" min="0.01" step="0.01" value={valor} onChange={(event) => setValor(event.target.value)} />
          </div>
          <div>
            <label htmlFor="recurring-day">Dia</label>
            <input id="recurring-day" type="number" min="1" max="31" value={diaVencimento} onChange={(event) => setDiaVencimento(event.target.value)} />
          </div>
          <div>
            <label htmlFor="recurring-category">Categoria</label>
            <select id="recurring-category" value={categoria} onChange={(event) => setCategoria(event.target.value)}>
              {categoriasAtuais.map((item) => <option key={item.nome}>{item.nome}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="recurring-payment">{tipo === "receita" ? "Conta de entrada" : "Pagamento"}</label>
            <select id="recurring-payment" value={pagamento} onChange={(event) => setPagamento(event.target.value)}>
              <option value="">Sem vínculo</option>
              <optgroup label="Contas">
                {contas.filter((conta) => conta.ativa || `conta:${conta.id}` === pagamento).map((conta) => (
                  <option key={conta.id} value={`conta:${conta.id}`}>{conta.nome}</option>
                ))}
              </optgroup>
              {tipo === "despesa" ? (
                <optgroup label="Cartões">
                  {cartoes.filter((cartao) => cartao.ativo || `cartao:${cartao.id}` === pagamento).map((cartao) => (
                    <option key={cartao.id} value={`cartao:${cartao.id}`}>{cartao.nome}</option>
                  ))}
                </optgroup>
              ) : null}
            </select>
          </div>
          <div>
            <label htmlFor="recurring-person">Pessoa</label>
            <select id="recurring-person" value={pessoa} onChange={(event) => setPessoa(event.target.value)}>
              {pessoas.map((nome) => <option key={nome}>{nome}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="recurring-start">Início</label>
            <input id="recurring-start" type="month" value={inicioMes} onChange={(event) => setInicioMes(event.target.value)} />
          </div>
          <div>
            <label htmlFor="recurring-end">Término opcional</label>
            <input id="recurring-end" type="month" value={fimMes} onChange={(event) => setFimMes(event.target.value)} />
          </div>
          <label className="recurring-active">
            <input type="checkbox" checked={ativa} onChange={(event) => setAtiva(event.target.checked)} />
            Recorrência ativa
          </label>
          <div className="recurring-form-actions">
            <button type="button" className="secondary" onClick={fecharForm}>Cancelar</button>
            <button type="submit" disabled={salvando}>{salvando ? "Salvando…" : "Salvar recorrência"}</button>
          </div>
        </form>
      ) : null}

      <div className="recurring-layout">
        <div>
          <h3 className="subsection-title">Modelos recorrentes</h3>
          {recorrencias.length ? (
            <div className="recurring-list">
              {recorrencias.map((recorrencia) => {
                const origem = recorrencia.cartaoId
                  ? cartoesMap.get(recorrencia.cartaoId)?.nome ?? recorrencia.cartao ?? "Cartão"
                  : recorrencia.contaId
                    ? contasMap.get(recorrencia.contaId)?.nome ?? "Conta"
                    : "Sem vínculo";
                return (
                  <article className={`recurring-item${recorrencia.ativa ? "" : " inactive"}`} key={recorrencia.id}>
                    <span className="recurring-dot" style={{ backgroundColor: coresCategorias[recorrencia.categoria] ?? "#5b636e" }} />
                    <div className="recurring-item-main">
                      <div><strong>{recorrencia.descricao}</strong><span>{recorrencia.categoria} · {origem}</span></div>
                      <small>Todo dia {recorrencia.diaVencimento} · desde {mesLabel(recorrencia.inicioMes)}{recorrencia.fimMes ? ` até ${mesLabel(recorrencia.fimMes)}` : ""}</small>
                    </div>
                    <strong className={recorrencia.tipo === "receita" ? "positive" : "negative"}>{recorrencia.tipo === "receita" ? "+" : "−"}{fmtMoeda(recorrencia.valor)}</strong>
                    <div className="recurring-item-actions">
                      <button type="button" className="link" onClick={() => alternarAtiva(recorrencia)}>{recorrencia.ativa ? "Pausar" : "Ativar"}</button>
                      <button type="button" className="link" onClick={() => abrirEdicao(recorrencia)}>Editar</button>
                      <button type="button" className="link danger" onClick={() => excluir(recorrencia)}>Excluir</button>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : <div className="recurring-empty">Nenhuma recorrência cadastrada.</div>}
        </div>

        <div>
          <h3 className="subsection-title">Fluxo de caixa previsto</h3>
          <div className="forecast-list">
            {previsao.map((linha) => (
              <article className="forecast-row" key={linha.mes}>
                <div className="forecast-month"><strong>{mesLabel(linha.mes)}</strong><span>Saldo {fmtMoeda(linha.saldoProjetado)}</span></div>
                <div className="forecast-values">
                  <span className="positive">+ {fmtMoeda(linha.receitas)}</span>
                  <span className="negative">− {fmtMoeda(linha.despesas)}</span>
                </div>
                <strong className={linha.resultado < 0 ? "negative" : "positive"}>{linha.resultado >= 0 ? "+" : "−"}{fmtMoeda(Math.abs(linha.resultado))}</strong>
              </article>
            ))}
          </div>
          <p className="forecast-note">A previsão soma lançamentos futuros e recorrências ainda não geradas, sem duplicar competências.</p>
        </div>
      </div>
    </div>
  );
}
