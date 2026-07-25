"use client";

import React, { useState, useEffect } from "react";
import { Smartphone, Apple, Loader2, Save } from "lucide-react";
import toast from "react-hot-toast";
import { appVersionService, AppVersionConfig } from "../../services/appVersion";
import { ErrorState, Skeleton } from "./ui/States";

const inputClass =
  "w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-sm text-zinc-900 dark:text-white rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-orange-500";
const labelClass =
  "block text-[10px] font-black text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-1.5";
/**
 * The visible track of a `peer sr-only` checkbox. It previously carried
 * `peer-focus:outline-none`, which deleted the only focus indicator the control
 * could ever have — the switches were completely invisible to keyboard users.
 */
const switchTrackClass =
  "w-10 h-6 bg-zinc-200 dark:bg-zinc-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500 transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-orange-500 peer-focus-visible:ring-offset-2 dark:peer-focus-visible:ring-offset-zinc-900";

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
  const [loadError, setLoadError] = useState<string | null>(null);

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
      setLoadError(null);
    } catch (err: any) {
      console.error("Failed to fetch app version config:", err);
      /* DATA-LOSS GUARD. The failure used to be swallowed into console.error,
         leaving `config` at its empty-string defaults while the form rendered
         as though the live config were blank — and Save stayed enabled. One
         click then PUT a config of empty strings and wiped the force-update
         settings for every mobile client. The form is now replaced by an error
         state, and Save is disabled while `loadError` is set. */
      setLoadError(
        err?.message || "Could not load the current app version configuration.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value, type } = e.target;
    let finalValue: any = value;

    if (type === "checkbox") {
      finalValue = (e.target as HTMLInputElement).checked;
    }

    setConfig((prev) => ({
      ...prev,
      [name]: finalValue,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loadError) return;

    try {
      setIsSaving(true);

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
      toast.success("App version configuration updated successfully.");
    } catch (err: any) {
      console.error("Failed to update config:", err);
      toast.error(err?.message || "Failed to save configuration.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-2xl shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-500/10 rounded-xl">
            <Smartphone className="w-5 h-5 text-orange-500" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white">
              App Version Control
            </h2>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-semibold mt-1">
              Force updates or notify users of new versions.
            </p>
          </div>
        </div>
        <button
          type="submit"
          form="app-version-form"
          disabled={isSaving || isLoading || !!loadError}
          title={
            loadError
              ? "Saving is disabled until the current configuration loads."
              : undefined
          }
          className="bg-zinc-900 hover:bg-orange-500 text-white dark:bg-zinc-800 text-xs font-bold px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSaving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          Save Configuration
        </button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 space-y-4"
            >
              <Skeleton className="h-5 w-40 rounded-lg" />
              <div className="grid grid-cols-2 gap-4">
                <Skeleton className="h-10 rounded-lg" />
                <Skeleton className="h-10 rounded-lg" />
              </div>
              <Skeleton className="h-10 rounded-lg" />
              <Skeleton className="h-20 rounded-lg" />
              <Skeleton className="h-10 rounded-lg" />
            </div>
          ))}
        </div>
      ) : loadError ? (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl">
          <ErrorState
            message={`${loadError} The form is hidden so an empty configuration cannot be saved over the live one.`}
            onRetry={fetchConfig}
          />
        </div>
      ) : (
        <form
          id="app-version-form"
          onSubmit={handleSubmit}
          className="grid grid-cols-1 lg:grid-cols-2 gap-6"
        >
          {/* iOS Settings */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden flex flex-col">
            <div className="bg-zinc-50 dark:bg-zinc-800/50 p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center gap-3">
              <div className="bg-zinc-200 dark:bg-zinc-700 p-1.5 rounded-lg text-zinc-700 dark:text-zinc-300">
                <Apple className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-sm text-zinc-900 dark:text-white">
                iOS App Settings
              </h3>
            </div>
            <div className="p-6 space-y-5 flex-1">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="latestVersionIos" className={labelClass}>
                    Latest Version
                  </label>
                  <input
                    id="latestVersionIos"
                    type="text"
                    name="latestVersionIos"
                    value={config.latestVersionIos}
                    onChange={handleChange}
                    placeholder="e.g. 1.1.4"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label htmlFor="minSupportedVersionIos" className={labelClass}>
                    Min Supported
                  </label>
                  <input
                    id="minSupportedVersionIos"
                    type="text"
                    name="minSupportedVersionIos"
                    value={config.minSupportedVersionIos}
                    onChange={handleChange}
                    placeholder="e.g. 1.0.0"
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="flex items-center gap-6 pt-2">
                <label
                  htmlFor="isUpdateMandatoryIos"
                  className="flex items-center gap-2 cursor-pointer group"
                >
                  <div className="relative flex items-center">
                    <input
                      id="isUpdateMandatoryIos"
                      type="checkbox"
                      name="isUpdateMandatoryIos"
                      checked={config.isUpdateMandatoryIos}
                      onChange={handleChange}
                      className="peer sr-only"
                    />
                    <div className={switchTrackClass} />
                  </div>
                  <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 group-hover:text-zinc-900 dark:group-hover:text-white">
                    Mandatory Update
                  </span>
                </label>

                <label
                  htmlFor="allowDismissIos"
                  className="flex items-center gap-2 cursor-pointer group"
                >
                  <div className="relative flex items-center">
                    <input
                      id="allowDismissIos"
                      type="checkbox"
                      name="allowDismissIos"
                      checked={config.allowDismissIos}
                      onChange={handleChange}
                      className="peer sr-only"
                    />
                    <div className={switchTrackClass} />
                  </div>
                  <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 group-hover:text-zinc-900 dark:group-hover:text-white">
                    Allow Dismiss
                  </span>
                </label>
              </div>

              <div>
                <label htmlFor="titleIos" className={labelClass}>
                  Dialog Title
                </label>
                <input
                  id="titleIos"
                  type="text"
                  name="titleIos"
                  value={config.titleIos}
                  onChange={handleChange}
                  placeholder="e.g. تحديث مطلوب"
                  className={inputClass}
                />
              </div>

              <div>
                <label htmlFor="messageIos" className={labelClass}>
                  Dialog Message
                </label>
                <textarea
                  id="messageIos"
                  name="messageIos"
                  value={config.messageIos}
                  onChange={handleChange}
                  rows={3}
                  placeholder="Message displayed to user..."
                  className={`${inputClass} resize-none`}
                />
              </div>

              <div>
                <label htmlFor="storeUrlIos" className={labelClass}>
                  App Store URL
                </label>
                <input
                  id="storeUrlIos"
                  type="url"
                  name="storeUrlIos"
                  value={config.storeUrlIos}
                  onChange={handleChange}
                  placeholder="https://apps.apple.com/..."
                  className={inputClass}
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
              <h3 className="font-bold text-sm text-zinc-900 dark:text-white">
                Android App Settings
              </h3>
            </div>
            <div className="p-6 space-y-5 flex-1">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="latestVersionAndroid" className={labelClass}>
                    Latest Version
                  </label>
                  <input
                    id="latestVersionAndroid"
                    type="text"
                    name="latestVersionAndroid"
                    value={config.latestVersionAndroid}
                    onChange={handleChange}
                    placeholder="e.g. 1.1.4"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label
                    htmlFor="minSupportedVersionAndroid"
                    className={labelClass}
                  >
                    Min Supported
                  </label>
                  <input
                    id="minSupportedVersionAndroid"
                    type="text"
                    name="minSupportedVersionAndroid"
                    value={config.minSupportedVersionAndroid}
                    onChange={handleChange}
                    placeholder="e.g. 1.0.0"
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="flex items-center gap-6 pt-2">
                <label
                  htmlFor="isUpdateMandatoryAndroid"
                  className="flex items-center gap-2 cursor-pointer group"
                >
                  <div className="relative flex items-center">
                    <input
                      id="isUpdateMandatoryAndroid"
                      type="checkbox"
                      name="isUpdateMandatoryAndroid"
                      checked={config.isUpdateMandatoryAndroid}
                      onChange={handleChange}
                      className="peer sr-only"
                    />
                    <div className={switchTrackClass} />
                  </div>
                  <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 group-hover:text-zinc-900 dark:group-hover:text-white">
                    Mandatory Update
                  </span>
                </label>

                <label
                  htmlFor="allowDismissAndroid"
                  className="flex items-center gap-2 cursor-pointer group"
                >
                  <div className="relative flex items-center">
                    <input
                      id="allowDismissAndroid"
                      type="checkbox"
                      name="allowDismissAndroid"
                      checked={config.allowDismissAndroid}
                      onChange={handleChange}
                      className="peer sr-only"
                    />
                    <div className={switchTrackClass} />
                  </div>
                  <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 group-hover:text-zinc-900 dark:group-hover:text-white">
                    Allow Dismiss
                  </span>
                </label>
              </div>

              <div>
                <label htmlFor="titleAndroid" className={labelClass}>
                  Dialog Title
                </label>
                <input
                  id="titleAndroid"
                  type="text"
                  name="titleAndroid"
                  value={config.titleAndroid}
                  onChange={handleChange}
                  placeholder="e.g. تحديث مطلوب"
                  className={inputClass}
                />
              </div>

              <div>
                <label htmlFor="messageAndroid" className={labelClass}>
                  Dialog Message
                </label>
                <textarea
                  id="messageAndroid"
                  name="messageAndroid"
                  value={config.messageAndroid}
                  onChange={handleChange}
                  rows={3}
                  placeholder="Message displayed to user..."
                  className={`${inputClass} resize-none`}
                />
              </div>

              <div>
                <label htmlFor="storeUrlAndroid" className={labelClass}>
                  Play Store URL
                </label>
                <input
                  id="storeUrlAndroid"
                  type="url"
                  name="storeUrlAndroid"
                  value={config.storeUrlAndroid}
                  onChange={handleChange}
                  placeholder="https://play.google.com/..."
                  className={inputClass}
                />
              </div>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
