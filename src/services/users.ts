import { apiClient } from './apiClient';

export interface UserProfileUpdate {
  fullName?: string;
  nickname?: string;
  dateOfBirth?: string; // Format: YYYY-MM-DD
}

export interface SystemUserCreate {
  phoneNumber: string;
  fullName: string;
  userType: string;
}

export interface SystemUserUpdate {
  phoneNumber?: string;
  fullName?: string;
  userType?: string;
  status?: string;
  isActive?: boolean;
}

export interface SystemUser {
  id: string;
  phoneNumber: string;
  fullName: string;
  userType: string;
  status: string;
  isActive: boolean;
  nickname?: string;
  dateOfBirth?: string;
}

export const usersService = {
  /**
   * Update own profile (any authenticated user)
   * PATCH /api/v1/users/me
   */
  updateProfile: (data: UserProfileUpdate) => {
    return apiClient<void>('/api/v1/users/me', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  /**
   * Create a system user (super_admin only)
   * POST /api/v1/users
   */
  createSystemUser: (data: SystemUserCreate) => {
    return apiClient<void>('/api/v1/users', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * List all system users
   * GET /api/v1/users
   */
  getSystemUsers: () => {
    return apiClient<SystemUser[]>('/api/v1/users', {
      method: 'GET',
    });
  },

  /**
   * Get a system user by ID
   * GET /api/v1/users/{id}
   */
  getSystemUserById: (id: string) => {
    return apiClient<SystemUser>(`/api/v1/users/${id}`, {
      method: 'GET',
    });
  },

  /**
   * Update a system user
   * PATCH /api/v1/users/{id}
   */
  updateSystemUser: (id: string, data: SystemUserUpdate) => {
    return apiClient<void>(`/api/v1/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  /**
   * Delete a system user
   * DELETE /api/v1/users/{id}
   */
  deleteSystemUser: (id: string) => {
    return apiClient<void>(`/api/v1/users/${id}`, {
      method: 'DELETE',
    });
  },
};
