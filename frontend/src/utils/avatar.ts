export const AVATAR_PALETTES = [
  'linear-gradient(135deg, #254edb 0%, #1d3fa8 100%)', // Aegean Royal Blue
  'linear-gradient(135deg, #0f766e 0%, #0d5d56 100%)', // Pine Jade
  'linear-gradient(135deg, #d97706 0%, #b45309 100%)', // Sunlit Amber
  'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)', // Violet
  'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)', // Aegean Sky
  'linear-gradient(135deg, #be123c 0%, #9f1239 100%)', // Crimson Rose
  'linear-gradient(135deg, #4338ca 0%, #3730a3 100%)', // Deep Indigo
  'linear-gradient(135deg, #059669 0%, #047857 100%)', // Emerald
];

export function getAvatarBackground(name: string): string {
  if (!name) return AVATAR_PALETTES[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_PALETTES.length;
  return AVATAR_PALETTES[index];
}
