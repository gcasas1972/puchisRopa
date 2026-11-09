import { Storefront } from "@/components/storefront";
import { getPublicCatalog } from "@/lib/catalog";
import type { CatalogProduct } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const products = (await getPublicCatalog()) as CatalogProduct[];
  return <Storefront products={products} />;
}
