import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/app/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // === Shadcn UI / Semantic Colors (CSS Variables) ===
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },

        // === Brand Primary (Teal Blue) - Escala numérica ===
        "brand-primary": {
          50: "#ECFBFD",
          100: "#CCF3F8",
          200: "#9AE8F0",
          300: "#5FD9E8",
          400: "#38C8DB",
          500: "#1AA8BF",
          600: "#1A8BA5",
          700: "#176E84",
          800: "#135566",
          900: "#0E3D4A",
          950: "#0A2E38",
        },

        // === Brand Accent (Warm Orange) - Escala numérica ===
        "brand-accent": {
          50: "#FFF7ED",
          100: "#FFEDD5",
          200: "#FED7AA",
          300: "#FDBA74",
          400: "#FB923C",
          500: "#F97316",
          600: "#EA580C",
          700: "#C2410C",
          800: "#9A3412",
          900: "#7C2D12",
          950: "#431407",
        },

        // === Tailwind Slate (LAperformanceReport Palette) ===
        slate: {
          50: "#f8fafc",
          100: "#f1f5f9",
          200: "#e2e8f0",
          300: "#cbd5e1",
          400: "#94a3b8",
          500: "#64748b",
          600: "#475569",
          700: "#334155",
          800: "#1e293b",
          900: "#0f172a",
          950: "#020617",
        },

        // === Accent Colors (LAperformanceReport) ===
        "accent-cyan": "#00d4ff",
        "accent-green": "#00cc66",
        "accent-pink": "#ff3366",
        "accent-yellow": "#ffaa00",
        "accent-purple": "#8b5cf6",

        // === Status Colors ===
        success: {
          100: "#DCFCE7",
          300: "#86EFAC",
          500: "#22C55E",
          700: "#15803D",
          900: "#14532D",
        },
        warning: {
          100: "#FEF3C7",
          300: "#FCD34D",
          500: "#F59E0B",
          700: "#B45309",
          900: "#78350F",
        },
        error: {
          100: "#FEE2E2",
          300: "#FCA5A5",
          500: "#EF4444",
          700: "#B91C1C",
          900: "#7F1D1D",
        },
        info: {
          100: "#CFFAFE",
          300: "#67E8F9",
          500: "#06B6D4",
          700: "#0E7490",
          900: "#164E63",
        },

        // === Platform Colors ===
        platform: {
          instagram: "#E1306C",
          youtube: "#FF0000",
          tiktok: "#00F2EA",
          facebook: "#1877F2",
          whatsapp: "#25D366",
        },

        // === Calendar Category Colors ===
        calendar: {
          event: "#F97316",
          delivery: "#EF4444",
          creation: "#1AA8BF",
          task: "#22C55E",
          meeting: "#A78BFA",
        },

        // === Agent Colors ===
        agent: {
          maestro: "#1AA8BF",
          luna: "#A78BFA",
          atlas: "#06B6D4",
          nina: "#F97316",
          theo: "#F59E0B",
          ada: "#22C55E",
        },
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "Fira Code", "monospace"],
      },
      fontSize: {
        display: ["2.25rem", { lineHeight: "1.1", letterSpacing: "-0.02em" }],
        h1: ["1.875rem", { lineHeight: "1.2", letterSpacing: "-0.02em" }],
        h2: ["1.5rem", { lineHeight: "1.25", letterSpacing: "-0.01em" }],
        h3: ["1.25rem", { lineHeight: "1.3", letterSpacing: "-0.01em" }],
        h4: ["1rem", { lineHeight: "1.35" }],
        body: ["0.875rem", { lineHeight: "1.5" }],
        "body-md": ["0.8125rem", { lineHeight: "1.5" }],
        small: ["0.75rem", { lineHeight: "1.5", letterSpacing: "0.01em" }],
        tiny: ["0.6875rem", { lineHeight: "1.4", letterSpacing: "0.02em" }],
        overline: ["0.6875rem", { lineHeight: "1.4", letterSpacing: "0.08em" }],
      },
      borderRadius: {
        sm: "0.375rem",
        md: "0.625rem",
        lg: "0.875rem",
        xl: "1.25rem",
        "2xl": "1.5rem",
      },
      boxShadow: {
        sm: "0 1px 2px 0 rgba(0, 0, 0, 0.3)",
        md: "0 4px 6px -1px rgba(0, 0, 0, 0.4), 0 2px 4px -2px rgba(0, 0, 0, 0.3)",
        lg: "0 10px 15px -3px rgba(0, 0, 0, 0.5), 0 4px 6px -4px rgba(0, 0, 0, 0.4)",
        xl: "0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.4)",
        "glow-primary": "0 0 20px rgba(26, 168, 191, 0.15)",
        "glow-accent": "0 0 20px rgba(249, 115, 22, 0.15)",
        "glow-focus": "0 0 0 3px rgba(26, 168, 191, 0.25)",
      },
      animation: {
        "fade-in": "fadeIn 200ms ease-out",
        "slide-up": "slideUp 200ms ease-out",
        "slide-down": "slideDown 200ms ease-out",
        "scale-in": "scaleIn 200ms ease-out",
        shimmer: "shimmer 2s infinite linear",
      },
      keyframes: {
        fadeIn: {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        slideUp: {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        slideDown: {
          from: { opacity: "0", transform: "translateY(-8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        scaleIn: {
          from: { opacity: "0", transform: "scale(0.95)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      transitionDuration: {
        fast: "100ms",
        normal: "150ms",
        moderate: "200ms",
        slow: "300ms",
        slower: "500ms",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
