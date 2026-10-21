/**
 * Longest side of a stored patient photo, in pixels. Photos are shown at 40–120 px, so this leaves
 * plenty of room for high-resolution screens.
 */
export const PHOTO_MAX_DIMENSION = 640;
const JPEG_QUALITY = 0.85;

/**
 * Shrinks a photo before it's uploaded: scales the longest side down to PHOTO_MAX_DIMENSION (never up),
 * applies the camera's rotation, and re-saves it as JPEG without metadata such as GPS location.
 * A 4 MB phone photo becomes roughly 50–100 KB, which matters on slow facility Wi-Fi.
 *
 * If the browser can't read the image, the original file is returned and the server's own checks apply.
 */
export async function shrinkPhoto(file: File): Promise<File> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    return file;
  }

  try {
    const scale = Math.min(1, PHOTO_MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;

    // JPEG has no transparency: give transparent PNGs a white background instead of black
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY));
    if (!blob) return file;

    const baseName = file.name.replace(/\.[^.]+$/, '') || 'photo';
    return new File([blob], `${baseName}.jpg`, { type: 'image/jpeg' });
  } finally {
    bitmap.close();
  }
}
