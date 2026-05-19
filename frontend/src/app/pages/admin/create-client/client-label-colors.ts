/** Must match backend {@code ClientLabelColors} allowlist. */
export const CLIENT_LABEL_COLOR_PALETTE = [
  '#e11d48',
  '#f472b6',
  '#fb923c',
  '#facc15',
  '#84cc16',
  '#10b981',
  '#0ea5e9',
  '#3b82f6',
  '#8b5cf6',
  '#a78bfa',
] as const;

export type ClientLabelColorHex = (typeof CLIENT_LABEL_COLOR_PALETTE)[number];

const ALLOWED = new Set<string>(CLIENT_LABEL_COLOR_PALETTE);

export const DEFAULT_CLIENT_LABEL_COLOR: ClientLabelColorHex = '#3b82f6';

export function resolvedClientLabelColor(hex: string | null | undefined): ClientLabelColorHex {
  if (!hex) return DEFAULT_CLIENT_LABEL_COLOR;
  const lower = hex.trim().toLowerCase();
  return (ALLOWED.has(lower) ? lower : DEFAULT_CLIENT_LABEL_COLOR) as ClientLabelColorHex;
}
