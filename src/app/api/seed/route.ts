import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import seedData from "../../../../scripts/seed-data.json";

export async function POST(req: NextRequest) {
  // Protect with a secret key
  const secret = req.headers.get("x-seed-secret");
  if (!process.env.SEED_SECRET || secret !== process.env.SEED_SECRET) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    // Check if already seeded
    const count = await db.hymn.count();
    if (count > 0) {
      return NextResponse.json({
        ok: false,
        message: `La DB ya tiene ${count} himnos. Para re-sembrar, elimina los datos primero.`,
      });
    }

    // Seed all hymns
    await db.hymn.createMany({
      data: seedData.map((h) => ({
        title: h.title,
        status: h.status,
        source: h.source,
        hasDemo: h.hasDemo ?? false,
        tag: h.tag ?? null,
        hymnaryNumber: h.hymnaryNumber ?? null,
        composer: h.composer ?? null,
        version: h.version ?? null,
        hymnType: h.hymnType ?? null,
        soloistNote: h.soloistNote ?? null,
        inConference2021: h.inConference2021 ?? false,
      })),
    });

    const total = await db.hymn.count();
    return NextResponse.json({
      ok: true,
      message: `Sembrados ${total} himnos exitosamente.`,
    });
  } catch (err) {
    console.error("Seed error:", err);
    return NextResponse.json({ error: "Error al sembrar" }, { status: 500 });
  }
}
