import { apiClient } from './apiClient';

export interface AddressCreatePayload {
  name: string;
  street: string;
  city: string;
  building?: string;
  apartment?: string;
  floor?: string;
  latitude: number;
  longitude: number;
  isDefault?: boolean;
}

export type AddressUpdatePayload = Partial<AddressCreatePayload>;

export interface AddressResponse extends AddressCreatePayload {
  id: string;
  customerId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export const addressesService = {
  /**
   * Add an address for the authenticated customer
   * POST /api/v1/me/addresses
   */
  createAddress: (data: AddressCreatePayload) => {
    return apiClient<AddressResponse>('/api/v1/me/addresses', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * List addresses for the authenticated customer
   * GET /api/v1/me/addresses
   */
  getAddresses: () => {
    return apiClient<AddressResponse[]>('/api/v1/me/addresses');
  },

  /**
   * Get a specific address
   * GET /api/v1/me/addresses/{id}
   */
  getAddressById: (id: string) => {
    return apiClient<AddressResponse>(`/api/v1/me/addresses/${id}`);
  },

  /**
   * Update an address
   * PATCH /api/v1/me/addresses/{id}
   */
  updateAddress: (id: string, data: AddressUpdatePayload) => {
    return apiClient<AddressResponse>(`/api/v1/me/addresses/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  /**
   * Delete an address
   * DELETE /api/v1/me/addresses/{id}
   */
  deleteAddress: (id: string) => {
    return apiClient<void>(`/api/v1/me/addresses/${id}`, {
      method: 'DELETE',
    });
  }
};
