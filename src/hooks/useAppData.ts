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
  NovaConta,
  NovoCartaoCredito,
  NovaTransacao,
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

export function useAppData() {
  const [user, setUser] = useState<User | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [transacoes, setTransacoes] = useState<Transacao[]>([]);
  const [cartoes, setCartoes] = useState<string[]>(DEFAULT_CARTOES);
  const [pessoas, setPessoas] = useState<string[]>(DEFAULT_PESSOAS);
  const [contas, setContas] = useState<ContaFinanceira[]>(DEFAULT_CONTAS);
  const [cartoesCredito, setCartoesCredito] = useState<CartaoCredito[]>(DEFAULT_CARTOES_CREDITO);
  const [pin, setPin] = useState(PIN_PADRAO);
  const [configReady, setConfigReady] = useState(false);
  const [transacoesReady, setTransacoesReady] = useState(false);
  const [contasReady, setContasReady] = useState(false);
  const [cartoesCreditoReady, setCartoesCreditoReady] = useState(false);

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

    return () => {
      unsubConfig();
      unsubTx();
      unsubContas();
      unsubCartoesCredito();
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

  const updatePin = useCallback((novoPin: string) => {
    if (!db) return Promise.reject(new Error("Sem conexão com o banco de dados."));
    return updateDoc(doc(db, "config", "app"), { pin: novoPin });
  }, []);

  const clearAll = useCallback(() => {
    if (!db) return Promise.reject(new Error("Sem conexão com o banco de dados."));
    return Promise.all(transacoes.map((t) => deleteDoc(doc(db!, "transacoes", t.id))));
  }, [transacoes]);

  return {
    ready:
      Boolean(user) &&
      configReady &&
      transacoesReady &&
      contasReady &&
      cartoesCreditoReady,
    authError,
    transacoes,
    cartoes,
    pessoas,
    contas,
    cartoesCredito,
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
    updatePin,
    clearAll,
  };
}
