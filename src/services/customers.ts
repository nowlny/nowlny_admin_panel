import { apiClient } from './apiClient';

export interface CustomerResponse {
  id: string;
  name?: string;
  email?: string;
  phone?: string;
  status?: string;
  createdAt?: string;
  avatar?: string;
  [key: string]: any;
}

export interface CustomerCreateData {
  phoneNumber: string;
  fullName: string;
  nickname?: string;
  status?: string;
}

export type CustomerUpdateData = Partial<CustomerCreateData>;

export const customersService = {
  getCustomers: () => {
    return apiClient<CustomerResponse[]>('/api/v1/customers');
  },
  
  getCustomerById: (id: string) => {
    return apiClient<CustomerResponse>(`/api/v1/customers/${id}`);
  },
  
  createCustomer: (data: CustomerCreateData) => {
    return apiClient<CustomerResponse>('/api/v1/customers', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  
  updateCustomer: (id: string, data: CustomerUpdateData) => {
    return apiClient<CustomerResponse>(`/api/v1/customers/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },
  
  deleteCustomer: (id: string) => {
    return apiClient<void>(`/api/v1/customers/${id}`, {
      method: 'DELETE',
    });
  },

  /**
   * Get my favorite restaurants
   */
  getMyFavorites: () => {
    return apiClient<any[]>('/api/v1/customers/me/favorites');
  },

  /**
   * Add a restaurant to favorites
   */
  addFavorite: (restaurantId: string) => {
    return apiClient<void>(`/api/v1/customers/me/favorites/${restaurantId}`, {
      method: 'POST',
    });
  },

  /**
   * Remove a restaurant from favorites
   */
  removeFavorite: (restaurantId: string) => {
    return apiClient<void>(`/api/v1/customers/me/favorites/${restaurantId}`, {
      method: 'DELETE',
    });
  }
};
