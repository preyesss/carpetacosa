import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { updateHymnMedia } from "@/lib/hymns";

type Slot =
  | "partitura"
  | "audioGeneral"
  | "soprano"
  | "contraalto"
  | "tenor"
  | "bajo";

const SLOT_TO_FIELD: Record<Slot, string> = {
  partitura: "partituraPdfUrl",
  audioGeneral: "audioGeneralUrl",
  soprano: "audioSopranoUrl",
  contraalto: "audioContraaltoUrl",
  tenor: "audioTenorUrl",
  bajo: "audioBajoUrl",
};

const SLOT_FILENAME: Record<Slot, string> = {
  partitura: "partitura",
  audioGeneral: "audio-general",
  soprano: "demo-soprano",
  contraalto: "demo-contraalto",
  tenor: "demo-tenor",
  bajo: "demo-bajo",
};

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = parseInt(params.id, 10);
  if (isNaN(id)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  try {
    const formData = await req.formData();
    const slot = formData.get("slot") as Slot;
    const file = formData.get("file") as File | null;

    if (!slot || !(slot in SLOT_TO_FIELD)) {
      return NextResponse.json({ error: "Slot inválido" }, { status: 400 });
    }
    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "Archivo requerido" }, { status: 400 });
    }

    const ext = path.extname(file.name) || ".bin";
    const filename = `hymn-${id}-${SLOT_FILENAME[slot]}${ext}`;

    let url: string;

    if (process.env.UPLOADTHING_TOKEN) {
      // Production: upload to UploadThing
      const { uploadFileToUT } = await import("@/lib/uploadthing");
      url = await uploadFileToUT(file, filename);
    } else {
      // Local dev: save to public/uploads/
      const { default: fs } = await import("fs/promises");
      const uploadDir = path.join(process.cwd(), "public", "uploads", String(id));
      await fs.mkdir(uploadDir, { recursive: true });
      const filepath = path.join(uploadDir, filename);
      const buffer = Buffer.from(await file.arrayBuffer());
      await fs.writeFile(filepath, buffer);
      url = `/uploads/${id}/${filename}`;
    }

    // Update DB
    const fieldData: Record<string, string | null> = {
      [SLOT_TO_FIELD[slot]]: url,
    };
    if (slot === "audioGeneral") {
      fieldData["audioGeneralType"] = "file";
    }
    await updateHymnMedia(id, fieldData);

    return NextResponse.json({ ok: true, url });
  } catch (err) {
    console.error("Upload error:", err);
    return NextResponse.json({ error: "Error al subir el archivo" }, { status: 500 });
  }
}
