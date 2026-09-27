import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
export const uploadDirectory = fileURLToPath(
  new URL("../../uploads/", import.meta.url),
);

export async function storeImage(buffer, userId) {
  let image;
  try {
    const input = sharp(buffer, {
      limitInputPixels: 25000000,
      failOn: "error",
    });
    const metadata = await input.metadata();
    if (!["jpeg", "png", "webp"].includes(metadata.format))
      throw new Error("format");
    image = await input
      .rotate()
      .resize({
        width: 1600,
        height: 1600,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 85 })
      .toBuffer();
  } catch {
    throw Object.assign(
      new Error(
        "Wybierz poprawny plik JPG, PNG lub WebP (maks. 25 megapikseli).",
      ),
      { status: 400 },
    );
  }
  await mkdir(uploadDirectory, { recursive: true });
  const filename = `${userId}-${randomUUID()}.webp`;
  await writeFile(`${uploadDirectory}/${filename}`, image, { flag: "wx" });
  return `/uploads/${filename}`;
}
