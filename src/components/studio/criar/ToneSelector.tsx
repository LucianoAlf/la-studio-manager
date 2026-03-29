"use client";

import type { CaptionTone } from "@/stores/create-post-store";

const TONES: { key: CaptionTone; label: string; icon: string }[] = [
  { key: "inspirador", label: "Inspirador", icon: "✨" },
  { key: "divertido", label: "Divertido", icon: "🎉" },
  { key: "profissional", label: "Profissional", icon: "💼" },
  { key: "comemorativo", label: "Comemorativo", icon: "🎂" },
  { key: "educativo", label: "Educativo", icon: "📚" },
];

interface Props {
  activeTones: CaptionTone[];
  onChange: (tones: CaptionTone[]) => void;
  maxActive?: number;
}

export function ToneSelector({ activeTones, onChange, maxActive = 3 }: Props) {
  const toggle = (tone: CaptionTone) => {
    if (activeTones.includes(tone)) {
      onChange(activeTones.filter((t) => t !== tone));
    } else if (activeTones.length < maxActive) {
      onChange([...activeTones, tone]);
    } else {
      // Substitui o primeiro pelo novo
      onChange([...activeTones.slice(1), tone]);
    }
  };

  return (
    <div className="flex flex-wrap gap-1.5">
      {TONES.map((t) => (
        <button
          key={t.key}
          type="button"
          onClick={() => toggle(t.key)}
          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
            activeTones.includes(t.key)
              ? "bg-cyan-600 text-white"
              : "bg-slate-800 text-slate-400 hover:bg-slate-700"
          }`}
        >
          {t.icon} {t.label}
        </button>
      ))}
    </div>
  );
}
