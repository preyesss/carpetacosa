import { createHymn } from "@/lib/hymns";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const title = (body.title ?? "").trim();
    if (!title) {
      return NextResponse.json({ error: "El título es obligatorio" }, { status: 400 });
    }
    const hymn = await createHymn({
      title,
      composer: body.composer?.trim() || undefined,
      hymnType: body.hymnType || undefined,
      status: body.status === "ACTIVE" ? "ACTIVE" : "BACKLOG",
    });
    return NextResponse.json({ ok: true, hymn }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Error al crear el himno" }, { status: 500 });
  }
}
