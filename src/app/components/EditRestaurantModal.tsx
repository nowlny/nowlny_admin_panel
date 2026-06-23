import React, { useState, useEffect } from "react";
import { X, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
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

export default function EditRestaurantModal({
  isOpen,
  onClose,
  onSuccess,
  restaurant,
}: EditRestaurantModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  useEffect(() => {
    if (restaurant) {
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
        latitude: (restaurant.latitude || 0).toString(),
        longitude: (restaurant.longitude || 0).toString(),
        restaurantCity: restaurant.restaurantAddress?.city || "",
        restaurantStreet: restaurant.restaurantAddress?.street || "",
        restaurantBuilding: restaurant.restaurantAddress?.building || "",
        restaurantLat: (restaurant.restaurantAddress?.latitude || 0).toString(),
        restaurantLng: (
          restaurant.restaurantAddress?.longitude || 0
        ).toString(),
        deliveryFee: (restaurant.deliveryFee || 0).toString(),
        estimatedDeliveryMinutes: (
          restaurant.estimatedDeliveryMinutes || 0
        ).toString(),
        deliveryTimeMinMinutes: (
          restaurant.deliveryTimeMinMinutes || 0
        ).toString(),
        deliveryTimeMaxMinutes: (
          restaurant.deliveryTimeMaxMinutes || 0
        ).toString(),
        logo: restaurant.logo || "",
        coverImage: restaurant.coverImage || "",
      });
    }
  }, [restaurant]);

  if (!isOpen || !restaurant) return null;

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

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
      latitude: parseFloat(formData.latitude) || 0,
      longitude: parseFloat(formData.longitude) || 0,
      restaurantAddress: {
        city: formData.restaurantCity,
        street: formData.restaurantStreet,
        building: formData.restaurantBuilding,
        latitude: parseFloat(formData.restaurantLat) || 0,
        longitude: parseFloat(formData.restaurantLng) || 0,
      },
      deliveryFee: parseFloat(formData.deliveryFee) || 0,
      estimatedDeliveryMinutes:
        parseInt(formData.estimatedDeliveryMinutes) || 0,
      deliveryTimeMinMinutes: parseInt(formData.deliveryTimeMinMinutes) || 0,
      deliveryTimeMaxMinutes: parseInt(formData.deliveryTimeMaxMinutes) || 0,
      logo: formData.logo,
      coverImage: formData.coverImage,
    };

    try {
      await restaurantsService.updateRestaurant(restaurant.id, payload);
      toast.success("Restaurant updated successfully!");
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

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        <div className="p-5 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center bg-zinc-50 dark:bg-zinc-900/40">
          <h3 className="text-lg font-bold text-zinc-900 dark:text-white">
            Edit Restaurant
          </h3>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          <form
            id="edit-restaurant-form"
            onSubmit={handleSubmit}
            className="space-y-4"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Name
                </label>
                <input
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-colors"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Cuisine Type
                </label>
                <input
                  name="cuisineType"
                  value={formData.cuisineType}
                  onChange={handleChange}
                  className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-colors"
                />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Description
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  rows={2}
                  className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Email
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-colors"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Phone
                </label>
                <input
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Owner Full Name
                </label>
                <input
                  name="ownerFullName"
                  value={formData.ownerFullName}
                  onChange={handleChange}
                  className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-colors"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Owner Phone
                </label>
                <input
                  name="ownerPhoneNumber"
                  value={formData.ownerPhoneNumber}
                  onChange={handleChange}
                  className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-colors"
                />
              </div>

              <div className="col-span-1 md:col-span-2 pt-4 pb-2">
                <h4 className="text-sm font-bold text-zinc-900 dark:text-white border-b border-zinc-200 dark:border-zinc-700 pb-2">
                  Primary Address (Legacy)
                </h4>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  City
                </label>
                <input
                  name="city"
                  value={formData.city}
                  onChange={handleChange}
                  className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-colors"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Street Address
                </label>
                <input
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Latitude
                </label>
                <input
                  type="number"
                  step="any"
                  name="latitude"
                  value={formData.latitude}
                  onChange={handleChange}
                  className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-colors"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Longitude
                </label>
                <input
                  type="number"
                  step="any"
                  name="longitude"
                  value={formData.longitude}
                  onChange={handleChange}
                  className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-colors"
                />
              </div>

              <div className="col-span-1 md:col-span-2 pt-4 pb-2">
                <h4 className="text-sm font-bold text-zinc-900 dark:text-white border-b border-zinc-200 dark:border-zinc-700 pb-2">
                  Restaurant Address (New format)
                </h4>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  City
                </label>
                <input
                  name="restaurantCity"
                  value={formData.restaurantCity}
                  onChange={handleChange}
                  className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-colors"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Street
                </label>
                <input
                  name="restaurantStreet"
                  value={formData.restaurantStreet}
                  onChange={handleChange}
                  className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-colors"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Building
                </label>
                <input
                  name="restaurantBuilding"
                  value={formData.restaurantBuilding}
                  onChange={handleChange}
                  className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-colors"
                />
              </div>
              <div className="space-y-1.5 hidden md:block"></div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Latitude
                </label>
                <input
                  type="number"
                  step="any"
                  name="restaurantLat"
                  value={formData.restaurantLat}
                  onChange={handleChange}
                  className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-colors"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Longitude
                </label>
                <input
                  type="number"
                  step="any"
                  name="restaurantLng"
                  value={formData.restaurantLng}
                  onChange={handleChange}
                  className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-colors"
                />
              </div>

              <div className="col-span-1 md:col-span-2 pt-4 pb-2">
                <h4 className="text-sm font-bold text-zinc-900 dark:text-white border-b border-zinc-200 dark:border-zinc-700 pb-2">
                  Delivery Details
                </h4>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Delivery Fee ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  name="deliveryFee"
                  value={formData.deliveryFee}
                  onChange={handleChange}
                  className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-colors"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Est. Delivery (Mins, legacy)
                </label>
                <input
                  type="number"
                  name="estimatedDeliveryMinutes"
                  value={formData.estimatedDeliveryMinutes}
                  onChange={handleChange}
                  className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-colors"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Min Delivery Time (Mins)
                </label>
                <input
                  type="number"
                  name="deliveryTimeMinMinutes"
                  value={formData.deliveryTimeMinMinutes}
                  onChange={handleChange}
                  className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-colors"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Max Delivery Time (Mins)
                </label>
                <input
                  type="number"
                  name="deliveryTimeMaxMinutes"
                  value={formData.deliveryTimeMaxMinutes}
                  onChange={handleChange}
                  className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-colors"
                />
              </div>

              <div className="col-span-1 md:col-span-2 pt-4 pb-2">
                <h4 className="text-sm font-bold text-zinc-900 dark:text-white border-b border-zinc-200 dark:border-zinc-700 pb-2">
                  Media URLs
                </h4>
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Logo URL
                </label>
                <input
                  name="logo"
                  value={formData.logo}
                  onChange={handleChange}
                  className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-colors"
                />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Cover Image URL
                </label>
                <input
                  name="coverImage"
                  value={formData.coverImage}
                  onChange={handleChange}
                  className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-colors"
                />
              </div>
            </div>
          </form>
        </div>

        <div className="p-5 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/40 flex justify-end gap-3">
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
        </div>
      </div>
    </div>
  );
}
