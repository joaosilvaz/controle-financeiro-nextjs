"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { montarCatalogoCategorias } from "@/src/lib/categories";
import type { CategoriaPersonalizada } from "@/src/lib/types";

type CategoryCatalog = ReturnType<typeof montarCatalogoCategorias>;

const CategoryCatalogContext = createContext<CategoryCatalog | null>(null);

export function CategoryCatalogProvider({
  personalizadas,
  children,
}: {
  personalizadas: CategoriaPersonalizada[];
  children: ReactNode;
}) {
  const catalogo = useMemo(
    () => montarCatalogoCategorias(personalizadas),
    [personalizadas]
  );
  return (
    <CategoryCatalogContext.Provider value={catalogo}>
      {children}
    </CategoryCatalogContext.Provider>
  );
}

export function useCategoryCatalog(): CategoryCatalog {
  const catalogo = useContext(CategoryCatalogContext);
  if (!catalogo) throw new Error("useCategoryCatalog precisa estar dentro de CategoryCatalogProvider.");
  return catalogo;
}

