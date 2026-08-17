import type { ReactNode } from "react";
import FinanceApp from "@/src/components/FinanceApp";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <FinanceApp>{children}</FinanceApp>;
}
