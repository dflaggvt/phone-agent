export function normalizePhoneNumber(value: string | undefined): string {
  const digits = value?.replace(/\D/g, "") ?? "";
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+${digits}`;
  }
  if (digits.length === 10) {
    return `+1${digits}`;
  }
  return digits.length > 0 ? `+${digits}` : "";
}
