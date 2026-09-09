"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type Anthropic from "@anthropic-ai/sdk";
import {
  Bot,
  Check,
  ImagePlus,
  Loader2,
  Search,
  Send,
  Sparkles,
  Store,
  Trash2,
  TriangleAlert,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import { menuService, MenuSection } from "../../services/menu";
import { restaurantsService, RestaurantResponse } from "../../services/restaurants";
import { createModifierWriter, readId } from "../../lib/menuImport";
import { describeToolCall, isReadTool } from "../../lib/menuAgentTools";
import { canShrink, shrinkImageToFit } from "../../lib/imageDownscale";
import { EmptyState, Skeleton } from "./ui/States";
import { useI18n } from "../../lib/i18n";

/**
 * A menu you can talk to.
 *
 * The admin already had every menu operation as a form; what it did not have
 * was a way to do two hundred of them. Pasting eleven screenshots of another
 * storefront's add-on lists and saying "give our burgers these" is one
 * sentence here and an afternoon of clicking otherwise.
 *
 * The loop lives on this side deliberately. `/api/menu-agent` only asks Claude
 * what it wants to do next; every tool runs here, through the same
 * `menuService` the rest of the admin uses, with the operator's own token —
 * so the assistant can read the menu freely and can change nothing until the
 * plan below has been approved.
 */

/** Where the Menu tab keeps the key, so one key serves both. */
const CLAUDE_KEY_STORAGE = "nowlny_claude_key";

/** A turn that has bounced this many times is looping, not working. */
const MAX_HOPS = 12;

/** Claude takes images up to 5 MB; a screenshot has room to spare under this. */
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

/** Enough for a menu's worth of screenshots in one message. */
const MAX_ATTACHMENTS = 12;

/** One change the assistant wants to make, waiting for a yes. */
interface PlannedChange {
  /** The `tool_use` id, so a rejected plan can be answered precisely. */
  id: string;
  tool: string;
  input: Record<string, unknown>;
  title: string;
  detail?: string;
  state: "pending" | "done" | "skipped" | "failed";
  error?: string;
}

/** What the operator sees, as distinct from what the model is sent. */
type Entry =
  | { kind: "user"; text: string; images: number }
  | { kind: "assistant"; text: string }
  | { kind: "tool"; label: string }
  | { kind: "note"; text: string; tone: "ok" | "warn" };

interface ImageAttachment {
  id: string;
  name: string;
  mediaType: string;
  /** Base64, no data: prefix — the shape Claude's image block takes. */
  data: string;
  preview: string;
}

const CARD =
  "bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl";

function textOf(content: Anthropic.ContentBlock[]): string {
  return content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export default function MenuAgentSection() {
  const { t } = useI18n();

  // ── Which restaurant we are working on ────────────────────────────────────
  const [restaurants, setRestaurants] = useState<RestaurantResponse[]>([]);
  const [isLoadingStores, setIsLoadingStores] = useState(true);
  const [storeQuery, setStoreQuery] = useState("");
  const [restaurant, setRestaurant] = useState<RestaurantResponse | null>(null);

  // ── The conversation ──────────────────────────────────────────────────────
  /** What Claude is sent. Kept in a ref too: a turn reads it mid-flight. */
  const [messages, setMessages] = useState<Anthropic.MessageParam[]>([]);
  const messagesRef = useRef<Anthropic.MessageParam[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [draft, setDraft] = useState("");
  const [attachments, setAttachments] = useState<ImageAttachment[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [thinkingStep, setThinkingStep] = useState("");

  // ── The plan ──────────────────────────────────────────────────────────────
  const [plan, setPlan] = useState<PlannedChange[]>([]);
  const [isApplying, setIsApplying] = useState(false);
  const [applied, setApplied] = useState(0);

  /**
   * Dish and group names by id, so the plan reads in words.
   *
   * Filled as the assistant reads the menu — which it must do before it can
   * plan anything, so by the time a change is queued the names are here.
   */
  const labels = useRef(new Map<string, string>());
  const transcriptEnd = useRef<HTMLDivElement | null>(null);

  const claudeApiKey = useMemo(
    () =>
      typeof window === "undefined"
        ? ""
        : window.localStorage.getItem(CLAUDE_KEY_STORAGE) || "",
    [],
  );

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    transcriptEnd.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [entries, plan, isThinking]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        // Every page, not the first twenty: the picker is searched by name,
        // and a restaurant missing from the list cannot be worked on at all.
        const list = await restaurantsService.getAllRestaurants();
        if (alive) setRestaurants(list);
      } catch (error) {
        console.error("Could not load restaurants", error);
        if (alive) toast.error(t("agent.stores_failed"));
      } finally {
        if (alive) setIsLoadingStores(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [t]);

  const visibleStores = useMemo(() => {
    const needle = storeQuery.trim().toLowerCase();
    if (!needle) return restaurants;
    return restaurants.filter((store) =>
      (store.name ?? "").toLowerCase().includes(needle),
    );
  }, [restaurants, storeQuery]);

  const say = useCallback((entry: Entry) => {
    setEntries((current) => [...current, entry]);
  }, []);

  // ── Tools that read ───────────────────────────────────────────────────────

  /**
   * Run a read tool and remember every name it saw.
   *
   * The answer is deliberately compact: a menu with 200 dishes and their
   * timestamps, images and sort orders is mostly tokens the model has no use
   * for, and the ids are the only part it cannot do without.
   */
  const runReadTool = useCallback(
    async (name: string, input: Record<string, unknown>): Promise<string> => {
      if (!restaurant) return "No restaurant is selected.";

      if (name === "get_menu") {
        const sections: MenuSection[] = await menuService.getFullMenu(restaurant.id);
        const compact = sections.map((section) => {
          labels.current.set(section.id, section.name);
          return {
            sectionId: section.id,
            section: section.name,
            items: (section.items ?? []).map((item) => {
              labels.current.set(item.id, item.name);
              return {
                id: item.id,
                name: item.name,
                price: Number(item.price),
                isAvailable: item.isAvailable !== false,
              };
            }),
          };
        });
        const dishes = compact.reduce((sum, section) => sum + section.items.length, 0);
        say({
          kind: "tool",
          label: t("agent.tool_read_menu", {
            sections: compact.length,
            dishes,
          }),
        });
        return JSON.stringify({ sections: compact });
      }

      if (name === "get_item_addons") {
        const itemId = String(input.menuItemId ?? "");
        const groups = await menuService.getOptionGroupsByItem(itemId);
        for (const group of groups) {
          labels.current.set(group.id, group.name);
          for (const option of group.options ?? []) {
            labels.current.set(option.id, option.name);
          }
        }
        say({
          kind: "tool",
          label: t("agent.tool_read_addons", {
            item: labels.current.get(itemId) ?? itemId.slice(0, 8),
            groups: groups.length,
          }),
        });
        return JSON.stringify(
          groups.map((group) => ({
            id: group.id,
            name: group.name,
            type: group.type,
            isRequired: group.isRequired,
            options: (group.options ?? []).map((option) => ({
              id: option.id,
              name: option.name,
              price: Number(option.price),
            })),
          })),
        );
      }

      return `Unknown read tool: ${name}`;
    },
    [restaurant, say, t],
  );

  // ── The turn ──────────────────────────────────────────────────────────────

  /**
   * Ask the model what to do next, do the reading, queue the changes, repeat.
   *
   * Bounded by `MAX_HOPS` rather than trusting the model to stop: a loop that
   * keeps calling `get_menu` costs a request every time round, and the operator
   * would only see a spinner.
   */
  const runTurn = useCallback(
    async (seed: Anthropic.MessageParam[]) => {
      if (!restaurant) return;

      setIsThinking(true);
      let conversation = seed;

      try {
        for (let hop = 0; hop < MAX_HOPS; hop++) {
          setThinkingStep(hop === 0 ? t("agent.thinking") : t("agent.working"));

          const token =
            typeof window === "undefined" ? "" : localStorage.getItem("token") || "";

          const response = await fetch("/api/menu-agent", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              claudeApiKey,
              restaurantName: restaurant.name,
              currency: restaurant.currency?.code ?? "",
              messages: conversation,
            }),
          });

          const payload = await response.json().catch(() => null);
          if (!response.ok) {
            const reason =
              (payload as { error?: string } | null)?.error ?? t("agent.failed");
            say({ kind: "note", text: reason, tone: "warn" });
            setMessages(conversation);
            return;
          }

          const content = ((payload as { content?: Anthropic.ContentBlock[] } | null)
            ?.content ?? []) as Anthropic.ContentBlock[];

          const spoken = textOf(content);
          if (spoken) say({ kind: "assistant", text: spoken });

          conversation = [...conversation, { role: "assistant", content }];

          const calls = content.filter(
            (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
          );
          if (calls.length === 0) {
            setMessages(conversation);
            return;
          }

          // Every result of one assistant turn goes back in ONE user message.
          // Splitting them teaches the model to stop asking for several things
          // at once, which is exactly what makes a hundred-dish plan quick.
          const results: Anthropic.ToolResultBlockParam[] = [];

          for (const call of calls) {
            const input = asRecord(call.input);

            if (isReadTool(call.name)) {
              try {
                results.push({
                  type: "tool_result",
                  tool_use_id: call.id,
                  content: await runReadTool(call.name, input),
                });
              } catch (error) {
                console.error(`Tool ${call.name} failed`, error);
                results.push({
                  type: "tool_result",
                  tool_use_id: call.id,
                  is_error: true,
                  content:
                    error instanceof Error ? error.message : "That read failed.",
                });
              }
              continue;
            }

            // A change. It goes on the plan and no further.
            const described = describeToolCall(call.name, input, labels.current);
            setPlan((current) => [
              ...current,
              {
                id: call.id,
                tool: call.name,
                input,
                title: described.title,
                detail: described.detail,
                state: "pending",
              },
            ]);
            results.push({
              type: "tool_result",
              tool_use_id: call.id,
              content:
                "Queued for the operator to review. Nothing has been written yet — do not call this again for the same change.",
            });
          }

          conversation = [...conversation, { role: "user", content: results }];
        }

        say({ kind: "note", text: t("agent.too_many_steps"), tone: "warn" });
        setMessages(conversation);
      } finally {
        setIsThinking(false);
        setThinkingStep("");
      }
    },
    [claudeApiKey, restaurant, runReadTool, say, t],
  );

  const send = useCallback(async () => {
    const text = draft.trim();
    if ((!text && attachments.length === 0) || isThinking || !restaurant) return;

    if (!claudeApiKey) {
      toast.error(t("agent.no_key"));
      return;
    }

    // Images first, then the instruction: the same order the menu scanner
    // uses, and the one Claude reads documents best in.
    const content: Anthropic.ContentBlockParam[] = [
      ...attachments.map(
        (image): Anthropic.ContentBlockParam => ({
          type: "image",
          source: {
            type: "base64",
            media_type: image.mediaType as "image/png",
            data: image.data,
          },
        }),
      ),
      { type: "text", text: text || t("agent.image_only_prompt") },
    ];

    say({ kind: "user", text, images: attachments.length });
    setDraft("");
    setAttachments([]);

    await runTurn([...messagesRef.current, { role: "user", content }]);
  }, [attachments, claudeApiKey, draft, isThinking, restaurant, runTurn, say, t]);

  // ── Applying the plan ─────────────────────────────────────────────────────

  /** One planned change, executed. Returns what to show against it. */
  const applyChange = useCallback(
    async (
      change: PlannedChange,
      modifiers: ReturnType<typeof createModifierWriter>,
    ): Promise<{ state: PlannedChange["state"]; error?: string }> => {
      const input = change.input;

      switch (change.tool) {
        case "create_option_group": {
          const options = (Array.isArray(input.options) ? input.options : []).map(
            (option) => {
              const choice = asRecord(option);
              return {
                name: String(choice.name ?? ""),
                price: Number(choice.price) || 0,
              };
            },
          );
          // The import's writer, reused whole: it already knows this API's two
          // habits — a create that echoes nothing, and a deployment that
          // ignores nested options — and it skips a group the dish already has.
          const written = await modifiers.write(
            String(input.menuItemId ?? ""),
            [
              {
                name: String(input.name ?? ""),
                type: input.type === "radio" ? "radio" : "checkbox",
                isRequired: input.isRequired === true,
                options,
              },
            ],
            { itemIsNew: false },
          );
          if (written.failed > 0) return { state: "failed", error: t("agent.write_failed") };
          return written.skipped > 0 ? { state: "skipped" } : { state: "done" };
        }

        case "add_options": {
          const groupId = String(input.optionGroupId ?? "");
          const options = Array.isArray(input.options) ? input.options : [];
          for (const [index, option] of options.entries()) {
            const choice = asRecord(option);
            await menuService.createOption(groupId, {
              name: String(choice.name ?? ""),
              price: Number(choice.price) || 0,
              sortOrder: index,
            });
          }
          return { state: "done" };
        }

        case "update_option":
          await menuService.updateOption(String(input.optionId ?? ""), {
            ...(input.name !== undefined ? { name: String(input.name) } : {}),
            ...(input.price !== undefined ? { price: Number(input.price) } : {}),
          });
          return { state: "done" };

        case "delete_option_group":
          await menuService.deleteOptionGroup(String(input.optionGroupId ?? ""));
          return { state: "done" };

        case "update_item":
          await menuService.updateItem(String(input.menuItemId ?? ""), {
            ...(input.name !== undefined ? { name: String(input.name) } : {}),
            ...(input.description !== undefined
              ? { description: String(input.description) }
              : {}),
            ...(input.price !== undefined ? { price: Number(input.price) } : {}),
            ...(input.discountedPrice !== undefined
              ? { discountedPrice: Number(input.discountedPrice) }
              : {}),
            ...(input.isAvailable !== undefined
              ? { isAvailable: input.isAvailable === true }
              : {}),
            ...(input.isPopular !== undefined
              ? { isPopular: input.isPopular === true }
              : {}),
          });
          return { state: "done" };

        case "create_item": {
          const created = await menuService.createItem({
            sectionId: String(input.sectionId ?? ""),
            name: String(input.name ?? ""),
            price: Number(input.price) || 0,
            ...(input.description !== undefined
              ? { description: String(input.description) }
              : {}),
          });
          const id = readId(created);
          if (id) labels.current.set(id, String(input.name ?? ""));
          return { state: "done" };
        }

        case "create_section": {
          const created = await menuService.createSection({
            name: String(input.name ?? ""),
            restaurantId: restaurant?.id,
            ...(input.description !== undefined
              ? { description: String(input.description) }
              : {}),
          });
          const id = readId(created);
          if (id) labels.current.set(id, String(input.name ?? ""));
          return { state: "done" };
        }

        default:
          return { state: "failed", error: t("agent.unknown_change") };
      }
    },
    [restaurant, t],
  );

  const applyPlan = useCallback(async () => {
    const pending = plan.filter((change) => change.state === "pending");
    if (pending.length === 0 || isApplying) return;

    setIsApplying(true);
    setApplied(0);

    // One writer for the whole plan: it learns on the first group whether this
    // deployment accepts nested options, and reuses the answer for the rest.
    const modifiers = createModifierWriter(menuService);
    let done = 0;
    let skipped = 0;
    let failed = 0;

    for (const change of pending) {
      let outcome: { state: PlannedChange["state"]; error?: string };
      try {
        outcome = await applyChange(change, modifiers);
      } catch (error) {
        console.error(`Change ${change.tool} failed`, error);
        outcome = {
          state: "failed",
          error: error instanceof Error ? error.message : String(error),
        };
      }

      if (outcome.state === "done") done += 1;
      else if (outcome.state === "skipped") skipped += 1;
      else failed += 1;

      setPlan((current) =>
        current.map((entry) =>
          entry.id === change.id
            ? { ...entry, state: outcome.state, error: outcome.error }
            : entry,
        ),
      );
      setApplied((count) => count + 1);
    }

    setIsApplying(false);

    const summary = t("agent.applied_summary", { done, skipped, failed });
    say({ kind: "note", text: summary, tone: failed > 0 ? "warn" : "ok" });
    if (failed > 0) toast.error(summary);
    else toast.success(summary);

    /*
     * Tell the assistant what happened — but do not spend a request on it.
     *
     * The outcome is appended to the conversation so the next thing the
     * operator asks is answered by a model that knows the menu changed. Asking
     * it to acknowledge now would be a round trip that says "done" twice.
     */
    setMessages((current) => [
      ...current,
      {
        role: "user",
        content: `[system] The operator applied the plan. ${done} change(s) written, ${skipped} skipped because the dish already had that group, ${failed} failed. The menu has changed — call get_menu again before planning anything else.`,
      },
    ]);
  }, [applyChange, isApplying, plan, say, t]);

  const discardPlan = useCallback(() => {
    setPlan((current) => current.filter((change) => change.state !== "pending"));
    setMessages((current) => [
      ...current,
      {
        role: "user",
        content:
          "[system] The operator discarded the queued changes. Nothing was written. Ask what to do differently rather than queueing the same changes again.",
      },
    ]);
    say({ kind: "note", text: t("agent.discarded"), tone: "warn" });
  }, [say, t]);

  // ── Attachments ───────────────────────────────────────────────────────────

  const attach = useCallback(
    async (files: FileList | File[]) => {
      const room = MAX_ATTACHMENTS - attachments.length;
      if (room <= 0) {
        toast.error(t("agent.too_many_images", { limit: MAX_ATTACHMENTS }));
        return;
      }

      for (const file of Array.from(files).slice(0, room)) {
        if (!file.type.startsWith("image/")) {
          toast.error(t("agent.images_only"));
          continue;
        }

        // A phone screenshot is routinely past what fits in a request; the
        // scanner's own downscaler brings it back without losing the prices.
        let usable = file;
        if (file.size > MAX_IMAGE_BYTES && canShrink(file)) {
          const shrunk = await shrinkImageToFit(file, MAX_IMAGE_BYTES);
          if (shrunk.stillTooBig) {
            toast.error(t("agent.image_too_big", { name: file.name }));
            continue;
          }
          usable = shrunk.file;
        } else if (file.size > MAX_IMAGE_BYTES) {
          toast.error(t("agent.image_too_big", { name: file.name }));
          continue;
        }

        const data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () =>
            resolve(String(reader.result).split(",")[1] ?? "");
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(usable);
        });

        setAttachments((current) => [
          ...current,
          {
            id: `${file.name}-${Date.now()}-${current.length}`,
            name: file.name,
            mediaType: usable.type || "image/png",
            data,
            preview: URL.createObjectURL(usable),
          },
        ]);
      }
    },
    [attachments.length, t],
  );

  const startOver = useCallback(() => {
    setMessages([]);
    setEntries([]);
    setPlan([]);
    setAttachments([]);
    labels.current.clear();
  }, []);

  // ── Restaurant picker ─────────────────────────────────────────────────────

  if (!restaurant) {
    return (
      <div className={`${CARD} p-6`}>
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center">
            <Bot className="w-5 h-5 text-indigo-500" />
          </div>
          <div>
            <h2 className="text-lg font-black text-zinc-900 dark:text-white">
              {t("agent.title")}
            </h2>
            <p className="text-xs text-zinc-500">{t("agent.pick_store")}</p>
          </div>
        </div>

        <div className="relative mt-5 mb-3">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            value={storeQuery}
            onChange={(event) => setStoreQuery(event.target.value)}
            placeholder={t("agent.search_stores")}
            className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-sm rounded-lg py-2.5 pl-9 pr-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {isLoadingStores ? (
          <div className="space-y-2">
            {[0, 1, 2, 3].map((row) => (
              <Skeleton key={row} className="h-12 w-full rounded-xl" />
            ))}
          </div>
        ) : visibleStores.length === 0 ? (
          <EmptyState icon={Store} title={t("agent.no_stores")} />
        ) : (
          <div className="grid gap-2 max-h-[60vh] overflow-y-auto pr-1">
            {visibleStores.map((store) => (
              <button
                key={store.id}
                onClick={() => setRestaurant(store)}
                className="flex items-center gap-3 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:border-indigo-400 hover:bg-indigo-500/5 text-left transition-all"
              >
                {store.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={store.logo}
                    alt=""
                    className="w-9 h-9 rounded-lg object-cover shrink-0"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0">
                    <Store className="w-4 h-4 text-zinc-400" />
                  </div>
                )}
                <span className="font-bold text-sm text-zinc-800 dark:text-zinc-200 truncate">
                  {store.name}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  const pending = plan.filter((change) => change.state === "pending");
  const settled = plan.filter((change) => change.state !== "pending");

  return (
    <div className="flex flex-col gap-4 h-[calc(100vh-9rem)]">
      {/* Who we are working on */}
      <div className={`${CARD} px-4 py-3 flex items-center gap-3`}>
        <div className="w-9 h-9 rounded-xl bg-indigo-500/10 flex items-center justify-center shrink-0">
          <Bot className="w-4.5 h-4.5 text-indigo-500" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black text-zinc-900 dark:text-white truncate">
            {restaurant.name}
          </p>
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
            {t("agent.title")}
          </p>
        </div>
        {messages.length > 0 && (
          <button
            onClick={startOver}
            className="text-[11px] font-bold px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300"
          >
            {t("agent.new_chat")}
          </button>
        )}
        <button
          onClick={() => {
            setRestaurant(null);
            startOver();
          }}
          className="text-[11px] font-bold px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300"
        >
          {t("agent.switch_store")}
        </button>
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Transcript */}
        <div className={`${CARD} lg:col-span-2 flex flex-col min-h-0`}>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {entries.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center px-6">
                <Sparkles className="w-8 h-8 text-indigo-400 mb-3" />
                <p className="text-sm font-bold text-zinc-700 dark:text-zinc-300">
                  {t("agent.empty_title")}
                </p>
                <p className="text-xs text-zinc-500 mt-1 max-w-sm">
                  {t("agent.empty_hint")}
                </p>
              </div>
            )}

            {entries.map((entry, index) => {
              if (entry.kind === "user") {
                return (
                  <div key={index} className="flex justify-end">
                    <div className="max-w-[85%] bg-indigo-500 text-white rounded-2xl rounded-br-sm px-3.5 py-2.5">
                      {entry.text && (
                        <p dir="auto" className="text-sm whitespace-pre-wrap">
                          {entry.text}
                        </p>
                      )}
                      {entry.images > 0 && (
                        <p className="text-[11px] font-bold opacity-80 mt-1">
                          {t("agent.n_images", { count: entry.images })}
                        </p>
                      )}
                    </div>
                  </div>
                );
              }
              if (entry.kind === "assistant") {
                return (
                  <div key={index} className="flex justify-start">
                    <div className="max-w-[90%] bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100 rounded-2xl rounded-bl-sm px-3.5 py-2.5">
                      <p dir="auto" className="text-sm whitespace-pre-wrap">
                        {entry.text}
                      </p>
                    </div>
                  </div>
                );
              }
              if (entry.kind === "tool") {
                return (
                  <p
                    key={index}
                    className="text-[11px] font-bold text-zinc-400 flex items-center gap-1.5 pl-1"
                  >
                    <Search className="w-3 h-3" />
                    {entry.label}
                  </p>
                );
              }
              return (
                <p
                  key={index}
                  className={`text-[11px] font-bold flex items-center gap-1.5 pl-1 ${
                    entry.tone === "warn" ? "text-amber-500" : "text-emerald-500"
                  }`}
                >
                  {entry.tone === "warn" ? (
                    <TriangleAlert className="w-3 h-3" />
                  ) : (
                    <Check className="w-3 h-3" />
                  )}
                  {entry.text}
                </p>
              );
            })}

            {isThinking && (
              <p className="text-[11px] font-bold text-indigo-500 flex items-center gap-1.5 pl-1">
                <Loader2 className="w-3 h-3 animate-spin" />
                {thinkingStep}
              </p>
            )}
            <div ref={transcriptEnd} />
          </div>

          {/* Composer */}
          <div className="border-t border-zinc-200 dark:border-zinc-800 p-3">
            {attachments.length > 0 && (
              <div className="flex gap-2 flex-wrap mb-2">
                {attachments.map((image) => (
                  <div key={image.id} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={image.preview}
                      alt={image.name}
                      className="w-14 h-14 rounded-lg object-cover border border-zinc-200 dark:border-zinc-700"
                    />
                    <button
                      onClick={() =>
                        setAttachments((current) =>
                          current.filter((entry) => entry.id !== image.id),
                        )
                      }
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-zinc-900 text-white flex items-center justify-center"
                      aria-label={t("agent.remove_image")}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-end gap-2">
              <label className="w-9 h-9 rounded-lg border border-zinc-200 dark:border-zinc-800 flex items-center justify-center cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800 shrink-0">
                <ImagePlus className="w-4 h-4 text-zinc-500" />
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(event) => {
                    if (event.target.files) void attach(event.target.files);
                    event.target.value = "";
                  }}
                />
              </label>

              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onPaste={(event) => {
                  const files = Array.from(event.clipboardData.files);
                  if (files.length > 0) {
                    event.preventDefault();
                    void attach(files);
                  }
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void send();
                  }
                }}
                rows={2}
                dir="auto"
                placeholder={t("agent.placeholder")}
                className="flex-1 resize-none bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />

              <button
                onClick={() => void send()}
                disabled={isThinking || (!draft.trim() && attachments.length === 0)}
                className="w-9 h-9 rounded-lg bg-indigo-500 hover:bg-indigo-600 disabled:opacity-40 text-white flex items-center justify-center shrink-0"
                aria-label={t("agent.send")}
              >
                {isThinking ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* The plan */}
        <div className={`${CARD} flex flex-col min-h-0`}>
          <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
              {t("agent.plan_title")}
            </p>
            <p className="text-xs text-zinc-400 mt-0.5">
              {pending.length > 0
                ? t("agent.plan_pending", { count: pending.length })
                : t("agent.plan_empty")}
            </p>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {[...pending, ...settled].map((change) => (
              <div
                key={change.id}
                className={`rounded-xl border p-2.5 ${
                  change.state === "done"
                    ? "border-emerald-500/40 bg-emerald-500/5"
                    : change.state === "failed"
                      ? "border-red-500/40 bg-red-500/5"
                      : change.state === "skipped"
                        ? "border-zinc-300 dark:border-zinc-700 opacity-60"
                        : "border-zinc-200 dark:border-zinc-800"
                }`}
              >
                <p
                  dir="auto"
                  className="text-xs font-bold text-zinc-800 dark:text-zinc-200"
                >
                  {change.title}
                </p>
                {change.detail && (
                  <p
                    dir="auto"
                    className="text-[11px] text-zinc-500 mt-1 line-clamp-3"
                  >
                    {change.detail}
                  </p>
                )}
                {change.state === "skipped" && (
                  <p className="text-[10px] font-bold text-zinc-400 mt-1">
                    {t("agent.change_skipped")}
                  </p>
                )}
                {change.state === "failed" && (
                  <p className="text-[10px] font-bold text-red-500 mt-1">
                    {change.error ?? t("agent.write_failed")}
                  </p>
                )}
              </div>
            ))}
          </div>

          {pending.length > 0 && (
            <div className="border-t border-zinc-200 dark:border-zinc-800 p-3 space-y-2">
              <button
                onClick={() => void applyPlan()}
                disabled={isApplying}
                className="w-full py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white text-xs font-black flex items-center justify-center gap-2"
              >
                {isApplying ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    {t("agent.applying", {
                      done: applied,
                      total: pending.length,
                    })}
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    {t("agent.apply", { count: pending.length })}
                  </>
                )}
              </button>
              <button
                onClick={discardPlan}
                disabled={isApplying}
                className="w-full py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-[11px] font-bold text-zinc-500 flex items-center justify-center gap-1.5"
              >
                <Trash2 className="w-3 h-3" />
                {t("agent.discard")}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
