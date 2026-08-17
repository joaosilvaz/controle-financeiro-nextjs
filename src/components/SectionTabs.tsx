"use client";

import Link from "next/link";
import {
  dashboardPath,
  navigationGroupForSection,
  SECTION_META,
  type DashboardSection,
} from "@/src/lib/navigation";

export default function SectionTabs({ activeSection }: { activeSection: DashboardSection }) {
  const group = navigationGroupForSection(activeSection);
  if (group.sections.length < 2) return null;

  return (
    <nav className="dashboard-subnav" aria-label={`Páginas de ${group.label}`}>
      {group.sections.map((section) => (
        <Link
          key={section}
          href={dashboardPath(section)}
          className={activeSection === section ? "active" : ""}
          aria-current={activeSection === section ? "page" : undefined}
        >
          {SECTION_META[section].titulo}
        </Link>
      ))}
    </nav>
  );
}
