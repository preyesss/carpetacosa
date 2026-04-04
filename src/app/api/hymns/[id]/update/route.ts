import { updateHymnMedia } from "@/lib/hymns";
import { NextResponse } from "next/server";

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const id = parseInt(params.id, 10);
  if (isNaN(id)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }
  try {
    const body = await req.json();
    const allowed = [
      "audioGeneralUrl",
      "audioGeneralType",
      "partituraPdfUrl",
      "audioSopranoUrl",
      "audioContraaltoUrl",
      "audioTenorUrl",
      "audioBajoUrl",
    ];
    const data: Record<string, string | null> = {};
    for (const key of allowed) {
      if (key in body) data[key] = body[key];
    }
    const hymn = await updateHymnMedia(id, data);
    return NextResponse.json({ ok: true, hymn });
  } catch {
    return NextResponse.json({ error: "Error al actualizar" }, { status: 500 });
  }
}
