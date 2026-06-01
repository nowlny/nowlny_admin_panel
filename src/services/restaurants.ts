import { apiClient } from './apiClient';

export interface OpeningHourEntry {
  day: string;
  is24Hours: boolean;
  openTime?: string;
  closeTime?: string;
}

export interface RestaurantCreate {
  name: string;
  description?: string;
  logo?: string;
  coverImage?: string;
  backgroundImageUrl?: string;
  email: string;
  phone: string;
  website?: string;
  city: string;
  address: string;
  latitude: number;
  longitude: number;
  deliveryFee: number;
  estimatedDeliveryMinutes: number;
  cuisineType: string;
  openingHours?: {
    entries: OpeningHourEntry[];
  };
  status?: string;
}

export type RestaurantUpdate = Partial<RestaurantCreate>;

export interface RestaurantReview {
  decision: "approve" | "reject";
  rejectionReason?: string;
}

export interface Story {
  id: string;
  restaurantId: string;
  imageUrl: string;
  caption?: string;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
  seenCount?: number;
  seenByMe?: boolean;
}

// Full interface mapping to backend
export interface RestaurantResponse extends RestaurantCreate {
  id: string;
  rating: number;
  reviewsCount?: number;
  totalRatings?: number;
  revenue?: number;
  ordersCount?: number;
  joinedDate?: string;
  createdAt?: string;
  updatedAt?: string;
  isOpen?: boolean;
  rejectionReason?: string | null;
  documentUrl?: string;
  menu?: any[]; // Keep flexible if not strictly defined
  stories?: Story[];
}

// Restaurant Submission interfaces (matches actual API response)
export interface SubmissionAddress {
  city: string;
  street: string;
  building?: string;
  latitude: number;
  longitude: number;
}

export interface RestaurantSubmission {
  id: string;
  name: string;
  description?: string | null;
  logo?: string | null;
  coverImage?: string | null;
  backgroundImageUrl?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  cuisineType?: string | null;
  deliveryFee?: number | null;
  estimatedDeliveryMinutes?: number | null;
  openingHours?: OpeningHourEntry[] | null;
  address?: SubmissionAddress | null;
  categoryIds?: string[];
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  rejectionReason?: string | null;
  restaurantId?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export type RestaurantApplyPayload = RestaurantCreate;

export const restaurantsService = {
  /**
   * Get all restaurants
   */
  getRestaurants: () => {
    return apiClient<RestaurantResponse[]>('/api/v1/restaurants', {
      method: 'GET',
    });
  },

  /**
   * Get a restaurant by ID
   */
  getRestaurantById: (id: string) => {
    return apiClient<RestaurantResponse>(`/api/v1/restaurants/${id}`, {
      method: 'GET',
    });
  },

  /**
   * Create a restaurant (admin)
   */
  createRestaurant: (data: RestaurantCreate) => {
    return apiClient<RestaurantResponse>('/api/v1/restaurants', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * Update a restaurant (admin)
   */
  updateRestaurant: (id: string, data: RestaurantUpdate) => {
    return apiClient<void>(`/api/v1/restaurants/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  /**
   * Delete a restaurant (admin)
   * DELETE /api/v1/restaurants/{id}
   */
  deleteRestaurant: (id: string) => {
    return apiClient<void>(`/api/v1/restaurants/${id}`, {
      method: 'DELETE',
    });
  },



  /**
   * Admin reviews a pending restaurant application
   */
  reviewRestaurant: (id: string, data: RestaurantReview) => {
    return apiClient<void>(`/api/v1/restaurants/${id}/review`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  /**
   * Get all restaurant applications (admin)
   * GET /api/v1/restaurants/submissions
   */
  getSubmissions: (params?: { status?: string; page?: number; limit?: number }) => {
    let query = '';
    if (params) {
      const searchParams = new URLSearchParams();
      if (params.status && params.status !== 'all') searchParams.append('status', params.status);
      if (params.page) searchParams.append('page', params.page.toString());
      if (params.limit) searchParams.append('limit', params.limit.toString());
      const str = searchParams.toString();
      if (str) query = `?${str}`;
    }
    return apiClient<any>(`/api/v1/restaurants/submissions${query}`, {
      method: 'GET',
    });
  },

  /**
   * Review a restaurant submission (admin)
   * PATCH /api/v1/restaurants/submissions/{id}/review
   */
  reviewSubmission: (id: string, data: RestaurantReview) => {
    return apiClient<void>(`/api/v1/restaurants/submissions/${id}/review`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  /**
   * Apply to be a restaurant (merchant/owner)
   * POST /api/v1/restaurants/me/apply
   */
  applyRestaurant: (data: RestaurantApplyPayload) => {
    return apiClient<RestaurantSubmission>('/api/v1/restaurants/me/apply', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * Cancel own pending restaurant application (merchant/owner)
   * PATCH /api/v1/restaurants/me/submission/cancel
   */
  cancelMySubmission: () => {
    return apiClient<void>('/api/v1/restaurants/me/submission/cancel', {
      method: 'PATCH',
    });
  },

  /**
   * Get own restaurant application status/details (merchant/owner)
   * GET /api/v1/restaurants/me/submission
   */
  getMySubmission: () => {
    return apiClient<RestaurantSubmission>('/api/v1/restaurants/me/submission', {
      method: 'GET',
    });
  },

  /**
   * Edit own pending restaurant submission (partial update)
   */
  updateMySubmission: (data: Partial<RestaurantSubmission>) => {
    return apiClient<RestaurantSubmission>('/api/v1/restaurants/me/submission', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  /**
   * Get own restaurant profile
   */
  getMyRestaurant: () => {
    return apiClient<RestaurantResponse>('/api/v1/restaurants/me', {
      method: 'GET',
    });
  },

  /**
   * Update own restaurant info
   */
  updateMyRestaurant: (data: RestaurantUpdate) => {
    return apiClient<RestaurantResponse>('/api/v1/restaurants/me', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  /**
   * Get current restaurant address (owner)
   */
  getMyAddress: () => {
    return apiClient<SubmissionAddress>('/api/v1/restaurants/me/address', {
      method: 'GET',
    });
  },

  /**
   * Create or replace restaurant address (owner)
   */
  createMyAddress: (data: SubmissionAddress) => {
    return apiClient<SubmissionAddress>('/api/v1/restaurants/me/address', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * Update a restaurant address (owner)
   */
  updateMyAddress: (data: Partial<SubmissionAddress>) => {
    return apiClient<SubmissionAddress>('/api/v1/restaurants/me/address', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  /**
   * Delete a restaurant address (owner)
   */
  deleteMyAddress: () => {
    return apiClient<void>('/api/v1/restaurants/me/address', {
      method: 'DELETE',
    });
  },

  /**
   * Get restaurant info and full menu in one call (public)
   */
  getRestaurantFull: (id: string) => {
    return apiClient<RestaurantResponse>(`/api/v1/restaurants/${id}/full`, {
      method: 'GET',
    });
  },

  /**
   * Get full menu for a restaurant (public)
   */
  getRestaurantMenu: (id: string) => {
    return apiClient<any[]>(`/api/v1/restaurants/${id}/menu`, {
      method: 'GET',
    });
  },

  /**
   * Rate a restaurant (customer)
   */
  rateRestaurant: (id: string, data: { rating: number; review?: string }) => {
    return apiClient<void>(`/api/v1/restaurants/${id}/rating`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * Get own rating for a restaurant (customer)
   */
  getMyRating: (id: string) => {
    return apiClient<{ rating: number; review?: string }>(`/api/v1/restaurants/${id}/rating/me`, {
      method: 'GET',
    });
  }
};
