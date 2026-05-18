"use client";

import React, { useState } from "react";
import { 
  ShoppingBag, 
  Search, 
  Clock, 
  MapPin, 
  User, 
  Store, 
  Bike, 
  DollarSign, 
  CheckCircle2, 
  Play, 
  Check, 
  X, 
  AlertTriangle,
  ArrowRight,
  TrendingUp
} from "lucide-react";
import { Order, Driver, loadDb } from "../data/mockData";

interface OrdersSectionProps {
  db: ReturnType<typeof loadDb>;
  onUpdateOrder: (updatedOrder: Order) => void;
  searchQuery: string;
}

export default function OrdersSection({
  db,
  onUpdateOrder,
  searchQuery
}: OrdersSectionProps) {
  const { orders, drivers } = db;
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<'live' | 'archive'>('live');
  const [selectedMobileLane, setSelectedMobileLane] = useState(0);

  const selectedOrder = orders.find(o => o.id === selectedOrderId);
  const onlineDrivers = drivers.filter(d => d.status === "Online" && d.verificationStatus === "Verified");

  // Filter orders
  const filteredOrders = orders.filter(o => {
    const matchesSearch = o.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.restaurantName.toLowerCase().includes(searchQuery.toLowerCase());

    const isLive = !["Delivered", "Cancelled"].includes(o.status);
    const matchesTab = activeSubTab === 'live' ? isLive : !isLive;

    return matchesSearch && matchesTab;
  });

  // Action methods to progress order state
  const handleProgressOrder = (order: Order, nextStatus: Order['status'], driverToAssign?: Driver) => {
    const timestamp = new Date().toISOString();
    
    const timelineEntry = {
      status: nextStatus,
      timestamp,
      note: nextStatus === 'Accepted' ? 'Order accepted and sent to kitchen.' :
            nextStatus === 'Preparing' ? 'Kitchen is preparing your meals.' :
            nextStatus === 'OutForDelivery' ? `Dispatched out with rider ${driverToAssign?.name || order.driverName || 'fleet'}.` :
            nextStatus === 'Delivered' ? 'Rider confirmed delivery completed successfully.' :
            'Administrative status override.'
    };

    let updated: Order = {
      ...order,
      status: nextStatus,
      timeline: [...order.timeline, timelineEntry]
    };

    if (nextStatus === 'OutForDelivery' && driverToAssign) {
      updated.driverId = driverToAssign.id;
      updated.driverName = driverToAssign.name;
    }

    if (nextStatus === 'Delivered') {
      updated.paymentStatus = 'Paid';
    }

    onUpdateOrder(updated);
  };

  const handleCancelOrder = (order: Order) => {
    if (!confirm(`Cancel order ${order.id} and issue full refund?`)) return;

    const timestamp = new Date().toISOString();
    const updated: Order = {
      ...order,
      status: "Cancelled",
      paymentStatus: "Refunded",
      timeline: [
        ...order.timeline, 
        { status: "Cancelled", timestamp, note: "Order cancelled by administrator." }
      ]
    };
    onUpdateOrder(updated);
  };

  const lanes = [
    { title: "Incoming", statusKey: ["Pending"] as Order['status'][], color: "border-amber-400", badgeCount: orders.filter(o => o.status === "Pending").length },
    { title: "Cooking", statusKey: ["Accepted", "Preparing"] as Order['status'][], color: "border-orange-500", badgeCount: orders.filter(o => ["Accepted", "Preparing"].includes(o.status)).length },
    { title: "Out for Delivery", statusKey: ["OutForDelivery"] as Order['status'][], color: "border-blue-500", badgeCount: orders.filter(o => o.status === "OutForDelivery").length },
    { title: "Done", statusKey: ["Delivered", "Cancelled"] as Order['status'][], color: "border-zinc-300", badgeCount: orders.filter(o => ["Delivered", "Cancelled"].includes(o.status)).length }
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Search & Tab Selection */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-2xl shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        {/* Live vs Archive Tab Buttons */}
        <div className="flex items-center gap-1.5 bg-zinc-50 dark:bg-zinc-800 p-1 rounded-xl border border-zinc-200/60 dark:border-zinc-700/80">
          <button
            onClick={() => setActiveSubTab('live')}
            className={`text-xs font-bold px-4 py-2 rounded-lg transition-all duration-200 flex items-center gap-1.5 ${
              activeSubTab === 'live' 
                ? "bg-white dark:bg-zinc-900 text-orange-500 shadow-sm border border-zinc-200/30" 
                : "text-zinc-500 hover:text-zinc-950 dark:hover:text-white"
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
            <span>Live Dispatch Room</span>
            <span className="bg-red-500/10 text-red-500 px-1.5 py-0.5 text-[9px] rounded-full font-black">
              {orders.filter(o => !["Delivered", "Cancelled"].includes(o.status)).length}
            </span>
          </button>
          
          <button
            onClick={() => setActiveSubTab('archive')}
            className={`text-xs font-bold px-4 py-2 rounded-lg transition-all duration-200 ${
              activeSubTab === 'archive' 
                ? "bg-white dark:bg-zinc-900 text-orange-500 shadow-sm border border-zinc-200/30" 
                : "text-zinc-500 hover:text-zinc-950 dark:hover:text-white"
            }`}
          >
            <span>Archived History</span>
          </button>
        </div>

        <span className="text-xs font-semibold text-zinc-500">
          Showing {filteredOrders.length} transactions
        </span>
      </div>

      {/* Main Order Workspace */}
      {filteredOrders.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-12 text-center rounded-2xl flex flex-col items-center justify-center">
          <ShoppingBag className="w-12 h-12 text-zinc-300 dark:text-zinc-700 mb-3" />
          <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">No orders cataloged</p>
          <p className="text-xs text-zinc-400 mt-1">Ready for incoming transactions...</p>
        </div>
      ) : activeSubTab === 'live' ? (
        /* KANBAN BOARD FOR LIVE DISPATCH */
        <div className="space-y-4">
          {/* Mobile swipeable Tab switcher header */}
          <div className="flex lg:hidden items-center gap-2 overflow-x-auto pb-2.5 scrollbar-none border-b border-zinc-100 dark:border-zinc-800">
            {lanes.map((lane, idx) => (
              <button
                key={idx}
                onClick={() => setSelectedMobileLane(idx)}
                className={`text-[10px] font-bold px-3.5 py-2.5 rounded-xl whitespace-nowrap transition-all flex items-center gap-1.5 border shrink-0 ${
                  selectedMobileLane === idx
                    ? "bg-orange-500 border-orange-500 text-white shadow-sm shadow-orange-500/10"
                    : "bg-white border-zinc-200 text-zinc-500 dark:bg-zinc-950 dark:border-zinc-800 dark:text-zinc-400"
                }`}
              >
                <span>{lane.title}</span>
                <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-full ${
                  selectedMobileLane === idx
                    ? "bg-white text-orange-500"
                    : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500"
                }`}>
                  {lane.badgeCount}
                </span>
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Columns configuration */}
            {lanes.map((col, idx) => {
              const colOrders = orders.filter(o => col.statusKey.includes(o.status));
              return (
                <div 
                  key={idx} 
                  className={`flex flex-col space-y-4 ${
                    selectedMobileLane === idx ? "flex animate-in fade-in duration-150" : "hidden lg:flex"
                  }`}
                >
                  {/* Column header */}
                  <div className={`p-3 border-b-2 ${col.color} bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl flex justify-between items-center shadow-sm`}>
                    <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">{col.title}</span>
                    <span className="bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-[10px] font-black rounded text-zinc-500 dark:text-zinc-400">{colOrders.length}</span>
                  </div>

                  {/* Column cards container */}
                  <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
                    {colOrders.length === 0 ? (
                      <div className="p-8 text-center text-zinc-400 text-[10px] italic border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl">
                        Empty Lane
                      </div>
                    ) : (
                      colOrders.map(order => (
                        <div
                          key={order.id}
                          onClick={() => setSelectedOrderId(order.id)}
                          className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl shadow-sm hover:border-orange-500/30 hover:shadow transition-all duration-200 cursor-pointer space-y-3"
                        >
                          <div className="flex justify-between items-start gap-1">
                            <span className="text-xs font-black text-zinc-950 dark:text-white">{order.id}</span>
                            <span className="text-[10px] font-black text-orange-500">${order.total.toFixed(2)}</span>
                          </div>

                          <div className="space-y-1">
                            <p className="text-[10px] font-bold text-zinc-900 dark:text-zinc-200 flex items-center gap-1.5">
                              <Store className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                              <span className="truncate">{order.restaurantName}</span>
                            </p>
                            <p className="text-[10px] text-zinc-400 flex items-center gap-1.5">
                              <User className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                              <span className="truncate">{order.customerName}</span>
                            </p>
                          </div>

                          <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 flex justify-between items-center text-[9px] text-zinc-400">
                            <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            <span className={`px-1.5 py-0.5 rounded font-black uppercase tracking-wider ${
                              order.status === "Pending" ? "bg-amber-500/10 text-amber-600 animate-pulse" :
                              order.status === "OutForDelivery" ? "bg-blue-500/10 text-blue-600" :
                              "bg-orange-500/10 text-orange-600"
                            }`}>{order.status}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* ARCHIVE LIST TABLE */
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50 dark:bg-zinc-800/40 text-zinc-400 uppercase text-[9px] font-bold tracking-wider border-b border-zinc-100 dark:border-zinc-800">
                <tr>
                  <th className="p-4 font-black">Order ID</th>
                  <th className="p-4 font-black">Restaurant</th>
                  <th className="p-4 font-black">Customer</th>
                  <th className="p-4 font-black">Total</th>
                  <th className="p-4 font-black">Payment Status</th>
                  <th className="p-4 font-black">Lifecycle Status</th>
                  <th className="p-4 font-black text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {filteredOrders.map(order => (
                  <tr key={order.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/20 transition-colors">
                    <td className="p-4 font-black text-zinc-900 dark:text-white">{order.id}</td>
                    <td className="p-4 font-bold text-zinc-700 dark:text-zinc-300">{order.restaurantName}</td>
                    <td className="p-4 text-zinc-500 dark:text-zinc-400">{order.customerName}</td>
                    <td className="p-4 font-black text-zinc-950 dark:text-white">${order.total.toFixed(2)}</td>
                    <td className="p-4">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-black tracking-wide ${
                        order.paymentStatus === 'Paid' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'
                      }`}>{order.paymentStatus}</span>
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-black tracking-wide ${
                        order.status === 'Delivered' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-zinc-500/10 text-zinc-500'
                      }`}>{order.status}</span>
                    </td>
                    <td className="p-4 text-right">
                      <button
                        onClick={() => setSelectedOrderId(order.id)}
                        className="text-orange-500 font-bold hover:underline"
                      >
                        Inspect details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Interactive Detail Drawer */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="p-5 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center bg-zinc-50 dark:bg-zinc-900/40">
              <div className="flex items-center gap-3">
                <span className="p-2.5 bg-orange-500/10 text-orange-500 rounded-xl">
                  <ShoppingBag className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                    Order Detail Breakdown <span className="text-[10px] bg-orange-500 text-white px-2 py-0.5 rounded font-black">{selectedOrder.id}</span>
                  </h3>
                  <p className="text-[10px] text-zinc-400">Placed on {new Date(selectedOrder.createdAt).toLocaleDateString()} at {new Date(selectedOrder.createdAt).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedOrderId(null)}
                className="text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content Body (Scrollable) */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              {/* Status workflow banner */}
              <div className="p-4 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-zinc-50 dark:bg-zinc-900/30 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide">Current Status</p>
                  <p className="text-xs font-black text-orange-500 flex items-center gap-1.5 mt-0.5">
                    <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse shrink-0"></span>
                    <span className="capitalize">{selectedOrder.status}</span>
                  </p>
                </div>

                {/* WORKFLOW DISPATCH CONTROLS */}
                <div className="flex gap-2 w-full sm:w-auto shrink-0 flex-wrap">
                  {selectedOrder.status === 'Pending' && (
                    <>
                      <button
                        onClick={() => handleProgressOrder(selectedOrder, 'Accepted')}
                        className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-[10px] px-3.5 py-2 rounded-lg flex items-center gap-1 transition-all"
                      >
                        <Check className="w-3.5 h-3.5" /> Accept Order
                      </button>
                      <button
                        onClick={() => handleCancelOrder(selectedOrder)}
                        className="bg-zinc-100 hover:bg-red-500 hover:text-white text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 font-bold text-[10px] px-3.5 py-2 rounded-lg transition-all"
                      >
                        Cancel
                      </button>
                    </>
                  )}

                  {selectedOrder.status === 'Accepted' && (
                    <button
                      onClick={() => handleProgressOrder(selectedOrder, 'Preparing')}
                      className="bg-orange-500 hover:bg-orange-600 text-white font-bold text-[10px] px-3.5 py-2 rounded-lg flex items-center gap-1 transition-all"
                    >
                      <Play className="w-3.5 h-3.5" /> Begin Cooking
                    </button>
                  )}

                  {selectedOrder.status === 'Preparing' && (
                    <div className="flex items-center gap-2">
                      <select
                        onChange={(e) => {
                          const drv = onlineDrivers.find(d => d.id === e.target.value);
                          if (drv) {
                            handleProgressOrder(selectedOrder, 'OutForDelivery', drv);
                          }
                        }}
                        defaultValue=""
                        className="bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-[10px] font-bold p-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-500 cursor-pointer"
                      >
                        <option value="" disabled>Assign Courier...</option>
                        {onlineDrivers.map(drv => (
                          <option key={drv.id} value={drv.id}>🏍️ {drv.name} ({drv.vehicleType})</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {selectedOrder.status === 'OutForDelivery' && (
                    <button
                      onClick={() => handleProgressOrder(selectedOrder, 'Delivered')}
                      className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-[10px] px-3.5 py-2 rounded-lg flex items-center gap-1 transition-all"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> Mark Delivered
                    </button>
                  )}

                  {/* Cancel fallback for active prep */}
                  {!["Delivered", "Cancelled"].includes(selectedOrder.status) && selectedOrder.status !== "Pending" && (
                    <button
                      onClick={() => handleCancelOrder(selectedOrder)}
                      className="text-[10px] text-zinc-400 hover:text-red-500 font-bold pl-2 border-l border-zinc-200 dark:border-zinc-800"
                    >
                      Cancel Order
                    </button>
                  )}
                </div>
              </div>

              {/* Items Breakdown list */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider">Basket Breakdown</h4>
                
                <div className="border border-zinc-100 dark:border-zinc-800 rounded-xl divide-y divide-zinc-100 dark:divide-zinc-800 overflow-hidden">
                  {selectedOrder.items.map((item, idx) => (
                    <div key={idx} className="p-3.5 flex justify-between items-center text-xs bg-white dark:bg-zinc-900">
                      <div>
                        <p className="font-bold text-zinc-800 dark:text-zinc-200">{item.name}</p>
                        <p className="text-[10px] text-zinc-400 mt-0.5">Quantity: {item.quantity} • Unit Price: ${item.price.toFixed(2)}</p>
                      </div>
                      <span className="font-extrabold text-zinc-900 dark:text-white">${(item.price * item.quantity).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Billing Summary & Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Billing Summary */}
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider">Billing Invoice</h4>
                  
                  <div className="p-4 rounded-xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/20 text-xs space-y-2.5 text-zinc-500 dark:text-zinc-400">
                    <div className="flex justify-between">
                      <span>Subtotal</span>
                      <span className="font-semibold text-zinc-800 dark:text-zinc-200">${selectedOrder.subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Delivery Fee</span>
                      <span className="font-semibold text-zinc-800 dark:text-zinc-200">${selectedOrder.deliveryFee.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Service Fee</span>
                      <span className="font-semibold text-zinc-800 dark:text-zinc-200">${selectedOrder.serviceFee.toFixed(2)}</span>
                    </div>
                    {selectedOrder.discount > 0 && (
                      <div className="flex justify-between text-red-500 font-semibold">
                        <span>Campaign Discount</span>
                        <span>-${selectedOrder.discount.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between pt-2.5 border-t border-zinc-200 dark:border-zinc-700 text-sm font-black text-zinc-900 dark:text-white">
                      <span>Total Invoice</span>
                      <span className="text-orange-500">${selectedOrder.total.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* Logistic participants info */}
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider">Logistic Dispatch Participants</h4>
                  
                  <div className="space-y-3.5 text-xs text-zinc-500 dark:text-zinc-400">
                    {/* Customer info */}
                    <div className="flex gap-2.5 p-3 rounded-xl border border-zinc-100 dark:border-zinc-800/80 bg-zinc-50/20">
                      <User className="w-5 h-5 text-orange-500 shrink-0" />
                      <div>
                        <p className="font-bold text-zinc-800 dark:text-zinc-200">{selectedOrder.customerName}</p>
                        <p className="text-[10px] text-zinc-400 mt-0.5 truncate max-w-[200px]"> হামরা মেন স্ট্রিট, বৈরুত</p>
                      </div>
                    </div>

                    {/* Restaurant info */}
                    <div className="flex gap-2.5 p-3 rounded-xl border border-zinc-100 dark:border-zinc-800/80 bg-zinc-50/20">
                      <Store className="w-5 h-5 text-orange-500 shrink-0" />
                      <div>
                        <p className="font-bold text-zinc-800 dark:text-zinc-200">{selectedOrder.restaurantName}</p>
                        <p className="text-[10px] text-zinc-400 mt-0.5">Merchant contract partner</p>
                      </div>
                    </div>

                    {/* Driver info */}
                    <div className="flex gap-2.5 p-3 rounded-xl border border-zinc-100 dark:border-zinc-800/80 bg-zinc-50/20">
                      <Bike className="w-5 h-5 text-orange-500 shrink-0" />
                      <div>
                        <p className="font-bold text-zinc-800 dark:text-zinc-200">{selectedOrder.driverName || "Waiting for dispatch Assignment"}</p>
                        <p className="text-[10px] text-zinc-400 mt-0.5">{selectedOrder.driverId ? "On-trip tracking active" : "Pending pickup assign"}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Order Timeline events logs */}
              <div className="space-y-4 border-t border-zinc-100 dark:border-zinc-800 pt-5">
                <h4 className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider">Order Timeline Audit Logs</h4>
                
                <div className="space-y-4 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-[1px] before:bg-zinc-200 dark:before:bg-zinc-800">
                  {selectedOrder.timeline.map((event, idx) => (
                    <div key={idx} className="flex gap-4 relative">
                      <div className="w-6 h-6 rounded-full bg-zinc-50 dark:bg-zinc-800 border-2 border-zinc-300 dark:border-zinc-700 flex items-center justify-center shrink-0 z-10">
                        <div className="w-1.5 h-1.5 rounded-full bg-orange-500"></div>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-zinc-900 dark:text-white capitalize">{event.status}</p>
                        <p className="text-[10px] text-zinc-400 mt-0.5">{new Date(event.timestamp).toLocaleTimeString()}</p>
                        {event.note && (
                          <p className="text-[10px] text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800/20 p-2 rounded-lg border border-zinc-100 mt-1.5 leading-relaxed">{event.note}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
