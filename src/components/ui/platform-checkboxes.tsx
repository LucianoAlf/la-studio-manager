"use client";

const PLATFORMS = [
  { id: "instagram", label: "Instagram", icon: "📷" },
  { id: "youtube", label: "YouTube", icon: "▶️" },
  { id: "tiktok", label: "TikTok", icon: "🎵" },
  { id: "facebook", label: "Facebook", icon: "👤" },
];

interface PlatformCheckboxesProps {
  selected: string[];
  onChange: (platforms: string[]) => void;
}

export function PlatformCheckboxes({ selected, onChange }: PlatformCheckboxesProps) {
  function toggle(platform: string) {
    if (selected.includes(platform)) {
      onChange(selected.filter((p) => p !== platform));
    } else {
      onChange([...selected, platform]);
    }
  }

  return (
    <div className="flex flex-wrap gap-3">
      {PLATFORMS.map((p) => (
        <label
          key={p.id}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border cursor-pointer text-sm transition-colors ${
            selected.includes(p.id)
              ? "border-primary bg-primary/10 text-primary"
              : "border-border bg-transparent text-muted-foreground hover:border-muted-foreground"
          }`}
        >
          <input
            type="checkbox"
            checked={selected.includes(p.id)}
            onChange={() => toggle(p.id)}
            className="sr-only"
          />
          <span>{p.icon}</span>
          <span>{p.label}</span>
        </label>
      ))}
    </div>
  );
}
