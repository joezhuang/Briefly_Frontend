export const lightColors = {
  background: "#F4F1EB",
  surface: "#F7F5EF",
  surfaceMuted: "#ECE8DE",
  text: "#171717",
  textMuted: "#67635E",
  border: "#D3CFC6",
  accent: "#8A3B12",
  accentSoft: "#9A4D28",
  white: "#FFFFFF",
  error: "#8B1E1E",
  imageFallback: "#DDD7CB",
} as const;

export const darkColors = {
  background: "#111210",
  surface: "#171815",
  surfaceMuted: "#23241F",
  text: "#F3F0E9",
  textMuted: "#B8B3A9",
  border: "#3A3B35",
  accent: "#E49A6A",
  accentSoft: "#E7A77F",
  white: "#FFFFFF",
  error: "#FF9A9A",
  imageFallback: "#2B2C27",
} as const;

export type BrieflyColors = typeof lightColors | typeof darkColors;

/**
 * Legacy static light palette. New components should prefer useBrieflyTheme().colors.
 */
export const colors = lightColors;

export const layout = {
  pageMax: 1320,
  articleMax: 860,
  pagePadding: 20,
} as const;
