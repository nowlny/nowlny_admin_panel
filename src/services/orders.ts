import { apiClient } from './apiClient';

// ─── Enums / literals ────────────────────────────────────────────────────────

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled'
  | 'rejected';

export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';

// ─── Request shapes ───────────────────────────────────────────────────────────

export interface OrderItemPayload {
  menuItemId: string;
  quantity: number;
  selectedOptions?: Record<string, unknown>;
  notes?: string;
}

export interface CreateOrderPayload {
  restaurantId: string;
  addressId: string;
  items: OrderItemPayload[];
  paymentMethod: 'cash' | 'card';
  customerNotes?: string;
}

export interface UpdateOrderPayload {
  status?: OrderStatus;
  paymentStatus?: PaymentStatus;
  customerNotes?: string;
}

export interface ListOrdersParams {
  status?: OrderStatus | '';
  paymentStatus?: PaymentStatus | '';
  restaurantId?: string;
  page?: number;
  limit?: number;
}

// ─── Response shapes ──────────────────────────────────────────────────────────

export interface OrderItemResponse {
  menuItemId: string;
  name?: string;
  quantity: number;
  price?: number;
  selectedOptions?: Record<string, unknown>;
  notes?: string;
}

export interface OrderResponse {
  id: string;
  customerId: string;
  customerName?: string;
  customer?: any;
  deliveryAddress?: {
    city?: string;
    street?: string;
    building?: string;
    floor?: string;
    nickname?: string;
    deliveryInstructions?: string;
    latitude?: string;
    longitude?: string;
  };
  restaurantId: string;
  restaurantName?: string;
  restaurant?: any;
  addressId?: string;
  driverId?: string;
  driverName?: string;
  items: OrderItemResponse[];
  subtotal?: number;
  deliveryFee?: number;
  serviceFee?: number;
  discount?: number;
  total?: number;
  status: OrderStatus;
  paymentMethod?: string;
  paymentStatus: PaymentStatus;
  customerNotes?: string;
  createdAt?: string;
  updatedAt?: string;
  timeline?: { status: string; timestamp: string; note?: string }[];
  [key: string]: unknown;
}

export interface PaginatedOrdersResponse {
  data: OrderResponse[];
  total: number;
  page: number;
  limit: number;
  totalPages?: number;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const ordersService = {
  /**
   * List all orders with optional filters and pagination (admin)
   * GET /api/v1/orders
   */
  getOrders: (params?: ListOrdersParams): Promise<PaginatedOrdersResponse> => {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.append('status', params.status);
    if (params?.paymentStatus) searchParams.append('paymentStatus', params.paymentStatus);
    if (params?.page) searchParams.append('page', params.page.toString());
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
    
    const baseUrl = params?.restaurantId 
      ? `/api/v1/orders/restaurant/${params.restaurantId}`
      : `/api/v1/orders`;
      
    return apiClient<PaginatedOrdersResponse>(`${baseUrl}${query}`);
  },

  /**
   * Get a single order by ID
   * GET /api/v1/orders/{id}
   */
  getOrderById: (id: string): Promise<OrderResponse> => {
    return apiClient<OrderResponse>(`/api/v1/orders/${id}`);
  },

  /**
   * Update order status / payment (admin)
   * PATCH /api/v1/orders/{id}
   */
  updateOrder: (id: string, data: UpdateOrderPayload): Promise<OrderResponse> => {
    return apiClient<OrderResponse>(`/api/v1/orders/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  /**
   * Place a new order (admin)
   * POST /api/v1/orders
   */
  createOrder: (data: CreateOrderPayload): Promise<OrderResponse> => {
    return apiClient<OrderResponse>('/api/v1/orders', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * List orders for a customer (admin)
   */
  getOrdersByCustomer: (customerId: string, params?: ListOrdersParams): Promise<PaginatedOrdersResponse> => {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.append('status', params.status);
    if (params?.page) searchParams.append('page', params.page.toString());
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
    return apiClient<PaginatedOrdersResponse>(`/api/v1/orders/customer/${customerId}${query}`);
  },

  /**
   * List own restaurant orders (restaurant owner)
   */
  getMyRestaurantOrders: (params?: ListOrdersParams): Promise<PaginatedOrdersResponse> => {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.append('status', params.status);
    if (params?.page) searchParams.append('page', params.page.toString());
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
    return apiClient<PaginatedOrdersResponse>(`/api/v1/orders/restaurant/me${query}`);
  },

  /**
   * Get own restaurant order by ID (restaurant owner)
   */
  getMyRestaurantOrderById: (id: string): Promise<OrderResponse> => {
    return apiClient<OrderResponse>(`/api/v1/orders/restaurant/me/${id}`);
  },

  /**
   * List orders for a restaurant (admin)
   */
  getOrdersByRestaurant: (restaurantId: string, params?: ListOrdersParams): Promise<PaginatedOrdersResponse> => {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.append('status', params.status);
    if (params?.page) searchParams.append('page', params.page.toString());
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
    return apiClient<PaginatedOrdersResponse>(`/api/v1/orders/restaurant/${restaurantId}${query}`);
  },

  /**
   * List own orders (customer)
   */
  getMyOrders: (params?: ListOrdersParams): Promise<PaginatedOrdersResponse> => {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.append('status', params.status);
    if (params?.page) searchParams.append('page', params.page.toString());
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
    return apiClient<PaginatedOrdersResponse>(`/api/v1/orders/me${query}`);
  },

  /**
   * Get own order by ID (customer)
   */
  getMyOrderById: (id: string): Promise<OrderResponse> => {
    return apiClient<OrderResponse>(`/api/v1/orders/me/${id}`);
  },

  /**
   * Accept a pending order (restaurant owner)
   */
  acceptMyOrder: (id: string): Promise<void> => {
    return apiClient<void>(`/api/v1/orders/restaurant/me/${id}/accept`, {
      method: 'PATCH',
    });
  },

  /**
   * Reject a pending order (restaurant owner)
   */
  rejectMyOrder: (id: string): Promise<void> => {
    return apiClient<void>(`/api/v1/orders/restaurant/me/${id}/reject`, {
      method: 'PATCH',
    });
  },

  /**
   * Update own order status (restaurant owner)
   */
  updateMyOrderStatus: (id: string, data: { status: OrderStatus }): Promise<void> => {
    return apiClient<void>(`/api/v1/orders/restaurant/me/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  /**
   * Rate a delivered order (customer)

   */
  rateOrder: (id: string, data: { rating: number; review?: string }): Promise<void> => {
    return apiClient<void>(`/api/v1/orders/me/${id}/rating`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * Get rating for own order (customer)
   */
  getOrderRating: (id: string): Promise<{ rating: number; review?: string }> => {
    return apiClient<{ rating: number; review?: string }>(`/api/v1/orders/me/${id}/rating`, {
      method: 'GET',
    });
  }
};
