"use client";

import React, { useState, useEffect } from "react";
import {
  Users,
  Search,
  Mail,
  Phone,
  Calendar,
  DollarSign,
  ShoppingBag,
  MapPin,
  Ban,
  CheckCircle,
  AlertTriangle,
  History,
  Trash2,
  Loader2,
  X,
  FileText,
} from "lucide-react";
import { Customer, Order, loadDb } from "../data/mockData";
import { customersService } from "../../services/customers";
import AddCustomerModal from "./AddCustomerModal";
import EditCustomerModal from "./EditCustomerModal";

interface CustomersSectionProps {
  db: ReturnType<typeof loadDb>;
  searchQuery: string;
}

export default function CustomersSection({
  db,
  searchQuery,
}: CustomersSectionProps) {
  const { orders } = db;
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [selectedCustId, setSelectedCustId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<
    "All" | "Active" | "Suspended"
  >("All");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const fetchCustomers = async () => {
    try {
      setIsLoading(true);
      const response = await customersService.getCustomers();

      // Handle both direct array responses and paginated responses (e.g., { data: [...] })
      const apiCustomers = Array.isArray(response)
        ? response
        : (response as any)?.data || (response as any)?.customers;

      if (apiCustomers && Array.isArray(apiCustomers)) {
        const mapped = apiCustomers.map((c: any) => ({
          id: c.id,
          name: c.user?.fullName || c.user?.nickname || "Unknown",
          email: c.user?.email || "No email",
          phone: c.user?.phoneNumber || c.phoneNumber || "No phone",
          avatar: "👤",
          status: (c.status === "active" ? "Active" : "Suspended") as
            | "Active"
            | "Suspended",
          joinedDate: c.user?.createdAt
            ? new Date(c.user.createdAt).toLocaleDateString()
            : c.createdAt
              ? new Date(c.createdAt).toLocaleDateString()
              : "Unknown",
          totalSpent: c.totalSpent || 0,
          ordersCount: c.ordersCount || 0,
          addresses: c.addresses || [],
        }));
        setCustomers(mapped);
      } else {
        // Empty state from API or invalid response
        setCustomers([]);
      }
    } catch (err) {
      console.error("Failed to fetch customers:", err);
      setCustomers([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const selectedCust = customers.find((c) => c.id === selectedCustId);

  // Filter customers
  const filteredCustomers = customers.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.phone.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === "All" || c.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const handleToggleStatus = async (cust: Customer) => {
    const newStatus = cust.status === "Active" ? "Suspended" : "Active";
    const apiStatus = newStatus === "Active" ? "active" : "suspended";
    const msg = `Are you sure you want to change status of ${cust.name} to ${newStatus}?`;
    if (!confirm(msg)) return;

    try {
      await customersService.updateCustomer(cust.id, { status: apiStatus });
      setCustomers((prev) =>
        prev.map((c) => (c.id === cust.id ? { ...c, status: newStatus } : c)),
      );
    } catch (err) {
      console.error("Failed to update status:", err);
      alert("Failed to update status on server.");
      setCustomers((prev) =>
        prev.map((c) => (c.id === cust.id ? { ...c, status: newStatus } : c)),
      );
    }
  };

  const handleDeleteCustomer = async (cust: Customer) => {
    const msg = `Are you sure you want to permanently delete customer ${cust.name}?`;
    if (!confirm(msg)) return;
    try {
      await customersService.deleteCustomer(cust.id);
      setCustomers((prev) => prev.filter((c) => c.id !== cust.id));
      if (selectedCustId === cust.id) setSelectedCustId(null);
    } catch (err) {
      console.error("Failed to delete customer:", err);
      alert("Failed to delete customer on server.");
      setCustomers((prev) => prev.filter((c) => c.id !== cust.id));
      if (selectedCustId === cust.id) setSelectedCustId(null);
    }
  };

  // Find orders belonging to selected customer
  const customerOrders = selectedCust
    ? orders.filter((o) => o.customerId === selectedCust.id)
    : [];

  if (isLoading && customers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-24 text-zinc-500">
        <Loader2 className="w-8 h-8 animate-spin mb-4 text-orange-500" />
        <p className="text-sm font-semibold">Loading customers...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header controls */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-2xl shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        {/* Status Tab buttons */}
        <div className="flex items-center gap-1.5 bg-zinc-50 dark:bg-zinc-800 p-1 rounded-xl border border-zinc-200/60 dark:border-zinc-700/80">
          {(["All", "Active", "Suspended"] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setStatusFilter(filter)}
              className={`text-xs font-bold px-4 py-2 rounded-lg transition-all duration-200 ${
                statusFilter === filter
                  ? "bg-white dark:bg-zinc-900 text-orange-500 shadow-sm border border-zinc-200/30 dark:border-zinc-800"
                  : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white"
              }`}
            >
              {filter}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-4">
          <span className="text-xs font-semibold text-zinc-500">
            Total Customers: {filteredCustomers.length} registered
          </span>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="text-xs font-bold px-3 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-all shadow-sm"
          >
            Add Customer
          </button>
        </div>
      </div>

      {/* Customer Grid List */}
      {filteredCustomers.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-12 text-center rounded-2xl flex flex-col items-center justify-center">
          <Users className="w-12 h-12 text-zinc-300 dark:text-zinc-700 mb-3" />
          <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
            No customers found
          </p>
          <p className="text-xs text-zinc-400 mt-1">
            Try relaxing filters or updating search search terms
          </p>
        </div>
      ) : (
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
                        className="text-[10px] text-zinc-400 font-semibold truncate mt-0.5"
                        title={cust.id}
                      >
                        ID: {cust.id}
                      </p>
                    </div>
                  </div>

                  <span
                    className={`shrink-0 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                      cust.status === "Active"
                        ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                        : "bg-red-500/10 text-red-500 border-red-500/20"
                    }`}
                  >
                    {cust.status}
                  </span>
                </div>

                {/* Info List */}
                <div className="mt-4 space-y-2 border-t border-zinc-100 dark:border-zinc-800 pt-3 text-[11px] text-zinc-500 dark:text-zinc-400">
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

              {/* stats row & details action */}
              <div className="mt-5 pt-3.5 border-t border-zinc-100 dark:border-zinc-800 flex justify-between items-center gap-3">
                <div className="flex gap-4">
                  <div>
                    <p className="text-[9px] font-bold text-zinc-400 uppercase">
                      Spend
                    </p>
                    <p className="text-xs font-black text-zinc-900 dark:text-white mt-0.5">
                      ${cust.totalSpent.toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[9px] font-bold text-zinc-400 uppercase">
                      Orders
                    </p>
                    <p className="text-xs font-black text-zinc-900 dark:text-white mt-0.5">
                      {cust.ordersCount}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedCustId(cust.id)}
                  className="bg-zinc-900 hover:bg-orange-500 hover:text-white active:scale-95 text-[10px] font-bold text-white dark:bg-zinc-800 px-3 py-2 rounded-lg transition-all"
                >
                  Inspect Account
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Customer Inspect Modal */}
      {selectedCust && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-5 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center bg-zinc-50 dark:bg-zinc-900/40">
              <div className="flex items-center gap-3">
                <span className="text-3xl p-1 bg-white dark:bg-zinc-800 rounded-xl shadow-sm">
                  {selectedCust.avatar}
                </span>
                <div>
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
                    {selectedCust.name}
                  </h3>
                  <p className="text-[10px] text-zinc-400">
                    Account Registry ID: {selectedCust.id}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedCustId(null)}
                className="text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body (Scrollable) */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Account details */}
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider">
                    Customer Profile
                  </h4>

                  <div className="space-y-2.5 text-xs text-zinc-600 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800/40 p-4 rounded-xl border border-zinc-100 dark:border-zinc-800">
                    <div className="flex justify-between">
                      <span className="font-semibold text-zinc-400">
                        Email Address
                      </span>
                      <span className="font-bold text-zinc-800 dark:text-zinc-200">
                        {selectedCust.email}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-semibold text-zinc-400">
                        Phone Contact
                      </span>
                      <span className="font-bold text-zinc-800 dark:text-zinc-200">
                        {selectedCust.phone}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-semibold text-zinc-400">
                        Registration Date
                      </span>
                      <span className="font-bold text-zinc-800 dark:text-zinc-200">
                        {selectedCust.joinedDate}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-semibold text-zinc-400">
                        Rating Status
                      </span>
                      <span
                        className={`font-bold px-2 py-0.5 rounded text-[10px] ${
                          selectedCust.status === "Active"
                            ? "bg-emerald-500/10 text-emerald-500"
                            : "bg-red-500/10 text-red-500"
                        }`}
                      >
                        {selectedCust.status}
                      </span>
                    </div>
                  </div>

                  {/* Account controls */}
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => setIsEditModalOpen(true)}
                      className="text-xs font-bold px-3 py-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-all flex items-center justify-center gap-1.5"
                    >
                      <span>Edit Customer Profile</span>
                    </button>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleToggleStatus(selectedCust)}
                        className={`flex-1 text-xs font-bold px-3 py-2.5 rounded-lg border transition-all flex items-center justify-center gap-1.5 ${
                          selectedCust.status === "Active"
                            ? "border-red-200 text-red-600 bg-red-500/5 hover:bg-red-500/10"
                            : "border-emerald-200 text-emerald-600 bg-emerald-500/5 hover:bg-emerald-500/10"
                        }`}
                      >
                        <Ban className="w-3.5 h-3.5" />
                        <span>
                          {selectedCust.status === "Active"
                            ? "Suspend/Ban Account"
                            : "Activate/Unban Account"}
                        </span>
                      </button>
                      <button
                        onClick={() => handleDeleteCustomer(selectedCust)}
                        className="text-xs font-bold px-3 py-2.5 rounded-lg border border-red-200 text-red-600 bg-red-500/5 hover:bg-red-500/10 transition-all flex items-center justify-center gap-1.5"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Addresses */}
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider">
                    Registered Locations
                  </h4>
                  <div className="space-y-2">
                    {selectedCust.addresses.map((address, idx) => (
                      <div
                        key={idx}
                        className="flex gap-2.5 p-3 rounded-xl border border-zinc-100 dark:border-zinc-800/80 text-[11px] text-zinc-500 dark:text-zinc-400 bg-zinc-50/50 dark:bg-zinc-900/30"
                      >
                        <MapPin className="w-4 h-4 text-orange-500 shrink-0" />
                        <span className="leading-relaxed">{address}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Past Transactions Log */}
              <div className="space-y-4 border-t border-zinc-100 dark:border-zinc-800 pt-5">
                <h4 className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                  <History className="w-4 h-4 text-orange-500" /> Order History
                  Log ({customerOrders.length} transactions)
                </h4>

                {customerOrders.length === 0 ? (
                  <p className="text-xs text-zinc-400 italic">
                    No past orders found for this customer.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {customerOrders.map((order) => (
                      <div
                        key={order.id}
                        className="flex items-center justify-between p-3.5 rounded-xl border border-zinc-100 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-900/40"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-zinc-900 dark:text-white">
                              {order.id}
                            </span>
                            <span className="text-[10px] text-zinc-400">•</span>
                            <span className="text-[10px] font-semibold text-orange-500">
                              {order.restaurantName}
                            </span>
                          </div>
                          <p className="text-[10px] text-zinc-400 mt-1">
                            {new Date(order.createdAt).toLocaleDateString()} •{" "}
                            {order.items.reduce((s, i) => s + i.quantity, 0)}{" "}
                            items
                          </p>
                        </div>

                        <div className="text-right">
                          <span className="text-xs font-black text-zinc-900 dark:text-white">
                            ${order.total.toFixed(2)}
                          </span>
                          <div className="mt-1">
                            <span
                              className={`text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${
                                order.status === "Delivered"
                                  ? "bg-emerald-500/10 text-emerald-600"
                                  : order.status === "Cancelled"
                                    ? "bg-red-500/10 text-red-500"
                                    : "bg-amber-500/10 text-amber-600 animate-pulse"
                              }`}
                            >
                              {order.status}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
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
