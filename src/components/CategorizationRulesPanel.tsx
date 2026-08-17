"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useCategoryCatalog } from "@/src/components/CategoryCatalogProvider";
import {
  contarCorrespondenciasRegra,
  encontrarRegraCategorizacao,
} from "@/src/lib/categorization-rules";
import type {
  NovaRegraCategorizacao,
  RegraCategorizacao,
  Transacao,
} from "@/src/lib/types";

const NOVA_REGRA: NovaRegraCategorizacao = {
  termo: "",
  correspondencia: "contem",
  tipo: "despesa",
  categoria: "Alimentação",
  renomearPara: "",
  ativa: true,
};

const CORRESPONDENCIA_LABEL = {
  contem: "contém",
  comeca: "começa com",
  exata: "é exatamente",
} as const;

export default function CategorizationRulesPanel({
  regras,
  transacoes,
  onAdd,
  onUpdate,
  onDelete,
  onApply,
}: {
  regras: RegraCategorizacao[];
  transacoes: Transacao[];
  onAdd: (dados: NovaRegraCategorizacao) => Promise<RegraCategorizacao>;
  onUpdate: (id: string, dados: NovaRegraCategorizacao) => Promise<unknown>;
  onDelete: (id: string) => Promise<unknown>;
  onApply: (regra: RegraCategorizacao) => Promise<number>;
}) {
  const { despesas: categoriasDespesa, receitas: categoriasReceita } = useCategoryCatalog();
  const [form, setForm] = useState<NovaRegraCategorizacao>(() => ({ ...NOVA_REGRA }));
  const [editingId, setEditingId] = useState("");
  const [aplicarHistorico, setAplicarHistorico] = useState(true);
  const [salvandoId, setSalvandoId] = useState("");
  const [mensagem, setMensagem] = useState<{ tipo: "success" | "error"; texto: string } | null>(null);

  const categoriasBase = form.tipo === "receita" ? categoriasReceita : categoriasDespesa;
  const categorias = !categoriasBase.some((categoria) => categoria.nome === form.categoria)
    ? [...categoriasBase, { nome: form.categoria, cor: "#5b636e" }]
    : categoriasBase;
  const regrasAtivas = regras.filter((regra) => regra.ativa).length;

  const correspondencias = useMemo(
    () => new Map(
      regras.map((regra) => [regra.id, contarCorrespondenciasRegra(regra, transacoes)])
    ),
    [regras, transacoes]
  );

  const transacoesAutomatizadas = useMemo(
    () => transacoes.filter((transacao) => Boolean(transacao.regraCategorizacaoId)).length,
    [transacoes]
  );
  const correspondenciasAtivas = useMemo(
    () => transacoes.filter((transacao) => Boolean(encontrarRegraCategorizacao(transacao, regras))).length,
    [regras, transacoes]
  );
  const salvandoFormulario = salvandoId === "nova" || Boolean(editingId && salvandoId === editingId);

  function alterarTipo(tipo: "despesa" | "receita") {
    const opcoes = tipo === "receita" ? categoriasReceita : categoriasDespesa;
    setForm((atual) => ({ ...atual, tipo, categoria: opcoes[0].nome }));
  }

  function limparFormulario() {
    setForm({ ...NOVA_REGRA, categoria: categoriasDespesa[0].nome });
    setEditingId("");
    setAplicarHistorico(true);
  }

  async function handleSubmit(evento: FormEvent) {
    evento.preventDefault();
    const termo = form.termo.trim();
    if (termo.length < 2) {
      setMensagem({ tipo: "error", texto: "Informe ao menos dois caracteres para a regra." });
      return;
    }

    const dados: NovaRegraCategorizacao = {
      ...form,
      termo,
      renomearPara: form.renomearPara?.trim() || "",
    };
    setSalvandoId(editingId || "nova");
    setMensagem(null);
    try {
      let regraSalva: RegraCategorizacao;
      if (editingId) {
        await onUpdate(editingId, dados);
        regraSalva = { id: editingId, ...dados };
      } else {
        regraSalva = await onAdd(dados);
      }

      const quantidade = aplicarHistorico && regraSalva.ativa
        ? await onApply(regraSalva)
        : 0;
      setMensagem({
        tipo: "success",
        texto: `${editingId ? "Regra atualizada" : "Regra criada"}.${quantidade ? ` ${quantidade} ${quantidade === 1 ? "lançamento foi atualizado" : "lançamentos foram atualizados"}.` : ""}`,
      });
      limparFormulario();
    } catch (erro) {
      setMensagem({
        tipo: "error",
        texto: `Não foi possível salvar: ${erro instanceof Error ? erro.message : String(erro)}`,
      });
    } finally {
      setSalvandoId("");
    }
  }

  function editar(regra: RegraCategorizacao) {
    setEditingId(regra.id);
    setForm({
      termo: regra.termo,
      correspondencia: regra.correspondencia,
      tipo: regra.tipo,
      categoria: regra.categoria,
      renomearPara: regra.renomearPara ?? "",
      ativa: regra.ativa,
    });
    setAplicarHistorico(false);
    setMensagem(null);
  }

  async function alternar(regra: RegraCategorizacao) {
    setSalvandoId(regra.id);
    setMensagem(null);
    try {
      const { id, ...dados } = regra;
      await onUpdate(id, { ...dados, ativa: !regra.ativa });
      setMensagem({ tipo: "success", texto: `Regra ${regra.ativa ? "pausada" : "ativada"}.` });
    } catch (erro) {
      setMensagem({ tipo: "error", texto: erro instanceof Error ? erro.message : String(erro) });
    } finally {
      setSalvandoId("");
    }
  }

  async function aplicar(regra: RegraCategorizacao) {
    const quantidadePrevista = correspondencias.get(regra.id) ?? 0;
    if (!quantidadePrevista || !regra.ativa) return;
    if (!confirm(`Aplicar esta regra a ${quantidadePrevista} lançamento(s) existente(s)?`)) return;
    setSalvandoId(regra.id);
    setMensagem(null);
    try {
      const quantidade = await onApply(regra);
      setMensagem({ tipo: "success", texto: `${quantidade} ${quantidade === 1 ? "lançamento atualizado" : "lançamentos atualizados"}.` });
    } catch (erro) {
      setMensagem({ tipo: "error", texto: erro instanceof Error ? erro.message : String(erro) });
    } finally {
      setSalvandoId("");
    }
  }

  async function excluir(regra: RegraCategorizacao) {
    if (!confirm(`Excluir a regra para “${regra.termo}”? Os lançamentos já categorizados não serão alterados.`)) return;
    setSalvandoId(regra.id);
    setMensagem(null);
    try {
      await onDelete(regra.id);
      if (editingId === regra.id) limparFormulario();
      setMensagem({ tipo: "success", texto: "Regra excluída." });
    } catch (erro) {
      setMensagem({ tipo: "error", texto: erro instanceof Error ? erro.message : String(erro) });
    } finally {
      setSalvandoId("");
    }
  }

  return (
    <div className="panel categorization-panel">
      <div className="panel-title-row categorization-heading">
        <div>
          <span className="categorization-eyebrow">Automação</span>
          <h2>Regras de categorização</h2>
          <p>Organize lançamentos repetidos automaticamente pela descrição.</p>
        </div>
        <div className="categorization-health">
          <strong>{regrasAtivas}</strong>
          <span>{regrasAtivas === 1 ? "regra ativa" : "regras ativas"}</span>
        </div>
      </div>

      <div className="categorization-summary">
        <div><span>Total de regras</span><strong>{regras.length}</strong></div>
        <div><span>Automatizados</span><strong>{transacoesAutomatizadas}</strong></div>
        <div><span>Correspondências atuais</span><strong>{correspondenciasAtivas}</strong></div>
      </div>

      <form className="categorization-form" onSubmit={handleSubmit}>
        <div className="categorization-form-title">
          <div>
            <strong>{editingId ? "Editar regra" : "Nova regra"}</strong>
            <span>Regras exatas têm prioridade sobre regras mais amplas.</span>
          </div>
          {editingId ? <button type="button" className="link" onClick={limparFormulario}>Cancelar edição</button> : null}
        </div>

        <div className="categorization-fields">
          <label>
            Tipo do lançamento
            <select value={form.tipo} onChange={(evento) => alterarTipo(evento.target.value as "despesa" | "receita")}>
              <option value="despesa">Despesa</option>
              <option value="receita">Receita</option>
            </select>
          </label>
          <label>
            Correspondência
            <select value={form.correspondencia} onChange={(evento) => setForm((atual) => ({ ...atual, correspondencia: evento.target.value as NovaRegraCategorizacao["correspondencia"] }))}>
              <option value="contem">Contém</option>
              <option value="comeca">Começa com</option>
              <option value="exata">É exatamente</option>
            </select>
          </label>
          <label className="span2">
            Texto encontrado na descrição
            <input value={form.termo} onChange={(evento) => setForm((atual) => ({ ...atual, termo: evento.target.value }))} placeholder="Ex.: IFD, iFood ou UBER" required />
          </label>
          <label>
            Categoria aplicada
            <select value={form.categoria} onChange={(evento) => setForm((atual) => ({ ...atual, categoria: evento.target.value }))}>
              {categorias.map((categoria) => <option value={categoria.nome} key={categoria.nome}>{categoria.nome}</option>)}
            </select>
          </label>
          <label>
            Padronizar nome <span className="optional">opcional</span>
            <input value={form.renomearPara ?? ""} onChange={(evento) => setForm((atual) => ({ ...atual, renomearPara: evento.target.value }))} placeholder="Ex.: iFood" />
          </label>
        </div>

        <div className="categorization-preview">
          <span>Prévia</span>
          <p>Se uma <strong>{form.tipo}</strong> {CORRESPONDENCIA_LABEL[form.correspondencia]} <strong>“{form.termo || "texto"}”</strong>, usar <strong>{form.categoria}</strong>{form.renomearPara ? <> e renomear para <strong>“{form.renomearPara}”</strong></> : null}.</p>
        </div>

        <div className="categorization-form-actions">
          <label className="categorization-checkbox">
            <input type="checkbox" checked={aplicarHistorico} onChange={(evento) => setAplicarHistorico(evento.target.checked)} />
            Aplicar também aos lançamentos existentes
          </label>
          <button type="submit" disabled={salvandoFormulario}>
            {salvandoFormulario ? "Salvando…" : editingId ? "Salvar alterações" : "Criar regra"}
          </button>
        </div>
      </form>

      {mensagem ? <div className={`categorization-message ${mensagem.tipo}`} role="status">{mensagem.texto}</div> : null}

      <div className="categorization-list-head">
        <div>
          <strong>Regras configuradas</strong>
          <span>As regras são aplicadas automaticamente aos próximos lançamentos.</span>
        </div>
      </div>

      {regras.length ? (
        <div className="categorization-list">
          {regras.map((regra) => {
            const quantidade = correspondencias.get(regra.id) ?? 0;
            return (
              <article className={`categorization-rule${regra.ativa ? "" : " inactive"}`} key={regra.id}>
                <div className="categorization-rule-main">
                  <div className="categorization-rule-topline">
                    <span className={regra.tipo}>{regra.tipo === "receita" ? "Receita" : "Despesa"}</span>
                    <span>{CORRESPONDENCIA_LABEL[regra.correspondencia]}</span>
                    <span>{quantidade} {quantidade === 1 ? "correspondência" : "correspondências"}</span>
                  </div>
                  <h3>“{regra.termo}” <span aria-hidden="true">→</span> {regra.categoria}</h3>
                  {regra.renomearPara ? <p>Padroniza a descrição como <strong>{regra.renomearPara}</strong>.</p> : <p>Mantém a descrição original do lançamento.</p>}
                </div>
                <div className="categorization-rule-actions">
                  <label className="rule-switch">
                    <input type="checkbox" role="switch" checked={regra.ativa} disabled={salvandoId === regra.id} onChange={() => alternar(regra)} />
                    <span>{regra.ativa ? "Ativa" : "Pausada"}</span>
                  </label>
                  <div>
                    <button type="button" className="secondary" disabled={!regra.ativa || !quantidade || salvandoId === regra.id} onClick={() => aplicar(regra)}>Aplicar agora</button>
                    <button type="button" className="secondary" disabled={salvandoId === regra.id} onClick={() => editar(regra)}>Editar</button>
                    <button type="button" className="danger-outline" disabled={salvandoId === regra.id} onClick={() => excluir(regra)}>Excluir</button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="categorization-empty">
          <strong>Nenhuma regra configurada</strong>
          <span>Crie a primeira regra para reduzir correções manuais após cada importação.</span>
        </div>
      )}

      <p className="categorization-disclaimer">Ao excluir ou pausar uma regra, os lançamentos já categorizados permanecem como estão.</p>
    </div>
  );
}
