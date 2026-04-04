import { db } from "./db";
import type { Hymn } from "@prisma/client";

export type { Hymn };

export type MissingFilter = "partitura" | "audio" | "demos";

export async function getHymns(
  status: "ACTIVE" | "BACKLOG",
  query?: string,
  missing?: MissingFilter[]
): Promise<Hymn[]> {
  const missingFilters: Record<string, unknown>[] = [];

  if (missing?.includes("partitura")) {
    missingFilters.push({ partituraPdfUrl: null });
  }
  if (missing?.includes("audio")) {
    missingFilters.push({ audioGeneralUrl: null });
  }
  if (missing?.includes("demos")) {
    missingFilters.push({
      audioSopranoUrl: null,
      audioContraaltoUrl: null,
      audioTenorUrl: null,
      audioBajoUrl: null,
    });
  }

  return db.hymn.findMany({
    where: {
      status,
      ...(query ? { title: { contains: query } } : {}),
      ...(missingFilters.length > 0 ? { AND: missingFilters } : {}),
    },
    orderBy: { title: "asc" },
  });
}

export async function getHymn(id: number): Promise<Hymn | null> {
  return db.hymn.findUnique({ where: { id } });
}

export async function activateHymn(id: number): Promise<Hymn> {
  return db.hymn.update({
    where: { id },
    data: { status: "ACTIVE" },
  });
}

export async function updateHymnMedia(
  id: number,
  data: Partial<
    Pick<
      Hymn,
      | "partituraPdfUrl"
      | "audioGeneralUrl"
      | "audioGeneralType"
      | "audioSopranoUrl"
      | "audioContraaltoUrl"
      | "audioTenorUrl"
      | "audioBajoUrl"
    >
  >
): Promise<Hymn> {
  return db.hymn.update({ where: { id }, data });
}
