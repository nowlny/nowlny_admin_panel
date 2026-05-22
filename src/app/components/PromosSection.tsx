"use client";

import React, { useState } from "react";
import {
  Ticket,
  Plus,
  Trash2,
  Calendar,
  DollarSign,
  Percent,
  CheckCircle2,
  XCircle,
  Tag,
  Clock,
} from "lucide-react";
import { PromoCode, loadDb } from "../data/mockData";

interface PromosSectionProps {
  db: ReturnType<typeof loadDb>;
  onUpdatePromos: (updatedPromos: PromoCode[]) => void;
  searchQuery: string;
}

export default function PromosSection({
  db,
  onUpdatePromos,
  searchQuery,
}: PromosSectionProps) {
  const { promos } = db;
  const [isAddingPromo, setIsAddingPromo] = useState(false);

  // Form states for creating a new promo code
  const [newCode, setNewCode] = useState("");
  const [newType, setNewType] = useState<"percentage" | "fixed">("percentage");
  const [newValue, setNewValue] = useState("");
  const [newMinOrder, setNewMinOrder] = useState("");
  const [newExpiry, setNewExpiry] = useState("");

  // Filter promos
  const filteredPromos = promos.filter((p) =>
    p.code.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const handleTogglePromoStatus = (codeStr: string) => {
    const updated = promos.map((p) =>
      p.code === codeStr ? { ...p, isActive: !p.isActive } : p,
    );
    onUpdatePromos(updated);
  };

  const handleDeletePromo = (codeStr: string) => {
    if (!confirm(`Delete coupon code ${codeStr}?`)) return;
    const updated = promos.filter((p) => p.code !== codeStr);
    onUpdatePromos(updated);
  };

  const handleCreatePromo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCode.trim() || !newValue || !newExpiry) {
      alert("Code, Discount Value, and Expiration date are required.");
      return;
    }

    const codeUpper = newCode.trim().toUpperCase();
    if (promos.some((p) => p.code === codeUpper)) {
      alert("This coupon code already exists!");
      return;
    }

    const newPromo: PromoCode = {
      code: codeUpper,
      discountType: newType,
      discountValue: parseFloat(newValue),
      minOrderValue: parseFloat(newMinOrder) || 0.0,
      expiresAt: newExpiry,
      isActive: true,
      usedCount: 0,
    };

    const updated = [newPromo, ...promos];
    onUpdatePromos(updated);

    // Reset Form
    setNewCode("");
    setNewType("percentage");
    setNewValue("");
    setNewMinOrder("");
    setNewExpiry("");
    setIsAddingPromo(false);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Promo Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl shadow-sm">
          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide">
            Registered Coupons
          </p>
          <p className="text-xl font-black text-zinc-900 dark:text-white mt-1">
            {promos.length} Campaign Codes
          </p>
        </div>
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl shadow-sm">
          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide">
            Active campaigns
          </p>
          <p className="text-xl font-black text-orange-500 mt-1">
            {promos.filter((p) => p.isActive).length} Live Offers
          </p>
        </div>
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl shadow-sm">
          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide">
            Redeemed Usages
          </p>
          <p className="text-xl font-black text-zinc-900 dark:text-white mt-1">
            {promos.reduce((s, p) => s + p.usedCount, 0)} items
          </p>
        </div>
      </div>

      {/* Action Header controls */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-2xl shadow-sm flex justify-between items-center gap-4">
        <span className="text-xs font-semibold text-zinc-500">
          Showing {filteredPromos.length} campaign listings
        </span>

        <button
          onClick={() => setIsAddingPromo(!isAddingPromo)}
          className="flex items-center gap-1.5 text-xs font-bold bg-orange-500 hover:bg-orange-600 text-white px-4 py-2.5 rounded-xl transition-all shadow shadow-orange-500/10 active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>Launch Campaign</span>
        </button>
      </div>

      {/* Launch Promo Form */}
      {isAddingPromo && (
        <form
          onSubmit={handleCreatePromo}
          className="bg-white dark:bg-zinc-900 border border-orange-500/20 p-6 rounded-2xl shadow-lg space-y-4 animate-in slide-in-from-top-3 duration-200"
        >
          <div className="flex items-center gap-2 mb-2 pb-2 border-b border-zinc-100 dark:border-zinc-800">
            <Tag className="w-4 h-4 text-orange-500" />
            <h4 className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider">
              Configure Promo Offer
            </h4>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-zinc-400 uppercase">
                Coupon Code
              </label>
              <input
                type="text"
                placeholder="e.g. SUMMERSAVE30"
                value={newCode}
                onChange={(e) => setNewCode(e.target.value)}
                className="w-full bg-zinc-50 border border-zinc-200 text-zinc-800 rounded-lg p-2 text-xs focus:ring-1 focus:ring-orange-500 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-200"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-zinc-400 uppercase">
                Discount Type
              </label>
              <select
                value={newType}
                onChange={(e) =>
                  setNewType(e.target.value as "percentage" | "fixed")
                }
                className="w-full bg-zinc-50 border border-zinc-200 text-zinc-800 rounded-lg p-2 text-xs focus:ring-1 focus:ring-orange-500 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-200 cursor-pointer"
              >
                <option value="percentage">Percentage (%)</option>
                <option value="fixed">Fixed Dollar ($)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-zinc-400 uppercase">
                Discount Value
              </label>
              <input
                type="number"
                step="0.01"
                placeholder={newType === "percentage" ? "20" : "5.00"}
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                className="w-full bg-zinc-50 border border-zinc-200 text-zinc-800 rounded-lg p-2 text-xs focus:ring-1 focus:ring-orange-500 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-200"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-zinc-400 uppercase">
                Min Order ($)
              </label>
              <input
                type="number"
                step="0.01"
                placeholder="15.00"
                value={newMinOrder}
                onChange={(e) => setNewMinOrder(e.target.value)}
                className="w-full bg-zinc-50 border border-zinc-200 text-zinc-800 rounded-lg p-2 text-xs focus:ring-1 focus:ring-orange-500 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-200"
              />
            </div>

            <div className="space-y-1 md:col-span-2">
              <label className="text-[10px] font-bold text-zinc-400 uppercase flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" /> Expiration Date
              </label>
              <input
                type="date"
                value={newExpiry}
                onChange={(e) => setNewExpiry(e.target.value)}
                className="w-full bg-zinc-50 border border-zinc-200 text-zinc-800 rounded-lg p-2 text-xs focus:ring-1 focus:ring-orange-500 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-200 cursor-pointer"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="submit"
              className="bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold px-4 py-2.5 rounded-lg transition-colors"
            >
              Activate Campaign
            </button>
            <button
              type="button"
              onClick={() => setIsAddingPromo(false)}
              className="bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs font-bold px-4 py-2.5 rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Promos Table list */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-50 dark:bg-zinc-800/40 text-zinc-400 uppercase text-[9px] font-bold tracking-wider border-b border-zinc-100 dark:border-zinc-800">
              <tr>
                <th className="p-4 font-black">Promo Code</th>
                <th className="p-4 font-black">Benefit type</th>
                <th className="p-4 font-black">Discount Value</th>
                <th className="p-4 font-black">Min basket Requirement</th>
                <th className="p-4 font-black">Expiration date</th>
                <th className="p-4 font-black">Redemptions</th>
                <th className="p-4 font-black">System Status</th>
                <th className="p-4 font-black text-right">Overrides</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {filteredPromos.map((promo) => (
                <tr
                  key={promo.code}
                  className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/20 transition-colors"
                >
                  <td className="p-4 font-extrabold text-zinc-900 dark:text-white flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-orange-500" />
                    <span>{promo.code}</span>
                  </td>
                  <td className="p-4 font-semibold capitalize text-zinc-500 dark:text-zinc-400">
                    {promo.discountType}
                  </td>
                  <td className="p-4 font-black text-zinc-900 dark:text-white">
                    {promo.discountType === "percentage" ? (
                      <span className="inline-flex items-center gap-0.5">
                        <Percent className="w-3 h-3 text-orange-500" />{" "}
                        {promo.discountValue}% Off
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-0.5">
                        <DollarSign className="w-3 h-3 text-emerald-500" /> $
                        {promo.discountValue.toFixed(2)} Off
                      </span>
                    )}
                  </td>
                  <td className="p-4 text-zinc-600 dark:text-zinc-400 font-bold">
                    ${promo.minOrderValue.toFixed(2)}
                  </td>
                  <td className="p-4 text-zinc-500 dark:text-zinc-400">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" /> {promo.expiresAt}
                    </span>
                  </td>
                  <td className="p-4 font-black text-zinc-900 dark:text-white">
                    {promo.usedCount} claims
                  </td>
                  <td className="p-4">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                        promo.isActive
                          ? "bg-emerald-500/10 text-emerald-500"
                          : "bg-zinc-300 text-zinc-500"
                      }`}
                    >
                      {promo.isActive ? "Live" : "Inactive"}
                    </span>
                  </td>
                  <td className="p-4 text-right flex items-center justify-end gap-2">
                    <button
                      onClick={() => handleTogglePromoStatus(promo.code)}
                      className={`text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded transition-colors ${
                        promo.isActive
                          ? "bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                          : "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600"
                      }`}
                    >
                      {promo.isActive ? "Disable" : "Enable"}
                    </button>
                    <button
                      onClick={() => handleDeletePromo(promo.code)}
                      className="text-zinc-400 hover:text-red-500 p-1 transition-colors"
                      title="Delete Campaign"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
