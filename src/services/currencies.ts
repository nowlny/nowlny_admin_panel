import { apiClient } from './apiClient';

export interface Currency {
  code: string;
  name: string;
  symbol: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface MarketRate {
  id: string;
  fromCurrencyId: string;
  toCurrencyId: string;
  rate: number;
  createdAt?: string;
  updatedAt?: string;
}

export const currenciesService = {
  // --- Currencies ---
  createCurrency: (data: Partial<Currency>) => {
    return apiClient<Currency>('/api/v1/currencies', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  getActiveCurrencies: () => {
    return apiClient<Currency[]>('/api/v1/currencies');
  },

  getAllCurrencies: (params?: { search?: string; isActive?: boolean; page?: number; limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.search) query.append('search', params.search);
    if (params?.isActive !== undefined) query.append('isActive', String(params.isActive));
    if (params?.page) query.append('page', String(params.page));
    if (params?.limit) query.append('limit', String(params.limit));

    return apiClient<Currency[]>(`/api/v1/currencies/admin/all?${query.toString()}`);
  },

  getCurrencyByCode: (code: string) => {
    return apiClient<Currency>(`/api/v1/currencies/${code}`);
  },

  updateCurrency: (code: string, data: Partial<Currency>) => {
    return apiClient<Currency>(`/api/v1/currencies/${code}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  deleteCurrency: (code: string) => {
    return apiClient<void>(`/api/v1/currencies/${code}`, {
      method: 'DELETE',
    });
  },

  // --- Market Rates ---
  createMarketRate: (data: Partial<MarketRate>) => {
    return apiClient<MarketRate>('/api/v1/currencies/market-rates', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  getAllMarketRates: () => {
    return apiClient<MarketRate[]>('/api/v1/currencies/market-rates/all');
  },

  getMarketRateById: (id: string) => {
    return apiClient<MarketRate>(`/api/v1/currencies/market-rates/${id}`);
  },

  updateMarketRate: (id: string, data: Partial<MarketRate>) => {
    return apiClient<MarketRate>(`/api/v1/currencies/market-rates/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  deleteMarketRate: (id: string) => {
    return apiClient<void>(`/api/v1/currencies/market-rates/${id}`, {
      method: 'DELETE',
    });
  }
};
