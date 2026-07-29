import { apiClient, buildQuery, toList, toPaginated } from "./apiClient";

export type ReelStatus = "active" | "hidden";
export type SharePlatform = "instagram" | "facebook" | "tiktok";

export interface Reel {
  id: string;
  restaurantId?: string;
  restaurantName?: string;
  videoUrl?: string;
  thumbnailUrl?: string;
  caption?: string | null;
  menuItemId?: string | null;
  menuItemName?: string | null;
  status: ReelStatus | string;
  likesCount?: number;
  commentsCount?: number;
  viewsCount?: number;
  sharesCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

/** `GET /api/v1/reels/admin/restaurants` — merchants ordered by reel count. */
export interface RestaurantWithReels {
  id: string;
  name: string;
  logo?: string | null;
  reelsCount?: number;
  reels?: Reel[];
}

export interface ReelComment {
  id: string;
  reelId?: string;
  comment?: string;
  content?: string;
  text?: string;
  createdAt?: string;
  customerName?: string | null;
  customer?: { fullName?: string; nickname?: string } | null;
}

export interface ReelPayload {
  videoUrl: string;
  thumbnailUrl?: string;
  caption?: string;
  menuItemId?: string;
  shareTo?: SharePlatform[];
}

export const reelsService = {
  // ─── Owner ─────────────────────────────────────────────────────────────────

  getOwnReels: async (params?: { page?: number; limit?: number }) => {
    const payload = await apiClient<unknown>(
      `/api/v1/reels/me${buildQuery({ ...params })}`,
    );
    return toPaginated<Reel>(payload, params?.limit ?? 20);
  },

  createOwnReel: (data: ReelPayload) =>
    apiClient<Reel>("/api/v1/reels/me", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateOwnReel: (
    id: string,
    data: Partial<ReelPayload> & { status?: ReelStatus },
  ) =>
    apiClient<Reel>(`/api/v1/reels/me/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  deleteOwnReel: (id: string) =>
    apiClient<void>(`/api/v1/reels/me/${id}`, { method: "DELETE" }),

  // ─── Admin ─────────────────────────────────────────────────────────────────

  /**
   * The moderation queue. Previously the section had no way to *list* reels at
   * all — it could only create, hide and delete ones whose id you already knew.
   */
  getRestaurantsWithReels: async (params?: {
    page?: number;
    limit?: number;
  }) => {
    const payload = await apiClient<unknown>(
      `/api/v1/reels/admin/restaurants${buildQuery({ ...params })}`,
    );
    return toPaginated<RestaurantWithReels>(payload, params?.limit ?? 20);
  },

  getReelById: (id: string) => apiClient<Reel>(`/api/v1/reels/${id}`),

  createReelForRestaurant: (restaurantId: string, data: ReelPayload) =>
    apiClient<Reel>(`/api/v1/reels/admin/restaurant/${restaurantId}`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  setReelStatusAsAdmin: (id: string, status: ReelStatus) =>
    apiClient<Reel>(`/api/v1/reels/admin/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),

  deleteReelAsAdmin: (id: string) =>
    apiClient<void>(`/api/v1/reels/admin/${id}`, { method: "DELETE" }),

  // ─── Comment moderation ────────────────────────────────────────────────────

  getComments: async (reelId: string) => {
    const payload = await apiClient<unknown>(`/api/v1/reels/${reelId}/comments`);
    return toList<ReelComment>(payload);
  },

  deleteComment: (commentId: string) =>
    apiClient<void>(`/api/v1/reels/comments/${commentId}`, {
      method: "DELETE",
    }),
};
