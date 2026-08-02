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
