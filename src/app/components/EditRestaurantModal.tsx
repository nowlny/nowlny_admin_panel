import React, { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import Modal from "./ui/Modal";
import {
  restaurantsService,
  RestaurantUpdate,
  RestaurantResponse,
} from "../../services/restaurants";

interface EditRestaurantModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  restaurant: RestaurantResponse | null;
}

const FIELD_CLASS =
  "w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-colors";
const LABEL_CLASS = "text-xs font-semibold text-zinc-700 dark:text-zinc-300";

/** Red asterisk that isn't announced twice — the input already has `required`. */
function Req() {
  return (
    <span aria-hidden="true" className="text-red-500 ml-0.5">
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

export default function EditRestaurantModal({
  isOpen,
  onClose,
  onSuccess,
  restaurant,
}: EditRestaurantModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    email: "",
    phone: "",
    ownerFullName: "",
    ownerPhoneNumber: "",
    cuisineType: "",
    city: "",
    address: "",
    latitude: "",
    longitude: "",
    restaurantCity: "",
    restaurantStreet: "",
    restaurantBuilding: "",
    restaurantLat: "",
    restaurantLng: "",
    deliveryFee: "",
    estimatedDeliveryMinutes: "",
    deliveryTimeMinMinutes: "",
    deliveryTimeMaxMinutes: "",
    logo: "",
    coverImage: "",
  });

  // Also keyed on `isOpen`: reopening for the same merchant after a cancelled
  // edit used to replay whatever had been typed the previous time.
  useEffect(() => {
    if (!isOpen || !restaurant) return;
    setIsDirty(false);
    setFormData({
      name: restaurant.name || "",
      description: restaurant.description || "",
      email: restaurant.email || "",
      phone: restaurant.phone || "",
      ownerFullName: restaurant.ownerFullName || "",
      ownerPhoneNumber: restaurant.ownerPhoneNumber || "",
      cuisineType: restaurant.cuisineType || "",
      city: restaurant.city || "",
      address:
        typeof restaurant.address === "string"
          ? restaurant.address
          : (restaurant.address as any)?.street || "",
      latitude: restaurant.latitude?.toString() ?? "",
      longitude: restaurant.longitude?.toString() ?? "",
      restaurantCity: restaurant.restaurantAddress?.city || "",
      restaurantStreet: restaurant.restaurantAddress?.street || "",
      restaurantBuilding: restaurant.restaurantAddress?.building || "",
      restaurantLat: restaurant.restaurantAddress?.latitude?.toString() ?? "",
      restaurantLng: restaurant.restaurantAddress?.longitude?.toString() ?? "",
      deliveryFee: restaurant.deliveryFee?.toString() ?? "",
      estimatedDeliveryMinutes:
        restaurant.estimatedDeliveryMinutes?.toString() ?? "",
      deliveryTimeMinMinutes:
        restaurant.deliveryTimeMinMinutes?.toString() ?? "",
      deliveryTimeMaxMinutes:
        restaurant.deliveryTimeMaxMinutes?.toString() ?? "",
      logo: restaurant.logo || "",
      coverImage: restaurant.coverImage || "",
    });
  }, [restaurant, isOpen]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    setIsDirty(true);
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restaurant) return;
    setIsSubmitting(true);

    const latitude = numeric(formData.latitude);
    const longitude = numeric(formData.longitude);
    const deliveryFee = numeric(formData.deliveryFee);
    const estimatedDeliveryMinutes = numeric(formData.estimatedDeliveryMinutes);
    const deliveryTimeMinMinutes = numeric(formData.deliveryTimeMinMinutes);
    const deliveryTimeMaxMinutes = numeric(formData.deliveryTimeMaxMinutes);
    const restaurantLat = numeric(formData.restaurantLat);
    const restaurantLng = numeric(formData.restaurantLng);

    const payload: RestaurantUpdate = {
      name: formData.name,
      description: formData.description,
      email: formData.email,
      phone: formData.phone,
      ownerFullName: formData.ownerFullName,
      ownerPhoneNumber: formData.ownerPhoneNumber,
      cuisineType: formData.cuisineType,
      city: formData.city,
      address: formData.address,
      logo: formData.logo,
      coverImage: formData.coverImage,
      ...(latitude !== undefined ? { latitude } : {}),
      ...(longitude !== undefined ? { longitude } : {}),
      ...(deliveryFee !== undefined ? { deliveryFee } : {}),
      ...(estimatedDeliveryMinutes !== undefined
        ? { estimatedDeliveryMinutes }
        : {}),
      ...(deliveryTimeMinMinutes !== undefined
        ? { deliveryTimeMinMinutes }
        : {}),
      ...(deliveryTimeMaxMinutes !== undefined
        ? { deliveryTimeMaxMinutes }
        : {}),
    };

    // Only send the structured address when the operator actually has one to
    // send; an all-blank object used to overwrite a good address with nulls.
    const hasRestaurantAddress = [
      formData.restaurantCity,
      formData.restaurantStreet,
      formData.restaurantBuilding,
      formData.restaurantLat,
      formData.restaurantLng,
    ].some((value) => value.trim() !== "");

    if (hasRestaurantAddress) {
      payload.restaurantAddress = {
        city: formData.restaurantCity,
        street: formData.restaurantStreet,
        building: formData.restaurantBuilding,
        ...(restaurantLat !== undefined ? { latitude: restaurantLat } : {}),
        ...(restaurantLng !== undefined ? { longitude: restaurantLng } : {}),
        // The API treats the coordinates as optional on PATCH; the generated
        // type marks them required, hence the cast rather than sending 0,0.
      } as NonNullable<RestaurantUpdate["restaurantAddress"]>;
    }

    try {
      await restaurantsService.updateRestaurant(restaurant.id, payload);
      toast.success("Restaurant updated successfully!");
      setIsDirty(false);
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error("Failed to update restaurant", err);
      toast.error(
        err.message || "An error occurred while updating the restaurant.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!restaurant) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Restaurant"
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
            Cancel
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
                Updating...
              </>
            ) : (
              "Save Changes"
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
              Name
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
            <label htmlFor="edit-rest-cuisine" className={LABEL_CLASS}>
              Cuisine Type
            </label>
            <input
              id="edit-rest-cuisine"
              name="cuisineType"
              value={formData.cuisineType}
              onChange={handleChange}
              className={FIELD_CLASS}
            />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <label htmlFor="edit-rest-description" className={LABEL_CLASS}>
              Description
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
            <label htmlFor="edit-rest-email" className={LABEL_CLASS}>
              Email
            </label>
            <input
              type="email"
              id="edit-rest-email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className={FIELD_CLASS}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="edit-rest-phone" className={LABEL_CLASS}>
              Phone
              <Req />
            </label>
            <input
              required
              id="edit-rest-phone"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              className={FIELD_CLASS}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="edit-rest-owner-name" className={LABEL_CLASS}>
              Owner Full Name
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
              Owner Phone
            </label>
            <input
              id="edit-rest-owner-phone"
              name="ownerPhoneNumber"
              value={formData.ownerPhoneNumber}
              onChange={handleChange}
              className={FIELD_CLASS}
            />
          </div>

          <div className="col-span-1 md:col-span-2 pt-4 pb-2">
            <h4 className="text-sm font-bold text-zinc-900 dark:text-white border-b border-zinc-200 dark:border-zinc-700 pb-2">
              Primary Address (Legacy)
            </h4>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="edit-rest-city" className={LABEL_CLASS}>
              City
            </label>
            <input
              id="edit-rest-city"
              name="city"
              value={formData.city}
              onChange={handleChange}
              className={FIELD_CLASS}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="edit-rest-address" className={LABEL_CLASS}>
              Street Address
            </label>
            <input
              id="edit-rest-address"
              name="address"
              value={formData.address}
              onChange={handleChange}
              className={FIELD_CLASS}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="edit-rest-latitude" className={LABEL_CLASS}>
              Latitude
            </label>
            <input
              type="number"
              step="any"
              min={-90}
              max={90}
              id="edit-rest-latitude"
              name="latitude"
              value={formData.latitude}
              onChange={handleChange}
              className={FIELD_CLASS}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="edit-rest-longitude" className={LABEL_CLASS}>
              Longitude
            </label>
            <input
              type="number"
              step="any"
              min={-180}
              max={180}
              id="edit-rest-longitude"
              name="longitude"
              value={formData.longitude}
              onChange={handleChange}
              className={FIELD_CLASS}
            />
          </div>

          <div className="col-span-1 md:col-span-2 pt-4 pb-2">
            <h4 className="text-sm font-bold text-zinc-900 dark:text-white border-b border-zinc-200 dark:border-zinc-700 pb-2">
              Restaurant Address (New format)
            </h4>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="edit-rest-addr-city" className={LABEL_CLASS}>
              City
            </label>
            <input
              id="edit-rest-addr-city"
              name="restaurantCity"
              value={formData.restaurantCity}
              onChange={handleChange}
              className={FIELD_CLASS}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="edit-rest-addr-street" className={LABEL_CLASS}>
              Street
            </label>
            <input
              id="edit-rest-addr-street"
              name="restaurantStreet"
              value={formData.restaurantStreet}
              onChange={handleChange}
              className={FIELD_CLASS}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="edit-rest-addr-building" className={LABEL_CLASS}>
              Building
            </label>
            <input
              id="edit-rest-addr-building"
              name="restaurantBuilding"
              value={formData.restaurantBuilding}
              onChange={handleChange}
              className={FIELD_CLASS}
            />
          </div>
          <div className="space-y-1.5 hidden md:block"></div>
          <div className="space-y-1.5">
            <label htmlFor="edit-rest-addr-lat" className={LABEL_CLASS}>
              Latitude
            </label>
            <input
              type="number"
              step="any"
              min={-90}
              max={90}
              id="edit-rest-addr-lat"
              name="restaurantLat"
              value={formData.restaurantLat}
              onChange={handleChange}
              className={FIELD_CLASS}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="edit-rest-addr-lng" className={LABEL_CLASS}>
              Longitude
            </label>
            <input
              type="number"
              step="any"
              min={-180}
              max={180}
              id="edit-rest-addr-lng"
              name="restaurantLng"
              value={formData.restaurantLng}
              onChange={handleChange}
              className={FIELD_CLASS}
            />
          </div>

          <div className="col-span-1 md:col-span-2 pt-4 pb-2">
            <h4 className="text-sm font-bold text-zinc-900 dark:text-white border-b border-zinc-200 dark:border-zinc-700 pb-2">
              Delivery Details
            </h4>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="edit-rest-fee" className={LABEL_CLASS}>
              Delivery Fee ($)
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
            <label htmlFor="edit-rest-eta" className={LABEL_CLASS}>
              Est. Delivery (Mins, legacy)
            </label>
            <input
              type="number"
              min={0}
              id="edit-rest-eta"
              name="estimatedDeliveryMinutes"
              value={formData.estimatedDeliveryMinutes}
              onChange={handleChange}
              className={FIELD_CLASS}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="edit-rest-eta-min" className={LABEL_CLASS}>
              Min Delivery Time (Mins)
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
              Max Delivery Time (Mins)
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
              Media URLs
            </h4>
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <label htmlFor="edit-rest-logo" className={LABEL_CLASS}>
              Logo URL
            </label>
            <input
              id="edit-rest-logo"
              name="logo"
              value={formData.logo}
              onChange={handleChange}
              className={FIELD_CLASS}
            />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <label htmlFor="edit-rest-cover" className={LABEL_CLASS}>
              Cover Image URL
            </label>
            <input
              id="edit-rest-cover"
              name="coverImage"
              value={formData.coverImage}
              onChange={handleChange}
              className={FIELD_CLASS}
            />
          </div>
        </div>
      </form>
    </Modal>
  );
}
