export const SUPERADMIN_EMAIL = "moh.awwad243@gmail.com";

// Edge-runtime safe quick hash (not security-grade, just obfuscation — app is small-team)
export function hashToken(s: string) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i);
  return `h_${(h >>> 0).toString(36)}`;
}
