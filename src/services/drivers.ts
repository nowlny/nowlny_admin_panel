import { apiClient, buildQuery, toList } from "./apiClient";
import type { StatisticsPeriod } from "./orders";

/* ---------------------------------------------------------------------------
   Drivers — `/api/v1/drivers/*`.

   Note the access model: `GET /api/v1/drivers` lists the *caller's own fleet*
   and is scoped to restaurant owners and delivery companies, so there is no
   platform-wide driver roster for an admin to page through. What an admin can
   read is a specific driver's performance and ratings, which is what a
   dispatch dispute actually needs.
--------------------------------------------------------------------------- */

export interface DriverPerformance {
  driverId: string;
  period: StatisticsPeriod;
  deliveries: {
    completed: number;
    declined: number;
    acceptanceRate: number;
  };
  timing: {
    avgDeliveryMinutes: number;
    onTimeRate: number;
  };
  rating: {
    average: number;
    total: number;
    breakdown?: Record<string, number>;
  };
}

export interface DriverRating {
  id: string;
  rating: number;
  comment?: string | null;
  createdAt?: string;
  orderId?: string;
  customerName?: string | null;
}

export interface FleetDriver {
  id: string;
  fullName?: string;
  phoneNumber?: string;
  vehicleType?: "motorcycle" | "car" | "bicycle" | "scooter" | string;
  vehiclePlate?: string | null;
  status?: "active" | "inactive" | string;
  isAvailable?: boolean;
  rating?: number;
  totalRatings?: number;
}

export const driversService = {
  /** Own fleet (restaurant owner or delivery company). */
  getFleet: async (params?: {
    status?: "active" | "inactive" | "all" | "";
    search?: string;
    page?: number;
    limit?: number;
  }) => {
    const payload = await apiClient<unknown>(
      `/api/v1/drivers${buildQuery({ ...params })}`,
    );
    return toList<FleetDriver>(payload);
  },

  getDriverById: (id: string) => apiClient<FleetDriver>(`/api/v1/drivers/${id}`),

  /** Readable by an admin for any driver. */
  getPerformance: (id: string, period: StatisticsPeriod = "month") =>
    apiClient<DriverPerformance>(
      `/api/v1/drivers/${id}/performance${buildQuery({ period })}`,
    ),

  getRatings: async (id: string) => {
    const payload = await apiClient<unknown>(`/api/v1/drivers/${id}/ratings`);
    return toList<DriverRating>(payload);
  },
};
