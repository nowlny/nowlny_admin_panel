/**
 * Turning a failed response into something an operator can act on.
 *
 * Not every failure reaches our route handlers: an upload over the platform's
 * body limit, or a gateway timeout, is rejected upstream and answers in plain
 * text or HTML. Calling `.json()` on that throws, and the operator was shown
 * `Unexpected token 'R', "Request En"...` where the real answer was "that file
 * is too big".
 */

/** The scanner the operator picked. Each one can take a different size. */
export type AiProvider = "gemini" | "claude";

/**
 * How big a menu file each scanner can actually take, in MB of original file.
 *
 * The binding constraint is not the model — it is the host. This admin deploys
 * to Vercel, whose functions refuse a request body over **4.5 MB** at the
 * infrastructure level; it cannot be raised from `vercel.json` or any
 * application setting. Anything that travels through `/api/parse-menu` as
 * base64 is therefore capped at roughly 3 MB of original file, since base64
 * inflates by a third.
 *
 *  - **Gemini** has no way around that. Its own ceiling is higher (a 20 MB
 *    `generateContent` request, so ~14 MB of PDF), but the file has to reach
 *    our function first, and on this host it cannot.
 *  - **Claude** skips the function entirely for anything large: the browser
 *    uploads to Anthropic's Files API and the scan request carries only an id
 *    (`lib/claudeDirectUpload.ts`). That is what makes 30 MB real rather than
 *    a number we print and then fail on.
 *
 * If this ever moves off Vercel, raise `gemini` to 14 — that is the true
 * provider limit, and the only reason it is 3 here is the host.
 */
export const MAX_UPLOAD_MB: Record<AiProvider, number> = {
  gemini: 3,
  claude: 30,
};

/** The cap for whichever scanner is selected. */
export const maxUploadMb = (provider: AiProvider): number =>
  MAX_UPLOAD_MB[provider] ?? MAX_UPLOAD_MB.gemini;

export async function readErrorMessage(
  response: Response,
  fallback: string,
): Promise<string> {
  const body = await response.text().catch(() => "");

  try {
    const parsed = JSON.parse(body);
    if (parsed && typeof parsed.error === "string") return parsed.error;
  } catch {
    // Not JSON — fall through to the status-based wording below.
  }

  if (response.status === 413 || /entity too large|payload too large/i.test(body)) {
    // The host refused the body before our route saw it, so the ceiling is
    // theirs, not ours — usually ~4.5 MB on serverless hosting.
    return "That file is bigger than this server accepts for one upload. Split the PDF into fewer pages, export it at a lower quality, or paste a link to the menu instead.";
  }
  if (response.status === 504) {
    return "The scan took too long to finish. Try a smaller file, or paste a link to the menu instead.";
  }
  if (response.status === 401 || response.status === 403) {
    return "Your session expired. Sign in again and retry the scan.";
  }

  return fallback;
}
