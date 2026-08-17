export const DASHBOARD_SECTIONS = [
  "visao-geral",
  "insights",
  "revisao",
  "regras",
  "categorias",
  "importar",
  "contas",
  "cartoes",
  "orcamentos",
  "recorrencias",
  "metas",
  "novo",
  "lancamentos",
  "resumo",
] as const;

export type DashboardSection = (typeof DASHBOARD_SECTIONS)[number];

export type NavigationGroup = {
  id: "inicio" | "movimentacoes" | "planejamento" | "contas" | "organizacao" | "relatorios";
  label: string;
  descricao: string;
  defaultSection: DashboardSection;
  sections: readonly DashboardSection[];
};

export const NAVIGATION_GROUPS: readonly NavigationGroup[] = [
  {
    id: "inicio",
    label: "Início",
    descricao: "Resumo e análises",
    defaultSection: "visao-geral",
    sections: ["visao-geral", "insights"],
  },
  {
    id: "movimentacoes",
    label: "Movimentações",
    descricao: "Lançamentos e importação",
    defaultSection: "lancamentos",
    sections: ["lancamentos", "novo", "importar", "revisao"],
  },
  {
    id: "planejamento",
    label: "Planejamento",
    descricao: "Orçamentos e objetivos",
    defaultSection: "orcamentos",
    sections: ["orcamentos", "recorrencias", "metas"],
  },
  {
    id: "contas",
    label: "Contas e cartões",
    descricao: "Saldos e faturas",
    defaultSection: "contas",
    sections: ["contas", "cartoes"],
  },
  {
    id: "organizacao",
    label: "Organização",
    descricao: "Categorias e automações",
    defaultSection: "categorias",
    sections: ["categorias", "regras"],
  },
  {
    id: "relatorios",
    label: "Relatórios",
    descricao: "Gráficos e evolução",
    defaultSection: "resumo",
    sections: ["resumo"],
  },
];

export const SECTION_META: Record<DashboardSection, { titulo: string; descricao: string }> = {
  "visao-geral": {
    titulo: "Visão geral",
    descricao: "Acompanhe os principais números financeiros da família.",
  },
  insights: {
    titulo: "Insights automáticos",
    descricao: "Veja alertas, tendências e oportunidades encontradas nos seus dados.",
  },
  revisao: {
    titulo: "Revisão de lançamentos",
    descricao: "Confira movimentações que precisam de atenção.",
  },
  regras: {
    titulo: "Regras automáticas",
    descricao: "Automatize a categorização dos próximos lançamentos.",
  },
  categorias: {
    titulo: "Categorias",
    descricao: "Organize receitas e despesas do seu jeito.",
  },
  importar: {
    titulo: "Importar extrato",
    descricao: "Adicione movimentações a partir de arquivos bancários.",
  },
  contas: {
    titulo: "Contas e saldos",
    descricao: "Gerencie suas contas e acompanhe os saldos atuais.",
  },
  cartoes: {
    titulo: "Cartões e faturas",
    descricao: "Acompanhe limites, fechamentos e pagamentos de faturas.",
  },
  orcamentos: {
    titulo: "Orçamentos",
    descricao: "Planeje limites mensais por categoria.",
  },
  recorrencias: {
    titulo: "Recorrências",
    descricao: "Controle receitas e despesas que se repetem.",
  },
  metas: {
    titulo: "Metas financeiras",
    descricao: "Acompanhe objetivos e registre novos aportes.",
  },
  novo: {
    titulo: "Novo lançamento",
    descricao: "Registre uma nova movimentação financeira.",
  },
  lancamentos: {
    titulo: "Lançamentos",
    descricao: "Consulte, filtre e edite o histórico financeiro.",
  },
  resumo: {
    titulo: "Resumo visual",
    descricao: "Analise a distribuição e a evolução das movimentações.",
  },
};

export function isDashboardSection(value: string): value is DashboardSection {
  return DASHBOARD_SECTIONS.includes(value as DashboardSection);
}

export function dashboardPath(section: DashboardSection): string {
  return section === "visao-geral" ? "/" : `/${section}`;
}

export function sectionFromPathname(pathname: string): DashboardSection {
  const slug = pathname.split("/").filter(Boolean)[0] ?? "visao-geral";
  return isDashboardSection(slug) ? slug : "visao-geral";
}

export function navigationGroupForSection(section: DashboardSection): NavigationGroup {
  return NAVIGATION_GROUPS.find((group) => group.sections.includes(section)) ?? NAVIGATION_GROUPS[0];
}
