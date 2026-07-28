"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  MessageSquare,
  Smartphone,
  RefreshCw,
  Send,
  KeyRound,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Eye,
  EyeOff,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  smsGatewayService,
  smsGatewayKey,
  SmsMessage,
  SmsDeviceStatus,
  SmsStatus,
} from "../../services/smsGateway";
import Modal from "./ui/Modal";
import { useConfirm } from "./ui/ConfirmDialog";
import StatusPill from "./ui/StatusPill";
import { EmptyState, ErrorState, TableSkeleton } from "./ui/States";
import { formatDateTime } from "../../lib/format";

import { useI18n, type MessageKey } from "../../lib/i18n";
/**
 * SMS gateway operations — `/api/v1/sms-gateway/*`.
 *
 * Nowlny delivers every OTP through a paired Android handset: the API queues a
 * message, pushes it to the device over FCM, and the device reports delivery
 * back. None of that was visible in the panel, so "the customer never got their
 * code" — the single most common support ticket for a phone-login product —
 * had no answer short of a database session.
 *
 * These routes authenticate with an `x-api-key` header rather than the operator
 * JWT, so the key is entered here and kept in this browser only.
 */

const inputClass =
  "w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-sm text-zinc-900 dark:text-white rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-orange-500";
const labelClass =
  "block text-[10px] font-black text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-1.5";

const STATUS_FILTERS: { value: SmsStatus | "all"; key: MessageKey }[] = [
  { value: "all", key: "common.all" },
  { value: "queued", key: "status.queued" },
  { value: "sent_to_device", key: "status.sent_to_device" },
  { value: "delivered", key: "status.delivered" },
  { value: "failed", key: "status.failed" },
];

const PAGE_SIZE = 20;

export default function SmsGatewaySection() {
  const { t } = useI18n();
  const confirm = useConfirm();

  const [apiKey, setApiKey] = useState("");
  const [hasKey, setHasKey] = useState(false);
  const [showKey, setShowKey] = useState(false);

  const [messages, setMessages] = useState<SmsMessage[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState<SmsStatus | "all">("all");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [device, setDevice] = useState<SmsDeviceStatus | null>(null);
  const [deviceError, setDeviceError] = useState<string | null>(null);

  const [isRetrying, setIsRetrying] = useState(false);
  const [isSendOpen, setIsSendOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sendForm, setSendForm] = useState({
    phoneNumber: "",
    message: "",
    channel: "sms" as "sms" | "whatsapp",
  });

  // The key lives in localStorage, which is unavailable during SSR.
  useEffect(() => {
    const stored = smsGatewayKey.get();
    setApiKey(stored);
    setHasKey(stored.length > 0);
  }, []);

  const loadMessages = useCallback(async () => {
    if (!hasKey) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await smsGatewayService.listMessages({
        page,
        limit: PAGE_SIZE,
        status: statusFilter,
      });
      setMessages(res.data);
      setTotal(res.total);
      setTotalPages(Math.max(1, res.totalPages ?? 1));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("sms.load_failed"),
      );
      setMessages([]);
    } finally {
      setIsLoading(false);
    }
  }, [hasKey, page, statusFilter]);

  const loadDevice = useCallback(async () => {
    if (!hasKey) return;
    setDeviceError(null);
    try {
      setDevice(await smsGatewayService.getDeviceStatus());
    } catch (err) {
      setDevice(null);
      setDeviceError(
        err instanceof Error ? err.message : t("sms.device_failed"),
      );
    }
  }, [hasKey]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  useEffect(() => {
    loadDevice();
  }, [loadDevice]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter]);

  const saveKey = (e: React.FormEvent) => {
    e.preventDefault();
    smsGatewayKey.set(apiKey);
    const stored = smsGatewayKey.get();
    setHasKey(stored.length > 0);
    toast.success(stored ? t("sms.key_saved") : t("sms.key_cleared"));
  };

  const handleRetryQueued = async () => {
    const ok = await confirm({
      title: t("sms.retry_title"),
      description: t("sms.retry_body"),
      confirmLabel: t("sms.retry_queued"),
    });
    if (!ok) return;

    setIsRetrying(true);
    try {
      const res = await smsGatewayService.retryQueued();
      const count = res?.retried ?? res?.count;
      toast.success(
        count != null ? t("sms.retried_n", { count }) : t("sms.retried"),
      );
      await loadMessages();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : t("sms.retry_failed"),
      );
    } finally {
      setIsRetrying(false);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSending(true);
    try {
      await smsGatewayService.sendMessage({
        phoneNumber: sendForm.phoneNumber.trim(),
        message: sendForm.message.trim(),
        channel: sendForm.channel,
      });
      toast.success(t("sms.sent_toast"));
      setIsSendOpen(false);
      setSendForm({ phoneNumber: "", message: "", channel: "sms" });
      await loadMessages();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : t("sms.send_failed"),
      );
    } finally {
      setIsSending(false);
    }
  };

  const deviceOnline = !!device && device.registered !== false;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-2xl shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-orange-500" /> {t("sms.title")}
          </h2>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-semibold mt-1">
            {t("sms.subtitle")}
          </p>
        </div>

        {hasKey && (
          <div className="flex gap-2">
            <button
              onClick={() => setIsSendOpen(true)}
              className="text-xs font-bold px-3 py-2.5 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-xl transition-all shadow-sm flex items-center gap-2"
            >
              <Send className="w-3.5 h-3.5" /> {t("sms.send_test")}
            </button>
            <button
              onClick={handleRetryQueued}
              disabled={isRetrying}
              className="text-xs font-bold px-3 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl transition-all shadow-sm flex items-center gap-2 disabled:opacity-50"
            >
              {isRetrying ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" />
              )}
              {t("sms.retry_queued")}
            </button>
          </div>
        )}
      </div>

      {/* API key. These routes are keyed rather than JWT-authenticated, so
          without it every panel below would just render a 401. */}
      <form
        onSubmit={saveKey}
        className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-2xl shadow-sm space-y-3"
      >
        <label htmlFor="sms-api-key" className={labelClass}>
          <span className="inline-flex items-center gap-1.5">
            <KeyRound className="w-3 h-3" /> {t("sms.api_key")}
          </span>
        </label>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <input
              id="sms-api-key"
              type={showKey ? "text" : "password"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="x-api-key"
              autoComplete="off"
              className={`${inputClass} pe-10`}
            />
            <button
              type="button"
              onClick={() => setShowKey((v) => !v)}
              aria-label={showKey ? t("sms.hide_key") : t("sms.show_key")}
              className="absolute end-2 top-1/2 -translate-y-1/2 p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded-md"
            >
              {showKey ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          </div>
          <button
            type="submit"
            className="text-xs font-bold px-4 py-2.5 bg-zinc-900 dark:bg-zinc-800 text-white rounded-lg transition-all shadow-sm whitespace-nowrap"
          >
            {t("sms.save_key")}
          </button>
        </div>
        <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
          {t("sms.key_hint")}
        </p>
      </form>

      {!hasKey ? (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl">
          <EmptyState
            icon={KeyRound}
            title={t("sms.need_key_title")}
            hint={t("sms.need_key_hint")}
          />
        </div>
      ) : (
        <>
          {/* Device health */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div
                className={`p-3 rounded-xl ${
                  deviceOnline
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    : "bg-red-500/10 text-red-600 dark:text-red-400"
                }`}
              >
                <Smartphone className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
                  {t("sms.paired_device")}
                </p>
                <p className="text-sm font-black text-zinc-900 dark:text-white flex items-center gap-1.5">
                  {deviceError ? (
                    <>
                      <AlertTriangle className="w-4 h-4 text-red-500" />
                      {t("sms.unreachable")}
                    </>
                  ) : deviceOnline ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      {device?.deviceName || t("sms.registered")}
                    </>
                  ) : (
t("sms.not_registered")
                  )}
                </p>
                {device?.lastSeenAt && (
                  <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                    {t("sms.last_seen", {
                      date: formatDateTime(device.lastSeenAt),
                    })}
                  </p>
                )}
                {deviceError && (
                  <p className="text-[10px] text-red-500 mt-0.5">
                    {deviceError}
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={loadDevice}
              className="text-xs font-bold px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors inline-flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" /> {t("sms.recheck")}
            </button>
          </div>

          {/* Status filter */}
          <div className="flex items-center gap-1.5 bg-zinc-50 dark:bg-zinc-800/50 p-1 rounded-xl border border-zinc-200/60 dark:border-zinc-700/80 overflow-x-auto scrollbar-none w-full md:w-fit">
            {STATUS_FILTERS.map((filter) => (
              <button
                key={filter.value}
                onClick={() => setStatusFilter(filter.value)}
                aria-pressed={statusFilter === filter.value}
                className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all whitespace-nowrap ${
                  statusFilter === filter.value
                    ? "bg-white dark:bg-zinc-900 text-orange-500 shadow-sm border border-zinc-200/30 dark:border-zinc-800"
                    : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white"
                }`}
              >
                {t(filter.key)}
              </button>
            ))}
          </div>

          {/* Message log */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden">
            {isLoading ? (
              <TableSkeleton rows={6} />
            ) : error ? (
              <ErrorState message={error} onRetry={loadMessages} />
            ) : messages.length === 0 ? (
              <EmptyState
                icon={MessageSquare}
                title={t("sms.empty_title")}
                hint={t("sms.empty_hint")}
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-start">
                  <thead className="bg-zinc-50 dark:bg-zinc-950/40 border-b border-zinc-200 dark:border-zinc-800">
                    <tr className="text-[10px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
                      <th className="px-4 py-3">{t("sms.recipient")}</th>
                      <th className="px-4 py-3">{t("sms.message")}</th>
                      <th className="px-4 py-3">{t("common.status")}</th>
                      <th className="px-4 py-3 whitespace-nowrap">
                        {t("sms.sent")}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {messages.map((sms) => (
                      <tr
                        key={sms.id}
                        className="text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors"
                      >
                        <td className="px-4 py-3 font-bold text-zinc-900 dark:text-white whitespace-nowrap">
                          {sms.phoneNumber}
                          {sms.channel === "whatsapp" && (
                            <span className="ms-2 text-[9px] font-black uppercase text-emerald-500">
                              WhatsApp
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300 max-w-xs truncate">
                          {sms.message || "—"}
                        </td>
                        <td className="px-4 py-3">
                          <StatusPill status={sms.status} />
                          {sms.errorMessage && (
                            <p className="text-[10px] text-red-500 mt-1">
                              {sms.errorMessage}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
                          {formatDateTime(sms.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {!isLoading && !error && totalPages > 1 && (
              <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50 dark:bg-zinc-900/50">
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  {t("sms.count_page", {
                    total,
                    page,
                    pages: totalPages,
                  })}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-3 py-1.5 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50 transition-colors"
                  >
                    {t("common.previous")}
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="px-3 py-1.5 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50 transition-colors"
                  >
                    {t("common.next")}
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      <Modal
        isOpen={isSendOpen}
        onClose={() => setIsSendOpen(false)}
        title={t("sms.send_title")}
        description={t("sms.send_desc")}
        maxWidth="max-w-md"
        dismissable={!isSending}
        footer={
          <>
            <button
              type="button"
              onClick={() => setIsSendOpen(false)}
              className="flex-1 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-900 dark:text-white text-xs font-bold py-2.5 rounded-lg transition-colors"
            >
              {t("common.cancel")}
            </button>
            <button
              type="submit"
              form="sms-send-form"
              disabled={isSending}
              className="flex-1 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold py-2.5 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {t("sms.send")}
            </button>
          </>
        }
      >
        <form id="sms-send-form" onSubmit={handleSend} className="space-y-4">
          <div>
            <label htmlFor="sms-phone" className={labelClass}>
              {t("customers.phone")}
            </label>
            <input
              id="sms-phone"
              required
              inputMode="tel"
              value={sendForm.phoneNumber}
              onChange={(e) =>
                setSendForm({ ...sendForm, phoneNumber: e.target.value })
              }
              placeholder="+96171000000"
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="sms-channel" className={labelClass}>
              {t("sms.channel")}
            </label>
            <select
              id="sms-channel"
              value={sendForm.channel}
              onChange={(e) =>
                setSendForm({
                  ...sendForm,
                  channel: e.target.value as "sms" | "whatsapp",
                })
              }
              className={inputClass}
            >
              <option value="sms">SMS</option>
              <option value="whatsapp">WhatsApp</option>
            </select>
          </div>
          <div>
            <label htmlFor="sms-body" className={labelClass}>
              {t("sms.message")}
            </label>
            <textarea
              id="sms-body"
              required
              rows={3}
              value={sendForm.message}
              onChange={(e) =>
                setSendForm({ ...sendForm, message: e.target.value })
              }
              className={inputClass}
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}
