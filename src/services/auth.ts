import { apiClient } from './apiClient';
import { SystemUser } from './users';

export interface SendOtpPayload {
  phoneNumber: string;
}

export interface VerifyOtpPayload {
  phoneNumber: string;
  code: string;
}

export interface AuthResponse {
  accessToken: string;
  user: SystemUser;
}

export const authService = {
  /**
   * Request an OTP for a given phone number
   */
  sendOtp: (data: SendOtpPayload) => {
    return apiClient<void>('/api/v1/auth/request-otp', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * Verify the OTP and retrieve the auth token
   */
  verifyOtp: (data: VerifyOtpPayload) => {
    return apiClient<AuthResponse>('/api/v1/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * Logout the user locally
   */
  logout: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token');
      window.location.reload();
    }
  }
};
