"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Users,
  Mail,
  Phone,
  Calendar,
  MapPin,
  Ban,
  History,
  Trash2,
  Loader2,
} from "lucide-react";
import toast from "react-hot-toast";
import { customersService, CustomerStatus } from "../../services/customers";
import { ordersService, OrderResponse } from "../../services/orders";
import AddCustomerModal from "./AddCustomerModal";
import EditCustomerModal from "./EditCustomerModal";
import Modal from "./ui/Modal";
import StatusPill from "./ui/StatusPill";
import { useConfirm } from "./ui/ConfirmDialog";
import { CardSkeletonGrid, EmptyState, ErrorState } from "./ui/States";
import { formatAddress, formatDate, formatMoney } from "../../lib/format";
import { useI18n, type MessageKey } from "../../lib/i18n";

/** The flattened shape this screen renders — the API nests the user record. */
interface CustomerRow {
  id: string;
  name: string;
  nickname?: string;
  email: string;
  phone: string;
  avatar: string;
  status: CustomerStatus;
  joinedDate: string;
  addresses: string[];
}

interface CustomersSectionProps {
  searchQuery: string;
}

const PAGE_SIZE = 12;

const STATUS_FILTERS: { value: CustomerStatus | "all"; key: MessageKey }[] = [
  { value: "all", key: "common.all" },
  { value: "active", key: "status.active" },
  { value: "inactive", key: "status.inactive" },
  { value: "suspended", key: "status.suspended" },
];

export default function CustomersSection({
  searchQuery,
}: CustomersSectionProps) {
  const { t } = useI18n();
  const confirm = useConfirm();
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedCustId, setSelectedCustId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<CustomerStatus | "all">(
    "all",
  );
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<
    "status" | "delete" | null
  >(null);

  // The header's search box drives the API's own `search` parameter.
  const [debouncedSearch, setDebouncedSearch] = useState(searchQuery);
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(searchQuery.trim()), 300);
    return () => clearTimeout(id);
  }, [searchQuery]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter]);

  // Order history for the inspected customer, fetched per customer.
  const [customerOrders, setCustomerOrders] = useState<OrderResponse[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState<string | null>(null);

  /**
   * The list endpoint takes `search`, `status`, `page` and `limit`. The panel
   * used to request one unfiltered page and filter it in the browser, so the
   * header's search box only ever looked at the first 20 accounts and the
   * status chips could not reach anyone past them.
   */
  const fetchCustomers = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await customersService.getCustomers({
        search: debouncedSearch || undefined,
        status: statusFilter,
        page,
        limit: PAGE_SIZE,
      });

      const mapped: CustomerRow[] = res.data.map((c) => ({
        id: c.id,
        name: c.user?.fullName || c.user?.nickname || c.nickname || "Unknown",
        nickname: c.user?.nickname || c.nickname || "",
        email: c.user?.email || "No email",
        phone: c.user?.phoneNumber || "No phone",
        avatar: "👤",
        status: (c.status ?? "active") as CustomerStatus,
        joinedDate: formatDate(c.user?.createdAt || c.createdAt),
        // The API returns each address as an object; rendering one directly
        // threw "Objects are not valid as a React child" and blanked the page.
        addresses: Array.isArray(c.addresses)
          ? c.addresses.map(formatAddress).filter(Boolean)
          : [],
      }));
      setCustomers(mapped);
      setTotal(res.total);
      setTotalPages(Math.max(1, res.totalPages ?? 1));
    } catch (err) {
      console.error("Failed to fetch customers:", err);
      setError(
        err instanceof Error ? err.message : "Failed to load customers.",
      );
      setCustomers([]);
    } finally {
      setIsLoading(false);
    }
  }, [debouncedSearch, statusFilter, page]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const selectedCust = customers.find((c) => c.id === selectedCustId);

  const fetchCustomerOrders = useCallback(async (customerId: string) => {
    try {
      setOrdersLoading(true);
      setOrdersError(null);
      const response = await ordersService.getOrdersByCustomer(customerId);
      const list = Array.isArray(response)
        ? (response as OrderResponse[])
        : response?.data || [];
      setCustomerOrders(Array.isArray(list) ? list : []);
    } catch (err: any) {
      console.error("Failed to fetch customer orders:", err);
      setOrdersError(err?.message || "Failed to load order history.");
      setCustomerOrders([]);
    } finally {
      setOrdersLoading(false);
    }
  }, []);

  // Orders used to come from the mock `db` prop, so a real (UUID) customer id
  // never matched and every account showed "0 transactions".
  useEffect(() => {
    if (!selectedCustId) {
      setCustomerOrders([]);
      setOrdersError(null);
      return;
    }
    fetchCustomerOrders(selectedCustId);
  }, [selectedCustId, fetchCustomerOrders]);

  // Filtering happens server side; this page is already the filtered slice.
  const filteredCustomers = customers;

  const handleToggleStatus = async (cust: CustomerRow) => {
    const suspending = cust.status === "active";
    const newStatus: CustomerStatus = suspending ? "suspended" : "active";

    const ok = await confirm({
      title: suspending
        ? t("customers.suspend_title", { name: cust.name })
        : t("customers.reactivate_title", { name: cust.name }),
      description: suspending
        ? t("customers.suspend_body")
        : t("customers.reactivate_body"),
      confirmLabel: suspending
        ? t("customers.suspend_cta")
        : t("customers.reactivate_cta"),
      variant: suspending ? "danger" : "default",
    });
    if (!ok) return;

    try {
      setPendingAction("status");
      await customersService.updateCustomer(cust.id, { status: newStatus });
      // Only mirror the change locally once the server has accepted it.
      setCustomers((prev) =>
        prev.map((c) => (c.id === cust.id ? { ...c, status: newStatus } : c)),
      );
      toast.success(
        suspending
          ? t("customers.suspended_toast", { name: cust.name })
          : t("customers.reactivated_toast", { name: cust.name }),
      );
    } catch (err: any) {
      console.error("Failed to update status:", err);
      toast.error(err?.message || t("customers.status_failed"));
    } finally {
      setPendingAction(null);
    }
  };

  const handleDeleteCustomer = async (cust: CustomerRow) => {
    const ok = await confirm({
      title: t("customers.delete_title", { name: cust.name }),
      description: t("customers.delete_body"),
      confirmLabel: t("customers.delete_cta"),
      variant: "danger",
      confirmPhrase: cust.name,
    });
    if (!ok) return;

    try {
      setPendingAction("delete");
      await customersService.deleteCustomer(cust.id);
      setCustomers((prev) => prev.filter((c) => c.id !== cust.id));
      if (selectedCustId === cust.id) setSelectedCustId(null);
      toast.success(t("customers.deleted_toast", { name: cust.name }));
    } catch (err: any) {
      console.error("Failed to delete customer:", err);
      // Deliberately NOT removing the card — the record still exists server-side.
      toast.error(err?.message || t("customers.delete_failed"));
    } finally {
      setPendingAction(null);
    }
  };

  const renderList = () => {
    if (isLoading) return <CardSkeletonGrid count={6} />;

    if (error) {
      return (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl">
          <ErrorState
            title={t("customers.load_failed")}
            message={error}
            onRetry={fetchCustomers}
          />
        </div>
      );
    }

    if (filteredCustomers.length === 0) {
      const isFiltered = !!debouncedSearch || statusFilter !== "all";
      return (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl">
          <EmptyState
            icon={Users}
            title={
              isFiltered
                ? t("customers.no_match_title")
                : t("customers.none_title")
            }
            hint={
              isFiltered
                ? t("customers.no_match_hint")
                : t("customers.none_hint")
            }
            action={
              !isFiltered ? (
                <button
                  onClick={() => setIsAddModalOpen(true)}
                  className="text-xs font-bold px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-all shadow-sm"
                >
                  {t("customers.add")}
                </button>
              ) : undefined
            }
          />
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredCustomers.map((cust) => (
          <div
            key={cust.id}
            className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl shadow-sm hover:shadow-md transition-all duration-200 group flex flex-col justify-between"
          >
            <div>
              {/* Header */}
              <div className="flex justify-between items-start gap-2">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <span className="text-3xl p-1 bg-zinc-50 dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-100 dark:border-zinc-700 shrink-0">
                    {cust.avatar}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-sm font-bold text-zinc-950 dark:text-white truncate group-hover:text-orange-500 transition-colors">
                      {cust.name}
                    </h4>
                    <p
                      className="text-[10px] text-zinc-500 dark:text-zinc-400 font-semibold truncate mt-0.5"
                      title={cust.id}
                    >
                      ID: {cust.id}
                    </p>
                  </div>
                </div>

                <StatusPill
                  status={cust.status}
                  className="shrink-0 uppercase tracking-wider"
                />
              </div>

              {/* Info List */}
              <div className="mt-4 space-y-2 border-t border-zinc-100 dark:border-zinc-800 pt-3 text-[11px] text-zinc-600 dark:text-zinc-400">
                {cust.email !== "No email" && (
                  <div className="flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                    <span className="truncate">{cust.email}</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                  <span>{cust.phone}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                  <span>Joined {cust.joinedDate}</span>
                </div>
              </div>
            </div>

            {/*
              The "Spend" and "Orders" tiles that used to sit here read
              `totalSpent` and `ordersCount`, neither of which the customers
              endpoint returns — so every card advertised $0.00 and 0 orders
              for every customer on the platform. The real order history is one
              click away in "Inspect Account", where it is actually fetched.
            */}
            <div className="mt-5 pt-3.5 border-t border-zinc-100 dark:border-zinc-800 flex justify-between items-center gap-3">
              {cust.nickname ? (
                <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-semibold truncate">
                  “{cust.nickname}”
                </p>
              ) : (
                <span />
              )}

              <button
                onClick={() => setSelectedCustId(cust.id)}
                className="bg-zinc-900 hover:bg-orange-500 hover:text-white active:scale-95 text-[10px] font-bold text-white dark:bg-zinc-800 px-3 py-2 rounded-lg transition-all"
              >
                {t("customers.inspect")}
              </button>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header controls */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-2xl shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        {/* Status Tab buttons */}
        <div className="flex items-center gap-1.5 bg-zinc-50 dark:bg-zinc-800 p-1 rounded-xl border border-zinc-200/60 dark:border-zinc-700/80">
          {STATUS_FILTERS.map((filter) => (
            <button
              key={filter.value}
              onClick={() => setStatusFilter(filter.value)}
              aria-pressed={statusFilter === filter.value}
              className={`text-xs font-bold px-4 py-2 rounded-lg transition-all duration-200 ${
                statusFilter === filter.value
                  ? "bg-white dark:bg-zinc-900 text-orange-500 shadow-sm border border-zinc-200/30 dark:border-zinc-800"
                  : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white"
              }`}
            >
              {t(filter.key)}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-4">
          <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
            {total === customers.length
              ? t("customers.count", { count: total })
              : t("customers.showing", {
                  shown: customers.length,
                  total,
                })}
          </span>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="text-xs font-bold px-3 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-all shadow-sm"
          >
            {t("customers.add")}
          </button>
        </div>
      </div>

      {/* Customer Grid List */}
      {renderList()}

      {!isLoading && !error && totalPages > 1 && (
        <div className="flex justify-center items-center gap-2">
          <button
            disabled={page === 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="px-3 py-1.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs font-bold disabled:opacity-50"
          >
            {t("common.previous")}
          </button>
          <span className="text-xs font-semibold text-zinc-500">
            Page {page} of {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="px-3 py-1.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs font-bold disabled:opacity-50"
          >
            {t("common.next")}
          </button>
        </div>
      )}

      {/* Customer Inspect Modal */}
      {/* Hidden while the edit dialog is up: two stacked <Modal>s both listen
          for Escape, so closing the edit form would also close this one. */}
      <Modal
        isOpen={!!selectedCust && !isEditModalOpen}
        onClose={() => setSelectedCustId(null)}
        maxWidth="max-w-2xl"
        title={selectedCust?.name ?? ""}
        description={t("customers.registry_id", { id: selectedCust?.id ?? "" })}
        icon={
          <span className="text-3xl p-1 bg-white dark:bg-zinc-800 rounded-xl shadow-sm">
            {selectedCust?.avatar}
          </span>
        }
      >
        {selectedCust && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Account details */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider">
                  {t("customers.profile")}
                </h4>

                <div className="space-y-2.5 text-xs text-zinc-600 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800/40 p-4 rounded-xl border border-zinc-100 dark:border-zinc-800">
                  <div className="flex justify-between gap-3">
                    <span className="font-semibold text-zinc-500 dark:text-zinc-400">
                      {t("customers.email")}
                    </span>
                    <span className="font-bold text-zinc-800 dark:text-zinc-200 truncate">
                      {selectedCust.email}
                    </span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="font-semibold text-zinc-500 dark:text-zinc-400">
                      {t("customers.phone_contact")}
                    </span>
                    <span className="font-bold text-zinc-800 dark:text-zinc-200">
                      {selectedCust.phone}
                    </span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="font-semibold text-zinc-500 dark:text-zinc-400">
                      {t("customers.registered_on")}
                    </span>
                    <span className="font-bold text-zinc-800 dark:text-zinc-200">
                      {selectedCust.joinedDate}
                    </span>
                  </div>
                  <div className="flex justify-between items-center gap-3">
                    <span className="font-semibold text-zinc-500 dark:text-zinc-400">
                      {t("customers.account_status")}
                    </span>
                    <StatusPill status={selectedCust.status} />
                  </div>
                </div>

                {/* Account controls */}
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => setIsEditModalOpen(true)}
                    className="text-xs font-bold px-3 py-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-all flex items-center justify-center gap-1.5"
                  >
                    <span>{t("customers.edit_profile")}</span>
                  </button>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleToggleStatus(selectedCust)}
                      disabled={pendingAction !== null}
                      className={`flex-1 text-xs font-bold px-3 py-2.5 rounded-lg border transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed ${
                        selectedCust.status === "active"
                          ? "border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400 bg-red-500/5 hover:bg-red-500/10"
                          : "border-emerald-200 dark:border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/5 hover:bg-emerald-500/10"
                      }`}
                    >
                      {pendingAction === "status" ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Ban className="w-3.5 h-3.5" />
                      )}
                      <span>
                        {selectedCust.status === "active"
                          ? t("customers.suspend")
                          : t("customers.activate")}
                      </span>
                    </button>
                    <button
                      onClick={() => handleDeleteCustomer(selectedCust)}
                      disabled={pendingAction !== null}
                      className="text-xs font-bold px-3 py-2.5 rounded-lg border border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400 bg-red-500/5 hover:bg-red-500/10 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {pendingAction === "delete" ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                      <span>{t("customers.delete")}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Addresses */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider">
                  {t("customers.locations")}
                </h4>
                {selectedCust.addresses.length === 0 ? (
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 p-3 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800">
                    {t("customers.no_addresses")}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {selectedCust.addresses.map((address, idx) => (
                      <div
                        key={idx}
                        className="flex gap-2.5 p-3 rounded-xl border border-zinc-100 dark:border-zinc-800/80 text-[11px] text-zinc-600 dark:text-zinc-400 bg-zinc-50/50 dark:bg-zinc-900/30"
                      >
                        <MapPin className="w-4 h-4 text-orange-500 shrink-0" />
                        <span className="leading-relaxed">{address}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Past Transactions Log */}
            <div className="space-y-4 border-t border-zinc-100 dark:border-zinc-800 pt-5">
              <h4 className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                <History className="w-4 h-4 text-orange-500" /> {t("customers.history")}
                {!ordersLoading &&
                  !ordersError &&
                  ` ${t("customers.history_count", { count: customerOrders.length })}`}
              </h4>

              {ordersLoading ? (
                <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400 py-4">
                  <Loader2 className="w-4 h-4 animate-spin text-orange-500" />
                  {t("customers.history_loading")}
                </div>
              ) : ordersError ? (
                <ErrorState
                  title={t("customers.history_failed")}
                  message={ordersError}
                  onRetry={() => fetchCustomerOrders(selectedCust.id)}
                />
              ) : customerOrders.length === 0 ? (
                <p className="text-xs text-zinc-500 dark:text-zinc-400 italic">
                  {t("customers.history_empty")}
                </p>
              ) : (
                <div className="space-y-3">
                  {customerOrders.map((order) => (
                    <div
                      key={order.id}
                      className="flex items-center justify-between gap-3 p-3.5 rounded-xl border border-zinc-100 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-900/40"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xs font-bold text-zinc-900 dark:text-white truncate">
                            {order.id}
                          </span>
                          <span className="text-[10px] text-zinc-400">•</span>
                          <span className="text-[10px] font-semibold text-orange-500 truncate">
                            {order.restaurantName ||
                              order.restaurant?.name ||
  t("customers.unknown_rest")}
                          </span>
                        </div>
                        <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-1">
                          {formatDate(order.createdAt)} •{" "}
                          {(order.items || []).reduce(
                            (s, i) => s + (Number(i.quantity) || 0),
                            0,
                          )}{" "}
                          {t("customers.items_count", { count: "" }).trim()}
                        </p>
                      </div>

                      <div className="text-end shrink-0">
                        <span className="text-xs font-black text-zinc-900 dark:text-white">
                          {formatMoney(order.total, "USD")}
                        </span>
                        <div className="mt-1">
                          <StatusPill status={order.status} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Modals */}
      <AddCustomerModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={fetchCustomers}
      />

      <EditCustomerModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSuccess={() => {
          fetchCustomers();
          setSelectedCustId(null);
        }}
        customerId={selectedCustId}
        customerData={selectedCust}
      />
    </div>
  );
}
