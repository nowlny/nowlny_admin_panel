"use client";

import React, { useState } from "react";
import { 
  Settings, 
  Save, 
  Bell, 
  Send, 
  CheckCircle2, 
  AlertTriangle,
  HelpCircle,
  Shield,
  Zap,
  Globe
} from "lucide-react";
import { SystemSettings, loadDb } from "../data/mockData";

interface SettingsSectionProps {
  db: ReturnType<typeof loadDb>;
  onUpdateSettings: (updatedSettings: SystemSettings) => void;
  onSendNotification: (title: string, body: string, recipient: 'all' | 'customers' | 'restaurants' | 'drivers') => void;
}

export default function SettingsSection({
  db,
  onUpdateSettings,
  onSendNotification
}: SettingsSectionProps) {
  const { settings } = db;
  
  // Settings Form States
  const [commRate, setCommRate] = useState(settings.commissionRate.toString());
  const [deliveryFee, setDeliveryFee] = useState(settings.baseDeliveryFee.toString());
  const [serviceFee, setServiceFee] = useState(settings.serviceFee.toString());
  const [driverShare, setDriverShare] = useState(settings.driverShare.toString());
  const [radius, setRadius] = useState(settings.operationalRadius.toString());
  const [maintenance, setMaintenance] = useState(settings.maintenanceMode);

  // Broadcaster Form States
  const [notifTitle, setNotifTitle] = useState("");
  const [notifBody, setNotifBody] = useState("");
  const [notifRecipient, setNotifRecipient] = useState<'all' | 'customers' | 'restaurants' | 'drivers'>('all');

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commRate || !deliveryFee || !serviceFee || !driverShare || !radius) {
      alert("All fields are required.");
      return;
    }

    const updated: SystemSettings = {
      commissionRate: parseFloat(commRate),
      baseDeliveryFee: parseFloat(deliveryFee),
      serviceFee: parseFloat(serviceFee),
      driverShare: parseFloat(driverShare),
      operationalRadius: parseFloat(radius),
      maintenanceMode: maintenance
    };

    onUpdateSettings(updated);
    alert("System settings saved successfully!");
  };

  const handleBroadcast = (e: React.FormEvent) => {
    e.preventDefault();
    if (!notifTitle.trim() || !notifBody.trim()) {
      alert("Title and message body are required to broadcast!");
      return;
    }

    onSendNotification(notifTitle, notifBody, notifRecipient);
    
    // Reset Broadcaster Form
    setNotifTitle("");
    setNotifBody("");
    setNotifRecipient("all");
    
    alert(`Success! Push notification broadcasted to recipient group: ${notifRecipient}. Check the notification log bell in the header!`);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in duration-200">
      
      {/* Platform Parameters Configuration */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm space-y-6">
        <div className="flex items-center gap-2 mb-2 pb-2 border-b border-zinc-100 dark:border-zinc-800">
          <Settings className="w-5 h-5 text-orange-500" />
          <div>
            <h4 className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider">System Operations Parameters</h4>
            <p className="text-[10px] text-zinc-400">Configure global transaction fees, radii limits, and operational overrides</p>
          </div>
        </div>

        <form onSubmit={handleSaveSettings} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-zinc-400 uppercase">Platform Commission Rate (%)</label>
              <input
                type="number"
                step="0.1"
                value={commRate}
                onChange={(e) => setCommRate(e.target.value)}
                className="w-full bg-zinc-50 border border-zinc-200 text-zinc-800 rounded-lg p-2.5 text-xs focus:ring-1 focus:ring-orange-500 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-200"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-zinc-400 uppercase">Base Delivery Fee ($)</label>
              <input
                type="number"
                step="0.01"
                value={deliveryFee}
                onChange={(e) => setDeliveryFee(e.target.value)}
                className="w-full bg-zinc-50 border border-zinc-200 text-zinc-800 rounded-lg p-2.5 text-xs focus:ring-1 focus:ring-orange-500 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-200"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-zinc-400 uppercase">Platform Service Fee ($)</label>
              <input
                type="number"
                step="0.01"
                value={serviceFee}
                onChange={(e) => setServiceFee(e.target.value)}
                className="w-full bg-zinc-50 border border-zinc-200 text-zinc-800 rounded-lg p-2.5 text-xs focus:ring-1 focus:ring-orange-500 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-200"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-zinc-400 uppercase">Courier Fee Split (%)</label>
              <input
                type="number"
                step="0.5"
                value={driverShare}
                onChange={(e) => setDriverShare(e.target.value)}
                className="w-full bg-zinc-50 border border-zinc-200 text-zinc-800 rounded-lg p-2.5 text-xs focus:ring-1 focus:ring-orange-500 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-200"
              />
            </div>

            <div className="space-y-1 sm:col-span-2">
              <label className="text-[10px] font-bold text-zinc-400 uppercase">Operational Dispatch Radius (km)</label>
              <input
                type="number"
                value={radius}
                onChange={(e) => setRadius(e.target.value)}
                className="w-full bg-zinc-50 border border-zinc-200 text-zinc-800 rounded-lg p-2.5 text-xs focus:ring-1 focus:ring-orange-500 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-200"
              />
            </div>
          </div>

          {/* Maintenance switch */}
          <div className="p-3 border border-zinc-200 dark:border-zinc-800 rounded-xl flex items-center justify-between bg-zinc-50 dark:bg-zinc-800/20">
            <div className="flex gap-2 items-center text-xs">
              <Shield className="w-5 h-5 text-orange-500" />
              <div>
                <p className="font-bold text-zinc-800 dark:text-zinc-200">Emergency Maintenance Lock</p>
                <p className="text-[10px] text-zinc-400 mt-0.5">Locks out both Customer and Merchant Apps instantly</p>
              </div>
            </div>
            
            <input 
              type="checkbox"
              checked={maintenance}
              onChange={() => setMaintenance(!maintenance)}
              className="rounded w-4 h-4 cursor-pointer text-orange-500"
            />
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className="flex items-center justify-center gap-1.5 text-xs font-bold bg-orange-500 hover:bg-orange-600 text-white px-5 py-2.5 rounded-xl shadow-lg shadow-orange-500/10 active:scale-95 transition-all"
            >
              <Save className="w-4 h-4" />
              <span>Save System Settings</span>
            </button>
          </div>
        </form>
      </div>

      {/* Global Push Notifications Broadcaster */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm space-y-6">
        <div className="flex items-center gap-2 mb-2 pb-2 border-b border-zinc-100 dark:border-zinc-800">
          <Bell className="w-5 h-5 text-orange-500" />
          <div>
            <h4 className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider">Global Communications Desk</h4>
            <p className="text-[10px] text-zinc-400">Broadcast immediate banners and push warnings across target apps</p>
          </div>
        </div>

        <form onSubmit={handleBroadcast} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-zinc-400 uppercase">Target Audience Group</label>
            <select
              value={notifRecipient}
              onChange={(e) => setNotifRecipient(e.target.value as any)}
              className="w-full bg-zinc-50 border border-zinc-200 text-zinc-800 rounded-lg p-2.5 text-xs focus:ring-1 focus:ring-orange-500 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-200 cursor-pointer"
            >
              <option value="all">Everyone (All platforms)</option>
              <option value="customers">Customers App (Nowlny_Customer)</option>
              <option value="restaurants">Restaurants App (Nowlny_Restaurant)</option>
              <option value="drivers">Drivers App (Nowlny_Fleet)</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-zinc-400 uppercase">Broadcast Title</label>
            <input
              type="text"
              placeholder="e.g. Server Upgrades Incoming"
              value={notifTitle}
              onChange={(e) => setNotifTitle(e.target.value)}
              className="w-full bg-zinc-50 border border-zinc-200 text-zinc-800 rounded-lg p-2.5 text-xs focus:ring-1 focus:ring-orange-500 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-200"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-zinc-400 uppercase">Warning Message</label>
            <textarea
              rows={3}
              placeholder="Write a clear and warning message. This will prompt users on load."
              value={notifBody}
              onChange={(e) => setNotifBody(e.target.value)}
              className="w-full bg-zinc-50 border border-zinc-200 text-zinc-800 rounded-lg p-2.5 text-xs focus:ring-1 focus:ring-orange-500 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-200 resize-none"
            />
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className="flex items-center justify-center gap-1.5 text-xs font-bold bg-orange-500 hover:bg-orange-600 text-white px-5 py-2.5 rounded-xl shadow-lg shadow-orange-500/10 active:scale-95 transition-all"
            >
              <Send className="w-4 h-4" />
              <span>Broadcast Warning</span>
            </button>
          </div>
        </form>
      </div>

    </div>
  );
}
