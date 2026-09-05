"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import Modal from "./ui/Modal";
import ImageUploadField from "./ui/ImageUploadField";
import PhoneNumberInput from "./ui/PhoneNumberInput";
import CategoryPicker from "./ui/CategoryPicker";
import { Skeleton } from "./ui/States";
import {
  FIELD_CLASS,
  FieldError,
  FormTabs,
  LABEL_CLASS,
  Req,
  formPanelId,
  formTabId,
} from "./ui/FormControls";
import OpeningHoursEditor, {
  WeekSchedule,
  WeekScheduleError,
  defaultWeekSchedule,
  hoursFieldId,
  toOpeningHours,
  validateWeekSchedule,
} from "./ui/OpeningHoursEditor";
import DeliveryZonesEditor, {
  ZoneDraft,
  ZoneError,
  validateZones,
  zoneFieldId,
  zonesToPayload,
} from "./ui/DeliveryZonesEditor";
import { toInternationalPhone } from "../../lib/phone";
import {
  restaurantsService,
  RestaurantCreate,
} from "../../services/restaurants";
import { currenciesService, Currency } from "../../services/currencies";
import { readId } from "../../services/apiClient";
import { useI18n } from "../../lib/i18n";
import { isUnknownPropertyError } from "../../lib/httpErrors";
import type { LatLng } from "./RestaurantMapEditorClient";

// Leaflet touches `window` at import time, so the map is client-only.
const RestaurantMapEditor = dynamic(
  () => import("./RestaurantMapEditorClient"),
  {
    ssr: false,
    loading: () => <Skeleton className="h-90 w-full rounded-xl" />,
  },
);

interface AddRestaurantModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

/*
 * `POST /api/v1/restaurants` (`CreateRestaurantDto`) takes the same opening
 * hours, coordinates and delivery-zone polygons the merchant app collects at
 * signup. This form used to hardcode 08:00–23:00 every day, take coordinates
 * only as typed numbers and never send zones at all — so an admin-created
 * restaurant went live with made-up hours and no coverage area. It also only
 * marked `name` as required while the DTO also requires `ownerPhoneNumber`,
 * `city` and `address`, which the API answered with a 400.
 */

type Tab = "details" | "location" | "hours" | "zones";
const TABS: Tab[] = ["details", "location", "hours", "zones"];

type FieldKey =
  | "name"
  | "ownerPhoneNumber"
  | "deliveryTimeMaxMinutes"
  | "city"
  | "address"
  | "latitude"
  | "longitude";

/** Validation order — the first failing field is the one that gets focus. */
const FIELD_KEYS: FieldKey[] = [
  "name",
  "ownerPhoneNumber",
  "deliveryTimeMaxMinutes",
  "city",
  "address",
  "latitude",
  "longitude",
];

const FIELD_TAB: Record<FieldKey, Tab> = {
  name: "details",
  ownerPhoneNumber: "details",
  deliveryTimeMaxMinutes: "details",
  city: "location",
  address: "location",
  latitude: "location",
  longitude: "location",
};

type FieldErrors = Partial<Record<FieldKey, string>>;

const ID_PREFIX = "add-rest";
const fid = (name: string) => `${ID_PREFIX}-${name}`;

const EMPTY_FORM = {
  name: "",
  description: "",
  phone: "",
  website: "",
  ownerFullName: "",
  ownerPhoneNumber: "",
  city: "",
  address: "",
  deliveryFee: "",
  deliveryTimeMinMinutes: "20",
  deliveryTimeMaxMinutes: "45",
  latitude: "",
  longitude: "",
  logo: "",
  backgroundImageUrl: "",
  currencyId: "",
};

/** Blank stays blank so an untouched numeric field isn't submitted as 0. */
const numeric = (value: string): number | undefined => {
  if (value.trim() === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
};

/**
 * Mounted only while open, so every field, the schedule and the drawn zones
 * start fresh on each "Add Restaurant" without a reset effect — the previous
 * merchant's data can no longer leak into the next one.
 */
export default function AddRestaurantModal({
  isOpen,
  onClose,
  onSuccess,
}: AddRestaurantModalProps) {
  if (!isOpen) return null;
  return <AddRestaurantForm onClose={onClose} onSuccess={onSuccess} />;
}

function AddRestaurantForm({
  onClose,
  onSuccess,
}: Omit<AddRestaurantModalProps, "isOpen">) {
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>("details");
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Submitting mid-upload would create the merchant with no artwork and
  // silently drop the image the operator just picked.
  const [uploadsInFlight, setUploadsInFlight] = useState(0);
  const [isDirty, setIsDirty] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [week, setWeek] = useState<WeekSchedule>(defaultWeekSchedule);
  const [zones, setZones] = useState<ZoneDraft[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [categoryIds, setCategoryIds] = useState<string[]>([]);

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [hoursError, setHoursError] = useState<WeekScheduleError | null>(null);
  const [zoneError, setZoneError] = useState<ZoneError | null>(null);
  // Set on a failed submit, consumed once the failing tab has rendered.
  const pendingFocus = useRef<string | null>(null);

  // Merchants price in their own currency (LBP for most of the platform), so
  // the operator has to be able to pick one at creation time.
  useEffect(() => {
    let cancelled = false;
    currenciesService
      .getActiveCurrencies()
      .then((list) => {
        if (cancelled) return;
        setCurrencies(list);
        setFormData((prev) =>
          prev.currencyId || list.length === 0
            ? prev
            : { ...prev, currencyId: list[0].code },
        );
      })
      .catch((err) =>
        console.warn("Could not load currencies:", err?.message ?? err),
      );
    return () => {
      cancelled = true;
    };
  }, []);

  // Move focus to the failing field once its tab has rendered. No deps: the
  // submit that queued it always re-renders (it sets the errors), and reading
  // a ref keeps this from being a state-in-effect cascade.
  useEffect(() => {
    const id = pendingFocus.current;
    if (!id) return;
    const el = document.getElementById(id);
    if (!el) return;
    pendingFocus.current = null;
    el.focus();
    el.scrollIntoView({ block: "center", behavior: "smooth" });
  });

  const clearFieldError = (key: FieldKey) =>
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    setIsDirty(true);
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    clearFieldError(e.target.name as FieldKey);
  };

  const setImage = (field: "logo" | "backgroundImageUrl") => (url: string) => {
    setIsDirty(true);
    setFormData((prev) => ({ ...prev, [field]: url }));
  };

  const setPhone =
    (field: "phone" | "ownerPhoneNumber") => (digits: string) => {
      setIsDirty(true);
      setFormData((prev) => ({ ...prev, [field]: digits }));
      if (field === "ownerPhoneNumber") clearFieldError(field);
    };

  const pin = useMemo<LatLng | null>(() => {
    const lat = numeric(formData.latitude);
    const lng = numeric(formData.longitude);
    return lat !== undefined && lng !== undefined ? { lat, lng } : null;
  }, [formData.latitude, formData.longitude]);

  const setPin = (next: LatLng) => {
    setIsDirty(true);
    setFormData((prev) => ({
      ...prev,
      latitude: next.lat.toFixed(6),
      longitude: next.lng.toFixed(6),
    }));
    clearFieldError("latitude");
    clearFieldError("longitude");
  };

  const handleWeekChange = (next: WeekSchedule) => {
    setIsDirty(true);
    setWeek(next);
    setHoursError(null);
  };

  const handleZonesChange = (next: ZoneDraft[]) => {
    setIsDirty(true);
    setZones(next);
    setZoneError(null);
  };

  const trackUpload = (isUploading: boolean) =>
    setUploadsInFlight((n) => Math.max(0, n + (isUploading ? 1 : -1)));

  const validate = () => {
    const errors: FieldErrors = {};
    const required = (label: string) =>
      t("rest.required_field", { field: label });

    if (!formData.name.trim()) errors.name = required(t("rest.name"));
    if (!toInternationalPhone(formData.ownerPhoneNumber))
      errors.ownerPhoneNumber = required(t("rest.owner_phone"));

    const min = numeric(formData.deliveryTimeMinMinutes);
    const max = numeric(formData.deliveryTimeMaxMinutes);
    if (min !== undefined && max !== undefined && min > max)
      errors.deliveryTimeMaxMinutes = t("rest.time_invalid");

    if (!formData.city.trim()) errors.city = required(t("common.city"));
    if (!formData.address.trim())
      errors.address = required(t("rest.street_address"));

    const hasLat = formData.latitude.trim() !== "";
    const hasLng = formData.longitude.trim() !== "";
    if (hasLat !== hasLng) {
      errors[hasLat ? "longitude" : "latitude"] = t("rest.lat_lng_together");
    } else if (hasLat) {
      const lat = Number(formData.latitude);
      const lng = Number(formData.longitude);
      if (!Number.isFinite(lat) || Math.abs(lat) > 90)
        errors.latitude = t("rest.lat_range");
      if (!Number.isFinite(lng) || Math.abs(lng) > 180)
        errors.longitude = t("rest.lng_range");
    }

    return {
      errors,
      hours: validateWeekSchedule(week, t),
      zone: validateZones(zones, t),
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const { errors, hours, zone } = validate();
    setFieldErrors(errors);
    setHoursError(hours);
    setZoneError(zone);

    const firstField = FIELD_KEYS.find((key) => errors[key]);
    if (firstField) {
      setTab(FIELD_TAB[firstField]);
      pendingFocus.current = fid(firstField);
      toast.error(errors[firstField] as string);
      return;
    }
    if (hours) {
      setTab("hours");
      pendingFocus.current = hoursFieldId(ID_PREFIX, hours.day);
      toast.error(hours.message);
      return;
    }
    if (zone) {
      setTab("zones");
      pendingFocus.current = zoneFieldId(ID_PREFIX, zone.index);
      toast.error(zone.message);
      return;
    }

    if (uploadsInFlight > 0) {
      toast.error(t("upload.wait"));
      return;
    }

    setIsSubmitting(true);

    // The API stores E.164 and looks the owner account up by it, so the fixed
    // +961 the operator sees has to be reattached before this leaves.
    const phone = toInternationalPhone(formData.phone);
    const ownerPhoneNumber = toInternationalPhone(formData.ownerPhoneNumber);

    const payload: RestaurantCreate = {
      name: formData.name.trim(),
      status: "active", // an admin-created merchant goes live immediately
      ownerPhoneNumber,
      city: formData.city.trim(),
      address: formData.address.trim(),
      openingHours: toOpeningHours(week),
      ...(formData.description.trim()
        ? { description: formData.description.trim() }
        : {}),
      ...(phone ? { phone } : {}),
      ...(formData.website.trim() ? { website: formData.website.trim() } : {}),
      ...(formData.ownerFullName.trim()
        ? { ownerFullName: formData.ownerFullName.trim() }
        : {}),
      ...(formData.logo.trim() ? { logo: formData.logo.trim() } : {}),
      ...(formData.backgroundImageUrl.trim()
        ? { backgroundImageUrl: formData.backgroundImageUrl.trim() }
        : {}),
      ...(formData.currencyId ? { currencyId: formData.currencyId } : {}),
    };

    const deliveryFee = numeric(formData.deliveryFee);
    const min = numeric(formData.deliveryTimeMinMinutes);
    const max = numeric(formData.deliveryTimeMaxMinutes);
    if (pin) {
      payload.latitude = pin.lat;
      payload.longitude = pin.lng;
    }
    if (deliveryFee !== undefined) payload.deliveryFee = deliveryFee;
    if (min !== undefined) payload.deliveryTimeMinMinutes = min;
    if (max !== undefined) payload.deliveryTimeMaxMinutes = max;
    if (zones.length > 0) payload.deliveryZones = zonesToPayload(zones, t);

    try {
      const created = await restaurantsService.createRestaurant(payload);

      // A second request on purpose — see `restaurantsService.setCategories`.
      // The restaurant exists either way; only the categories are at risk.
      if (categoryIds.length > 0) {
        const newId = readId(created);
        try {
          if (!newId) throw new Error(t("rest.categories_no_id"));
          await restaurantsService.setCategories(newId, categoryIds);
        } catch (categoryError) {
          console.error("Failed to set restaurant categories", categoryError);
          // A refused *property* is a missing API field, not operator error,
          // and retrying will never help — so it gets its own sentence.
          toast.error(
            isUnknownPropertyError(categoryError, "categoryIds")
              ? t("rest.categories_unsupported")
              : t("rest.categories_saved_failed", {
                  reason:
                    categoryError instanceof Error
                      ? categoryError.message
                      : t("rest.categories_failed"),
                }),
            { duration: 9000 },
          );
        }
      }

      toast.success(t("rest.created"));
      // Closing unmounts the form, so the next "Add Restaurant" starts blank
      // instead of reopening on this merchant's data.
      setIsDirty(false);
      onSuccess();
      onClose();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : t("rest.create_failed");
      console.error("Failed to create restaurant", err);
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const tabHasError: Record<Tab, boolean> = {
    details: FIELD_KEYS.some(
      (key) => FIELD_TAB[key] === "details" && !!fieldErrors[key],
    ),
    location: FIELD_KEYS.some(
      (key) => FIELD_TAB[key] === "location" && !!fieldErrors[key],
    ),
    hours: !!hoursError,
    zones: !!zoneError,
  };

  const tabLabel: Record<Tab, string> = {
    details: t("rest.tab_details"),
    location: t("rest.tab_location"),
    hours: t("rest.tab_hours"),
    zones: t("rest.tab_zones"),
  };

  const describedBy = (key: FieldKey) =>
    fieldErrors[key] ? `${fid(key)}-error` : undefined;

  const panelProps = (id: Tab) => ({
    id: formPanelId(ID_PREFIX, id),
    role: "tabpanel" as const,
    "aria-labelledby": formTabId(ID_PREFIX, id),
    className: "animate-in fade-in duration-150",
  });

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={t("rest.add_title")}
      description={t("rest.add_desc")}
      maxWidth="max-w-3xl"
      // Escape / backdrop stay live until there is typing to lose.
      dismissable={!isDirty && !isSubmitting && uploadsInFlight === 0}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
          >
            {t("common.cancel")}
          </button>
          <button
            type="submit"
            form="add-restaurant-form"
            disabled={isSubmitting || uploadsInFlight > 0}
            className="px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg shadow-sm shadow-orange-500/20 transition-all flex items-center gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {t("common.creating")}
              </>
            ) : (
              t("rest.create_cta")
            )}
          </button>
        </>
      }
    >
      <form
        id="add-restaurant-form"
        onSubmit={handleSubmit}
        noValidate
        className="space-y-4"
      >
        <FormTabs
          idPrefix={ID_PREFIX}
          active={tab}
          onChange={setTab}
          tabs={TABS.map((id) => ({
            id,
            label: tabLabel[id],
            hasError: tabHasError[id],
          }))}
        />

        {tab === "details" && (
          <div {...panelProps("details")}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5 md:col-span-2">
                <label htmlFor={fid("name")} className={LABEL_CLASS}>
                  {t("rest.name")}
                  <Req />
                </label>
                <input
                  id={fid("name")}
                  name="name"
                  aria-required="true"
                  aria-invalid={!!fieldErrors.name}
                  aria-describedby={describedBy("name")}
                  value={formData.name}
                  onChange={handleChange}
                  className={FIELD_CLASS}
                />
                <FieldError id={`${fid("name")}-error`} message={fieldErrors.name} />
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <label htmlFor={fid("description")} className={LABEL_CLASS}>
                  {t("common.description")}
                </label>
                <textarea
                  id={fid("description")}
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  rows={2}
                  className={FIELD_CLASS}
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor={fid("phone")} className={LABEL_CLASS}>
                  {t("rest.phone")}
                </label>
                <PhoneNumberInput
                  id={fid("phone")}
                  value={formData.phone}
                  onChange={setPhone("phone")}
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor={fid("website")} className={LABEL_CLASS}>
                  {t("common.website")}
                </label>
                <input
                  id={fid("website")}
                  name="website"
                  type="url"
                  placeholder="https://"
                  value={formData.website}
                  onChange={handleChange}
                  className={FIELD_CLASS}
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor={fid("ownerFullName")} className={LABEL_CLASS}>
                  {t("rest.owner_name")}
                </label>
                <input
                  id={fid("ownerFullName")}
                  name="ownerFullName"
                  value={formData.ownerFullName}
                  onChange={handleChange}
                  className={FIELD_CLASS}
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor={fid("ownerPhoneNumber")} className={LABEL_CLASS}>
                  {t("rest.owner_phone")}
                  <Req />
                </label>
                <PhoneNumberInput
                  id={fid("ownerPhoneNumber")}
                  value={formData.ownerPhoneNumber}
                  onChange={setPhone("ownerPhoneNumber")}
                />
                <FieldError
                  id={`${fid("ownerPhoneNumber")}-error`}
                  message={fieldErrors.ownerPhoneNumber}
                />
                <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                  {t("rest.owner_hint")}
                </p>
              </div>

              <div className="space-y-1.5">
                <label htmlFor={fid("currencyId")} className={LABEL_CLASS}>
                  {t("rest.pricing_currency")}
                </label>
                <select
                  id={fid("currencyId")}
                  name="currencyId"
                  value={formData.currencyId}
                  onChange={handleChange}
                  className={FIELD_CLASS}
                >
                  <option value="">{t("rest.platform_default")}</option>
                  {currencies.map((currency) => (
                    <option key={currency.code} value={currency.code}>
                      {currency.code} — {currency.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <CategoryPicker
                  idPrefix={fid("categories")}
                  value={categoryIds}
                  onChange={(next) => {
                    setCategoryIds(next);
                    setIsDirty(true);
                  }}
                  disabled={isSubmitting}
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor={fid("deliveryFee")} className={LABEL_CLASS}>
                  {t("common.delivery_fee")}
                </label>
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  id={fid("deliveryFee")}
                  name="deliveryFee"
                  value={formData.deliveryFee}
                  onChange={handleChange}
                  className={FIELD_CLASS}
                />
                <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                  {t("rest.fee_hint")}
                </p>
              </div>

              <div className="space-y-1.5">
                <label htmlFor={fid("deliveryTimeMinMinutes")} className={LABEL_CLASS}>
                  {t("rest.time_min")}
                </label>
                <input
                  type="number"
                  min={0}
                  id={fid("deliveryTimeMinMinutes")}
                  name="deliveryTimeMinMinutes"
                  value={formData.deliveryTimeMinMinutes}
                  onChange={handleChange}
                  className={FIELD_CLASS}
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor={fid("deliveryTimeMaxMinutes")} className={LABEL_CLASS}>
                  {t("rest.time_max")}
                </label>
                <input
                  type="number"
                  min={0}
                  id={fid("deliveryTimeMaxMinutes")}
                  name="deliveryTimeMaxMinutes"
                  aria-invalid={!!fieldErrors.deliveryTimeMaxMinutes}
                  aria-describedby={describedBy("deliveryTimeMaxMinutes")}
                  value={formData.deliveryTimeMaxMinutes}
                  onChange={handleChange}
                  className={FIELD_CLASS}
                />
                <FieldError
                  id={`${fid("deliveryTimeMaxMinutes")}-error`}
                  message={fieldErrors.deliveryTimeMaxMinutes}
                />
              </div>

              <ImageUploadField
                className="md:col-span-2"
                label={t("common.logo")}
                value={formData.logo}
                onChange={setImage("logo")}
                onUploadingChange={trackUpload}
                disabled={isSubmitting}
              />
              <ImageUploadField
                className="md:col-span-2"
                label={t("common.background_image")}
                aspect="wide"
                value={formData.backgroundImageUrl}
                onChange={setImage("backgroundImageUrl")}
                onUploadingChange={trackUpload}
                disabled={isSubmitting}
              />
            </div>
          </div>
        )}

        {tab === "location" && (
          <div {...panelProps("location")}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label htmlFor={fid("city")} className={LABEL_CLASS}>
                  {t("common.city")}
                  <Req />
                </label>
                <input
                  id={fid("city")}
                  name="city"
                  aria-required="true"
                  aria-invalid={!!fieldErrors.city}
                  aria-describedby={describedBy("city")}
                  value={formData.city}
                  onChange={handleChange}
                  className={FIELD_CLASS}
                />
                <FieldError id={`${fid("city")}-error`} message={fieldErrors.city} />
              </div>
              <div className="space-y-1.5">
                <label htmlFor={fid("address")} className={LABEL_CLASS}>
                  {t("rest.street_address")}
                  <Req />
                </label>
                <input
                  id={fid("address")}
                  name="address"
                  aria-required="true"
                  aria-invalid={!!fieldErrors.address}
                  aria-describedby={describedBy("address")}
                  value={formData.address}
                  onChange={handleChange}
                  className={FIELD_CLASS}
                />
                <FieldError
                  id={`${fid("address")}-error`}
                  message={fieldErrors.address}
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor={fid("latitude")} className={LABEL_CLASS}>
                  {t("common.latitude")}
                </label>
                <input
                  type="number"
                  step="any"
                  min={-90}
                  max={90}
                  id={fid("latitude")}
                  name="latitude"
                  aria-invalid={!!fieldErrors.latitude}
                  aria-describedby={describedBy("latitude")}
                  value={formData.latitude}
                  onChange={handleChange}
                  className={FIELD_CLASS}
                />
                <FieldError
                  id={`${fid("latitude")}-error`}
                  message={fieldErrors.latitude}
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor={fid("longitude")} className={LABEL_CLASS}>
                  {t("common.longitude")}
                </label>
                <input
                  type="number"
                  step="any"
                  min={-180}
                  max={180}
                  id={fid("longitude")}
                  name="longitude"
                  aria-invalid={!!fieldErrors.longitude}
                  aria-describedby={describedBy("longitude")}
                  value={formData.longitude}
                  onChange={handleChange}
                  className={FIELD_CLASS}
                />
                <FieldError
                  id={`${fid("longitude")}-error`}
                  message={fieldErrors.longitude}
                />
              </div>

              <div className="md:col-span-2 space-y-1.5">
                <p className={LABEL_CLASS}>{t("rest.map_pin_title")}</p>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  {t("rest.map_pin_hint")}
                </p>
                <RestaurantMapEditor
                  mode="pin"
                  pin={pin}
                  onPinChange={setPin}
                  disabled={isSubmitting}
                />
              </div>
            </div>
          </div>
        )}

        {tab === "hours" && (
          <div {...panelProps("hours")}>
            <OpeningHoursEditor
              idPrefix={ID_PREFIX}
              value={week}
              onChange={handleWeekChange}
              error={hoursError}
              disabled={isSubmitting}
            />
          </div>
        )}

        {tab === "zones" && (
          <div {...panelProps("zones")}>
            <DeliveryZonesEditor
              idPrefix={ID_PREFIX}
              zones={zones}
              onChange={handleZonesChange}
              pin={pin}
              error={zoneError}
              disabled={isSubmitting}
            />
          </div>
        )}
      </form>
    </Modal>
  );
}
