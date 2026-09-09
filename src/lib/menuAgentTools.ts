/**
 * What the menu assistant is allowed to do, and how each call reads to a human.
 *
 * One catalogue, two readers: the route sends it to Claude as the tool list,
 * and the section uses it to tell a question from a change. That split is the
 * whole safety model — a tool marked `write` is never executed when the model
 * asks for it, only collected into a plan the operator presses Apply on — so
 * the two views have to come from the same place. A tool added to the route
 * alone would run unreviewed.
 *
 * Menu-only on purpose. The admin's token could just as well create a
 * restaurant or refund an order; a misread instruction that adds a wrong
 * add-on is a bad afternoon, and one that touches live orders is not.
 */

import type Anthropic from "@anthropic-ai/sdk";

/** A choice inside a group. `price` is the surcharge, never a total. */
const OPTION_SCHEMA = {
  type: "object" as const,
  properties: {
    name: { type: "string", description: "Choice name, in the menu's language" },
    price: {
      type: "number",
      description: "What this choice ADDS to the dish. A free choice is 0.",
    },
  },
  required: ["name", "price"],
  additionalProperties: false,
};

/**
 * The tools, in the order they are sent.
 *
 * Order is deliberate: the list is part of the cached prefix, so it stays
 * stable rather than being rebuilt per request.
 */
export const MENU_AGENT_TOOLS: Anthropic.Tool[] = [
  {
    name: "get_menu",
    description:
      "Read this restaurant's whole menu: every section with its items, their ids, prices and availability. Call this before anything else — you cannot change a dish without its id, and you must never guess one.",
    input_schema: {
      type: "object",
      properties: {},
      required: [],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    name: "get_item_addons",
    description:
      "List the option groups (add-ons, modifiers, choices) a dish already has, with their options and ids. Use it before adding a group, so a dish does not end up with the same question twice.",
    input_schema: {
      type: "object",
      properties: {
        menuItemId: { type: "string", description: "The dish's id, from get_menu" },
      },
      required: ["menuItemId"],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    name: "create_option_group",
    description:
      "Add a group of choices to a dish — 'Add-ons', 'Choose your size', 'Remove ingredients'. The options are created with it.",
    input_schema: {
      type: "object",
      properties: {
        menuItemId: { type: "string", description: "The dish's id, from get_menu" },
        name: {
          type: "string",
          description: "Group heading, in the menu's own language",
        },
        type: {
          type: "string",
          enum: ["radio", "checkbox"],
          description:
            "radio = the customer picks exactly one, checkbox = any number",
        },
        isRequired: {
          type: "boolean",
          description: "True only when the dish cannot be ordered without answering",
        },
        options: { type: "array", items: OPTION_SCHEMA, description: "The choices" },
      },
      required: ["menuItemId", "name", "type", "isRequired", "options"],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    name: "add_options",
    description: "Add more choices to a group that already exists.",
    input_schema: {
      type: "object",
      properties: {
        optionGroupId: { type: "string", description: "From get_item_addons" },
        options: { type: "array", items: OPTION_SCHEMA },
      },
      required: ["optionGroupId", "options"],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    name: "update_option",
    description: "Rename one choice or change what it adds to the dish.",
    input_schema: {
      type: "object",
      properties: {
        optionId: { type: "string", description: "From get_item_addons" },
        name: { type: "string" },
        price: { type: "number", description: "The surcharge, not a total" },
      },
      required: ["optionId"],
      additionalProperties: false,
    },
  },
  {
    name: "delete_option_group",
    description:
      "Remove a whole group of choices from a dish, with everything in it. Use it to undo a group that was added wrongly.",
    input_schema: {
      type: "object",
      properties: {
        optionGroupId: { type: "string", description: "From get_item_addons" },
        groupName: {
          type: "string",
          description: "The group's name, so the operator can see what is being removed",
        },
      },
      required: ["optionGroupId", "groupName"],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    name: "update_item",
    description:
      "Change a dish: its name, description, price, discounted price, or whether it is available or marked popular. Only send the fields that change.",
    input_schema: {
      type: "object",
      properties: {
        menuItemId: { type: "string", description: "The dish's id, from get_menu" },
        name: { type: "string" },
        description: { type: "string" },
        price: { type: "number" },
        discountedPrice: { type: "number" },
        isAvailable: { type: "boolean" },
        isPopular: { type: "boolean" },
      },
      required: ["menuItemId"],
      additionalProperties: false,
    },
  },
  {
    name: "create_item",
    description: "Add a new dish to a section.",
    input_schema: {
      type: "object",
      properties: {
        sectionId: { type: "string", description: "The section's id, from get_menu" },
        name: { type: "string", description: "In the menu's own language" },
        price: { type: "number" },
        description: { type: "string" },
      },
      required: ["sectionId", "name", "price"],
      additionalProperties: false,
    },
  },
  {
    name: "create_section",
    description: "Add a new section (category) to this restaurant's menu.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "In the menu's own language" },
        description: { type: "string" },
      },
      required: ["name"],
      additionalProperties: false,
    },
  },
];

/** Tools that only ever read. Everything else waits for the operator. */
const READ_TOOLS = new Set(["get_menu", "get_item_addons"]);

export type MenuAgentToolName = (typeof MENU_AGENT_TOOLS)[number]["name"];

export function isReadTool(name: string): boolean {
  return READ_TOOLS.has(name);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function money(value: unknown): string {
  const price = Number(value);
  return Number.isFinite(price) ? price.toFixed(2) : String(value ?? "");
}

/**
 * One planned change, in a sentence an operator can approve or reject.
 *
 * This is what stands between the model and the menu, so it says what will
 * actually happen rather than echoing the tool's name: "Add-ons — 12 choices"
 * is reviewable, `create_option_group` is not.
 */
export function describeToolCall(
  name: string,
  input: unknown,
  /** Dish and group names, by id, so the plan reads in names not uuids. */
  labels: Map<string, string> = new Map(),
): { title: string; detail?: string } {
  const args = asRecord(input);
  const named = (id: unknown): string =>
    labels.get(String(id ?? "")) || String(id ?? "").slice(0, 8);

  switch (name) {
    case "create_option_group": {
      const options = Array.isArray(args.options) ? args.options : [];
      return {
        title: `Add "${args.name}" to ${named(args.menuItemId)} — ${options.length} ${
          options.length === 1 ? "choice" : "choices"
        }`,
        detail: options
          .map((option) => {
            const choice = asRecord(option);
            const price = Number(choice.price);
            return price > 0 ? `${choice.name} +${money(price)}` : `${choice.name}`;
          })
          .join(" · "),
      };
    }
    case "add_options": {
      const options = Array.isArray(args.options) ? args.options : [];
      return {
        title: `Add ${options.length} ${
          options.length === 1 ? "choice" : "choices"
        } to ${named(args.optionGroupId)}`,
        detail: options
          .map((option) => {
            const choice = asRecord(option);
            const price = Number(choice.price);
            return price > 0 ? `${choice.name} +${money(price)}` : `${choice.name}`;
          })
          .join(" · "),
      };
    }
    case "update_option": {
      const parts = [
        args.name !== undefined ? `name → "${args.name}"` : "",
        args.price !== undefined ? `price → +${money(args.price)}` : "",
      ].filter(Boolean);
      return { title: `Edit choice ${named(args.optionId)}`, detail: parts.join(", ") };
    }
    case "delete_option_group":
      return {
        title: `Remove "${args.groupName}" from ${named(args.optionGroupId)}`,
        detail: "The group and all its choices are deleted.",
      };
    case "update_item": {
      const parts = Object.entries(args)
        .filter(([key]) => key !== "menuItemId")
        .map(([key, value]) =>
          key === "price" || key === "discountedPrice"
            ? `${key} → ${money(value)}`
            : `${key} → ${String(value)}`,
        );
      return { title: `Edit ${named(args.menuItemId)}`, detail: parts.join(", ") };
    }
    case "create_item":
      return {
        title: `New dish "${args.name}" — ${money(args.price)}`,
        detail: typeof args.description === "string" ? args.description : undefined,
      };
    case "create_section":
      return { title: `New section "${args.name}"` };
    default:
      return { title: name, detail: JSON.stringify(input).slice(0, 200) };
  }
}
