"use client";

import React, { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import {
  Truck,
  MapPin,
  Star,
  Coins,
  Users,
  Phone,
  Loader2,
} from "lucide-react";
import {
  deliveryCompaniesService,
  DeliveryCompany,
  DeliveryCompanyZone,
  DeliveryCompanyRating,
} from "../../services/deliveryCompanies";
import type { ExchangeRateRef } from "../../services/restaurants";
import Modal from "./ui/Modal";
import StatusPill from "./ui/StatusPill";
import { EmptyState, ErrorState, Skeleton } from "./ui/States";
import {
  formatDate,
  formatMoney,
  formatRate,
  formatRating,
  orDash,
} from "../../lib/format";

import { useI18n, type MessageKey } from "../../lib/i18n";
const DeliveryZoneMap = dynamic(() => import("./DeliveryZoneMapClient"), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full rounded-xl" />,
});

/**
 * Everything the API exposes about one delivery company. The list view was the
 * only surface there was: `GET /{id}`, `/{id}/zones`, `/{id}/ratings` and
 * `/{id}/exchange-rates` had no UI, so an admin approving a company could not
 * see its coverage, its fleet size or what restaurants thought of it.
 */

interface DeliveryCompanyDetailModalProps {
  company: DeliveryCompany | null;
  onClose: () => void;
}

type Tab = "overview" | "zones" | "ratings" | "rates";

const TABS: [Tab, MessageKey][] = [
  ["overview", "delivery.tab_overview"],
  ["zones", "delivery.tab_zones"],
  ["ratings", "delivery.tab_ratings"],
  ["rates", "delivery.tab_rates"],
];

export default function DeliveryCompanyDetailModal({
  company,
  onClose,
}: DeliveryCompanyDetailModalProps) {
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>("overview");
  const [detail, setDetail] = useState<DeliveryCompany | null>(null);
  const [zones, setZones] = useState<DeliveryCompanyZone[]>([]);
  const [ratings, setRatings] = useState<DeliveryCompanyRating[]>([]);
  const [rates, setRates] = useState<ExchangeRateRef[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const companyId = company?.id;

  const load = useCallback(async () => {
    if (!companyId) return;
    setIsLoading(true);
    setError(null);
    try {
      // Each sub-resource is optional context: a company with no zones yet must
      // still open, so only the profile call is allowed to fail the view.
      const [profile, zoneList, ratingList, rateList] = await Promise.all([
        deliveryCompaniesService.getDeliveryCompanyById(companyId),
        deliveryCompaniesService.getZones(companyId).catch(() => []),
        deliveryCompaniesService.getRatings(companyId).catch(() => []),
        deliveryCompaniesService.getExchangeRates(companyId).catch(() => []),
      ]);
      setDetail(profile);
      setZones(zoneList);
      setRatings(ratingList);
      setRates(rateList);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("delivery.detail_failed"),
      );
    } finally {
      setIsLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    if (!companyId) {
      setDetail(null);
      setZones([]);
      setRatings([]);
      setRates([]);
      setTab("overview");
      return;
    }
    load();
  }, [companyId, load]);

  const record = detail ?? company;
  const currency = record?.currency?.code ?? record?.currencyId ?? undefined;

  return (
    <Modal
      isOpen={!!company}
      onClose={onClose}
      title={record?.name ?? t("delivery.detail_title")}
      description={record?.description ?? undefined}
      maxWidth="max-w-3xl"
      icon={
        <div className="w-10 h-10 rounded-xl bg-orange-500/10 text-orange-500 flex items-center justify-center shrink-0 overflow-hidden">
          {record?.logo ? (
            <img
              src={record.logo}
              alt=""
              className="w-full h-full object-cover"
            />
          ) : (
            <Truck className="w-5 h-5" />
          )}
        </div>
      }
    >
      {!record ? null : (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill status={record.status} />
            {isLoading && (
              <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 inline-flex items-center gap-1.5">
                <Loader2 className="w-3 h-3 animate-spin" />{" "}
                {t("delivery.loading_details")}
              </span>
            )}
          </div>

          {error && <ErrorState message={error} onRetry={load} />}

          <div className="flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-3 overflow-x-auto scrollbar-none">
            {TABS.map(([value, label]) => (
              <button
                key={value}
                onClick={() => setTab(value)}
                aria-current={tab === value ? "page" : undefined}
                className={`shrink-0 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  tab === value
                    ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                    : "text-zinc-500 hover:text-zinc-900 dark:hover:text-white bg-zinc-100 dark:bg-zinc-800/50"
                }`}
              >
                {t(label)}
              </button>
            ))}
          </div>

          {tab === "overview" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Stat
                icon={<Phone className="w-4 h-4" />}
                label={t("common.phone")}
                value={orDash(record.phone)}
              />
              <Stat
                icon={<Coins className="w-4 h-4" />}
                label={t("delivery.delivery_charge")}
                value={formatMoney(record.deliveryCharge, currency)}
              />
              <Stat
                icon={<Users className="w-4 h-4" />}
                label={t("delivery.fleet_label")}
                value={
                  record.driversCount != null
                    ? t("delivery.fleet_value", {
                        active: record.activeDriversCount ?? 0,
                        total: record.driversCount,
                      })
                    : "—"
                }
              />
              <Stat
                icon={<Star className="w-4 h-4" />}
                label={t("common.rating")}
                value={t("delivery.rating_value", {
                  value: formatRating(record.rating),
                  count: record.totalRatings ?? 0,
                })}
              />
              <Stat
                icon={<MapPin className="w-4 h-4" />}
                label={t("delivery.zones_count")}
                value={String(record.zonesCount ?? zones.length)}
              />
              <Stat
                icon={<Truck className="w-4 h-4" />}
                label={t("delivery.driver_visibility")}
                value={
                  record.allowDriverVisibility ? t("common.yes") : t("common.no")
                }
              />
              {record.rejectionReason && (
                <div className="sm:col-span-2 p-3 rounded-xl bg-red-500/5 border border-red-500/20">
                  <p className="text-[10px] font-black uppercase text-red-500">
                    {t("common.rejection_reason")}
                  </p>
                  <p className="text-xs text-zinc-700 dark:text-zinc-300 mt-1">
                    {record.rejectionReason}
                  </p>
                </div>
              )}
            </div>
          )}

          {tab === "zones" &&
            (zones.length === 0 ? (
              <EmptyState
                icon={MapPin}
                title={t("delivery.no_zones_title")}
                hint={t("delivery.no_zones_hint")}
              />
            ) : (
              <div className="space-y-4">
                {zones.map((zone) => (
                  <div
                    key={zone.id}
                    className="border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4"
                  >
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <h4 className="text-sm font-bold text-zinc-900 dark:text-white">
                        {zone.name}
                      </h4>
                      <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400">
                        {zone.minEstimatedTimeMinutes != null &&
                        zone.maxEstimatedTimeMinutes != null
                          ? `${zone.minEstimatedTimeMinutes}–${zone.maxEstimatedTimeMinutes} min`
: t("delivery.no_estimate")}
                      </span>
                    </div>
                    <div className="w-full h-56 rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-950 relative z-0">
                      <DeliveryZoneMap polygon={zone.polygon} />
                    </div>
                  </div>
                ))}
              </div>
            ))}

          {tab === "ratings" &&
            (ratings.length === 0 ? (
              <EmptyState
                icon={Star}
                title={t("delivery.no_ratings_title")}
                hint={t("delivery.no_ratings_hint")}
              />
            ) : (
              <div className="space-y-3 max-h-[50vh] overflow-y-auto pe-1">
                {ratings.map((rating) => (
                  <div
                    key={rating.id}
                    className="p-3 rounded-xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/40"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs font-bold text-zinc-900 dark:text-white truncate">
                        {rating.restaurantName ||
                          rating.restaurant?.name ||
t("delivery.a_restaurant")}
                      </p>
                      <span className="text-xs font-black text-amber-500 shrink-0">
                        {formatRating(rating.rating)} ★
                      </span>
                    </div>
                    {rating.comment && (
                      <p className="text-xs text-zinc-600 dark:text-zinc-300 mt-1.5">
                        {rating.comment}
                      </p>
                    )}
                    <p className="text-[10px] text-zinc-400 mt-1.5">
                      {formatDate(rating.createdAt)}
                    </p>
                  </div>
                ))}
              </div>
            ))}

          {tab === "rates" &&
            (rates.length === 0 ? (
              <EmptyState
                icon={Coins}
                title={t("delivery.defaults_title")}
                hint={t("delivery.defaults_hint")}
              />
            ) : (
              <div className="space-y-2">
                {rates.map((rate, idx) => (
                  <div
                    key={`${rate.fromCurrencyId}-${rate.toCurrencyId}-${idx}`}
                    className="flex items-center justify-between gap-3 p-3 rounded-xl border border-zinc-100 dark:border-zinc-800 text-xs"
                  >
                    <span className="font-bold text-zinc-900 dark:text-white">
                      {rate.fromCurrencyId} → {rate.toCurrencyId}
                    </span>
                    <span className="font-black tabular-nums text-zinc-700 dark:text-zinc-300">
                      {formatRate(rate.rate)}
                    </span>
                  </div>
                ))}
              </div>
            ))}
        </div>
      )}
    </Modal>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="p-3 rounded-xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/40">
      <p className="text-[10px] font-black uppercase tracking-wide text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
        {icon}
        {label}
      </p>
      <p className="text-sm font-bold text-zinc-900 dark:text-white mt-1">
        {value}
      </p>
    </div>
  );
}
