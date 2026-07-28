"use client";

import React, { useState, useEffect } from "react";
import {
  Coins,
  Plus,
  Edit,
  Trash2,
  Loader2,
  ArrowRightLeft,
  ToggleLeft,
  ToggleRight,
  TrendingUp,
  SearchX,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  currenciesService,
  Currency,
  ExchangeRate,
} from "../../services/currencies";
import Modal from "./ui/Modal";
import { useConfirm } from "./ui/ConfirmDialog";
import {
  EmptyState,
  ErrorState,
  TableSkeleton,
  CardSkeletonGrid,
} from "./ui/States";
import { formatRate, formatDateTime } from "../../lib/format";

import { useI18n, type MessageKey } from "../../lib/i18n";
interface CurrenciesSectionProps {
  searchQuery?: string;
}

/** The house form-field tokens. Kept in one place so the two modals agree. */
const inputClass =
  "w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-sm text-zinc-900 dark:text-white rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-50";
const labelClass =
  "block text-[10px] font-black text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-1.5";

/**
 * A rate row is either a platform default (`restaurantId` and
 * `deliveryCompanyId` both null) or an override owned by one merchant or
 * delivery company. The panel showed no difference between the two, so an
 * admin could delete a merchant's private override believing they were
 * editing the platform rate.
 */
function rateScope(rate: ExchangeRate): {
  key: MessageKey;
  name?: string;
  isDefault: boolean;
  tone: string;
} {
  if (rate.restaurantId) {
    return {
      key: rate.restaurantName
        ? "cur.scope_restaurant"
        : "cur.scope_restaurant_plain",
      name: rate.restaurantName ?? undefined,
      isDefault: false,
      tone: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
    };
  }
  if (rate.deliveryCompanyId) {
    return {
      key: rate.deliveryCompanyName
        ? "cur.scope_company"
        : "cur.scope_company_plain",
      name: rate.deliveryCompanyName ?? undefined,
      isDefault: false,
      tone: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20",
    };
  }
  return {
    key: "cur.scope_default",
    isDefault: true,
    tone: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  };
}

function RequiredMark() {
  return (
    <span aria-hidden="true" className="text-orange-500">
      {" "}
      *
    </span>
  );
}

export default function CurrenciesSection({
  searchQuery,
}: CurrenciesSectionProps) {
  const { t } = useI18n();
  const confirm = useConfirm();

  // Sub-tab state
  const [activeSubTab, setActiveSubTab] = useState<"currencies" | "rates">(
    "currencies",
  );

  // Currencies state
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [isCurrenciesLoading, setIsCurrenciesLoading] = useState(true);
  const [currenciesError, setCurrenciesError] = useState<string | null>(null);

  // Market Rates state
  const [marketRates, setMarketRates] = useState<ExchangeRate[]>([]);
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
  const [editingRate, setEditingRate] = useState<ExchangeRate | null>(null);
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
      const res = await currenciesService.getAllCurrencies({ limit: 100 });
      setCurrencies(res.data);
      setCurrenciesError(null);
    } catch (err: any) {
      console.error("Failed to fetch currencies:", err);
      setCurrenciesError(err?.message || t("cur.load_failed"));
      setCurrencies([]);
    } finally {
      setIsCurrenciesLoading(false);
    }
  };

  /*
   * --- Fetch exchange rates ---
   *
   * `exchange-rates/all` rather than the legacy `market-rates/all`: the legacy
   * route only ever returns the system defaults, so every per-restaurant and
   * per-delivery-company override — the rates customers are actually charged —
   * was invisible from this panel.
   */
  const fetchMarketRates = async () => {
    try {
      setIsRatesLoading(true);
      setMarketRates(await currenciesService.getAllExchangeRates());
      setRatesError(null);
    } catch (err: any) {
      console.error("Failed to fetch exchange rates:", err);
      setRatesError(err?.message || t("cur.rates_load_failed"));
      setMarketRates([]);
    } finally {
      setIsRatesLoading(false);
    }
  };

  useEffect(() => {
    fetchCurrencies();
    fetchMarketRates();
  }, []);

  const closeCurrencyModal = () => {
    setIsCurrencyModalOpen(false);
    setEditingCurrency(null);
  };

  const closeRateModal = () => {
    setIsRateModalOpen(false);
    setEditingRate(null);
  };

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
      closeCurrencyModal();
      resetCurrencyForm();
      toast.success(
        t("cur.created", { code: currencyForm.code.toUpperCase() }),
      );
      fetchCurrencies();
    } catch (err: any) {
      toast.error(err?.message || t("cur.create_failed"));
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
      const savedCode = editingCurrency.code;
      closeCurrencyModal();
      resetCurrencyForm();
      toast.success(t("cur.updated", { code: savedCode }));
      fetchCurrencies();
    } catch (err: any) {
      toast.error(err?.message || t("cur.update_failed"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCurrency = async (currency: Currency) => {
    const confirmed = await confirm({
      title: t("cur.delete_title", { code: currency.code }),
      description: t("cur.delete_body", {
        name: currency.name,
        symbol: currency.symbol,
      }),
      confirmLabel: t("cur.delete_cta"),
      variant: "danger",
    });
    if (!confirmed) return;

    try {
      setDeletingCode(currency.code);
      await currenciesService.deleteCurrency(currency.code);
      toast.success(t("cur.deleted", { code: currency.code }));
      fetchCurrencies();
    } catch (err: any) {
      toast.error(err?.message || t("cur.delete_failed"));
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
      toast.success(
        t("cur.toggled", {
          code: currency.code,
          state: currency.isActive
            ? t("cur.state_inactive")
            : t("cur.state_active"),
        }),
      );
      fetchCurrencies();
    } catch (err: any) {
      toast.error(err?.message || t("cur.toggle_failed"));
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
      await currenciesService.upsertDefaultExchangeRate({
        fromCurrencyId: rateForm.fromCurrencyId.toUpperCase(),
        toCurrencyId: rateForm.toCurrencyId.toUpperCase(),
        rate: Number(rateForm.rate),
      });
      closeRateModal();
      resetRateForm();
      toast.success(t("cur.rate_saved"));
      fetchMarketRates();
    } catch (err: any) {
      toast.error(err?.message || t("cur.rate_save_failed"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateRate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRate) return;
    try {
      setIsSubmitting(true);
      await currenciesService.updateDefaultExchangeRate(
        editingRate.id,
        Number(rateForm.rate),
      );
      closeRateModal();
      resetRateForm();
      toast.success(t("cur.rate_updated"));
      fetchMarketRates();
    } catch (err: any) {
      toast.error(err?.message || t("cur.rate_update_failed"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteRate = async (rate: ExchangeRate) => {
    const confirmed = await confirm({
      title: t("cur.rate_delete_title", {
        from: rate.fromCurrencyId,
        to: rate.toCurrencyId,
      }),
      description: t("cur.rate_delete_body", { rate: formatRate(rate.rate) }),
      confirmLabel: t("cur.rate_delete_cta"),
      variant: "danger",
    });
    if (!confirmed) return;

    try {
      setDeletingRateId(rate.id);
      await currenciesService.deleteExchangeRate(rate.id);
      toast.success(t("cur.rate_deleted"));
      fetchMarketRates();
    } catch (err: any) {
      toast.error(err?.message || t("cur.rate_delete_failed"));
    } finally {
      setDeletingRateId(null);
    }
  };

  const openEditRateModal = (r: ExchangeRate) => {
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

  const isSearching = !!searchQuery?.trim();

  // Both modals guard against a stray backdrop click / Escape discarding typing.
  const isCurrencyDirty = editingCurrency
    ? currencyForm.name !== editingCurrency.name ||
      currencyForm.symbol !== editingCurrency.symbol ||
      currencyForm.isActive !== editingCurrency.isActive
    : !!(currencyForm.code || currencyForm.name || currencyForm.symbol);

  const isRateDirty = editingRate
    ? rateForm.rate !== String(editingRate.rate)
    : !!(rateForm.fromCurrencyId || rateForm.toCurrencyId || rateForm.rate);

  const isCurrencyModalVisible = isCurrencyModalOpen || !!editingCurrency;
  const isRateModalVisible = isRateModalOpen || !!editingRate;

  const addButton = (
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
      {activeSubTab === "currencies"
        ? t("cur.add_currency")
        : t("cur.add_rate_short")}
    </button>
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-2xl shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
            <Coins className="w-5 h-5 text-orange-500" />
            {t("cur.page_title")}
          </h2>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-semibold mt-1">
            {t("cur.page_subtitle")}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Sub-tab toggle */}
          <div
            role="group"
            aria-label={t("cur.view_aria")}
            className="flex bg-zinc-100 dark:bg-zinc-800 rounded-xl p-0.5"
          >
            <button
              aria-pressed={activeSubTab === "currencies"}
              onClick={() => setActiveSubTab("currencies")}
              className={`text-[11px] font-bold px-3.5 py-1.5 rounded-[10px] transition-all ${
                activeSubTab === "currencies"
                  ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm"
                  : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
              }`}
            >
              {t("cur.tab_currencies")}
            </button>
            <button
              aria-pressed={activeSubTab === "rates"}
              onClick={() => setActiveSubTab("rates")}
              className={`text-[11px] font-bold px-3.5 py-1.5 rounded-[10px] transition-all ${
                activeSubTab === "rates"
                  ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm"
                  : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
              }`}
            >
              {t("cur.tab_rates")}
            </button>
          </div>

          {addButton}
        </div>
      </div>

      {/* === Currencies Tab ===
          Loading / error / empty are gated per sub-tab: the old shared gate
          waited for BOTH lists, so switching to Rates mid-fetch rendered the
          "no rates yet" empty state over a list that was still loading. */}
      {activeSubTab === "currencies" && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden">
          {isCurrenciesLoading ? (
            <TableSkeleton rows={6} />
          ) : currenciesError ? (
            <ErrorState message={currenciesError} onRetry={fetchCurrencies} />
          ) : filteredCurrencies.length === 0 ? (
            <EmptyState
              icon={isSearching ? SearchX : Coins}
              title={
                isSearching ? t("cur.no_match") : t("cur.none_found")
              }
              hint={
                isSearching
                  ? `Nothing matches “${searchQuery}”. Try a different code, name or symbol.`
                  : t("cur.none_found_hint")
              }
              action={isSearching ? undefined : addButton}
            />
          ) : (
            /* The card keeps `overflow-hidden` for its rounded corners, so the
               table needs its own scroll container — otherwise the Actions
               column is clipped and unreachable on narrow viewports. */
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
                    <th className="text-start text-[10px] font-black text-zinc-400 uppercase tracking-widest p-4">
                      {t("cur.code")}
                    </th>
                    <th className="text-start text-[10px] font-black text-zinc-400 uppercase tracking-widest p-4">
                      {t("common.name")}
                    </th>
                    <th className="text-start text-[10px] font-black text-zinc-400 uppercase tracking-widest p-4">
                      {t("cur.symbol")}
                    </th>
                    <th className="text-center text-[10px] font-black text-zinc-400 uppercase tracking-widest p-4">
                      {t("common.status")}
                    </th>
                    <th className="text-end text-[10px] font-black text-zinc-400 uppercase tracking-widest p-4">
                      {t("common.actions")}
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
                          title={
                            c.isActive ? t("cur.deactivate") : t("cur.activate")
                          }
                          aria-label={t("cur.toggle_aria", {
                            action: c.isActive
                              ? t("cur.deactivate")
                              : t("cur.activate"),
                            code: c.code,
                          })}
                          className="inline-flex items-center gap-1.5 p-1 rounded-lg transition-colors disabled:opacity-50"
                        >
                          {togglingCode === c.code ? (
                            <Loader2 className="w-5 h-5 animate-spin text-orange-500" />
                          ) : c.isActive ? (
                            <>
                              <ToggleRight className="w-6 h-6 text-emerald-500" />
                              <span className="text-[9px] font-black uppercase text-emerald-600 dark:text-emerald-400">
                                {t("status.active")}
                              </span>
                            </>
                          ) : (
                            <>
                              <ToggleLeft className="w-6 h-6 text-zinc-400" />
                              <span className="text-[9px] font-black uppercase text-zinc-500 dark:text-zinc-400">
                                {t("status.inactive")}
                              </span>
                            </>
                          )}
                        </button>
                      </td>
                      <td className="p-4 text-end">
                        <div className="flex justify-end gap-1.5">
                          <button
                            onClick={() => openEditCurrencyModal(c)}
                            disabled={deletingCode === c.code}
                            className="p-2.5 text-zinc-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-colors disabled:opacity-50"
                            title={t("cur.edit_aria", { code: c.code })}
                            aria-label={t("cur.edit_aria", { code: c.code })}
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteCurrency(c)}
                            disabled={deletingCode === c.code}
                            className="p-2.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-50"
                            title={t("cur.delete_aria", { code: c.code })}
                            aria-label={t("cur.delete_aria", { code: c.code })}
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
        </div>
      )}

      {/* === Exchange Rates Tab === */}
      {activeSubTab === "rates" && (
        <>
          {isRatesLoading ? (
            <CardSkeletonGrid count={6} />
          ) : ratesError ? (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden">
              <ErrorState message={ratesError} onRetry={fetchMarketRates} />
            </div>
          ) : filteredRates.length === 0 ? (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden">
              <EmptyState
                icon={isSearching ? SearchX : ArrowRightLeft}
                title={
                  isSearching ? t("cur.no_rate_match") : t("cur.none_rates")
                }
                hint={
                  isSearching
                    ? `Nothing matches “${searchQuery}”. Try a currency code.`
                    : t("cur.none_rates_hint")
                }
                action={isSearching ? undefined : addButton}
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredRates.map((r) => {
                const scope = rateScope(r);
                return (
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
                      {/* Only the default rate has an update endpoint; an
                          override is edited by its own owner. */}
                      <button
                        onClick={() => openEditRateModal(r)}
                        disabled={deletingRateId === r.id || !scope.isDefault}
                        hidden={!scope.isDefault}
                        className="p-2.5 text-zinc-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-colors disabled:opacity-50"
                        title={t("cur.edit_rate_aria", {
                          from: r.fromCurrencyId,
                          to: r.toCurrencyId,
                        })}
                        aria-label={t("cur.edit_rate_aria", {
                          from: r.fromCurrencyId,
                          to: r.toCurrencyId,
                        })}
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteRate(r)}
                        disabled={deletingRateId === r.id}
                        className="p-2.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-50"
                        title={t("cur.delete_rate_aria", {
                          from: r.fromCurrencyId,
                          to: r.toCurrencyId,
                        })}
                        aria-label={t("cur.delete_rate_aria", {
                          from: r.fromCurrencyId,
                          to: r.toCurrencyId,
                        })}
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
                      {t("cur.exchange_rate")}
                    </p>
                    {/* `toLocaleString()` defaults to 3 fraction digits, which
                        rendered a 0.00042 rate as a flat "0". */}
                    <p className="text-2xl font-black text-zinc-900 dark:text-white tabular-nums">
                      {formatRate(r.rate)}
                    </p>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-semibold mt-1">
                      {t("cur.one_equals", {
                        from: r.fromCurrencyId,
                        rate: formatRate(r.rate),
                        to: r.toCurrencyId,
                      })}
                    </p>
                  </div>

                  <p
                    className={`inline-flex items-center mt-3 text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-full border ${scope.tone}`}
                  >
                    {t(scope.key, { name: scope.name ?? "" })}
                  </p>

                  {r.updatedAt && (
                    <p className="text-[9px] text-zinc-400 font-semibold mt-3">
                      {t("cur.updated_at", {
                        date: formatDateTime(r.updatedAt),
                      })}
                    </p>
                  )}
                </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* === Currency Modal === */}
      <Modal
        isOpen={isCurrencyModalVisible}
        onClose={closeCurrencyModal}
        title={
          editingCurrency ? t("cur.edit_currency") : t("cur.add_currency_title")
        }
        description={
          editingCurrency
            ? `Update how ${editingCurrency.code} is displayed across the app.`
            : t("cur.need_currencies")
        }
        maxWidth="max-w-md"
        dismissable={!isSubmitting && !isCurrencyDirty}
        icon={
          <div className="w-9 h-9 rounded-xl bg-orange-500/10 text-orange-500 flex items-center justify-center shrink-0">
            <Coins className="w-4 h-4" />
          </div>
        }
        footer={
          <>
            <button
              type="button"
              onClick={closeCurrencyModal}
              className="flex-1 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-900 dark:text-white text-xs font-bold py-2.5 rounded-lg transition-colors"
            >
              {t("common.cancel")}
            </button>
            <button
              type="submit"
              form="currency-form"
              disabled={isSubmitting}
              className="flex-1 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold py-2.5 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {editingCurrency ? t("common.save_changes") : t("cur.create_cta")}
            </button>
          </>
        }
      >
        <form
          id="currency-form"
          onSubmit={editingCurrency ? handleUpdateCurrency : handleCreateCurrency}
          className="space-y-4"
        >
          <div>
            <label htmlFor="currency-code" className={labelClass}>
              {t("cur.currency_code")}
              <RequiredMark />
            </label>
            <input
              id="currency-code"
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
              className={`${inputClass} uppercase font-bold`}
              placeholder={t("cur.code_placeholder")}
            />
          </div>

          <div>
            <label htmlFor="currency-name" className={labelClass}>
              {t("common.name")}
              <RequiredMark />
            </label>
            <input
              id="currency-name"
              required
              type="text"
              value={currencyForm.name}
              onChange={(e) =>
                setCurrencyForm({ ...currencyForm, name: e.target.value })
              }
              className={inputClass}
              placeholder={t("cur.name_placeholder")}
            />
          </div>

          <div>
            <label htmlFor="currency-symbol" className={labelClass}>
              {t("cur.symbol")}
              <RequiredMark />
            </label>
            <input
              id="currency-symbol"
              required
              type="text"
              maxLength={5}
              value={currencyForm.symbol}
              onChange={(e) =>
                setCurrencyForm({ ...currencyForm, symbol: e.target.value })
              }
              className={`${inputClass} text-lg font-bold`}
              placeholder={t("cur.symbol_placeholder")}
            />
          </div>

          <div className="flex items-center gap-3 pt-1">
            <button
              type="button"
              role="switch"
              aria-checked={currencyForm.isActive}
              onClick={() =>
                setCurrencyForm({
                  ...currencyForm,
                  isActive: !currencyForm.isActive,
                })
              }
              className="flex items-center gap-2 rounded-lg"
            >
              {currencyForm.isActive ? (
                <ToggleRight className="w-7 h-7 text-emerald-500" />
              ) : (
                <ToggleLeft className="w-7 h-7 text-zinc-400" />
              )}
              <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                {currencyForm.isActive
                  ? t("status.active")
                  : t("status.inactive")}
              </span>
            </button>
          </div>
        </form>
      </Modal>

      {/* === Rate Modal === */}
      <Modal
        isOpen={isRateModalVisible}
        onClose={closeRateModal}
        title={
          editingRate ? t("cur.edit_rate") : t("cur.add_rate")
        }
        description={t("cur.rate_modal_desc")}
        maxWidth="max-w-md"
        dismissable={!isSubmitting && !isRateDirty}
        icon={
          <div className="w-9 h-9 rounded-xl bg-orange-500/10 text-orange-500 flex items-center justify-center shrink-0">
            <ArrowRightLeft className="w-4 h-4" />
          </div>
        }
        footer={
          <>
            <button
              type="button"
              onClick={closeRateModal}
              className="flex-1 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-900 dark:text-white text-xs font-bold py-2.5 rounded-lg transition-colors"
            >
              {t("common.cancel")}
            </button>
            <button
              type="submit"
              form="rate-form"
              disabled={isSubmitting}
              className="flex-1 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold py-2.5 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {editingRate ? t("common.save_changes") : t("cur.create_rate")}
            </button>
          </>
        }
      >
        <form
          id="rate-form"
          onSubmit={editingRate ? handleUpdateRate : handleCreateRate}
          className="space-y-4"
        >
          <div>
            <label htmlFor="rate-from-currency" className={labelClass}>
              {t("cur.from")}
              <RequiredMark />
            </label>
            <select
              id="rate-from-currency"
              required
              disabled={!!editingRate}
              value={rateForm.fromCurrencyId}
              onChange={(e) =>
                setRateForm({
                  ...rateForm,
                  fromCurrencyId: e.target.value,
                })
              }
              className={inputClass}
            >
              <option value="">{t("cur.select_currency")}</option>
              {currencies.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} — {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="rate-to-currency" className={labelClass}>
              {t("cur.to")}
              <RequiredMark />
            </label>
            <select
              id="rate-to-currency"
              required
              disabled={!!editingRate}
              value={rateForm.toCurrencyId}
              onChange={(e) =>
                setRateForm({ ...rateForm, toCurrencyId: e.target.value })
              }
              className={inputClass}
            >
              <option value="">{t("cur.select_currency")}</option>
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
            <label htmlFor="rate-value" className={labelClass}>
              {t("cur.exchange_rate")}
              <RequiredMark />
            </label>
            <input
              id="rate-value"
              required
              type="number"
              step="any"
              min="0"
              value={rateForm.rate}
              onChange={(e) => setRateForm({ ...rateForm, rate: e.target.value })}
              className={`${inputClass} font-bold tabular-nums`}
              placeholder={t("cur.rate_placeholder")}
            />
            {rateForm.fromCurrencyId &&
              rateForm.toCurrencyId &&
              rateForm.rate && (
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-semibold mt-1.5">
                  1 {rateForm.fromCurrencyId} = {formatRate(rateForm.rate)}{" "}
                  {rateForm.toCurrencyId}
                </p>
              )}
          </div>
        </form>
      </Modal>
    </div>
  );
}
