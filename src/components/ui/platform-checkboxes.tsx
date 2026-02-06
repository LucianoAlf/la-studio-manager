"use client";

import { PLATFORM_ICONS } from "@/lib/constants/icons";

const PLATFORM_KEYS = ["instagram", "youtube", "tiktok", "facebook"];

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
      {PLATFORM_KEYS.map((key) => {
        const config = PLATFORM_ICONS[key];
        if (!config) return null;
        const Icon = config.icon;
        const isSelected = selected.includes(key);

        return (
          <label
            key={key}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border cursor-pointer text-sm transition-colors ${
              isSelected
                ? "border-primary/50 bg-primary/10 text-foreground"
                : "border-border bg-transparent text-muted-foreground hover:border-muted-foreground"
            }`}
          >
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => toggle(key)}
              className="sr-only"
            />
            <Icon size={16} weight="duotone" style={{ color: isSelected ? config.color : undefined }} />
            <span>{config.label}</span>
          </label>
        );
      })}
    </div>
  );
}
