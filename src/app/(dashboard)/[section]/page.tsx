import { notFound } from "next/navigation";
import { DASHBOARD_SECTIONS, isDashboardSection } from "@/src/lib/navigation";

export function generateStaticParams() {
  return DASHBOARD_SECTIONS
    .filter((section) => section !== "visao-geral")
    .map((section) => ({ section }));
}

export default async function DashboardSectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  if (!isDashboardSection(section) || section === "visao-geral") notFound();
  return null;
}
