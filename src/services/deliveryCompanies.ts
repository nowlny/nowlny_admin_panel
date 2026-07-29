import { apiClient, buildQuery, toList, toPaginated } from "./apiClient";
import type { ExchangeRateRef } from "./restaurants";

export type DeliveryCompanyStatus =
  | "pending"
  | "active"
  | "rejected"
  | "suspended"
  | "inactive";

export interface DeliveryCompany {
  id: string;
  name: string;
  description?: string | null;
  logo?: string | null;
  phone?: string | null;
  deliveryCharge?: number | null;
  currencyId?: string | null;
  currency?: { code?: string; symbol?: string } | null;
  allowDriverVisibility?: boolean;
  status: DeliveryCompanyStatus;
  rating?: number;
  totalRatings?: number;
  /** Fleet / coverage stats returned by the detail and list endpoints. */
  driversCount?: number;
  activeDriversCount?: number;
  zonesCount?: number;
  ownerFullName?: string | null;
  ownerPhoneNumber?: string | null;
  rejectionReason?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface DeliveryCompanyZone {
  id: string;
  name: string;
  polygon: { lat: number; lng: number }[];
  minEstimatedTimeMinutes?: number;
  maxEstimatedTimeMinutes?: number;
  isActive?: boolean;
}

export interface DeliveryCompanyRating {
  id: string;
  rating: number;
  comment?: string | null;
  createdAt?: string;
  restaurantName?: string | null;
  restaurant?: { id?: string; name?: string } | null;
}

export interface DeliveryCompanyReview {
  approve: boolean;
  rejectionReason?: string;
}

export const deliveryCompaniesService = {
  getDeliveryCompanies: async (params?: {
    status?: DeliveryCompanyStatus | "all" | "";
    search?: string;
    page?: number;
    limit?: number;
  }) => {
    const payload = await apiClient<unknown>(
      `/api/v1/delivery-companies${buildQuery({ ...params })}`,
    );
    return toPaginated<DeliveryCompany>(payload, params?.limit ?? 20);
  },

  /** Full profile with fleet and coverage stats. */
  getDeliveryCompanyById: (id: string) =>
    apiClient<DeliveryCompany>(`/api/v1/delivery-companies/${id}`),

  getZones: async (id: string) => {
    const payload = await apiClient<unknown>(
      `/api/v1/delivery-companies/${id}/zones`,
    );
    return toList<DeliveryCompanyZone>(payload);
  },

  getRatings: async (id: string) => {
    const payload = await apiClient<unknown>(
      `/api/v1/delivery-companies/${id}/ratings`,
    );
    return toList<DeliveryCompanyRating>(payload);
  },

  /** Defaults merged with the company's own overrides. */
  getExchangeRates: async (id: string) => {
    const payload = await apiClient<unknown>(
      `/api/v1/delivery-companies/${id}/exchange-rates`,
    );
    return toList<ExchangeRateRef>(payload);
  },

  /** `PATCH /api/v1/delivery-companies/{id}/review` (admin). */
  reviewCompany: (id: string, data: DeliveryCompanyReview) =>
    apiClient<DeliveryCompany>(`/api/v1/delivery-companies/${id}/review`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
};
