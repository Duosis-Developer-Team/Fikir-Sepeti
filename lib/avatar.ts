// Kişi kimliğine göre sabit renk — ana sayfadaki palet. Aynı kişi her yerde aynı renk.
export const AVATAR_COLORS = ["#F2795F", "#33C293", "#6B8CF0", "#E7A93F", "#A78BFA", "#F472B6"];

export function avatarColor(key: string): string {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

export function initial(s: string): string {
  return (s || "?").charAt(0).toLocaleUpperCase("tr");
}
