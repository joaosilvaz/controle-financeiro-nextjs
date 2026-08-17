"use client";

import { useCallback, useEffect, useState } from "react";
import { onAuthStateChanged, signInAnonymously, type User } from "firebase/auth";
import {
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  addDoc,
  writeBatch,
} from "firebase/firestore";
import { auth, db, firebaseConfigured } from "@/src/lib/firebase";
import type {
  CartaoCredito,
  ContaFinanceira,
  FaturaCartao,
  MetaFinanceira,
  MovimentoMeta,
  NovaConta,
  NovoCartaoCredito,
  NovaFaturaCartao,
  NovaMetaFinanceira,
  NovoMovimentoMeta,
  NovoOrcamentoMensal,
  NovaRecorrenciaFinanceira,
  NovaTransacao,
  OrcamentoMensal,
  RecorrenciaFinanceira,
  Transacao,
} from "@/src/lib/types";

const PIN_PADRAO = "1234";
const DEFAULT_CARTOES = ["Cartão principal", "Débito", "Dinheiro"];
const DEFAULT_PESSOAS = ["João", "Edith", "Coelho"];
const DEFAULT_CONTAS: ContaFinanceira[] = [
  {
    id: "conta-principal",
    nome: "Conta principal",
    tipo: "corrente",
    saldoInicial: 0,
    cor: "#3568b8",
    ativa: true,
  },
  {
    id: "dinheiro",
    nome: "Dinheiro",
    tipo: "dinheiro",
    saldoInicial: 0,
    cor: "#2f7a4f",
    ativa: true,
  },
];
const DEFAULT_CARTOES_CREDITO: CartaoCredito[] = [
  {
    id: "cartao-principal",
    nome: "Cartão principal",
    bandeira: "Visa",
    limite: 0,
    diaFechamento: 25,
    diaVencimento: 5,
    cor: "#5b4fc4",
    ativo: true,
  },
];

function semUndefined<T extends object>(dados: T): T {
  return Object.fromEntries(
    Object.entries(dados).filter(([, valor]) => valor !== undefined)
  ) as T;
}

function idOrcamento(mes: string, categoria: string): string {
  return `${mes}__${encodeURIComponent(categoria)}`;
}

function idOcorrenciaRecorrente(recorrenciaId: string, competencia: string): string {
  return `rec__${recorrenciaId}__${competencia}`;
}

function idFatura(cartaoId: string, mes: string): string {
  return `${cartaoId}__${mes}`;
}

export function useAppData() {
  const [user, setUser] = useState<User | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [transacoes, setTransacoes] = useState<Transacao[]>([]);
  const [cartoes, setCartoes] = useState<string[]>(DEFAULT_CARTOES);
  const [pessoas, setPessoas] = useState<string[]>(DEFAULT_PESSOAS);
  const [contas, setContas] = useState<ContaFinanceira[]>(DEFAULT_CONTAS);
  const [cartoesCredito, setCartoesCredito] = useState<CartaoCredito[]>(DEFAULT_CARTOES_CREDITO);
  const [faturas, setFaturas] = useState<FaturaCartao[]>([]);
  const [orcamentos, setOrcamentos] = useState<OrcamentoMensal[]>([]);
  const [recorrencias, setRecorrencias] = useState<RecorrenciaFinanceira[]>([]);
  const [metas, setMetas] = useState<MetaFinanceira[]>([]);
  const [movimentosMetas, setMovimentosMetas] = useState<MovimentoMeta[]>([]);
  const [pin, setPin] = useState(PIN_PADRAO);
  const [configReady, setConfigReady] = useState(false);
  const [transacoesReady, setTransacoesReady] = useState(false);
  const [contasReady, setContasReady] = useState(false);
  const [cartoesCreditoReady, setCartoesCreditoReady] = useState(false);
  const [faturasReady, setFaturasReady] = useState(false);
  const [orcamentosReady, setOrcamentosReady] = useState(false);
  const [recorrenciasReady, setRecorrenciasReady] = useState(false);
  const [metasReady, setMetasReady] = useState(false);
  const [movimentosMetasReady, setMovimentosMetasReady] = useState(false);

  useEffect(() => {
    if (!firebaseConfigured || !auth) return;
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    signInAnonymously(auth).catch((err) => {
      console.error("Erro ao autenticar", err);
      setAuthError(
        "Não foi possível conectar ao banco de dados. Verifique se a Autenticação Anônima está ativada no Firebase e sua internet."
      );
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user || !db) return;
    const firestore = db;

    const configRef = doc(firestore, "config", "app");

    getDoc(configRef).then((snap) => {
      if (!snap.exists()) {
        setDoc(configRef, { cartoes: DEFAULT_CARTOES, pessoas: DEFAULT_PESSOAS, pin: PIN_PADRAO });
      }
    });

    const unsubConfig = onSnapshot(
      configRef,
      (snap) => {
        const data = snap.data();
        if (!data) return;
        if (Array.isArray(data.cartoes) && data.cartoes.length) setCartoes(data.cartoes);
        if (Array.isArray(data.pessoas) && data.pessoas.length) setPessoas(data.pessoas);
        setPin(typeof data.pin === "string" ? data.pin : PIN_PADRAO);
        setConfigReady(true);
      },
      () => setConfigReady(false)
    );

    const txQuery = query(collection(firestore, "transacoes"), orderBy("data", "desc"));
    const unsubTx = onSnapshot(
      txQuery,
      (snap) => {
        setTransacoes(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as NovaTransacao) }))
        );
        setTransacoesReady(true);
      },
      () => setTransacoesReady(false)
    );

    const contasRef = collection(firestore, "contas");
    const unsubContas = onSnapshot(
      contasRef,
      (snap) => {
        if (snap.empty) {
          setContas(DEFAULT_CONTAS);
          Promise.all(
            DEFAULT_CONTAS.map(({ id, ...conta }) =>
              setDoc(doc(firestore, "contas", id), conta)
            )
          ).catch((err) => console.error("Erro ao criar contas padrão", err));
        } else {
          setContas(
            snap.docs
              .map((contaDoc) => ({
                id: contaDoc.id,
                ...(contaDoc.data() as NovaConta),
              }))
              .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
          );
        }
        setContasReady(true);
      },
      (err) => {
        console.error("Erro ao carregar contas", err);
        setContas(DEFAULT_CONTAS);
        setContasReady(true);
      }
    );

    const cartoesCreditoRef = collection(firestore, "cartoes_credito");
    const unsubCartoesCredito = onSnapshot(
      cartoesCreditoRef,
      (snap) => {
        if (snap.empty) {
          setCartoesCredito(DEFAULT_CARTOES_CREDITO);
          Promise.all(
            DEFAULT_CARTOES_CREDITO.map(({ id, ...cartao }) =>
              setDoc(doc(firestore, "cartoes_credito", id), cartao)
            )
          ).catch((err) => console.error("Erro ao criar cartão padrão", err));
        } else {
          setCartoesCredito(
            snap.docs
              .map((cartaoDoc) => ({
                id: cartaoDoc.id,
                ...(cartaoDoc.data() as NovoCartaoCredito),
              }))
              .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
          );
        }
        setCartoesCreditoReady(true);
      },
      (err) => {
        console.error("Erro ao carregar cartões", err);
        setCartoesCredito(DEFAULT_CARTOES_CREDITO);
        setCartoesCreditoReady(true);
      }
    );

    const faturasRef = collection(firestore, "faturas_cartao");
    const unsubFaturas = onSnapshot(
      faturasRef,
      (snap) => {
        setFaturas(
          snap.docs
            .map((faturaDoc) => ({
              id: faturaDoc.id,
              ...(faturaDoc.data() as NovaFaturaCartao),
            }))
            .sort((a, b) => b.mes.localeCompare(a.mes))
        );
        setFaturasReady(true);
      },
      (err) => {
        console.error("Erro ao carregar faturas", err);
        setFaturas([]);
        setFaturasReady(true);
      }
    );

    const orcamentosRef = collection(firestore, "orcamentos");
    const unsubOrcamentos = onSnapshot(
      orcamentosRef,
      (snap) => {
        setOrcamentos(
          snap.docs
            .map((orcamentoDoc) => ({
              id: orcamentoDoc.id,
              ...(orcamentoDoc.data() as NovoOrcamentoMensal),
            }))
            .sort((a, b) =>
              a.mes === b.mes
                ? a.categoria.localeCompare(b.categoria, "pt-BR")
                : b.mes.localeCompare(a.mes)
            )
        );
        setOrcamentosReady(true);
      },
      (err) => {
        console.error("Erro ao carregar orçamentos", err);
        setOrcamentos([]);
        setOrcamentosReady(true);
      }
    );

    const recorrenciasRef = collection(firestore, "recorrencias");
    const unsubRecorrencias = onSnapshot(
      recorrenciasRef,
      (snap) => {
        setRecorrencias(
          snap.docs
            .map((recorrenciaDoc) => ({
              id: recorrenciaDoc.id,
              ...(recorrenciaDoc.data() as NovaRecorrenciaFinanceira),
            }))
            .sort((a, b) => {
              if (a.ativa !== b.ativa) return a.ativa ? -1 : 1;
              return a.descricao.localeCompare(b.descricao, "pt-BR");
            })
        );
        setRecorrenciasReady(true);
      },
      (err) => {
        console.error("Erro ao carregar recorrências", err);
        setRecorrencias([]);
        setRecorrenciasReady(true);
      }
    );

    const metasRef = collection(firestore, "metas_financeiras");
    const unsubMetas = onSnapshot(
      metasRef,
      (snap) => {
        setMetas(
          snap.docs
            .map((metaDoc) => ({
              id: metaDoc.id,
              ...(metaDoc.data() as NovaMetaFinanceira),
            }))
            .sort((a, b) => {
              if (a.ativa !== b.ativa) return a.ativa ? -1 : 1;
              return a.nome.localeCompare(b.nome, "pt-BR");
            })
        );
        setMetasReady(true);
      },
      (err) => {
        console.error("Erro ao carregar metas", err);
        setMetas([]);
        setMetasReady(true);
      }
    );

    const movimentosMetasQuery = query(
      collection(firestore, "movimentos_metas"),
      orderBy("data", "desc")
    );
    const unsubMovimentosMetas = onSnapshot(
      movimentosMetasQuery,
      (snap) => {
        setMovimentosMetas(
          snap.docs.map((movimentoDoc) => ({
            id: movimentoDoc.id,
            ...(movimentoDoc.data() as NovoMovimentoMeta),
          }))
        );
        setMovimentosMetasReady(true);
      },
      (err) => {
        console.error("Erro ao carregar movimentos das metas", err);
        setMovimentosMetas([]);
        setMovimentosMetasReady(true);
      }
    );

    return () => {
      unsubConfig();
      unsubTx();
      unsubContas();
      unsubCartoesCredito();
      unsubFaturas();
      unsubOrcamentos();
      unsubRecorrencias();
      unsubMetas();
      unsubMovimentosMetas();
    };
  }, [user]);

  const addTransacao = useCallback((dados: NovaTransacao) => {
    if (!db) return Promise.reject(new Error("Sem conexão com o banco de dados."));
    return addDoc(collection(db, "transacoes"), semUndefined(dados));
  }, []);

  const addTransacoes = useCallback(async (itens: NovaTransacao[]) => {
    if (!db) throw new Error("Sem conexão com o banco de dados.");
    const firestore = db;
    const batch = writeBatch(firestore);
    itens.forEach((dados) => {
      batch.set(doc(collection(firestore, "transacoes")), semUndefined(dados));
    });
    await batch.commit();
  }, []);

  const updateTransacao = useCallback((id: string, dados: NovaTransacao) => {
    if (!db) return Promise.reject(new Error("Sem conexão com o banco de dados."));
    return updateDoc(doc(db, "transacoes", id), semUndefined(dados));
  }, []);

  const deleteTransacao = useCallback((id: string) => {
    if (!db) return Promise.reject(new Error("Sem conexão com o banco de dados."));
    return deleteDoc(doc(db, "transacoes", id));
  }, []);

  const addCartao = useCallback((nome: string) => {
    if (!db) return Promise.reject(new Error("Sem conexão com o banco de dados."));
    return updateDoc(doc(db, "config", "app"), { cartoes: arrayUnion(nome) });
  }, []);

  const addPessoa = useCallback((nome: string) => {
    if (!db) return Promise.reject(new Error("Sem conexão com o banco de dados."));
    return updateDoc(doc(db, "config", "app"), { pessoas: arrayUnion(nome) });
  }, []);

  const addConta = useCallback((dados: NovaConta) => {
    if (!db) return Promise.reject(new Error("Sem conexão com o banco de dados."));
    return addDoc(collection(db, "contas"), dados);
  }, []);

  const updateConta = useCallback((id: string, dados: NovaConta) => {
    if (!db) return Promise.reject(new Error("Sem conexão com o banco de dados."));
    return updateDoc(doc(db, "contas", id), dados);
  }, []);

  const deleteConta = useCallback((id: string) => {
    if (!db) return Promise.reject(new Error("Sem conexão com o banco de dados."));
    return deleteDoc(doc(db, "contas", id));
  }, []);

  const addCartaoCredito = useCallback((dados: NovoCartaoCredito) => {
    if (!db) return Promise.reject(new Error("Sem conexão com o banco de dados."));
    return addDoc(collection(db, "cartoes_credito"), dados);
  }, []);

  const updateCartaoCredito = useCallback((id: string, dados: NovoCartaoCredito) => {
    if (!db) return Promise.reject(new Error("Sem conexão com o banco de dados."));
    return updateDoc(doc(db, "cartoes_credito", id), dados);
  }, []);

  const deleteCartaoCredito = useCallback((id: string) => {
    if (!db) return Promise.reject(new Error("Sem conexão com o banco de dados."));
    return deleteDoc(doc(db, "cartoes_credito", id));
  }, []);

  const fecharFatura = useCallback((dados: NovaFaturaCartao) => {
    if (!db) return Promise.reject(new Error("Sem conexão com o banco de dados."));
    return setDoc(
      doc(db, "faturas_cartao", idFatura(dados.cartaoId, dados.mes)),
      semUndefined(dados)
    );
  }, []);

  const pagarFatura = useCallback(async (
    fatura: FaturaCartao,
    pagamento: { contaId: string; data: string; valor: number; cartaoNome: string }
  ) => {
    if (!db) throw new Error("Sem conexão com o banco de dados.");
    const firestore = db;
    const batch = writeBatch(firestore);
    const transacaoPagamentoId = `pag_fatura__${fatura.id}`;
    const faturaAtualizada: NovaFaturaCartao = {
      cartaoId: fatura.cartaoId,
      mes: fatura.mes,
      status: "paga",
      valorFechado: fatura.valorFechado,
      dataVencimento: fatura.dataVencimento,
      fechadaEm: fatura.fechadaEm,
      pagaEm: pagamento.data,
      contaPagamentoId: pagamento.contaId,
      valorPago: pagamento.valor,
      transacaoPagamentoId,
    };
    const transacaoPagamento: NovaTransacao = {
      data: pagamento.data,
      desc: `Pagamento da fatura ${pagamento.cartaoNome} · ${fatura.mes}`,
      categoria: "Pagamento de fatura",
      cartao: pagamento.cartaoNome,
      pessoa: "",
      valor: pagamento.valor,
      tipo: "transferencia",
      contaId: pagamento.contaId,
      contaDestinoId: "",
      cartaoId: fatura.cartaoId,
      faturaMes: fatura.mes,
      totalParcelas: 1,
      faturaPagamentoId: fatura.id,
    };
    batch.set(doc(firestore, "faturas_cartao", fatura.id), semUndefined(faturaAtualizada));
    batch.set(doc(firestore, "transacoes", transacaoPagamentoId), semUndefined(transacaoPagamento));
    await batch.commit();
  }, []);

  const reabrirFatura = useCallback(async (fatura: FaturaCartao) => {
    if (!db) throw new Error("Sem conexão com o banco de dados.");
    const firestore = db;
    const batch = writeBatch(firestore);
    batch.delete(doc(firestore, "faturas_cartao", fatura.id));
    if (fatura.status === "paga") {
      batch.delete(
        doc(firestore, "transacoes", fatura.transacaoPagamentoId ?? `pag_fatura__${fatura.id}`)
      );
    }
    await batch.commit();
  }, []);

  const addOrcamento = useCallback((dados: NovoOrcamentoMensal) => {
    if (!db) return Promise.reject(new Error("Sem conexão com o banco de dados."));
    return setDoc(
      doc(db, "orcamentos", idOrcamento(dados.mes, dados.categoria)),
      semUndefined(dados)
    );
  }, []);

  const addOrcamentos = useCallback(async (itens: NovoOrcamentoMensal[]) => {
    if (!db) throw new Error("Sem conexão com o banco de dados.");
    const firestore = db;
    const batch = writeBatch(firestore);
    itens.forEach((dados) => {
      batch.set(
        doc(firestore, "orcamentos", idOrcamento(dados.mes, dados.categoria)),
        semUndefined(dados)
      );
    });
    await batch.commit();
  }, []);

  const updateOrcamento = useCallback((id: string, dados: NovoOrcamentoMensal) => {
    if (!db) return Promise.reject(new Error("Sem conexão com o banco de dados."));
    return updateDoc(doc(db, "orcamentos", id), semUndefined(dados));
  }, []);

  const deleteOrcamento = useCallback((id: string) => {
    if (!db) return Promise.reject(new Error("Sem conexão com o banco de dados."));
    return deleteDoc(doc(db, "orcamentos", id));
  }, []);

  const addRecorrencia = useCallback((dados: NovaRecorrenciaFinanceira) => {
    if (!db) return Promise.reject(new Error("Sem conexão com o banco de dados."));
    return addDoc(collection(db, "recorrencias"), semUndefined(dados));
  }, []);

  const updateRecorrencia = useCallback((id: string, dados: NovaRecorrenciaFinanceira) => {
    if (!db) return Promise.reject(new Error("Sem conexão com o banco de dados."));
    return updateDoc(doc(db, "recorrencias", id), semUndefined(dados));
  }, []);

  const deleteRecorrencia = useCallback((id: string) => {
    if (!db) return Promise.reject(new Error("Sem conexão com o banco de dados."));
    return deleteDoc(doc(db, "recorrencias", id));
  }, []);

  const gerarTransacoesRecorrentes = useCallback(async (
    itens: Array<{ recorrenciaId: string; competencia: string; dados: NovaTransacao }>
  ) => {
    if (!db) throw new Error("Sem conexão com o banco de dados.");
    const firestore = db;
    const batch = writeBatch(firestore);
    itens.forEach(({ recorrenciaId, competencia, dados }) => {
      batch.set(
        doc(firestore, "transacoes", idOcorrenciaRecorrente(recorrenciaId, competencia)),
        semUndefined(dados)
      );
    });
    await batch.commit();
  }, []);

  const addMeta = useCallback((dados: NovaMetaFinanceira) => {
    if (!db) return Promise.reject(new Error("Sem conexão com o banco de dados."));
    return addDoc(collection(db, "metas_financeiras"), semUndefined(dados));
  }, []);

  const updateMeta = useCallback((id: string, dados: NovaMetaFinanceira) => {
    if (!db) return Promise.reject(new Error("Sem conexão com o banco de dados."));
    return updateDoc(doc(db, "metas_financeiras", id), semUndefined(dados));
  }, []);

  const deleteMeta = useCallback((id: string) => {
    if (!db) return Promise.reject(new Error("Sem conexão com o banco de dados."));
    return deleteDoc(doc(db, "metas_financeiras", id));
  }, []);

  const addMovimentoMeta = useCallback((dados: NovoMovimentoMeta) => {
    if (!db) return Promise.reject(new Error("Sem conexão com o banco de dados."));
    return addDoc(collection(db, "movimentos_metas"), semUndefined(dados));
  }, []);

  const deleteMovimentoMeta = useCallback((id: string) => {
    if (!db) return Promise.reject(new Error("Sem conexão com o banco de dados."));
    return deleteDoc(doc(db, "movimentos_metas", id));
  }, []);

  const updatePin = useCallback((novoPin: string) => {
    if (!db) return Promise.reject(new Error("Sem conexão com o banco de dados."));
    return updateDoc(doc(db, "config", "app"), { pin: novoPin });
  }, []);

  const clearAll = useCallback(() => {
    if (!db) return Promise.reject(new Error("Sem conexão com o banco de dados."));
    return Promise.all([
      ...transacoes.map((t) => deleteDoc(doc(db!, "transacoes", t.id))),
      ...faturas.map((fatura) => deleteDoc(doc(db!, "faturas_cartao", fatura.id))),
    ]);
  }, [faturas, transacoes]);

  return {
    ready:
      Boolean(user) &&
      configReady &&
      transacoesReady &&
      contasReady &&
      cartoesCreditoReady &&
      faturasReady &&
      orcamentosReady &&
      recorrenciasReady &&
      metasReady &&
      movimentosMetasReady,
    authError,
    transacoes,
    cartoes,
    pessoas,
    contas,
    cartoesCredito,
    faturas,
    orcamentos,
    recorrencias,
    metas,
    movimentosMetas,
    pin,
    addTransacao,
    addTransacoes,
    updateTransacao,
    deleteTransacao,
    addCartao,
    addPessoa,
    addConta,
    updateConta,
    deleteConta,
    addCartaoCredito,
    updateCartaoCredito,
    deleteCartaoCredito,
    fecharFatura,
    pagarFatura,
    reabrirFatura,
    addOrcamento,
    addOrcamentos,
    updateOrcamento,
    deleteOrcamento,
    addRecorrencia,
    updateRecorrencia,
    deleteRecorrencia,
    gerarTransacoesRecorrentes,
    addMeta,
    updateMeta,
    deleteMeta,
    addMovimentoMeta,
    deleteMovimentoMeta,
    updatePin,
    clearAll,
  };
}
