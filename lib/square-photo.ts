// Browser-only: crops a chosen photo to a centred square and re-encodes it as JPEG, which drops
// EXIF data such as GPS location (ADR 0009). Used for creator profile photos (ADR 0045).

export const PHOTO_SIZE = 400;

export async function prepareSquarePhoto(file: File, size = PHOTO_SIZE): Promise<Blob> {
  if (!file.type.startsWith("image/")) throw new Error("Choose an image file.");
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error("This image format isn't supported here. Try a JPEG or PNG photo.");
  }
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Couldn't process the photo in this browser.");
  context.imageSmoothingQuality = "high";
  context.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size);
  bitmap.close();
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Couldn't process the photo."))), "image/jpeg", 0.85);
  });
}
