import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

// Local-disk stand-in for the Azure Blob Storage wiring that lands in a
// later phase (see README). Saves under public/uploads so files are
// servable as plain static assets in the meantime — swap this module out
// when Blob Storage is wired up; callers only depend on the returned URL.
const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

export async function saveUploadedFile(
  file: File,
): Promise<{ url: string; name: string }> {
  await mkdir(UPLOAD_DIR, { recursive: true });

  const ext = path.extname(file.name);
  const safeBase = path
    .basename(file.name, ext)
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .slice(0, 60);
  const fileName = `${randomUUID()}-${safeBase}${ext}`;

  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(UPLOAD_DIR, fileName), buffer);

  return { url: `/uploads/${fileName}`, name: file.name };
}

export function isNonEmptyFile(value: FormDataEntryValue | null): value is File {
  return value instanceof File && value.size > 0;
}
