import { desc, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api";
import { getDatabase } from "@/lib/db";
import { orderItems, orders, variants } from "@/lib/db/schema";
import { orderStatusSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET() {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  try {
    const db = getDatabase();
    const orderRows = await db.select().from(orders).orderBy(desc(orders.createdAt));
    if (orderRows.length === 0) return NextResponse.json([]);
    const itemRows = await db.select().from(orderItems);
    return NextResponse.json(
      orderRows.map((order) => ({
        ...order,
        items: itemRows.filter((item) => item.orderId === order.id),
      })),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("No se pudieron cargar los pedidos.", error);
    return NextResponse.json({ error: "No se pudieron cargar los pedidos." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "La solicitud no tiene un formato válido." }, { status: 400 });
  }
  if (!body || typeof body !== "object" || !("id" in body) || typeof body.id !== "string") {
    return NextResponse.json({ error: "Falta el identificador del pedido." }, { status: 400 });
  }
  const parsed = orderStatusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "El estado del pedido no es válido." }, { status: 400 });
  }

  try {
    const db = getDatabase();
    const orderId = body.id;
    const updated = await db.transaction(async (tx) => {
      const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).for("update").limit(1);
      if (!order) return "missing";

      const allowedTransitions: Record<string, string[]> = {
        pending: ["confirmed", "cancelled"],
        confirmed: ["shipped", "cancelled"],
        shipped: [],
        cancelled: [],
      };
      if (!allowedTransitions[order.status]?.includes(parsed.data.status)) return "invalid";

      if (parsed.data.status === "cancelled") {
        const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, order.id));
        for (const item of items) {
          await tx
            .update(variants)
            .set({ stock: sql`${variants.stock} + ${item.quantity}` })
            .where(eq(variants.id, item.variantId));
        }
      }

      await tx
        .update(orders)
        .set({ status: parsed.data.status, updatedAt: new Date() })
        .where(eq(orders.id, order.id));
      return "updated";
    });

    if (updated === "missing") return NextResponse.json({ error: "El pedido no existe." }, { status: 404 });
    if (updated === "invalid") return NextResponse.json({ error: "Ese cambio de estado no está permitido." }, { status: 409 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("No se pudo actualizar el estado del pedido.", error);
    return NextResponse.json({ error: "No se pudo actualizar el pedido." }, { status: 500 });
  }
}
