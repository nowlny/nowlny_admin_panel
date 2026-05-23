import { apiClient } from './apiClient';

// ─── Enums / literals ────────────────────────────────────────────────────────

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled'
  | 'rejected';

export type PaymentStatus = 'pending' | 'paid' | 'failed';

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
  restaurantId: string;
  restaurantName?: string;
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
    return apiClient<PaginatedOrdersResponse>(`/api/v1/orders${query}`);
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
};
