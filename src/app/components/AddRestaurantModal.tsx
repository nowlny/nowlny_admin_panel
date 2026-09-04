import React, { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import Modal from "./ui/Modal";
import ImageUploadField from "./ui/ImageUploadField";
import PhoneNumberInput from "./ui/PhoneNumberInput";
import { toInternationalPhone } from "../../lib/phone";
import {
  restaurantsService,
  RestaurantCreate,
  OpeningHourEntry,
  WEEK_DAYS,
} from "../../services/restaurants";
import { currenciesService, Currency } from "../../services/currencies";

import { useI18n } from "../../lib/i18n";
interface AddRestaurantModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

/**
 * The form used to collect `email`, `cuisineType`, `coverImage` and
 * `estimatedDeliveryMinutes` — none of which exist on `CreateRestaurantDto` —
 * while omitting `currencyId` and the min/max delivery window, which do. It
 * also sent capitalised weekday names against an enum that only accepts
 * lowercase. Every one of those made the request a 400.
 */
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

const DEFAULT_HOURS: OpeningHourEntry[] = WEEK_DAYS.map((day) => ({
  day,
  is24Hours: false,
  openTime: "08:00",
  closeTime: "23:00",
}));

const FIELD_CLASS =
  "w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-colors";
const LABEL_CLASS = "text-xs font-semibold text-zinc-700 dark:text-zinc-300";

/** Red asterisk that isn't announced twice — the input already has `required`. */
function Req() {
  return (
    <span aria-hidden="true" className="text-red-500 ms-0.5">
      *
    </span>
  );
}

/** Blank stays blank so an untouched numeric field isn't submitted as 0. */
const numeric = (value: string): number | undefined => {
  if (value.trim() === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
};

export default function AddRestaurantModal({
  isOpen,
  onClose,
  onSuccess,
}: AddRestaurantModalProps) {
  const { t } = useI18n();
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Submitting mid-upload would create the merchant with no artwork and
  // silently drop the image the operator just picked.
  const [uploadsInFlight, setUploadsInFlight] = useState(0);
  const [isDirty, setIsDirty] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [currencies, setCurrencies] = useState<Currency[]>([]);

  // Merchants price in their own currency (LBP for most of the platform), so
  // the operator has to be able to pick one at creation time.
  useEffect(() => {
    if (!isOpen) return;
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
  }, [isOpen]);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    setIsDirty(true);
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const setImage = (field: "logo" | "backgroundImageUrl") => (url: string) => {
    setIsDirty(true);
    setFormData((prev) => ({ ...prev, [field]: url }));
  };

  const setPhone =
    (field: "phone" | "ownerPhoneNumber") => (digits: string) => {
      setIsDirty(true);
      setFormData((prev) => ({ ...prev, [field]: digits }));
    };

  const trackUpload = (isUploading: boolean) =>
    setUploadsInFlight((n) => Math.max(0, n + (isUploading ? 1 : -1)));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const min = numeric(formData.deliveryTimeMinMinutes);
    const max = numeric(formData.deliveryTimeMaxMinutes);
    if (min !== undefined && max !== undefined && min > max) {
      toast.error(t("rest.time_invalid"));
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
      openingHours: { entries: DEFAULT_HOURS },
      ...(formData.description.trim()
        ? { description: formData.description.trim() }
        : {}),
      ...(phone ? { phone } : {}),
      ...(formData.website.trim() ? { website: formData.website.trim() } : {}),
      ...(formData.ownerFullName.trim()
        ? { ownerFullName: formData.ownerFullName.trim() }
        : {}),
      ...(ownerPhoneNumber ? { ownerPhoneNumber } : {}),
      ...(formData.city.trim() ? { city: formData.city.trim() } : {}),
      ...(formData.address.trim() ? { address: formData.address.trim() } : {}),
      ...(formData.logo.trim() ? { logo: formData.logo.trim() } : {}),
      ...(formData.backgroundImageUrl.trim()
        ? { backgroundImageUrl: formData.backgroundImageUrl.trim() }
        : {}),
      ...(formData.currencyId ? { currencyId: formData.currencyId } : {}),
    };

    const latitude = numeric(formData.latitude);
    const longitude = numeric(formData.longitude);
    const deliveryFee = numeric(formData.deliveryFee);
    if (latitude !== undefined) payload.latitude = latitude;
    if (longitude !== undefined) payload.longitude = longitude;
    if (deliveryFee !== undefined) payload.deliveryFee = deliveryFee;
    if (min !== undefined) payload.deliveryTimeMinMinutes = min;
    if (max !== undefined) payload.deliveryTimeMaxMinutes = max;

    try {
      await restaurantsService.createRestaurant(payload);
      toast.success(t("rest.created"));
      // Without this the next "Add Restaurant" reopens on the previous
      // merchant's data and quietly creates a near-duplicate.
      setFormData(EMPTY_FORM);
      setIsDirty(false);
      onSuccess();
      onClose();
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : t("rest.create_failed");
      console.error("Failed to create restaurant", err);
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t("rest.add_title")}
      description={t("rest.add_desc")}
      maxWidth="max-w-2xl"
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
        className="space-y-4"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5 md:col-span-2">
            <label htmlFor="add-rest-name" className={LABEL_CLASS}>
              {t("rest.name")}
              <Req />
            </label>
            <input
              required
              id="add-rest-name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className={FIELD_CLASS}
            />
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <label htmlFor="add-rest-description" className={LABEL_CLASS}>
              {t("common.description")}
            </label>
            <textarea
              id="add-rest-description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={2}
              className={FIELD_CLASS}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="add-rest-phone" className={LABEL_CLASS}>
              {t("rest.phone")}
            </label>
            <PhoneNumberInput
              id="add-rest-phone"
              value={formData.phone}
              onChange={setPhone("phone")}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="add-rest-website" className={LABEL_CLASS}>
              {t("common.website")}
            </label>
            <input
              id="add-rest-website"
              name="website"
              type="url"
              placeholder="https://"
              value={formData.website}
              onChange={handleChange}
              className={FIELD_CLASS}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="add-rest-owner-name" className={LABEL_CLASS}>
              {t("rest.owner_name")}
            </label>
            <input
              id="add-rest-owner-name"
              name="ownerFullName"
              value={formData.ownerFullName}
              onChange={handleChange}
              className={FIELD_CLASS}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="add-rest-owner-phone" className={LABEL_CLASS}>
              {t("rest.owner_phone")}
            </label>
            <PhoneNumberInput
              id="add-rest-owner-phone"
              value={formData.ownerPhoneNumber}
              onChange={setPhone("ownerPhoneNumber")}
            />
            <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
              {t("rest.owner_hint")}
            </p>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="add-rest-city" className={LABEL_CLASS}>
              {t("common.city")}
            </label>
            <input
              id="add-rest-city"
              name="city"
              value={formData.city}
              onChange={handleChange}
              className={FIELD_CLASS}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="add-rest-address" className={LABEL_CLASS}>
              {t("rest.street_address")}
            </label>
            <input
              id="add-rest-address"
              name="address"
              value={formData.address}
              onChange={handleChange}
              className={FIELD_CLASS}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="add-rest-latitude" className={LABEL_CLASS}>
              {t("common.latitude")}
            </label>
            <input
              type="number"
              step="any"
              min={-90}
              max={90}
              id="add-rest-latitude"
              name="latitude"
              value={formData.latitude}
              onChange={handleChange}
              className={FIELD_CLASS}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="add-rest-longitude" className={LABEL_CLASS}>
              {t("common.longitude")}
            </label>
            <input
              type="number"
              step="any"
              min={-180}
              max={180}
              id="add-rest-longitude"
              name="longitude"
              value={formData.longitude}
              onChange={handleChange}
              className={FIELD_CLASS}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="add-rest-currency" className={LABEL_CLASS}>
              {t("rest.pricing_currency")}
            </label>
            <select
              id="add-rest-currency"
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
          <div className="space-y-1.5">
            <label htmlFor="add-rest-fee" className={LABEL_CLASS}>
              {t("common.delivery_fee")}
            </label>
            <input
              type="number"
              step="0.01"
              min={0}
              id="add-rest-fee"
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
            <label htmlFor="add-rest-eta-min" className={LABEL_CLASS}>
              {t("rest.time_min")}
            </label>
            <input
              type="number"
              min={0}
              id="add-rest-eta-min"
              name="deliveryTimeMinMinutes"
              value={formData.deliveryTimeMinMinutes}
              onChange={handleChange}
              className={FIELD_CLASS}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="add-rest-eta-max" className={LABEL_CLASS}>
              {t("rest.time_max")}
            </label>
            <input
              type="number"
              min={0}
              id="add-rest-eta-max"
              name="deliveryTimeMaxMinutes"
              value={formData.deliveryTimeMaxMinutes}
              onChange={handleChange}
              className={FIELD_CLASS}
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
      </form>
    </Modal>
  );
}
