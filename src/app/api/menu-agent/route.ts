import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { MENU_AGENT_TOOLS } from "../../../lib/menuAgentTools";

/**
 * The menu assistant's model call, and nothing else.
 *
 * Deliberately thin. Every tool this route offers Claude is executed in the
 * *browser*, through the same `menuService` the rest of the admin uses, with
 * the operator's own token — so the loop lives in the section and this route
 * only ever answers one question: given the conversation so far, what does the
 * model want to do next?
 *
 * That shape is what makes the approval gate real. If the route ran the loop it
 * would need the admin's token to act with, and a model that decided to delete
 * a section would have already done it by the time anyone saw the transcript.
 * Here it can only ask.
 */

/** Long conversations with a big menu in them are not fast. */
export const maxDuration = 60;

/** Opus 5 — the assistant reasons about a live menu, not a form. */
const MODEL = process.env.MENU_AGENT_MODEL || "claude-opus-5";

/** A plan across a hundred dishes is a lot of tool calls. */
const MAX_OUTPUT_TOKENS = 16_000;

/** The model gets whatever is left of the request budget. */
const UPSTREAM_TIMEOUT_MS = 55_000;

/** A conversation past this is a runaway loop, not a menu edit. */
const MAX_MESSAGES = 60;

function systemPrompt(restaurantName: string, currency: string): string {
  return `You are the menu assistant inside the Nowlny admin. You are working on ONE restaurant: "${restaurantName}". Prices are in ${currency}.

HOW YOU WORK
- You cannot see the menu until you read it. Call get_menu first, every time, and never invent or guess an id.
- Read tools (get_menu, get_item_addons) run immediately and return real data.
- Every other tool is a CHANGE. Changes do not happen when you call them: they are collected into a plan the operator reviews and applies. A change tool answers "queued" — that is success, not a failure, so do not call it again.
- Plan the whole job in one turn where you can. The operator presses Apply once, so twenty queued changes cost them one click and twenty separate turns cost them twenty.
- When you are done queueing, stop and say plainly what you queued and anything you could not do.

WHAT THE OPERATOR SENDS YOU
- Screenshots of another storefront's add-on lists, price lists, or menu pages. Read the prices off the image exactly; never round, never fill in a price the image does not show.
- Names that do not match ours exactly ("swiss mushroom" vs "Swiss Mushroom"). Match case-insensitively and by obvious spelling, and when a name matches nothing, say so instead of picking the nearest dish.

RULES THAT MATTER
- An option's price is a SURCHARGE — what the choice adds to the dish. A free choice is 0. "+$1.50" on a storefront is 1.5.
- Use "checkbox" when the customer may pick several (extras, toppings, sauces) and "radio" when they pick exactly one (size, dough, cooking level). Set isRequired only when the dish cannot be ordered without an answer.
- Keep every name in the menu's own language. An Arabic menu gets Arabic group names.
- A dish that already has a group by that name does not need another one. Check with get_item_addons before adding to dishes that may already have modifiers.
- You cannot attach add-ons to a dish you have only just queued for creation — it has no id until the operator applies it. Create the dishes, say they must be applied first, and add their add-ons afterwards.
- If the operator asks for something outside this menu — orders, customers, other restaurants, prices in another store — say you cannot do it here. You only have this restaurant's menu.`;
}

/** The client's own error text, so a failure reads the same as the rest. */
function message(status: number, said: string): string {
  if (status === 401) return `Claude rejected that API key. Check it in AI Settings.${said}`;
  if (status === 403) return `Claude refused that request.${said}`;
  if (status === 429)
    return `Claude is rate limited right now. Wait a moment and try again.${said}`;
  if (status === 413)
    return "That was too much for one request — send fewer images, or ask for a smaller batch.";
  if (status >= 500) return "Claude is temporarily unavailable. Please try again shortly.";
  return `Claude couldn't answer that.${said}`;
}

export async function POST(request: Request) {
  // Same gate as the menu scanner: without it this is an open proxy onto
  // whatever key the server holds.
  const authHeader = request.headers.get("authorization") ?? "";
  if (!/^bearer\s+\S+/i.test(authHeader)) {
    return NextResponse.json(
      { error: "You must be signed in to use the menu assistant." },
      { status: 401 },
    );
  }

  let body: {
    claudeApiKey?: unknown;
    restaurantName?: unknown;
    currency?: unknown;
    messages?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Malformed request." }, { status: 400 });
  }

  const apiKey =
    (typeof body.claudeApiKey === "string" ? body.claudeApiKey.trim() : "") ||
    process.env.ANTHROPIC_API_KEY ||
    "";

  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "The menu assistant needs a Claude API key. Add one in AI Settings on the Menu tab.",
      },
      { status: 400 },
    );
  }

  const messages = Array.isArray(body.messages) ? body.messages : [];
  if (messages.length === 0) {
    return NextResponse.json({ error: "No conversation to continue." }, { status: 400 });
  }
  if (messages.length > MAX_MESSAGES) {
    return NextResponse.json(
      {
        error:
          "This conversation has gone on too long to continue safely. Start a new one — the menu you are working on is already saved.",
      },
      { status: 400 },
    );
  }

  const restaurantName =
    typeof body.restaurantName === "string" && body.restaurantName.trim()
      ? body.restaurantName.trim().slice(0, 120)
      : "this restaurant";
  const currency =
    typeof body.currency === "string" && body.currency.trim()
      ? body.currency.trim().slice(0, 20)
      : "the restaurant's own currency";

  const client = new Anthropic({ apiKey, timeout: UPSTREAM_TIMEOUT_MS });

  try {
    /*
     * Streamed, then awaited whole.
     *
     * Nothing here renders token by token — the section only acts once the
     * turn is complete — but a non-streaming request at this ceiling can sit
     * past the SDK's own timeout heuristics on a long plan, and the failure
     * looks like a hang rather than an error.
     */
    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: MAX_OUTPUT_TOKENS,
      system: [
        {
          type: "text",
          text: systemPrompt(restaurantName, currency),
          // The rules and the tool list do not change between turns of a
          // conversation, and a menu conversation is many turns.
          cache_control: { type: "ephemeral" },
        },
      ],
      tools: MENU_AGENT_TOOLS,
      messages: messages as Anthropic.MessageParam[],
    });

    const answer = await stream.finalMessage();

    return NextResponse.json({
      content: answer.content,
      stopReason: answer.stop_reason,
      usage: {
        input: answer.usage.input_tokens,
        output: answer.usage.output_tokens,
        cacheRead: answer.usage.cache_read_input_tokens ?? 0,
      },
    });
  } catch (error) {
    if (error instanceof Anthropic.APIError) {
      const said = error.message ? ` Claude said: ${error.message.slice(0, 220)}` : "";
      console.error(`[menu-agent] Claude responded ${error.status}:`, error.message);
      return NextResponse.json(
        { error: message(error.status ?? 500, said) },
        { status: (error.status ?? 500) >= 500 ? 502 : (error.status ?? 500) },
      );
    }

    const timedOut = (error as { name?: string })?.name === "APITimeoutError";
    console.error("[menu-agent] request failed:", error);
    return NextResponse.json(
      {
        error: timedOut
          ? "That took too long to answer. Ask for a smaller batch — a section at a time rather than the whole menu."
          : "Couldn't reach Claude. Check your connection and try again.",
      },
      { status: timedOut ? 504 : 502 },
    );
  }
}
