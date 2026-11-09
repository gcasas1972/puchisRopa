import { del } from "@vercel/blob";
import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { requireAdmin, validationError } from "@/lib/api";
import { getDatabase } from "@/lib/db";
import { products, variants } from "@/lib/db/schema";
import { productInputSchema } from "@/lib/validation";

type RouteContext = { params: Promise<{ id: string }> };

function isVercelBlobUrl(url: string) {
  try {
    const hostname = new URL(url).hostname;
    return hostname.endsWith(".public.blob.vercel-storage.com") || hostname.endsWith(".blob.vercel-storage.com");
  } catch {
    return false;
  }
}

export async function PUT(request: Request, context: RouteContext) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return validationError("La solicitud no tiene un formato válido.");
  }

  const parsed = productInputSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error.issues[0]?.message ?? "Revisá los datos del producto.");

  try {
    const { id } = await context.params;
    const input = parsed.data;
    const db = getDatabase();
    const [existing] = await db.select().from(products).where(eq(products.id, id)).limit(1);
    if (!existing) return NextResponse.json({ error: "El producto no existe." }, { status: 404 });

    await db.transaction(async (tx) => {
      await tx
        .update(products)
        .set({
          name: input.name,
          description: input.description,
          category: input.category,
          price: input.price,
          imageUrl: input.imageUrl,
          isActive: input.isActive,
          updatedAt: new Date(),
        })
        .where(eq(products.id, id));

      await tx.update(variants).set({ isActive: false }).where(eq(variants.productId, id));
      await tx
        .insert(variants)
        .values(
          input.variants.map((variant) => ({
            id: randomUUID(),
            productId: id,
            size: variant.size,
            stock: variant.stock,
            isActive: true,
          })),
        )
        .onConflictDoUpdate({
          target: [variants.productId, variants.size],
          set: { stock: sql`excluded.stock`, isActive: true },
        });
    });

    let warning: string | undefined;
    if (existing.imageUrl !== input.imageUrl && isVercelBlobUrl(existing.imageUrl)) {
      try {
        await del(existing.imageUrl);
      } catch (error) {
        console.error("El producto se actualizó, pero no se pudo eliminar su imagen anterior.", error);
        warning = "El producto se guardó, pero no se pudo quitar la foto anterior.";
      }
    }

    return NextResponse.json({ ok: true, warning });
  } catch (error) {
    console.error("No se pudo actualizar el producto.", error);
    return NextResponse.json({ error: "No se pudo actualizar el producto." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  try {
    const { id } = await context.params;
    const db = getDatabase();
    const [product] = await db.select({ id: products.id }).from(products).where(eq(products.id, id)).limit(1);
    if (!product) return NextResponse.json({ error: "El producto no existe." }, { status: 404 });

    await db.transaction(async (tx) => {
      await tx
        .update(products)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(products.id, id));
      await tx.update(variants).set({ isActive: false }).where(and(eq(variants.productId, id), eq(variants.isActive, true)));
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("No se pudo archivar el producto.", error);
    return NextResponse.json({ error: "No se pudo archivar el producto." }, { status: 500 });
  }
}
