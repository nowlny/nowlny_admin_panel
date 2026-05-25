import { apiClient } from './apiClient';

export interface MenuSection {
  id: string;
  restaurantId?: string;
  name: string;
  description?: string;
  sortOrder: number;
  isActive: boolean;
}

export interface MenuItem {
  id: string;
  sectionId: string;
  name: string;
  description?: string;
  price: number;
  discountedPrice?: number;
  image?: string;
  isActive: boolean;
  isAvailable: boolean;
  isPopular: boolean;
  tags?: string[];
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

export interface MenuOption {
  id: string;
  name: string;
  price: number;
  sortOrder: number;
}

export const menuService = {
  // Sections
  createSection: (data: Partial<MenuSection>) => {
    return apiClient<MenuSection>('/api/v1/menu/sections', { method: 'POST', body: JSON.stringify(data) });
  },
  getSectionsByRestaurant: (restaurantId: string) => {
    return apiClient<MenuSection[]>(`/api/v1/menu/sections/restaurant/${restaurantId}`);
  },
  getSectionById: (id: string) => {
    return apiClient<MenuSection>(`/api/v1/menu/sections/${id}`);
  },
  updateSection: (id: string, data: Partial<MenuSection>) => {
    return apiClient<MenuSection>(`/api/v1/menu/sections/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
  },
  deleteSection: (id: string) => {
    return apiClient<void>(`/api/v1/menu/sections/${id}`, { method: 'DELETE' });
  },

  // Items
  createItem: (data: Partial<MenuItem>) => {
    return apiClient<MenuItem>('/api/v1/menu/items', { method: 'POST', body: JSON.stringify(data) });
  },
  getItemsBySection: (sectionId: string) => {
    return apiClient<MenuItem[]>(`/api/v1/menu/items/section/${sectionId}`);
  },
  getItemById: (id: string) => {
    return apiClient<MenuItem>(`/api/v1/menu/items/${id}`);
  },
  updateItem: (id: string, data: Partial<MenuItem>) => {
    return apiClient<MenuItem>(`/api/v1/menu/items/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
  },
  deleteItem: (id: string) => {
    return apiClient<void>(`/api/v1/menu/items/${id}`, { method: 'DELETE' });
  },

  // Option Groups
  createOptionGroup: (data: Partial<MenuOptionGroup>) => {
    return apiClient<MenuOptionGroup>('/api/v1/menu/option-groups', { method: 'POST', body: JSON.stringify(data) });
  },
  getOptionGroupsByItem: (menuItemId: string) => {
    return apiClient<MenuOptionGroup[]>(`/api/v1/menu/option-groups/item/${menuItemId}`);
  },
  getOptionGroupById: (id: string) => {
    return apiClient<MenuOptionGroup>(`/api/v1/menu/option-groups/${id}`);
  },
  updateOptionGroup: (id: string, data: Partial<MenuOptionGroup>) => {
    return apiClient<MenuOptionGroup>(`/api/v1/menu/option-groups/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
  },
  deleteOptionGroup: (id: string) => {
    return apiClient<void>(`/api/v1/menu/option-groups/${id}`, { method: 'DELETE' });
  },

  // Options
  createOption: (groupId: string, data: Partial<MenuOption>) => {
    return apiClient<MenuOption>(`/api/v1/menu/option-groups/${groupId}/options`, { method: 'POST', body: JSON.stringify(data) });
  },
  updateOption: (id: string, data: Partial<MenuOption>) => {
    return apiClient<MenuOption>(`/api/v1/menu/options/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
  },
  deleteOption: (id: string) => {
    return apiClient<void>(`/api/v1/menu/options/${id}`, { method: 'DELETE' });
  }
};
