import { apiClient, buildQuery, toPaginated } from "./apiClient";

/** `CreateUserDto.userType` / `UpdateUserDto.userType`. */
export type UserType =
  | "admin"
  | "customer"
  | "restaurant_owner"
  | "driver"
  | "delivery_company";

export type UserStatus = "active" | "inactive" | "suspended" | "deleted";

export const USER_TYPES: { value: UserType; label: string }[] = [
  { value: "admin", label: "Admin" },
  { value: "restaurant_owner", label: "Restaurant owner" },
  { value: "delivery_company", label: "Delivery company" },
  { value: "driver", label: "Driver" },
  { value: "customer", label: "Customer" },
];

export const USER_STATUSES: { value: UserStatus; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "suspended", label: "Suspended" },
  { value: "deleted", label: "Deleted" },
];

export interface UserProfileUpdate {
  fullName?: string;
  nickname?: string;
  profileImage?: string;
  dateOfBirth?: string; // YYYY-MM-DD
}

export interface SystemUserCreate {
  phoneNumber: string;
  fullName: string;
  userType: UserType;
}

export interface SystemUserUpdate {
  phoneNumber?: string;
  fullName?: string;
  userType?: UserType;
  status?: UserStatus;
  isActive?: boolean;
}

export interface SystemUser {
  id: string;
  phoneNumber: string;
  fullName: string;
  /** `super_admin` exists on live accounts even though it isn't assignable. */
  userType: UserType | string;
  status: UserStatus | string;
  isActive: boolean;
  nickname?: string;
  email?: string;
  profileImage?: string;
  dateOfBirth?: string;
  createdAt?: string;
}

export interface ListUsersParams {
  search?: string;
  userType?: UserType | "all" | "";
  status?: UserStatus | "all" | "";
  isActive?: boolean;
  page?: number;
  limit?: number;
}

export const usersService = {
  getMe: () => apiClient<SystemUser>("/api/v1/users/me"),

  updateProfile: (data: UserProfileUpdate) =>
    apiClient<SystemUser>("/api/v1/users/me", {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  registerDeviceToken: (data: { token: string }) =>
    apiClient<void>("/api/v1/users/me/device-token", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  /** The API reads the token from the body, so it has to be sent on DELETE. */
  removeDeviceToken: (token: string) =>
    apiClient<void>("/api/v1/users/me/device-token", {
      method: "DELETE",
      body: JSON.stringify({ token }),
    }),

  /**
   * `GET /api/v1/users` — paginated with `search`, `userType`, `status` and
   * `isActive`. Previously fetched unfiltered and unpaged, so the panel only
   * ever showed the API's first page with no way to reach the rest.
   */
  getSystemUsers: async (params?: ListUsersParams) => {
    const payload = await apiClient<unknown>(
      `/api/v1/users${buildQuery({ ...params })}`,
    );
    return toPaginated<SystemUser>(payload, params?.limit ?? 20);
  },

  getSystemUserById: (id: string) =>
    apiClient<SystemUser>(`/api/v1/users/${id}`),

  createSystemUser: (data: SystemUserCreate) =>
    apiClient<SystemUser>("/api/v1/users", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateSystemUser: (id: string, data: SystemUserUpdate) =>
    apiClient<SystemUser>(`/api/v1/users/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  deleteSystemUser: (id: string) =>
    apiClient<void>(`/api/v1/users/${id}`, { method: "DELETE" }),
};
