"use client";

import { useState, type FormEvent } from "react";

type Credenciais = { nome: string; email: string; senha: string };

export default function FamilyAuthGate({
  usuarioAutenticado,
  nomeInicial,
  emailInicial,
  authError,
  onLogin,
  onRegister,
  onResetPassword,
  onConfigureFamily,
  onLogout,
}: {
  usuarioAutenticado: boolean;
  nomeInicial?: string;
  emailInicial?: string;
  authError?: string | null;
  onLogin: (email: string, senha: string) => Promise<unknown>;
  onRegister: (nome: string, email: string, senha: string) => Promise<unknown>;
  onResetPassword: (email: string) => Promise<unknown>;
  onConfigureFamily: (dados: {
    modo: "criar" | "entrar";
    nomeUsuario: string;
    nomeFamilia?: string;
    codigoConvite?: string;
  }) => Promise<unknown>;
  onLogout: () => Promise<unknown>;
}) {
  const [authMode, setAuthMode] = useState<"entrar" | "cadastrar">("entrar");
  const [familyMode, setFamilyMode] = useState<"criar" | "entrar">("entrar");
  const [credentials, setCredentials] = useState<Credenciais>({
    nome: nomeInicial ?? "",
    email: emailInicial ?? "",
    senha: "",
  });
  const [familyName, setFamilyName] = useState("Minha família");
  const [inviteCode, setInviteCode] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      if (authMode === "entrar") {
        await onLogin(credentials.email, credentials.senha);
      } else {
        if (credentials.senha.length < 6) throw new Error("Use uma senha com pelo menos 6 caracteres.");
        await onRegister(credentials.nome, credentials.email, credentials.senha);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível autenticar.");
    } finally {
      setSaving(false);
    }
  }

  async function resetPassword() {
    if (!credentials.email.trim()) {
      setError("Informe seu e-mail para recuperar a senha.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onResetPassword(credentials.email);
      setNotice("Enviamos o link de recuperação para seu e-mail.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível enviar o e-mail.");
    } finally {
      setSaving(false);
    }
  }

  async function submitFamily(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await onConfigureFamily({
        modo: familyMode,
        nomeUsuario: credentials.nome || nomeInicial || emailInicial?.split("@")[0] || "Membro",
        nomeFamilia: familyMode === "criar" ? familyName : undefined,
        codigoConvite: familyMode === "entrar" ? inviteCode : undefined,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível configurar a família.");
    } finally {
      setSaving(false);
    }
  }

  if (usuarioAutenticado) {
    return (
      <div className="family-auth-screen">
        <div className="family-auth-card family-setup-card">
          <div className="family-auth-brand"><div className="brand-mark">CF</div><div><strong>Configure sua família</strong><span>Uma etapa para compartilhar o controle com segurança.</span></div></div>
          <div className="family-auth-tabs" role="tablist" aria-label="Configuração da família">
            <button type="button" className={familyMode === "entrar" ? "active" : ""} onClick={() => setFamilyMode("entrar")}>Entrar com código</button>
            <button type="button" className={familyMode === "criar" ? "active" : ""} onClick={() => setFamilyMode("criar")}>Criar família</button>
          </div>
          <form className="family-auth-form" onSubmit={submitFamily}>
            <label>Seu nome
              <input required value={credentials.nome || nomeInicial || ""} onChange={(event) => setCredentials((current) => ({ ...current, nome: event.target.value }))} placeholder="Como você será identificado" />
            </label>
            {familyMode === "entrar" ? (
              <label>Código de convite
                <input required value={inviteCode} onChange={(event) => setInviteCode(event.target.value.toUpperCase())} placeholder="Ex.: A7K9P2QX" maxLength={12} autoCapitalize="characters" />
              </label>
            ) : (
              <label>Nome da família
                <input required value={familyName} onChange={(event) => setFamilyName(event.target.value)} placeholder="Ex.: Família Silva" />
              </label>
            )}
            <button type="submit" disabled={saving}>{saving ? "Configurando…" : familyMode === "criar" ? "Criar e continuar" : "Entrar na família"}</button>
            <button type="button" className="secondary" onClick={() => onLogout()}>Usar outra conta</button>
            {(error || authError) ? <div className="family-auth-error" role="alert">{error || authError}</div> : null}
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="family-auth-screen">
      <div className="family-auth-card">
        <div className="family-auth-brand"><div className="brand-mark">CF</div><div><strong>Controle Financeiro</strong><span>Acesso individual da família</span></div></div>
        <div className="family-auth-tabs" role="tablist" aria-label="Acesso">
          <button type="button" className={authMode === "entrar" ? "active" : ""} onClick={() => { setAuthMode("entrar"); setError(""); }}>Entrar</button>
          <button type="button" className={authMode === "cadastrar" ? "active" : ""} onClick={() => { setAuthMode("cadastrar"); setError(""); }}>Criar conta</button>
        </div>
        <form className="family-auth-form" onSubmit={submitAuth}>
          {authMode === "cadastrar" ? (
            <label>Nome
              <input required autoComplete="name" value={credentials.nome} onChange={(event) => setCredentials((current) => ({ ...current, nome: event.target.value }))} placeholder="Seu nome" />
            </label>
          ) : null}
          <label>E-mail
            <input required type="email" autoComplete="email" value={credentials.email} onChange={(event) => setCredentials((current) => ({ ...current, email: event.target.value }))} placeholder="voce@email.com" />
          </label>
          <label>Senha
            <input required type="password" minLength={6} autoComplete={authMode === "entrar" ? "current-password" : "new-password"} value={credentials.senha} onChange={(event) => setCredentials((current) => ({ ...current, senha: event.target.value }))} placeholder="Mínimo de 6 caracteres" />
          </label>
          <button type="submit" disabled={saving}>{saving ? "Aguarde…" : authMode === "entrar" ? "Entrar" : "Criar minha conta"}</button>
          {authMode === "entrar" ? <button type="button" className="link family-forgot" disabled={saving} onClick={resetPassword}>Esqueci minha senha</button> : null}
          {(error || authError) ? <div className="family-auth-error" role="alert">{error || authError}</div> : null}
          {notice ? <div className="family-auth-notice" role="status">{notice}</div> : null}
        </form>
      </div>
    </div>
  );
}
