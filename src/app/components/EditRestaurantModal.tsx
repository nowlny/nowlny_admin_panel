"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import Modal from "./ui/Modal";
import ImageUploadField from "./ui/ImageUploadField";
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
  hoursFieldId,
  toOpeningHours,
  toWeekSchedule,
  validateWeekSchedule,
} from "./ui/OpeningHoursEditor";
import DeliveryZonesEditor, {
  ZoneDraft,
  ZoneError,
  validateZones,
  zoneFieldId,
  zonesFromApi,
  zonesToPayload,
} from "./ui/DeliveryZonesEditor";
import {
  restaurantsService,
  RestaurantUpdate,
  RestaurantResponse,
  RestaurantStatus,
} from "../../services/restaurants";
import { currenciesService, Currency } from "../../services/currencies";
import { statusLabel } from "./ui/StatusPill";
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

interface EditRestaurantModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  restaurant: RestaurantResponse | null;
}

/*
 * `PATCH /api/v1/restaurants/{id}` accepts `openingHours` and `deliveryZones`
 * alongside the profile fields, but this form never exposed them — so once a
 * restaurant was created by an admin, only the owner could ever set its hours
 * or coverage. Both are replace-all fields on the API, so they are only sent
 * when the operator actually touched that tab; an untouched tab must not echo
 * a stale copy back.
 */

type Tab = "details" | "location" | "hours" | "zones";
const TABS: Tab[] = ["details", "location", "hours", "zones"];

type FieldKey =
  | "name"
  | "deliveryTimeMaxMinutes"
  | "addressCity"
  | "addressStreet"
  | "addressLat"
  | "addressLng";

const FIELD_KEYS: FieldKey[] = [
  "name",
  "deliveryTimeMaxMinutes",
  "addressCity",
  "addressStreet",
  "addressLat",
  "addressLng",
];

const FIELD_TAB: Record<FieldKey, Tab> = {
  name: "details",
  deliveryTimeMaxMinutes: "details",
  addressCity: "location",
  addressStreet: "location",
  addressLat: "location",
  addressLng: "location",
};

type FieldErrors = Partial<Record<FieldKey, string>>;
type ZonesStatus = "loading" | "ready" | "failed";

const ID_PREFIX = "edit-rest";
const fid = (name: string) => `${ID_PREFIX}-${name}`;

const STATUS_OPTIONS: RestaurantStatus[] = ["active", "inactive", "suspended"];

/**
 * Blank stays blank. `parseFloat(x) || 0` used to turn every untouched numeric
 * field into a real `0` in the PATCH body, so editing a phone number on a
 * merchant with no coordinates relocated it to 0°,0° in the Gulf of Guinea.
 */
const numeric = (value: string): number | undefined => {
  if (value.trim() === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
};

/**
 * The address is read from `restaurantAddress` — the flat `city`/`address`/
 * `latitude`/`longitude` fields this form used to bind to were removed from
 * the API, so every merchant opened with an empty location block.
 */
const formFromRestaurant = (restaurant: RestaurantResponse) => {
  const address = restaurant.restaurantAddress;
  return {
    name: restaurant.name || "",
    description: restaurant.description || "",
    phone: restaurant.phone || "",
    website: restaurant.website || "",
    ownerFullName: "",
    ownerPhoneNumber: "",
    status: (restaurant.status as RestaurantStatus) || "active",
    currencyId: restaurant.currency?.code || restaurant.currencyId || "",
    addressCity: address?.city || "",
    addressStreet: address?.street || "",
    addressBuilding: address?.building || "",
    addressLat: address?.latitude != null ? String(address.latitude) : "",
    addressLng: address?.longitude != null ? String(address.longitude) : "",
    deliveryFee:
      restaurant.deliveryFee != null ? String(restaurant.deliveryFee) : "",
    deliveryTimeMinMinutes:
      restaurant.deliveryTimeMinMinutes != null
        ? String(restaurant.deliveryTimeMinMinutes)
        : "",
    deliveryTimeMaxMinutes:
      restaurant.deliveryTimeMaxMinutes != null
        ? String(restaurant.deliveryTimeMaxMinutes)
        : "",
    logo: restaurant.logo || "",
    backgroundImageUrl: restaurant.backgroundImageUrl || "",
  };
};

export default function EditRestaurantModal({
  isOpen,
  onClose,
  onSuccess,
  restaurant,
}: EditRestaurantModalProps) {
  // Mounted only while open and keyed by merchant, so state initialises from
  // the record on mount instead of through a reset effect — and reopening
  // after a cancelled edit can no longer replay what was typed last time.
  if (!isOpen || !restaurant) return null;
  return (
    <EditRestaurantForm
      key={restaurant.id}
      restaurant={restaurant}
      onClose={onClose}
      onSuccess={onSuccess}
    />
  );
}

function EditRestaurantForm({
  onClose,
  onSuccess,
  restaurant,
}: Omit<EditRestaurantModalProps, "isOpen" | "restaurant"> & {
  restaurant: RestaurantResponse;
}) {
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>("details");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadsInFlight, setUploadsInFlight] = useState(0);
  const [isDirty, setIsDirty] = useState(false);
  const [formData, setFormData] = useState(() => formFromRestaurant(restaurant));
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  /**
   * The categories this restaurant is already in.
   *
   * The record carries them expanded (`categories`) and, on some responses,
   * as bare ids — either is a valid starting point, and an untouched picker
   * must submit exactly what it started with.
   */
  const [categoryIds, setCategoryIds] = useState<string[]>(() =>
    restaurant.categories?.length
      ? restaurant.categories.map((category) => category.id)
      : (restaurant.categoryIds ?? []),
  );
  const [categoriesTouched, setCategoriesTouched] = useState(false);

  const [week, setWeek] = useState<WeekSchedule>(() =>
    toWeekSchedule(restaurant.openingHours),
  );
  const [hoursTouched, setHoursTouched] = useState(false);
  const hadHours = !!restaurant.openingHours?.length;

  // The list payload does not carry zones; the dedicated endpoint does. The
  // detail's own copy (if any) stands in until that call answers.
  const [zones, setZones] = useState<ZoneDraft[]>(() =>
    zonesFromApi(restaurant.deliveryZones),
  );
  const [zonesTouched, setZonesTouched] = useState(false);
  const zonesTouchedRef = useRef(false);
  const [zonesStatus, setZonesStatus] = useState<ZonesStatus>("loading");

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [hoursError, setHoursError] = useState<WeekScheduleError | null>(null);
  const [zoneError, setZoneError] = useState<ZoneError | null>(null);
  // Set on a failed submit, consumed once the failing tab has rendered.
  const pendingFocus = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    currenciesService
      .getActiveCurrencies()
      .then((list) => {
        if (!cancelled) setCurrencies(list);
      })
      .catch((err) =>
        console.warn("Could not load currencies:", err?.message ?? err),
      );
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    restaurantsService
      .getDeliveryZones(restaurant.id)
      .then((list) => {
        if (cancelled) return;
        // Don't clobber corners the operator has already started drawing.
        if (!zonesTouchedRef.current) setZones(zonesFromApi(list));
        setZonesStatus("ready");
      })
      .catch((err) => {
        if (cancelled) return;
        console.warn("Could not load delivery zones:", err?.message ?? err);
        setZonesStatus("failed");
      });
    return () => {
      cancelled = true;
    };
  }, [restaurant.id]);

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

  const pin = useMemo<LatLng | null>(() => {
    const lat = numeric(formData.addressLat);
    const lng = numeric(formData.addressLng);
    return lat !== undefined && lng !== undefined ? { lat, lng } : null;
  }, [formData.addressLat, formData.addressLng]);

  const setPin = (next: LatLng) => {
    setIsDirty(true);
    setFormData((prev) => ({
      ...prev,
      addressLat: next.lat.toFixed(6),
      addressLng: next.lng.toFixed(6),
    }));
    clearFieldError("addressLat");
    clearFieldError("addressLng");
  };

  const handleWeekChange = (next: WeekSchedule) => {
    setIsDirty(true);
    setHoursTouched(true);
    setWeek(next);
    setHoursError(null);
  };

  const handleZonesChange = (next: ZoneDraft[]) => {
    setIsDirty(true);
    setZonesTouched(true);
    zonesTouchedRef.current = true;
    setZones(next);
    setZoneError(null);
  };

  const trackUpload = (isUploading: boolean) =>
    setUploadsInFlight((n) => Math.max(0, n + (isUploading ? 1 : -1)));

  const validate = () => {
    const errors: FieldErrors = {};

    if (!formData.name.trim())
      errors.name = t("rest.required_field", { field: t("common.name") });

    const min = numeric(formData.deliveryTimeMinMinutes);
    const max = numeric(formData.deliveryTimeMaxMinutes);
    if (min !== undefined && max !== undefined && min > max)
      errors.deliveryTimeMaxMinutes = t("rest.time_invalid");

    // The address is only sent when it's complete: the DTO requires city,
    // street and both coordinates together, and a partial object used to
    // overwrite a good address with blanks.
    const parts: FieldKey[] = [
      "addressCity",
      "addressStreet",
      "addressLat",
      "addressLng",
    ];
    const filled = parts.filter((key) => formData[key].trim() !== "");
    if (filled.length > 0 && filled.length < parts.length) {
      const missing = parts.find((key) => formData[key].trim() === "");
      if (missing) errors[missing] = t("rest.address_incomplete");
    }
    if (formData.addressLat.trim()) {
      const lat = Number(formData.addressLat);
      if (!Number.isFinite(lat) || Math.abs(lat) > 90)
        errors.addressLat = t("rest.lat_range");
    }
    if (formData.addressLng.trim()) {
      const lng = Number(formData.addressLng);
      if (!Number.isFinite(lng) || Math.abs(lng) > 180)
        errors.addressLng = t("rest.lng_range");
    }

    return {
      errors,
      hours: hoursTouched ? validateWeekSchedule(week, t) : null,
      zone: zonesTouched ? validateZones(zones, t) : null,
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

    const payload: RestaurantUpdate = {
      name: formData.name.trim(),
      description: formData.description,
      phone: formData.phone,
      website: formData.website,
      logo: formData.logo,
      backgroundImageUrl: formData.backgroundImageUrl,
      status: formData.status,
      ...(formData.currencyId ? { currencyId: formData.currencyId } : {}),
      ...(formData.ownerFullName.trim()
        ? { ownerFullName: formData.ownerFullName.trim() }
        : {}),
      ...(formData.ownerPhoneNumber.trim()
        ? { ownerPhoneNumber: formData.ownerPhoneNumber.trim() }
        : {}),
    };

    const deliveryFee = numeric(formData.deliveryFee);
    const min = numeric(formData.deliveryTimeMinMinutes);
    const max = numeric(formData.deliveryTimeMaxMinutes);
    if (deliveryFee !== undefined) payload.deliveryFee = deliveryFee;
    if (min !== undefined) payload.deliveryTimeMinMinutes = min;
    if (max !== undefined) payload.deliveryTimeMaxMinutes = max;

    if (pin && formData.addressCity.trim() && formData.addressStreet.trim()) {
      payload.restaurantAddress = {
        city: formData.addressCity.trim(),
        street: formData.addressStreet.trim(),
        building: formData.addressBuilding.trim() || undefined,
        latitude: pin.lat,
        longitude: pin.lng,
      };
    }

    // Both replace everything the server holds — only send what was edited.
    if (hoursTouched) payload.openingHours = toOpeningHours(week);
    if (zonesTouched) payload.deliveryZones = zonesToPayload(zones, t);

    try {
      await restaurantsService.updateRestaurant(restaurant.id, payload);

      // Only when the operator actually changed them: sending the list back
      // unchanged would replace every category with itself, and a backend that
      // rejects the field would report a failure nobody asked for.
      if (categoriesTouched) {
        try {
          await restaurantsService.setCategories(restaurant.id, categoryIds);
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

      toast.success(t("rest.updated"));
      setIsDirty(false);
      onSuccess();
      onClose();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : t("rest.update_failed");
      console.error("Failed to update restaurant", err);
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

  const zonesNotice =
    zonesStatus === "loading" ? (
      <p className="flex items-center gap-2 text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        {t("rest.zones_loading")}
      </p>
    ) : zonesStatus === "failed" ? (
      <p
        role="alert"
        className="text-[11px] font-semibold text-amber-600 dark:text-amber-400"
      >
        {t("rest.zones_load_failed")}
      </p>
    ) : (
      <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
        {t("rest.zones_replace_hint")}
      </p>
    );

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={t("rest.edit_title")}
      description={restaurant.name}
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
            form="edit-restaurant-form"
            disabled={isSubmitting || uploadsInFlight > 0}
            className="px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg shadow-sm shadow-orange-500/20 transition-all flex items-center gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {t("common.updating")}
              </>
            ) : (
              t("common.save_changes")
            )}
          </button>
        </>
      }
    >
      <form
        id="edit-restaurant-form"
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
              <div className="space-y-1.5">
                <label htmlFor={fid("name")} className={LABEL_CLASS}>
                  {t("common.name")}
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
              <div className="space-y-1.5">
                <label htmlFor={fid("status")} className={LABEL_CLASS}>
                  {t("common.status")}
                </label>
                <select
                  id={fid("status")}
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  className={FIELD_CLASS}
                >
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {statusLabel(option, t)}
                    </option>
                  ))}
                </select>
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
                  {t("common.phone")}
                </label>
                <input
                  id={fid("phone")}
                  name="phone"
                  inputMode="tel"
                  value={formData.phone}
                  onChange={handleChange}
                  className={FIELD_CLASS}
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
                  value={formData.website}
                  onChange={handleChange}
                  className={FIELD_CLASS}
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor={fid("ownerFullName")} className={LABEL_CLASS}>
                  {t("rest.reassign_name")}
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
                  {t("rest.reassign_phone")}
                </label>
                <input
                  id={fid("ownerPhoneNumber")}
                  name="ownerPhoneNumber"
                  inputMode="tel"
                  value={formData.ownerPhoneNumber}
                  onChange={handleChange}
                  className={FIELD_CLASS}
                />
                <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                  {t("rest.reassign_hint")}
                </p>
              </div>

              <div className="col-span-1 md:col-span-2 pt-4 pb-2">
                <h4 className="text-sm font-bold text-zinc-900 dark:text-white border-b border-zinc-200 dark:border-zinc-700 pb-2">
                  {t("rest.section_delivery")}
                </h4>
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
                  <option value="">{t("rest.unchanged")}</option>
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
                    setCategoriesTouched(true);
                    setIsDirty(true);
                  }}
                  disabled={isSubmitting}
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor={fid("deliveryFee")} className={LABEL_CLASS}>
                  {restaurant.currency?.code
                    ? t("rest.fee_with_currency", {
                        code: restaurant.currency.code,
                      })
                    : t("common.delivery_fee")}
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

              <div className="col-span-1 md:col-span-2 pt-4 pb-2">
                <h4 className="text-sm font-bold text-zinc-900 dark:text-white border-b border-zinc-200 dark:border-zinc-700 pb-2">
                  {t("rest.section_media")}
                </h4>
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
              <p className="md:col-span-2 text-[11px] text-zinc-500 dark:text-zinc-400">
                {t("rest.address_incomplete")}
              </p>
              <div className="space-y-1.5">
                <label htmlFor={fid("addressCity")} className={LABEL_CLASS}>
                  {t("common.city")}
                </label>
                <input
                  id={fid("addressCity")}
                  name="addressCity"
                  aria-invalid={!!fieldErrors.addressCity}
                  aria-describedby={describedBy("addressCity")}
                  value={formData.addressCity}
                  onChange={handleChange}
                  className={FIELD_CLASS}
                />
                <FieldError
                  id={`${fid("addressCity")}-error`}
                  message={fieldErrors.addressCity}
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor={fid("addressStreet")} className={LABEL_CLASS}>
                  {t("common.street")}
                </label>
                <input
                  id={fid("addressStreet")}
                  name="addressStreet"
                  aria-invalid={!!fieldErrors.addressStreet}
                  aria-describedby={describedBy("addressStreet")}
                  value={formData.addressStreet}
                  onChange={handleChange}
                  className={FIELD_CLASS}
                />
                <FieldError
                  id={`${fid("addressStreet")}-error`}
                  message={fieldErrors.addressStreet}
                />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <label htmlFor={fid("addressBuilding")} className={LABEL_CLASS}>
                  {t("common.building")}
                </label>
                <input
                  id={fid("addressBuilding")}
                  name="addressBuilding"
                  value={formData.addressBuilding}
                  onChange={handleChange}
                  className={FIELD_CLASS}
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor={fid("addressLat")} className={LABEL_CLASS}>
                  {t("common.latitude")}
                </label>
                <input
                  type="number"
                  step="any"
                  min={-90}
                  max={90}
                  id={fid("addressLat")}
                  name="addressLat"
                  aria-invalid={!!fieldErrors.addressLat}
                  aria-describedby={describedBy("addressLat")}
                  value={formData.addressLat}
                  onChange={handleChange}
                  className={FIELD_CLASS}
                />
                <FieldError
                  id={`${fid("addressLat")}-error`}
                  message={fieldErrors.addressLat}
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor={fid("addressLng")} className={LABEL_CLASS}>
                  {t("common.longitude")}
                </label>
                <input
                  type="number"
                  step="any"
                  min={-180}
                  max={180}
                  id={fid("addressLng")}
                  name="addressLng"
                  aria-invalid={!!fieldErrors.addressLng}
                  aria-describedby={describedBy("addressLng")}
                  value={formData.addressLng}
                  onChange={handleChange}
                  className={FIELD_CLASS}
                />
                <FieldError
                  id={`${fid("addressLng")}-error`}
                  message={fieldErrors.addressLng}
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
          <div {...panelProps("hours")} >
            <div className="space-y-3">
              {!hadHours && (
                <p className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                  {t("rest.hours_none_yet")}
                </p>
              )}
              <OpeningHoursEditor
                idPrefix={ID_PREFIX}
                value={week}
                onChange={handleWeekChange}
                error={hoursError}
                disabled={isSubmitting}
              />
            </div>
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
              disabled={isSubmitting || zonesStatus === "loading"}
              notice={zonesNotice}
            />
          </div>
        )}
      </form>
    </Modal>
  );
}
