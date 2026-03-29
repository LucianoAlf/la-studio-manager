/**
 * Canvas Rendering Engine v2
 * Renderiza uma LayerComposition em canvas HTML com overlays, textos e logo.
 */

import {
  type LayerComposition,
  type TextLayer,
  type LogoPresetPosition,
  type CropArea,
  type GradientLayer,
  ASPECT_RATIOS,
  deserializeComposition,
} from "@/lib/types/layer-composition";

export function computeSmartCrop(
  photoWidth: number,
  photoHeight: number,
  targetWidth: number,
  targetHeight: number,
  focalPoint: { x: number; y: number } = { x: 0.5, y: 0.5 },
): CropArea {
  const targetAR = targetWidth / targetHeight;
  const photoAR = photoWidth / photoHeight;

  let cropW: number;
  let cropH: number;

  if (photoAR > targetAR) {
    cropH = 1;
    cropW = (photoHeight * targetAR) / photoWidth;
  } else {
    cropW = 1;
    cropH = (photoWidth / targetAR) / photoHeight;
  }

  let cropX = focalPoint.x - cropW / 2;
  let cropY = focalPoint.y - cropH / 2;

  cropX = Math.max(0, Math.min(cropX, 1 - cropW));
  cropY = Math.max(0, Math.min(cropY, 1 - cropH));

  return { x: cropX, y: cropY, width: cropW, height: cropH };
}

function resolveLogoPosition(
  preset: LogoPresetPosition | { x: number; y: number },
  logoScale: number,
): { x: number; y: number } {
  if (typeof preset === "object") return preset;

  const margin = 0.04;
  const halfLogo = logoScale / 2;

  const positions: Record<LogoPresetPosition, { x: number; y: number }> = {
    "top-left": { x: margin + halfLogo, y: margin + halfLogo },
    "top-center": { x: 0.5, y: margin + halfLogo },
    "top-right": { x: 1 - margin - halfLogo, y: margin + halfLogo },
    "bottom-left": { x: margin + halfLogo, y: 1 - margin - halfLogo },
    "bottom-center": { x: 0.5, y: 1 - margin - halfLogo },
    "bottom-right": { x: 1 - margin - halfLogo, y: 1 - margin - halfLogo },
  };

  return positions[preset];
}

export function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load: ${url}`));
    img.src = url;
  });
}

const injectedLinks = new Set<string>();

export async function ensureFontLoaded(fontFamily: string, weight: number = 700): Promise<void> {
  const linkId = `gfont-${fontFamily.replace(/\s/g, "-")}`;
  if (!injectedLinks.has(linkId)) {
    injectedLinks.add(linkId);
    if (!document.getElementById(linkId)) {
      const link = document.createElement("link");
      link.id = linkId;
      link.rel = "stylesheet";
      link.href = `https://fonts.googleapis.com/css2?family=${fontFamily.replace(/ /g, "+")}:ital,wght@0,400;0,500;0,600;0,700;0,800;0,900;1,400;1,500;1,600;1,700;1,800;1,900&display=swap`;
      document.head.appendChild(link);
    }
  }

  try {
    await document.fonts.load(`${weight} 48px "${fontFamily}"`);
  } catch {
    // noop
  }
}

function rgba(color: string, opacity: number): string {
  if (color.startsWith("rgba(")) return color;
  if (color.startsWith("rgb(")) {
    return color.replace("rgb(", "rgba(").replace(")", `, ${opacity})`);
  }
  if (color.startsWith("#")) {
    const hex = color.replace("#", "");
    const normalized = hex.length === 3 ? hex.split("").map((char) => `${char}${char}`).join("") : hex;
    if (/^[0-9a-fA-F]{6}$/.test(normalized)) {
      return `rgba(${parseInt(normalized.slice(0, 2), 16)}, ${parseInt(normalized.slice(2, 4), 16)}, ${parseInt(normalized.slice(4, 6), 16)}, ${opacity})`;
    }
    return color;
  }
  return `rgba(${color}, ${opacity})`;
}

function measureTextWidth(
  ctx: CanvasRenderingContext2D,
  text: string,
  letterSpacing: number,
): number {
  if (!text) return 0;
  if (!letterSpacing) return ctx.measureText(text).width;

  const chars = Array.from(text);
  return chars.reduce((width, char, index) => {
    const charWidth = ctx.measureText(char).width;
    return width + charWidth + (index < chars.length - 1 ? letterSpacing : 0);
  }, 0);
}

function computeAlignedX(
  ctx: CanvasRenderingContext2D,
  text: string,
  anchor: TextLayer["anchor"],
  x: number,
  letterSpacing: number,
): number {
  const width = measureTextWidth(ctx, text, letterSpacing);

  if (anchor === "left") return x;
  if (anchor === "right") return x - width;
  return x - width / 2;
}

function drawSpacedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  mode: "fill" | "stroke",
  letterSpacing: number,
): void {
  if (!letterSpacing) {
    if (mode === "stroke") ctx.strokeText(text, x, y);
    else ctx.fillText(text, x, y);
    return;
  }

  let cursorX = x;
  for (const char of Array.from(text)) {
    if (mode === "stroke") ctx.strokeText(char, cursorX, y);
    else ctx.fillText(char, cursorX, y);
    cursorX += ctx.measureText(char).width + letterSpacing;
  }
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  content: string,
  maxWidth: number,
  letterSpacing: number,
): string[] {
  const words = content.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [""];

  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const candidate = currentLine ? `${currentLine} ${word}` : word;
    if (measureTextWidth(ctx, candidate, letterSpacing) > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = candidate;
    }
  }

  if (currentLine) lines.push(currentLine);
  return lines;
}

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
  const letterSpacing = layer.letterSpacing ?? 0;
  const lineHeightMultiplier = layer.lineHeight ?? 1.15;
  const lineHeight = fontSize * lineHeightMultiplier;
  const fontStyle = layer.fontStyle === "italic" ? "italic " : "";
  const transformedText = layer.textTransform === "uppercase"
    ? layer.content.toUpperCase()
    : layer.content;

  ctx.save();
  ctx.font = `${fontStyle}${layer.fontWeight} ${fontSize}px "${layer.fontFamily}", sans-serif`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";

  if (layer.shadow) {
    ctx.shadowColor = layer.shadow.color;
    ctx.shadowBlur = layer.shadow.blur;
    ctx.shadowOffsetX = layer.shadow.offsetX;
    ctx.shadowOffsetY = layer.shadow.offsetY;
  }

  const lines = wrapText(ctx, transformedText, maxWidth, letterSpacing);
  const totalHeight = lines.length * lineHeight;
  const startY = y - totalHeight / 2 + lineHeight / 2;

  ctx.fillStyle = layer.color;
  ctx.globalAlpha = typeof layer.opacity === "number" ? layer.opacity : 1;

  if (layer.stroke && layer.stroke.width > 0) {
    ctx.strokeStyle = rgba(layer.stroke.color, layer.stroke.opacity);
    ctx.lineWidth = layer.stroke.width;
    ctx.lineJoin = "round";
    ctx.miterLimit = 2;
  }

  lines.forEach((line, index) => {
    const lineX = computeAlignedX(ctx, line, layer.anchor, x, letterSpacing);
    const lineY = startY + index * lineHeight;

    if (layer.stroke && layer.stroke.width > 0) {
      drawSpacedText(ctx, line, lineX, lineY, "stroke", letterSpacing);
    }

    drawSpacedText(ctx, line, lineX, lineY, "fill", letterSpacing);
  });

  ctx.restore();
}

function drawLinearGradient(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  gradientLayer: Extract<GradientLayer, { kind: "linear" }>,
): void {
  if (!gradientLayer.enabled || gradientLayer.opacity <= 0) return;

  const gradient = gradientLayer.direction === "bottom"
    ? ctx.createLinearGradient(0, H * gradientLayer.startRatio, 0, H * gradientLayer.endRatio)
    : ctx.createLinearGradient(0, H * (1 - gradientLayer.startRatio), 0, H * (1 - gradientLayer.endRatio));

  gradient.addColorStop(0, rgba(gradientLayer.color, 0));
  gradient.addColorStop(1, rgba(gradientLayer.color, gradientLayer.opacity));
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, W, H);
}

function drawDualGradient(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  gradientLayer: Extract<GradientLayer, { kind: "dual" }>,
): void {
  if (!gradientLayer.enabled || gradientLayer.opacity <= 0) return;

  const top = ctx.createLinearGradient(0, H * gradientLayer.topStartRatio, 0, 0);
  top.addColorStop(0, rgba(gradientLayer.color, 0));
  top.addColorStop(1, rgba(gradientLayer.color, gradientLayer.opacity));
  ctx.fillStyle = top;
  ctx.fillRect(0, 0, W, H);

  const bottom = ctx.createLinearGradient(0, H * gradientLayer.bottomStartRatio, 0, H);
  bottom.addColorStop(0, rgba(gradientLayer.color, 0));
  bottom.addColorStop(1, rgba(gradientLayer.color, gradientLayer.opacity));
  ctx.fillStyle = bottom;
  ctx.fillRect(0, 0, W, H);
}

function drawVignetteGradient(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  gradientLayer: Extract<GradientLayer, { kind: "vignette" }>,
): void {
  if (!gradientLayer.enabled || gradientLayer.opacity <= 0) return;

  const centerX = W / 2;
  const centerY = H / 2;
  const maxRadius = Math.hypot(centerX, centerY);
  const innerRadius = Math.min(W, H) * gradientLayer.innerRadiusRatio;
  const outerRadius = Math.min(maxRadius, innerRadius + Math.min(W, H) * gradientLayer.feather);

  const vignette = ctx.createRadialGradient(centerX, centerY, innerRadius, centerX, centerY, outerRadius);
  vignette.addColorStop(0, rgba(gradientLayer.color, 0));
  vignette.addColorStop(1, rgba(gradientLayer.color, gradientLayer.opacity));
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, W, H);
}

function drawGradient(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  gradientLayer: GradientLayer,
): void {
  if (gradientLayer.kind === "linear") {
    drawLinearGradient(ctx, W, H, gradientLayer);
    return;
  }

  if (gradientLayer.kind === "dual") {
    drawDualGradient(ctx, W, H, gradientLayer);
    return;
  }

  drawVignetteGradient(ctx, W, H, gradientLayer);
}

export async function renderComposition(
  canvas: HTMLCanvasElement,
  composition: LayerComposition,
  images: { photo: HTMLImageElement; logo?: HTMLImageElement | null },
): Promise<void> {
  const normalized = deserializeComposition(composition);
  const dims = ASPECT_RATIOS[normalized.aspectRatio];
  canvas.width = dims.width;
  canvas.height = dims.height;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");

  const W = dims.width;
  const H = dims.height;
  const crop = normalized.background.cropArea;
  const srcX = crop.x * images.photo.naturalWidth;
  const srcY = crop.y * images.photo.naturalHeight;
  const srcW = crop.width * images.photo.naturalWidth;
  const srcH = crop.height * images.photo.naturalHeight;

  if (normalized.filters) {
    const f = normalized.filters;
    ctx.filter = `brightness(${1 + f.brightness / 100}) contrast(${1 + f.contrast / 100}) saturate(${1 + f.saturation / 100})`;
  }

  ctx.drawImage(images.photo, srcX, srcY, srcW, srcH, 0, 0, W, H);

  if (normalized.filters?.warmth && normalized.filters.warmth !== 0) {
    ctx.globalCompositeOperation = "overlay";
    ctx.globalAlpha = Math.abs(normalized.filters.warmth) / 150;
    ctx.fillStyle = normalized.filters.warmth > 0 ? "#FF8C00" : "#0066FF";
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
  }

  ctx.filter = "none";

  drawGradient(ctx, W, H, normalized.gradient);

  for (const textLayer of normalized.textLayers) {
    await ensureFontLoaded(textLayer.fontFamily, textLayer.fontWeight);
    drawTextLayer(ctx, textLayer, W, H);
  }

  if (normalized.logoLayer && images.logo) {
    const logo = normalized.logoLayer;
    const basePosition = resolveLogoPosition(logo.position, logo.scale);
    const logoW = logo.scale * W;
    const logoH = (images.logo.naturalHeight / images.logo.naturalWidth) * logoW;
    const logoX = (basePosition.x + (logo.offset?.x || 0)) * W - logoW / 2;
    const logoY = (basePosition.y + (logo.offset?.y || 0)) * H - logoH / 2;

    ctx.save();
    ctx.globalAlpha = logo.opacity;
    ctx.drawImage(images.logo, logoX, logoY, logoW, logoH);
    ctx.restore();
  }
}

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

export function recomposeForAspectRatio(
  composition: LayerComposition,
  newAspectRatio: LayerComposition["aspectRatio"],
  photoWidth: number,
  photoHeight: number,
): LayerComposition {
  const normalized = deserializeComposition(composition);
  const dims = ASPECT_RATIOS[newAspectRatio];
  const newCrop = computeSmartCrop(
    photoWidth,
    photoHeight,
    dims.width,
    dims.height,
    normalized.background.focalPoint,
  );

  return {
    ...normalized,
    aspectRatio: newAspectRatio,
    background: {
      ...normalized.background,
      cropArea: newCrop,
    },
  };
}
