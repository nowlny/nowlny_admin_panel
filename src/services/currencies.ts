import { apiClient, buildQuery, toList, toPaginated } from "./apiClient";

export interface Currency {
  code: string;
  name: string;
  symbol: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * One row of the `exchange_rates` table. `restaurantId` / `deliveryCompanyId`
 * are null on a system default and set on an override — which is how the
 * admin "all rates" view tells the two apart.
 */
export interface ExchangeRate {
  id: string;
  fromCurrencyId: string;
  toCurrencyId: string;
  /** Serialised as a string with six decimals, e.g. `"89500.000000"`. */
  rate: string | number;
  restaurantId?: string | null;
  restaurantName?: string | null;
  deliveryCompanyId?: string | null;
  deliveryCompanyName?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

/** Kept for the legacy `market-rates` endpoints, which share the row shape. */
export type MarketRate = ExchangeRate;

export interface ExchangeRatePayload {
  fromCurrencyId: string;
  toCurrencyId: string;
  rate: number;
}

export const currenciesService = {
  // ─── Currencies ────────────────────────────────────────────────────────────

  createCurrency: (data: Partial<Currency>) =>
    apiClient<Currency>("/api/v1/currencies", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  /** Public list — active currencies only. Returns a bare array. */
  getActiveCurrencies: async () => {
    const payload = await apiClient<unknown>("/api/v1/currencies");
    return toList<Currency>(payload);
  },

  getAllCurrencies: async (params?: {
    search?: string;
    isActive?: boolean;
    page?: number;
    limit?: number;
  }) => {
    const payload = await apiClient<unknown>(
      `/api/v1/currencies/admin/all${buildQuery({ ...params })}`,
    );
    return toPaginated<Currency>(payload, params?.limit ?? 50);
  },

  getCurrencyByCode: (code: string) =>
    apiClient<Currency>(`/api/v1/currencies/${code}`),

  updateCurrency: (code: string, data: Partial<Currency>) =>
    apiClient<Currency>(`/api/v1/currencies/${code}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  deleteCurrency: (code: string) =>
    apiClient<void>(`/api/v1/currencies/${code}`, { method: "DELETE" }),

  // ─── Exchange rates ────────────────────────────────────────────────────────
  //
  // The `market-rates/*` routes are the legacy spelling and only ever see the
  // system defaults. `exchange-rates/*` is the current API and is the only way
  // to see, or clear, the per-restaurant and per-company overrides that decide
  // what a customer is actually charged.

  /** System defaults only (public). */
  getDefaultExchangeRates: async () => {
    const payload = await apiClient<unknown>(
      "/api/v1/currencies/exchange-rates/default",
    );
    return toList<ExchangeRate>(payload);
  },

  /** Defaults *and* every restaurant/company override (admin). */
  getAllExchangeRates: async () => {
    const payload = await apiClient<unknown>(
      "/api/v1/currencies/exchange-rates/all",
    );
    return toList<ExchangeRate>(payload);
  },

  /** Creates or updates the system default for a currency pair. */
  upsertDefaultExchangeRate: (data: ExchangeRatePayload) =>
    apiClient<ExchangeRate>("/api/v1/currencies/exchange-rates/default", {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  /** Deletes any rate row by id — default or override. */
  deleteExchangeRate: (id: string) =>
    apiClient<void>(`/api/v1/currencies/exchange-rates/${id}`, {
      method: "DELETE",
    }),

  /** Legacy alias retained for the default-rate edit form. */
  updateDefaultExchangeRate: (id: string, rate: number) =>
    apiClient<ExchangeRate>(`/api/v1/currencies/market-rates/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ rate }),
    }),
};
