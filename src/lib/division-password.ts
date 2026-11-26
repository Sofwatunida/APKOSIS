export const DIVISI_PASSWORD_MIN_LENGTH = 4;
export const DIVISI_PASSWORD_MAX_LENGTH = 128;

export function validateDivisiPassword(password: string): string | null {
  if (password.length < DIVISI_PASSWORD_MIN_LENGTH) {
    return `Password divisi minimal ${DIVISI_PASSWORD_MIN_LENGTH} karakter.`;
  }
  if (password.length > DIVISI_PASSWORD_MAX_LENGTH) {
    return `Password divisi maksimal ${DIVISI_PASSWORD_MAX_LENGTH} karakter.`;
  }
  return null;
}
