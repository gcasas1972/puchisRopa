import { randomUUID } from "node:crypto";
import { and, eq, gte, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/db";
import { orderItems, orders, products, variants } from "@/lib/db/schema";
import { orderInputSchema } from "@/lib/validation";

class OutOfStockError extends Error {}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "La solicitud no tiene un formato válido." }, { status: 400 });
  }

  const parsed = orderInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Revisá los datos del pedido." }, { status: 400 });
  }

  try {
    const { customer, items } = parsed.data;
    const db = getDatabase();
    const orderId = randomUUID();
    const orderNumber = `PCH-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${orderId.slice(0, 6).toUpperCase()}`;

    const result = await db.transaction(async (tx) => {
      const savedItems: Array<{
        id: string;
        orderId: string;
        variantId: string;
        productName: string;
        size: string;
        unitPrice: number;
        quantity: number;
      }> = [];
      let total = 0;

      for (const item of items) {
        const [variant] = await tx
          .update(variants)
          .set({ stock: sql`${variants.stock} - ${item.quantity}` })
          .where(
            and(
              eq(variants.id, item.variantId),
              eq(variants.isActive, true),
              gte(variants.stock, item.quantity),
            ),
          )
          .returning();

        if (!variant) throw new OutOfStockError("Un talle ya no tiene stock suficiente.");
        const [product] = await tx
          .select()
          .from(products)
          .where(and(eq(products.id, variant.productId), eq(products.isActive, true)))
          .limit(1);
        if (!product) throw new OutOfStockError("Uno de los productos ya no está disponible.");

        total += product.price * item.quantity;
        savedItems.push({
          id: randomUUID(),
          orderId,
          variantId: variant.id,
          productName: product.name,
          size: variant.size,
          unitPrice: product.price,
          quantity: item.quantity,
        });
      }

      await tx.insert(orders).values({
        id: orderId,
        orderNumber,
        status: "pending",
        customerName: customer.name,
        customerEmail: customer.email.toLowerCase(),
        customerPhone: customer.phone,
        customerAddress: customer.address,
        notes: customer.notes,
        total,
      });
      await tx.insert(orderItems).values(savedItems);
      return { orderNumber, total };
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof OutOfStockError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error("No se pudo registrar el pedido.", error);
    return NextResponse.json({ error: "No se pudo registrar el pedido. Intentá nuevamente." }, { status: 500 });
  }
}
