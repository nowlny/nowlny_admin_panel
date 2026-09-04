/**
 * Lebanese phone numbers.
 *
 * The API stores and matches numbers in E.164 (`+96176049018` — see any
 * restaurant record), and the owner phone on a merchant is what the account is
 * looked up by, so a number saved without its country code doesn't just render
 * oddly: it fails to link the owner account. `LoginScreen` already normalises
 * what an operator types this way; this is the same rule, shared.
 */

export const LEBANON_DIAL_CODE = "+961";

/** Digits only — what the national part of a number looks like once cleaned. */
export function nationalDigits(input: string): string {
  const digits = input.replace(/\D/g, "");
  // Accept a full number pasted in any of the shapes an operator copies from:
  // `+961 76 049 018`, `961...`, `0096176049018`, or the local `076049018`.
  if (digits.startsWith("00961")) return digits.slice(5).replace(/^0+/, "");
  if (digits.startsWith("961")) return digits.slice(3).replace(/^0+/, "");
  return digits.replace(/^0+/, "");
}

/** `"76 049 018"` → `"+96176049018"`; blank stays blank so it can be omitted. */
export function toInternationalPhone(input: string): string {
  const digits = nationalDigits(input);
  return digits ? `${LEBANON_DIAL_CODE}${digits}` : "";
}

/** The inverse, for prefilling the field from a stored `+961…` number. */
export function toNationalPhone(stored: string | null | undefined): string {
  return stored ? nationalDigits(stored) : "";
}
