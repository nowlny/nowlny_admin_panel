import { apiClient } from './apiClient';

export interface RestaurantCategory {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  isActive: boolean;
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

  getAllCategories: () => {
    return apiClient<RestaurantCategory[]>('/api/v1/restaurant-categories/admin/all');
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
