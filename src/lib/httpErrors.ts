/**
 * Turning a failed response into something an operator can act on.
 *
 * Not every failure reaches our route handlers: an upload over the platform's
 * body limit, or a gateway timeout, is rejected upstream and answers in plain
 * text or HTML. Calling `.json()` on that throws, and the operator was shown
 * `Unexpected token 'R', "Request En"...` where the real answer was "that file
 * is too big".
 */

/**
 * The point past which no host will take the upload: `/api/parse-menu` caps the
 * base64 body at `MAX_FILE_DATA_CHARS`, and base64 inflates a file by a third.
 *
 * The real ceiling is Gemini's: a `generateContent` call carrying `inlineData`
 * is capped at a 20 MB request, so 12 MB of PDF (≈16 MB once base64-encoded)
 * still leaves room for the prompt. Anything larger has to go through the Files
 * API, which is a different upload flow entirely.
 *
 * This is deliberately a sanity limit, not the platform's limit. Serverless
 * hosting rejects bodies over ~4.5 MB while a self-hosted or local server
 * happily takes far more, and refusing a file in the browser that the server
 * would have accepted is worse than letting it try — a rejection comes back as
 * a 413 and is explained below.
 */
export const MAX_UPLOAD_MB = 12;

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
