import { apiClient, buildQuery, toPaginated } from "./apiClient";

/* ---------------------------------------------------------------------------
   SMS gateway — `/api/v1/sms-gateway/*`.

   Nowlny sends OTPs through a paired Android handset: the API queues a message,
   pushes it to the device over FCM, and the device reports delivery back. None
   of it was reachable from the admin panel, so "the customer never got their
   code" had no answer short of a database session.

   These routes authenticate with an `x-api-key` header rather than the operator
   JWT, so the key is held locally and never sent anywhere but this API.
--------------------------------------------------------------------------- */

export type SmsStatus = "queued" | "sent_to_device" | "delivered" | "failed";

export interface SmsMessage {
  id: string;
  phoneNumber: string;
  message?: string;
  status: SmsStatus | string;
  channel?: "sms" | "whatsapp";
  errorMessage?: string | null;
  createdAt?: string;
  updatedAt?: string;
  sentAt?: string | null;
  deliveredAt?: string | null;
}

export interface SmsDeviceStatus {
  registered?: boolean;
  deviceName?: string | null;
  lastSeenAt?: string | null;
  fcmToken?: string | null;
  [key: string]: unknown;
}

const API_KEY_STORAGE = "nowlny_sms_api_key";

export const smsGatewayKey = {
  get(): string {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem(API_KEY_STORAGE) ?? "";
  },
  set(value: string) {
    if (typeof window === "undefined") return;
    const trimmed = value.trim();
    if (trimmed) window.localStorage.setItem(API_KEY_STORAGE, trimmed);
    else window.localStorage.removeItem(API_KEY_STORAGE);
  },
  has(): boolean {
    return smsGatewayKey.get().length > 0;
  },
};

/** Every gateway route below `require`s the key; fail loudly rather than 401. */
const keyHeader = (): Record<string, string> => {
  const key = smsGatewayKey.get();
  if (!key) {
    throw new Error(
      "No SMS gateway API key configured. Add it above to use this panel.",
    );
  }
  return { "x-api-key": key };
};

export const smsGatewayService = {
  listMessages: async (params?: {
    page?: number;
    limit?: number;
    status?: SmsStatus | "all" | "";
  }) => {
    const payload = await apiClient<unknown>(
      `/api/v1/sms-gateway/list${buildQuery({ ...params })}`,
      { headers: keyHeader() },
    );
    return toPaginated<SmsMessage>(payload, params?.limit ?? 20);
  },

  getMessageStatus: (id: string) =>
    apiClient<SmsMessage>(`/api/v1/sms-gateway/status/${id}`, {
      headers: keyHeader(),
    }),

  getDeviceStatus: () =>
    apiClient<SmsDeviceStatus>("/api/v1/sms-gateway/device/status", {
      headers: keyHeader(),
    }),

  registerDevice: (data: { fcmToken: string; deviceName?: string }) =>
    apiClient<SmsDeviceStatus>("/api/v1/sms-gateway/device/register", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  /** Re-pushes everything stuck in `queued` to the paired handset. */
  retryQueued: () =>
    apiClient<{ retried?: number; count?: number }>(
      "/api/v1/sms-gateway/retry-queued",
      { method: "POST", headers: keyHeader() },
    ),

  sendMessage: (data: {
    phoneNumber: string;
    message: string;
    channel?: "sms" | "whatsapp";
  }) =>
    apiClient<SmsMessage>("/api/v1/sms-gateway/send", {
      method: "POST",
      headers: keyHeader(),
      body: JSON.stringify(data),
    }),
};
