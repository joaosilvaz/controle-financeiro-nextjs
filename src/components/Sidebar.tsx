"use client";

const NAV_ITEMS = [
  {
    target: "visao-geral",
    label: "Visão geral",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="9" rx="1.5" />
        <rect x="14" y="3" width="7" height="5" rx="1.5" />
        <rect x="14" y="12" width="7" height="9" rx="1.5" />
        <rect x="3" y="16" width="7" height="5" rx="1.5" />
      </svg>
    ),
  },
  {
    target: "insights",
    label: "Insights",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 18h6M10 22h4" />
        <path d="M8.5 14.5A7 7 0 1 1 15.5 14.5C14.6 15.2 14 16 14 17h-4c0-1-.6-1.8-1.5-2.5Z" />
        <path d="m10 10 1.3 1.3L14.5 8" />
      </svg>
    ),
  },
  {
    target: "contas",
    label: "Contas e saldos",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="M16 12h5M7 9h4" />
      </svg>
    ),
  },
  {
    target: "cartoes",
    label: "Cartões e faturas",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <path d="M2 10h20M6 15h4" />
      </svg>
    ),
  },
  {
    target: "orcamentos",
    label: "Orçamentos",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v10M16 9.5c0-1.4-1.8-2.5-4-2.5s-4 1.1-4 2.5 1.8 2.5 4 2.5 4 1.1 4 2.5-1.8 2.5-4 2.5-4-1.1-4-2.5" />
      </svg>
    ),
  },
  {
    target: "recorrencias",
    label: "Recorrências",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 7h-6V1M4 17h6v6" />
        <path d="M20 7a9 9 0 0 0-15.5-2M4 17a9 9 0 0 0 15.5 2" />
      </svg>
    ),
  },
  {
    target: "metas",
    label: "Metas financeiras",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="4" />
        <path d="m15 9 5-5M16 4h4v4" />
      </svg>
    ),
  },
  {
    target: "novo",
    label: "Novo lançamento",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v8M8 12h8" />
      </svg>
    ),
  },
  {
    target: "lancamentos",
    label: "Lançamentos",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 6h16M4 12h16M4 18h10" />
      </svg>
    ),
  },
  {
    target: "resumo",
    label: "Resumo visual",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 21V9M10 21V3M17 21v-7" />
      </svg>
    ),
  },
];

export default function Sidebar({
  activeSection,
  onNavigate,
  synced,
  onLock,
  onChangePin,
}: {
  activeSection: string;
  onNavigate: (target: string) => void;
  synced: boolean;
  onLock: () => void;
  onChangePin: () => void;
}) {
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
      <nav className="nav">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.target}
            className={`nav-item${activeSection === item.target ? " active" : ""}`}
            onClick={() => onNavigate(item.target)}
            type="button"
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </nav>
      <div className="sidebar-footer">
        <div className="sync-status">
          <span className={`sync-dot${synced ? "" : " off"}`} />
          <span>{synced ? "Sincronizado" : "Sem conexão"}</span>
        </div>
        <button onClick={onChangePin}>Alterar PIN</button>
        <button onClick={onLock} style={{ marginTop: 8 }}>
          Bloquear tela
        </button>
      </div>
    </aside>
  );
}
