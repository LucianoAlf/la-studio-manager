/**
 * birthday-canvas.ts
 * Gera post de aniversário usando Canvas API — foto EXATA do aluno, sem IA.
 * Estilo festivo: fundo gradiente, confetti, balões, moldura polaroid, texto dourado.
 */

const W = 1080;
const H = 1920;

// ── helpers ──────────────────────────────────────────────────────────

async function loadImage(url: string): Promise<HTMLImageElement> {
  // fetch via blob to avoid CORS issues with cross-origin storage
  const res = await fetch(url);
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Failed to load image"));
    };
    img.src = objectUrl;
  });
}

function randomBetween(a: number, b: number) {
  return a + Math.random() * (b - a);
}

// ── drawing helpers ──────────────────────────────────────────────────

function drawBackground(ctx: CanvasRenderingContext2D) {
  // Radial gradient purple/magenta
  const g = ctx.createRadialGradient(W / 2, H * 0.35, 80, W / 2, H * 0.35, H * 0.85);
  g.addColorStop(0, "#b03aa0");
  g.addColorStop(0.35, "#8b2a8b");
  g.addColorStop(0.65, "#5a1970");
  g.addColorStop(1, "#1e0a33");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // Subtle vignette overlay
  const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.2, W / 2, H / 2, H * 0.8);
  v.addColorStop(0, "rgba(0,0,0,0)");
  v.addColorStop(1, "rgba(0,0,0,0.35)");
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, W, H);
}

function drawBalloons(ctx: CanvasRenderingContext2D) {
  const colors = [
    "rgba(220,50,180,0.7)",  // pink
    "rgba(160,40,200,0.65)", // purple
    "rgba(255,180,40,0.6)",  // gold
    "rgba(230,80,150,0.65)", // rose
    "rgba(180,60,220,0.55)", // violet
  ];

  // Large background balloons
  const positions = [
    { x: 100, y: 200, r: 120 }, { x: 300, y: 100, r: 100 },
    { x: 800, y: 150, r: 130 }, { x: 950, y: 300, r: 110 },
    { x: 150, y: 1500, r: 100 }, { x: 900, y: 1550, r: 120 },
    { x: 50, y: 700, r: 90 }, { x: 1020, y: 800, r: 95 },
    { x: 200, y: 1700, r: 110 }, { x: 850, y: 1650, r: 105 },
    { x: 500, y: 50, r: 95 }, { x: 700, y: 1750, r: 100 },
  ];

  for (const pos of positions) {
    const color = colors[Math.floor(Math.random() * colors.length)];
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(pos.x, pos.y, pos.r * 0.8, pos.r, 0, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    // Highlight
    const hl = ctx.createRadialGradient(pos.x - pos.r * 0.3, pos.y - pos.r * 0.3, 2, pos.x, pos.y, pos.r);
    hl.addColorStop(0, "rgba(255,255,255,0.35)");
    hl.addColorStop(0.5, "rgba(255,255,255,0.05)");
    hl.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = hl;
    ctx.fill();
    // String
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y + pos.r);
    ctx.lineTo(pos.x + randomBetween(-15, 15), pos.y + pos.r + 80);
    ctx.strokeStyle = "rgba(255,255,255,0.2)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  }
}

function drawConfetti(ctx: CanvasRenderingContext2D) {
  const colors = [
    "#FFD700", "#FF69B4", "#00CED1", "#FF6347",
    "#FFE4B5", "#DDA0DD", "#F0E68C", "#FFFFFF",
    "#FF1493", "#7B68EE",
  ];

  // Scattered confetti pieces
  for (let i = 0; i < 120; i++) {
    const x = randomBetween(0, W);
    const y = randomBetween(0, H);
    const color = colors[Math.floor(Math.random() * colors.length)];
    const type = Math.random();

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(randomBetween(0, Math.PI * 2));
    ctx.globalAlpha = randomBetween(0.3, 0.8);

    if (type < 0.4) {
      // Small rectangle (confetti strip)
      ctx.fillStyle = color;
      ctx.fillRect(-3, -8, 6, 16);
    } else if (type < 0.7) {
      // Circle (dot)
      ctx.beginPath();
      ctx.arc(0, 0, randomBetween(2, 6), 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    } else {
      // Star / sparkle
      ctx.fillStyle = color;
      const s = randomBetween(3, 8);
      ctx.beginPath();
      for (let j = 0; j < 4; j++) {
        const angle = (j * Math.PI) / 2;
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(angle) * s, Math.sin(angle) * s);
      }
      ctx.lineWidth = 2;
      ctx.strokeStyle = color;
      ctx.stroke();
    }

    ctx.restore();
  }

  // Golden sparkle dots (larger, glowy)
  for (let i = 0; i < 30; i++) {
    const x = randomBetween(0, W);
    const y = randomBetween(0, H);
    const r = randomBetween(2, 5);
    ctx.save();
    ctx.globalAlpha = randomBetween(0.5, 1);
    const sg = ctx.createRadialGradient(x, y, 0, x, y, r * 3);
    sg.addColorStop(0, "rgba(255,215,0,0.9)");
    sg.addColorStop(0.5, "rgba(255,215,0,0.3)");
    sg.addColorStop(1, "rgba(255,215,0,0)");
    ctx.fillStyle = sg;
    ctx.fillRect(x - r * 3, y - r * 3, r * 6, r * 6);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = "#FFD700";
    ctx.fill();
    ctx.restore();
  }
}

function drawTitle(ctx: CanvasRenderingContext2D) {
  const text = "Feliz";
  const text2 = "Aniversário";

  // "Feliz" - script style
  ctx.save();
  ctx.textAlign = "center";

  // Shadow
  ctx.shadowColor = "rgba(0,0,0,0.5)";
  ctx.shadowBlur = 20;
  ctx.shadowOffsetY = 4;

  // "Feliz"
  ctx.font = "italic bold 90px 'Georgia', 'Times New Roman', serif";
  ctx.fillStyle = "#FFE4B5";
  ctx.fillText(text, W / 2, 200);

  // "Aniversário" - larger, more decorative
  ctx.font = "italic bold 120px 'Georgia', 'Times New Roman', serif";
  // Gold gradient
  const goldGrad = ctx.createLinearGradient(W / 2 - 300, 250, W / 2 + 300, 350);
  goldGrad.addColorStop(0, "#FFD700");
  goldGrad.addColorStop(0.3, "#FFF8DC");
  goldGrad.addColorStop(0.5, "#FFD700");
  goldGrad.addColorStop(0.7, "#FFF8DC");
  goldGrad.addColorStop(1, "#FFD700");
  ctx.fillStyle = goldGrad;
  ctx.fillText(text2, W / 2, 340);

  // Decorative line under title
  ctx.strokeStyle = "rgba(255,215,0,0.5)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(W / 2 - 200, 370);
  ctx.lineTo(W / 2 + 200, 370);
  ctx.stroke();

  ctx.restore();
}

function drawPolaroidFrame(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | null,
  initial: string,
) {
  const frameW = 580;
  const frameH = 660;
  const photoW = 530;
  const photoH = 530;
  const frameX = (W - frameW) / 2;
  const frameY = 430;
  const photoX = frameX + (frameW - photoW) / 2;
  const photoY = frameY + 20;
  const rotation = -0.04; // slight tilt

  ctx.save();
  ctx.translate(W / 2, frameY + frameH / 2);
  ctx.rotate(rotation);
  ctx.translate(-W / 2, -(frameY + frameH / 2));

  // Frame shadow
  ctx.shadowColor = "rgba(0,0,0,0.5)";
  ctx.shadowBlur = 40;
  ctx.shadowOffsetX = 8;
  ctx.shadowOffsetY = 12;

  // White polaroid frame
  ctx.fillStyle = "#FFFFFF";
  // Rounded rect (manual path for compatibility)
  const r8 = 8;
  ctx.beginPath();
  ctx.moveTo(frameX + r8, frameY);
  ctx.lineTo(frameX + frameW - r8, frameY);
  ctx.arcTo(frameX + frameW, frameY, frameX + frameW, frameY + r8, r8);
  ctx.lineTo(frameX + frameW, frameY + frameH - r8);
  ctx.arcTo(frameX + frameW, frameY + frameH, frameX + frameW - r8, frameY + frameH, r8);
  ctx.lineTo(frameX + r8, frameY + frameH);
  ctx.arcTo(frameX, frameY + frameH, frameX, frameY + frameH - r8, r8);
  ctx.lineTo(frameX, frameY + r8);
  ctx.arcTo(frameX, frameY, frameX + r8, frameY, r8);
  ctx.closePath();
  ctx.fill();

  // Reset shadow for photo
  ctx.shadowColor = "transparent";

  if (img) {
    // Draw the EXACT photo, cropped to cover the frame area
    ctx.save();
    ctx.beginPath();
    ctx.rect(photoX, photoY, photoW, photoH);
    ctx.clip();

    // Cover crop: scale to fill, center
    const imgRatio = img.width / img.height;
    const frameRatio = photoW / photoH;
    let drawW: number, drawH: number, drawX: number, drawY: number;

    if (imgRatio > frameRatio) {
      drawH = photoH;
      drawW = photoH * imgRatio;
      drawX = photoX + (photoW - drawW) / 2;
      drawY = photoY;
    } else {
      drawW = photoW;
      drawH = photoW / imgRatio;
      drawX = photoX;
      drawY = photoY + (photoH - drawH) / 2;
    }

    ctx.drawImage(img, drawX, drawY, drawW, drawH);
    ctx.restore();
  } else {
    // No photo — draw initial circle
    ctx.fillStyle = "#7B2D8E";
    ctx.fillRect(photoX, photoY, photoW, photoH);
    ctx.beginPath();
    ctx.arc(photoX + photoW / 2, photoY + photoH / 2, 150, 0, Math.PI * 2);
    ctx.fillStyle = "#9B3DAE";
    ctx.fill();
    ctx.font = "bold 180px 'Arial', sans-serif";
    ctx.fillStyle = "#FFFFFF";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(initial, photoX + photoW / 2, photoY + photoH / 2);
  }

  // Subtle inner shadow on photo area
  const innerShadow = ctx.createLinearGradient(photoX, photoY, photoX, photoY + 40);
  innerShadow.addColorStop(0, "rgba(0,0,0,0.15)");
  innerShadow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = innerShadow;
  ctx.fillRect(photoX, photoY, photoW, 40);

  ctx.restore();
}

function drawName(ctx: CanvasRenderingContext2D, firstName: string) {
  ctx.save();
  ctx.textAlign = "center";

  // Shadow
  ctx.shadowColor = "rgba(0,0,0,0.6)";
  ctx.shadowBlur = 15;
  ctx.shadowOffsetY = 4;

  // Name in bold white
  ctx.font = "bold 130px 'Arial', 'Helvetica', sans-serif";
  ctx.fillStyle = "#FFFFFF";
  ctx.fillText(firstName.toUpperCase(), W / 2, 1270);

  ctx.restore();
}

function drawBrandLogo(
  ctx: CanvasRenderingContext2D,
  logoImg: HTMLImageElement | null,
  brandName: string,
) {
  ctx.save();
  ctx.textAlign = "center";

  if (logoImg) {
    // Draw logo centered at bottom
    const maxW = 180;
    const maxH = 80;
    const ratio = Math.min(maxW / logoImg.width, maxH / logoImg.height);
    const drawW = logoImg.width * ratio;
    const drawH = logoImg.height * ratio;
    ctx.globalAlpha = 0.9;
    ctx.drawImage(logoImg, (W - drawW) / 2, 1380, drawW, drawH);
  } else {
    ctx.font = "bold 36px 'Arial', sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.fillText(brandName, W / 2, 1420);
  }

  // "Stories: @account" at bottom
  ctx.globalAlpha = 0.5;
  ctx.font = "24px 'Arial', sans-serif";
  ctx.fillStyle = "#FFFFFF";
  const account = brandName.includes("Kids") ? "@lamusickids" : "@lamusicschool";
  ctx.fillText(`Stories: ${account}`, W / 2, 1520);

  ctx.restore();
}

// ── main export ──────────────────────────────────────────────────────

export async function generateBirthdayCanvasPost(
  photoUrl: string | null,
  firstName: string,
  brandKey: string,
  logoUrl?: string | null,
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  // 1. Background
  drawBackground(ctx);

  // 2. Balloons
  drawBalloons(ctx);

  // 3. Confetti
  drawConfetti(ctx);

  // 4. Title
  drawTitle(ctx);

  // 5. Load images in parallel
  const [photoImg, logoImg] = await Promise.all([
    photoUrl ? loadImage(photoUrl).catch(() => null) : Promise.resolve(null),
    logoUrl ? loadImage(logoUrl).catch(() => null) : Promise.resolve(null),
  ]);

  // 6. Polaroid with EXACT photo
  drawPolaroidFrame(ctx, photoImg, firstName.charAt(0).toUpperCase());

  // 7. Name
  drawName(ctx, firstName);

  // 8. Brand
  const brandName = brandKey === "la_music_kids" ? "LA Music Kids" : "LA Music School";
  drawBrandLogo(ctx, logoImg, brandName);

  // 9. Export
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Canvas export failed"))),
      "image/png",
    );
  });
}
