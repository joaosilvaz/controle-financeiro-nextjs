"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import {
  dashboardPath,
  NAVIGATION_GROUPS,
  navigationGroupForSection,
  type DashboardSection,
} from "@/src/lib/navigation";
import type { PerfilFamiliar } from "@/src/lib/types";

const GROUP_ICONS: Record<(typeof NAVIGATION_GROUPS)[number]["id"], ReactNode> = {
  inicio: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </svg>
  ),
  movimentacoes: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 6h16M4 12h16M4 18h10" />
      <path d="m17 16 3 3-3 3" />
    </svg>
  ),
  planejamento: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="4" />
      <path d="m15 9 5-5M16 4h4v4" />
    </svg>
  ),
  contas: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M16 12h5M7 9h4" />
    </svg>
  ),
  organizacao: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 7h10M4 17h16M18 7h2M4 12h3M11 12h9" />
      <circle cx="16" cy="7" r="2" />
      <circle cx="9" cy="12" r="2" />
    </svg>
  ),
  relatorios: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 21V9M10 21V3M17 21v-7" />
    </svg>
  ),
};

export default function Sidebar({
  activeSection,
  synced,
  profile,
  familyName,
  onOpenFamily,
  onLogout,
}: {
  activeSection: DashboardSection;
  synced: boolean;
  profile: PerfilFamiliar;
  familyName?: string;
  onOpenFamily: () => void;
  onLogout: () => Promise<unknown>;
}) {
  const router = useRouter();
  const activeGroup = navigationGroupForSection(activeSection);

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">CF</div>
        <div className="brand-name">
          Controle
          <br />
          Financeiro
          <span>Gestão da família</span>
        </div>
      </div>
      <nav className="nav" aria-label="Navegação principal">
        {NAVIGATION_GROUPS.map((group) => (
          <Link
            key={group.id}
            className={`nav-item${activeGroup.id === group.id ? " active" : ""}`}
            href={dashboardPath(group.defaultSection)}
          >
            {GROUP_ICONS[group.id]}
            <span className="nav-item-copy">
              <strong>{group.label}</strong>
              <small>{group.descricao}</small>
            </span>
          </Link>
        ))}
      </nav>
      <label className="mobile-group-nav">
        <span>Área atual</span>
        <select
          value={activeGroup.id}
          aria-label="Escolher área principal"
          onChange={(event) => {
            const group = NAVIGATION_GROUPS.find((item) => item.id === event.target.value);
            if (group) router.push(dashboardPath(group.defaultSection));
          }}
        >
          {NAVIGATION_GROUPS.map((group) => (
            <option key={group.id} value={group.id}>{group.label}</option>
          ))}
        </select>
      </label>
      <div className="sidebar-footer">
        <div className="sidebar-profile">
          <span>{profile.nome.slice(0, 2).toUpperCase()}</span>
          <div><strong>{profile.nome}</strong><small>{familyName ?? "Família"} · {profile.papel === "admin" ? "Admin" : "Membro"}</small></div>
        </div>
        <div className="sync-status">
          <span className={`sync-dot${synced ? "" : " off"}`} />
          <span>{synced ? "Sincronizado" : "Sem conexão"}</span>
        </div>
        <button onClick={onOpenFamily}>Gerenciar família</button>
        <button onClick={() => void onLogout()} style={{ marginTop: 8 }}>Sair</button>
      </div>
    </aside>
  );
}
