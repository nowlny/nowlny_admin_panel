"use client";

import React, { useState, useEffect } from "react";
import {
  Truck,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Loader2,
  Phone,
  SearchX,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  deliveryCompaniesService,
  DeliveryCompany,
  DeliveryCompanyStatus,
} from "../../services/deliveryCompanies";
import DeliveryCompanyDetailModal from "./DeliveryCompanyDetailModal";
import StatusPill, { statusLabel } from "./ui/StatusPill";
import { EmptyState, ErrorState, Skeleton } from "./ui/States";
import { formatMoney } from "../../lib/format";

import { useI18n } from "../../lib/i18n";
interface DeliveryCompaniesSectionProps {
  searchQuery: string;
}

const inputClass =
  "w-full bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-orange-500";

/** Logo paths come back relative on some records, which 404 rendered raw. */
const getImageUrl = (path?: string) => {
  if (!path) return "";
  if (path.startsWith("http") || path.startsWith("data:")) return path;
  const baseUrl =
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.NEXT_PUBLIC_MAIN_URL ||
    "https://app.nowlny.com";
  return `${baseUrl}${path.startsWith("/") ? "" : "/"}${path}`;
};

export default function DeliveryCompaniesSection({
  searchQuery,
}: DeliveryCompaniesSectionProps) {
  const { t } = useI18n();
  const [companies, setCompanies] = useState<DeliveryCompany[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<
    DeliveryCompanyStatus | "all"
  >("pending");
  const [inspecting, setInspecting] = useState<DeliveryCompany | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Review states
  const [reviewingCompanyId, setReviewingCompanyId] = useState<string | null>(
    null,
  );
  const [rejectionReason, setRejectionReason] = useState("");

  const fetchCompanies = async () => {
    try {
      setIsLoading(true);
      const res = await deliveryCompaniesService.getDeliveryCompanies({
        status: statusFilter,
        search: searchQuery,
        page: currentPage,
        limit: 20,
      });
      setCompanies(res.data);
      setTotalPages(Math.max(1, res.totalPages ?? 1));
      setTotalItems(res.total);
      setError(null);
    } catch (err: any) {
      console.error("Failed to fetch delivery companies:", err);
      setError(
        err?.message || t("delivery.load_failed"),
      );
      setCompanies([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCompanies();
  }, [statusFilter, currentPage, searchQuery]);

  const handleReview = async (id: string, approve: boolean) => {
    if (!approve && !rejectionReason.trim()) {
      toast.error(t("delivery.need_reason"));
      return;
    }

    try {
      setIsSubmitting(true);
      await deliveryCompaniesService.reviewCompany(id, {
        approve,
        rejectionReason: approve ? undefined : rejectionReason,
      });
      toast.success(
        approve ? t("delivery.approved_toast") : t("delivery.rejected_toast"),
      );
      setReviewingCompanyId(null);
      setRejectionReason("");
      fetchCompanies(); // Refresh list
    } catch (err: any) {
      toast.error(err?.message || t("delivery.review_failed"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const isFiltered = !!searchQuery?.trim() || statusFilter !== "all";

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-2xl shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-lg font-bold text-zinc-900 dark:text-white tracking-tight flex items-center gap-2">
            <Truck className="w-5 h-5 text-orange-500" />
            {t("delivery.title")}
          </h2>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-semibold mt-1">
            {t("delivery.subtitle")}
          </p>
        </div>
        {!isLoading && !error && totalItems > 0 && (
          <span className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400">
            {totalItems === 1
              ? t("delivery.count_one")
              : t("delivery.count", { count: totalItems })}
          </span>
        )}
      </div>

      {/* Tabs — `scrollbar-none` (globals.css); `hide-scrollbar` was never defined. */}
      <div
        role="group"
        aria-label={t("delivery.filter_label")}
        className="flex overflow-x-auto scrollbar-none gap-2 pb-2"
      >
        {["pending", "active", "suspended", "inactive", "rejected", "all"].map(
          (status) => (
            <button
              key={status}
              aria-pressed={statusFilter === status}
              onClick={() => {
                setStatusFilter(status as DeliveryCompanyStatus | "all");
                setCurrentPage(1);
              }}
              className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all duration-200 ${
                statusFilter === status
                  ? "bg-orange-500 text-white shadow-md shadow-orange-500/20"
                  : "bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800"
              }`}
            >
              {status === "all" ? t("common.all") : statusLabel(status, t)}
            </button>
          ),
        )}
      </div>

      {/* Content */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="flex gap-4 items-center">
                <Skeleton className="w-16 h-16 rounded-xl shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-3 w-2/3" />
                  <Skeleton className="h-3 w-1/4" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <ErrorState message={error} onRetry={fetchCompanies} />
        ) : companies.length === 0 ? (
          <EmptyState
            icon={isFiltered ? SearchX : Truck}
            title={
              isFiltered
                ? t("delivery.filtered_title")
                : t("delivery.none_title")
            }
            hint={
              isFiltered
                ? t("delivery.filtered_hint", { status: statusFilter })
                : t("delivery.none_hint")
            }
          />
        ) : (
          <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {companies.map((company) => (
              <div
                key={company.id}
                className="p-4 sm:p-6 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
              >
                <div className="flex flex-col md:flex-row gap-6">
                  {/* Logo/Icon */}
                  <div className="w-16 h-16 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center shrink-0 overflow-hidden">
                    {company.logo ? (
                      <img
                        src={getImageUrl(company.logo)}
                        alt={`${company.name} logo`}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Truck className="w-8 h-8 text-zinc-400" />
                    )}
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                      <div>
                        <h3 className="text-lg font-bold text-zinc-900 dark:text-white flex flex-wrap items-center gap-2">
                          {company.name}
                          {/* The old inline pill had no dark: variants, so
                              "suspended"/"inactive" were unreadable on dark. */}
                          <StatusPill status={company.status} />
                        </h3>
                        {company.description && (
                          <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1 line-clamp-2">
                            {company.description}
                          </p>
                        )}
                        <div className="flex flex-wrap gap-4 mt-3">
                          {company.phone && (
                            <div className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400">
                              <Phone className="w-3.5 h-3.5" />
                              <span>{company.phone}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400">
                            <span className="font-bold">{t("delivery.charge")}</span>
                            <span>
                              {formatMoney(
                                company.deliveryCharge,
                                company.currency?.code ?? company.currencyId,
                              )}
                            </span>
                          </div>
                          {company.driversCount != null && (
                            <div className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400">
                              <span className="font-bold">
                                {t("delivery.fleet")}
                              </span>
                              <span>{company.driversCount}</span>
                            </div>
                          )}
                          <button
                            onClick={() => setInspecting(company)}
                            className="text-xs font-bold text-orange-500 hover:text-orange-600 transition-colors"
                          >
                            {t("delivery.view_detail")}
                          </button>
                        </div>
                      </div>

                      {/* Actions for Pending */}
                      {company.status === "pending" && (
                        <div className="flex gap-2">
                          {reviewingCompanyId === company.id ? (
                            <div className="flex flex-col gap-2 bg-zinc-50 dark:bg-zinc-900/50 p-3 rounded-xl border border-zinc-200 dark:border-zinc-700 w-full sm:w-64">
                              <label
                                htmlFor={`rejection-reason-${company.id}`}
                                className="text-xs font-bold text-zinc-700 dark:text-zinc-300"
                              >
                                {t("delivery.reject_named", { name: company.name })}
                              </label>
                              <textarea
                                id={`rejection-reason-${company.id}`}
                                value={rejectionReason}
                                onChange={(e) =>
                                  setRejectionReason(e.target.value)
                                }
                                placeholder={t("delivery.reject_placeholder")}
                                className={`${inputClass} resize-none h-20`}
                              />
                              <div className="flex gap-2 justify-end">
                                <button
                                  onClick={() => {
                                    setReviewingCompanyId(null);
                                    setRejectionReason("");
                                  }}
                                  disabled={isSubmitting}
                                  className="px-3 py-2 text-xs font-bold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors disabled:opacity-50"
                                >
                                  {t("common.cancel")}
                                </button>
                                <button
                                  onClick={() =>
                                    handleReview(company.id, false)
                                  }
                                  disabled={
                                    isSubmitting || !rejectionReason.trim()
                                  }
                                  className="flex items-center gap-1.5 px-3 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
                                >
                                  {isSubmitting ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <XCircle className="w-3.5 h-3.5" />
                                  )}
                                  {t("delivery.confirm_reject")}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <button
                                onClick={() => handleReview(company.id, true)}
                                disabled={isSubmitting}
                                aria-label={t("delivery.approve_named", { name: company.name })}
                                className="flex items-center gap-1.5 px-3 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-bold transition-colors shadow-sm disabled:opacity-50"
                              >
                                {isSubmitting ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <CheckCircle className="w-4 h-4" />
                                )}
                                {t("delivery.approve")}
                              </button>
                              <button
                                onClick={() =>
                                  setReviewingCompanyId(company.id)
                                }
                                disabled={isSubmitting}
                                aria-label={t("delivery.reject_named", { name: company.name })}
                                className="flex items-center gap-1.5 px-3 py-2 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/20 rounded-lg text-sm font-bold transition-colors disabled:opacity-50"
                              >
                                <XCircle className="w-4 h-4" />
                                {t("delivery.reject")}
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                    {company.rejectionReason && (
                      <div className="mt-4 p-3 bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 rounded-xl">
                        <p className="text-xs font-bold text-red-800 dark:text-red-400 mb-1 flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          {t("common.rejection_reason")}
                        </p>
                        <p className="text-sm text-red-700 dark:text-red-300">
                          {company.rejectionReason}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Detail — zones, ratings and exchange rates, none of which the list
            row can show. */}
        <DeliveryCompanyDetailModal
          company={inspecting}
          onClose={() => setInspecting(null)}
        />

        {/* Pagination */}
        {!isLoading && !error && totalPages > 1 && (
          <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50 dark:bg-zinc-900/50">
            <span className="text-sm text-zinc-500 dark:text-zinc-400">
              {t("delivery.showing_page", {
                page: currentPage,
                total: totalPages,
              })}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1 || isSubmitting}
                className="px-3 py-1.5 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50 transition-colors"
              >
                {t("common.previous")}
              </button>
              <button
                onClick={() =>
                  setCurrentPage((p) => Math.min(totalPages, p + 1))
                }
                disabled={currentPage === totalPages || isSubmitting}
                className="px-3 py-1.5 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50 transition-colors"
              >
                {t("common.next")}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
