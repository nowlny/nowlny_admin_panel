import { apiClient, buildQuery, Paginated, toPaginated } from "./apiClient";

// ─── Enums / literals ────────────────────────────────────────────────────────

export type OrderStatus =
  | "pending"
  | "confirmed"
  | "out_for_delivery"
  | "delivered"
  | "cancelled"
  | "rejected";

/** `FindOrdersQueryDto.paymentStatus` — the API has no `refunded` state. */
export type PaymentStatus = "pending" | "paid" | "failed";

export type StatisticsPeriod = "today" | "week" | "month" | "year" | "all";

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
  paymentMethod: "cash" | "card" | "wallet";
  customerNotes?: string;
  changeFor?: number;
}

export interface UpdateOrderPayload {
  status?: OrderStatus;
  paymentStatus?: PaymentStatus;
  customerNotes?: string;
}

export interface ListOrdersParams {
  status?: OrderStatus | "";
  paymentStatus?: PaymentStatus | "";
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
  orderNumber?: string;
  customerId: string;
  customerName?: string;
  customer?: {
    name?: string;
    firstName?: string;
    fullName?: string;
    phoneNumber?: string;
  };
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
  restaurant?: {
    id?: string;
    name?: string;
    phone?: string;
    logo?: string | null;
  };
  addressId?: string;
  driverId?: string;
  driverName?: string;
  items: OrderItemResponse[];
  subtotal?: number;
  deliveryFee?: number;
  serviceFee?: number;
  discount?: number;
  total?: number;
  /** Orders carry the merchant's currency; totals are not dollars by default. */
  currency?: { code?: string; symbol?: string } | null;
  currencyCode?: string;
  status: OrderStatus;
  paymentMethod?: string;
  paymentStatus: PaymentStatus;
  customerNotes?: string;
  createdAt?: string;
  updatedAt?: string;
  timeline?: { status: string; timestamp: string; note?: string }[];
  [key: string]: unknown;
}

export type PaginatedOrdersResponse = Paginated<OrderResponse>;

export interface RestaurantStatistics {
  period: StatisticsPeriod;
  totalOrders: number;
  totalRevenue: number;
  currency?: { code?: string; symbol?: string };
  newCustomers?: number;
  avgRating?: number;
  totalRatings?: number;
  weeklyPerformance?: {
    date: string;
    day: string;
    orders: number;
    revenue: number;
  }[];
}

// ─── Service ──────────────────────────────────────────────────────────────────

const list = async (
  path: string,
  params?: Omit<ListOrdersParams, "restaurantId">,
): Promise<PaginatedOrdersResponse> => {
  const payload = await apiClient<unknown>(`${path}${buildQuery({ ...params })}`);
  return toPaginated<OrderResponse>(payload, params?.limit ?? 20);
};

export const ordersService = {
  /**
   * `GET /api/v1/orders` (admin), or the per-restaurant list when scoped.
   * Both accept `status`, `paymentStatus`, `page` and `limit`.
   */
  getOrders: ({ restaurantId, ...params }: ListOrdersParams = {}) =>
    list(
      restaurantId
        ? `/api/v1/orders/restaurant/${restaurantId}`
        : "/api/v1/orders",
      params,
    ),

  getOrderById: (id: string) => apiClient<OrderResponse>(`/api/v1/orders/${id}`),

  /** `PATCH /api/v1/orders/{id}` (admin) — status and payment status. */
  updateOrder: (id: string, data: UpdateOrderPayload) =>
    apiClient<OrderResponse>(`/api/v1/orders/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  createOrder: (data: CreateOrderPayload) =>
    apiClient<OrderResponse>("/api/v1/orders", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getOrdersByCustomer: (customerId: string, params?: ListOrdersParams) =>
    list(`/api/v1/orders/customer/${customerId}`, params),

  getOrdersByRestaurant: (restaurantId: string, params?: ListOrdersParams) =>
    list(`/api/v1/orders/restaurant/${restaurantId}`, params),

  // ─── Restaurant owner ──────────────────────────────────────────────────────

  getMyRestaurantOrders: (params?: ListOrdersParams) =>
    list("/api/v1/orders/restaurant/me", params),

  getMyRestaurantOrderById: (id: string) =>
    apiClient<OrderResponse>(`/api/v1/orders/restaurant/me/${id}`),

  /** `GET /api/v1/orders/restaurant/me/statistics` */
  getMyRestaurantStatistics: (period: StatisticsPeriod = "week") =>
    apiClient<RestaurantStatistics>(
      `/api/v1/orders/restaurant/me/statistics${buildQuery({ period })}`,
    ),

  /**
   * The owner order actions live under `/orders/me/{id}/…`, not
   * `/orders/restaurant/me/{id}/…`. Every Accept and Reject button in the
   * merchant view was firing at a path that does not exist.
   */
  acceptMyOrder: (id: string) =>
    apiClient<OrderResponse>(`/api/v1/orders/me/${id}/accept`, {
      method: "PATCH",
    }),

  rejectMyOrder: (id: string, reason?: string) =>
    apiClient<OrderResponse>(`/api/v1/orders/me/${id}/reject`, {
      method: "PATCH",
      body: JSON.stringify({ ...(reason ? { reason } : {}) }),
    }),

  /**
   * Replaces the invented `PATCH /orders/restaurant/me/{id}/status`. A
   * confirmed order with a driver assigned moves out for delivery through its
   * own endpoint; there is no free-form status setter for owners.
   */
  sendMyOrderOutForDelivery: (id: string) =>
    apiClient<OrderResponse>(`/api/v1/orders/me/${id}/out-for-delivery`, {
      method: "PATCH",
    }),

  assignDriverToMyOrder: (id: string, driverId: string) =>
    apiClient<OrderResponse>(`/api/v1/orders/me/${id}/assign-driver`, {
      method: "PATCH",
      body: JSON.stringify({ driverId }),
    }),

  // ─── Customer-side (used for read-only history views) ──────────────────────

  getMyOrders: (params?: ListOrdersParams) => list("/api/v1/orders/me", params),

  getMyOrderById: (id: string) =>
    apiClient<OrderResponse>(`/api/v1/orders/me/${id}`),

  cancelMyOrder: (id: string, reason?: string) =>
    apiClient<OrderResponse>(`/api/v1/orders/me/${id}/cancel`, {
      method: "PATCH",
      body: JSON.stringify({ ...(reason ? { reason } : {}) }),
    }),

  getOrderRating: (id: string) =>
    apiClient<{ rating: number; comment?: string }>(
      `/api/v1/orders/me/${id}/rating`,
    ),

  // ─── Delivery company ──────────────────────────────────────────────────────

  getDeliveryCompanyOrders: (params?: ListOrdersParams) =>
    list("/api/v1/orders/delivery-company/me", params),
};
