import { apiClient } from "./apiClient";

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  read: boolean;
  timestamp: string;
  userId?: string;
  type?: string;
  data?: Record<string, string> | null;
}

export interface PaginatedNotifications {
  data: AppNotification[];
  total: number;
  page: number;
  limit: number;
  unreadCount: number;
}

/** The entity as `/notifications/me` actually returns it. */
interface ApiNotification {
  id: string;
  userId: string;
  title: string;
  body: string;
  data: Record<string, string> | null;
  isRead: boolean;
  createdAt: string;
}

/**
 * The API names these `isRead` / `createdAt`; the UI was reading `read` /
 * `timestamp`, which never existed, so every notification rendered as unread
 * with a blank time and "mark all read" appeared to do nothing on reload.
 */
function toAppNotification(n: ApiNotification): AppNotification {
  return {
    id: n.id,
    userId: n.userId,
    title: n.title,
    body: n.body,
    read: n.isRead,
    timestamp: n.createdAt,
    type: n.data?.type,
    data: n.data,
  };
}

export const notificationsService = {
  /**
   * Fetch paginated notifications for the authenticated user
   */
  getNotifications: async (
    page: number = 1,
    limit: number = 20,
    unreadOnly: boolean = false
  ): Promise<PaginatedNotifications> => {
    const queryParams = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
      ...(unreadOnly ? { unreadOnly: "true" } : {}),
    });
    
    const res = await apiClient<
      Omit<PaginatedNotifications, "data"> & { data: ApiNotification[] }
    >(`/api/v1/notifications/me?${queryParams}`);
    return { ...res, data: (res.data ?? []).map(toAppNotification) };
  },

  /**
   * Mark a single notification as read
   */
  markAsRead: async (id: string): Promise<void> => {
    return apiClient<void>(`/api/v1/notifications/me/${id}/read`, {
      method: "PATCH",
    });
  },

  /**
   * Mark all notifications as read for the authenticated user
   */
  markAllAsRead: async (): Promise<void> => {
    return apiClient<void>(`/api/v1/notifications/me/read-all`, {
      method: "PATCH",
    });
  },

  /**
   * Send a test push notification (Admin only)
   */
  sendTestNotification: async (token: string, title: string, body: string): Promise<void> => {
    return apiClient<void>(`/api/v1/notifications/test`, {
      method: "POST",
      body: JSON.stringify({ token, title, body }),
    });
  },
};
