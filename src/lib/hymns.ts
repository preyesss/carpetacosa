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
      ...(query
        ? { title: { contains: query, mode: "insensitive" } }
        : {}),
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
