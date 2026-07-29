import { apiClient } from "./apiClient";
import { SystemUser } from "./users";

/** `RequestOtpDto.channel` — the API also delivers codes over WhatsApp/email. */
export type OtpChannel = "sms" | "whatsapp" | "email";

export interface SendOtpPayload {
  phoneNumber: string;
  channel: OtpChannel;
}

export interface VerifyOtpPayload {
  phoneNumber: string;
  code: string;
}

export interface AuthResponse {
  accessToken?: string;
  access_token?: string;
  refreshToken?: string;
  refresh_token?: string;
  user: SystemUser;
}

export const authService = {
  /**
   * Request an OTP for a given phone number
   */
  sendOtp: (data: SendOtpPayload) => {
    return apiClient<void>("/api/v1/auth/request-otp", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  /**
   * Verify the OTP and retrieve the auth token
   */
  verifyOtp: (data: VerifyOtpPayload) => {
    return apiClient<AuthResponse>("/api/v1/auth/verify-otp", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  /**
   * Send or resend OTP to customer phone number
   */
  customerRequestOtp: (data: SendOtpPayload) => {
    return apiClient<void>("/api/v1/auth/customer/request-otp", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  /**
   * Verify OTP for customer
   */
  customerVerifyOtp: (data: VerifyOtpPayload) => {
    return apiClient<{ accessToken?: string; signupToken?: string }>(
      "/api/v1/auth/customer/verify-otp",
      {
        method: "POST",
        body: JSON.stringify(data),
      },
    );
  },

  /**
   * Complete sign-up for customer
   */
  customerCompleteSignup: (data: { fullName: string; signupToken: string }) => {
    return apiClient<AuthResponse>("/api/v1/auth/customer/complete-signup", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  /**
   * Send or resend OTP to restaurant owner phone number
   */
  restaurantRequestOtp: (data: SendOtpPayload) => {
    return apiClient<void>("/api/v1/auth/restaurant/request-otp", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  /**
   * Verify OTP for restaurant owner
   */
  restaurantVerifyOtp: (data: VerifyOtpPayload) => {
    return apiClient<{ accessToken?: string; signupToken?: string }>(
      "/api/v1/auth/restaurant/verify-otp",
      {
        method: "POST",
        body: JSON.stringify(data),
      },
    );
  },

  /**
   * Complete sign-up for restaurant owner
   */
  restaurantCompleteSignup: (data: {
    fullName: string;
    signupToken: string;
    /** `CompleteRestaurantSignupDto` names it `restaurantName`. */
    restaurantName: string;
    description?: string;
    phone?: string;
    currencyId?: string;
    categoryIds?: string[];
    address?: {
      city: string;
      street: string;
      building?: string;
      latitude: number;
      longitude: number;
    };
  }) => {
    return apiClient<AuthResponse>("/api/v1/auth/restaurant/complete-signup", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  /**
   * Logout the user from the server and locally
   */
  logout: async () => {
    try {
      // Attempt server logout, ignore failures if already unauthorized
      await apiClient<void>("/api/v1/auth/logout", { method: "POST" });
    } catch (e) {
      console.warn("Server logout failed or already unauthorized.");
    } finally {
      if (typeof window !== "undefined") {
        localStorage.removeItem("token");
        localStorage.removeItem("refreshToken");
        window.location.reload();
      }
    }
  },
};
