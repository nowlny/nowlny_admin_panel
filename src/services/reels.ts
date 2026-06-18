import { apiClient } from "./apiClient";

export interface Reel {
  id: string;
  videoUrl: string;
  thumbnailUrl: string;
  caption: string;
  menuItemId: string;
  status: string;
  createdAt: string;
}

export const reelsService = {
  // Owner Endpoints
  getOwnReels: async (params?: { page?: number; limit?: number }) => {
    return apiClient<any>("/api/v1/reels/me", {
      method: "GET",
    });
  },
  createOwnReel: async (data: { videoUrl: string; thumbnailUrl: string; caption: string; menuItemId: string }) => {
    return apiClient<any>("/api/v1/reels/me", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },
  updateOwnReel: async (id: string, data: { videoUrl?: string; thumbnailUrl?: string; caption?: string; menuItemId?: string; status?: string }) => {
    return apiClient<any>(`/api/v1/reels/me/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },
  deleteOwnReel: async (id: string) => {
    return apiClient<void>(`/api/v1/reels/me/${id}`, {
      method: "DELETE",
    });
  },

  // Admin Endpoints
  createReelForRestaurant: async (restaurantId: string, data: { videoUrl: string; thumbnailUrl: string; caption: string; menuItemId: string }) => {
    return apiClient<any>(`/api/v1/reels/admin/restaurant/${restaurantId}`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },
  setReelStatusAsAdmin: async (id: string, status: string) => {
    return apiClient<any>(`/api/v1/reels/admin/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
  },
  deleteReelAsAdmin: async (id: string) => {
    return apiClient<void>(`/api/v1/reels/admin/${id}`, {
      method: "DELETE",
    });
  },
};
