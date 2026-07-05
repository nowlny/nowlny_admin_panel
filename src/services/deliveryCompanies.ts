import { apiClient } from "./apiClient";

export interface DeliveryCompany {
  id: string;
  name: string;
  description?: string;
  logo?: string;
  phone: string;
  deliveryCharge: number;
  currencyId: string;
  allowDriverVisibility: boolean;
  status: "pending" | "active" | "rejected" | "suspended" | "inactive";
  createdAt?: string;
  updatedAt?: string;
  rejectionReason?: string;
}

export interface DeliveryCompanyReview {
  approve: boolean;
  rejectionReason?: string;
}

export const deliveryCompaniesService = {
  /**
   * Get all delivery companies
   */
  getDeliveryCompanies: (params?: {
    status?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) => {
    let query = "";
    if (params) {
      const searchParams = new URLSearchParams();
      if (params.status && params.status !== "all")
        searchParams.append("status", params.status);
      if (params.search) searchParams.append("search", params.search);
      if (params.page) searchParams.append("page", params.page.toString());
      if (params.limit) searchParams.append("limit", params.limit.toString());
      const str = searchParams.toString();
      if (str) query = `?${str}`;
    }
    return apiClient<any>(`/api/v1/delivery-companies${query}`, {
      method: "GET",
    });
  },

  /**
   * Admin reviews a pending delivery company
   */
  reviewCompany: (id: string, data: DeliveryCompanyReview) => {
    return apiClient<void>(`/api/v1/delivery-companies/${id}/review`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },
};
