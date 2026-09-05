/**
 * Pulling the JSON body out of what an operator actually pastes.
 *
 * Nobody pastes a bare response. What lands in the box is whatever devtools'
 * "Copy as cURL" and a copied response produce together:
 *
 *     curl --url 'https://site.com/api/menu' \
 *       -H 'Accept: application/json' \
 *       -H 'sec-ch-ua-platform: "macOS"'{"categories":[ … ]}
 *
 * `JSON.parse` refuses all of that for the sake of the first line, and the
 * import then looks like a button that does nothing. So the body is found and
 * read on its own: everything before the first `{` or `[` is dropped, and the
 * scan stops at that bracket's own match rather than at the end of the paste,
 * so trailing noise is dropped too.
 */

/**
 * The JSON value inside `raw`, as text, or null when there isn't one.
 *
 * Returns the source text rather than the parsed value so the caller can hand
 * the exact bytes on to the server, which parses it again on its own.
 *
 * Two rules decide which value comes back when the paste holds more than one:
 *
 *  - **The longest wins.** Someone comparing two endpoints pastes both, and
 *    the menu is the big one; the sections/settings payload above it is not
 *    what they meant to import.
 *  - **An unclosed bracket ends the search.** Everything after it is inside a
 *    structure that was cut off, so any complete-looking object found in there
 *    is one slice of a menu — importing it as the menu is worse than saying
 *    the paste is truncated.
 */
export function extractJsonPayload(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // The overwhelmingly common case: someone pasted the response and nothing
  // else. Never let the scan below second-guess a payload that already parses.
  if (parses(trimmed)) return trimmed;

  let best: string | null = null;

  for (let index = 0; index < trimmed.length; index += 1) {
    const char = trimmed[index];
    if (char !== "{" && char !== "[") continue;

    const end = matchingBracket(trimmed, index);
    if (end === -1) break;

    const candidate = trimmed.slice(index, end + 1);
    if (parses(candidate) && (!best || candidate.length > best.length)) {
      best = candidate;
    }

    // Whatever this bracket turned out to be, the answer is not inside it: a
    // nested object is a fragment of it, and a shell brace group holds no menu.
    index = end;
  }

  return best;
}

function parses(text: string): boolean {
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * Where the bracket opened at `start` closes, or -1 if it never does.
 *
 * Strings are tracked because a menu is full of braces inside them — an Arabic
 * description, a `{"label":"Recommend"}` tag, a URL with a query — and a depth
 * count that reads those as structure closes in the wrong place.
 */
function matchingBracket(text: string, start: number): number {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < text.length; index += 1) {
    const char = text[index];

    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }

    if (char === '"') inString = true;
    else if (char === "{" || char === "[") depth += 1;
    else if (char === "}" || char === "]") {
      depth -= 1;
      if (depth === 0) return index;
      // More closes than opens: this start was never the real one.
      if (depth < 0) return -1;
    }
  }

  return -1;
}
