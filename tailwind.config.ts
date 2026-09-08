import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Centralized so "green SOLD badge" etc. stay consistent everywhere
        // rather than hardcoded hex values scattered through components.
        //
        // Palette derived from the actual logo mark (which gradients from a
        // deep green through gold/olive into a warm orange — see
        // public/brand/logo-colored.svg's fill values), each hue then
        // blended toward neutral gray rather than used at the logo's full
        // saturation — a muted, editorial feel instead of a "colorful" one,
        // while still reading unmistakably as the same brand.
        brand: {
          // Deep, muted forest green — blended from the logo's vivid
          // rgb(14,81,50)/rgb(13,82,51) greens toward neutral. Primary
          // color: buttons, links, active nav state.
          DEFAULT: "#3C5B49",
          // Muted clay/terracotta — blended from the logo's orange
          // rgb(238,99,7)/rgb(220,70,35). Secondary accent: highlights,
          // the Featured/Verified badge, warm CTAs.
          accent: "#B15E3A",
          // Muted gold/olive — blended from the logo's transitional
          // rgb(184,156,64)/rgb(216,138,53) mid-tones, where the mark
          // shifts from green to orange. Tertiary accent, paired with
          // `accent` for the Featured badge's gradient (a direct echo of
          // the logo's own green→gold→orange sweep).
          gold: "#A98A4E",
          // A darker step of `DEFAULT`, for gradient endpoints/depth
          // (SoldRibbon, SoldBanner) — keeps those on the same green as
          // everything else instead of an unrelated stock Tailwind green.
          deep: "#2D4437",
          // Very light (~12%) tints of the three brand hues over white —
          // for hover washes and section backgrounds that should read as
          // "part of this site" rather than generic gray, without
          // competing with foreground content.
          subtle: "#E8EBE9",
          accentSubtle: "#F6ECE7",
          goldSubtle: "#F5F1EA",
          // A faint (~8%) blend of all three brand hues over white — the
          // site's own warm-neutral stand-in for a plain gray page
          // background (see globals.css).
          mist: "#F5F3F0",
        },
        status: {
          active: "#2563eb",
          sold: "#16a34a",
          draft: "#94a3b8",
          pending: "#d97706",
          archived: "#6b7280",
        },
      },
    },
  },
  plugins: [],
};

export default config;
