import React, { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import Modal from "./ui/Modal";
import {
  restaurantsService,
  RestaurantUpdate,
  RestaurantResponse,
  RestaurantStatus,
} from "../../services/restaurants";
import { currenciesService, Currency } from "../../services/currencies";
import { statusLabel } from "./ui/StatusPill";

import { useI18n } from "../../lib/i18n";
interface EditRestaurantModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  restaurant: RestaurantResponse | null;
}

const FIELD_CLASS =
  "w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-colors";
const LABEL_CLASS = "text-xs font-semibold text-zinc-700 dark:text-zinc-300";

const STATUS_OPTIONS: RestaurantStatus[] = ["active", "inactive", "suspended"];

/** Red asterisk that isn't announced twice — the input already has `required`. */
function Req() {
  return (
    <span aria-hidden="true" className="text-red-500 ms-0.5">
      *
    </span>
  );
}

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

const EMPTY_FORM = {
  name: "",
  description: "",
  phone: "",
  website: "",
  ownerFullName: "",
  ownerPhoneNumber: "",
  status: "active" as RestaurantStatus,
  currencyId: "",
  addressCity: "",
  addressStreet: "",
  addressBuilding: "",
  addressLat: "",
  addressLng: "",
  deliveryFee: "",
  deliveryTimeMinMinutes: "",
  deliveryTimeMaxMinutes: "",
  logo: "",
  backgroundImageUrl: "",
};

export default function EditRestaurantModal({
  isOpen,
  onClose,
  onSuccess,
  restaurant,
}: EditRestaurantModalProps) {
  const { t } = useI18n();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [formData, setFormData] = useState(EMPTY_FORM);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    currenciesService
      .getActiveCurrencies()
      .then((list) => !cancelled && setCurrencies(list))
      .catch((err) =>
        console.warn("Could not load currencies:", err?.message ?? err),
      );
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  /*
   * Also keyed on `isOpen`: reopening for the same merchant after a cancelled
   * edit used to replay whatever had been typed the previous time.
   *
   * The address is read from `restaurantAddress` — the flat `city`/`address`/
   * `latitude`/`longitude` fields this form used to bind to were removed from
   * the API, so every merchant opened with an empty location block.
   */
  useEffect(() => {
    if (!isOpen || !restaurant) return;
    setIsDirty(false);
    const address = restaurant.restaurantAddress;
    setFormData({
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
    });
  }, [restaurant, isOpen]);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    setIsDirty(true);
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restaurant) return;

    const min = numeric(formData.deliveryTimeMinMinutes);
    const max = numeric(formData.deliveryTimeMaxMinutes);
    if (min !== undefined && max !== undefined && min > max) {
      toast.error(t("rest.time_invalid"));
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
    if (deliveryFee !== undefined) payload.deliveryFee = deliveryFee;
    if (min !== undefined) payload.deliveryTimeMinMinutes = min;
    if (max !== undefined) payload.deliveryTimeMaxMinutes = max;

    // The address is only sent when it's complete: the DTO requires city,
    // street and both coordinates together, and a partial object used to
    // overwrite a good address with blanks.
    const lat = numeric(formData.addressLat);
    const lng = numeric(formData.addressLng);
    const hasCompleteAddress =
      formData.addressCity.trim() !== "" &&
      formData.addressStreet.trim() !== "" &&
      lat !== undefined &&
      lng !== undefined;

    if (hasCompleteAddress) {
      payload.restaurantAddress = {
        city: formData.addressCity.trim(),
        street: formData.addressStreet.trim(),
        building: formData.addressBuilding.trim() || undefined,
        latitude: lat,
        longitude: lng,
      };
    } else if (
      [
        formData.addressCity,
        formData.addressStreet,
        formData.addressLat,
        formData.addressLng,
      ].some((v) => v.trim() !== "")
    ) {
      setIsSubmitting(false);
      toast.error(
        t("rest.address_incomplete"),
      );
      return;
    }

    try {
      await restaurantsService.updateRestaurant(restaurant.id, payload);
      toast.success(t("rest.updated"));
      setIsDirty(false);
      onSuccess();
      onClose();
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : t("rest.update_failed");
      console.error("Failed to update restaurant", err);
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!restaurant) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t("rest.edit_title")}
      description={restaurant.name}
      maxWidth="max-w-2xl"
      // Escape / backdrop stay live until there is typing to lose.
      dismissable={!isDirty && !isSubmitting}
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
            disabled={isSubmitting}
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
        className="space-y-4"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label htmlFor="edit-rest-name" className={LABEL_CLASS}>
              {t("common.name")}
              <Req />
            </label>
            <input
              required
              id="edit-rest-name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className={FIELD_CLASS}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="edit-rest-status" className={LABEL_CLASS}>
              {t("common.status")}
            </label>
            <select
              id="edit-rest-status"
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
            <label htmlFor="edit-rest-description" className={LABEL_CLASS}>
              {t("common.description")}
            </label>
            <textarea
              id="edit-rest-description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={2}
              className={FIELD_CLASS}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="edit-rest-phone" className={LABEL_CLASS}>
              {t("common.phone")}
            </label>
            <input
              id="edit-rest-phone"
              name="phone"
              inputMode="tel"
              value={formData.phone}
              onChange={handleChange}
              className={FIELD_CLASS}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="edit-rest-website" className={LABEL_CLASS}>
              {t("common.website")}
            </label>
            <input
              id="edit-rest-website"
              name="website"
              type="url"
              value={formData.website}
              onChange={handleChange}
              className={FIELD_CLASS}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="edit-rest-owner-name" className={LABEL_CLASS}>
              {t("rest.reassign_name")}
            </label>
            <input
              id="edit-rest-owner-name"
              name="ownerFullName"
              value={formData.ownerFullName}
              onChange={handleChange}
              className={FIELD_CLASS}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="edit-rest-owner-phone" className={LABEL_CLASS}>
              {t("rest.reassign_phone")}
            </label>
            <input
              id="edit-rest-owner-phone"
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
              {t("rest.section_address")}
            </h4>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="edit-rest-addr-city" className={LABEL_CLASS}>
              {t("common.city")}
            </label>
            <input
              id="edit-rest-addr-city"
              name="addressCity"
              value={formData.addressCity}
              onChange={handleChange}
              className={FIELD_CLASS}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="edit-rest-addr-street" className={LABEL_CLASS}>
              {t("common.street")}
            </label>
            <input
              id="edit-rest-addr-street"
              name="addressStreet"
              value={formData.addressStreet}
              onChange={handleChange}
              className={FIELD_CLASS}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="edit-rest-addr-building" className={LABEL_CLASS}>
              {t("common.building")}
            </label>
            <input
              id="edit-rest-addr-building"
              name="addressBuilding"
              value={formData.addressBuilding}
              onChange={handleChange}
              className={FIELD_CLASS}
            />
          </div>
          <div className="space-y-1.5 hidden md:block" />
          <div className="space-y-1.5">
            <label htmlFor="edit-rest-addr-lat" className={LABEL_CLASS}>
              {t("common.latitude")}
            </label>
            <input
              type="number"
              step="any"
              min={-90}
              max={90}
              id="edit-rest-addr-lat"
              name="addressLat"
              value={formData.addressLat}
              onChange={handleChange}
              className={FIELD_CLASS}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="edit-rest-addr-lng" className={LABEL_CLASS}>
              {t("common.longitude")}
            </label>
            <input
              type="number"
              step="any"
              min={-180}
              max={180}
              id="edit-rest-addr-lng"
              name="addressLng"
              value={formData.addressLng}
              onChange={handleChange}
              className={FIELD_CLASS}
            />
          </div>

          <div className="col-span-1 md:col-span-2 pt-4 pb-2">
            <h4 className="text-sm font-bold text-zinc-900 dark:text-white border-b border-zinc-200 dark:border-zinc-700 pb-2">
              {t("rest.section_delivery")}
            </h4>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="edit-rest-currency" className={LABEL_CLASS}>
              {t("rest.pricing_currency")}
            </label>
            <select
              id="edit-rest-currency"
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
          <div className="space-y-1.5">
            <label htmlFor="edit-rest-fee" className={LABEL_CLASS}>
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
              id="edit-rest-fee"
              name="deliveryFee"
              value={formData.deliveryFee}
              onChange={handleChange}
              className={FIELD_CLASS}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="edit-rest-eta-min" className={LABEL_CLASS}>
              {t("rest.time_min")}
            </label>
            <input
              type="number"
              min={0}
              id="edit-rest-eta-min"
              name="deliveryTimeMinMinutes"
              value={formData.deliveryTimeMinMinutes}
              onChange={handleChange}
              className={FIELD_CLASS}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="edit-rest-eta-max" className={LABEL_CLASS}>
              {t("rest.time_max")}
            </label>
            <input
              type="number"
              min={0}
              id="edit-rest-eta-max"
              name="deliveryTimeMaxMinutes"
              value={formData.deliveryTimeMaxMinutes}
              onChange={handleChange}
              className={FIELD_CLASS}
            />
          </div>

          <div className="col-span-1 md:col-span-2 pt-4 pb-2">
            <h4 className="text-sm font-bold text-zinc-900 dark:text-white border-b border-zinc-200 dark:border-zinc-700 pb-2">
              {t("rest.section_media")}
            </h4>
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <label htmlFor="edit-rest-logo" className={LABEL_CLASS}>
              {t("common.logo_url")}
            </label>
            <input
              id="edit-rest-logo"
              name="logo"
              type="url"
              value={formData.logo}
              onChange={handleChange}
              className={FIELD_CLASS}
            />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <label htmlFor="edit-rest-background" className={LABEL_CLASS}>
              {t("common.background_url")}
            </label>
            <input
              id="edit-rest-background"
              name="backgroundImageUrl"
              type="url"
              value={formData.backgroundImageUrl}
              onChange={handleChange}
              className={FIELD_CLASS}
            />
          </div>
        </div>
      </form>
    </Modal>
  );
}
