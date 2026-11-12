import { randomUUID } from "node:crypto";
import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api";

const maxImageSize = 5 * 1024 * 1024;
const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

function hasExpectedSignature(type: string, buffer: Buffer) {
  if (type === "image/jpeg") return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (type === "image/png") return buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (type === "image/webp") {
    return buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP";
  }
  return false;
}

export async function POST(request: Request) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: "Falta configurar Vercel Blob para subir imágenes." }, { status: 503 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (file === null || typeof file === "string") {
      return NextResponse.json({ error: "Elegí una imagen para subir." }, { status: 400 });
    }
    if (!allowedTypes.has(file.type)) {
      return NextResponse.json({ error: "Usá una imagen JPG, PNG o WebP." }, { status: 400 });
    }
    if (file.size === 0 || file.size > maxImageSize) {
      return NextResponse.json({ error: "La imagen debe pesar menos de 5 MB." }, { status: 400 });
    }
    const bytes = Buffer.from(await file.arrayBuffer());
    if (!hasExpectedSignature(file.type, bytes)) {
      return NextResponse.json({ error: "El archivo no coincide con el formato de imagen seleccionado." }, { status: 400 });
    }

    const extension = file.type === "image/jpeg" ? "jpg" : file.type.split("/")[1];
    const blob = await put(`products/${randomUUID()}.${extension}`, file, {
      access: "public",
      addRandomSuffix: false,
      contentType: file.type,
    });
    return NextResponse.json({ url: blob.url }, { status: 201 });
  } catch (error) {
    console.error("No se pudo subir la imagen del producto.", error);
    return NextResponse.json({ error: "No se pudo subir la imagen." }, { status: 500 });
  }
}
