"use client";

import React from "react";
import { 
  DollarSign, 
  Store, 
  Users, 
  TrendingUp, 
  TrendingDown, 
  ShoppingBag,
  ArrowRight,
  PlusCircle,
  FileText,
  Clock,
  Sparkles
} from "lucide-react";
import { loadDb } from "../data/mockData";

interface OverviewProps {
  db: ReturnType<typeof loadDb>;
  setActiveTab: (tab: string) => void;
  onApproveRestaurant: (id: string) => void;
}

export default function OverviewSection({
  db,
  setActiveTab,
  onApproveRestaurant
}: OverviewProps) {
  const { restaurants, customers, orders, settings } = db;

  // 1. Calculate stats
  const completedOrders = orders.filter(o => o.status === "Delivered");
  const activeOrdersCount = orders.filter(o => !["Delivered", "Cancelled"].includes(o.status)).length;
  
  // Total Gross Sales (subtotals of all non-cancelled orders)
  const nonCancelledOrders = orders.filter(o => o.status !== "Cancelled");
  const totalSales = nonCancelledOrders.reduce((sum, o) => sum + o.subtotal, 0);
  
  // Platform Commission Revenue (commission rate % of subtotal + service fees of completed orders)
  const totalCommission = completedOrders.reduce((sum, o) => {
    const comm = o.subtotal * (settings.commissionRate / 100);
    return sum + comm + o.serviceFee;
  }, 0);

  const pendingRestaurants = restaurants.filter(r => r.status === "Pending");

  // Mock charts data points (revenue per month in $)
  const monthlyRevenue = [
    { label: "Dec", val: 5400 },
    { label: "Jan", val: 7800 },
    { label: "Feb", val: 8900 },
    { label: "Mar", val: 11200 },
    { label: "Apr", val: 14500 },
    { label: "May", val: totalSales }
  ];

  const maxChartVal = Math.max(...monthlyRevenue.map(m => m.val)) * 1.15;

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Banner / Intro */}
      <div className="bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-900 rounded-2xl p-6 border border-zinc-700/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative overflow-hidden shadow-xl">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-radial-gradient from-orange-500/10 to-transparent pointer-events-none" />
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="bg-orange-500/20 text-orange-400 border border-orange-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> Operations Active
            </span>
          </div>
          <h3 className="text-xl font-bold text-white tracking-tight">Nowlny Delivery Hub Portal</h3>
          <p className="text-xs text-zinc-400 max-w-lg leading-relaxed">
            Welcome back! You are viewing real-time operations for both Customer and Restaurant platforms. 
            Review pending merchant contracts, track live drivers, and inspect active customer baskets.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button 
            onClick={() => setActiveTab("orders")}
            className="flex items-center gap-2 text-xs font-bold bg-orange-500 hover:bg-orange-600 active:scale-95 transition-all text-white px-4 py-2.5 rounded-lg shadow-lg shadow-orange-500/20"
          >
            <span>Live Order Room</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Sales Card */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl shadow-sm hover:shadow-md transition-all duration-200 group">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 tracking-wide uppercase">Gross Merchandise Value (GMV)</p>
              <h4 className="text-2xl font-black text-zinc-900 dark:text-white mt-2">${totalSales.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h4>
            </div>
            <div className="p-3 bg-orange-500/10 text-orange-600 dark:text-orange-400 rounded-xl">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-center gap-1.5 mt-4 text-xs font-bold text-emerald-600 dark:text-emerald-400">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>+14.2%</span>
            <span className="text-zinc-400 font-medium ml-1">vs. last month</span>
          </div>
        </div>

        {/* Commissions Card */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl shadow-sm hover:shadow-md transition-all duration-200 group">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 tracking-wide uppercase">Platform Net Earnings</p>
              <h4 className="text-2xl font-black text-zinc-900 dark:text-white mt-2">${totalCommission.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h4>
            </div>
            <div className="p-3 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-center gap-1.5 mt-4 text-xs font-bold text-emerald-600 dark:text-emerald-400">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>+18.5%</span>
            <span className="text-zinc-400 font-medium ml-1">commission + fees</span>
          </div>
        </div>

        {/* Orders Card */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl shadow-sm hover:shadow-md transition-all duration-200 group">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 tracking-wide uppercase">Total Volume</p>
              <h4 className="text-2xl font-black text-zinc-900 dark:text-white mt-2">{orders.length} Orders</h4>
            </div>
            <div className="p-3 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl">
              <ShoppingBag className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-center gap-2 mt-4 text-xs font-bold">
            <span className="text-orange-500 bg-orange-500/10 px-2 py-0.5 rounded-full">{activeOrdersCount} Live</span>
            <span className="text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full">{completedOrders.length} Filled</span>
          </div>
        </div>

      </div>

      {/* Charts & Graphs Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart Column (2/3 width) */}
        <div className="lg:col-span-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h4 className="text-sm font-bold text-zinc-900 dark:text-white">Gross Sales Growth Trend</h4>
              <p className="text-[11px] text-zinc-400">Monthly GMV ($) metrics compiled automatically</p>
            </div>
            <span className="text-xs font-bold text-orange-500 bg-orange-500/10 px-2.5 py-1 rounded-lg">Real-time Sync</span>
          </div>

          {/* SVG Custom Premium Chart */}
          <div className="h-64 relative w-full pt-4">
            <svg className="w-full h-full" viewBox="0 0 600 220" preserveAspectRatio="none">
              <defs>
                <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f97316" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#f97316" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Grid Lines */}
              <line x1="40" y1="20" x2="580" y2="20" stroke="#f4f4f5" strokeWidth="1" strokeDasharray="4 4" className="dark:stroke-zinc-800" />
              <line x1="40" y1="70" x2="580" y2="70" stroke="#f4f4f5" strokeWidth="1" strokeDasharray="4 4" className="dark:stroke-zinc-800" />
              <line x1="40" y1="120" x2="580" y2="120" stroke="#f4f4f5" strokeWidth="1" strokeDasharray="4 4" className="dark:stroke-zinc-800" />
              <line x1="40" y1="170" x2="580" y2="170" stroke="#f4f4f5" strokeWidth="1" strokeDasharray="4 4" className="dark:stroke-zinc-800" />

              {/* Plot Coordinates & Curve Path */}
              {/* x goes from 40 to 580 (interval 108) */}
              {/* y goes from 170 (val = 0) to 20 (val = maxChartVal) */}
              {(() => {
                const getCoords = (idx: number, val: number) => {
                  const x = 50 + idx * 102;
                  const ratio = val / maxChartVal;
                  const y = 170 - ratio * 140;
                  return { x, y };
                };

                const pts = monthlyRevenue.map((m, i) => getCoords(i, m.val));
                
                // Construct smooth cubic bezier curve
                let pathD = `M ${pts[0].x} ${pts[0].y}`;
                for (let i = 0; i < pts.length - 1; i++) {
                  const p0 = pts[i];
                  const p1 = pts[i + 1];
                  const cpX1 = p0.x + 50;
                  const cpY1 = p0.y;
                  const cpX2 = p1.x - 50;
                  const cpY2 = p1.y;
                  pathD += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${p1.x} ${p1.y}`;
                }

                const areaD = `${pathD} L ${pts[pts.length - 1].x} 170 L ${pts[0].x} 170 Z`;

                return (
                  <>
                    {/* Area Under Curve */}
                    <path d={areaD} fill="url(#chartGrad)" />

                    {/* Main Line */}
                    <path d={pathD} fill="none" stroke="url(#lineGrad)" strokeWidth="3" strokeLinecap="round" />
                    
                    <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#f97316" />
                      <stop offset="100%" stopColor="#ef4444" />
                    </linearGradient>

                    {/* Dots & Labels */}
                    {pts.map((pt, i) => (
                      <g key={i} className="group/dot cursor-pointer">
                        <circle cx={pt.x} cy={pt.y} r="5" fill="#ffffff" stroke="#f97316" strokeWidth="3" className="transition-all duration-150 hover:r-7" />
                        <text x={pt.x} y={pt.y - 12} textAnchor="middle" fill="#f97316" className="text-[10px] font-black opacity-0 group-hover/dot:opacity-100 transition-opacity bg-zinc-950 p-1">
                          ${monthlyRevenue[i].val.toFixed(0)}
                        </text>
                      </g>
                    ))}
                  </>
                );
              })()}

              {/* X Axis Labels */}
              {monthlyRevenue.map((m, i) => (
                <text key={i} x={50 + i * 102} y="195" textAnchor="middle" fill="#71717a" className="text-[10px] font-semibold dark:fill-zinc-400">
                  {m.label}
                </text>
              ))}
            </svg>
          </div>
        </div>

        {/* Right Distribution Sidebar (1/3 width) */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm flex flex-col">
          <h4 className="text-sm font-bold text-zinc-900 dark:text-white mb-1">Cuisine Performance</h4>
          <p className="text-[11px] text-zinc-400 mb-6">Popular food segments by registered orders</p>

          <div className="flex-1 space-y-4">
            {[
              { name: "Burgers & Fast Food", share: 45, count: 242, color: "bg-orange-500" },
              { name: "Middle Eastern & Grills", share: 30, count: 165, color: "bg-red-500" },
              { name: "Italian & Pizza", share: 15, count: 88, color: "bg-amber-500" },
              { name: "Japanese & Sushi", share: 10, count: 52, color: "bg-blue-500" }
            ].map((cuisine, idx) => (
              <div key={idx} className="space-y-1.5">
                <div className="flex justify-between items-center text-xs font-semibold">
                  <span className="text-zinc-800 dark:text-zinc-200">{cuisine.name}</span>
                  <span className="text-zinc-500 dark:text-zinc-400">{cuisine.share}% ({cuisine.count})</span>
                </div>
                <div className="w-full bg-zinc-100 dark:bg-zinc-800 h-2 rounded-full overflow-hidden">
                  <div 
                    className={`${cuisine.color} h-full rounded-full transition-all duration-500`}
                    style={{ width: `${cuisine.share}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          
          <div className="mt-6 pt-4 border-t border-zinc-100 dark:border-zinc-800 text-center">
            <button 
              onClick={() => setActiveTab("restaurants")}
              className="text-xs font-bold text-orange-500 hover:text-orange-600 transition-colors inline-flex items-center gap-1"
            >
              <span>Manage all active cuisines</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Operational Task Center */}
      <div className="grid grid-cols-1 gap-6">
        {/* Left Column: Pending Approvals */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h4 className="text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-2">
              <Store className="w-4 h-4 text-orange-500" /> Merchant Verification Queue
            </h4>
            <span className="text-[10px] font-bold bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded border border-amber-500/20">
              {pendingRestaurants.length} Pending
            </span>
          </div>

          <div className="space-y-3">
            {pendingRestaurants.length === 0 ? (
              <div className="text-center py-8 text-zinc-400 text-xs font-medium">
                No restaurants waiting in the queue! All approved.
              </div>
            ) : (
              pendingRestaurants.map((rest) => (
                <div key={rest.id} className="flex items-center justify-between p-3.5 rounded-xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl p-1 bg-white dark:bg-zinc-800 rounded-xl shadow-sm">{rest.logo}</span>
                    <div>
                      <h5 className="text-xs font-bold text-zinc-900 dark:text-white">{rest.name}</h5>
                      <p className="text-[10px] text-zinc-400 mt-0.5">{rest.cuisine} • {rest.address}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setActiveTab("restaurants")}
                      className="text-[10px] font-bold bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 px-2.5 py-1.5 rounded-lg transition-all"
                    >
                      Inspect docs
                    </button>
                    <button
                      onClick={() => onApproveRestaurant(rest.id)}
                      className="text-[10px] font-bold bg-gradient-to-r from-orange-500 to-red-500 hover:opacity-95 text-white px-2.5 py-1.5 rounded-lg shadow shadow-orange-500/10"
                    >
                      Approve
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
