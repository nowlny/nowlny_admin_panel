import {
  apiClient,
  buildQuery,
  Paginated,
  toList,
  toPaginated,
} from "./apiClient";

/* ---------------------------------------------------------------------------
   Types mirror `GET /api/v1/restaurants` and friends as the API actually
   answers them. The previous interface described a different product: it had
   `email`, `cuisineType`, `coverImage`, `estimatedDeliveryMinutes`, `revenue`,
   `ordersCount` and `joinedDate`, none of which the backend returns or accepts.
   Every panel bound to those fields rendered an em dash, and every form that
   submitted them was posting properties the DTOs reject.
--------------------------------------------------------------------------- */

export type RestaurantStatus =
  | "active"
  | "inactive"
  | "pending"
  | "rejected"
  | "suspended";

export type SubmissionStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "cancelled";

export type WeekDay =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

export const WEEK_DAYS: WeekDay[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

export interface OpeningHourEntry {
  day: WeekDay;
  is24Hours: boolean;
  openTime?: string;
  closeTime?: string;
}

export interface RestaurantAddress {
  id?: string;
  city: string;
  street: string;
  building?: string;
  latitude: number;
  longitude: number;
}

export interface DeliveryZonePayload {
  name: string;
  polygon: { lat: number; lng: number }[];
}

export interface DeliveryZone extends DeliveryZonePayload {
  id: string;
  restaurantId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface RestaurantCategoryRef {
  id: string;
  name: string;
  icon?: string | null;
  description?: string | null;
  isActive?: boolean;
}

export interface CurrencyRef {
  code: string;
  name?: string;
  symbol?: string;
}

export interface ExchangeRateRef {
  id?: string;
  fromCurrencyId: string;
  toCurrencyId: string;
  /** The API serialises decimals as strings (`"89500.000000"`). */
  rate: string | number;
  restaurantId?: string | null;
  deliveryCompanyId?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface Story {
  id: string;
  restaurantId?: string;
  imageUrl?: string | null;
  videoUrl?: string | null;
  caption?: string | null;
  expiresAt?: string;
  displayOrder?: number;
  createdAt?: string;
  updatedAt?: string;
  seenCount?: number;
  seenByMe?: boolean;
}

export interface RestaurantResponse {
  id: string;
  name: string;
  description?: string | null;
  logo?: string | null;
  backgroundImageUrl?: string | null;
  phone?: string | null;
  website?: string | null;
  deliveryFee?: number | null;
  deliveryTimeMinMinutes?: number | null;
  deliveryTimeMaxMinutes?: number | null;
  deliveryTimeRange?: string | null;
  deliveryCompanyId?: string | null;
  deliveryCompanyName?: string | null;
  autoSendToDeliveryCompany?: boolean;
  hasOffer?: boolean;
  isFeatured?: boolean;
  categories?: RestaurantCategoryRef[];
  categoryIds?: string[];
  currency?: CurrencyRef | null;
  currencyId?: string | null;
  rating?: number;
  totalRatings?: number;
  status?: RestaurantStatus;
  isOpen?: boolean;
  rejectionReason?: string | null;
  openingHours?: OpeningHourEntry[] | null;
  restaurantAddress?: RestaurantAddress | null;
  deliveryZones?: DeliveryZone[];
  exchangeRates?: ExchangeRateRef[];
  stories?: Story[];
  hasStory?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

/** `POST /api/v1/restaurants` (admin). */
export interface RestaurantCreate {
  name: string;
  ownerPhoneNumber?: string;
  ownerFullName?: string;
  description?: string;
  logo?: string;
  backgroundImageUrl?: string;
  phone?: string;
  website?: string;
  city?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  deliveryFee?: number;
  deliveryTimeMinMinutes?: number;
  deliveryTimeMaxMinutes?: number;
  /**
   * The API accepts a bare array or `{ entries: [...] }`; the forms send the
   * array. A day left out is closed.
   */
  openingHours?: OpeningHourEntry[];
  status?: RestaurantStatus;
  currencyId?: string;
  deliveryZones?: DeliveryZonePayload[];
}

/** `PATCH /api/v1/restaurants/{id}` (admin) — adds the structured address. */
export type RestaurantUpdate = Partial<RestaurantCreate> & {
  restaurantAddress?: RestaurantAddress;
};

export interface RestaurantReview {
  decision: "approve" | "reject";
  rejectionReason?: string;
}

/** `POST /api/v1/restaurants/me/apply` — note `restaurantName`, not `name`. */
export interface RestaurantApplyPayload {
  restaurantName: string;
  description?: string;
  logo?: string;
  backgroundImageUrl?: string;
  currencyId?: string;
  phone?: string;
  website?: string;
  deliveryFee?: number;
  deliveryTimeMinMinutes?: number;
  deliveryTimeMaxMinutes?: number;
  openingHours?: OpeningHourEntry[];
  address?: RestaurantAddress;
  categoryIds?: string[];
  deliveryZones?: DeliveryZonePayload[];
}

export type SubmissionUpdatePayload = Omit<
  RestaurantApplyPayload,
  "deliveryZones"
>;

export interface RestaurantSubmission {
  id: string;
  name: string;
  description?: string | null;
  logo?: string | null;
  backgroundImageUrl?: string | null;
  phone?: string | null;
  website?: string | null;
  deliveryFee?: number | null;
  deliveryTimeMinMinutes?: number | null;
  deliveryTimeMaxMinutes?: number | null;
  deliveryTimeRange?: string | null;
  openingHours?: OpeningHourEntry[] | null;
  address?: RestaurantAddress | null;
  categoryIds?: string[];
  currencyId?: string | null;
  status: SubmissionStatus;
  rejectionReason?: string | null;
  restaurantId?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface MenuSectionWithItems {
  id: string;
  name: string;
  description?: string | null;
  sortOrder: number;
  isActive: boolean;
  items: unknown[];
}

export interface RestaurantFullResponse {
  restaurant: RestaurantResponse;
  menu: MenuSectionWithItems[];
  ratings?: unknown;
  deliversToLocation?: boolean | null;
  deliveryZones: DeliveryZone[];
  exchangeRates?: ExchangeRateRef[];
  canReview?: boolean;
  hasStory?: boolean;
}

export interface RatingReaction {
  likes?: number;
  dislikes?: number;
  myReaction?: "like" | "dislike" | "report" | null;
}

export interface RestaurantRating {
  id: string;
  rating: number;
  comment?: string | null;
  createdAt?: string;
  customerName?: string | null;
  customer?: { fullName?: string; nickname?: string } | null;
  reactions?: RatingReaction;
}

export interface RatingDistributionBucket {
  count: number;
  percentage: number;
}

export interface RestaurantRatingsResponse extends Paginated<RestaurantRating> {
  distribution?: Record<string, RatingDistributionBucket>;
}

export interface ListRestaurantsParams {
  name?: string;
  category?: string;
  page?: number;
  limit?: number;
  hasOffer?: boolean;
  freeDelivery?: boolean;
  topRated?: boolean;
  under30min?: boolean;
  newRestaurants?: boolean;
}

export interface StoryPayload {
  imageUrl?: string;
  videoUrl?: string;
  caption?: string;
  shareTo?: ("instagram" | "facebook" | "tiktok")[];
}

/** Bounds a "fetch every page" sweep so a bad `total` can't loop forever. */
const MAX_SWEEP_PAGES = 20;
const SWEEP_PAGE_SIZE = 100;

export const restaurantsService = {
  /**
   * `GET /api/v1/restaurants` — paginated. Returns the envelope so callers can
   * page properly instead of silently rendering only the first slice.
   */
  getRestaurants: async (
    params?: ListRestaurantsParams,
  ): Promise<Paginated<RestaurantResponse>> => {
    const payload = await apiClient<unknown>(
      `/api/v1/restaurants${buildQuery({ ...params })}`,
    );
    return toPaginated<RestaurantResponse>(payload, params?.limit ?? 20);
  },

  /**
   * Walks every page. The dashboard needs platform-wide totals and the list
   * endpoint caps a page well below the merchant count.
   */
  getAllRestaurants: async (
    params?: Omit<ListRestaurantsParams, "page" | "limit">,
  ): Promise<RestaurantResponse[]> => {
    const collected: RestaurantResponse[] = [];
    for (let page = 1; page <= MAX_SWEEP_PAGES; page += 1) {
      const res = await restaurantsService.getRestaurants({
        ...params,
        page,
        limit: SWEEP_PAGE_SIZE,
      });
      collected.push(...res.data);
      if (res.data.length === 0 || collected.length >= res.total) break;
    }
    return collected;
  },

  /** `GET /api/v1/restaurants/featured` */
  getFeaturedRestaurants: async (params?: ListRestaurantsParams) => {
    const payload = await apiClient<unknown>(
      `/api/v1/restaurants/featured${buildQuery({ ...params })}`,
    );
    return toPaginated<RestaurantResponse>(payload, params?.limit ?? 20);
  },

  getRestaurantById: (id: string) =>
    apiClient<RestaurantResponse>(`/api/v1/restaurants/${id}`),

  /** `GET /api/v1/restaurants/{id}/full` — profile, menu and delivery zones. */
  getRestaurantFull: (id: string) =>
    apiClient<RestaurantFullResponse>(`/api/v1/restaurants/${id}/full`),

  getRestaurantMenu: (id: string) =>
    apiClient<MenuSectionWithItems[]>(`/api/v1/restaurants/${id}/menu`),

  getDeliveryZones: async (id: string) => {
    const payload = await apiClient<unknown>(
      `/api/v1/restaurants/${id}/delivery-zones`,
    );
    return toList<DeliveryZone>(payload);
  },

  createRestaurant: (data: RestaurantCreate) =>
    apiClient<RestaurantResponse>("/api/v1/restaurants", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateRestaurant: (id: string, data: RestaurantUpdate) =>
    apiClient<RestaurantResponse>(`/api/v1/restaurants/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  /**
   * Assign a restaurant's categories.
   *
   * Sent as its own request rather than folded into create/update, because the
   * admin DTOs the API publishes (`CreateRestaurantDto`, `UpdateRestaurantDto`)
   * do not declare `categoryIds` — every merchant-facing one does. Kept
   * separate, a backend that rejects the field costs the operator their
   * category picks and nothing else: the restaurant itself is already saved,
   * and the failure is reported rather than swallowed.
   */
  setCategories: (id: string, categoryIds: string[]) =>
    apiClient<RestaurantResponse>(`/api/v1/restaurants/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ categoryIds }),
    }),

  deleteRestaurant: (id: string) =>
    apiClient<void>(`/api/v1/restaurants/${id}`, { method: "DELETE" }),

  markAsFeatured: (id: string) =>
    apiClient<void>(`/api/v1/restaurants/${id}/featured`, { method: "PUT" }),

  removeFeatured: (id: string) =>
    apiClient<void>(`/api/v1/restaurants/${id}/featured`, { method: "DELETE" }),

  // ─── Applications ──────────────────────────────────────────────────────────

  /** `GET /api/v1/restaurants/submissions` (admin) — paginated. */
  getSubmissions: async (params?: {
    status?: string;
    page?: number;
    limit?: number;
  }) => {
    const payload = await apiClient<unknown>(
      `/api/v1/restaurants/submissions${buildQuery({ ...params })}`,
    );
    return toPaginated<RestaurantSubmission>(payload, params?.limit ?? 20);
  },

  reviewSubmission: (id: string, data: RestaurantReview) =>
    apiClient<RestaurantSubmission>(
      `/api/v1/restaurants/submissions/${id}/review`,
      { method: "PATCH", body: JSON.stringify(data) },
    ),

  applyRestaurant: (data: RestaurantApplyPayload) =>
    apiClient<RestaurantSubmission>("/api/v1/restaurants/me/apply", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  /**
   * `GET /api/v1/restaurants/me/submission` is a *paginated list*, not a single
   * record. It used to be typed as one object, so `data.status` read
   * `undefined` and an owner with a pending application was shown the "you
   * haven't applied yet" screen.
   */
  getMySubmissions: async (params?: {
    status?: string;
    page?: number;
    limit?: number;
  }) => {
    const payload = await apiClient<unknown>(
      `/api/v1/restaurants/me/submission${buildQuery({ ...params })}`,
    );
    return toPaginated<RestaurantSubmission>(payload, params?.limit ?? 20);
  },

  /** The submission an owner is currently acting on. */
  getLatestSubmission: async (): Promise<RestaurantSubmission | null> => {
    const res = await restaurantsService.getMySubmissions({ page: 1, limit: 10 });
    if (res.data.length === 0) return null;
    const byRecency = [...res.data].sort(
      (a, b) =>
        new Date(b.createdAt ?? 0).getTime() -
        new Date(a.createdAt ?? 0).getTime(),
    );
    // A pending application outranks an older approved/rejected one — it is
    // the record the owner can still edit or cancel.
    return byRecency.find((s) => s.status === "pending") ?? byRecency[0];
  },

  updateMySubmission: (data: Partial<SubmissionUpdatePayload>) =>
    apiClient<RestaurantSubmission>("/api/v1/restaurants/me/submission", {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  cancelMySubmission: () =>
    apiClient<RestaurantSubmission>("/api/v1/restaurants/me/submission/cancel", {
      method: "PATCH",
    }),

  // ─── Owner profile ─────────────────────────────────────────────────────────

  getMyRestaurant: () => apiClient<RestaurantResponse>("/api/v1/restaurants/me"),

  updateMyRestaurant: (
    data: Partial<
      Omit<RestaurantApplyPayload, "restaurantName" | "address"> & {
        name: string;
        restaurantAddress: RestaurantAddress;
        hasOffer: boolean;
        autoSendToDeliveryCompany: boolean;
      }
    >,
  ) =>
    apiClient<RestaurantResponse>("/api/v1/restaurants/me", {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  /** `POST /api/v1/restaurants/me/profile-images` — multipart, 5 MB per file. */
  uploadProfileImages: (files: { logo?: File; backgroundImage?: File }) => {
    const body = new FormData();
    if (files.logo) body.append("logo", files.logo);
    if (files.backgroundImage)
      body.append("backgroundImage", files.backgroundImage);
    return apiClient<{ logo?: string; backgroundImageUrl?: string }>(
      "/api/v1/restaurants/me/profile-images",
      { method: "POST", body },
    );
  },

  // ─── Ratings ───────────────────────────────────────────────────────────────

  getRatings: (
    id: string,
    params?: {
      page?: number;
      limit?: number;
      sortBy?: "most_recent" | "highest" | "lowest";
    },
  ) =>
    apiClient<RestaurantRatingsResponse>(
      `/api/v1/restaurants/${id}/ratings${buildQuery({ ...params })}`,
    ),

  // ─── Stories ───────────────────────────────────────────────────────────────

  getStories: async (restaurantId: string) => {
    const payload = await apiClient<unknown>(
      `/api/v1/restaurants/${restaurantId}/stories`,
    );
    return toList<Story>(payload);
  },

  createStoryForRestaurant: (restaurantId: string, data: StoryPayload) =>
    apiClient<Story>(`/api/v1/restaurants/admin/${restaurantId}/stories`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateStoryForRestaurant: (
    restaurantId: string,
    storyId: string,
    data: StoryPayload,
  ) =>
    apiClient<Story>(
      `/api/v1/restaurants/admin/${restaurantId}/stories/${storyId}`,
      { method: "PATCH", body: JSON.stringify(data) },
    ),

  deleteStoryForRestaurant: (restaurantId: string, storyId: string) =>
    apiClient<void>(
      `/api/v1/restaurants/admin/${restaurantId}/stories/${storyId}`,
      { method: "DELETE" },
    ),

  // ─── Exchange rate overrides (admin) ───────────────────────────────────────

  /** Effective rates for a merchant: its overrides merged over the defaults. */
  getRestaurantExchangeRates: async (id: string) => {
    const payload = await apiClient<unknown>(
      `/api/v1/restaurants/${id}/exchange-rate`,
    );
    return toList<ExchangeRateRef>(payload);
  },

  setRestaurantExchangeRate: (
    id: string,
    data: { fromCurrencyId: string; toCurrencyId: string; rate: number },
  ) =>
    apiClient<ExchangeRateRef>(`/api/v1/restaurants/${id}/exchange-rate`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  clearRestaurantExchangeRates: (id: string) =>
    apiClient<void>(`/api/v1/restaurants/${id}/exchange-rate`, {
      method: "DELETE",
    }),
};
