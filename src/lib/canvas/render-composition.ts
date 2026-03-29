/**
 * Canvas Rendering Engine
 * Renderiza uma LayerComposition em um canvas HTML.
 * Stateless: recebe dados, desenha, exporta.
 */

import {
  type LayerComposition,
  type TextLayer,
  type LogoPresetPosition,
  type CropArea,
  ASPECT_RATIOS,
} from "@/lib/types/layer-composition";

// =============================================
// Smart Crop: calcula a área de crop ideal
// para encaixar a foto em qualquer proporção
// =============================================
export function computeSmartCrop(
  photoWidth: number,
  photoHeight: number,
  targetWidth: number,
  targetHeight: number,
  focalPoint: { x: number; y: number } = { x: 0.5, y: 0.5 },
): CropArea {
  const targetAR = targetWidth / targetHeight;
  const photoAR = photoWidth / photoHeight;

  let cropW: number, cropH: number;

  if (photoAR > targetAR) {
    // Foto mais larga que o target → cortar laterais
    cropH = 1;
    cropW = (photoHeight * targetAR) / photoWidth;
  } else {
    // Foto mais alta que o target → cortar topo/base
    cropW = 1;
    cropH = (photoWidth / targetAR) / photoHeight;
  }

  // Centralizar no ponto focal
  let cropX = focalPoint.x - cropW / 2;
  let cropY = focalPoint.y - cropH / 2;

  // Clampar nos limites
  cropX = Math.max(0, Math.min(cropX, 1 - cropW));
  cropY = Math.max(0, Math.min(cropY, 1 - cropH));

  return { x: cropX, y: cropY, width: cropW, height: cropH };
}

// =============================================
// Resolver posição predefinida da logo
// =============================================
function resolveLogoPosition(
  preset: LogoPresetPosition | { x: number; y: number },
  logoScale: number,
): { x: number; y: number } {
  if (typeof preset === "object") return preset;

  const margin = 0.04;
  const halfLogo = logoScale / 2;

  const positions: Record<LogoPresetPosition, { x: number; y: number }> = {
    "top-left":      { x: margin + halfLogo, y: margin + halfLogo },
    "top-center":    { x: 0.5, y: margin + halfLogo },
    "top-right":     { x: 1 - margin - halfLogo, y: margin + halfLogo },
    "bottom-left":   { x: margin + halfLogo, y: 1 - margin - halfLogo },
    "bottom-center": { x: 0.5, y: 1 - margin - halfLogo },
    "bottom-right":  { x: 1 - margin - halfLogo, y: 1 - margin - halfLogo },
  };

  return positions[preset];
}

// =============================================
// Carregar imagem com CORS
// =============================================
export function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load: ${url}`));
    img.src = url;
  });
}

// =============================================
// Carregar Google Font
// =============================================
const injectedLinks = new Set<string>();

export async function ensureFontLoaded(fontFamily: string, weight: number = 700): Promise<void> {
  // Injetar stylesheet se ainda não foi
  const linkId = `gfont-${fontFamily.replace(/\s/g, "-")}`;
  if (!injectedLinks.has(linkId)) {
    injectedLinks.add(linkId);
    if (!document.getElementById(linkId)) {
      const link = document.createElement("link");
      link.id = linkId;
      link.rel = "stylesheet";
      link.href = `https://fonts.googleapis.com/css2?family=${fontFamily.replace(/ /g, "+")}:wght@400;500;600;700;800;900&display=swap`;
      document.head.appendChild(link);
    }
  }

  // Esperar a fonte carregar via FontFace API
  try {
    await document.fonts.load(`${weight} 48px "${fontFamily}"`);
  } catch { /* fallback */ }
}

// =============================================
// Desenhar texto com word wrap
// =============================================
function drawTextLayer(
  ctx: CanvasRenderingContext2D,
  layer: TextLayer,
  canvasW: number,
  canvasH: number,
): void {
  const fontSize = Math.round(layer.fontSize * canvasW);
  const maxWidth = layer.maxWidthRatio * canvasW;
  const x = layer.position.x * canvasW;
  const y = layer.position.y * canvasH;

  ctx.save();

  // Fonte
  ctx.font = `${layer.fontWeight} ${fontSize}px "${layer.fontFamily}", sans-serif`;
  ctx.textAlign = layer.anchor;
  ctx.textBaseline = "middle";

  // Letter spacing (se definido)
  if (layer.letterSpacing) {
    (ctx as unknown as { letterSpacing: string }).letterSpacing = `${layer.letterSpacing}px`;
  }

  // Sombra
  if (layer.shadow) {
    ctx.shadowColor = layer.shadow.color;
    ctx.shadowBlur = layer.shadow.blur;
    ctx.shadowOffsetX = layer.shadow.offsetX;
    ctx.shadowOffsetY = layer.shadow.offsetY;
  }

  // Word wrap
  const words = layer.content.split(" ");
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);

  // Desenhar cada linha
  const lineHeight = fontSize * 1.2;
  const totalHeight = lines.length * lineHeight;
  const startY = y - totalHeight / 2 + lineHeight / 2;

  ctx.fillStyle = layer.color;
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], x, startY + i * lineHeight);
  }

  ctx.restore();
}

// =============================================
// RENDER: desenha todas as camadas no canvas
// =============================================
export async function renderComposition(
  canvas: HTMLCanvasElement,
  composition: LayerComposition,
  images: { photo: HTMLImageElement; logo?: HTMLImageElement | null },
): Promise<void> {
  const dims = ASPECT_RATIOS[composition.aspectRatio];
  canvas.width = dims.width;
  canvas.height = dims.height;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");

  const W = dims.width;
  const H = dims.height;

  // 1. BACKGROUND: foto com smart crop
  const crop = composition.background.cropArea;
  const srcX = crop.x * images.photo.naturalWidth;
  const srcY = crop.y * images.photo.naturalHeight;
  const srcW = crop.width * images.photo.naturalWidth;
  const srcH = crop.height * images.photo.naturalHeight;

  ctx.drawImage(images.photo, srcX, srcY, srcW, srcH, 0, 0, W, H);

  // 2. GRADIENTE (para legibilidade do texto)
  if (composition.gradient.enabled) {
    const g = composition.gradient;
    let gradient: CanvasGradient;

    if (g.direction === "bottom") {
      gradient = ctx.createLinearGradient(0, H * g.startRatio, 0, H);
    } else {
      gradient = ctx.createLinearGradient(0, H * (1 - g.startRatio), 0, 0);
    }

    gradient.addColorStop(0, `rgba(${g.color}, 0)`);
    gradient.addColorStop(1, `rgba(${g.color}, ${g.opacity})`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, W, H);
  }

  // 3. TEXTOS
  for (const textLayer of composition.textLayers) {
    await ensureFontLoaded(textLayer.fontFamily, textLayer.fontWeight);
    drawTextLayer(ctx, textLayer, W, H);
  }

  // 4. LOGO
  if (composition.logoLayer && images.logo) {
    const logo = composition.logoLayer;
    const pos = resolveLogoPosition(logo.position, logo.scale);
    const logoW = logo.scale * W;
    const logoH = (images.logo.naturalHeight / images.logo.naturalWidth) * logoW;
    const logoX = pos.x * W - logoW / 2;
    const logoY = pos.y * H - logoH / 2;

    ctx.save();
    ctx.globalAlpha = logo.opacity;
    ctx.drawImage(images.logo, logoX, logoY, logoW, logoH);
    ctx.restore();
  }
}

// =============================================
// EXPORT: renderiza e retorna Blob
// =============================================
export async function exportCompositionToBlob(
  composition: LayerComposition,
  images: { photo: HTMLImageElement; logo?: HTMLImageElement | null },
  quality: number = 0.92,
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  await renderComposition(canvas, composition, images);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Canvas toBlob failed"));
      },
      "image/jpeg",
      quality,
    );
  });
}

// =============================================
// RECOMPOSE: muda a proporção sem regenerar
// =============================================
export function recomposeForAspectRatio(
  composition: LayerComposition,
  newAspectRatio: LayerComposition["aspectRatio"],
  photoWidth: number,
  photoHeight: number,
): LayerComposition {
  const dims = ASPECT_RATIOS[newAspectRatio];
  const newCrop = computeSmartCrop(
    photoWidth,
    photoHeight,
    dims.width,
    dims.height,
    composition.background.focalPoint,
  );

  return {
    ...composition,
    aspectRatio: newAspectRatio,
    background: {
      ...composition.background,
      cropArea: newCrop,
    },
    // Textos e logo mantêm posições relativas — funcionam em qualquer proporção
  };
}
