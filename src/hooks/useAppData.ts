"use client";

import { useCallback, useEffect, useState } from "react";
import {
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  linkWithCredential,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User,
} from "firebase/auth";
import {
  arrayUnion,
  collection,
  deleteField,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  addDoc,
  runTransaction,
  where,
  writeBatch,
} from "firebase/firestore";
import { auth, db, firebaseConfigured } from "@/src/lib/firebase";
import {
  aplicarRegrasCategorizacao,
  regraCombinaComTransacao,
} from "@/src/lib/categorization-rules";
import { tipoDe } from "@/src/lib/finance";
import type {
  CartaoCredito,
  CategoriaPersonalizada,
  ContaFinanceira,
  FaturaCartao,
  FamiliaFinanceira,
  MetaFinanceira,
  MovimentoMeta,
  NovaConta,
  NovaCategoriaPersonalizada,
  NovoCartaoCredito,
  NovaFaturaCartao,
  NovaMetaFinanceira,
  NovoMovimentoMeta,
  NovoOrcamentoMensal,
  NovaRecorrenciaFinanceira,
  NovaRegraCategorizacao,
  NovaTransacao,
  OrcamentoMensal,
  PerfilFamiliar,
  RecorrenciaFinanceira,
  RegraCategorizacao,
  Transacao,
} from "@/src/lib/types";

const PIN_PADRAO = "1234";
const FAMILIA_PRINCIPAL_ID = "principal";
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

function gerarCodigoConvite(): string {
  const caracteres = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const valores = new Uint32Array(8);
  globalThis.crypto.getRandomValues(valores);
  return Array.from(valores, (valor) => caracteres[valor % caracteres.length]).join("");
}

function mensagemErroAuth(error: unknown): string {
  const codigo = typeof error === "object" && error && "code" in error
    ? String((error as { code: unknown }).code)
    : "";
  const mensagens: Record<string, string> = {
    "auth/email-already-in-use": "Este e-mail já possui uma conta. Entre com sua senha.",
    "auth/invalid-credential": "E-mail ou senha incorretos.",
    "auth/invalid-email": "Informe um e-mail válido.",
    "auth/weak-password": "Use uma senha com pelo menos 6 caracteres.",
    "auth/operation-not-allowed": "Ative o provedor E-mail/senha no Firebase Authentication.",
    "auth/too-many-requests": "Muitas tentativas. Aguarde um pouco e tente novamente.",
    "auth/network-request-failed": "Não foi possível conectar ao Firebase. Verifique sua internet.",
  };
  return mensagens[codigo] ?? (error instanceof Error ? error.message : "Não foi possível autenticar.");
}

export function useAppData() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [perfil, setPerfil] = useState<PerfilFamiliar | null>(null);
  const [perfilReady, setPerfilReady] = useState(false);
  const [familia, setFamilia] = useState<FamiliaFinanceira | null>(null);
  const [membros, setMembros] = useState<PerfilFamiliar[]>([]);
  const [familiaReady, setFamiliaReady] = useState(false);
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
  const [regrasCategorizacao, setRegrasCategorizacao] = useState<RegraCategorizacao[]>([]);
  const [categoriasPersonalizadas, setCategoriasPersonalizadas] = useState<CategoriaPersonalizada[]>([]);
  const [alertasOcultos, setAlertasOcultos] = useState<Record<string, string>>({});
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
  const [regrasCategorizacaoReady, setRegrasCategorizacaoReady] = useState(false);
  const [categoriasPersonalizadasReady, setCategoriasPersonalizadasReady] = useState(false);

  useEffect(() => {
    if (!firebaseConfigured || !auth) return;
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthReady(true);
      setAuthError(null);
      if (!u || u.isAnonymous) {
        setPerfil(null);
        setFamilia(null);
        setMembros([]);
        setPerfilReady(true);
        setFamiliaReady(true);
      } else {
        setPerfilReady(false);
        setFamiliaReady(false);
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user || user.isAnonymous || !db) return;
    const unsubPerfil = onSnapshot(
      doc(db, "usuarios", user.uid),
      (snap) => {
        setPerfil(snap.exists() ? snap.data() as PerfilFamiliar : null);
        setFamiliaReady(!snap.exists());
        setPerfilReady(true);
      },
      (err) => {
        console.error("Erro ao carregar perfil familiar", err);
        setAuthError("Não foi possível carregar seu perfil familiar.");
        setPerfilReady(true);
      }
    );
    return () => unsubPerfil();
  }, [user]);

  useEffect(() => {
    if (!perfil?.familiaId || !db) return;
    const unsubFamilia = onSnapshot(
      doc(db, "familias", perfil.familiaId),
      (snap) => {
        setFamilia(
          snap.exists()
            ? { id: snap.id, ...(snap.data() as Omit<FamiliaFinanceira, "id">) }
            : null
        );
        setFamiliaReady(true);
      },
      (err) => {
        console.error("Erro ao carregar família", err);
        setAuthError("Não foi possível carregar os dados da família.");
        setFamiliaReady(true);
      }
    );
    const membrosQuery = query(
      collection(db, "usuarios"),
      where("familiaId", "==", perfil.familiaId)
    );
    const unsubMembros = onSnapshot(
      membrosQuery,
      (snap) => setMembros(
        snap.docs
          .map((membroDoc) => membroDoc.data() as PerfilFamiliar)
          .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
      ),
      (err) => console.error("Erro ao carregar membros", err)
    );
    return () => {
      unsubFamilia();
      unsubMembros();
    };
  }, [perfil?.familiaId]);

  useEffect(() => {
    if (!user || user.isAnonymous || !perfil?.ativo || !db) return;
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
        if (Array.isArray(data.cartoes)) setCartoes(data.cartoes);
        if (Array.isArray(data.pessoas)) setPessoas(data.pessoas);
        setAlertasOcultos(
          data.alertasOcultos && typeof data.alertasOcultos === "object"
            ? data.alertasOcultos as Record<string, string>
            : {}
        );
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

    const regrasRef = collection(firestore, "regras_categorizacao");
    const unsubRegras = onSnapshot(
      regrasRef,
      (snap) => {
        setRegrasCategorizacao(
          snap.docs
            .map((regraDoc) => ({
              id: regraDoc.id,
              ...(regraDoc.data() as NovaRegraCategorizacao),
            }))
            .sort((a, b) => {
              if (a.ativa !== b.ativa) return a.ativa ? -1 : 1;
              return a.termo.localeCompare(b.termo, "pt-BR");
            })
        );
        setRegrasCategorizacaoReady(true);
      },
      (err) => {
        console.error("Erro ao carregar regras de categorização", err);
        setRegrasCategorizacao([]);
        setRegrasCategorizacaoReady(true);
      }
    );

    const categoriasPersonalizadasRef = collection(firestore, "categorias_personalizadas");
    const unsubCategoriasPersonalizadas = onSnapshot(
      categoriasPersonalizadasRef,
      (snap) => {
        setCategoriasPersonalizadas(
          snap.docs
            .map((categoriaDoc) => ({
              id: categoriaDoc.id,
              ...(categoriaDoc.data() as NovaCategoriaPersonalizada),
            }))
            .sort((a, b) => {
              if (a.tipo !== b.tipo) return a.tipo.localeCompare(b.tipo);
              if (a.ativa !== b.ativa) return a.ativa ? -1 : 1;
              return a.nome.localeCompare(b.nome, "pt-BR");
            })
        );
        setCategoriasPersonalizadasReady(true);
      },
      (err) => {
        console.error("Erro ao carregar categorias personalizadas", err);
        setCategoriasPersonalizadas([]);
        setCategoriasPersonalizadasReady(true);
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
      unsubRegras();
      unsubCategoriasPersonalizadas();
    };
  }, [perfil?.ativo, perfil?.uid, user]);

  const entrar = useCallback(async (email: string, senha: string) => {
    if (!auth) throw new Error("Firebase não configurado.");
    setAuthError(null);
    try {
      if (auth.currentUser?.isAnonymous) await signOut(auth);
      await signInWithEmailAndPassword(auth, email.trim(), senha);
    } catch (error) {
      const mensagem = mensagemErroAuth(error);
      setAuthError(mensagem);
      throw new Error(mensagem);
    }
  }, []);

  const cadastrarUsuario = useCallback(async (
    nome: string,
    email: string,
    senha: string
  ) => {
    if (!auth) throw new Error("Firebase não configurado.");
    const nomeLimpo = nome.trim();
    if (!nomeLimpo) throw new Error("Informe seu nome.");
    setAuthError(null);
    try {
      const usuarioAtual = auth.currentUser;
      const credencial = usuarioAtual?.isAnonymous
        ? await linkWithCredential(
            usuarioAtual,
            EmailAuthProvider.credential(email.trim(), senha)
          )
        : await createUserWithEmailAndPassword(auth, email.trim(), senha);
      await updateProfile(credencial.user, { displayName: nomeLimpo });
      setUser(auth.currentUser);
    } catch (error) {
      const mensagem = mensagemErroAuth(error);
      setAuthError(mensagem);
      throw new Error(mensagem);
    }
  }, []);

  const recuperarSenha = useCallback(async (email: string) => {
    if (!auth) throw new Error("Firebase não configurado.");
    try {
      await sendPasswordResetEmail(auth, email.trim());
    } catch (error) {
      throw new Error(mensagemErroAuth(error));
    }
  }, []);

  const configurarFamilia = useCallback(async (dados: {
    modo: "criar" | "entrar";
    nomeUsuario: string;
    nomeFamilia?: string;
    codigoConvite?: string;
  }) => {
    if (!db || !user || user.isAnonymous) {
      throw new Error("Entre com uma conta individual antes de configurar a família.");
    }
    const firestore = db;
    const familiaRef = doc(firestore, "familias", FAMILIA_PRINCIPAL_ID);
    const perfilRef = doc(firestore, "usuarios", user.uid);
    const agora = new Date().toISOString();
    const nomeUsuario = dados.nomeUsuario.trim() || user.displayName || user.email || "Membro";

    try {
      if (dados.modo === "criar") {
        await runTransaction(firestore, async (transaction) => {
        const familiaSnap = await transaction.get(familiaRef);
        if (familiaSnap.exists()) {
          throw new Error("A família principal já existe. Entre usando o código de convite.");
        }
        const nomeFamilia = dados.nomeFamilia?.trim();
        if (!nomeFamilia) throw new Error("Informe um nome para a família.");
        transaction.set(familiaRef, {
          nome: nomeFamilia,
          codigoConvite: gerarCodigoConvite(),
          criadaPorUid: user.uid,
          criadaEm: agora,
        });
        const novoPerfil: PerfilFamiliar = {
          uid: user.uid,
          nome: nomeUsuario,
          email: user.email ?? "",
          papel: "admin",
          familiaId: FAMILIA_PRINCIPAL_ID,
          ativo: true,
          criadoEm: agora,
        };
        transaction.set(perfilRef, novoPerfil);
        });
      } else {
        const codigoInformado = dados.codigoConvite?.trim().toUpperCase();
        if (!codigoInformado) throw new Error("Informe o código de convite.");

        // Em regras antigas/permissivas, valida também no cliente. Com as regras
        // seguras, a leitura externa é negada e o próprio Firestore compara o código.
        try {
          const familiaSnap = await getDoc(familiaRef);
          if (!familiaSnap.exists()) {
            throw new Error("Nenhuma família foi criada ainda. Crie a família principal primeiro.");
          }
          if (codigoInformado !== String(familiaSnap.data().codigoConvite ?? "").toUpperCase()) {
            throw new Error("Código de convite inválido.");
          }
        } catch (error) {
          const codigo = typeof error === "object" && error && "code" in error
            ? String((error as { code: unknown }).code)
            : "";
          if (codigo !== "permission-denied" && codigo !== "firestore/permission-denied") throw error;
        }

        await setDoc(perfilRef, {
          uid: user.uid,
          nome: nomeUsuario,
          email: user.email ?? "",
          papel: "membro",
          familiaId: FAMILIA_PRINCIPAL_ID,
          ativo: true,
          criadoEm: agora,
          codigoConvite: codigoInformado,
        });
        await updateDoc(perfilRef, { codigoConvite: deleteField() });
      }
    } catch (error) {
      const codigo = typeof error === "object" && error && "code" in error
        ? String((error as { code: unknown }).code)
        : "";
      const mensagem = dados.modo === "entrar" && codigo.includes("permission-denied")
        ? "Código de convite inválido."
        : error instanceof Error
          ? error.message
          : "Não foi possível configurar a família.";
      setAuthError(mensagem);
      throw new Error(mensagem);
    }
  }, [user]);

  const sair = useCallback(async () => {
    if (!auth) return;
    await signOut(auth);
  }, []);

  const updateMembro = useCallback(async (
    uid: string,
    alteracoes: Partial<Pick<PerfilFamiliar, "papel" | "ativo">>
  ) => {
    if (!db || perfil?.papel !== "admin") throw new Error("Apenas administradores podem alterar membros.");
    if (uid === perfil.uid && (alteracoes.ativo === false || alteracoes.papel === "membro")) {
      throw new Error("Você não pode remover seu próprio acesso de administrador.");
    }
    await updateDoc(doc(db, "usuarios", uid), alteracoes);
  }, [perfil]);

  const renovarCodigoConvite = useCallback(async () => {
    if (!db || !familia || perfil?.papel !== "admin") {
      throw new Error("Apenas administradores podem renovar o convite.");
    }
    await updateDoc(doc(db, "familias", familia.id), { codigoConvite: gerarCodigoConvite() });
  }, [familia, perfil]);

  const autoriaCriacao = useCallback(() => ({
    criadoPorUid: perfil?.uid,
    criadoPorNome: perfil?.nome,
    criadoEm: new Date().toISOString(),
  }), [perfil?.nome, perfil?.uid]);

  const addTransacao = useCallback((dados: NovaTransacao) => {
    if (!db) return Promise.reject(new Error("Sem conexão com o banco de dados."));
    const dadosCategorizados = aplicarRegrasCategorizacao(dados, regrasCategorizacao);
    return addDoc(
      collection(db, "transacoes"),
      semUndefined({ ...dadosCategorizados, ...autoriaCriacao() })
    );
  }, [autoriaCriacao, regrasCategorizacao]);

  const addTransacoes = useCallback(async (itens: NovaTransacao[]) => {
    if (!db) throw new Error("Sem conexão com o banco de dados.");
    const firestore = db;
    const itensCategorizados = itens.map((dados) =>
      ({ ...aplicarRegrasCategorizacao(dados, regrasCategorizacao), ...autoriaCriacao() })
    );
    for (let inicio = 0; inicio < itensCategorizados.length; inicio += 450) {
      const batch = writeBatch(firestore);
      itensCategorizados.slice(inicio, inicio + 450).forEach((dados) => {
        batch.set(doc(collection(firestore, "transacoes")), semUndefined(dados));
      });
      await batch.commit();
    }
  }, [autoriaCriacao, regrasCategorizacao]);

  const updateTransacao = useCallback((id: string, dados: NovaTransacao) => {
    if (!db) return Promise.reject(new Error("Sem conexão com o banco de dados."));
    return updateDoc(doc(db, "transacoes", id), semUndefined({
      ...dados,
      atualizadoPorUid: perfil?.uid,
      atualizadoPorNome: perfil?.nome,
      atualizadoEm: new Date().toISOString(),
    }));
  }, [perfil?.nome, perfil?.uid]);

  const deleteTransacoes = useCallback(async (ids: string[]) => {
    if (!db) throw new Error("Sem conexão com o banco de dados.");

    const firestore = db;
    const idsUnicos = [...new Set(ids)].filter(Boolean);
    if (!idsUnicos.length) return;

    const idsExcluidos = new Set(idsUnicos);
    const removidas = transacoes.filter((transacao) => idsExcluidos.has(transacao.id));
    const nomesCartoes = new Map(cartoesCredito.map((cartao) => [cartao.id, cartao.nome]));
    const ajustesFaturas = faturas.flatMap((fatura) => {
      const pertenceAFatura = (transacao: Transacao) => {
        if (tipoDe(transacao) !== "despesa" || transacao.faturaMes !== fatura.mes) return false;
        if (transacao.cartaoId) return transacao.cartaoId === fatura.cartaoId;
        return transacao.cartao === nomesCartoes.get(fatura.cartaoId);
      };
      const valorRemovido = removidas
        .filter(pertenceAFatura)
        .reduce((total, transacao) => total + (transacao.valor || 0), 0);
      if (valorRemovido <= 0) return [];

      const novoValorFechado = Math.max(0, fatura.valorFechado - valorRemovido);
      const transacaoPagamentoId =
        fatura.transacaoPagamentoId ?? `pag_fatura__${fatura.id}`;
      const pagamento = transacoes.find(
        (transacao) =>
          transacao.id === transacaoPagamentoId || transacao.faturaPagamentoId === fatura.id
      );
      const novoValorPago = fatura.status === "paga"
        ? Math.max(0, (fatura.valorPago ?? pagamento?.valor ?? fatura.valorFechado) - valorRemovido)
        : undefined;

      return [{ fatura, novoValorFechado, novoValorPago, pagamento }];
    });

    const batch = writeBatch(firestore);
    idsUnicos.forEach((id) => batch.delete(doc(firestore, "transacoes", id)));

    ajustesFaturas.forEach(({ fatura, novoValorFechado, novoValorPago, pagamento }) => {
      const faturaRef = doc(firestore, "faturas_cartao", fatura.id);
      if (novoValorFechado <= 0) {
        batch.delete(faturaRef);
      } else if (fatura.status === "paga" && novoValorPago && novoValorPago > 0) {
        batch.set(faturaRef, semUndefined({
          cartaoId: fatura.cartaoId,
          mes: fatura.mes,
          status: fatura.status,
          valorFechado: novoValorFechado,
          dataVencimento: fatura.dataVencimento,
          fechadaEm: fatura.fechadaEm,
          pagaEm: fatura.pagaEm,
          contaPagamentoId: fatura.contaPagamentoId,
          valorPago: novoValorPago,
          transacaoPagamentoId: fatura.transacaoPagamentoId,
        }));
      } else {
        batch.set(faturaRef, {
          cartaoId: fatura.cartaoId,
          mes: fatura.mes,
          status: "fechada",
          valorFechado: novoValorFechado,
          dataVencimento: fatura.dataVencimento,
          fechadaEm: fatura.fechadaEm,
        });
      }

      if (!pagamento || idsExcluidos.has(pagamento.id)) return;
      if (!novoValorPago || novoValorPago <= 0 || novoValorFechado <= 0) {
        batch.delete(doc(firestore, "transacoes", pagamento.id));
      } else {
        batch.update(doc(firestore, "transacoes", pagamento.id), { valor: novoValorPago });
      }
    });

    const transacoesAnteriores = transacoes;
    const faturasAnteriores = faturas;
    setTransacoes((atuais) => atuais
      .filter((transacao) => !idsExcluidos.has(transacao.id))
      .flatMap((transacao) => {
        const ajuste = ajustesFaturas.find(({ pagamento }) => pagamento?.id === transacao.id);
        if (!ajuste) return [transacao];
        if (!ajuste.novoValorPago || ajuste.novoValorPago <= 0 || ajuste.novoValorFechado <= 0) return [];
        return [{ ...transacao, valor: ajuste.novoValorPago }];
      }));
    setFaturas((atuais) => atuais.flatMap((faturaAtual) => {
      const ajuste = ajustesFaturas.find(({ fatura }) => fatura.id === faturaAtual.id);
      if (!ajuste) return [faturaAtual];
      if (ajuste.novoValorFechado <= 0) return [];
      if (faturaAtual.status === "paga" && ajuste.novoValorPago && ajuste.novoValorPago > 0) {
        return [{
          ...faturaAtual,
          valorFechado: ajuste.novoValorFechado,
          valorPago: ajuste.novoValorPago,
        }];
      }
      return [{
        id: faturaAtual.id,
        cartaoId: faturaAtual.cartaoId,
        mes: faturaAtual.mes,
        status: "fechada" as const,
        valorFechado: ajuste.novoValorFechado,
        dataVencimento: faturaAtual.dataVencimento,
        fechadaEm: faturaAtual.fechadaEm,
      }];
    }));

    try {
      await batch.commit();
    } catch (error) {
      setTransacoes(transacoesAnteriores);
      setFaturas(faturasAnteriores);
      throw error;
    }
  }, [cartoesCredito, faturas, transacoes]);

  const deleteTransacao = useCallback((id: string) => {
    return deleteTransacoes([id]);
  }, [deleteTransacoes]);

  const addCartao = useCallback((nome: string) => {
    if (!db) return Promise.reject(new Error("Sem conexão com o banco de dados."));
    return updateDoc(doc(db, "config", "app"), { cartoes: arrayUnion(nome) });
  }, []);

  const addPessoa = useCallback((nome: string) => {
    if (!db) return Promise.reject(new Error("Sem conexão com o banco de dados."));
    return updateDoc(doc(db, "config", "app"), { pessoas: arrayUnion(nome) });
  }, []);

  const updatePessoa = useCallback(async (nomeAtual: string, novoNome: string) => {
    if (!db) throw new Error("Sem conexão com o banco de dados.");
    const nomeLimpo = novoNome.trim();
    if (!nomeLimpo) throw new Error("Informe um nome válido.");
    if (
      pessoas.some(
        (pessoa) => pessoa !== nomeAtual && pessoa.toLocaleLowerCase("pt-BR") === nomeLimpo.toLocaleLowerCase("pt-BR")
      )
    ) {
      throw new Error("Já existe uma pessoa com esse nome.");
    }

    await updateDoc(doc(db, "config", "app"), {
      pessoas: pessoas.map((pessoa) => (pessoa === nomeAtual ? nomeLimpo : pessoa)),
    });

    const referencias = [
      ...transacoes
        .filter((transacao) => transacao.pessoa === nomeAtual)
        .map((transacao) => doc(db!, "transacoes", transacao.id)),
      ...recorrencias
        .filter((recorrencia) => recorrencia.pessoa === nomeAtual)
        .map((recorrencia) => doc(db!, "recorrencias", recorrencia.id)),
    ];

    for (let inicio = 0; inicio < referencias.length; inicio += 450) {
      const batch = writeBatch(db);
      referencias.slice(inicio, inicio + 450).forEach((referencia) => {
        batch.update(referencia, { pessoa: nomeLimpo });
      });
      await batch.commit();
    }
  }, [pessoas, recorrencias, transacoes]);

  const deletePessoa = useCallback((nome: string) => {
    if (!db) return Promise.reject(new Error("Sem conexão com o banco de dados."));
    return updateDoc(doc(db, "config", "app"), {
      pessoas: pessoas.filter((pessoa) => pessoa !== nome),
    });
  }, [pessoas]);

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

  const updateCartaoCredito = useCallback(async (id: string, dados: NovoCartaoCredito) => {
    if (!db) throw new Error("Sem conexão com o banco de dados.");
    const cartaoAtual = cartoesCredito.find((cartao) => cartao.id === id);
    await updateDoc(doc(db, "cartoes_credito", id), dados);
    if (!cartaoAtual || cartaoAtual.nome === dados.nome) return;

    const referencias = [
      ...transacoes
        .filter((transacao) => transacao.cartaoId === id || transacao.cartao === cartaoAtual.nome)
        .map((transacao) => doc(db!, "transacoes", transacao.id)),
      ...recorrencias
        .filter((recorrencia) => recorrencia.cartaoId === id || recorrencia.cartao === cartaoAtual.nome)
        .map((recorrencia) => doc(db!, "recorrencias", recorrencia.id)),
    ];

    for (let inicio = 0; inicio < referencias.length; inicio += 450) {
      const batch = writeBatch(db);
      referencias.slice(inicio, inicio + 450).forEach((referencia) => {
        batch.update(referencia, { cartao: dados.nome });
      });
      await batch.commit();
    }
  }, [cartoesCredito, recorrencias, transacoes]);

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
      ...autoriaCriacao(),
    };
    batch.set(doc(firestore, "faturas_cartao", fatura.id), semUndefined(faturaAtualizada));
    batch.set(doc(firestore, "transacoes", transacaoPagamentoId), semUndefined(transacaoPagamento));
    await batch.commit();
  }, [autoriaCriacao]);

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
      const dadosCategorizados = {
        ...aplicarRegrasCategorizacao(dados, regrasCategorizacao),
        ...autoriaCriacao(),
      };
      batch.set(
        doc(firestore, "transacoes", idOcorrenciaRecorrente(recorrenciaId, competencia)),
        semUndefined(dadosCategorizados)
      );
    });
    await batch.commit();
  }, [autoriaCriacao, regrasCategorizacao]);

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

  const addRegraCategorizacao = useCallback(async (dados: NovaRegraCategorizacao) => {
    if (!db) throw new Error("Sem conexão com o banco de dados.");
    const referencia = await addDoc(
      collection(db, "regras_categorizacao"),
      semUndefined(dados)
    );
    return { id: referencia.id, ...dados } satisfies RegraCategorizacao;
  }, []);

  const updateRegraCategorizacao = useCallback((id: string, dados: NovaRegraCategorizacao) => {
    if (!db) return Promise.reject(new Error("Sem conexão com o banco de dados."));
    return updateDoc(doc(db, "regras_categorizacao", id), semUndefined(dados));
  }, []);

  const deleteRegraCategorizacao = useCallback((id: string) => {
    if (!db) return Promise.reject(new Error("Sem conexão com o banco de dados."));
    return deleteDoc(doc(db, "regras_categorizacao", id));
  }, []);

  const aplicarRegraCategorizacaoExistentes = useCallback(async (regra: RegraCategorizacao) => {
    if (!db) throw new Error("Sem conexão com o banco de dados.");
    const firestore = db;
    const correspondentes = transacoes.filter((transacao) =>
      regraCombinaComTransacao(regra, transacao)
    );
    for (let inicio = 0; inicio < correspondentes.length; inicio += 450) {
      const batch = writeBatch(firestore);
      correspondentes.slice(inicio, inicio + 450).forEach((transacao) => {
        const { id, ...dados } = transacao;
        const atualizada = aplicarRegrasCategorizacao(dados, [regra]);
        batch.update(doc(firestore, "transacoes", id), semUndefined({
          categoria: atualizada.categoria,
          desc: atualizada.desc,
          descricaoOriginal: atualizada.descricaoOriginal,
          regraCategorizacaoId: atualizada.regraCategorizacaoId,
        }));
      });
      await batch.commit();
    }
    return correspondentes.length;
  }, [transacoes]);

  const addCategoriaPersonalizada = useCallback(async (dados: NovaCategoriaPersonalizada) => {
    if (!db) throw new Error("Sem conexão com o banco de dados.");
    const referencia = await addDoc(
      collection(db, "categorias_personalizadas"),
      semUndefined(dados)
    );
    return { id: referencia.id, ...dados } satisfies CategoriaPersonalizada;
  }, []);

  const updateCategoriaPersonalizada = useCallback((id: string, dados: NovaCategoriaPersonalizada) => {
    if (!db) return Promise.reject(new Error("Sem conexão com o banco de dados."));
    return updateDoc(doc(db, "categorias_personalizadas", id), semUndefined(dados));
  }, []);

  const deleteCategoriaPersonalizada = useCallback((id: string) => {
    if (!db) return Promise.reject(new Error("Sem conexão com o banco de dados."));
    return deleteDoc(doc(db, "categorias_personalizadas", id));
  }, []);

  const updatePin = useCallback((novoPin: string) => {
    if (!db) return Promise.reject(new Error("Sem conexão com o banco de dados."));
    return updateDoc(doc(db, "config", "app"), { pin: novoPin });
  }, []);

  const snoozeAlerta = useCallback((id: string, dias: number) => {
    if (!db) return Promise.reject(new Error("Sem conexão com o banco de dados."));
    const data = new Date();
    data.setHours(12, 0, 0, 0);
    data.setDate(data.getDate() + Math.max(1, dias));
    const ocultoAte = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(data.getDate()).padStart(2, "0")}`;
    return updateDoc(doc(db, "config", "app"), {
      alertasOcultos: { ...alertasOcultos, [id]: ocultoAte },
    });
  }, [alertasOcultos]);

  const restoreAlerta = useCallback((id: string) => {
    if (!db) return Promise.reject(new Error("Sem conexão com o banco de dados."));
    const atualizados = { ...alertasOcultos };
    delete atualizados[id];
    return updateDoc(doc(db, "config", "app"), { alertasOcultos: atualizados });
  }, [alertasOcultos]);

  const clearAll = useCallback(() => {
    if (!db) return Promise.reject(new Error("Sem conexão com o banco de dados."));
    return Promise.all([
      ...transacoes.map((t) => deleteDoc(doc(db!, "transacoes", t.id))),
      ...faturas.map((fatura) => deleteDoc(doc(db!, "faturas_cartao", fatura.id))),
    ]);
  }, [faturas, transacoes]);

  return {
    ready:
      Boolean(user && !user.isAnonymous && perfil?.ativo) &&
      perfilReady &&
      familiaReady &&
      configReady &&
      transacoesReady &&
      contasReady &&
      cartoesCreditoReady &&
      faturasReady &&
      orcamentosReady &&
      recorrenciasReady &&
      metasReady &&
      movimentosMetasReady &&
      regrasCategorizacaoReady &&
      categoriasPersonalizadasReady,
    authReady,
    perfilReady,
    familiaReady,
    authError,
    user,
    perfil,
    familia,
    membros,
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
    regrasCategorizacao,
    categoriasPersonalizadas,
    alertasOcultos,
    pin,
    entrar,
    cadastrarUsuario,
    recuperarSenha,
    configurarFamilia,
    sair,
    updateMembro,
    renovarCodigoConvite,
    addTransacao,
    addTransacoes,
    updateTransacao,
    deleteTransacao,
    deleteTransacoes,
    addCartao,
    addPessoa,
    updatePessoa,
    deletePessoa,
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
    addRegraCategorizacao,
    updateRegraCategorizacao,
    deleteRegraCategorizacao,
    aplicarRegraCategorizacaoExistentes,
    addCategoriaPersonalizada,
    updateCategoriaPersonalizada,
    deleteCategoriaPersonalizada,
    updatePin,
    snoozeAlerta,
    restoreAlerta,
    clearAll,
  };
}
