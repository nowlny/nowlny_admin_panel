import { apiClient, buildQuery, toPaginated } from "./apiClient";

export type CustomerStatus = "active" | "inactive" | "suspended";

/** The list joins the customer row to its `user` record. */
export interface CustomerResponse {
  id: string;
  userId?: string;
  nickname?: string | null;
  status?: CustomerStatus;
  createdAt?: string;
  updatedAt?: string;
  user?: {
    id?: string;
    fullName?: string | null;
    nickname?: string | null;
    phoneNumber?: string | null;
    email?: string | null;
    profileImage?: string | null;
    createdAt?: string;
  } | null;
  addresses?: unknown[];
  [key: string]: unknown;
}

export interface CustomerCreateData {
  phoneNumber: string;
  fullName: string;
  nickname?: string;
  status?: CustomerStatus;
}

export type CustomerUpdateData = Partial<CustomerCreateData>;

export interface ListCustomersParams {
  search?: string;
  status?: CustomerStatus | "all" | "";
  page?: number;
  limit?: number;
}

export const customersService = {
  /**
   * `GET /api/v1/customers` — paginated, with server-side `search` and
   * `status`. The panel used to pull one unfiltered page and filter it in the
   * browser, so searching only ever looked at the first 20 accounts.
   */
  getCustomers: async (params?: ListCustomersParams) => {
    const payload = await apiClient<unknown>(
      `/api/v1/customers${buildQuery({ ...params })}`,
    );
    return toPaginated<CustomerResponse>(payload, params?.limit ?? 20);
  },

  getCustomerById: (id: string) =>
    apiClient<CustomerResponse>(`/api/v1/customers/${id}`),

  createCustomer: (data: CustomerCreateData) =>
    apiClient<CustomerResponse>("/api/v1/customers", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateCustomer: (id: string, data: CustomerUpdateData) =>
    apiClient<CustomerResponse>(`/api/v1/customers/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  deleteCustomer: (id: string) =>
    apiClient<void>(`/api/v1/customers/${id}`, { method: "DELETE" }),
};
