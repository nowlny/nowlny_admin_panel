"use client";

import React, { useEffect, useState } from "react";
import {
  Store,
  Save,
  Clock,
  MapPin,
  Phone,
  Mail,
  DollarSign,
  ShieldCheck,
  Image as ImageIcon,
  Info,
  Loader2
} from "lucide-react";
import toast from "react-hot-toast";
import { Restaurant } from "../data/mockData";
import StatusPill from "./ui/StatusPill";

interface RestaurantSettingsProps {
  restaurant: Restaurant;
  onUpdateRestaurant: (updated: Restaurant) => void;
}

type FieldKey =
  | "name"
  | "email"
  | "phone"
  | "cuisine"
  | "address"
  | "deliveryFee"
  | "deliveryTime"
  | "logo"
  | "banner";

const FIELD_LABELS: Record<FieldKey, string> = {
  name: "Restaurant Name",
  email: "Email Address",
  phone: "Contact Phone",
  cuisine: "Cuisine Specialties",
  address: "Store Physical Address",
  deliveryFee: "Delivery Fee",
  deliveryTime: "Cooking & Delivery Time",
  logo: "Logo",
  banner: "Banner Image URL"
};

const inputClass =
  "w-full bg-zinc-50 border border-zinc-200 text-zinc-800 rounded-xl p-2.5 text-xs focus:ring-1 focus:ring-orange-500 dark:bg-zinc-950/20 dark:border-zinc-800 dark:text-zinc-200";
const invalidInputClass =
  "w-full bg-zinc-50 border border-red-500 text-zinc-800 rounded-xl p-2.5 text-xs focus:ring-1 focus:ring-red-500 dark:bg-zinc-950/20 dark:text-zinc-200";

export default function RestaurantSettingsSection({
  restaurant,
  onUpdateRestaurant
}: RestaurantSettingsProps) {
  // Store form states
  const [name, setName] = useState(restaurant.name);
  const [email, setEmail] = useState(restaurant.email);
  const [phone, setPhone] = useState(restaurant.phone);
  const [cuisine, setCuisine] = useState(restaurant.cuisine);
  const [address, setAddress] = useState(restaurant.address);
  const [deliveryFee, setDeliveryFee] = useState(restaurant.deliveryFee.toString());
  const [deliveryTime, setDeliveryTime] = useState(restaurant.deliveryTime);
  const [logo, setLogo] = useState(restaurant.logo);
  const [banner, setBanner] = useState(restaurant.banner);

  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  /**
   * The fields above are only *seeded* from props. Without this re-sync,
   * switching the selected merchant kept the previous store's values in the
   * inputs and Save wrote them onto the newly selected record — a silent
   * cross-record overwrite. Re-seed every field whenever the record changes.
   */
  useEffect(() => {
    setName(restaurant.name);
    setEmail(restaurant.email);
    setPhone(restaurant.phone);
    setCuisine(restaurant.cuisine);
    setAddress(restaurant.address);
    setDeliveryFee(restaurant.deliveryFee.toString());
    setDeliveryTime(restaurant.deliveryTime);
    setLogo(restaurant.logo);
    setBanner(restaurant.banner);
    setErrors({});
  }, [restaurant.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const clearError = (field: FieldKey) =>
    setErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));

  const validate = () => {
    const values: Record<FieldKey, string> = {
      name,
      email,
      phone,
      cuisine,
      address,
      deliveryFee,
      deliveryTime,
      logo,
      banner
    };

    const next: Partial<Record<FieldKey, string>> = {};
    (Object.keys(values) as FieldKey[]).forEach((field) => {
      if (!values[field] || !values[field].trim()) {
        next[field] = `${FIELD_LABELS[field]} is required.`;
      }
    });

    const fee = parseFloat(deliveryFee);
    if (!next.deliveryFee && (!Number.isFinite(fee) || fee < 0)) {
      next.deliveryFee = "Delivery fee must be a positive number.";
    }

    return next;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const nextErrors = validate();
    setErrors(nextErrors);

    const missing = (Object.keys(nextErrors) as FieldKey[]).map((f) => FIELD_LABELS[f]);
    if (missing.length > 0) {
      toast.error(`Please fix: ${missing.join(", ")}.`);
      return;
    }

    const updated: Restaurant = {
      ...restaurant,
      name,
      email,
      phone,
      cuisine,
      address,
      deliveryFee: parseFloat(deliveryFee),
      deliveryTime,
      logo,
      banner
    };

    setIsSubmitting(true);
    try {
      // The parent may hand back a promise (API-backed) or nothing (local state).
      await Promise.resolve(onUpdateRestaurant(updated));
      toast.success("Store profile and logistics parameters saved.");
    } catch (err: any) {
      toast.error(err?.message || "Failed to save the store profile.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const fieldError = (field: FieldKey) =>
    errors[field] ? (
      <p id={`${field}-error`} className="text-[10px] font-bold text-red-500">
        {errors[field]}
      </p>
    ) : null;

  const fieldProps = (field: FieldKey) => ({
    className: errors[field] ? invalidInputClass : inputClass,
    "aria-invalid": errors[field] ? true : undefined,
    "aria-describedby": errors[field] ? `${field}-error` : undefined
  });

  const logoIsUrl = typeof logo === "string" && /^(https?:)?\/\//.test(logo.trim());

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in fade-in duration-200">

      {/* Visual profile preview & status - Left */}
      <div className="lg:col-span-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm flex flex-col items-center justify-between text-center space-y-6">
        <div className="space-y-4 w-full">
          <div className="flex items-center gap-2 border-b border-zinc-100 dark:border-zinc-850 pb-3 justify-center">
            <ShieldCheck className="w-5 h-5 text-orange-500" />
            <span className="text-[10px] font-black text-zinc-900 dark:text-white uppercase tracking-wider">Merchant Credentials</span>
          </div>

          {/* Logo preview — edited through the "Logo" field in the form. */}
          <div className="w-24 h-24 rounded-full mx-auto bg-zinc-100 dark:bg-zinc-800 border-4 border-orange-500/10 flex items-center justify-center text-5xl shadow-md overflow-hidden">
            {logoIsUrl ? (
              <img src={logo} alt={`${name} logo`} className="w-full h-full object-cover" />
            ) : (
              logo || "🍽️"
            )}
          </div>

          <div>
            <h3 className="text-sm font-bold text-zinc-900 dark:text-white">{name}</h3>
            <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5">{cuisine} Specialist</p>
          </div>

          {/* Status badge */}
          <div className="p-3 bg-zinc-50 dark:bg-zinc-950/20 border border-zinc-150 dark:border-zinc-850 rounded-2xl space-y-1.5">
            <p className="text-[9px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">Platform Status</p>
            <div className="flex justify-center">
              <StatusPill status={restaurant.status} />
            </div>
            <p className="text-[9px] text-zinc-500 dark:text-zinc-400 mt-1">Contract Active since {restaurant.joinedDate}</p>
          </div>
        </div>

        {/* Informative alert box */}
        <div className="p-3.5 bg-orange-500/[0.02] border border-orange-500/10 rounded-2xl text-[10px] text-zinc-500 dark:text-zinc-400 leading-relaxed text-left flex gap-2.5 items-start">
          <Info className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
          <span>Need to modify banking info or VAT details? Please raise an administrative support request inside the help channel.</span>
        </div>
      </div>

      {/* Main settings form - Right */}
      <div className="lg:col-span-8 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm space-y-6">
        <div className="flex items-center gap-2 pb-3 border-b border-zinc-100 dark:border-zinc-850">
          <Store className="w-5 h-5 text-orange-500" />
          <div>
            <h3 className="text-xs font-black text-zinc-900 dark:text-white uppercase tracking-wider">Configure Merchant Store Profile</h3>
            <p className="text-[10px] text-zinc-500 dark:text-zinc-400">Update cuisine categories, contact addresses, and dispatch times.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs font-semibold text-zinc-700 dark:text-zinc-300" noValidate>

          {/* Identity details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label htmlFor="store-name" className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase">Restaurant Name *</label>
              <input
                id="store-name"
                type="text"
                value={name}
                onChange={(e) => { setName(e.target.value); clearError("name"); }}
                {...fieldProps("name")}
              />
              {fieldError("name")}
            </div>

            <div className="space-y-1">
              <label htmlFor="store-cuisine" className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase">Cuisine Specialties *</label>
              <input
                id="store-cuisine"
                type="text"
                value={cuisine}
                onChange={(e) => { setCuisine(e.target.value); clearError("cuisine"); }}
                placeholder="e.g. Burgers, Pizza, Lebanese"
                {...fieldProps("cuisine")}
              />
              {fieldError("cuisine")}
            </div>

            <div className="space-y-1">
              <label htmlFor="store-email" className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-zinc-400" /> Email Address *
              </label>
              <input
                id="store-email"
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); clearError("email"); }}
                {...fieldProps("email")}
              />
              {fieldError("email")}
            </div>

            <div className="space-y-1">
              <label htmlFor="store-phone" className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-zinc-400" /> Contact Phone *
              </label>
              <input
                id="store-phone"
                type="text"
                value={phone}
                onChange={(e) => { setPhone(e.target.value); clearError("phone"); }}
                {...fieldProps("phone")}
              />
              {fieldError("phone")}
            </div>
          </div>

          {/* Timings and delivery logistics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-zinc-100 dark:border-zinc-850/80 pt-4">
            <div className="space-y-1">
              <label htmlFor="store-delivery-fee" className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-zinc-400" /> Delivery Fee ($ USD) *
              </label>
              <input
                id="store-delivery-fee"
                type="number"
                step="0.01"
                min="0"
                inputMode="decimal"
                value={deliveryFee}
                onChange={(e) => { setDeliveryFee(e.target.value); clearError("deliveryFee"); }}
                {...fieldProps("deliveryFee")}
              />
              {fieldError("deliveryFee")}
            </div>

            <div className="space-y-1">
              <label htmlFor="store-delivery-time" className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-zinc-400" /> Cooking & Delivery Time *
              </label>
              <input
                id="store-delivery-time"
                type="text"
                value={deliveryTime}
                onChange={(e) => { setDeliveryTime(e.target.value); clearError("deliveryTime"); }}
                placeholder="e.g. 20-30 min"
                {...fieldProps("deliveryTime")}
              />
              {fieldError("deliveryTime")}
            </div>
          </div>

          {/* Brand assets */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-zinc-100 dark:border-zinc-850/80 pt-4">
            <div className="space-y-1">
              <label htmlFor="store-logo" className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5 text-zinc-400" /> Logo (Emoji or Image URL) *
              </label>
              <input
                id="store-logo"
                type="text"
                value={logo}
                onChange={(e) => { setLogo(e.target.value); clearError("logo"); }}
                placeholder="🍔 or https://..."
                {...fieldProps("logo")}
              />
              {fieldError("logo")}
            </div>

            <div className="space-y-1">
              <label htmlFor="store-banner" className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase">Banner Image URL *</label>
              <input
                id="store-banner"
                type="text"
                value={banner}
                onChange={(e) => { setBanner(e.target.value); clearError("banner"); }}
                {...fieldProps("banner")}
              />
              {fieldError("banner")}
            </div>
          </div>

          {/* Physical Address details */}
          <div className="space-y-1 border-t border-zinc-100 dark:border-zinc-850/80 pt-4">
            <label htmlFor="store-address" className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-zinc-400" /> Store Physical Address *
            </label>
            <textarea
              id="store-address"
              rows={2}
              value={address}
              onChange={(e) => { setAddress(e.target.value); clearError("address"); }}
              className={`${errors.address ? invalidInputClass : inputClass} resize-none font-sans`}
              aria-invalid={errors.address ? true : undefined}
              aria-describedby={errors.address ? "address-error" : undefined}
            />
            {fieldError("address")}
          </div>

          <div className="flex justify-end pt-3">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center justify-center gap-1.5 text-xs font-bold bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-white px-5 py-2.5 rounded-xl shadow-lg shadow-orange-500/10 active:scale-95 transition-all"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>{isSubmitting ? "Saving…" : "Save Profile Config"}</span>
            </button>
          </div>
        </form>
      </div>

    </div>
  );
}
