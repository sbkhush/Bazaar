/**
 * Compresses an uploaded image file (screenshot / receipt photo) using an HTML Canvas
 * so it remains legible while safely fitting well below Firestore document limits.
 */
export async function compressPaymentProofImage(
  file: File,
  options: { maxDimension?: number; maxLength?: number } = {}
): Promise<string> {
  const maxDimension = options.maxDimension ?? 960;
  const maxLength = options.maxLength ?? 220_000;

  const mime = String(file.type || '').toLowerCase();
  const ext = String(file.name || '').toLowerCase().split('.').pop() || '';
  const isImageByExt = ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext);

  if (!mime.startsWith('image/') && !(mime === '' && isImageByExt)) {
    throw new Error('Please upload a valid image file (JPG, PNG, or WebP).');
  }

  // Max raw file guard (10MB)
  if (file.size > 10 * 1024 * 1024) {
    throw new Error('Image file is too large (max 10 MB). Please choose a smaller screenshot.');
  }

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to read selected image file.'));
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Could not decode the selected image.'));
    image.src = dataUrl;
  });

  let width = img.naturalWidth || img.width;
  let height = img.naturalHeight || img.height;

  if (width > maxDimension || height > maxDimension) {
    if (width >= height) {
      height = Math.round((height * maxDimension) / width);
      width = maxDimension;
    } else {
      width = Math.round((width * maxDimension) / height);
      height = maxDimension;
    }
  }

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Image compression is unavailable in this browser.');
  }

  let quality = 0.78;
  let scale = 1;
  let output = '';

  for (let attempt = 0; attempt < 5; attempt++) {
    const targetW = Math.max(240, Math.round(width * scale));
    const targetH = Math.max(240, Math.round(height * scale));
    canvas.width = targetW;
    canvas.height = targetH;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, targetW, targetH);
    ctx.drawImage(img, 0, 0, targetW, targetH);

    output = canvas.toDataURL('image/jpeg', quality);
    if (output.length <= maxLength) {
      return output;
    }
    quality = Math.max(0.4, quality - 0.12);
    scale = scale * 0.8;
  }

  if (output.length > 280_000) {
    throw new Error('Payment proof image is still too large after compression. Please use a clearer cropped screenshot.');
  }

  return output;
}
