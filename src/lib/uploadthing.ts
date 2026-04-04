import { UTApi } from "uploadthing/server";

export const utapi = new UTApi();

export async function uploadFileToUT(
  file: File,
  filename: string
): Promise<string> {
  const renamedFile = new File([file], filename, { type: file.type });
  const result = await utapi.uploadFiles(renamedFile);

  if (result.error) {
    throw new Error(`UploadThing: ${result.error.message}`);
  }
  if (!result.data) {
    throw new Error("UploadThing: no se recibió respuesta");
  }

  // ufsUrl is the new field; url is deprecated but present in v7
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const url = (result.data as any).ufsUrl ?? result.data.url;
  if (!url) {
    throw new Error("UploadThing: URL no disponible en la respuesta");
  }

  return url;
}
