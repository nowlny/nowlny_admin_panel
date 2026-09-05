/**
 * `fetch` for public, read-only data, retried over plain HTTP when the TLS
 * handshake fails on the *certificate*.
 *
 * Small restaurant backends are routinely served off a bare IP with a chain
 * that browsers repair for themselves — they go and fetch the missing
 * intermediate — but Node does not, so `fetch` fails with
 * `UNABLE_TO_VERIFY_LEAF_SIGNATURE` on a site that works in every browser.
 * The menu is public either way; reading it over http is more honest than
 * switching certificate checking off, and the caller's private-address check
 * still holds because the host does not change.
 *
 * Only for reads like that. Never send credentials through this.
 */
export async function fetchPublic(
  input: URL | string,
  init?: RequestInit,
): Promise<Response> {
  const url = new URL(String(input));
  try {
    return await fetch(url, init);
  } catch (error) {
    if (url.protocol !== "https:" || !isCertificateError(error)) throw error;

    const insecure = new URL(url);
    insecure.protocol = "http:";
    if (insecure.port === "443") insecure.port = "";

    console.warn(
      `[fetch-public] ${url.hostname}: certificate could not be verified, reading over plain http`,
    );
    return fetch(insecure, init);
  }
}

const CERTIFICATE_ERROR =
  /CERT|UNABLE_TO_VERIFY|SELF_SIGNED|DEPTH_ZERO|ALTNAME|ERR_TLS|SSL/i;

function isCertificateError(error: unknown): boolean {
  const cause = (error as { cause?: { code?: unknown; message?: unknown } } | null)?.cause;
  const code = typeof cause?.code === "string" ? cause.code : "";
  const message = typeof cause?.message === "string" ? cause.message : "";
  return CERTIFICATE_ERROR.test(code) || CERTIFICATE_ERROR.test(message);
}
