/**
 * Writing a scanned menu's modifiers into the platform.
 *
 * Lives outside the component because it is the part of the import that
 * cannot be watched: it runs hundreds of requests deep inside an approval
 * click, against an API whose create endpoints document no response body. Two
 * of its three failure modes are silent — a dish that already exists takes its
 * modifiers with it, and a group whose nested choices are ignored arrives
 * empty — so it is kept here where it can be tested against a fake service.
 */

import { readId } from "../services/apiClient";
import type { NormalizedOptionGroup } from "./menuParsing";

export { readId };

/** Just the slice of `menuService` this needs, so a test can stand in for it. */
export interface OptionGroupService {
  createOptionGroup(data: {
    menuItemId: string;
    name: string;
    type: "radio" | "checkbox";
    isRequired?: boolean;
    sortOrder?: number;
    options?: { name: string; price?: number; sortOrder?: number }[];
  }): Promise<unknown>;
  createOption(
    groupId: string,
    data: { name: string; price?: number; sortOrder?: number },
  ): Promise<unknown>;
  getOptionGroupsByItem(menuItemId: string): Promise<unknown[]>;
}

export interface ModifierWriteResult {
  /** Groups created on this dish. */
  created: number;
  /** Groups the dish already had, left alone. */
  skipped: number;
  /** Groups that could not be created. The dish itself is already live. */
  failed: number;
}

/** A few choices at a time: not one-by-one, not sixty at once. */
const OPTION_BATCH = 5;

export interface WriteOptions {
  /** False when the dish was already in the menu, e.g. a re-import. */
  itemIsNew: boolean;
  /** Called once per group, however it turned out, to advance the progress bar. */
  onGroupDone?: () => void;
}

/**
 * One writer per import, because it remembers how this deployment behaves.
 *
 * The create DTO says choices can be nested in the group ("Options to create
 * along with the group"), but the restaurant dashboard has always posted them
 * one at a time, and being wrong is visible either way — empty groups, or
 * every choice twice. So the first group of an import is checked, and the
 * answer is reused for the hundreds that follow.
 */
export function createModifierWriter(service: OptionGroupService) {
  let nestedOptionsWork: boolean | null = null;

  const optionsLanded = async (
    menuItemId: string,
    groupId: string,
    createdGroup: unknown,
    expected: number,
  ): Promise<boolean> => {
    const echoed = (createdGroup as { options?: unknown } | null)?.options;
    if (Array.isArray(echoed)) return echoed.length >= expected;

    // The create said nothing about them, so read the dish back through the
    // same endpoint the item editor renders its groups from.
    const groups = await service.getOptionGroupsByItem(menuItemId).catch(() => []);
    const saved = groups.find((group) => readId(group) === groupId) as
      | { options?: unknown }
      | undefined;
    return Array.isArray(saved?.options) && saved.options.length >= expected;
  };

  const createGroup = async (
    menuItemId: string,
    group: NormalizedOptionGroup,
    sortOrder: number,
  ): Promise<void> => {
    const options = group.options.map((option, index) => ({
      name: option.name,
      price: option.price,
      sortOrder: index,
    }));

    const createdGroup = await service.createOptionGroup({
      menuItemId,
      name: group.name,
      type: group.type,
      isRequired: group.isRequired,
      sortOrder,
      // Once nesting is known not to work, sending them again is dead weight.
      ...(nestedOptionsWork === false ? {} : { options }),
    });

    const groupId = readId(createdGroup);
    if (!groupId) {
      throw new Error(`The API created "${group.name}" without returning its id.`);
    }

    if (nestedOptionsWork === null) {
      nestedOptionsWork = await optionsLanded(
        menuItemId,
        groupId,
        createdGroup,
        options.length,
      );
      console.info(
        `[menu import] option groups take their choices ${
          nestedOptionsWork ? "nested" : "one request at a time"
        }`,
      );
    }
    if (nestedOptionsWork) return;

    for (let start = 0; start < options.length; start += OPTION_BATCH) {
      await Promise.all(
        options
          .slice(start, start + OPTION_BATCH)
          .map((option) => service.createOption(groupId, option)),
      );
    }
  };

  return {
    /** Attach `groups` to a dish, skipping any it already has. */
    async write(
      menuItemId: string,
      groups: NormalizedOptionGroup[],
      { itemIsNew, onGroupDone }: WriteOptions,
    ): Promise<ModifierWriteResult> {
      const result: ModifierWriteResult = { created: 0, skipped: 0, failed: 0 };
      if (groups.length === 0) return result;

      // Re-importing a menu must not give every dish "Add Ingredients" twice,
      // so a dish we did not just create is asked what it already has.
      const alreadyThere = itemIsNew
        ? new Set<string>()
        : new Set(
            (await service.getOptionGroupsByItem(menuItemId).catch(() => []))
              .map((group) => (group as { name?: unknown }).name)
              .filter((name): name is string => typeof name === "string")
              .map((name) => name.trim().toLowerCase()),
          );

      for (const [index, group] of groups.entries()) {
        if (alreadyThere.has(group.name.trim().toLowerCase())) {
          result.skipped += 1;
        } else {
          try {
            await createGroup(menuItemId, group, index);
            result.created += 1;
          } catch (error) {
            // The dish is already live; losing the rest of the menu over one
            // rejected modifier is not a trade worth making.
            result.failed += 1;
            console.warn(`Option group "${group.name}" failed:`, error);
          }
        }
        onGroupDone?.();
      }

      return result;
    },
  };
}
