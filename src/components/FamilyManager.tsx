"use client";

import { useState } from "react";
import type { FamiliaFinanceira, PerfilFamiliar } from "@/src/lib/types";

export default function FamilyManager({
  open,
  familia,
  perfil,
  membros,
  onClose,
  onUpdateMember,
  onRenewInvite,
}: {
  open: boolean;
  familia: FamiliaFinanceira | null;
  perfil: PerfilFamiliar;
  membros: PerfilFamiliar[];
  onClose: () => void;
  onUpdateMember: (uid: string, changes: Partial<Pick<PerfilFamiliar, "papel" | "ativo">>) => Promise<unknown>;
  onRenewInvite: () => Promise<unknown>;
}) {
  const [workingId, setWorkingId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  if (!open || !familia) return null;

  const admin = perfil.papel === "admin";

  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(familia!.codigoConvite);
      setMessage("Código copiado.");
      setError("");
    } catch {
      setError("Não foi possível copiar. Selecione o código manualmente.");
    }
  }

  async function updateMember(uid: string, changes: Partial<Pick<PerfilFamiliar, "papel" | "ativo">>) {
    setWorkingId(uid);
    setError("");
    setMessage("");
    try {
      await onUpdateMember(uid, changes);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível alterar o membro.");
    } finally {
      setWorkingId("");
    }
  }

  async function renewInvite() {
    if (!confirm("Renovar o código? O convite atual deixará de funcionar.")) return;
    setWorkingId("invite");
    setError("");
    try {
      await onRenewInvite();
      setMessage("Novo código de convite criado.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível renovar o convite.");
    } finally {
      setWorkingId("");
    }
  }

  return (
    <div className="family-manager-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="family-manager-dialog" role="dialog" aria-modal="true" aria-labelledby="family-manager-title">
        <header className="family-manager-header">
          <div><span>Gestão de acesso</span><h2 id="family-manager-title">{familia.nome}</h2><p>Perfis individuais compartilhando os mesmos dados financeiros.</p></div>
          <button type="button" className="secondary" onClick={onClose}>Fechar</button>
        </header>

        <div className="family-invite-card">
          <div><span>Código para convidar</span><strong>{familia.codigoConvite}</strong><small>Envie apenas para pessoas da sua família.</small></div>
          <div>
            <button type="button" onClick={copyInvite}>Copiar código</button>
            {admin ? <button type="button" className="secondary" disabled={workingId === "invite"} onClick={renewInvite}>Renovar</button> : null}
          </div>
        </div>

        <div className="family-members-heading"><div><h3>Membros</h3><p>{membros.filter((member) => member.ativo).length} acesso(s) ativo(s)</p></div><span className={`family-role ${perfil.papel}`}>{perfil.papel === "admin" ? "Administrador" : "Membro"}</span></div>
        <div className="family-members-list">
          {membros.map((member) => {
            const isSelf = member.uid === perfil.uid;
            return (
              <article className={member.ativo ? "" : "inactive"} key={member.uid}>
                <div className="family-avatar">{member.nome.slice(0, 2).toUpperCase()}</div>
                <div className="family-member-copy"><strong>{member.nome}{isSelf ? " · você" : ""}</strong><span>{member.email}</span></div>
                <span className={`family-role ${member.papel}`}>{member.papel === "admin" ? "Admin" : "Membro"}</span>
                <span className={`family-member-status ${member.ativo ? "active" : "inactive"}`}>{member.ativo ? "Ativo" : "Pausado"}</span>
                {admin && !isSelf ? (
                  <div className="family-member-actions">
                    <button type="button" className="link" disabled={workingId === member.uid} onClick={() => updateMember(member.uid, { papel: member.papel === "admin" ? "membro" : "admin" })}>{member.papel === "admin" ? "Tornar membro" : "Tornar admin"}</button>
                    <button type="button" className={`link${member.ativo ? " danger" : ""}`} disabled={workingId === member.uid} onClick={() => updateMember(member.uid, { ativo: !member.ativo })}>{member.ativo ? "Pausar acesso" : "Reativar"}</button>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
        {error ? <div className="family-manager-message error" role="alert">{error}</div> : null}
        {message ? <div className="family-manager-message" role="status">{message}</div> : null}
      </section>
    </div>
  );
}
