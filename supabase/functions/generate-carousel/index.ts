import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { SLIDE_TEMPLATES } from "../nina-create-post/slide-templates.ts";

declare const Deno: {
  env: { get: (key: string) => string | undefined };
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
};

type CarouselKind = "educational" | "photo_story";
type CarouselPhotoMode = "none" | "asset" | "generated";
type CarouselSlideRole = "cover" | "hook" | "content" | "proof" | "cta";

type TemplateRow = {
  id: string;
  name: string;
  description?: string | null;
  type?: string | null;
  brand_key?: string | null;
  html_template?: string | null;
  style_config?: Record<string, unknown> | null;
  preview_url?: string | null;
};

type ReferenceRow = {
  id: string;
  image_url: string;
  name?: string | null;
};

type SlideDraft = {
  id: string;
  index: number;
  role: CarouselSlideRole;
  layoutType: string;
  templateId?: string;
  templateName?: string;
  templatePreviewUrl?: string;
  headline?: string;
  body?: string;
  cta?: string;
  summary?: string;
  photoMode: CarouselPhotoMode;
  photoAssetId?: string | null;
  photoUrl?: string | null;
  photoPrompt?: string | null;
  renderUrl?: string | null;
  previewUrl?: string | null;
  html?: string | null;
  placeholderValues?: Record<string, string> | null;
};

type ProjectDraft = {
  id: string;
  brandId: string;
  kind: CarouselKind;
  tone: string;
  brief?: string;
  caption?: string;
  cta?: string;
  coverSlideIndex: number;
  slideCount: number;
  slides: SlideDraft[];
  theme?: {
    palette?: string[];
    fontHeading?: string;
    fontBody?: string;
    logoVariant?: string;
  };
  references?: Array<{ id: string; url: string; label?: string }>;
  title?: string;
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") || "";
const TEXT_MODEL = "gemini-3-flash-preview";
const IMAGE_MODEL = "gemini-3.1-flash-image-preview";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TEMPLATE_HTML_ALIASES: Record<string, string> = {
  COVER_TEMPLATE: "cover-hero",
  STAT_TEMPLATE: "stat-highlight",
  QUOTE_TEMPLATE: "quote-proof",
  SPLIT_TEMPLATE: "split-photo-copy",
  OVERLAY_TEMPLATE: "photo-overlay",
  CTA_TEMPLATE: "cta-end",
};

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

async function fetchAsBase64(url: string): Promise<{ data: string; mime: string } | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    return { data: toBase64(new Uint8Array(buf)), mime: res.headers.get("content-type") || "image/png" };
  } catch {
    return null;
  }
}

function createId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

function normalizeWhitespace(input: string | undefined): string {
  return (input || "").replace(/\s+/g, " ").trim();
}

function trimCopy(input: string | undefined, fallback: string, limit: number): string {
  const source = normalizeWhitespace(input) || fallback;
  if (source.length <= limit) return source;
  return `${source.slice(0, Math.max(0, limit - 1)).trim()}...`;
}

function sanitizeTopic(input: string | undefined, fallback = "musica em movimento"): string {
  const raw = normalizeWhitespace(input);
  if (!raw) return fallback;
  const extracted = raw.match(/(?:sobre|tema:?|assunto:?|foco em|para falar de)\s+(.+)/i)?.[1] || raw;
  const cleaned = extracted
    .replace(/\b(crie|gere|fa[çc]a|monte|preciso de|quero|desenvolva|escreva)\b/gi, " ")
    .replace(/\b(carrossel|carousel|slide|slides|lamina|laminas|lâmina|lâminas)\b/gi, " ")
    .replace(/\b(propor[cç][aã]o|4:5|instagram|feed|story|stories|reels?)\b/gi, " ")
    .replace(/[|:]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^(de|do|da|para|com|sobre)\s+/i, "")
    .trim();
  return cleaned || fallback;
}

function shortHeadline(input: string | undefined, fallback: string): string {
  const cleaned = sanitizeTopic(input, fallback);
  if (cleaned.length <= 50) return cleaned;
  return cleaned.split(/\s+/).filter(Boolean).slice(0, 8).join(" ").slice(0, 50).trim() || fallback;
}

function normalizeSentences(input: string): string[] {
  return input
    .split(/[.!?]+/)
    .map((chunk) => normalizeWhitespace(chunk))
    .filter(Boolean);
}

function buildFallbackOutline(args: {
  brief: string;
  kind: CarouselKind;
  slideCount: number;
  cta: string;
  brandName: string;
}) {
  const topic = shortHeadline(args.brief, `Destaque da ${args.brandName}`);
  if (args.kind === "photo_story") {
    return {
      caption: `${topic}\n\nSalve este carrossel para rever depois e compartilhe com quem vai curtir esse momento musical.`,
      hashtags: ["#Musica", "#Carousel", "#LAMusicSchool"],
      slides: [
        { role: "cover", layout_type: "cover-split", headline: topic, body: "Um recorte visual forte para abrir o deck.", summary: "Capa emocional", photo_mode: "asset" },
        { role: "content", layout_type: "photo-overlay", headline: "Cena 1", body: "O olhar, o instrumento e a energia contam a história.", summary: "Primeira cena", photo_mode: "asset" },
        { role: "content", layout_type: "split-photo-copy", headline: "Cena 2", body: "Mais contexto, mais detalhe e presença de marca.", summary: "Segunda cena", photo_mode: "asset" },
        { role: "proof", layout_type: "photo-quote", headline: "Isso fala por si", body: "Quando o momento é real, o slide convence sem exagero.", summary: "Prova visual", photo_mode: "asset" },
        { role: "cta", layout_type: "cta-photo-end", headline: "Seu próximo slide pode ser aqui", body: args.cta || "Agende uma aula experimental.", cta: args.cta || "Agende uma aula experimental", summary: "CTA final", photo_mode: "none" },
      ].slice(0, args.slideCount),
    };
  }

  return {
    caption: `${topic}\n\nSalve este carrossel para rever depois e compartilhe com quem está destravando a técnica.`,
    hashtags: ["#Musica", "#EscolaDeMusica", "#LAMusicSchool"],
    slides: [
      { role: "cover", layout_type: "cover-hero", headline: topic, body: "Abra com gancho forte e promessa clara de valor.", summary: "Capa do deck", photo_mode: "none" },
      { role: "hook", layout_type: "headline-body", headline: "Por que isso importa?", body: "Contexto direto para justificar o tema do deck.", summary: "Gancho e contexto", photo_mode: "none" },
      { role: "content", layout_type: "checklist", headline: "Primeiro ajuste essencial", body: "Transforme explicação em dica acionável e simples.", summary: "Desenvolvimento 1", photo_mode: "none" },
      { role: "content", layout_type: "stat-highlight", headline: "O que muda na prática", body: "Destaque benefício, sensação e resultado percebido.", summary: "Desenvolvimento 2", photo_mode: "none" },
      { role: "proof", layout_type: "quote-proof", headline: "A prova aparece no toque", body: "Feche com prova, observação ou benefício verificável.", summary: "Prova", photo_mode: "none" },
      { role: "cta", layout_type: "cta-end", headline: "Agora é sua vez", body: args.cta || "Agende uma aula experimental.", cta: args.cta || "Agende uma aula experimental", summary: "CTA final", photo_mode: "none" },
    ].slice(0, args.slideCount),
  };
}

function buildOutlinePrompt(args: {
  brandName: string;
  kind: CarouselKind;
  brief: string;
  tone: string;
  slideCount: number;
  cta: string;
  references: ReferenceRow[];
  selectedPhotos: Array<{ id: string; url: string; label?: string }>;
}) {
  const kindLabel = args.kind === "photo_story" ? "foto-driven" : "educacional";
  const topic = sanitizeTopic(args.brief, `tema da ${args.brandName}`);
  const refs = args.references.slice(0, 3).map((item, index) => `${index + 1}. ${item.name || item.id}`).join("\n");
  const photoHint = args.selectedPhotos.length > 0
    ? `Fotos reais selecionadas: ${args.selectedPhotos.map((item) => item.label || item.id).join(", ")}.`
    : "Nenhuma foto real foi pré-selecionada.";

  return `Você é diretor criativo editorial da ${args.brandName}. Crie um deck de carrossel de Instagram 4:5.

Tipo: ${kindLabel}
Tema: ${topic}
Tom: ${args.tone}
Quantidade de slides: ${args.slideCount}
CTA final: ${args.cta}
${photoHint}
${refs ? `Referências visuais aprovadas:\n${refs}` : "Sem referências visuais explícitas."}

Regras:
- Não copie a instrução do usuário como headline.
- Nunca use "carrossel", "slide", "lâmina", "proporção" ou "instagram" no conteúdo final.
- Headlines: 2 a 8 palavras, fortes, diretas, editoriais. Devem refletir o tema pedido pelo usuário.
- Body: no máximo 25 palavras, informativo, derivado do tema real.
- O deck precisa nascer coeso, com variação real de função E layout entre slides. NÃO repita o mesmo layout em slides consecutivos.
- Slides finais devem trazer CTA explícito.
- Sugira photo_mode: "none", "asset" ou "generated".
- Use layouts compatíveis:
  educacional: cover-hero, headline-body, stat-highlight, checklist, quote-proof, cta-end
  foto-driven: cover-split, photo-overlay, split-photo-copy, photo-quote, cta-photo-end
- Para tipo educacional, VARIE entre headline-body, checklist, stat-highlight e quote-proof nos slides do meio.
- Responda só JSON válido.

Formato:
{
  "caption": "Legenda pronta",
  "hashtags": ["#tag1", "#tag2"],
  "slides": [
    {
      "role": "cover|hook|content|proof|cta",
      "layout_type": "nome-do-layout",
      "headline": "headline",
      "body": "body",
      "cta": "cta",
      "summary": "resumo curto",
      "photo_mode": "none|asset|generated",
      "photo_prompt": "opcional, só se photo_mode = generated"
    }
  ]
}`;
}

function normalizeOutlineSlides(input: unknown, kind: CarouselKind, slideCount: number) {
  const fallback = buildFallbackOutline({
    brief: "tema musical",
    kind,
    slideCount,
    cta: "Agende uma aula experimental",
    brandName: "LA Music School",
  }).slides;

  if (!Array.isArray(input)) return fallback;
  return input.slice(0, slideCount).map((item, index) => {
    const raw = typeof item === "object" && item ? item as Record<string, unknown> : {};
    const photoMode: CarouselPhotoMode = raw.photo_mode === "asset" || raw.photo_mode === "generated" || raw.photo_mode === "none"
      ? raw.photo_mode
      : fallback[index]?.photo_mode || "none";
    return {
      role: raw.role === "hook" || raw.role === "content" || raw.role === "proof" || raw.role === "cta" ? raw.role : (index === 0 ? "cover" : fallback[index]?.role || "content"),
      layout_type: typeof raw.layout_type === "string" ? raw.layout_type : fallback[index]?.layout_type || "headline-body",
      headline: shortHeadline(typeof raw.headline === "string" ? raw.headline : fallback[index]?.headline, fallback[index]?.headline || `Slide ${index + 1}`),
      body: trimCopy(typeof raw.body === "string" ? raw.body : fallback[index]?.body, fallback[index]?.body || "", 140),
      cta: trimCopy(typeof raw.cta === "string" ? raw.cta : fallback[index]?.cta, fallback[index]?.cta || "", 64),
      summary: trimCopy(typeof raw.summary === "string" ? raw.summary : fallback[index]?.summary, fallback[index]?.summary || `Slide ${index + 1}`, 48),
      photo_mode: photoMode,
      photo_prompt: typeof raw.photo_prompt === "string" ? raw.photo_prompt : undefined,
    };
  });
}

function extractStyleConfig(template?: TemplateRow | null): Record<string, unknown> {
  if (!template?.style_config || typeof template.style_config !== "object") return {};
  return template.style_config;
}

function stringValue(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;
}

function splitWords(input: string): string[] {
  return normalizeWhitespace(input).split(/\s+/).filter(Boolean);
}

// ── Claude preenche os placeholders com inteligência ──
async function generatePlaceholderValues(
  apiKey: string,
  slide: SlideDraft,
  total: number,
  brandName: string,
  layoutType: string,
): Promise<Record<string, string> | null> {
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 800,
        messages: [{
          role: "user",
          content: `Você é a diretora criativa da ${brandName}. Preencha os placeholders deste slide de carrossel de Instagram.

CONTEÚDO DO SLIDE:
- Headline: "${slide.headline || ""}"
- Body: "${slide.body || ""}"
- CTA: "${slide.cta || ""}"
- Layout: "${layoutType}"
- Role: "${slide.role}"
- Posição: slide ${slide.index + 1} de ${total}

REGRAS:
- Texto em português do Brasil, tom profissional mas próximo
- Headlines SEMPRE em MAIÚSCULAS
- Quebre as headlines de forma que faça sentido semântico (não corte palavras no meio de ideias)
- HEADLINE_L1 e HEADLINE_L2: divida a headline em 2 linhas balanceadas visualmente
- Para checklist (ITEM1/2/3): extraia 3 pontos-chave distintos do body, cada um com título curto (3-4 palavras) e explicação (1 frase)
- Para stat-highlight (BIG_NUMBER): escolha o número mais impactante ou crie um relevante para o tema
- Para quote-proof (QUOTE_L1/L2/L3): reformule a headline como frase de impacto em 3 linhas
- GHOST_WORD: escolha a palavra mais forte e visual da headline
- PILL1 e PILL2: dois conceitos-chave de 1-2 palavras relacionados ao tema
- CARD_TITLE: insight principal em no máximo 4 palavras
- CARD_TEXT: dica prática derivada do body, máximo 80 caracteres
- SLIDE_LABEL: categoria do conteúdo (ex: TÉCNICA, CONCEITO, PRÁTICA, BENEFÍCIO)
- TIP_LABEL: "DICA ${String(slide.index + 1).padStart(2, "0")}" ou variação criativa
- CTA_TEXT: "${slide.cta || "Agende uma aula experimental"}"

Retorne SOMENTE um JSON válido com estes campos (todos strings):
{
  "HEADLINE": "", "HEADLINE_L1": "", "HEADLINE_L2": "",
  "TIP_LABEL": "", "TIP_TITLE": "", "SLIDE_LABEL": "",
  "BODY_TEXT": "", "SUBTEXT": "",
  "CARD_TITLE": "", "CARD_TEXT": "",
  "ITEM1_TITLE": "", "ITEM1_SUB": "",
  "ITEM2_TITLE": "", "ITEM2_SUB": "",
  "ITEM3_TITLE": "", "ITEM3_SUB": "",
  "BIG_NUMBER": "", "UNIT_LABEL": "",
  "GHOST_WORD": "", "GHOST": "",
  "DESCRIPTION": "", "HIGHLIGHT": "",
  "QUOTE_L1": "", "QUOTE_L2": "", "QUOTE_L3": "",
  "PILL1": "", "PILL2": "",
  "H1_L1": "", "H1_L2": "", "H1_L3": "",
  "EYEBROW": "", "CTA_TEXT": ""
}`,
        }],
      }),
    });

    if (!res.ok) {
      console.error(`[GENERATE-CAROUSEL] Claude placeholder error: ${res.status}`);
      return null;
    }

    const data = await res.json();
    const text = data.content?.[0]?.text || "";
    const cleaned = text.replace(/```json|```/g, "").trim();
    return JSON.parse(cleaned);
  } catch (e) {
    console.error("[GENERATE-CAROUSEL] Claude placeholder parse error:", e);
    return null;
  }
}

// ── Aplica valores do Claude no template HTML ──
function applyClaudePlaceholders(html: string, values: Record<string, string>, fixed: {
  primary: string; secondary: string; accent: string;
  slideNum: string; brandName: string; photoUrl: string;
}): string {
  let result = html
    .replaceAll("{{PRIMARY}}", fixed.primary)
    .replaceAll("{{SECONDARY}}", fixed.secondary)
    .replaceAll("{{ACCENT}}", fixed.accent)
    .replaceAll("{{SLIDE_NUM}}", fixed.slideNum)
    .replaceAll("{{BRAND_NAME}}", fixed.brandName)
    .replaceAll("{{PHOTO_URL}}", fixed.photoUrl);

  for (const [key, val] of Object.entries(values)) {
    result = result.replaceAll(`{{${key}}}`, String(val || ""));
  }

  // Aliases que o Claude não gera mas templates podem usar
  if (values.HEADLINE) {
    result = result.replaceAll("{{H1}}", values.HEADLINE);
    result = result.replaceAll("{{H1_ACCENT}}", values.HEADLINE_L2 || "");
    result = result.replaceAll("{{DICA_NAME}}", values.TIP_TITLE || values.HEADLINE);
  }
  if (values.BODY_TEXT) {
    result = result.replaceAll("{{BODY}}", values.BODY_TEXT);
  }
  if (values.SLIDE_LABEL) {
    result = result.replaceAll("{{LABEL}}", values.SLIDE_LABEL);
    result = result.replaceAll("{{TAG}}", values.SLIDE_LABEL);
  }
  if (values.TIP_LABEL) {
    result = result.replaceAll("{{DICA_LABEL}}", values.TIP_LABEL);
    result = result.replaceAll("{{PRE}}", values.TIP_LABEL);
  }
  if (values.QUOTE_L1) {
    result = result.replaceAll("{{QUOTE_TEXT}}", `${values.QUOTE_L1} ${values.QUOTE_L2 || ""} ${values.QUOTE_L3 || ""}`.trim());
    result = result.replaceAll("{{QUOTE_LINE1}}", values.QUOTE_L1);
    result = result.replaceAll("{{QUOTE_LINE2}}", values.QUOTE_L2 || "");
    result = result.replaceAll("{{QUOTE_LINE3}}", values.QUOTE_L3 || "");
  }
  if (values.UNIT_LABEL) {
    result = result.replaceAll("{{UNIT}}", values.UNIT_LABEL);
  }

  // Limpa placeholders restantes
  result = result.replace(/\{\{[A-Z0-9_]+\}\}/g, "");
  return result;
}

// ── Fallback mecânico (usado se Claude falhar) ──
function fillTemplateFallback(html: string, args: {
  slide: SlideDraft;
  total: number;
  brandName: string;
  primary: string;
  secondary: string;
  accent: string;
  photoUrl?: string | null;
}) {
  const words = splitWords(args.slide.headline || "Título");
  const mid = Math.ceil(words.length / 2);
  const sentences = normalizeSentences(args.slide.body || "");
  const slideNum = `${String(args.slide.index + 1).padStart(2, "0")} / ${String(args.total).padStart(2, "0")}`;
  const slideLabel = args.slide.role === "cover"
    ? "CAPA"
    : args.slide.role === "hook"
      ? "GANCHO"
      : args.slide.role === "proof"
        ? "PROVA"
        : args.slide.role === "cta"
          ? "CTA"
          : "CONTEÚDO";
  const replacementMap: Record<string, string> = {
    "{{PRIMARY}}": args.primary,
    "{{SECONDARY}}": args.secondary,
    "{{ACCENT}}": args.accent,
    "{{SLIDE_NUM}}": slideNum,
    "{{SLIDE_LABEL}}": slideLabel,
    "{{LABEL}}": slideLabel,
    "{{TAG}}": slideLabel,
    "{{TIP_LABEL}}": `DICA ${String(args.slide.index + 1).padStart(2, "0")}`,
    "{{DICA_LABEL}}": `DICA ${String(args.slide.index + 1).padStart(2, "0")}`,
    "{{PRE}}": `DICA ${String(args.slide.index + 1).padStart(2, "0")}`,
    "{{TIP_TITLE}}": (args.slide.headline || "").toUpperCase(),
    "{{DICA_NAME}}": (args.slide.headline || "").toUpperCase(),
    "{{HEADLINE}}": (args.slide.headline || "").toUpperCase(),
    "{{HEADLINE_L1}}": words.slice(0, mid).join(" ").toUpperCase(),
    "{{HEADLINE_L2}}": words.slice(mid).join(" ").toUpperCase(),
    "{{H1}}": (args.slide.headline || "").toUpperCase(),
    "{{H1_ACCENT}}": words.slice(mid).join(" ").toUpperCase(),
    "{{H1_L1}}": words[0]?.toUpperCase() || "",
    "{{H1_L2}}": words[1]?.toUpperCase() || "",
    "{{H1_L3}}": words.slice(2).join(" ").toUpperCase() || "",
    "{{BODY_TEXT}}": args.slide.body || "",
    "{{BODY}}": args.slide.body || "",
    "{{SUBTEXT}}": args.slide.body || "",
    "{{BODY_STRONG}}": splitWords(args.slide.body || "").slice(0, 4).join(" "),
    "{{CARD_TITLE}}": sentences[0] || (args.slide.summary || ""),
    "{{CARD_TEXT}}": sentences.slice(1).join(". ") || args.slide.body || "",
    "{{ITEM1_TITLE}}": splitWords(sentences[0] || args.slide.body || "Ponto 1").slice(0, 4).join(" "),
    "{{ITEM1_SUB}}": sentences[0] || args.slide.body || "",
    "{{ITEM2_TITLE}}": splitWords(sentences[1] || "Ponto 2").slice(0, 4).join(" "),
    "{{ITEM2_SUB}}": sentences[1] || "",
    "{{ITEM3_TITLE}}": splitWords(sentences[2] || "Ponto 3").slice(0, 4).join(" "),
    "{{ITEM3_SUB}}": sentences[2] || "",
    "{{BIG_NUMBER}}": (args.slide.headline || "").match(/\d+/)?.[0] || String(args.slide.index + 1),
    "{{UNIT_LABEL}}": words.slice(-2).join(" ").toUpperCase() || "MÚSICA",
    "{{UNIT}}": words.slice(-2).join(" ").toUpperCase() || "MÚSICA",
    "{{GHOST_WORD}}": words[0]?.toUpperCase() || "LA",
    "{{DESCRIPTION}}": trimCopy(args.slide.body, args.slide.summary || "", 120),
    "{{HIGHLIGHT}}": words.slice(-2).join(" ").toUpperCase() || "",
    "{{QUOTE_TEXT}}": (args.slide.headline || "").toUpperCase(),
    "{{QUOTE_L1}}": words.slice(0, 3).join(" ").toUpperCase(),
    "{{QUOTE_L2}}": words.slice(3, 6).join(" ").toUpperCase(),
    "{{QUOTE_L3}}": words.slice(6).join(" ").toUpperCase(),
    "{{QUOTE_LINE1}}": words.slice(0, 3).join(" ").toUpperCase(),
    "{{QUOTE_LINE2}}": words.slice(3, 6).join(" ").toUpperCase(),
    "{{QUOTE_LINE3}}": words.slice(6).join(" ").toUpperCase(),
    "{{PILL1}}": words[0] || "Técnica",
    "{{PILL2}}": words[1] || "Resultado",
    "{{EYEBROW}}": "PRÓXIMO PASSO",
    "{{CTA_TEXT}}": args.slide.cta || "Agende uma aula",
    "{{GHOST}}": words[0]?.toUpperCase() || "LA",
    "{{PHOTO_URL}}": args.photoUrl || "",
    "{{BRAND_NAME}}": args.brandName,
  };

  let output = html;
  for (const [token, value] of Object.entries(replacementMap)) {
    output = output.replaceAll(token, value);
  }

  return output;
}

function resolveTemplateHtml(template: TemplateRow | null | undefined, fallbackName: string) {
  const raw = stringValue(template?.html_template);
  if (raw.toLowerCase().includes("<html")) return raw;
  const aliasTarget = TEMPLATE_HTML_ALIASES[raw];
  if (aliasTarget && SLIDE_TEMPLATES[aliasTarget]) return SLIDE_TEMPLATES[aliasTarget];
  if (raw && SLIDE_TEMPLATES[raw]) return SLIDE_TEMPLATES[raw];
  return SLIDE_TEMPLATES[fallbackName] || SLIDE_TEMPLATES["headline-body"];
}

function hasPhotoLayout(layoutType: string) {
  return ["cover-split", "split-photo-copy", "photo-quote", "photo-overlay", "cta-photo-end"].includes(layoutType);
}

function normalizeType(value: string | null | undefined) {
  const lower = (value || "").toLowerCase();
  if (lower.includes("cta")) return "cta";
  if (lower.includes("photo")) return "photo";
  return "typographic";
}

function getTemplateSearchNeedles(slide: SlideDraft): string[] {
  const layout = (slide.layoutType || "").toLowerCase();
  switch (layout) {
    case "cover-hero":
      return ["cover diagonal", "cover", "capa"];
    case "cover-split":
      return ["split foto direita", "split foto", "cover split", "foto direita"];
    case "headline-body":
      return ["headline body", "headline", "editorial"];
    case "checklist":
      return ["checklist"];
    case "stat-highlight":
      return ["stat numero grande", "stat número grande", "stat", "numero grande", "número grande"];
    case "quote-proof":
      return ["quote com fade", "quote", "fade", "prova"];
    case "photo-overlay":
      return ["foto overlay escuro", "photo overlay", "overlay"];
    case "cover-split":
      return ["cover diagonal rosa", "cover split", "split foto", "capa foto"];
    case "split-photo-copy":
      return ["split foto direita", "split foto", "split"];
    case "photo-quote":
      return ["quote com fade", "foto overlay escuro", "photo quote", "quote"];
    case "cta-end":
      return ["cta final rosa", "cta final", "cta"];
    case "cta-photo-end":
      return ["cta final rosa", "cta final", "cta"];
    default:
      break;
  }

  if (slide.role === "cta") return ["cta"];
  if (slide.role === "proof") return ["quote", "prova"];
  if (slide.role === "cover") return ["cover", "capa"];
  if (slide.photoMode !== "none") return ["split", "overlay", "foto"];
  return [];
}

function resolveTemplateForSlide(slide: SlideDraft, templates: TemplateRow[], fallbackBrandName: string): TemplateRow | null {
  const exact = slide.templateId ? templates.find((item) => item.id === slide.templateId) : null;
  if (exact) return exact;

  const byName = slide.templateName
    ? templates.find((item) => normalizeWhitespace(item.name).toLowerCase() === normalizeWhitespace(slide.templateName).toLowerCase())
    : null;
  if (byName) return byName;

  const desiredType = slide.role === "cta" ? "cta" : (slide.photoMode !== "none" || hasPhotoLayout(slide.layoutType) ? "photo" : "typographic");
  const needles = getTemplateSearchNeedles(slide).map((item) => item.toLowerCase());
  const brandNeedle = fallbackBrandName.toLowerCase();

  const semanticMatch = templates.find((item) => {
    const itemType = normalizeType(item.type);
    if (itemType !== desiredType) return false;
    const haystack = `${item.name || ""} ${item.description || ""}`.toLowerCase();
    return needles.some((needle) => haystack.includes(needle));
  });
  if (semanticMatch) return semanticMatch;

  const brandScopedMatch = templates.find((item) => {
    const itemType = normalizeType(item.type);
    if (itemType !== desiredType) return false;
    const haystack = `${item.name || ""} ${item.description || ""}`.toLowerCase();
    return haystack.includes(brandNeedle) && needles.some((needle) => haystack.includes(needle.split(" ")[0] || needle));
  });
  if (brandScopedMatch) return brandScopedMatch;

  return null;
}

function resolveFallbackTemplateName(slide: SlideDraft) {
  if (slide.layoutType && SLIDE_TEMPLATES[slide.layoutType]) return slide.layoutType;
  if (slide.role === "cta") return slide.photoMode !== "none" ? "cta-photo-end" : "cta-end";
  if (slide.role === "cover") return slide.photoMode !== "none" ? "cover-split" : "cover-hero";
  if (slide.photoMode !== "none") return "split-photo-copy";
  if (slide.role === "proof") return "quote-proof";
  return "headline-body";
}

function injectPhotoIntoHtml(html: string, photoUrl?: string | null) {
  if (!photoUrl) return html;
  return html.replaceAll("src=\"{{PHOTO_URL}}\"", `src="${photoUrl}"`);
}

async function renderHtmlToImage(html: string) {
  const BROWSERLESS_KEY = Deno.env.get("BROWSERLESS_API_KEY") || "";
  const browserlessRes = await fetch(`https://chrome.browserless.io/screenshot?token=${BROWSERLESS_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      html,
      options: { type: "jpeg", quality: 92, fullPage: false },
      viewport: { width: 1080, height: 1350, deviceScaleFactor: 1 },
    }),
  });

  if (!browserlessRes.ok) {
    throw new Error(`Browserless ${browserlessRes.status}: ${await browserlessRes.text()}`);
  }

  return new Uint8Array(await browserlessRes.arrayBuffer());
}

async function uploadRenderedImage(supabase: ReturnType<typeof createClient>, brand: string, projectId: string, slideIndex: number, imageBytes: Uint8Array) {
  const fileName = `carousel/${brand}/${projectId}/slide-${slideIndex + 1}.jpg`;
  const { error: upErr } = await supabase.storage.from("posts").upload(fileName, imageBytes, {
    contentType: "image/jpeg",
    upsert: true,
  });
  if (upErr) throw upErr;
  const { data } = supabase.storage.from("posts").getPublicUrl(fileName);
  return data.publicUrl;
}

async function maybeGeneratePhoto(photoPrompt: string, references: string[]) {
  if (!GEMINI_API_KEY) return null;
  const prompt = `Generate a cinematic editorial photograph for an Instagram carousel slide, 4:5 vertical.
Scene: ${photoPrompt}
Style: premium music school campaign, realistic photo, clean background, magazine-quality lighting, no text, no watermark, no graphics.
${references.length > 0 ? `Visual references: ${references.join(", ")}.` : ""}`;

  const imgRes = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${IMAGE_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseModalities: ["IMAGE", "TEXT"] },
      }),
    },
  );
  if (!imgRes.ok) return null;
  const imgData = await imgRes.json();
  let base64: string | null = null;
  for (const part of (imgData.candidates?.[0]?.content?.parts || [])) {
    if (part.inlineData?.data) {
      base64 = part.inlineData.data;
      break;
    }
  }
  if (!base64) return null;
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

async function resolvePhotoUrl(args: {
  supabase: ReturnType<typeof createClient>;
  brand: string;
  projectId: string;
  slide: SlideDraft;
  referenceUrls: string[];
}) {
  if (args.slide.photoMode === "none") return null;
  if (args.slide.photoMode === "asset") {
    if (args.slide.photoUrl) return args.slide.photoUrl;
    if (args.slide.photoAssetId) {
      const { data } = await args.supabase.from("assets").select("file_url").eq("id", args.slide.photoAssetId).single();
      return (data as { file_url?: string } | null)?.file_url || null;
    }
    return null;
  }

  const prompt = stringValue(args.slide.photoPrompt, stringValue(args.slide.summary, "close de instrumento em aula de música"));
  const bytes = await maybeGeneratePhoto(prompt, args.referenceUrls);
  if (!bytes) return args.slide.photoUrl || null;
  const fileName = `carousel/${args.brand}/${args.projectId}/generated-photo-${args.slide.index + 1}.png`;
  const { error: upErr } = await args.supabase.storage.from("posts").upload(fileName, bytes, {
    contentType: "image/png",
    upsert: true,
  });
  if (upErr) return args.slide.photoUrl || null;
  const { data } = args.supabase.storage.from("posts").getPublicUrl(fileName);
  return data.publicUrl;
}

async function fetchBrandIdentity(supabase: ReturnType<typeof createClient>, brand: string) {
  const { data } = await supabase
    .from("brand_identity")
    .select("brand_name,color_primary,color_secondary,color_accent,font_display,font_body,logo_primary_url,logo_icon_url")
    .eq("brand_key", brand)
    .single();
  return (data || null) as Record<string, unknown> | null;
}

async function fetchTemplates(supabase: ReturnType<typeof createClient>, brand: string) {
  const { data } = await supabase
    .from("carousel_templates" as never)
    .select("id,name,description,type,brand_key,html_template,style_config,preview_url")
    .eq("is_active", true)
    .eq("brand_key", brand)
    .order("name");
  return ((data || []) as TemplateRow[]);
}

async function fetchReferences(supabase: ReturnType<typeof createClient>, brand: string, ids?: string[]) {
  let query = supabase
    .from("brand_reference_templates")
    .select("id,image_url,name")
    .eq("brand_key", brand)
    .eq("category", "carousel")
    .eq("use_as_reference", true)
    .order("sort_order");

  if (ids && ids.length > 0) {
    query = query.in("id", ids);
  }

  const { data } = await query;
  return ((data || []) as ReferenceRow[]);
}

async function renderSlide(args: {
  supabase: ReturnType<typeof createClient>;
  brand: string;
  projectId: string;
  slide: SlideDraft;
  total: number;
  projectTheme?: ProjectDraft["theme"];
  templates: TemplateRow[];
  brandIdentity: Record<string, unknown> | null;
  references: ReferenceRow[];
}) {
  const template = resolveTemplateForSlide(args.slide, args.templates, stringValue(args.brandIdentity?.brand_name, args.brand));
  const styleConfig = extractStyleConfig(template);
  const brandName = stringValue(styleConfig.brandName || styleConfig.brand_name, stringValue(args.brandIdentity?.brand_name, args.brand));
  const themePalette = Array.isArray(args.projectTheme?.palette) ? args.projectTheme?.palette.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
  const primary = stringValue(styleConfig.primary || styleConfig.primaryColor || styleConfig.accent || styleConfig.color_primary, themePalette[0] || stringValue(args.brandIdentity?.color_primary, "#E8185A"));
  const secondary = stringValue(styleConfig.secondary || styleConfig.secondaryColor || styleConfig.bg || styleConfig.background, themePalette[1] || stringValue(args.brandIdentity?.color_secondary, "#0E0E0E"));
  const accent = stringValue(styleConfig.accent || styleConfig.accentColor, themePalette[2] || stringValue(args.brandIdentity?.color_accent, "#F5F2EE"));
  const photoUrl = await resolvePhotoUrl({
    supabase: args.supabase,
    brand: args.brand,
    projectId: args.projectId,
    slide: args.slide,
    referenceUrls: args.references.map((item) => item.image_url),
  });

  // Se tem foto e layout não é foto, fazer upgrade
  const slideWithPhoto = { ...args.slide, photoUrl };
  if (photoUrl && !hasPhotoLayout(args.slide.layoutType)) {
    const photoUpgrades: Record<string, string> = {
      "cover-hero": "cover-split",
      "headline-body": "split-photo-copy",
      "quote-proof": "photo-quote",
      "cta-end": "cta-photo-end",
    };
    if (photoUpgrades[args.slide.layoutType]) {
      slideWithPhoto.layoutType = photoUpgrades[args.slide.layoutType];
      console.log(`[GENERATE-CAROUSEL] Slide ${args.slide.index}: upgraded to "${slideWithPhoto.layoutType}" (has photo)`);
    }
  }

  const fallbackName = resolveFallbackTemplateName(slideWithPhoto);
  const htmlBase = resolveTemplateHtml(template, fallbackName);

  // Preencher template — usa placeholderValues do outline se disponível, senão fallback mecânico
  let html: string;
  const pv = slideWithPhoto.placeholderValues as Record<string, string> | undefined;
  if (pv && Object.keys(pv).length > 0) {
    const slideNum = `${String(args.slide.index + 1).padStart(2, "0")} / ${String(args.total).padStart(2, "0")}`;
    html = injectPhotoIntoHtml(applyClaudePlaceholders(htmlBase, pv, {
      primary, secondary, accent, slideNum, brandName, photoUrl: photoUrl || "",
    }), photoUrl);
    console.log(`[GENERATE-CAROUSEL] Slide ${args.slide.index}: smart fill (${Object.keys(pv).length} keys from outline)`);
  } else {
    html = injectPhotoIntoHtml(fillTemplateFallback(htmlBase, {
      slide: slideWithPhoto, total: args.total, brandName, primary, secondary, accent, photoUrl,
    }), photoUrl);
    console.log(`[GENERATE-CAROUSEL] Slide ${args.slide.index}: mechanical fallback fill`);
  }

  const imageBytes = await renderHtmlToImage(html);
  const renderUrl = await uploadRenderedImage(args.supabase, args.brand, args.projectId, args.slide.index, imageBytes);

  return {
    ...args.slide,
    templateId: template?.id || args.slide.templateId,
    templateName: template?.name || args.slide.templateName || fallbackName,
    templatePreviewUrl: template?.preview_url || args.slide.templatePreviewUrl,
    photoUrl,
    renderUrl,
    previewUrl: template?.preview_url || args.slide.previewUrl || renderUrl,
    html,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    const body = await req.json();
    const action = body?.action;
    const brand = stringValue(body?.brand, "la_music_school");

    if (!action) return json({ success: false, error: "action is required" }, 400);

    if (action === "outline") {
      const kind: CarouselKind = body?.kind === "photo_story" ? "photo_story" : "educational";
      const slideCount = Math.max(4, Math.min(12, Number(body?.slide_count) || (kind === "photo_story" ? 5 : 6)));
      const brief = stringValue(body?.brief, "Musica em movimento");
      const tone = stringValue(body?.tone, "profissional");
      const cta = stringValue(body?.cta, "Agende uma aula experimental");
      const brandIdentity = await fetchBrandIdentity(supabase, brand);
      const references = await fetchReferences(supabase, brand, Array.isArray(body?.reference_template_ids) ? body.reference_template_ids.filter((item: unknown): item is string => typeof item === "string") : undefined);
      const selectedPhotos = Array.isArray(body?.selected_photo_assets)
        ? body.selected_photo_assets.filter((item: unknown): item is { id: string; url: string; label?: string } => Boolean(item && typeof item === "object" && typeof (item as Record<string, unknown>).id === "string" && typeof (item as Record<string, unknown>).url === "string"))
        : [];

      if (GEMINI_API_KEY) {
        try {
          const prompt = buildOutlinePrompt({
            brandName: stringValue(brandIdentity?.brand_name, brand),
            kind,
            brief,
            tone,
            slideCount,
            cta,
            references,
            selectedPhotos,
          });

          const outlineRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${TEXT_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
            },
          );

          if (outlineRes.ok) {
            const outlineData = await outlineRes.json();
            const rawText = outlineData.candidates?.[0]?.content?.parts?.[0]?.text || "";
            const parsed = JSON.parse(rawText.replace(/```json|```/g, "").trim());
            const normalizedSlides = normalizeOutlineSlides(parsed?.slides, kind, slideCount);

            // ── UMA chamada Claude para gerar placeholders de TODOS os slides ──
            const ANTHROPIC_KEY = Deno.env.get("ANTHROPIC_API_KEY");
            const brandNameForClaude = stringValue(brandIdentity?.brand_name, brand);
            if (ANTHROPIC_KEY) {
              try {
                const slideSummaries = normalizedSlides.map((s: Record<string, unknown>, i: number) =>
                  `Slide ${i + 1} (${s.role}, layout: ${s.layout_type}): headline="${s.headline}", body="${s.body}", cta="${s.cta || ""}"`
                ).join("\n");

                const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
                  method: "POST",
                  headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01" },
                  body: JSON.stringify({
                    model: "claude-sonnet-4-6",
                    max_tokens: 2000,
                    messages: [{ role: "user", content: `Você é a diretora criativa da ${brandNameForClaude}. Gere os valores dos placeholders para TODOS os slides deste carrossel de Instagram.

SLIDES:
${slideSummaries}

Para CADA slide, gere um objeto com estes campos (todos strings, headlines em MAIÚSCULAS):
- HEADLINE, HEADLINE_L1, HEADLINE_L2: headline completa e dividida em 2 linhas balanceadas semanticamente
- TIP_LABEL: "DICA 01", "DICA 02", etc. ou variação criativa
- TIP_TITLE: headline como frase de ação
- SLIDE_LABEL: categoria (TÉCNICA, CONCEITO, PRÁTICA, BENEFÍCIO, etc.)
- BODY_TEXT, SUBTEXT: texto do body
- CARD_TITLE: insight principal em 4 palavras max
- CARD_TEXT: dica prática do body, 80 chars max
- ITEM1_TITLE, ITEM1_SUB, ITEM2_TITLE, ITEM2_SUB, ITEM3_TITLE, ITEM3_SUB: 3 pontos-chave com título curto + explicação
- BIG_NUMBER: número impactante relevante ao tema
- UNIT_LABEL: unidade/contexto do número
- GHOST_WORD, GHOST: palavra mais forte e visual
- DESCRIPTION: descrição para stat, 120 chars
- HIGHLIGHT: frase para destaque bold
- QUOTE_L1, QUOTE_L2, QUOTE_L3: headline reformulada como frase de impacto em 3 linhas
- PILL1, PILL2: dois conceitos-chave 1-2 palavras
- H1_L1, H1_L2, H1_L3: headline dividida em 3 linhas (para CTA)
- EYEBROW: "PRÓXIMO PASSO" ou similar
- CTA_TEXT: texto do CTA

Retorne SOMENTE JSON: { "slides": [ { ...campos... }, { ...campos... } ] }` }],
                  }),
                });

                if (claudeRes.ok) {
                  const claudeData = await claudeRes.json();
                  const claudeText = claudeData.content?.[0]?.text || "";
                  const claudeParsed = JSON.parse(claudeText.replace(/```json|```/g, "").trim());
                  if (Array.isArray(claudeParsed?.slides)) {
                    for (let ci = 0; ci < Math.min(claudeParsed.slides.length, normalizedSlides.length); ci++) {
                      (normalizedSlides[ci] as Record<string, unknown>).placeholder_values = claudeParsed.slides[ci];
                    }
                    console.log(`[GENERATE-CAROUSEL] Claude filled placeholders for ${claudeParsed.slides.length} slides in one call`);
                  }
                }
              } catch (claudeErr) {
                console.error("[GENERATE-CAROUSEL] Claude batch placeholder error:", claudeErr);
              }
            }

            return json({
              success: true,
              caption: typeof parsed?.caption === "string" ? parsed.caption : "",
              hashtags: Array.isArray(parsed?.hashtags) ? parsed.hashtags.filter((item: unknown): item is string => typeof item === "string") : [],
              slides: normalizedSlides,
            });
          }
        } catch (error) {
          console.error("[GENERATE-CAROUSEL] outline fallback", error);
        }
      }

      return json({ success: true, ...buildFallbackOutline({ brief, kind, slideCount, cta, brandName: stringValue(brandIdentity?.brand_name, brand) }) });
    }

    if (action === "render_deck") {
      const project = body?.project as ProjectDraft | undefined;
      if (!project || !Array.isArray(project.slides) || project.slides.length === 0) {
        return json({ success: false, error: "project.slides is required" }, 400);
      }

      const brandIdentity = await fetchBrandIdentity(supabase, brand);
      const templates = await fetchTemplates(supabase, brand);
      const references = await fetchReferences(supabase, brand, project.references?.map((item) => item.id));

      const renderedSlides: SlideDraft[] = [];
      for (const rawSlide of project.slides) {
        const slide = {
          ...rawSlide,
          id: rawSlide.id || createId("carousel-slide"),
          index: typeof rawSlide.index === "number" ? rawSlide.index : renderedSlides.length,
          photoMode: rawSlide.photoMode || (rawSlide.photoUrl ? "asset" : "none"),
        } as SlideDraft;
        const rendered = await renderSlide({
          supabase,
          brand,
          projectId: project.id || createId("carousel-project"),
          slide,
          total: project.slides.length,
          templates,
          projectTheme: project.theme,
          brandIdentity,
          references,
        });
        renderedSlides.push(rendered);
      }

      const coverIndex = Math.min(Math.max(0, Number(project.coverSlideIndex) || 0), Math.max(0, renderedSlides.length - 1));
      const slideUrls = renderedSlides.map((item) => item.renderUrl).filter((item): item is string => Boolean(item));
      return json({
        success: true,
        project: {
          ...project,
          brandId: project.brandId || brand,
          slideCount: renderedSlides.length,
          slides: renderedSlides,
          status: "generated",
          coverSlideIndex: coverIndex,
          slideUrls,
          coverUrl: renderedSlides[coverIndex]?.renderUrl || renderedSlides[0]?.renderUrl || null,
          renderedAt: new Date().toISOString(),
        },
        slides: renderedSlides.map((slide) => ({
          id: slide.id,
          index: slide.index,
          role: slide.role,
          templateId: slide.templateId,
          renderUrl: slide.renderUrl || null,
          previewUrl: slide.previewUrl || null,
          html: slide.html || null,
          errors: [],
        })),
      });
    }

    if (action === "render_slide") {
      const projectId = stringValue(body?.projectId, createId("carousel-project"));
      const rawSlide = body?.slide as SlideDraft | undefined;
      if (!rawSlide) return json({ success: false, error: "slide is required" }, 400);

      const brandIdentity = await fetchBrandIdentity(supabase, brand);
      const templates = await fetchTemplates(supabase, brand);
      const references = await fetchReferences(supabase, brand);
      const slide = {
        ...rawSlide,
        id: rawSlide.id || createId("carousel-slide"),
        index: typeof rawSlide.index === "number" ? rawSlide.index : 0,
        photoMode: rawSlide.photoMode || (rawSlide.photoUrl ? "asset" : "none"),
      } as SlideDraft;
      const rendered = await renderSlide({
        supabase,
        brand,
        projectId,
        slide,
        total: Number(body?.total) || slide.index + 1,
        templates,
        projectTheme: body?.project?.theme,
        brandIdentity,
        references,
      });
      return json({
        success: true,
        slide: rendered,
        slides: [{
          id: rendered.id,
          index: rendered.index,
          role: rendered.role,
          templateId: rendered.templateId,
          renderUrl: rendered.renderUrl || null,
          previewUrl: rendered.previewUrl || null,
          html: rendered.html || null,
          errors: [],
        }],
      });
    }

    return json({ success: false, error: `Unsupported action: ${action}` }, 400);
  } catch (error) {
    console.error("[GENERATE-CAROUSEL] fatal", error);
    return json({ success: false, error: String(error) }, 500);
  }
});
