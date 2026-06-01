import { apiClient } from './apiClient';

export interface RestaurantCategory {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  isActive: boolean;
}

export interface PaginatedCategories {
  data: RestaurantCategory[];
  total: number;
  page: number;
  limit: number;
}

export const restaurantCategoriesService = {
  createCategory: (data: Partial<RestaurantCategory>) => {
    return apiClient<RestaurantCategory>('/api/v1/restaurant-categories', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  getActiveCategories: () => {
    return apiClient<RestaurantCategory[]>('/api/v1/restaurant-categories');
  },

  getAllCategories: (page = 1, limit = 10, search = "") => {
    const queryParams = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
      ...(search && { search })
    });
    return apiClient<PaginatedCategories>(`/api/v1/restaurant-categories/admin/all?${queryParams.toString()}`);
  },

  getCategoryById: (id: string) => {
    return apiClient<RestaurantCategory>(`/api/v1/restaurant-categories/${id}`);
  },

  updateCategory: (id: string, data: Partial<RestaurantCategory>) => {
    return apiClient<RestaurantCategory>(`/api/v1/restaurant-categories/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  deleteCategory: (id: string) => {
    return apiClient<void>(`/api/v1/restaurant-categories/${id}`, {
      method: 'DELETE',
    });
  }
};
