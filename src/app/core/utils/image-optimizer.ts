/**
 * ImageOptimizer — Utilidad client-side para optimizar, redimensionar y comprimir
 * imágenes (Logos y OG Images) en el navegador antes de subirlas al storage.
 *
 * Evita consumir almacenamiento innecesario, ahorra ancho de banda de red y
 * optimiza dramáticamente el rendimiento de carga y el SEO de la landing page.
 */

export interface OptimizeOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  format?: 'image/jpeg' | 'image/png' | 'image/webp';
}

/**
 * Optimiza un archivo de imagen en el navegador.
 * 
 * - Si es 'logo': Limita a un tamaño máximo de 500x500 conservando el aspect-ratio
 *   y mantiene la transparencia exportando como WebP (o PNG si WebP no está soportado).
 * - Si es 'ogImage': Fuerza dimensiones exactas de 1200x630 (relación estándar de redes)
 *   haciendo un recorte centrado e inteligente (cover), y exporta como JPEG de alta calidad.
 */
export function optimizeImage(file: File, type: 'logo' | 'ogImage' | 'hero' | 'favicon'): Promise<File> {
  return new Promise((resolve, reject) => {
    // Si es un SVG, no lo optimizamos/rasterizamos (mantenemos su naturaleza vectorial intacta)
    if (file.type === 'image/svg+xml' || file.name.endsWith('.svg')) {
      return resolve(file);
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');

          if (!ctx) {
            return resolve(file); // Fallback al original si falla el canvas
          }

          let targetWidth = img.width;
          let targetHeight = img.height;
          let mimeType: 'image/jpeg' | 'image/png' | 'image/webp' = 'image/webp';
          let quality = 0.85;
          let extension = 'webp';

          if (type === 'logo') {
            // Optimización de Logo: Max 500x500 conservando el aspect-ratio y transparencia
            const maxDim = 500;
            if (targetWidth > maxDim || targetHeight > maxDim) {
              if (targetWidth > targetHeight) {
                targetHeight = Math.round((targetHeight * maxDim) / targetWidth);
                targetWidth = maxDim;
              } else {
                targetWidth = Math.round((targetWidth * maxDim) / targetHeight);
                targetHeight = maxDim;
              }
            }
            canvas.width = targetWidth;
            canvas.height = targetHeight;

            // Dibujar con suavizado
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
          } else if (type === 'hero') {
            // Optimización de Hero Background Image: Max 1920x1080 conservando aspect-ratio
            const maxDim = 1920;
            if (targetWidth > maxDim || targetHeight > maxDim) {
              if (targetWidth > targetHeight) {
                targetHeight = Math.round((targetHeight * maxDim) / targetWidth);
                targetWidth = maxDim;
              } else {
                targetWidth = Math.round((targetWidth * maxDim) / targetHeight);
                targetHeight = maxDim;
              }
            }
            canvas.width = targetWidth;
            canvas.height = targetHeight;
            mimeType = 'image/jpeg';
            quality = 0.82;
            extension = 'jpg';

            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
          } else if (type === 'favicon') {
            const maxDim = 128;
            if (targetWidth > maxDim || targetHeight > maxDim) {
              if (targetWidth > targetHeight) {
                targetHeight = Math.round((targetHeight * maxDim) / targetWidth);
                targetWidth = maxDim;
              } else {
                targetWidth = Math.round((targetWidth * maxDim) / targetHeight);
                targetHeight = maxDim;
              }
            }
            canvas.width = targetWidth;
            canvas.height = targetHeight;
            mimeType = 'image/webp';
            quality = 0.90;
            extension = 'webp';

            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
          } else {
            // Optimización de OG Image: Fuerza exactamente 1200x630 con recorte centrado (Cover)
            const requiredWidth = 1200;
            const requiredHeight = 630;
            canvas.width = requiredWidth;
            canvas.height = requiredHeight;

            mimeType = 'image/jpeg'; // JPEG es más seguro para scrapers de redes sociales (FB, WhatsApp, Twitter)
            quality = 0.82;
            extension = 'jpg';

            // Cálculo de proporciones (Aspect Ratio Cover)
            const sourceAspect = img.width / img.height;
            const targetAspect = requiredWidth / requiredHeight;
            let drawWidth = img.width;
            let drawHeight = img.height;
            let offsetX = 0;
            let offsetY = 0;

            if (sourceAspect > targetAspect) {
              // La imagen es más ancha de lo requerido
              drawWidth = img.height * targetAspect;
              offsetX = (img.width - drawWidth) / 2;
            } else {
              // La imagen es más alta de lo requerido
              drawHeight = img.width / targetAspect;
              offsetY = (img.height - drawHeight) / 2;
            }

            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(
              img,
              offsetX, offsetY, drawWidth, drawHeight, // Recorte origen
              0, 0, requiredWidth, requiredHeight      // Destino en canvas
            );
          }

          // Convertir el canvas a Blob y retornar el archivo optimizado
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                return resolve(file); // Fallback al original si falla la compresión
              }

              const cleanName = file.name
                .replace(/\.[^/.]+$/, "") // Quitar extensión vieja
                .replace(/[^a-zA-Z0-9]/g, "_") // Limpiar caracteres
                .toLowerCase();

              const optimizedFile = new File(
                [blob],
                `opt_${type}_${cleanName}.${extension}`,
                { type: mimeType, lastModified: Date.now() }
              );

              console.log(
                `⚡ [ImageOptimizer] Optimización completada para ${type}: ` +
                `Antes: ${(file.size / 1024).toFixed(1)}KB -> ` +
                `Ahora: ${(optimizedFile.size / 1024).toFixed(1)}KB ` +
                `(${(((file.size - optimizedFile.size) / file.size) * 100).toFixed(0)}% reducción)`
              );

              resolve(optimizedFile);
            },
            mimeType,
            quality
          );
        } catch (err) {
          console.error('Error optimizando la imagen en Canvas:', err);
          resolve(file); // Fallback resiliente
        }
      };
      img.onerror = () => resolve(file);
    };
    reader.onerror = () => resolve(file);
  });
}
