import React, { useState } from "react";
import { Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import Modal from "./ui/Modal";
import {
  restaurantsService,
  RestaurantCreate,
} from "../../services/restaurants";

interface AddRestaurantModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const EMPTY_FORM = {
  name: "",
  description: "",
  email: "",
  phone: "",
  cuisineType: "",
  city: "",
  address: "",
  deliveryFee: "",
  estimatedDeliveryMinutes: "",
  latitude: "",
  longitude: "",
  logo: "",
  coverImage: "",
};

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

export default function AddRestaurantModal({
  isOpen,
  onClose,
  onSuccess,
}: AddRestaurantModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    setIsDirty(true);
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const payload: RestaurantCreate = {
      name: formData.name,
      description: formData.description,
      email: formData.email,
      phone: formData.phone,
      cuisineType: formData.cuisineType,
      city: formData.city,
      address: formData.address,
      deliveryFee: parseFloat(formData.deliveryFee) || 0,
      estimatedDeliveryMinutes:
        parseInt(formData.estimatedDeliveryMinutes) || 0,
      latitude: parseFloat(formData.latitude) || 0,
      longitude: parseFloat(formData.longitude) || 0,
      logo: formData.logo,
      coverImage: formData.coverImage,
      status: "active", // default to active if admin is creating
      openingHours: {
        entries: [
          {
            day: "Monday",
            is24Hours: false,
            openTime: "08:00",
            closeTime: "23:00",
          },
          {
            day: "Tuesday",
            is24Hours: false,
            openTime: "08:00",
            closeTime: "23:00",
          },
          {
            day: "Wednesday",
            is24Hours: false,
            openTime: "08:00",
            closeTime: "23:00",
          },
          {
            day: "Thursday",
            is24Hours: false,
            openTime: "08:00",
            closeTime: "23:00",
          },
          {
            day: "Friday",
            is24Hours: false,
            openTime: "08:00",
            closeTime: "23:00",
          },
          {
            day: "Saturday",
            is24Hours: false,
            openTime: "08:00",
            closeTime: "23:00",
          },
          {
            day: "Sunday",
            is24Hours: false,
            openTime: "08:00",
            closeTime: "23:00",
          },
        ],
      },
    };

    try {
      await restaurantsService.createRestaurant(payload);
      toast.success("Restaurant created successfully!");
      // Without this the next "Add Restaurant" reopens on the previous
      // merchant's data and quietly creates a near-duplicate.
      setFormData(EMPTY_FORM);
      setIsDirty(false);
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error("Failed to create restaurant", err);
      toast.error(
        err.message || "An error occurred while creating the restaurant.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add New Restaurant"
      description="Creates an active merchant with default 08:00–23:00 opening hours."
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
            form="add-restaurant-form"
            disabled={isSubmitting}
            className="px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg shadow-sm shadow-orange-500/20 transition-all flex items-center gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Creating...
              </>
            ) : (
              "Create Restaurant"
            )}
          </button>
        </>
      }
    >
      <form id="add-restaurant-form" onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label htmlFor="add-rest-name" className={LABEL_CLASS}>
              Name
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
          <div className="space-y-1.5">
            <label htmlFor="add-rest-cuisine" className={LABEL_CLASS}>
              Cuisine Type
              <Req />
            </label>
            <input
              required
              id="add-rest-cuisine"
              name="cuisineType"
              value={formData.cuisineType}
              onChange={handleChange}
              className={FIELD_CLASS}
            />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <label htmlFor="add-rest-description" className={LABEL_CLASS}>
              Description
              <Req />
            </label>
            <textarea
              required
              id="add-rest-description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={2}
              className={FIELD_CLASS}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="add-rest-email" className={LABEL_CLASS}>
              Email
              <Req />
            </label>
            <input
              required
              type="email"
              id="add-rest-email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className={FIELD_CLASS}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="add-rest-phone" className={LABEL_CLASS}>
              Phone
              <Req />
            </label>
            <input
              required
              id="add-rest-phone"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              className={FIELD_CLASS}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="add-rest-city" className={LABEL_CLASS}>
              City
              <Req />
            </label>
            <input
              required
              id="add-rest-city"
              name="city"
              value={formData.city}
              onChange={handleChange}
              className={FIELD_CLASS}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="add-rest-address" className={LABEL_CLASS}>
              Street Address
              <Req />
            </label>
            <input
              required
              id="add-rest-address"
              name="address"
              value={formData.address}
              onChange={handleChange}
              className={FIELD_CLASS}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="add-rest-latitude" className={LABEL_CLASS}>
              Latitude
              <Req />
            </label>
            <input
              required
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
              Longitude
              <Req />
            </label>
            <input
              required
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
            <label htmlFor="add-rest-fee" className={LABEL_CLASS}>
              Delivery Fee ($)
              <Req />
            </label>
            <input
              required
              type="number"
              step="0.01"
              min={0}
              id="add-rest-fee"
              name="deliveryFee"
              value={formData.deliveryFee}
              onChange={handleChange}
              className={FIELD_CLASS}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="add-rest-eta" className={LABEL_CLASS}>
              Estimated Delivery (Mins)
              <Req />
            </label>
            <input
              required
              type="number"
              min={0}
              id="add-rest-eta"
              name="estimatedDeliveryMinutes"
              value={formData.estimatedDeliveryMinutes}
              onChange={handleChange}
              className={FIELD_CLASS}
            />
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <label htmlFor="add-rest-logo" className={LABEL_CLASS}>
              Logo URL
            </label>
            <input
              id="add-rest-logo"
              name="logo"
              value={formData.logo}
              onChange={handleChange}
              className={FIELD_CLASS}
            />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <label htmlFor="add-rest-cover" className={LABEL_CLASS}>
              Cover Image URL
            </label>
            <input
              id="add-rest-cover"
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
