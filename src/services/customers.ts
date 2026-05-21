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

export const customersService = {
  getCustomers: () => {
    return apiClient<CustomerResponse[]>('/api/v1/customers');
  },
  
  getCustomerById: (id: string) => {
    return apiClient<CustomerResponse>(`/api/v1/customers/${id}`);
  },
  
  updateCustomer: (id: string, data: { status: string }) => {
    return apiClient<CustomerResponse>(`/api/v1/customers/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },
  
  deleteCustomer: (id: string) => {
    return apiClient<void>(`/api/v1/customers/${id}`, {
      method: 'DELETE',
    });
  }
};
