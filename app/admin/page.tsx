import { redirect } from "next/navigation";
import { desc } from "drizzle-orm";
import { AdminPanel } from "@/components/admin-panel";
import { getAdminSession } from "@/lib/auth";
import { getAdminCatalog } from "@/lib/catalog";
import { getDatabase } from "@/lib/db";
import { orderItems, orders } from "@/lib/db/schema";
import type { CatalogProduct, OrderView } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");

  const db = getDatabase();
  const [products, orderRows, itemRows] = await Promise.all([
    getAdminCatalog(),
    db.select().from(orders).orderBy(desc(orders.createdAt)),
    db.select().from(orderItems),
  ]);
  const initialOrders = orderRows.map((order) => ({
    ...order,
    items: itemRows.filter((item) => item.orderId === order.id),
  })) as OrderView[];

  return <AdminPanel initialProducts={products as CatalogProduct[]} initialOrders={initialOrders} email={session.email} />;
}
