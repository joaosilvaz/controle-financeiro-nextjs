"use client";

import { useState, type FormEvent } from "react";
import type {
  CartaoCredito,
  ContaFinanceira,
  NovaConta,
  NovoCartaoCredito,
  Transacao,
} from "@/src/lib/types";
import type { DashboardSection } from "@/src/lib/navigation";

type RegistryTab = "pessoas" | "cartoes" | "contas" | "outros";

export default function RegistryManager({
  open,
  pessoas,
  cartoes,
  contas,
  transacoes,
  onClose,
  onNavigate,
  onAddPessoa,
  onUpdatePessoa,
  onDeletePessoa,
  onUpdateCartao,
  onDeleteCartao,
  onUpdateConta,
  onDeleteConta,
}: {
  open: boolean;
  pessoas: string[];
  cartoes: CartaoCredito[];
  contas: ContaFinanceira[];
  transacoes: Transacao[];
  onClose: () => void;
  onNavigate: (section: DashboardSection) => void;
  onAddPessoa: (nome: string) => Promise<unknown>;
  onUpdatePessoa: (nomeAtual: string, novoNome: string) => Promise<unknown>;
  onDeletePessoa: (nome: string) => Promise<unknown>;
  onUpdateCartao: (id: string, dados: NovoCartaoCredito) => Promise<unknown>;
  onDeleteCartao: (id: string) => Promise<unknown>;
  onUpdateConta: (id: string, dados: NovaConta) => Promise<unknown>;
  onDeleteConta: (id: string) => Promise<unknown>;
}) {
  const [tab, setTab] = useState<RegistryTab>("pessoas");
  const [newPerson, setNewPerson] = useState("");
  const [editingPerson, setEditingPerson] = useState<string | null>(null);
  const [personName, setPersonName] = useState("");
  const [editingCard, setEditingCard] = useState<string | null>(null);
  const [cardForm, setCardForm] = useState<NovoCartaoCredito | null>(null);
  const [editingAccount, setEditingAccount] = useState<string | null>(null);
  const [accountForm, setAccountForm] = useState<NovaConta | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  function clearFeedback() {
    setError("");
  }

  async function run(action: () => Promise<unknown>) {
    try {
      setBusy(true);
      setError("");
      await action();
      return true;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível concluir a alteração.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function addPerson(event: FormEvent) {
    event.preventDefault();
    const nome = newPerson.trim();
    if (!nome) return;
    if (pessoas.some((pessoa) => pessoa.toLocaleLowerCase("pt-BR") === nome.toLocaleLowerCase("pt-BR"))) {
      setError("Essa pessoa já está cadastrada.");
      return;
    }
    if (await run(() => onAddPessoa(nome))) setNewPerson("");
  }

  async function savePerson(event: FormEvent) {
    event.preventDefault();
    if (!editingPerson) return;
    if (await run(() => onUpdatePessoa(editingPerson, personName))) {
      setEditingPerson(null);
      setPersonName("");
    }
  }

  async function removePerson(nome: string) {
    const uso = transacoes.filter((transacao) => transacao.pessoa === nome).length;
    const mensagem = uso
      ? `Excluir “${nome}” da lista? Os ${uso} lançamento${uso === 1 ? "" : "s"} histórico${uso === 1 ? "" : "s"} manterão esse nome.`
      : `Excluir “${nome}” da lista de pessoas?`;
    if (!confirm(mensagem)) return;
    if (await run(() => onDeletePessoa(nome))) {
      setEditingPerson(null);
      setPersonName("");
    }
  }

  function startCardEdit(cartao: CartaoCredito) {
    setEditingCard(cartao.id);
    setCardForm({
      nome: cartao.nome,
      bandeira: cartao.bandeira,
      limite: cartao.limite,
      diaFechamento: cartao.diaFechamento,
      diaVencimento: cartao.diaVencimento,
      cor: cartao.cor,
      ativo: cartao.ativo,
    });
    clearFeedback();
  }

  async function saveCard(event: FormEvent) {
    event.preventDefault();
    if (!editingCard || !cardForm) return;
    if (await run(() => onUpdateCartao(editingCard, cardForm))) {
      setEditingCard(null);
      setCardForm(null);
    }
  }

  async function removeCard(cartao: CartaoCredito) {
    const inUse = transacoes.some(
      (transacao) => transacao.cartaoId === cartao.id || transacao.cartao === cartao.nome
    );
    if (inUse || !confirm(`Excluir o cartão “${cartao.nome}”?`)) return;
    await run(() => onDeleteCartao(cartao.id));
  }

  function startAccountEdit(conta: ContaFinanceira) {
    setEditingAccount(conta.id);
    setAccountForm({
      nome: conta.nome,
      tipo: conta.tipo,
      saldoInicial: conta.saldoInicial,
      cor: conta.cor,
      ativa: conta.ativa,
    });
    clearFeedback();
  }

  async function saveAccount(event: FormEvent) {
    event.preventDefault();
    if (!editingAccount || !accountForm) return;
    if (await run(() => onUpdateConta(editingAccount, accountForm))) {
      setEditingAccount(null);
      setAccountForm(null);
    }
  }

  async function removeAccount(conta: ContaFinanceira) {
    const inUse = transacoes.some(
      (transacao) => transacao.contaId === conta.id || transacao.contaDestinoId === conta.id
    );
    if (inUse || !confirm(`Excluir a conta “${conta.nome}”?`)) return;
    await run(() => onDeleteConta(conta.id));
  }

  function navigate(section: DashboardSection) {
    onClose();
    onNavigate(section);
  }

  return (
    <div className="registry-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="registry-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="registry-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="registry-header">
          <div>
            <span className="registry-eyebrow">Cadastros do sistema</span>
            <h2 id="registry-title">Gerenciar dados dos lançamentos</h2>
            <p>Edite as opções usadas no formulário sem sair do histórico.</p>
          </div>
          <button type="button" className="registry-close" aria-label="Fechar" onClick={onClose}>×</button>
        </header>

        <nav className="registry-tabs" aria-label="Tipos de cadastro">
          {([
            ["pessoas", "Pessoas", pessoas.length],
            ["cartoes", "Cartões", cartoes.length],
            ["contas", "Contas", contas.length],
            ["outros", "Outros", 2],
          ] as const).map(([value, label, count]) => (
            <button
              type="button"
              key={value}
              className={tab === value ? "active" : ""}
              aria-current={tab === value ? "page" : undefined}
              onClick={() => {
                setTab(value);
                clearFeedback();
              }}
            >
              {label}<span>{count}</span>
            </button>
          ))}
        </nav>

        {error ? <div className="registry-error" role="alert">{error}</div> : null}

        <div className="registry-content">
          {tab === "pessoas" ? (
            <>
              <div className="registry-section-heading">
                <div><h3>Pessoas</h3><p>Renomear atualiza também lançamentos e recorrências vinculados.</p></div>
              </div>
              <form className="registry-add-row" onSubmit={addPerson}>
                <input
                  aria-label="Nome da nova pessoa"
                  placeholder="Nome da nova pessoa"
                  value={newPerson}
                  onChange={(event) => setNewPerson(event.target.value)}
                />
                <button type="submit" disabled={busy || !newPerson.trim()}>Adicionar</button>
              </form>
              <div className="registry-list">
                {pessoas.length ? pessoas.map((pessoa) => {
                  const usage = transacoes.filter((transacao) => transacao.pessoa === pessoa).length;
                  return editingPerson === pessoa ? (
                    <form className="registry-edit-form" key={pessoa} onSubmit={savePerson}>
                      <input autoFocus value={personName} onChange={(event) => setPersonName(event.target.value)} />
                      <button type="submit" disabled={busy || !personName.trim()}>Salvar</button>
                      <button type="button" className="secondary" onClick={() => setEditingPerson(null)}>Cancelar</button>
                    </form>
                  ) : (
                    <div className="registry-list-item person" key={pessoa}>
                      <div><strong>{pessoa}</strong><small>{usage} lançamento{usage === 1 ? "" : "s"}</small></div>
                      <div className="registry-row-actions">
                        <button type="button" className="link" onClick={() => { setEditingPerson(pessoa); setPersonName(pessoa); clearFeedback(); }}>Editar</button>
                        <button type="button" className="link danger" disabled={busy} onClick={() => removePerson(pessoa)}>Excluir</button>
                      </div>
                    </div>
                  );
                }) : <div className="registry-empty">Nenhuma pessoa cadastrada.</div>}
              </div>
            </>
          ) : null}

          {tab === "cartoes" ? (
            <>
              <div className="registry-section-heading">
                <div><h3>Cartões de crédito</h3><p>Cartões com lançamentos vinculados não podem ser excluídos.</p></div>
                <button type="button" className="secondary" onClick={() => navigate("cartoes")}>Faturas e novo cartão</button>
              </div>
              <div className="registry-list">
                {cartoes.map((cartao) => {
                  const inUse = transacoes.some((transacao) => transacao.cartaoId === cartao.id || transacao.cartao === cartao.nome);
                  return editingCard === cartao.id && cardForm ? (
                    <form className="registry-detail-form" key={cartao.id} onSubmit={saveCard}>
                      <label className="registry-field"><span>Nome</span><input aria-label="Nome do cartão" required value={cardForm.nome} onChange={(event) => setCardForm({ ...cardForm, nome: event.target.value })} /></label>
                      <label className="registry-field"><span>Bandeira</span><input aria-label="Bandeira" required value={cardForm.bandeira} onChange={(event) => setCardForm({ ...cardForm, bandeira: event.target.value })} /></label>
                      <label className="registry-field"><span>Limite</span><input aria-label="Limite" type="number" min="0" step="0.01" value={cardForm.limite} onChange={(event) => setCardForm({ ...cardForm, limite: Number(event.target.value) })} /></label>
                      <label className="registry-field"><span>Fechamento</span><input aria-label="Dia de fechamento" type="number" min="1" max="31" value={cardForm.diaFechamento} onChange={(event) => setCardForm({ ...cardForm, diaFechamento: Number(event.target.value) })} /></label>
                      <label className="registry-field"><span>Vencimento</span><input aria-label="Dia de vencimento" type="number" min="1" max="31" value={cardForm.diaVencimento} onChange={(event) => setCardForm({ ...cardForm, diaVencimento: Number(event.target.value) })} /></label>
                      <label className="registry-field color"><span>Cor</span><input aria-label="Cor do cartão" className="color-input" type="color" value={cardForm.cor} onChange={(event) => setCardForm({ ...cardForm, cor: event.target.value })} /></label>
                      <label className="registry-toggle"><input type="checkbox" checked={cardForm.ativo} onChange={(event) => setCardForm({ ...cardForm, ativo: event.target.checked })} /> Ativo</label>
                      <div className="registry-form-actions"><button disabled={busy}>Salvar</button><button type="button" className="secondary" onClick={() => setEditingCard(null)}>Cancelar</button></div>
                    </form>
                  ) : (
                    <div className="registry-list-item" key={cartao.id}>
                      <span className="registry-color" style={{ background: cartao.cor }} />
                      <div><strong>{cartao.nome}</strong><small>{cartao.bandeira} · fecha dia {cartao.diaFechamento} · vence dia {cartao.diaVencimento}</small></div>
                      <div className="registry-row-actions">
                        <button type="button" className="link" onClick={() => startCardEdit(cartao)}>Editar</button>
                        <button type="button" className="link danger" disabled={busy || inUse} title={inUse ? "Há lançamentos vinculados a este cartão" : "Excluir cartão"} onClick={() => removeCard(cartao)}>Excluir</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : null}

          {tab === "contas" ? (
            <>
              <div className="registry-section-heading">
                <div><h3>Contas</h3><p>Contas usadas em lançamentos ficam protegidas contra exclusão.</p></div>
                <button type="button" className="secondary" onClick={() => navigate("contas")}>Saldos e nova conta</button>
              </div>
              <div className="registry-list">
                {contas.map((conta) => {
                  const inUse = transacoes.some((transacao) => transacao.contaId === conta.id || transacao.contaDestinoId === conta.id);
                  return editingAccount === conta.id && accountForm ? (
                    <form className="registry-detail-form account" key={conta.id} onSubmit={saveAccount}>
                      <label className="registry-field"><span>Nome</span><input aria-label="Nome da conta" required value={accountForm.nome} onChange={(event) => setAccountForm({ ...accountForm, nome: event.target.value })} /></label>
                      <label className="registry-field"><span>Tipo</span><select aria-label="Tipo da conta" value={accountForm.tipo} onChange={(event) => setAccountForm({ ...accountForm, tipo: event.target.value as NovaConta["tipo"] })}>
                        <option value="corrente">Conta corrente</option><option value="poupanca">Poupança</option><option value="dinheiro">Dinheiro</option><option value="investimento">Investimentos</option>
                      </select></label>
                      <label className="registry-field"><span>Saldo inicial</span><input aria-label="Saldo inicial" type="number" step="0.01" value={accountForm.saldoInicial} onChange={(event) => setAccountForm({ ...accountForm, saldoInicial: Number(event.target.value) })} /></label>
                      <label className="registry-field color"><span>Cor</span><input aria-label="Cor da conta" className="color-input" type="color" value={accountForm.cor} onChange={(event) => setAccountForm({ ...accountForm, cor: event.target.value })} /></label>
                      <label className="registry-toggle"><input type="checkbox" checked={accountForm.ativa} onChange={(event) => setAccountForm({ ...accountForm, ativa: event.target.checked })} /> Incluir no saldo</label>
                      <div className="registry-form-actions"><button disabled={busy}>Salvar</button><button type="button" className="secondary" onClick={() => setEditingAccount(null)}>Cancelar</button></div>
                    </form>
                  ) : (
                    <div className="registry-list-item" key={conta.id}>
                      <span className="registry-color" style={{ background: conta.cor }} />
                      <div><strong>{conta.nome}</strong><small>{conta.ativa ? "Ativa" : "Inativa"} · {conta.tipo}</small></div>
                      <div className="registry-row-actions">
                        <button type="button" className="link" onClick={() => startAccountEdit(conta)}>Editar</button>
                        <button type="button" className="link danger" disabled={busy || inUse} title={inUse ? "Há lançamentos vinculados a esta conta" : "Excluir conta"} onClick={() => removeAccount(conta)}>Excluir</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : null}

          {tab === "outros" ? (
            <div className="registry-shortcuts">
              <button type="button" onClick={() => navigate("categorias")}><strong>Categorias</strong><span>Editar, ativar ou excluir categorias personalizadas.</span><b>Gerenciar →</b></button>
              <button type="button" onClick={() => navigate("regras")}><strong>Regras automáticas</strong><span>Organizar as regras usadas para categorizar lançamentos.</span><b>Gerenciar →</b></button>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
