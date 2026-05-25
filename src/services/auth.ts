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
   * Send or resend OTP to customer phone number
   */
  customerRequestOtp: (data: SendOtpPayload) => {
    return apiClient<void>('/api/v1/auth/customer/request-otp', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * Verify OTP for customer
   */
  customerVerifyOtp: (data: VerifyOtpPayload) => {
    return apiClient<{ accessToken?: string; signupToken?: string }>('/api/v1/auth/customer/verify-otp', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * Complete sign-up for customer
   */
  customerCompleteSignup: (data: { fullName: string; signupToken: string }) => {
    return apiClient<AuthResponse>('/api/v1/auth/customer/complete-signup', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * Send or resend OTP to restaurant owner phone number
   */
  restaurantRequestOtp: (data: SendOtpPayload) => {
    return apiClient<void>('/api/v1/auth/restaurant/request-otp', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * Verify OTP for restaurant owner
   */
  restaurantVerifyOtp: (data: VerifyOtpPayload) => {
    return apiClient<{ accessToken?: string; signupToken?: string }>('/api/v1/auth/restaurant/verify-otp', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * Complete sign-up for restaurant owner
   */
  restaurantCompleteSignup: (data: { fullName: string; signupToken: string; name: string; description?: string; city?: string; address?: string }) => {
    return apiClient<AuthResponse>('/api/v1/auth/restaurant/complete-signup', {
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
