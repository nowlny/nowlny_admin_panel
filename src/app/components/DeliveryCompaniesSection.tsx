"use client";

import React, { useState, useEffect } from "react";
import {
  Truck,
  Search,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Loader2,
  Phone,
  Mail,
  MapPin,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  deliveryCompaniesService,
  DeliveryCompany,
} from "../../services/deliveryCompanies";

interface DeliveryCompaniesSectionProps {
  searchQuery: string;
}

export default function DeliveryCompaniesSection({
  searchQuery,
}: DeliveryCompaniesSectionProps) {
  const [companies, setCompanies] = useState<DeliveryCompany[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<
    "all" | "pending" | "active" | "rejected" | "suspended" | "inactive"
  >("pending");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Review states
  const [reviewingCompanyId, setReviewingCompanyId] = useState<string | null>(
    null
  );
  const [rejectionReason, setRejectionReason] = useState("");

  const fetchCompanies = async () => {
    try {
      setIsLoading(true);
      const data = await deliveryCompaniesService.getDeliveryCompanies({
        status: statusFilter,
        search: searchQuery,
        page: currentPage,
        limit: 20,
      });

      if (data && data.data) {
        setCompanies(data.data);
        setTotalPages(data.totalPages || Math.ceil((data.total || 0) / 20) || 1);
        setTotalItems(data.total || 0);
      } else if (Array.isArray(data)) {
        setCompanies(data);
        setTotalPages(1);
        setTotalItems(data.length);
      } else {
        setCompanies([]);
        setTotalPages(1);
        setTotalItems(0);
      }
      setError(null);
    } catch (err: any) {
      console.error("Failed to fetch delivery companies:", err);
      setError("An unexpected error occurred while loading data.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCompanies();
  }, [statusFilter, currentPage, searchQuery]);

  const handleReview = async (id: string, approve: boolean) => {
    if (!approve && !rejectionReason.trim()) {
      toast.error("Please provide a rejection reason.");
      return;
    }

    try {
      setIsSubmitting(true);
      await deliveryCompaniesService.reviewCompany(id, {
        approve,
        rejectionReason: approve ? undefined : rejectionReason,
      });
      toast.success(`Company ${approve ? "approved" : "rejected"} successfully.`);
      setReviewingCompanyId(null);
      setRejectionReason("");
      fetchCompanies(); // Refresh list
    } catch (err: any) {
      toast.error(`Failed to review company: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-white tracking-tight flex items-center gap-2">
            <Truck className="w-6 h-6 text-orange-500" />
            Delivery Companies
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Manage delivery companies, applications, and integration statuses.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto hide-scrollbar gap-2 pb-2">
        {["pending", "active", "suspended", "inactive", "rejected", "all"].map(
          (status) => (
            <button
              key={status}
              onClick={() => {
                setStatusFilter(status as any);
                setCurrentPage(1);
              }}
              className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all duration-200 ${
                statusFilter === status
                  ? "bg-orange-500 text-white shadow-md shadow-orange-500/20"
                  : "bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800"
              }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          )
        )}
      </div>

      {/* Content */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-orange-500 animate-spin mb-4" />
            <p className="text-zinc-500 font-medium">Loading companies...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 text-center px-4">
            <AlertTriangle className="w-12 h-12 text-red-500 mb-4" />
            <p className="text-red-500 font-bold mb-2">{error}</p>
            <button
              onClick={fetchCompanies}
              className="mt-4 px-4 py-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-900 dark:text-white rounded-xl text-sm font-bold transition-colors"
            >
              Try Again
            </button>
          </div>
        ) : companies.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center px-4">
            <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mb-4">
              <Truck className="w-8 h-8 text-zinc-400" />
            </div>
            <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-1">
              No Companies Found
            </h3>
            <p className="text-sm text-zinc-500 max-w-sm">
              We couldn't find any delivery companies matching your criteria.
            </p>
          </div>
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
                        src={company.logo}
                        alt={company.name}
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
                        <h3 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                          {company.name}
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full font-black uppercase tracking-wider border ${
                              company.status === "active"
                                ? "bg-green-500/10 text-green-600 border-green-500/20"
                                : company.status === "pending"
                                ? "bg-amber-500/10 text-amber-600 border-amber-500/20"
                                : company.status === "rejected"
                                ? "bg-red-500/10 text-red-600 border-red-500/20"
                                : "bg-zinc-500/10 text-zinc-600 border-zinc-500/20"
                            }`}
                          >
                            {company.status}
                          </span>
                        </h3>
                        {company.description && (
                          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 line-clamp-2">
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
                            <span className="font-bold">Charge:</span>
                            <span>
                              {company.deliveryCharge} {company.currencyId}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Actions for Pending */}
                      {company.status === "pending" && (
                        <div className="flex gap-2">
                          {reviewingCompanyId === company.id ? (
                            <div className="flex flex-col gap-2 bg-zinc-50 dark:bg-zinc-900/50 p-3 rounded-xl border border-zinc-200 dark:border-zinc-700 w-full sm:w-64">
                              <p className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                                Reject Company
                              </p>
                              <textarea
                                value={rejectionReason}
                                onChange={(e) => setRejectionReason(e.target.value)}
                                placeholder="Reason for rejection..."
                                className="w-full bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-orange-500/50 resize-none h-20"
                              />
                              <div className="flex gap-2 justify-end">
                                <button
                                  onClick={() => {
                                    setReviewingCompanyId(null);
                                    setRejectionReason("");
                                  }}
                                  disabled={isSubmitting}
                                  className="px-3 py-1.5 text-xs font-bold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                                >
                                  Cancel
                                </button>
                                <button
                                  onClick={() => handleReview(company.id, false)}
                                  disabled={isSubmitting || !rejectionReason.trim()}
                                  className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
                                >
                                  {isSubmitting ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <XCircle className="w-3.5 h-3.5" />
                                  )}
                                  Confirm Reject
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <button
                                onClick={() => handleReview(company.id, true)}
                                disabled={isSubmitting}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-bold transition-colors shadow-sm"
                              >
                                <CheckCircle className="w-4 h-4" />
                                Approve
                              </button>
                              <button
                                onClick={() => setReviewingCompanyId(company.id)}
                                disabled={isSubmitting}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/20 rounded-lg text-sm font-bold transition-colors"
                              >
                                <XCircle className="w-4 h-4" />
                                Reject
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
                          Rejection Reason
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
        
        {/* Pagination */}
        {!isLoading && totalPages > 1 && (
          <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50 dark:bg-zinc-900/50">
            <span className="text-sm text-zinc-500">
              Showing page {currentPage} of {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1 || isSubmitting}
                className="px-3 py-1.5 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50 transition-colors"
              >
                Previous
              </button>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages || isSubmitting}
                className="px-3 py-1.5 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50 transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
