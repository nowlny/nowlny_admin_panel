import React, { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { restaurantsService, RestaurantCreate } from '../../services/restaurants';

interface AddRestaurantModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddRestaurantModal({ isOpen, onClose, onSuccess }: AddRestaurantModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    email: '',
    phone: '',
    cuisineType: '',
    city: '',
    address: '',
    deliveryFee: '',
    estimatedDeliveryMinutes: '',
    latitude: '',
    longitude: '',
    logo: '',
    coverImage: ''
  });

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const payload: RestaurantCreate = {
      name: formData.name,
      description: formData.description,
      email: formData.email,
      phone: formData.phone,
      cuisineType: formData.cuisineType,
      city: formData.city,
      address: formData.address,
      deliveryFee: parseFloat(formData.deliveryFee) || 0,
      estimatedDeliveryMinutes: parseInt(formData.estimatedDeliveryMinutes) || 0,
      latitude: parseFloat(formData.latitude) || 0,
      longitude: parseFloat(formData.longitude) || 0,
      logo: formData.logo,
      coverImage: formData.coverImage,
      status: 'active', // default to active if admin is creating
      openingHours: {
        entries: [
          { day: "Monday", is24Hours: false, openTime: "08:00", closeTime: "23:00" },
          { day: "Tuesday", is24Hours: false, openTime: "08:00", closeTime: "23:00" },
          { day: "Wednesday", is24Hours: false, openTime: "08:00", closeTime: "23:00" },
          { day: "Thursday", is24Hours: false, openTime: "08:00", closeTime: "23:00" },
          { day: "Friday", is24Hours: false, openTime: "08:00", closeTime: "23:00" },
          { day: "Saturday", is24Hours: false, openTime: "08:00", closeTime: "23:00" },
          { day: "Sunday", is24Hours: false, openTime: "08:00", closeTime: "23:00" }
        ]
      }
    };

    try {
      await restaurantsService.createRestaurant(payload);
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error("Failed to create restaurant", err);
      setError(err.message || "An error occurred while creating the restaurant.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        
        <div className="p-5 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center bg-zinc-50 dark:bg-zinc-900/40">
          <h3 className="text-lg font-bold text-zinc-900 dark:text-white">Add New Restaurant</h3>
          <button 
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 rounded-lg text-sm">
              {error}
            </div>
          )}

          <form id="add-restaurant-form" onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Name</label>
                <input required name="name" value={formData.name} onChange={handleChange} className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-colors" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Cuisine Type</label>
                <input required name="cuisineType" value={formData.cuisineType} onChange={handleChange} className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-colors" />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Description</label>
                <textarea required name="description" value={formData.description} onChange={handleChange} rows={2} className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-colors" />
              </div>
              
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Email</label>
                <input required type="email" name="email" value={formData.email} onChange={handleChange} className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-colors" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Phone</label>
                <input required name="phone" value={formData.phone} onChange={handleChange} className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-colors" />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">City</label>
                <input required name="city" value={formData.city} onChange={handleChange} className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-colors" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Street Address</label>
                <input required name="address" value={formData.address} onChange={handleChange} className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-colors" />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Latitude</label>
                <input required type="number" step="any" name="latitude" value={formData.latitude} onChange={handleChange} className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-colors" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Longitude</label>
                <input required type="number" step="any" name="longitude" value={formData.longitude} onChange={handleChange} className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-colors" />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Delivery Fee ($)</label>
                <input required type="number" step="0.01" name="deliveryFee" value={formData.deliveryFee} onChange={handleChange} className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-colors" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Estimated Delivery (Mins)</label>
                <input required type="number" name="estimatedDeliveryMinutes" value={formData.estimatedDeliveryMinutes} onChange={handleChange} className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-colors" />
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Logo URL</label>
                <input name="logo" value={formData.logo} onChange={handleChange} className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-colors" />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Cover Image URL</label>
                <input name="coverImage" value={formData.coverImage} onChange={handleChange} className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-colors" />
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
            form="add-restaurant-form"
            disabled={isSubmitting}
            className="px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg shadow-sm shadow-orange-500/20 transition-all flex items-center gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Creating...
              </>
            ) : "Create Restaurant"}
          </button>
        </div>
      </div>
    </div>
  );
}
