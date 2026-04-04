import { db } from "./db";
import type { Hymn } from "@prisma/client";

export type { Hymn };

export async function getHymns(
  status: "ACTIVE" | "BACKLOG",
  query?: string
): Promise<Hymn[]> {
  return db.hymn.findMany({
    where: {
      status,
      // SQLite/Turso: case-insensitive search via LIKE (contains is case-insensitive by default in SQLite)
      ...(query ? { title: { contains: query } } : {}),
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
