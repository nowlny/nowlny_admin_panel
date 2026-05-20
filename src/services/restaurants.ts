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
}

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
  }
};
