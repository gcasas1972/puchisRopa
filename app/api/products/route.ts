import { NextResponse } from "next/server";
import { getPublicCatalog } from "@/lib/catalog";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await getPublicCatalog(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("No se pudo cargar el catálogo público.", error);
    return NextResponse.json({ error: "No se pudo cargar el catálogo." }, { status: 500 });
  }
}
