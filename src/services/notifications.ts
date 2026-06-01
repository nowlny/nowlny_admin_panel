import { apiClient } from "./apiClient";

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  read: boolean;
  timestamp: string;
  userId?: string;
  type?: string;
  data?: any;
}

export interface PaginatedNotifications {
  data: AppNotification[];
  total: number;
  page: number;
  limit: number;
  unreadCount: number;
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
    
    return apiClient<PaginatedNotifications>(`/api/v1/notifications/me?${queryParams}`);
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
