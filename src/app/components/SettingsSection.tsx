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
  Globe,
} from "lucide-react";
import { SystemSettings, loadDb } from "../data/mockData";

import { notificationsService } from "../../services/notifications";

interface SettingsSectionProps {
  db: ReturnType<typeof loadDb>;
  onUpdateSettings: (updatedSettings: SystemSettings) => void;
}

export default function SettingsSection({
  db,
  onUpdateSettings,
}: SettingsSectionProps) {
  const { settings } = db;

  // Settings Form States
  const [commRate, setCommRate] = useState(settings.commissionRate.toString());
  const [deliveryFee, setDeliveryFee] = useState(
    settings.baseDeliveryFee.toString(),
  );
  const [serviceFee, setServiceFee] = useState(settings.serviceFee.toString());
  const [driverShare, setDriverShare] = useState(
    settings.driverShare.toString(),
  );
  const [radius, setRadius] = useState(settings.operationalRadius.toString());
  const [maintenance, setMaintenance] = useState(settings.maintenanceMode);

  // Broadcaster Form States
  const [notifTitle, setNotifTitle] = useState("");
  const [notifBody, setNotifBody] = useState("");
  const [notifToken, setNotifToken] = useState("");
  const [isSending, setIsSending] = useState(false);

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
      maintenanceMode: maintenance,
    };

    onUpdateSettings(updated);
    alert("System settings saved successfully!");
  };

  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!notifTitle.trim() || !notifBody.trim() || !notifToken.trim()) {
      alert("Title, message body, and FCM token are required to send a test push!");
      return;
    }

    setIsSending(true);
    try {
      await notificationsService.sendTestNotification(notifToken, notifTitle, notifBody);
      // Reset Broadcaster Form
      setNotifTitle("");
      setNotifBody("");
      setNotifToken("");

      alert("Success! Test push notification sent.");
    } catch (err: any) {
      console.error(err);
      alert("Failed to send test push notification: " + err.message);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in duration-200">
      {/* Platform Parameters Configuration */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm space-y-6">
        <div className="flex items-center gap-2 mb-2 pb-2 border-b border-zinc-100 dark:border-zinc-800">
          <Settings className="w-5 h-5 text-orange-500" />
          <div>
            <h4 className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider">
              System Operations Parameters
            </h4>
            <p className="text-[10px] text-zinc-400">
              Configure global transaction fees, radii limits, and operational
              overrides
            </p>
          </div>
        </div>

        <form onSubmit={handleSaveSettings} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-zinc-400 uppercase">
                Platform Commission Rate (%)
              </label>
              <input
                type="number"
                step="0.1"
                value={commRate}
                onChange={(e) => setCommRate(e.target.value)}
                className="w-full bg-zinc-50 border border-zinc-200 text-zinc-800 rounded-lg p-2.5 text-xs focus:ring-1 focus:ring-orange-500 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-200"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-zinc-400 uppercase">
                Base Delivery Fee ($)
              </label>
              <input
                type="number"
                step="0.01"
                value={deliveryFee}
                onChange={(e) => setDeliveryFee(e.target.value)}
                className="w-full bg-zinc-50 border border-zinc-200 text-zinc-800 rounded-lg p-2.5 text-xs focus:ring-1 focus:ring-orange-500 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-200"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-zinc-400 uppercase">
                Platform Service Fee ($)
              </label>
              <input
                type="number"
                step="0.01"
                value={serviceFee}
                onChange={(e) => setServiceFee(e.target.value)}
                className="w-full bg-zinc-50 border border-zinc-200 text-zinc-800 rounded-lg p-2.5 text-xs focus:ring-1 focus:ring-orange-500 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-200"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-zinc-400 uppercase">
                Courier Fee Split (%)
              </label>
              <input
                type="number"
                step="0.5"
                value={driverShare}
                onChange={(e) => setDriverShare(e.target.value)}
                className="w-full bg-zinc-50 border border-zinc-200 text-zinc-800 rounded-lg p-2.5 text-xs focus:ring-1 focus:ring-orange-500 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-200"
              />
            </div>

            <div className="space-y-1 sm:col-span-2">
              <label className="text-[10px] font-bold text-zinc-400 uppercase">
                Operational Dispatch Radius (km)
              </label>
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
                <p className="font-bold text-zinc-800 dark:text-zinc-200">
                  Emergency Maintenance Lock
                </p>
                <p className="text-[10px] text-zinc-400 mt-0.5">
                  Locks out both Customer and Merchant Apps instantly
                </p>
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
            <h4 className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider">
              Global Communications Desk
            </h4>
            <p className="text-[10px] text-zinc-400">
              Broadcast immediate banners and push warnings across target apps
            </p>
          </div>
        </div>

        <form onSubmit={handleBroadcast} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-zinc-400 uppercase">
              Target FCM Token
            </label>
            <input
              type="text"
              placeholder="e.g. fcm-device-token-here"
              value={notifToken}
              onChange={(e) => setNotifToken(e.target.value)}
              className="w-full bg-zinc-50 border border-zinc-200 text-zinc-800 rounded-lg p-2.5 text-xs focus:ring-1 focus:ring-orange-500 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-200"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-zinc-400 uppercase">
              Broadcast Title
            </label>
            <input
              type="text"
              placeholder="e.g. Server Upgrades Incoming"
              value={notifTitle}
              onChange={(e) => setNotifTitle(e.target.value)}
              className="w-full bg-zinc-50 border border-zinc-200 text-zinc-800 rounded-lg p-2.5 text-xs focus:ring-1 focus:ring-orange-500 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-200"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-zinc-400 uppercase">
              Warning Message
            </label>
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
              disabled={isSending}
              className="flex items-center justify-center gap-1.5 text-xs font-bold bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl shadow-lg shadow-orange-500/10 active:scale-95 transition-all"
            >
              <Send className="w-4 h-4" />
              <span>{isSending ? "Sending..." : "Send Test Push"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
