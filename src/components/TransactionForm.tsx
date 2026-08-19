"use client";

import { useState, type FormEvent } from "react";
import { categoriasDoCatalogo, fmtMoeda, mesLabel } from "@/src/lib/categories";
import { useCategoryCatalog } from "@/src/components/CategoryCatalogProvider";
import { adicionarMesesAoMes, mesAtual, mesDaFatura, tipoDe } from "@/src/lib/finance";
import type {
  CartaoCredito,
  ContaFinanceira,
  NovaTransacao,
  TipoTransacao,
  Transacao,
} from "@/src/lib/types";

function estadoInicial(
  editing: Transacao | null,
  cartoes: CartaoCredito[],
  pessoas: string[],
  contas: ContaFinanceira[],
  categoriaInicial: string
): NovaTransacao {
  if (editing) {
    return {
      data: editing.data,
      desc: editing.desc,
      categoria: editing.categoria,
      cartao: editing.cartao,
      cartaoId:
        editing.cartaoId ?? cartoes.find((cartao) => cartao.nome === editing.cartao)?.id ?? "",
      pessoa: editing.pessoa,
      valor: editing.valor,
      tipo: tipoDe(editing),
      contaId: editing.contaId ?? "",
      contaDestinoId: editing.contaDestinoId ?? "",
      dataCompra: editing.dataCompra,
      faturaMes: editing.faturaMes,
      parcelaAtual: editing.parcelaAtual,
      totalParcelas: editing.totalParcelas ?? 1,
      valorTotalCompra: editing.valorTotalCompra,
      grupoParcelamentoId: editing.grupoParcelamentoId,
      tags: editing.tags ?? [],
      nota: editing.nota ?? "",
    };
  }
  return {
    data: new Date().toISOString().slice(0, 10),
    desc: "",
    categoria: categoriaInicial,
    cartao: "",
    pessoa: pessoas[0] || "",
    valor: 0,
    tipo: "despesa",
    contaId: contas.find((conta) => conta.ativa)?.id ?? "",
    contaDestinoId: "",
    cartaoId: "",
    totalParcelas: 1,
    tags: [],
    nota: "",
  };
}

export default function TransactionForm({
  cartoes,
  pessoas,
  contas,
  editing,
  onSubmit,
  onCancelEdit,
  onAddPessoa,
}: {
  cartoes: CartaoCredito[];
  pessoas: string[];
  contas: ContaFinanceira[];
  editing: Transacao | null;
  onSubmit: (
    dados: NovaTransacao,
    opcoes?: { parcelasPagas?: number; primeiraParcelaPendenteMes?: string }
  ) => Promise<unknown>;
  onCancelEdit: () => void;
  onAddPessoa: (nome: string) => Promise<unknown>;
}) {
  const catalogo = useCategoryCatalog();
  // Este componente recebe key={editing?.id ?? "novo"} do componente pai:
  // trocar de "adicionar" para "editar" (ou entre itens diferentes) remonta
  // o formulário, então o estado inicial abaixo já nasce correto sem precisar
  // sincronizar via useEffect.
  const [form, setForm] = useState<NovaTransacao>(() =>
    estadoInicial(editing, cartoes, pessoas, contas, catalogo.despesas[0].nome)
  );
  const [tagsTexto, setTagsTexto] = useState(() => (editing?.tags ?? []).join(", "));
  const [formError, setFormError] = useState("");
  const [parcelasPagas, setParcelasPagas] = useState(0);
  const [primeiraParcelaPendenteMes, setPrimeiraParcelaPendenteMes] = useState(() =>
    adicionarMesesAoMes(mesAtual(), 1)
  );
  const tipo = form.tipo ?? "despesa";
  const categoriasBase = categoriasDoCatalogo(tipo, catalogo);
  const categorias = form.categoria && !categoriasBase.some((categoria) => categoria.nome === form.categoria)
    ? [...categoriasBase, { nome: form.categoria, cor: catalogo.cores[form.categoria] ?? "#5b636e" }]
    : categoriasBase;
  const contasAtivas = contas.filter((conta) => conta.ativa || conta.id === form.contaId);
  const cartoesAtivos = cartoes.filter((cartao) => cartao.ativo || cartao.id === form.cartaoId);
  const cartaoSelecionado = cartoes.find((cartao) => cartao.id === form.cartaoId);
  const quantidadeParcelas = Math.max(1, form.totalParcelas ?? 1);
  const indiceParcelaAtual = editing
    ? Math.max(0, (form.parcelaAtual ?? 1) - 1)
    : Math.min(parcelasPagas, quantidadeParcelas - 1);
  const parcelasJaPagas = editing ? indiceParcelaAtual : parcelasPagas;
  const parcelasRestantes = Math.max(1, quantidadeParcelas - indiceParcelaAtual);
  const valorTotalCompra = editing
    ? form.valorTotalCompra ?? (form.valor || 0) * quantidadeParcelas
    : form.valor || 0;
  const totalCentavos = Math.round(valorTotalCompra * 100);
  const baseParcelaCentavos = Math.floor(totalCentavos / quantidadeParcelas);
  const centavosRestantes = totalCentavos - baseParcelaCentavos * quantidadeParcelas;
  const proximaParcela = (
    baseParcelaCentavos + (indiceParcelaAtual < centavosRestantes ? 1 : 0)
  ) / 100;
  const parcelasDiferentes = centavosRestantes > 0 && quantidadeParcelas > 1;
  const primeiraFatura = cartaoSelecionado && form.data
    ? mesDaFatura(cartaoSelecionado, editing ? form.dataCompra || form.data : form.data)
    : "";
  const proximaFatura = editing
    ? form.faturaMes ?? (primeiraFatura
        ? adicionarMesesAoMes(primeiraFatura, indiceParcelaAtual)
        : "")
    : parcelasPagas > 0
      ? primeiraParcelaPendenteMes
      : primeiraFatura;
  const ultimaFatura = proximaFatura
    ? adicionarMesesAoMes(proximaFatura, parcelasRestantes - 1)
    : "";

  function handleTipo(tipoSelecionado: TipoTransacao) {
    const categoriasDoTipo = categoriasDoCatalogo(tipoSelecionado, catalogo);
    setForm((formAtual) => ({
      ...formAtual,
      tipo: tipoSelecionado,
      categoria: categoriasDoTipo[0].nome,
      contaDestinoId: tipoSelecionado === "transferencia" ? formAtual.contaDestinoId : "",
      cartaoId: tipoSelecionado === "despesa" ? formAtual.cartaoId : "",
      cartao: tipoSelecionado === "despesa" ? formAtual.cartao : "",
      totalParcelas: tipoSelecionado === "despesa" ? formAtual.totalParcelas : 1,
    }));
    if (tipoSelecionado !== "despesa") setParcelasPagas(0);
    setFormError("");
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (tipo === "transferencia") {
      if (!form.contaId || !form.contaDestinoId) {
        setFormError("Selecione as contas de origem e destino.");
        return;
      }
      if (form.contaId === form.contaDestinoId) {
        setFormError("A conta de destino precisa ser diferente da conta de origem.");
        return;
      }
    }
    setFormError("");
    const tags = [...new Set(tagsTexto.split(",").map((tag) => tag.trim()).filter(Boolean))];
    await onSubmit(
      { ...form, tags, nota: form.nota?.trim() ?? "" },
      {
        parcelasPagas: editing ? 0 : parcelasPagas,
        primeiraParcelaPendenteMes:
          !editing && parcelasPagas > 0 ? primeiraParcelaPendenteMes : undefined,
      }
    );
    if (!editing) {
      setForm(estadoInicial(null, cartoes, pessoas, contas, catalogo.despesas[0].nome));
      setTagsTexto("");
      setParcelasPagas(0);
      setPrimeiraParcelaPendenteMes(adicionarMesesAoMes(mesAtual(), 1));
    }
  }

  async function handleNovaPessoa() {
    const nome = prompt("Nome da nova pessoa:");
    if (nome && nome.trim() && !pessoas.includes(nome.trim())) {
      await onAddPessoa(nome.trim());
      setForm((f) => ({ ...f, pessoa: nome.trim() }));
    }
  }

  return (
    <div className="panel">
      <h2>Novo lançamento</h2>
      {editing && (
        <div className="editing-banner">
          Editando lançamento — altere os campos e clique em &quot;Salvar alterações&quot;.
        </div>
      )}
      <form id="txForm" onSubmit={handleSubmit}>
        <div>
          <label>Tipo</label>
          <select
            value={tipo}
            onChange={(e) => handleTipo(e.target.value as TipoTransacao)}
          >
            <option value="despesa">Despesa</option>
            <option value="receita">Receita</option>
            <option value="transferencia">Transferência</option>
          </select>
        </div>
        <div>
          <label>{form.cartaoId ? editing ? "Data desta parcela" : "Data da compra" : "Data"}</label>
          <input
            type="date"
            required
            value={form.data}
            onChange={(e) => setForm((f) => ({ ...f, data: e.target.value }))}
          />
        </div>
        {tipo === "despesa" ? (
          <>
            <div>
              <label>Conta vinculada</label>
              <select
                value={form.contaId ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, contaId: e.target.value }))}
              >
                <option value="">Sem vínculo</option>
                {contasAtivas.map((conta) => (
                  <option key={conta.id} value={conta.id}>{conta.nome}</option>
                ))}
              </select>
            </div>
            <div>
              <label>Cartão de crédito <span className="field-optional">opcional</span></label>
              <select
                value={form.cartaoId ?? ""}
                onChange={(e) => {
                  const cartaoId = e.target.value;
                  const cartao = cartoes.find((item) => item.id === cartaoId);
                  if (!cartaoId) setParcelasPagas(0);
                  setForm((f) => ({
                    ...f,
                    cartaoId,
                    cartao: cartao?.nome ?? "",
                    totalParcelas: cartaoId ? f.totalParcelas ?? 1 : 1,
                  }));
                }}
              >
                <option value="">Não usar cartão</option>
                {cartoesAtivos.map((cartao) => (
                  <option key={cartao.id} value={cartao.id}>{cartao.nome}</option>
                ))}
              </select>
            </div>
          </>
        ) : tipo === "receita" ? (
          <div>
            <label>Conta de entrada</label>
            <select
              value={form.contaId ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, contaId: e.target.value }))}
            >
              <option value="">Sem vínculo</option>
              {contasAtivas.map((conta) => (
                <option key={conta.id} value={conta.id}>{conta.nome}</option>
              ))}
            </select>
          </div>
        ) : (
          <div>
          <label>Conta de origem</label>
          <select
            required
            value={form.contaId ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, contaId: e.target.value }))}
          >
            <option value="">Sem vínculo</option>
            {contasAtivas.map((conta) => (
              <option key={conta.id} value={conta.id}>{conta.nome}</option>
            ))}
          </select>
          </div>
        )}
        {tipo === "transferencia" ? (
          <div>
            <label>Conta de destino</label>
            <select
              required
              value={form.contaDestinoId ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, contaDestinoId: e.target.value }))}
            >
              <option value="">Selecione</option>
              {contas.filter((conta) => conta.ativa).map((conta) => (
                <option key={conta.id} value={conta.id}>{conta.nome}</option>
              ))}
            </select>
          </div>
        ) : null}
        <div className="span2">
          <label>Descrição</label>
          <input
            type="text"
            placeholder="Ex: Mercado, Uber, Netflix"
            required
            value={form.desc}
            onChange={(e) => setForm((f) => ({ ...f, desc: e.target.value }))}
          />
        </div>
        <div>
          <label>Categoria</label>
          <select
            value={form.categoria}
            onChange={(e) => setForm((f) => ({ ...f, categoria: e.target.value }))}
          >
            {categorias.map((c) => (
              <option key={c.nome}>{c.nome}</option>
            ))}
          </select>
        </div>
        {tipo === "despesa" && form.cartaoId ? (
          <>
            <div>
              <label>{editing ? "Parcela deste lançamento" : "Total de parcelas"}</label>
              {editing ? (
                <input
                  disabled
                  value={`${form.parcelaAtual ?? 1}/${form.totalParcelas ?? 1}`}
                />
              ) : (
                <select
                  value={form.totalParcelas ?? 1}
                  onChange={(e) => {
                    const totalParcelas = Number(e.target.value);
                    setForm((f) => ({ ...f, totalParcelas }));
                    setParcelasPagas((quantidadePaga) =>
                      Math.min(quantidadePaga, Math.max(0, totalParcelas - 1))
                    );
                  }}
                >
                  {Array.from({ length: 48 }, (_, indice) => indice + 1).map((numero) => (
                    <option key={numero} value={numero}>{numero}x</option>
                  ))}
                </select>
              )}
            </div>
            {!editing && quantidadeParcelas > 1 ? (
              <div>
                <label>Parcelas já pagas</label>
                <select
                  value={parcelasPagas}
                  onChange={(e) => setParcelasPagas(Number(e.target.value))}
                >
                  {Array.from({ length: quantidadeParcelas }, (_, numero) => (
                    <option key={numero} value={numero}>
                      {numero === 0
                        ? "Nenhuma — cadastrar desde 1/" + quantidadeParcelas
                        : `${numero} paga${numero === 1 ? "" : "s"} — iniciar em ${numero + 1}/${quantidadeParcelas}`}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            {!editing && parcelasPagas > 0 ? (
              <div>
                <label>Mês da próxima parcela</label>
                <input
                  type="month"
                  required
                  value={primeiraParcelaPendenteMes}
                  onChange={(e) => setPrimeiraParcelaPendenteMes(e.target.value)}
                />
              </div>
            ) : null}
          </>
        ) : null}
        <div>
          <label>Pessoa</label>
          <select
            value={form.pessoa}
            onChange={(e) => setForm((f) => ({ ...f, pessoa: e.target.value }))}
          >
            <option value="">Sem pessoa</option>
            {form.pessoa && !pessoas.includes(form.pessoa) ? (
              <option value={form.pessoa}>{form.pessoa} (histórico)</option>
            ) : null}
            {pessoas.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
        <div>
          <label>
            {form.cartaoId
              ? editing
                ? "Valor desta parcela (R$)"
                : "Valor total da compra (R$)"
              : "Valor (R$)"}
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            placeholder="0,00"
            required
            value={form.valor || ""}
            onChange={(e) => setForm((f) => ({ ...f, valor: parseFloat(e.target.value) || 0 }))}
          />
        </div>
        {tipo === "despesa" && form.cartaoId ? (
          <div className="full installment-preview" aria-live="polite">
            <div>
              <span>Valor total</span>
              <strong>{fmtMoeda(valorTotalCompra)}</strong>
            </div>
            <div>
              <span>Parcelamento</span>
              <strong>{quantidadeParcelas}x</strong>
            </div>
            <div>
              <span>Valor por parcela</span>
              <strong>{fmtMoeda(proximaParcela)}</strong>
              {parcelasDiferentes ? <small>pode variar R$ 0,01 entre parcelas</small> : null}
            </div>
            <div>
              <span>Já pagas</span>
              <strong>{parcelasJaPagas}</strong>
            </div>
            <div>
              <span>Restantes</span>
              <strong>{parcelasRestantes}</strong>
            </div>
            <p>
              {editing
                ? `Esta é a parcela ${form.parcelaAtual ?? 1}/${quantidadeParcelas}. `
                : parcelasPagas > 0
                  ? `Serão cadastradas somente as ${parcelasRestantes} parcelas restantes, começando em ${parcelasPagas + 1}/${quantidadeParcelas}. `
                  : `Serão cadastradas todas as ${quantidadeParcelas} parcelas. `}
              {proximaFatura ? `Próxima fatura: ${mesLabel(proximaFatura)}. ` : ""}
              {ultimaFatura ? `Última parcela prevista: ${mesLabel(ultimaFatura)}. ` : ""}
              A conta vinculada identifica onde a fatura será paga, sem descontar o saldo duas vezes.
            </p>
          </div>
        ) : null}
        <div className="span2">
          <label>Tags <span className="field-optional">separadas por vírgula</span></label>
          <input
            type="text"
            placeholder="Ex.: casa, reembolsável, viagem"
            value={tagsTexto}
            onChange={(e) => setTagsTexto(e.target.value)}
          />
        </div>
        <div className="full">
          <label>Nota <span className="field-optional">opcional</span></label>
          <textarea
            rows={2}
            placeholder="Contexto, comprovante ou observação sobre este lançamento"
            value={form.nota ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, nota: e.target.value }))}
          />
        </div>
        <div className="full row-actions">
          <button type="submit">{editing ? "Salvar alterações" : "Adicionar"}</button>
          {editing && (
            <button type="button" className="secondary" onClick={onCancelEdit}>
              Cancelar edição
            </button>
          )}
          <button type="button" className="secondary" onClick={handleNovaPessoa}>
            + Nova pessoa
          </button>
        </div>
        {formError ? <div className="full form-error" role="alert">{formError}</div> : null}
      </form>
    </div>
  );
}
