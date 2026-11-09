import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getAdminCatalog } from "@/lib/catalog";
import { requireAdmin, validationError } from "@/lib/api";
import { getDatabase } from "@/lib/db";
import { products, variants } from "@/lib/db/schema";
import { productInputSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET() {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  try {
    return NextResponse.json(await getAdminCatalog(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("No se pudo cargar el catálogo de administración.", error);
    return NextResponse.json({ error: "No se pudo cargar el catálogo." }, { status: 500 });
  }
}

export async function POST(request: Request) {
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
    const input = parsed.data;
    const id = randomUUID();
    const db = getDatabase();
    await db.transaction(async (tx) => {
      await tx.insert(products).values({
        id,
        name: input.name,
        description: input.description,
        category: input.category,
        price: input.price,
        imageUrl: input.imageUrl,
        isActive: input.isActive,
      });
      await tx.insert(variants).values(
        input.variants.map((variant) => ({
          id: randomUUID(),
          productId: id,
          size: variant.size,
          stock: variant.stock,
        })),
      );
    });

    return NextResponse.json({ id }, { status: 201 });
  } catch (error) {
    console.error("No se pudo crear el producto.", error);
    return NextResponse.json({ error: "No se pudo guardar el producto." }, { status: 500 });
  }
}
