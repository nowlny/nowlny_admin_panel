"use client";

import React, { useState } from "react";
import { 
  Bike, 
  Search, 
  Star, 
  DollarSign, 
  ShoppingBag, 
  MapPin, 
  Navigation,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  User,
  Mail,
  Phone,
  ArrowRight,
  TrendingUp,
  Map,
  Compass
} from "lucide-react";
import { Driver, loadDb } from "../data/mockData";

interface DriversSectionProps {
  db: ReturnType<typeof loadDb>;
  onUpdateDriver: (updatedDriver: Driver) => void;
  searchQuery: string;
}

export default function DriversSection({
  db,
  onUpdateDriver,
  searchQuery
}: DriversSectionProps) {
  const { drivers, orders } = db;
  const [selectedSubTab, setSelectedSubTab] = useState<'registry' | 'map'>('registry');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Online' | 'Offline' | 'Suspended'>('All');
  
  // Filter drivers
  const filteredDrivers = drivers.filter(d => {
    const matchesSearch = d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.phone.toLowerCase().includes(searchQuery.toLowerCase());
      
    const matchesStatus = statusFilter === 'All' || d.status === statusFilter;
    const matchesVerification = d.verificationStatus === 'Verified'; // Only verified in main listing
    
    return matchesSearch && matchesStatus && matchesVerification;
  });

  const pendingDrivers = drivers.filter(d => d.verificationStatus === 'Pending');

  const handleApproveDriver = (drv: Driver) => {
    const updated = { ...drv, verificationStatus: 'Verified' as const, status: 'Offline' as const };
    onUpdateDriver(updated);
  };

  const handleToggleStatus = (drv: Driver) => {
    const nextStatus = drv.status === 'Suspended' ? 'Offline' : 'Suspended';
    if (!confirm(`Are you sure you want to ${nextStatus === 'Suspended' ? 'suspend' : 'reinstate'} driver ${drv.name}?`)) return;

    const updated = { ...drv, status: nextStatus as 'Offline' | 'Suspended' };
    onUpdateDriver(updated);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Fleet KPI Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl shadow-sm">
          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide">Total Couriers</p>
          <p className="text-xl font-black text-zinc-900 dark:text-white mt-1">{drivers.filter(d => d.verificationStatus === 'Verified').length} Riders</p>
        </div>
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl shadow-sm">
          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide">Online Capacity</p>
          <p className="text-xl font-black text-emerald-500 mt-1">{drivers.filter(d => d.status === 'Online').length} Active</p>
        </div>
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl shadow-sm">
          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide">Gross Deliveries Paid</p>
          <p className="text-xl font-black text-zinc-900 dark:text-white mt-1">
            {drivers.reduce((s, d) => s + d.deliveriesCount, 0)} drops
          </p>
        </div>
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl shadow-sm">
          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide">Applications Desk</p>
          <p className={`text-xl font-black mt-1 ${pendingDrivers.length > 0 ? "text-amber-500 animate-pulse" : "text-zinc-500"}`}>
            {pendingDrivers.length} Pending
          </p>
        </div>
      </div>

      {/* Screen Selection Controls */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-2xl shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        {/* Navigation Tab buttons */}
        <div className="flex items-center gap-1.5 bg-zinc-50 dark:bg-zinc-800 p-1 rounded-xl border border-zinc-200/60 dark:border-zinc-700/80">
          <button
            onClick={() => setSelectedSubTab('registry')}
            className={`text-xs font-bold px-4 py-2 rounded-lg transition-all duration-200 flex items-center gap-1.5 ${
              selectedSubTab === 'registry' 
                ? "bg-white dark:bg-zinc-900 text-orange-500 shadow-sm border border-zinc-200/30" 
                : "text-zinc-500 hover:text-zinc-950 dark:hover:text-white"
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>Riders Registry</span>
          </button>
          
          <button
            onClick={() => setSelectedSubTab('map')}
            className={`text-xs font-bold px-4 py-2 rounded-lg transition-all duration-200 flex items-center gap-1.5 ${
              selectedSubTab === 'map' 
                ? "bg-white dark:bg-zinc-900 text-orange-500 shadow-sm border border-zinc-200/30" 
                : "text-zinc-500 hover:text-zinc-950 dark:hover:text-white"
            }`}
          >
            <Map className="w-3.5 h-3.5" />
            <span>Simulator Radar</span>
          </button>
        </div>

        {selectedSubTab === 'registry' && (
          <div className="flex items-center gap-1.5 bg-zinc-50 dark:bg-zinc-800 p-1 rounded-xl border border-zinc-200/60 dark:border-zinc-700/80">
            {(['All', 'Online', 'Offline', 'Suspended'] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => setStatusFilter(filter)}
                className={`text-[11px] font-bold px-3 py-1.5 rounded-lg transition-all ${
                  statusFilter === filter 
                    ? "bg-white dark:bg-zinc-900 text-orange-500 shadow-sm border border-zinc-200/30" 
                    : "text-zinc-500 hover:text-zinc-950 dark:hover:text-white"
                }`}
              >
                {filter}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Main Workspace split depending on Tab selection */}
      {selectedSubTab === 'registry' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Registry Directory (2/3 width) */}
          <div className="lg:col-span-2 space-y-6">
            {filteredDrivers.length === 0 ? (
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-12 text-center rounded-2xl flex flex-col items-center justify-center">
                <Bike className="w-12 h-12 text-zinc-300 dark:text-zinc-700 mb-3" />
                <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">No riders matched query</p>
                <p className="text-xs text-zinc-400 mt-1">Check search inputs or active filters</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {filteredDrivers.map((driver) => (
                  <div key={driver.id} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between">
                    <div>
                      {/* Card Header */}
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-3">
                          <span className="text-3xl p-1 bg-zinc-50 dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-100 dark:border-zinc-700">
                            {driver.avatar}
                          </span>
                          <div>
                            <h4 className="text-xs font-bold text-zinc-900 dark:text-white">{driver.name}</h4>
                            <p className="text-[9px] text-zinc-400 font-semibold mt-0.5">Vehicle: {driver.vehicleType} • Plate: {driver.vehiclePlate || "N/A"}</p>
                          </div>
                        </div>
                        
                        <span className={`text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded border ${
                          driver.status === 'Online' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' :
                          driver.status === 'Offline' ? 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20' :
                          'bg-red-500/10 text-red-500 border-red-500/20'
                        }`}>
                          {driver.status}
                        </span>
                      </div>

                      {/* Contact row */}
                      <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800 space-y-2 text-[10px] text-zinc-500 dark:text-zinc-400">
                        <div className="flex items-center gap-2">
                          <Mail className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                          <span>{driver.email}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Phone className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                          <span>{driver.phone}</span>
                        </div>
                      </div>
                    </div>

                    {/* Stats & Controls */}
                    <div className="mt-5 pt-3 border-t border-zinc-100 dark:border-zinc-800 flex justify-between items-center gap-4">
                      <div className="flex gap-4 text-center">
                        <div>
                          <p className="text-[9px] font-bold text-zinc-400 uppercase">Payout</p>
                          <p className="text-xs font-black text-zinc-900 dark:text-white mt-0.5">${driver.earnings.toFixed(0)}</p>
                        </div>
                        <div>
                          <p className="text-[9px] font-bold text-zinc-400 uppercase">Rating</p>
                          <p className="text-xs font-black text-zinc-900 dark:text-white mt-0.5 inline-flex items-center gap-0.5">
                            {driver.rating} <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={() => handleToggleStatus(driver)}
                        className={`text-[9px] font-black uppercase tracking-wider px-2.5 py-1.5 rounded-lg border transition-colors ${
                          driver.status === 'Suspended'
                            ? "border-emerald-200 text-emerald-600 bg-emerald-500/5 hover:bg-emerald-500/10"
                            : "border-red-200 text-red-600 bg-red-500/5 hover:bg-red-500/10"
                        }`}
                      >
                        {driver.status === 'Suspended' ? "Reinstate" : "Suspend"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right Hand Sidebar (1/3 width): Applications Queue */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm space-y-4">
            <h4 className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <Compass className="w-4 h-4 text-orange-500" /> Courier Onboarding Verification
            </h4>
            <p className="text-[11px] text-zinc-400">Review pending vehicle licenses and background checks</p>

            <div className="space-y-3.5 pt-2">
              {pendingDrivers.length === 0 ? (
                <div className="text-center py-8 text-zinc-400 text-xs italic">
                  Registry verification queue is empty.
                </div>
              ) : (
                pendingDrivers.map((driver) => (
                  <div key={driver.id} className="p-3.5 rounded-xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30 space-y-3">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl p-1 bg-white dark:bg-zinc-800 rounded-xl shadow-sm">{driver.avatar}</span>
                      <div>
                        <h5 className="text-xs font-bold text-zinc-900 dark:text-white">{driver.name}</h5>
                        <p className="text-[9px] text-zinc-400 mt-0.5">Applied: {driver.joinedDate}</p>
                      </div>
                    </div>
                    
                    <div className="p-2.5 rounded bg-zinc-100/50 dark:bg-zinc-800/60 border border-zinc-200/50 dark:border-zinc-700/50 text-[10px] text-zinc-500 dark:text-zinc-400 space-y-1">
                      <div className="flex justify-between">
                        <span>Vehicle Class</span>
                        <span className="font-bold text-zinc-800 dark:text-zinc-200">{driver.vehicleType}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Background Status</span>
                        <span className="font-bold text-emerald-600">Passed</span>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApproveDriver(driver)}
                        className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-[10px] py-1.5 rounded"
                      >
                        Approve License
                      </button>
                      <button
                        onClick={() => alert("Courier Application denied.")}
                        className="bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 font-bold text-[10px] px-3 py-1.5 rounded"
                      >
                        Deny
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : (
        /* LIVE RADAR SIMULATOR RADAR */
        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 shadow-xl relative overflow-hidden flex flex-col lg:flex-row gap-6">
          {/* SVG Map Screen (2/3 width) */}
          <div className="flex-1 min-h-[400px] bg-zinc-900 border border-zinc-800 rounded-xl relative overflow-hidden flex items-center justify-center">
            {/* Ambient Background Glows */}
            <div className="absolute inset-0 bg-[radial-gradient(#1e1e1e_1px,transparent_1px)] [background-size:16px_16px] opacity-35" />
            <div className="absolute top-1/4 left-1/4 w-40 h-40 rounded-full bg-orange-500/5 blur-3xl" />
            <div className="absolute bottom-1/4 right-1/4 w-40 h-40 rounded-full bg-blue-500/5 blur-3xl" />

            {/* Stylized Pure SVG Vector Map representing Beirut sectors */}
            <svg className="w-full h-full absolute inset-0 select-none" viewBox="0 0 500 350">
              {/* Major Sectors Outlines */}
              <path d="M 50 150 C 150 120, 250 100, 450 150 L 400 300 C 300 270, 200 250, 100 290 Z" fill="none" stroke="#27272a" strokeWidth="1.5" strokeDasharray="3 3" />
              
              {/* Main Arterial Highways */}
              <path id="hamra-highway" d="M 20 180 Q 250 170, 480 200" fill="none" stroke="#3f3f46" strokeWidth="3" strokeLinecap="round" />
              <path id="badaro-road" d="M 150 20 L 160 330" fill="none" stroke="#3f3f46" strokeWidth="2" strokeLinecap="round" />
              <path id="achrafieh-ave" d="M 380 40 Q 300 180, 390 320" fill="none" stroke="#3f3f46" strokeWidth="2" strokeLinecap="round" />

              {/* Major Static Landmarks (Hubs/Restaurants) */}
              {/* Hub 1: Hamra */}
              <circle cx="80" cy="180" r="4" fill="#f97316" className="animate-pulse" />
              <text x="80" y="195" textAnchor="middle" fill="#a1a1aa" className="text-[8px] font-black uppercase tracking-wider">Hamra Partner Area</text>

              {/* Hub 2: Mar Mikhael */}
              <circle cx="340" cy="120" r="4" fill="#ef4444" className="animate-pulse" />
              <text x="340" y="105" textAnchor="middle" fill="#a1a1aa" className="text-[8px] font-black uppercase tracking-wider">Mar Mikhael Hub</text>

              {/* Online Drivers Animated Pins */}
              {drivers.filter(d => d.status === "Online" && d.verificationStatus === "Verified").map((drv, idx) => {
                // Map logical latitudes/longitudes to SVG viewbox (approx coordinate translations)
                // Beirut Hamra is 33.8967, 35.4839. Let's make mock map coordinates
                const x = 50 + (idx * 110) + ((drv.longitude - 35.48) * 1200);
                const y = 80 + (idx * 70) - ((drv.latitude - 33.87) * 2000);

                return (
                  <g key={drv.id} className="cursor-pointer group/pin">
                    {/* Animated Pulsing Ring */}
                    <circle cx={x} cy={y} r="10" fill="none" stroke="#10b981" strokeWidth="1" className="animate-ping" />
                    <circle cx={x} cy={y} r="5" fill="#10b981" />
                    
                    {/* Tooltip Overlay on hover */}
                    <g className="opacity-0 group-hover/pin:opacity-100 transition-opacity duration-150">
                      <rect x={x - 45} y={y - 38} width="90" height="26" rx="4" fill="#18181b" stroke="#3f3f46" strokeWidth="1" />
                      <text x={x} y={y - 26} textAnchor="middle" fill="#ffffff" className="text-[8px] font-bold">{drv.name}</text>
                      <text x={x} y={y - 16} textAnchor="middle" fill="#10b981" className="text-[7px] font-semibold">{drv.status} ({drv.vehicleType})</text>
                    </g>

                    {/* Emoji Label badge */}
                    <text x={x + 8} y={y + 3} className="text-[12px]">{drv.avatar}</text>
                  </g>
                );
              })}
            </svg>
            
            {/* HUD Compass controls */}
            <div className="absolute bottom-4 left-4 bg-zinc-950/80 border border-zinc-800 p-2.5 rounded-lg text-white text-[9px] font-black tracking-widest flex items-center gap-1.5 select-none">
              <Navigation className="w-3.5 h-3.5 text-emerald-500 animate-spin duration-1000" />
              <span>LIVE SATELLITE HUD RADAR</span>
            </div>
          </div>

          {/* Radar details sidebar (1/3 width) */}
          <div className="lg:w-72 bg-zinc-900 border border-zinc-800 p-5 rounded-xl flex flex-col justify-between space-y-4">
            <div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">Online Fleet Tracking</h4>
              <p className="text-[10px] text-zinc-500 mt-1">Live updates of online driver operations on delivery trips</p>
              
              <div className="mt-4 space-y-3.5">
                {drivers.filter(d => d.status === "Online").map(drv => {
                  // Find if driver has an active order
                  const activeOrder = orders.find(o => o.driverId === drv.id && !["Delivered", "Cancelled"].includes(o.status));
                  return (
                    <div key={drv.id} className="p-3 border border-zinc-800 bg-zinc-950/50 rounded-xl flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{drv.avatar}</span>
                        <div>
                          <p className="text-xs font-bold text-white">{drv.name}</p>
                          <p className="text-[9px] text-emerald-400 mt-0.5 inline-flex items-center gap-1">
                            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                            Online
                          </p>
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <span className="text-[9px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded font-black uppercase">
                          {activeOrder ? "On Trip" : "Idle"}
                        </span>
                        {activeOrder && (
                          <p className="text-[8px] text-orange-500 font-bold mt-1">{activeOrder.id}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="border-t border-zinc-800 pt-4 text-center">
              <button 
                onClick={() => alert("Simulation Speed: Live.")}
                className="w-full bg-zinc-800 hover:bg-zinc-700 font-bold text-white text-[10px] py-2 rounded-lg"
              >
                Sync Satellite Stream
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
