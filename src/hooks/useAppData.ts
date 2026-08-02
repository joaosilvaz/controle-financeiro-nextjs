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
} from "firebase/firestore";
import { auth, db, firebaseConfigured } from "@/src/lib/firebase";
import type { NovaTransacao, Transacao } from "@/src/lib/types";

const PIN_PADRAO = "1234";
const DEFAULT_CARTOES = ["Cartão principal", "Débito", "Dinheiro"];
const DEFAULT_PESSOAS = ["João", "Edith", "Coelho"];

export function useAppData() {
  const [user, setUser] = useState<User | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [transacoes, setTransacoes] = useState<Transacao[]>([]);
  const [cartoes, setCartoes] = useState<string[]>(DEFAULT_CARTOES);
  const [pessoas, setPessoas] = useState<string[]>(DEFAULT_PESSOAS);
  const [pin, setPin] = useState(PIN_PADRAO);
  const [synced, setSynced] = useState(false);

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

    const configRef = doc(db, "config", "app");

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
        setSynced(true);
      },
      () => setSynced(false)
    );

    const txQuery = query(collection(db, "transacoes"), orderBy("data", "desc"));
    const unsubTx = onSnapshot(
      txQuery,
      (snap) => {
        setTransacoes(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as NovaTransacao) }))
        );
        setSynced(true);
      },
      () => setSynced(false)
    );

    return () => {
      unsubConfig();
      unsubTx();
    };
  }, [user]);

  const addTransacao = useCallback((dados: NovaTransacao) => {
    if (!db) return Promise.reject(new Error("Sem conexão com o banco de dados."));
    return addDoc(collection(db, "transacoes"), dados);
  }, []);

  const updateTransacao = useCallback((id: string, dados: NovaTransacao) => {
    if (!db) return Promise.reject(new Error("Sem conexão com o banco de dados."));
    return updateDoc(doc(db, "transacoes", id), dados);
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

  const updatePin = useCallback((novoPin: string) => {
    if (!db) return Promise.reject(new Error("Sem conexão com o banco de dados."));
    return updateDoc(doc(db, "config", "app"), { pin: novoPin });
  }, []);

  const clearAll = useCallback(() => {
    if (!db) return Promise.reject(new Error("Sem conexão com o banco de dados."));
    return Promise.all(transacoes.map((t) => deleteDoc(doc(db!, "transacoes", t.id))));
  }, [transacoes]);

  return {
    ready: Boolean(user) && synced,
    authError,
    transacoes,
    cartoes,
    pessoas,
    pin,
    addTransacao,
    updateTransacao,
    deleteTransacao,
    addCartao,
    addPessoa,
    updatePin,
    clearAll,
  };
}
