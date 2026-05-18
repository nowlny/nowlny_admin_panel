"use client";

import React, { useState } from "react";
import { 
  BarChart3, 
  Download, 
  DollarSign, 
  TrendingUp, 
  ShoppingBag, 
  Store, 
  ChevronRight, 
  FileSpreadsheet, 
  FileText,
  Clock,
  Sparkles,
  Inbox
} from "lucide-react";
import { loadDb } from "../data/mockData";

interface ReportsSectionProps {
  db: ReturnType<typeof loadDb>;
  searchQuery: string;
}

export default function ReportsSection({
  db,
  searchQuery
}: ReportsSectionProps) {
  const { restaurants, orders, settings } = db;
  const [isExporting, setIsExporting] = useState<string | null>(null);

  const completedOrders = orders.filter(o => o.status === "Delivered");
  
  // Calculate financial details
  const totalGmv = completedOrders.reduce((sum, o) => sum + o.subtotal, 0);
  const totalDeliveryFees = completedOrders.reduce((sum, o) => sum + o.deliveryFee, 0);
  const totalServiceFees = completedOrders.reduce((sum, o) => sum + o.serviceFee, 0);
  
  const platformCommissionRate = settings.commissionRate / 100;
  const platformCommissions = totalGmv * platformCommissionRate;
  
  const driverShareRatio = settings.driverShare / 100;
  const totalDriverPayouts = totalDeliveryFees * driverShareRatio;
  
  const totalRestaurantPayouts = totalGmv - platformCommissions + (totalDeliveryFees * (1 - driverShareRatio));
  const totalPlatformNetIncome = platformCommissions + totalServiceFees;

  // Filter restaurants by search query for table
  const filteredRestaurants = restaurants.filter(r => 
    r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.cuisine.toLowerCase().includes(searchQuery.toLowerCase())
  ).sort((a,b) => b.revenue - a.revenue);

  // Trigger mock exports
  const triggerExport = (type: 'csv' | 'pdf') => {
    setIsExporting(type);
    setTimeout(() => {
      setIsExporting(null);
      alert(`Success! Operational financial audit ledger downloaded to Hassan's Desktop as a simulated ${type === 'csv' ? 'CSV Sheet' : 'PDF Document'}.`);
    }, 2000);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Financial Ledger grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl shadow-sm">
          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide">Gross GMV (Delivered)</p>
          <h4 className="text-xl font-black text-zinc-900 dark:text-white mt-1">
            ${totalGmv.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </h4>
          <p className="text-[9px] text-zinc-400 mt-2">Value of successfully completed food baskets</p>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl shadow-sm">
          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide">Platform Net Earnings</p>
          <h4 className="text-xl font-black text-emerald-500 mt-1">
            ${totalPlatformNetIncome.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </h4>
          <p className="text-[9px] text-emerald-500 font-semibold mt-2">Service fees + {settings.commissionRate}% Merchant commission</p>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl shadow-sm">
          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide">Merchant Net Payouts</p>
          <h4 className="text-xl font-black text-zinc-900 dark:text-white mt-1">
            ${totalRestaurantPayouts.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </h4>
          <p className="text-[9px] text-zinc-400 mt-2">Sent directly to restaurant banking accounts</p>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl shadow-sm">
          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide">Courier Net Payouts</p>
          <h4 className="text-xl font-black text-zinc-900 dark:text-white mt-1">
            ${totalDriverPayouts.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </h4>
          <p className="text-[9px] text-zinc-400 mt-2">{settings.driverShare}% split of operational delivery fees</p>
        </div>
      </div>

      {/* Export & Filters Header */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-2xl shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h4 className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider">Financial Audit Center</h4>
          <p className="text-[11px] text-zinc-400">Download audited statements and evaluate partner growth indexes</p>
        </div>

        <div className="flex gap-2 w-full sm:w-auto">
          <button
            onClick={() => triggerExport('csv')}
            disabled={isExporting !== null}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 text-xs font-bold text-zinc-700 bg-zinc-50 border border-zinc-200 hover:bg-zinc-100 px-3.5 py-2 rounded-xl transition-all disabled:opacity-50 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
            <span>{isExporting === 'csv' ? "Compiling..." : "Export CSV Sheets"}</span>
          </button>
          
          <button
            onClick={() => triggerExport('pdf')}
            disabled={isExporting !== null}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 text-xs font-bold text-zinc-700 bg-zinc-50 border border-zinc-200 hover:bg-zinc-100 px-3.5 py-2 rounded-xl transition-all disabled:opacity-50 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700"
          >
            <FileText className="w-4 h-4 text-red-500" />
            <span>{isExporting === 'pdf' ? "Compiling..." : "Download Audit PDF"}</span>
          </button>
        </div>
      </div>

      {/* Grid: SVG Bar Chart Comparison + Detail Partner Table */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Side: SVG Performance Chart (1/3 width) */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl shadow-sm flex flex-col justify-between">
          <div>
            <h4 className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider mb-1">Partner Revenue Share</h4>
            <p className="text-[11px] text-zinc-400 mb-6">Gross sales rankings compared against our system database</p>

            {/* SVG Horizontal Bar Chart */}
            <div className="space-y-4">
              {filteredRestaurants.slice(0, 4).map((rest, idx) => {
                const maxRev = filteredRestaurants[0]?.revenue || 1;
                const pct = (rest.revenue / maxRev) * 100;
                return (
                  <div key={rest.id} className="space-y-1.5">
                    <div className="flex justify-between items-center text-[10px] font-semibold">
                      <span className="text-zinc-800 dark:text-zinc-200">{rest.name}</span>
                      <span className="font-extrabold text-zinc-900 dark:text-white">${rest.revenue.toFixed(0)}</span>
                    </div>
                    <div className="w-full bg-zinc-100 dark:bg-zinc-800 h-2.5 rounded-full overflow-hidden">
                      <div 
                        className="bg-gradient-to-r from-orange-500 to-red-500 h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          
          <div className="border-t border-zinc-100 dark:border-zinc-800 pt-4 mt-6 text-center">
            <span className="text-[10px] text-zinc-400 inline-flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Platform performance ranking active
            </span>
          </div>
        </div>

        {/* Right Side: Ledger Table (2/3 width) */}
        <div className="lg:col-span-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm flex flex-col justify-between">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50 dark:bg-zinc-800/40 text-zinc-400 uppercase text-[9px] font-bold tracking-wider border-b border-zinc-100 dark:border-zinc-800">
                <tr>
                  <th className="p-4 font-black">Merchant Partner</th>
                  <th className="p-4 font-black">Orders Filled</th>
                  <th className="p-4 font-black">Gross Revenue</th>
                  <th className="p-4 font-black">Net Payouts</th>
                  <th className="p-4 font-black">Commissions Generated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {filteredRestaurants.map(rest => {
                  const comm = rest.revenue * platformCommissionRate;
                  const pay = rest.revenue - comm;
                  return (
                    <tr key={rest.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/20 transition-colors">
                      <td className="p-4 font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                        <span className="text-xl">{rest.logo}</span>
                        <span>{rest.name}</span>
                      </td>
                      <td className="p-4 font-semibold text-zinc-600 dark:text-zinc-400">
                        {rest.ordersCount} orders
                      </td>
                      <td className="p-4 font-black text-zinc-950 dark:text-white">
                        ${rest.revenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-4 text-emerald-500 font-bold">
                        ${pay.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-4 text-orange-500 font-bold">
                        ${comm.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Export Loader Overlay */}
      {isExporting !== null && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-8 rounded-2xl shadow-2xl flex flex-col items-center justify-center space-y-4 max-w-sm w-full text-center">
            <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
            <div>
              <h4 className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider">Securing Financial Records</h4>
              <p className="text-[11px] text-zinc-400 mt-1">Generating transactional CSV & encryption keys. Please hold...</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
