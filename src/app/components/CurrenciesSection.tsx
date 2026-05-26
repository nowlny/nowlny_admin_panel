"use client";

import React, { useState, useEffect } from "react";
import {
  Coins,
  Plus,
  Edit,
  Trash2,
  X,
  Loader2,
  AlertCircle,
  ArrowRightLeft,
  ToggleLeft,
  ToggleRight,
  TrendingUp,
  Search,
} from "lucide-react";
import {
  currenciesService,
  Currency,
  MarketRate,
} from "../../services/currencies";

interface CurrenciesSectionProps {
  searchQuery?: string;
}

export default function CurrenciesSection({
  searchQuery,
}: CurrenciesSectionProps) {
  // Sub-tab state
  const [activeSubTab, setActiveSubTab] = useState<"currencies" | "rates">(
    "currencies",
  );

  // Currencies state
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [isCurrenciesLoading, setIsCurrenciesLoading] = useState(true);
  const [currenciesError, setCurrenciesError] = useState<string | null>(null);

  // Market Rates state
  const [marketRates, setMarketRates] = useState<MarketRate[]>([]);
  const [isRatesLoading, setIsRatesLoading] = useState(true);
  const [ratesError, setRatesError] = useState<string | null>(null);

  // Currency Modal state
  const [isCurrencyModalOpen, setIsCurrencyModalOpen] = useState(false);
  const [editingCurrency, setEditingCurrency] = useState<Currency | null>(null);
  const [currencyForm, setCurrencyForm] = useState({
    code: "",
    name: "",
    symbol: "",
    isActive: true,
  });

  // Rate Modal state
  const [isRateModalOpen, setIsRateModalOpen] = useState(false);
  const [editingRate, setEditingRate] = useState<MarketRate | null>(null);
  const [rateForm, setRateForm] = useState({
    fromCurrencyId: "",
    toCurrencyId: "",
    rate: "",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [togglingCode, setTogglingCode] = useState<string | null>(null);
  const [deletingCode, setDeletingCode] = useState<string | null>(null);
  const [deletingRateId, setDeletingRateId] = useState<string | null>(null);

  // --- Fetch Currencies ---
  const fetchCurrencies = async () => {
    try {
      setIsCurrenciesLoading(true);
      const data = await currenciesService.getAllCurrencies();
      const finalData = Array.isArray(data)
        ? data
        : data && (data as any).data
          ? (data as any).data
          : [];
      setCurrencies(finalData);
      setCurrenciesError(null);
    } catch (err: any) {
      console.error("Failed to fetch currencies:", err);
      setCurrenciesError("Could not fetch currencies.");
      setCurrencies([]);
    } finally {
      setIsCurrenciesLoading(false);
    }
  };

  // --- Fetch Market Rates ---
  const fetchMarketRates = async () => {
    try {
      setIsRatesLoading(true);
      const data = await currenciesService.getAllMarketRates();
      const finalData = Array.isArray(data)
        ? data
        : data && (data as any).data
          ? (data as any).data
          : [];
      setMarketRates(finalData);
      setRatesError(null);
    } catch (err: any) {
      console.error("Failed to fetch market rates:", err);
      setRatesError("Could not fetch market rates.");
      setMarketRates([]);
    } finally {
      setIsRatesLoading(false);
    }
  };

  useEffect(() => {
    fetchCurrencies();
    fetchMarketRates();
  }, []);

  // --- Currency CRUD ---
  const handleCreateCurrency = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      await currenciesService.createCurrency({
        code: currencyForm.code.toUpperCase(),
        name: currencyForm.name,
        symbol: currencyForm.symbol,
        isActive: currencyForm.isActive,
      });
      setIsCurrencyModalOpen(false);
      resetCurrencyForm();
      fetchCurrencies();
    } catch (err: any) {
      alert(`Failed to create currency: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateCurrency = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCurrency) return;
    try {
      setIsSubmitting(true);
      await currenciesService.updateCurrency(editingCurrency.code, {
        name: currencyForm.name,
        symbol: currencyForm.symbol,
        isActive: currencyForm.isActive,
      });
      setEditingCurrency(null);
      resetCurrencyForm();
      fetchCurrencies();
    } catch (err: any) {
      alert(`Failed to update currency: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCurrency = async (code: string) => {
    if (
      !confirm(
        `Are you sure you want to delete currency "${code}"? This action cannot be undone.`,
      )
    )
      return;
    try {
      setDeletingCode(code);
      await currenciesService.deleteCurrency(code);
      fetchCurrencies();
    } catch (err: any) {
      alert(`Failed to delete currency: ${err.message}`);
    } finally {
      setDeletingCode(null);
    }
  };

  const handleToggleCurrencyActive = async (currency: Currency) => {
    try {
      setTogglingCode(currency.code);
      await currenciesService.updateCurrency(currency.code, {
        isActive: !currency.isActive,
      });
      fetchCurrencies();
    } catch (err: any) {
      alert(`Failed to toggle currency: ${err.message}`);
    } finally {
      setTogglingCode(null);
    }
  };

  const openEditCurrencyModal = (c: Currency) => {
    setEditingCurrency(c);
    setCurrencyForm({
      code: c.code,
      name: c.name,
      symbol: c.symbol,
      isActive: c.isActive,
    });
  };

  const resetCurrencyForm = () => {
    setCurrencyForm({ code: "", name: "", symbol: "", isActive: true });
  };

  // --- Rate CRUD ---
  const handleCreateRate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      await currenciesService.createMarketRate({
        fromCurrencyId: rateForm.fromCurrencyId.toUpperCase(),
        toCurrencyId: rateForm.toCurrencyId.toUpperCase(),
        rate: Number(rateForm.rate),
      });
      setIsRateModalOpen(false);
      resetRateForm();
      fetchMarketRates();
    } catch (err: any) {
      alert(`Failed to create market rate: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateRate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRate) return;
    try {
      setIsSubmitting(true);
      await currenciesService.updateMarketRate(editingRate.id, {
        rate: Number(rateForm.rate),
      });
      setEditingRate(null);
      resetRateForm();
      fetchMarketRates();
    } catch (err: any) {
      alert(`Failed to update market rate: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteRate = async (id: string) => {
    if (
      !confirm(
        `Are you sure you want to delete this market rate? This action cannot be undone.`,
      )
    )
      return;
    try {
      setDeletingRateId(id);
      await currenciesService.deleteMarketRate(id);
      fetchMarketRates();
    } catch (err: any) {
      alert(`Failed to delete market rate: ${err.message}`);
    } finally {
      setDeletingRateId(null);
    }
  };

  const openEditRateModal = (r: MarketRate) => {
    setEditingRate(r);
    setRateForm({
      fromCurrencyId: r.fromCurrencyId,
      toCurrencyId: r.toCurrencyId,
      rate: String(r.rate),
    });
  };

  const resetRateForm = () => {
    setRateForm({ fromCurrencyId: "", toCurrencyId: "", rate: "" });
  };

  // --- Search filter ---
  const filteredCurrencies = currencies.filter((c) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      c.code.toLowerCase().includes(q) ||
      c.name.toLowerCase().includes(q) ||
      c.symbol.toLowerCase().includes(q)
    );
  });

  const filteredRates = marketRates.filter((r) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      r.fromCurrencyId.toLowerCase().includes(q) ||
      r.toCurrencyId.toLowerCase().includes(q) ||
      String(r.rate).includes(q)
    );
  });

  // --- Loading state ---
  const isLoading =
    activeSubTab === "currencies" ? isCurrenciesLoading : isRatesLoading;
  const error = activeSubTab === "currencies" ? currenciesError : ratesError;

  if (isLoading && currencies.length === 0 && marketRates.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-24 text-zinc-500">
        <Loader2 className="w-8 h-8 animate-spin mb-4 text-orange-500" />
        <p className="text-sm font-semibold">Loading currencies...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-2xl shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
            <Coins className="w-5 h-5 text-orange-500" />
            Currencies & Exchange Rates
          </h2>
          <p className="text-[11px] text-zinc-500 font-semibold mt-1">
            Manage active currencies and market exchange rates.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Sub-tab toggle */}
          <div className="flex bg-zinc-100 dark:bg-zinc-800 rounded-xl p-0.5">
            <button
              onClick={() => setActiveSubTab("currencies")}
              className={`text-[11px] font-bold px-3.5 py-1.5 rounded-[10px] transition-all ${
                activeSubTab === "currencies"
                  ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm"
                  : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
              }`}
            >
              Currencies
            </button>
            <button
              onClick={() => setActiveSubTab("rates")}
              className={`text-[11px] font-bold px-3.5 py-1.5 rounded-[10px] transition-all ${
                activeSubTab === "rates"
                  ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm"
                  : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
              }`}
            >
              Market Rates
            </button>
          </div>

          <button
            onClick={() => {
              if (activeSubTab === "currencies") {
                resetCurrencyForm();
                setIsCurrencyModalOpen(true);
              } else {
                resetRateForm();
                setIsRateModalOpen(true);
              }
            }}
            className="bg-zinc-900 hover:bg-orange-500 text-white dark:bg-zinc-800 text-xs font-bold px-4 py-2.5 rounded-xl transition-all flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            {activeSubTab === "currencies" ? "Add Currency" : "Add Rate"}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-bold p-4 rounded-xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      {/* === Currencies Tab === */}
      {activeSubTab === "currencies" && (
        <>
          {filteredCurrencies.length === 0 ? (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-12 text-center rounded-2xl flex flex-col items-center justify-center">
              <Coins className="w-12 h-12 text-zinc-300 dark:text-zinc-700 mb-3" />
              <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                No currencies found
              </p>
              <p className="text-xs text-zinc-500 mt-1">
                Create your first currency to get started.
              </p>
            </div>
          ) : (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
                    <th className="text-left text-[10px] font-black text-zinc-400 uppercase tracking-widest p-4">
                      Code
                    </th>
                    <th className="text-left text-[10px] font-black text-zinc-400 uppercase tracking-widest p-4">
                      Name
                    </th>
                    <th className="text-left text-[10px] font-black text-zinc-400 uppercase tracking-widest p-4">
                      Symbol
                    </th>
                    <th className="text-center text-[10px] font-black text-zinc-400 uppercase tracking-widest p-4">
                      Status
                    </th>
                    <th className="text-right text-[10px] font-black text-zinc-400 uppercase tracking-widest p-4">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCurrencies.map((c) => (
                    <tr
                      key={c.code}
                      className="border-b border-zinc-50 dark:border-zinc-800/50 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/20 transition-colors group"
                    >
                      <td className="p-4">
                        <span className="text-xs font-black text-zinc-900 dark:text-white bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1 rounded-lg">
                          {c.code}
                        </span>
                      </td>
                      <td className="p-4 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                        {c.name}
                      </td>
                      <td className="p-4">
                        <span className="text-lg font-bold text-orange-500">
                          {c.symbol}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <button
                          onClick={() => handleToggleCurrencyActive(c)}
                          disabled={togglingCode === c.code}
                          title={c.isActive ? "Deactivate" : "Activate"}
                          className="inline-flex items-center gap-1.5 transition-colors disabled:opacity-50"
                        >
                          {togglingCode === c.code ? (
                            <Loader2 className="w-5 h-5 animate-spin text-orange-500" />
                          ) : c.isActive ? (
                            <>
                              <ToggleRight className="w-6 h-6 text-emerald-500" />
                              <span className="text-[9px] font-black uppercase text-emerald-500">
                                Active
                              </span>
                            </>
                          ) : (
                            <>
                              <ToggleLeft className="w-6 h-6 text-zinc-400" />
                              <span className="text-[9px] font-black uppercase text-zinc-400">
                                Inactive
                              </span>
                            </>
                          )}
                        </button>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex justify-end gap-1.5">
                          <button
                            onClick={() => openEditCurrencyModal(c)}
                            disabled={deletingCode === c.code}
                            className="p-1.5 text-zinc-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-colors disabled:opacity-50"
                            title="Edit"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteCurrency(c.code)}
                            disabled={deletingCode === c.code}
                            className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-50"
                            title="Delete"
                          >
                            {deletingCode === c.code ? (
                              <Loader2 className="w-4 h-4 animate-spin text-red-500" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* === Market Rates Tab === */}
      {activeSubTab === "rates" && (
        <>
          {filteredRates.length === 0 ? (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-12 text-center rounded-2xl flex flex-col items-center justify-center">
              <ArrowRightLeft className="w-12 h-12 text-zinc-300 dark:text-zinc-700 mb-3" />
              <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                No market rates found
              </p>
              <p className="text-xs text-zinc-500 mt-1">
                Create an exchange rate between two currencies.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredRates.map((r) => (
                <div
                  key={r.id}
                  className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl shadow-sm hover:shadow-md transition-all duration-200 group"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-500/10 to-amber-500/10 flex items-center justify-center">
                        <TrendingUp className="w-4 h-4 text-orange-500" />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5 text-sm font-bold text-zinc-900 dark:text-white">
                          <span className="bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-md text-xs font-black">
                            {r.fromCurrencyId}
                          </span>
                          <ArrowRightLeft className="w-3.5 h-3.5 text-zinc-400" />
                          <span className="bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-md text-xs font-black">
                            {r.toCurrencyId}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-1.5">
                      <button
                        onClick={() => openEditRateModal(r)}
                        disabled={deletingRateId === r.id}
                        className="p-1.5 text-zinc-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-colors disabled:opacity-50"
                        title="Edit Rate"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteRate(r.id)}
                        disabled={deletingRateId === r.id}
                        className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-50"
                        title="Delete Rate"
                      >
                        {deletingRateId === r.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-red-500" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="border-t border-zinc-100 dark:border-zinc-800 pt-3">
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">
                      Exchange Rate
                    </p>
                    <p className="text-2xl font-black text-zinc-900 dark:text-white tabular-nums">
                      {Number(r.rate).toLocaleString()}
                    </p>
                    <p className="text-[11px] text-zinc-500 font-semibold mt-1">
                      1 {r.fromCurrencyId} = {Number(r.rate).toLocaleString()}{" "}
                      {r.toCurrencyId}
                    </p>
                  </div>

                  {r.updatedAt && (
                    <p className="text-[9px] text-zinc-400 font-semibold mt-3">
                      Updated:{" "}
                      {new Date(r.updatedAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* === Currency Modal === */}
      {(isCurrencyModalOpen || editingCurrency) && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center bg-zinc-50 dark:bg-zinc-900/40">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                <Coins className="w-4 h-4 text-orange-500" />
                {editingCurrency ? "Edit Currency" : "Add New Currency"}
              </h3>
              <button
                onClick={() => {
                  setIsCurrencyModalOpen(false);
                  setEditingCurrency(null);
                }}
                className="text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={
                editingCurrency ? handleUpdateCurrency : handleCreateCurrency
              }
              className="p-6 space-y-4"
            >
              <div>
                <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1.5">
                  Currency Code
                </label>
                <input
                  required
                  type="text"
                  maxLength={5}
                  disabled={!!editingCurrency}
                  value={currencyForm.code}
                  onChange={(e) =>
                    setCurrencyForm({
                      ...currencyForm,
                      code: e.target.value.toUpperCase(),
                    })
                  }
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-sm rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-50 uppercase font-bold"
                  placeholder="e.g. USD"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1.5">
                  Name
                </label>
                <input
                  required
                  type="text"
                  value={currencyForm.name}
                  onChange={(e) =>
                    setCurrencyForm({ ...currencyForm, name: e.target.value })
                  }
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-sm rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  placeholder="e.g. US Dollar"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1.5">
                  Symbol
                </label>
                <input
                  required
                  type="text"
                  maxLength={5}
                  value={currencyForm.symbol}
                  onChange={(e) =>
                    setCurrencyForm({ ...currencyForm, symbol: e.target.value })
                  }
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-sm rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-orange-500 text-lg font-bold"
                  placeholder="e.g. $"
                />
              </div>

              <div className="flex items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={() =>
                    setCurrencyForm({
                      ...currencyForm,
                      isActive: !currencyForm.isActive,
                    })
                  }
                  className="flex items-center gap-2"
                >
                  {currencyForm.isActive ? (
                    <ToggleRight className="w-7 h-7 text-emerald-500" />
                  ) : (
                    <ToggleLeft className="w-7 h-7 text-zinc-400" />
                  )}
                  <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                    {currencyForm.isActive ? "Active" : "Inactive"}
                  </span>
                </button>
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsCurrencyModalOpen(false);
                    setEditingCurrency(null);
                  }}
                  className="flex-1 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-900 dark:text-white text-xs font-bold py-2.5 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold py-2.5 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSubmitting && (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  )}
                  {editingCurrency ? "Save Changes" : "Create Currency"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* === Rate Modal === */}
      {(isRateModalOpen || editingRate) && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center bg-zinc-50 dark:bg-zinc-900/40">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                <ArrowRightLeft className="w-4 h-4 text-orange-500" />
                {editingRate ? "Edit Market Rate" : "Add Market Rate"}
              </h3>
              <button
                onClick={() => {
                  setIsRateModalOpen(false);
                  setEditingRate(null);
                }}
                className="text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={editingRate ? handleUpdateRate : handleCreateRate}
              className="p-6 space-y-4"
            >
              <div>
                <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1.5">
                  From Currency
                </label>
                <select
                  required
                  disabled={!!editingRate}
                  value={rateForm.fromCurrencyId}
                  onChange={(e) =>
                    setRateForm({
                      ...rateForm,
                      fromCurrencyId: e.target.value,
                    })
                  }
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-sm rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-50"
                >
                  <option value="">Select currency...</option>
                  {currencies.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code} — {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1.5">
                  To Currency
                </label>
                <select
                  required
                  disabled={!!editingRate}
                  value={rateForm.toCurrencyId}
                  onChange={(e) =>
                    setRateForm({ ...rateForm, toCurrencyId: e.target.value })
                  }
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-sm rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-50"
                >
                  <option value="">Select currency...</option>
                  {currencies
                    .filter((c) => c.code !== rateForm.fromCurrencyId)
                    .map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.code} — {c.name}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1.5">
                  Exchange Rate
                </label>
                <input
                  required
                  type="number"
                  step="any"
                  min="0"
                  value={rateForm.rate}
                  onChange={(e) =>
                    setRateForm({ ...rateForm, rate: e.target.value })
                  }
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-sm rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-orange-500 font-bold tabular-nums"
                  placeholder="e.g. 89500"
                />
                {rateForm.fromCurrencyId &&
                  rateForm.toCurrencyId &&
                  rateForm.rate && (
                    <p className="text-[11px] text-zinc-500 font-semibold mt-1.5">
                      1 {rateForm.fromCurrencyId} ={" "}
                      {Number(rateForm.rate).toLocaleString()}{" "}
                      {rateForm.toCurrencyId}
                    </p>
                  )}
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsRateModalOpen(false);
                    setEditingRate(null);
                  }}
                  className="flex-1 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-900 dark:text-white text-xs font-bold py-2.5 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold py-2.5 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSubmitting && (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  )}
                  {editingRate ? "Save Changes" : "Create Rate"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
