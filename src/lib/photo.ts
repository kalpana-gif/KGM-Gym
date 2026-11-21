export async function preparePhoto(file: File): Promise<{ base64: string; mime: string }> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Use a JPEG, PNG or WebP photo. Convert HEIC photos to JPEG first.');
  if (file.size > 12 * 1024 * 1024) throw new Error('Choose a photo smaller than 12 MB.');
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1024 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext('2d'); if (!context) throw new Error('Photo processing is unavailable.');
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height); bitmap.close();
  // Canvas encoding drops the source EXIF / GPS metadata.
  const url = canvas.toDataURL('image/jpeg', 0.8);
  return { base64: url.split(',')[1], mime: 'image/jpeg' };
}
