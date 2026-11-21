// Browser-only: resizes and re-encodes a photo before upload (ADR 0009).
// Re-encoding through a canvas drops EXIF metadata (GPS position, device, timestamps),
// so a student's exact location is never uploaded, and keeps uploads small.

const MAX_DIMENSION = 1280;
const JPEG_QUALITY = 0.82;

export async function prepareLandmarkPhoto(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/")) throw new Error("Choose an image file.");

  let bitmap: ImageBitmap;
  try {
    // Respect the camera's orientation flag before it's stripped.
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error("This image format isn't supported here. Try a JPEG or PNG photo.");
  }

  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Couldn't process the photo in this browser.");
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Couldn't process the photo."))),
      "image/jpeg",
      JPEG_QUALITY,
    );
  });
}
