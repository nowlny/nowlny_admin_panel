import { apiClient, buildQuery, toPaginated } from "./apiClient";

export interface RestaurantCategory {
  id: string;
  name: string;
  description?: string | null;
  icon?: string | null;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CategoryPayload {
  name?: string;
  description?: string;
  icon?: string;
  isActive?: boolean;
}

export const restaurantCategoriesService = {
  createCategory: (data: CategoryPayload) =>
    apiClient<RestaurantCategory>("/api/v1/restaurant-categories", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  /** Public list — active categories only. */
  getActiveCategories: async (params?: { name?: string; limit?: number }) => {
    const payload = await apiClient<unknown>(
      `/api/v1/restaurant-categories${buildQuery({ limit: 100, ...params })}`,
    );
    return toPaginated<RestaurantCategory>(payload, params?.limit ?? 100);
  },

  /**
   * Admin list. The query parameters are `name` and `isActive` — the panel used
   * to send `search`, which the API ignores, so the search box did nothing.
   */
  getAllCategories: async (params?: {
    name?: string;
    isActive?: boolean;
    page?: number;
    limit?: number;
  }) => {
    const payload = await apiClient<unknown>(
      `/api/v1/restaurant-categories/admin/all${buildQuery({ ...params })}`,
    );
    return toPaginated<RestaurantCategory>(payload, params?.limit ?? 20);
  },

  getCategoryById: (id: string) =>
    apiClient<RestaurantCategory>(`/api/v1/restaurant-categories/${id}`),

  updateCategory: (id: string, data: CategoryPayload) =>
    apiClient<RestaurantCategory>(`/api/v1/restaurant-categories/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  deleteCategory: (id: string) =>
    apiClient<void>(`/api/v1/restaurant-categories/${id}`, {
      method: "DELETE",
    }),
};
