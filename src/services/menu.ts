import { apiClient, toList } from "./apiClient";

export interface MenuSection {
  id: string;
  restaurantId?: string;
  name: string;
  description?: string | null;
  sortOrder: number;
  isActive: boolean;
  items?: MenuItem[];
}

/** Predefined item tag (`Spicy`, `Vegan`, …) — admin-managed. */
export interface MenuTag {
  id: string;
  name: string;
  icon?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface MenuItem {
  id: string;
  sectionId: string;
  name: string;
  description?: string | null;
  /** Prices come back as decimal strings (`"750000.00"`). */
  price: number | string;
  discountedPrice?: number | string | null;
  image?: string | null;
  isActive: boolean;
  isAvailable: boolean;
  isPopular: boolean;
  tags?: MenuTag[];
  tagIds?: string[];
  sortOrder: number;
}

export interface MenuOption {
  id: string;
  name: string;
  price: number | string;
  sortOrder: number;
}

export interface MenuOptionGroup {
  id: string;
  menuItemId: string;
  name: string;
  type: "radio" | "checkbox";
  isRequired: boolean;
  sortOrder: number;
  options?: MenuOption[];
}

/**
 * One choice inside an option group, as the API takes it.
 *
 * `price` is a *surcharge* — what this choice adds to the dish's own price,
 * not what the choice costs on its own. A free choice is 0.
 */
export interface MenuOptionPayload {
  name: string;
  price?: number;
  sortOrder?: number;
}

export interface MenuOptionGroupPayload {
  menuItemId: string;
  name: string;
  /** `radio` = pick exactly one, `checkbox` = pick any number. */
  type: "radio" | "checkbox";
  isRequired?: boolean;
  sortOrder?: number;
  /** Created in the same request as the group, rather than one call each. */
  options?: MenuOptionPayload[];
}

export interface MenuItemPayload {
  sectionId?: string;
  name?: string;
  description?: string;
  image?: string;
  price?: number;
  discountedPrice?: number;
  sortOrder?: number;
  isActive?: boolean;
  isAvailable?: boolean;
  isPopular?: boolean;
  /** The API takes tag *ids*, not free-text tag names. */
  tagIds?: string[];
}

export const menuService = {
  // ─── Sections ──────────────────────────────────────────────────────────────

  createSection: (data: Partial<MenuSection>) =>
    apiClient<MenuSection>("/api/v1/menu/sections", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getSectionsByRestaurant: async (restaurantId: string) => {
    const payload = await apiClient<unknown>(
      `/api/v1/menu/sections/restaurant/${restaurantId}`,
    );
    return toList<MenuSection>(payload);
  },

  getSectionById: (id: string) =>
    apiClient<MenuSection>(`/api/v1/menu/sections/${id}`),

  updateSection: (id: string, data: Partial<MenuSection>) =>
    apiClient<MenuSection>(`/api/v1/menu/sections/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  deleteSection: (id: string) =>
    apiClient<void>(`/api/v1/menu/sections/${id}`, { method: "DELETE" }),

  reorderSections: (orderedIds: string[]) =>
    apiClient<void>("/api/v1/menu/sections/reorder", {
      method: "PUT",
      body: JSON.stringify({ orderedIds }),
    }),

  // ─── Items ─────────────────────────────────────────────────────────────────

  createItem: (data: MenuItemPayload) =>
    apiClient<MenuItem>("/api/v1/menu/items", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getItemsBySection: async (sectionId: string) => {
    const payload = await apiClient<unknown>(
      `/api/v1/menu/items/section/${sectionId}`,
    );
    return toList<MenuItem>(payload);
  },

  getItemById: (id: string) => apiClient<MenuItem>(`/api/v1/menu/items/${id}`),

  updateItem: (id: string, data: MenuItemPayload) =>
    apiClient<MenuItem>(`/api/v1/menu/items/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  deleteItem: (id: string) =>
    apiClient<void>(`/api/v1/menu/items/${id}`, { method: "DELETE" }),

  reorderItems: (sectionId: string, orderedIds: string[]) =>
    apiClient<void>(`/api/v1/menu/sections/${sectionId}/items/reorder`, {
      method: "PUT",
      body: JSON.stringify({ orderedIds }),
    }),

  // ─── Option groups ─────────────────────────────────────────────────────────

  createOptionGroup: (data: MenuOptionGroupPayload) =>
    apiClient<MenuOptionGroup>("/api/v1/menu/option-groups", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getOptionGroupsByItem: async (menuItemId: string) => {
    const payload = await apiClient<unknown>(
      `/api/v1/menu/option-groups/item/${menuItemId}`,
    );
    return toList<MenuOptionGroup>(payload);
  },

  getOptionGroupById: (id: string) =>
    apiClient<MenuOptionGroup>(`/api/v1/menu/option-groups/${id}`),

  updateOptionGroup: (id: string, data: Partial<MenuOptionGroup>) =>
    apiClient<MenuOptionGroup>(`/api/v1/menu/option-groups/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  deleteOptionGroup: (id: string) =>
    apiClient<void>(`/api/v1/menu/option-groups/${id}`, { method: "DELETE" }),

  reorderOptionGroups: (itemId: string, orderedIds: string[]) =>
    apiClient<void>(`/api/v1/menu/items/${itemId}/option-groups/reorder`, {
      method: "PUT",
      body: JSON.stringify({ orderedIds }),
    }),

  // ─── Options ───────────────────────────────────────────────────────────────

  createOption: (groupId: string, data: Partial<MenuOption>) =>
    apiClient<MenuOption>(`/api/v1/menu/option-groups/${groupId}/options`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateOption: (id: string, data: Partial<MenuOption>) =>
    apiClient<MenuOption>(`/api/v1/menu/options/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  deleteOption: (id: string) =>
    apiClient<void>(`/api/v1/menu/options/${id}`, { method: "DELETE" }),

  reorderOptions: (groupId: string, orderedIds: string[]) =>
    apiClient<void>(`/api/v1/menu/option-groups/${groupId}/options/reorder`, {
      method: "PUT",
      body: JSON.stringify({ orderedIds }),
    }),

  // ─── Tags (admin) ──────────────────────────────────────────────────────────

  getTags: async () => {
    const payload = await apiClient<unknown>("/api/v1/menu/tags");
    return toList<MenuTag>(payload);
  },

  createTag: (data: { name: string; icon?: string }) =>
    apiClient<MenuTag>("/api/v1/menu/tags", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateTag: (id: string, data: { name?: string; icon?: string }) =>
    apiClient<MenuTag>(`/api/v1/menu/tags/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  deleteTag: (id: string) =>
    apiClient<void>(`/api/v1/menu/tags/${id}`, { method: "DELETE" }),
};
