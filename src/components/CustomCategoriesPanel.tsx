"use client";

import { useMemo, useState, type FormEvent } from "react";
import { CATEGORIAS } from "@/src/lib/categories";
import type {
  CategoriaPersonalizada,
  NovaCategoriaPersonalizada,
  OrcamentoMensal,
  RecorrenciaFinanceira,
  RegraCategorizacao,
  Transacao,
} from "@/src/lib/types";

const CORES_SUGERIDAS = ["#3568b8", "#2f7a4f", "#a8306e", "#8a6a2e", "#6f4fa8", "#b3453f"];
const GRUPOS_CATEGORIAS = [
  { tipo: "despesa" as const, titulo: "Despesas", descricao: "Categorias para saídas e gastos" },
  { tipo: "receita" as const, titulo: "Receitas", descricao: "Categorias para entradas e ganhos" },
];

function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export default function CustomCategoriesPanel({
  categorias,
  transacoes,
  orcamentos,
  recorrencias,
  regras,
  onAdd,
  onUpdate,
  onDelete,
}: {
  categorias: CategoriaPersonalizada[];
  transacoes: Transacao[];
  orcamentos: OrcamentoMensal[];
  recorrencias: RecorrenciaFinanceira[];
  regras: RegraCategorizacao[];
  onAdd: (dados: NovaCategoriaPersonalizada) => Promise<CategoriaPersonalizada>;
  onUpdate: (id: string, dados: NovaCategoriaPersonalizada) => Promise<unknown>;
  onDelete: (id: string) => Promise<unknown>;
}) {
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState<"despesa" | "receita">("despesa");
  const [cor, setCor] = useState(CORES_SUGERIDAS[0]);
  const [salvandoId, setSalvandoId] = useState("");
  const [abaAtiva, setAbaAtiva] = useState<"lista" | "nova">("lista");
  const [mensagem, setMensagem] = useState<{ tipo: "success" | "error"; texto: string } | null>(null);

  const usos = useMemo(() => {
    const contagem = new Map<string, number>();
    const registrar = (categoria: string) => {
      const chave = normalizar(categoria);
      contagem.set(chave, (contagem.get(chave) ?? 0) + 1);
    };
    transacoes.forEach((transacao) => registrar(transacao.categoria));
    orcamentos.forEach((orcamento) => registrar(orcamento.categoria));
    recorrencias.forEach((recorrencia) => registrar(recorrencia.categoria));
    regras.forEach((regra) => registrar(regra.categoria));
    return contagem;
  }, [orcamentos, recorrencias, regras, transacoes]);

  const nomesExistentes = useMemo(
    () => new Set([
      ...CATEGORIAS.map((categoria) => normalizar(categoria.nome)),
      ...categorias.map((categoria) => normalizar(categoria.nome)),
    ]),
    [categorias]
  );

  async function adicionar(evento: FormEvent) {
    evento.preventDefault();
    const nomeLimpo = nome.trim();
    if (nomeLimpo.length < 2) {
      setMensagem({ tipo: "error", texto: "Informe um nome com pelo menos dois caracteres." });
      return;
    }
    if (nomesExistentes.has(normalizar(nomeLimpo))) {
      setMensagem({ tipo: "error", texto: "Já existe uma categoria com esse nome." });
      return;
    }

    setSalvandoId("nova");
    setMensagem(null);
    try {
      await onAdd({ nome: nomeLimpo, tipo, cor, ativa: true });
      setNome("");
      setCor(CORES_SUGERIDAS[(categorias.length + 1) % CORES_SUGERIDAS.length]);
      setMensagem({ tipo: "success", texto: `Categoria “${nomeLimpo}” criada.` });
      setAbaAtiva("lista");
    } catch (erro) {
      setMensagem({ tipo: "error", texto: erro instanceof Error ? erro.message : String(erro) });
    } finally {
      setSalvandoId("");
    }
  }

  async function atualizar(
    categoria: CategoriaPersonalizada,
    alteracoes: Partial<NovaCategoriaPersonalizada>
  ) {
    setSalvandoId(categoria.id);
    setMensagem(null);
    try {
      const { id, ...dados } = categoria;
      await onUpdate(id, { ...dados, ...alteracoes });
      setMensagem({ tipo: "success", texto: "Categoria atualizada." });
    } catch (erro) {
      setMensagem({ tipo: "error", texto: erro instanceof Error ? erro.message : String(erro) });
    } finally {
      setSalvandoId("");
    }
  }

  async function excluir(categoria: CategoriaPersonalizada) {
    const quantidadeUsos = usos.get(normalizar(categoria.nome)) ?? 0;
    if (quantidadeUsos) return;
    if (!confirm(`Excluir a categoria “${categoria.nome}”?`)) return;
    setSalvandoId(categoria.id);
    setMensagem(null);
    try {
      await onDelete(categoria.id);
      setMensagem({ tipo: "success", texto: "Categoria excluída." });
    } catch (erro) {
      setMensagem({ tipo: "error", texto: erro instanceof Error ? erro.message : String(erro) });
    } finally {
      setSalvandoId("");
    }
  }

  const ativas = categorias.filter((categoria) => categoria.ativa).length;
  const emUso = categorias.filter((categoria) => (usos.get(normalizar(categoria.nome)) ?? 0) > 0).length;

  return (
    <div className="panel custom-categories-panel">
      <div className="panel-title-row custom-categories-heading">
        <div>
          <span className="custom-categories-eyebrow">Organização</span>
          <h2>Organização de categorias</h2>
          <p>Crie categorias próprias e escolha como elas aparecem nos seus lançamentos.</p>
        </div>
        <div className="custom-categories-count" aria-label={`${ativas} categorias ativas`}>
          <strong>{ativas}</strong>
          <span>categorias ativas</span>
        </div>
      </div>

      <div className="custom-categories-summary">
        <div><strong>{categorias.length}</strong><span>Personalizadas</span></div>
        <div><strong>{emUso}</strong><span>Em uso agora</span></div>
        <div><strong>{CATEGORIAS.length}</strong><span>Categorias padrão</span></div>
      </div>

      <div className="custom-category-tabs" role="tablist" aria-label="Seções de categorias">
        <button
          id="categorias-lista-tab"
          type="button"
          role="tab"
          className={abaAtiva === "lista" ? "active" : ""}
          aria-selected={abaAtiva === "lista"}
          aria-controls="categorias-lista-panel"
          onClick={() => {
            setAbaAtiva("lista");
            setMensagem(null);
          }}
        >
          <span>Minhas categorias</span>
          <strong>{categorias.length}</strong>
        </button>
        <button
          id="categorias-nova-tab"
          type="button"
          role="tab"
          className={abaAtiva === "nova" ? "active" : ""}
          aria-selected={abaAtiva === "nova"}
          aria-controls="categorias-nova-panel"
          onClick={() => {
            setAbaAtiva("nova");
            setMensagem(null);
          }}
        >
          <span aria-hidden="true">+</span>
          Nova categoria
        </button>
      </div>

      {mensagem ? <div className={`custom-category-message ${mensagem.tipo}`} role="status">{mensagem.texto}</div> : null}

      <div className="custom-category-tab-content">
        {abaAtiva === "nova" ? (
        <section
          id="categorias-nova-panel"
          className="custom-category-create"
          role="tabpanel"
          aria-labelledby="categorias-nova-tab"
        >
          <div className="custom-category-section-heading">
            <div>
              <h3 id="nova-categoria-titulo">Nova categoria</h3>
              <p>Defina o tipo, o nome e uma cor.</p>
            </div>
          </div>

          <form className="custom-category-form" onSubmit={adicionar}>
            <fieldset className="custom-category-type-field">
              <legend>Tipo da categoria</legend>
              <div className="custom-category-type-options">
                <label className={tipo === "despesa" ? "selected" : ""}>
                  <input type="radio" name="category-type" value="despesa" checked={tipo === "despesa"} onChange={() => setTipo("despesa")} />
                  <span>Despesa</span>
                </label>
                <label className={tipo === "receita" ? "selected" : ""}>
                  <input type="radio" name="category-type" value="receita" checked={tipo === "receita"} onChange={() => setTipo("receita")} />
                  <span>Receita</span>
                </label>
              </div>
            </fieldset>

            <label className="custom-category-name">
              Nome da categoria
              <input value={nome} onChange={(evento) => setNome(evento.target.value)} placeholder="Ex.: Pets ou Freelance" required />
            </label>

            <fieldset className="custom-category-color-field">
              <legend>Cor de identificação</legend>
              <div className="custom-category-color-row">
                <div className="custom-category-swatches" aria-label="Cores sugeridas">
                  {CORES_SUGERIDAS.map((corSugerida) => (
                    <button
                      key={corSugerida}
                      type="button"
                      className={cor === corSugerida ? "selected" : ""}
                      style={{ backgroundColor: corSugerida }}
                      aria-label={`Usar cor ${corSugerida}`}
                      aria-pressed={cor === corSugerida}
                      onClick={() => setCor(corSugerida)}
                    />
                  ))}
                </div>
                <label className="custom-category-color-picker" title="Escolher outra cor">
                  <input type="color" value={cor} onChange={(evento) => setCor(evento.target.value)} aria-label="Escolher outra cor" />
                  <code>{cor.toUpperCase()}</code>
                </label>
              </div>
            </fieldset>

            <button className="custom-category-submit" type="submit" disabled={salvandoId === "nova"}>
              {salvandoId === "nova" ? "Criando…" : "Criar categoria"}
            </button>
          </form>
        </section>
        ) : (
        <section
          id="categorias-lista-panel"
          className="custom-category-manage"
          role="tabpanel"
          aria-labelledby="categorias-lista-tab"
        >
          <div className="custom-category-manage-heading">
            <div className="custom-category-section-heading">
              <div>
                <h3 id="suas-categorias-titulo">Suas categorias</h3>
                <p>Altere a cor, pause ou exclua categorias sem uso.</p>
              </div>
            </div>
            <span className="custom-category-total">{categorias.length} no total</span>
          </div>

          {categorias.length ? (
            <div className="custom-category-groups">
              {GRUPOS_CATEGORIAS.map((grupo) => {
                const categoriasDoGrupo = categorias.filter((categoria) => categoria.tipo === grupo.tipo);
                return (
                  <div className="custom-category-group" key={grupo.tipo}>
                    <div className="custom-category-group-heading">
                      <div>
                        <h4>{grupo.titulo}</h4>
                        <span>{grupo.descricao}</span>
                      </div>
                      <strong>{categoriasDoGrupo.length}</strong>
                    </div>

                    {categoriasDoGrupo.length ? (
                      <div className="custom-category-list">
                        {categoriasDoGrupo.map((categoria) => {
                          const quantidadeUsos = usos.get(normalizar(categoria.nome)) ?? 0;
                          return (
                            <article className={`custom-category-item${categoria.ativa ? "" : " inactive"}`} key={categoria.id}>
                              <input
                                className="custom-category-color"
                                type="color"
                                value={categoria.cor}
                                aria-label={`Alterar cor de ${categoria.nome}`}
                                disabled={salvandoId === categoria.id}
                                onChange={(evento) => atualizar(categoria, { cor: evento.target.value })}
                              />
                              <div className="custom-category-info">
                                <div className="custom-category-name-row">
                                  <h5>{categoria.nome}</h5>
                                  <span className={`custom-category-status ${categoria.ativa ? "active" : ""}`}>{categoria.ativa ? "Ativa" : "Pausada"}</span>
                                </div>
                                <span>{quantidadeUsos} {quantidadeUsos === 1 ? "lançamento associado" : "lançamentos associados"}</span>
                              </div>
                              <div className="custom-category-actions">
                                <label className="custom-category-toggle">
                                  <input type="checkbox" role="switch" checked={categoria.ativa} disabled={salvandoId === categoria.id} onChange={() => atualizar(categoria, { ativa: !categoria.ativa })} />
                                  <span>{categoria.ativa ? "Pausar" : "Ativar"}</span>
                                </label>
                                <button type="button" className="danger-outline" disabled={Boolean(quantidadeUsos) || salvandoId === categoria.id} title={quantidadeUsos ? "Remova os usos antes de excluir" : "Excluir categoria"} onClick={() => excluir(categoria)}>Excluir</button>
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="custom-category-group-empty">Nenhuma categoria de {grupo.titulo.toLowerCase()} criada.</p>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="custom-category-empty"><strong>Suas categorias aparecerão aqui</strong><span>Crie a primeira categoria usando o formulário de criação.</span></div>
          )}
        </section>
        )}
      </div>

      <p className="custom-category-disclaimer"><strong>Importante:</strong> categorias pausadas continuam no histórico, mas não aparecem em novos lançamentos.</p>
    </div>
  );
}
