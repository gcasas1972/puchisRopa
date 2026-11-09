import { asc, eq } from "drizzle-orm";
import { getDatabase } from "@/lib/db";
import { products, variants } from "@/lib/db/schema";

async function loadCatalog(includeInactive: boolean) {
  const db = getDatabase();
  const productRows = await db
    .select()
    .from(products)
    .where(includeInactive ? undefined : eq(products.isActive, true))
    .orderBy(asc(products.createdAt));

  if (productRows.length === 0) return [];
  const variantRows = await db
    .select()
    .from(variants)
    .where(includeInactive ? undefined : eq(variants.isActive, true));

  return productRows.map((product) => ({
    ...product,
    variants: variantRows
      .filter((variant) => variant.productId === product.id && (includeInactive || variant.isActive))
      .map(({ id, size, stock, isActive }) => ({ id, size, stock, isActive })),
  }));
}

export function getPublicCatalog() {
  return loadCatalog(false);
}

export function getAdminCatalog() {
  return loadCatalog(true);
}
