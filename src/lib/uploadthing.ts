import { UTApi } from "uploadthing/server";

export const utapi = new UTApi();

/** MIME types que algunos sistemas reportan distinto — normaliza al estándar */
function normalizeMime(type: string, filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  if (ext === "m4a" || type === "audio/x-m4a" || type === "audio/m4a") return "audio/mp4";
  if (ext === "m4v") return "video/mp4";
  return type || "application/octet-stream";
}

export async function uploadFileToUT(
  file: File,
  filename: string
): Promise<string> {
  const mimeType = normalizeMime(file.type, filename);
  const renamedFile = new File([file], filename, { type: mimeType });
  const result = await utapi.uploadFiles(renamedFile);

  if (result.error) {
    throw new Error(`UploadThing: ${result.error.message}`);
  }
  if (!result.data) {
    throw new Error("UploadThing: no se recibió respuesta");
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const url = (result.data as any).ufsUrl ?? result.data.url;
  if (!url) {
    throw new Error("UploadThing: URL no disponible en la respuesta");
  }

  return url;
}
