const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_MAIN_URL || 'https://app.nowlny.com';

let isRefreshing = false;

const formatApiError = (status: number, errorText: string): string => {
  try {
    const data = JSON.parse(errorText);
    
    // Extract human-readable messages from common JSON error structures
    if (typeof data.message === 'string') return data.message;
    if (Array.isArray(data.message)) return data.message.join(', ');
    if (typeof data.detail === 'string') return data.detail;
    if (typeof data.error === 'string') return data.error;
    if (data.error && typeof data.error.message === 'string') return data.error.message;
    if (Array.isArray(data.errors) && data.errors.length > 0) {
      return data.errors.map((e: any) => e.message || e.msg || e).join(', ');
    }
    
    // If it's JSON but doesn't have a known key
    return "An unexpected error occurred.";
  } catch {
    // If not JSON
    if (errorText && errorText.trim().length > 0) {
      // Don't show raw HTML to the user
      if (errorText.trim().startsWith('<')) {
        return `Server Error (${status})`;
      }
      return errorText.length > 100 ? errorText.substring(0, 100) + '...' : errorText;
    }
    return `Server Error (${status})`;
  }
};

export const apiClient = async <T>(endpoint: string, options?: RequestInit): Promise<T> => {
  const url = `${API_BASE_URL}${endpoint}`;
  
  // Example of retrieving a stored token (adjust based on your auth implementation)
  let token = null;
  if (typeof window !== 'undefined') {
    token = localStorage.getItem('token'); // Or use cookies
  }
  
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options?.headers || {}),
  };

  const response = await fetch(url, { ...options, headers });

  if (response.status === 401 && !isRefreshing && typeof window !== 'undefined') {
    const refreshToken = localStorage.getItem('refreshToken');
    if (refreshToken) {
      isRefreshing = true;
      try {
        const refreshRes = await fetch(`${API_BASE_URL}/api/v1/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: refreshToken })
        });
        
        if (refreshRes.ok) {
          const refreshData = await refreshRes.json();
          // Support multiple casing variations just in case
          const newAccessToken = refreshData.accessToken || refreshData.access_token;
          const newRefreshToken = refreshData.refreshToken || refreshData.refresh_token;
          
          if (newAccessToken) localStorage.setItem('token', newAccessToken);
          if (newRefreshToken) localStorage.setItem('refreshToken', newRefreshToken);
          
          // Retry original request with new token
          const retryHeaders = {
            ...headers,
            Authorization: `Bearer ${newAccessToken}`,
          };
          const retryResponse = await fetch(url, { ...options, headers: retryHeaders });
          
          if (!retryResponse.ok) {
            let errorText = '';
            try { errorText = await retryResponse.text(); } catch {}
            throw new Error(formatApiError(retryResponse.status, errorText));
          }
          if (retryResponse.status === 204) return {} as T;
          return retryResponse.json();
        } else {
          // Refresh failed
          throw new Error("Refresh token expired or invalid");
        }
      } catch (e) {
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        window.location.reload();
        throw new Error("Session expired. Please log in again.");
      } finally {
        isRefreshing = false;
      }
    } else {
      // 401 and no refresh token
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      if (window.location.pathname !== '/login' && window.location.pathname !== '/') {
        window.location.reload();
      }
    }
  }

  if (!response.ok) {
    let errorText = '';
    try {
      errorText = await response.text();
    } catch {}
    throw new Error(formatApiError(response.status, errorText));
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
};
