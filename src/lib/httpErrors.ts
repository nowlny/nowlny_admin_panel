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
 * The ceilings are the providers', and they are not the same:
 *
 *  - **Gemini** inlines the document in the `generateContent` body, and that
 *    request is capped at 20 MB. Base64 inflates a file by a third, so ~14 MB
 *    of PDF is the most that fits with room left for the prompt. There is no
 *    way around it short of Google's own Files API, which is a separate flow.
 *  - **Claude** is capped at a 32 MB request the same way, but its Files API
 *    takes files up to 500 MB, costs nothing to use, and is billed identically
 *    once the tokens are read. `claudeMenu.ts` switches to it automatically for
 *    anything large, which is what lets this go to 30 MB.
 *
 * These stay sanity limits, not the host's limit. Serverless hosting rejects
 * bodies over ~4.5 MB while a self-hosted server happily takes far more, and
 * refusing a file in the browser that the server would have accepted is worse
 * than letting it try — a rejection comes back as a 413 and is explained below.
 */
export const MAX_UPLOAD_MB: Record<AiProvider, number> = {
  gemini: 14,
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
