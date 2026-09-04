"use client";

import Anthropic, { toFile } from "@anthropic-ai/sdk";

/**
 * Uploads a menu file from the browser straight to Claude's Files API.
 *
 * This exists because of where the admin runs: a Vercel function's request body
 * is capped at 4.5 MB, enforced at the infrastructure level and not raisable
 * from `vercel.json` or any application setting. A 29 MB menu PDF is refused
 * before `/api/parse-menu` is even invoked, so no server-side limit we choose
 * can make that upload work — the file has to skip the function entirely.
 *
 * It goes to Anthropic instead, which takes files up to 500 MB, and the scan
 * request then carries only the returned id. The operator's key is what signs
 * the upload: it is already held in this browser (AI Settings keeps it in
 * `localStorage` and sends it with every scan), so calling Anthropic from here
 * exposes nothing that wasn't exposed before. It does mean this path needs a
 * key pasted into AI Settings — a key that only exists in the server's
 * environment cannot sign a request the browser makes.
 */

/**
 * Below this, the plain upload path is fine and avoids a second round trip.
 * Base64 inflates by ~4/3, so 3 MB of file is ~4 MB of JSON body — just inside
 * what the function will accept.
 */
export const DIRECT_UPLOAD_OVER_BYTES = 3 * 1024 * 1024;

export class DirectUploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DirectUploadError";
  }
}

/** Resolves to the `file_id` the scan request should reference. */
export async function uploadMenuFileToClaude(
  file: File,
  apiKey: string,
): Promise<string> {
  if (!apiKey.trim()) {
    throw new DirectUploadError(
      "A file this large is uploaded straight to Claude, which needs your own Anthropic API key. Paste one in AI Settings.",
    );
  }

  const client = new Anthropic({
    apiKey: apiKey.trim(),
    // The key belongs to the operator and already lives in this browser; this
    // flag only tells the SDK we know it is running client-side.
    dangerouslyAllowBrowser: true,
    maxRetries: 1,
  });

  try {
    const uploaded = await client.files.upload({
      file: await toFile(file, file.name, {
        type: file.type || "application/pdf",
      }),
    });
    return uploaded.id;
  } catch (error) {
    if (error instanceof Anthropic.APIError) {
      if (error.status === 401 || error.status === 403) {
        throw new DirectUploadError(
          "Anthropic rejected that API key. Check the key in AI Settings.",
        );
      }
      throw new DirectUploadError(
        `Claude wouldn't accept that file (${error.message}).`,
      );
    }
    throw new DirectUploadError(
      "That file couldn't be sent to Claude. Check your connection and try again.",
    );
  }
}
