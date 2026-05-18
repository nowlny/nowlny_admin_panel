"use client";

import React, { useState } from "react";
import { 
  Store, 
  Save, 
  Clock, 
  MapPin, 
  Phone, 
  Mail, 
  DollarSign, 
  ShieldCheck, 
  Camera, 
  Info,
  CheckCircle2
} from "lucide-react";
import { Restaurant } from "../data/mockData";

interface RestaurantSettingsProps {
  restaurant: Restaurant;
  onUpdateRestaurant: (updated: Restaurant) => void;
}

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !phone || !cuisine || !address || !deliveryFee || !deliveryTime) {
      alert("Please fill in all required fields.");
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

    onUpdateRestaurant(updated);
    alert("Store profile and logistics parameters saved successfully!");
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in fade-in duration-200">
      
      {/* Visual profile preview & status - Left */}
      <div className="lg:col-span-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm flex flex-col items-center justify-between text-center space-y-6">
        <div className="space-y-4 w-full">
          <div className="flex items-center gap-2 border-b border-zinc-100 dark:border-zinc-850 pb-3 justify-center">
            <ShieldCheck className="w-5 h-5 text-orange-500" />
            <span className="text-[10px] font-black text-zinc-900 dark:text-white uppercase tracking-wider">Merchant Credentials</span>
          </div>

          {/* Logo & Banner Preview */}
          <div className="relative group w-24 h-24 rounded-full mx-auto bg-zinc-100 dark:bg-zinc-800 border-4 border-orange-500/10 flex items-center justify-center text-5xl shadow-md">
            {logo}
            <button className="absolute bottom-0 right-0 p-1.5 bg-zinc-900 hover:bg-orange-500 text-white rounded-full shadow-md border border-zinc-800 transition-colors" title="Change Emoji Logo">
              <Camera className="w-3.5 h-3.5" />
            </button>
          </div>

          <div>
            <h3 className="text-sm font-bold text-zinc-900 dark:text-white">{name}</h3>
            <p className="text-[10px] text-zinc-400 mt-0.5">{cuisine} Specialist</p>
          </div>

          {/* Status badge */}
          <div className="p-3 bg-zinc-50 dark:bg-zinc-950/20 border border-zinc-150 dark:border-zinc-850 rounded-2xl space-y-1">
            <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">Platform Status</p>
            <div className="flex items-center gap-1.5 justify-center text-xs font-black text-emerald-500">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span className="capitalize">{restaurant.status}</span>
            </div>
            <p className="text-[9px] text-zinc-400 mt-1">Contract Active since {restaurant.joinedDate}</p>
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
            <p className="text-[10px] text-zinc-400">Update cuisine categories, contact addresses, and dispatch times.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
          
          {/* Identity details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-zinc-400 uppercase">Restaurant Name *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-zinc-50 border border-zinc-200 text-zinc-800 rounded-xl p-2.5 text-xs focus:ring-1 focus:ring-orange-500 dark:bg-zinc-950/20 dark:border-zinc-800 dark:text-zinc-200"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-zinc-400 uppercase">Cuisine Specialties *</label>
              <input
                type="text"
                required
                value={cuisine}
                onChange={(e) => setCuisine(e.target.value)}
                placeholder="e.g. Burgers, Pizza, Lebanese"
                className="w-full bg-zinc-50 border border-zinc-200 text-zinc-800 rounded-xl p-2.5 text-xs focus:ring-1 focus:ring-orange-500 dark:bg-zinc-950/20 dark:border-zinc-800 dark:text-zinc-200"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-zinc-400 uppercase flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-zinc-400" /> Email Address *
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-zinc-50 border border-zinc-200 text-zinc-800 rounded-xl p-2.5 text-xs focus:ring-1 focus:ring-orange-500 dark:bg-zinc-950/20 dark:border-zinc-800 dark:text-zinc-200"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-zinc-400 uppercase flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-zinc-400" /> Contact Phone *
              </label>
              <input
                type="text"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full bg-zinc-50 border border-zinc-200 text-zinc-800 rounded-xl p-2.5 text-xs focus:ring-1 focus:ring-orange-500 dark:bg-zinc-950/20 dark:border-zinc-800 dark:text-zinc-200"
              />
            </div>
          </div>

          {/* Timings and delivery logistics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-zinc-100 dark:border-zinc-850/80 pt-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-zinc-400 uppercase flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-zinc-400" /> Delivery Fee ($ USD) *
              </label>
              <input
                type="number"
                step="0.01"
                required
                value={deliveryFee}
                onChange={(e) => setDeliveryFee(e.target.value)}
                className="w-full bg-zinc-50 border border-zinc-200 text-zinc-800 rounded-xl p-2.5 text-xs focus:ring-1 focus:ring-orange-500 dark:bg-zinc-950/20 dark:border-zinc-800 dark:text-zinc-200"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-zinc-400 uppercase flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-zinc-400" /> Cooking & Delivery Time *
              </label>
              <input
                type="text"
                required
                value={deliveryTime}
                onChange={(e) => setDeliveryTime(e.target.value)}
                placeholder="e.g. 20-30 min"
                className="w-full bg-zinc-50 border border-zinc-200 text-zinc-800 rounded-xl p-2.5 text-xs focus:ring-1 focus:ring-orange-500 dark:bg-zinc-950/20 dark:border-zinc-800 dark:text-zinc-200"
              />
            </div>
          </div>

          {/* Banner URL */}
          <div className="space-y-1 border-t border-zinc-100 dark:border-zinc-850/80 pt-4">
            <label className="text-[10px] font-bold text-zinc-400 uppercase">Banner Image URL *</label>
            <input
              type="text"
              required
              value={banner}
              onChange={(e) => setBanner(e.target.value)}
              className="w-full bg-zinc-50 border border-zinc-200 text-zinc-800 rounded-xl p-2.5 text-xs focus:ring-1 focus:ring-orange-500 dark:bg-zinc-950/20 dark:border-zinc-800 dark:text-zinc-200"
            />
          </div>

          {/* Physical Address details */}
          <div className="space-y-1 border-t border-zinc-100 dark:border-zinc-850/80 pt-4">
            <label className="text-[10px] font-bold text-zinc-400 uppercase flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-zinc-400" /> Store Physical Address *
            </label>
            <textarea
              required
              rows={2}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full bg-zinc-50 border border-zinc-200 text-zinc-800 rounded-xl p-2.5 text-xs focus:ring-1 focus:ring-orange-500 dark:bg-zinc-950/20 dark:border-zinc-800 dark:text-zinc-200 resize-none font-sans"
            />
          </div>

          <div className="flex justify-end pt-3">
            <button
              type="submit"
              className="flex items-center justify-center gap-1.5 text-xs font-bold bg-orange-500 hover:bg-orange-600 text-white px-5 py-2.5 rounded-xl shadow-lg shadow-orange-500/10 active:scale-95 transition-all"
            >
              <Save className="w-4 h-4" />
              <span>Save Profile Config</span>
            </button>
          </div>
        </form>
      </div>

    </div>
  );
}
