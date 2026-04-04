import { UTApi, UTFile } from "uploadthing/server";

export const utapi = new UTApi();

export async function uploadFileToUT(
  file: File,
  filename: string
): Promise<string> {
  const blob = new Blob([await file.arrayBuffer()], { type: file.type });
  const utFile = new UTFile([blob], filename, { type: file.type });
  const response = await utapi.uploadFiles(utFile);
  if (response.error) {
    throw new Error(response.error.message);
  }
  return response.data.ufsUrl;
}
