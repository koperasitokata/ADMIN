
/**
 * Utilitas untuk kompresi gambar di sisi klien
 * Membantu mengurangi ukuran payload Base64 sebelum dikirim ke server/GAS
 */

export const compressImage = (base64: string, maxWidth = 180, maxHeight = 180, quality = 0.6): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = base64;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxWidth) {
          height *= maxWidth / width;
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width *= maxHeight / height;
          height = maxHeight;
        }
      }
      
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error("Gagal mendapatkan context canvas"));
        return;
      }
      
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      
      const result = canvas.toDataURL('image/jpeg', quality);
      console.log(`[ImageUtils] Compressed size: ${result.length} chars`);
      resolve(result);
    };
    img.onerror = (err) => reject(err);
  });
};

export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
};
