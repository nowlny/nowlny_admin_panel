"use client";

import React, { useState, useEffect } from "react";
import {
  Smartphone,
  Apple,
  Loader2,
  Save,
  CheckCircle,
} from "lucide-react";
import { appVersionService, AppVersionConfig } from "../../services/appVersion";

export default function AppVersionSection() {
  const [config, setConfig] = useState<AppVersionConfig>({
    latestVersionIos: "",
    minSupportedVersionIos: "",
    isUpdateMandatoryIos: false,
    allowDismissIos: true,
    titleIos: "",
    messageIos: "",
    storeUrlIos: "",
    latestVersionAndroid: "",
    minSupportedVersionAndroid: "",
    isUpdateMandatoryAndroid: false,
    allowDismissAndroid: true,
    titleAndroid: "",
    messageAndroid: "",
    storeUrlAndroid: "",
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      setIsLoading(true);
      const data = await appVersionService.getAppVersion();
      if (data) {
        setConfig(data);
      }
    } catch (err) {
      console.error("Failed to fetch app version config:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    let finalValue: any = value;
    
    if (type === "checkbox") {
      finalValue = (e.target as HTMLInputElement).checked;
    }
    
    setConfig(prev => ({
      ...prev,
      [name]: finalValue
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSaving(true);
      setSuccessMessage("");
      
      // Strip any extra properties like id, createdAt, updatedAt that the backend might reject
      const payload: AppVersionConfig = {
        latestVersionIos: config.latestVersionIos,
        minSupportedVersionIos: config.minSupportedVersionIos,
        isUpdateMandatoryIos: config.isUpdateMandatoryIos,
        allowDismissIos: config.allowDismissIos,
        titleIos: config.titleIos,
        messageIos: config.messageIos,
        storeUrlIos: config.storeUrlIos,
        latestVersionAndroid: config.latestVersionAndroid,
        minSupportedVersionAndroid: config.minSupportedVersionAndroid,
        isUpdateMandatoryAndroid: config.isUpdateMandatoryAndroid,
        allowDismissAndroid: config.allowDismissAndroid,
        titleAndroid: config.titleAndroid,
        messageAndroid: config.messageAndroid,
        storeUrlAndroid: config.storeUrlAndroid,
      };

      await appVersionService.updateAppVersion(payload);
      setSuccessMessage("App version configuration updated successfully.");
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (err: any) {
      console.error("Failed to update config:", err);
      alert(err.message || "Failed to save configuration.");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-24 text-zinc-500">
        <Loader2 className="w-8 h-8 animate-spin mb-4 text-orange-500" />
        <p className="text-sm font-semibold">Loading version config...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-2xl shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-500/10 rounded-xl">
            <Smartphone className="w-5 h-5 text-orange-500" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-zinc-900 dark:text-white">
              App Version Control
            </h2>
            <p className="text-xs text-zinc-500">
              Force updates or notify users of new versions.
            </p>
          </div>
        </div>
        <button
          onClick={handleSubmit}
          disabled={isSaving}
          className="text-xs font-bold px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-all shadow-sm flex items-center gap-2 disabled:opacity-50"
        >
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Configuration
        </button>
      </div>

      {successMessage && (
        <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400 px-4 py-3 rounded-xl flex items-center gap-2 text-xs font-bold animate-in slide-in-from-top-2">
          <CheckCircle className="w-4 h-4" />
          {successMessage}
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* iOS Settings */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden flex flex-col">
          <div className="bg-zinc-50 dark:bg-zinc-800/50 p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center gap-3">
            <div className="bg-zinc-200 dark:bg-zinc-700 p-1.5 rounded-lg text-zinc-700 dark:text-zinc-300">
              <Apple className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-sm text-zinc-900 dark:text-white">iOS App Settings</h3>
          </div>
          <div className="p-6 space-y-5 flex-1">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1.5">Latest Version</label>
                <input
                  type="text"
                  name="latestVersionIos"
                  value={config.latestVersionIos}
                  onChange={handleChange}
                  placeholder="e.g. 1.1.4"
                  className="w-full bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm text-zinc-900 dark:text-white focus:ring-2 focus:ring-orange-500/50"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1.5">Min Supported</label>
                <input
                  type="text"
                  name="minSupportedVersionIos"
                  value={config.minSupportedVersionIos}
                  onChange={handleChange}
                  placeholder="e.g. 1.0.0"
                  className="w-full bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm text-zinc-900 dark:text-white focus:ring-2 focus:ring-orange-500/50"
                />
              </div>
            </div>

            <div className="flex items-center gap-6 pt-2">
              <label className="flex items-center gap-2 cursor-pointer group">
                <div className="relative flex items-center">
                  <input
                    type="checkbox"
                    name="isUpdateMandatoryIos"
                    checked={config.isUpdateMandatoryIos}
                    onChange={handleChange}
                    className="peer sr-only"
                  />
                  <div className="w-10 h-6 bg-zinc-200 dark:bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500 transition-colors"></div>
                </div>
                <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 group-hover:text-zinc-900 dark:group-hover:text-white">Mandatory Update</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer group">
                <div className="relative flex items-center">
                  <input
                    type="checkbox"
                    name="allowDismissIos"
                    checked={config.allowDismissIos}
                    onChange={handleChange}
                    className="peer sr-only"
                  />
                  <div className="w-10 h-6 bg-zinc-200 dark:bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500 transition-colors"></div>
                </div>
                <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 group-hover:text-zinc-900 dark:group-hover:text-white">Allow Dismiss</span>
              </label>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1.5">Dialog Title</label>
              <input
                type="text"
                name="titleIos"
                value={config.titleIos}
                onChange={handleChange}
                placeholder="e.g. تحديث مطلوب"
                className="w-full bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm text-zinc-900 dark:text-white focus:ring-2 focus:ring-orange-500/50"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1.5">Dialog Message</label>
              <textarea
                name="messageIos"
                value={config.messageIos}
                onChange={handleChange}
                rows={3}
                placeholder="Message displayed to user..."
                className="w-full bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm text-zinc-900 dark:text-white focus:ring-2 focus:ring-orange-500/50 resize-none"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1.5">App Store URL</label>
              <input
                type="url"
                name="storeUrlIos"
                value={config.storeUrlIos}
                onChange={handleChange}
                placeholder="https://apps.apple.com/..."
                className="w-full bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm text-zinc-900 dark:text-white focus:ring-2 focus:ring-orange-500/50"
              />
            </div>
          </div>
        </div>

        {/* Android Settings */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden flex flex-col">
          <div className="bg-zinc-50 dark:bg-zinc-800/50 p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center gap-3">
            <div className="bg-emerald-100 dark:bg-emerald-900/40 p-1.5 rounded-lg text-emerald-600 dark:text-emerald-400">
              <Smartphone className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-sm text-zinc-900 dark:text-white">Android App Settings</h3>
          </div>
          <div className="p-6 space-y-5 flex-1">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1.5">Latest Version</label>
                <input
                  type="text"
                  name="latestVersionAndroid"
                  value={config.latestVersionAndroid}
                  onChange={handleChange}
                  placeholder="e.g. 1.1.4"
                  className="w-full bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm text-zinc-900 dark:text-white focus:ring-2 focus:ring-orange-500/50"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1.5">Min Supported</label>
                <input
                  type="text"
                  name="minSupportedVersionAndroid"
                  value={config.minSupportedVersionAndroid}
                  onChange={handleChange}
                  placeholder="e.g. 1.0.0"
                  className="w-full bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm text-zinc-900 dark:text-white focus:ring-2 focus:ring-orange-500/50"
                />
              </div>
            </div>

            <div className="flex items-center gap-6 pt-2">
              <label className="flex items-center gap-2 cursor-pointer group">
                <div className="relative flex items-center">
                  <input
                    type="checkbox"
                    name="isUpdateMandatoryAndroid"
                    checked={config.isUpdateMandatoryAndroid}
                    onChange={handleChange}
                    className="peer sr-only"
                  />
                  <div className="w-10 h-6 bg-zinc-200 dark:bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500 transition-colors"></div>
                </div>
                <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 group-hover:text-zinc-900 dark:group-hover:text-white">Mandatory Update</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer group">
                <div className="relative flex items-center">
                  <input
                    type="checkbox"
                    name="allowDismissAndroid"
                    checked={config.allowDismissAndroid}
                    onChange={handleChange}
                    className="peer sr-only"
                  />
                  <div className="w-10 h-6 bg-zinc-200 dark:bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500 transition-colors"></div>
                </div>
                <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 group-hover:text-zinc-900 dark:group-hover:text-white">Allow Dismiss</span>
              </label>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1.5">Dialog Title</label>
              <input
                type="text"
                name="titleAndroid"
                value={config.titleAndroid}
                onChange={handleChange}
                placeholder="e.g. تحديث مطلوب"
                className="w-full bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm text-zinc-900 dark:text-white focus:ring-2 focus:ring-orange-500/50"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1.5">Dialog Message</label>
              <textarea
                name="messageAndroid"
                value={config.messageAndroid}
                onChange={handleChange}
                rows={3}
                placeholder="Message displayed to user..."
                className="w-full bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm text-zinc-900 dark:text-white focus:ring-2 focus:ring-orange-500/50 resize-none"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1.5">Play Store URL</label>
              <input
                type="url"
                name="storeUrlAndroid"
                value={config.storeUrlAndroid}
                onChange={handleChange}
                placeholder="https://play.google.com/..."
                className="w-full bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm text-zinc-900 dark:text-white focus:ring-2 focus:ring-orange-500/50"
              />
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
