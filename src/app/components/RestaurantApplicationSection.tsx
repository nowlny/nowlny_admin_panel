"use client";

import React, { useState, useEffect } from "react";
import { 
  Store, 
  Send, 
  X, 
  ShieldAlert, 
  CheckCircle2, 
  ChevronRight, 
  ChevronLeft, 
  MapPin, 
  DollarSign, 
  Clock, 
  HelpCircle, 
  Loader2, 
  AlertCircle, 
  Info, 
  Calendar, 
  Sparkles, 
  Plus, 
  Trash,
  Phone,
  Mail,
  Globe,
  FileImage
} from "lucide-react";
import { restaurantsService, RestaurantSubmission, RestaurantCreate, OpeningHourEntry } from "../../services/restaurants";

interface RestaurantApplicationSectionProps {
  onRefreshSubmissionStatus: () => void;
  initialSubmission: RestaurantSubmission | null;
}

export default function RestaurantApplicationSection({
  onRefreshSubmissionStatus,
  initialSubmission
}: RestaurantApplicationSectionProps) {
  const [submission, setSubmission] = useState<RestaurantSubmission | null>(initialSubmission);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [isApplying, setIsApplying] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);

  // Multi-step form state
  const [formData, setFormData] = useState<RestaurantCreate>({
    name: "",
    description: "",
    cuisineType: "",
    email: "",
    phone: "",
    website: "",
    logo: "",
    coverImage: "",
    deliveryFee: 3,
    estimatedDeliveryMinutes: 25,
    city: "Riyadh",
    address: "",
    latitude: 24.7136,
    longitude: 46.6753,
    openingHours: {
      entries: [
        { day: "Monday", is24Hours: false, openTime: "08:00", closeTime: "23:00" },
        { day: "Tuesday", is24Hours: false, openTime: "08:00", closeTime: "23:00" },
        { day: "Wednesday", is24Hours: false, openTime: "08:00", closeTime: "23:00" },
        { day: "Thursday", is24Hours: false, openTime: "08:00", closeTime: "23:00" },
        { day: "Friday", is24Hours: true, openTime: "00:00", closeTime: "00:00" },
        { day: "Saturday", is24Hours: false, openTime: "08:00", closeTime: "23:00" },
        { day: "Sunday", is24Hours: false, openTime: "08:00", closeTime: "23:00" }
      ]
    }
  });

  useEffect(() => {
    setSubmission(initialSubmission);
  }, [initialSubmission]);

  const loadStatus = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await restaurantsService.getMySubmission();
      setSubmission(data);
    } catch (err: any) {
      console.error("Failed to load submission:", err);
      // If 404, the user has no application yet, which is expected.
      if (err.message && err.message.includes("404")) {
        setSubmission(null);
      } else {
        setError("Could not retrieve application status. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplyClick = () => {
    if (submission && submission.status === "rejected") {
      // Pre-fill from rejected submission to make editing and re-submitting ultra premium and convenient
      setFormData({
        name: submission.name || "",
        description: submission.description || "",
        cuisineType: submission.cuisineType || "",
        email: submission.email || "",
        phone: submission.phone || "",
        website: submission.website || "",
        logo: submission.logo || "",
        coverImage: submission.coverImage || "",
        deliveryFee: submission.deliveryFee || 3,
        estimatedDeliveryMinutes: submission.estimatedDeliveryMinutes || 25,
        city: submission.address?.city || "Riyadh",
        address: submission.address?.street || "",
        latitude: submission.address?.latitude || 24.7136,
        longitude: submission.address?.longitude || 46.6753,
        openingHours: submission.openingHours
          ? { entries: submission.openingHours }
          : formData.openingHours
      });
    }
    setIsApplying(true);
    setCurrentStep(1);
  };

  const handleCancelApplication = async () => {
    if (!confirm("Are you sure you want to cancel your pending restaurant application?")) return;
    try {
      setIsLoading(true);
      await restaurantsService.cancelMySubmission();
      await loadStatus();
      onRefreshSubmissionStatus();
    } catch (err: any) {
      alert(`Failed to cancel application: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === "deliveryFee" || name === "estimatedDeliveryMinutes" || name === "latitude" || name === "longitude" 
        ? parseFloat(value) || 0 
        : value
    }));
  };

  const handleHoursChange = (index: number, field: keyof OpeningHourEntry, value: any) => {
    const entries = [...(formData.openingHours?.entries || [])];
    entries[index] = {
      ...entries[index],
      [field]: value
    };
    setFormData(prev => ({
      ...prev,
      openingHours: { entries }
    }));
  };

  const handleNextStep = () => {
    // Basic validation per step
    if (currentStep === 1) {
      if (!formData.name.trim() || !formData.cuisineType.trim() || !formData.email.trim() || !formData.phone.trim()) {
        alert("Please fill out all required fields marked with *");
        return;
      }
    }
    if (currentStep === 2) {
      if (!formData.logo?.trim() || !formData.coverImage?.trim()) {
        alert("Please provide valid URLs for both the Logo and Cover Banner");
        return;
      }
    }
    if (currentStep === 3) {
      if (!formData.address.trim()) {
        alert("Please provide the physical address");
        return;
      }
    }
    setCurrentStep(prev => prev + 1);
  };

  const handlePrevStep = () => {
    setCurrentStep(prev => prev - 1);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      setError(null);
      
      await restaurantsService.applyRestaurant(formData);
      setIsApplying(false);
      await loadStatus();
      onRefreshSubmissionStatus();
    } catch (err: any) {
      console.error("Submission failed:", err);
      setError(`Application submission failed: ${err.message || 'Unknown error'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-24 text-zinc-500">
        <Loader2 className="w-8 h-8 animate-spin mb-4 text-orange-500" />
        <p className="text-sm font-semibold">Updating application status...</p>
      </div>
    );
  }

  // Render multi-step application form
  if (isApplying) {
    return (
      <div className="max-w-3xl mx-auto bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-300">
        {/* Progress Bar & Header */}
        <div className="bg-gradient-to-r from-orange-500 via-orange-600 to-amber-600 p-6 text-white relative">
          <button 
            type="button"
            onClick={() => setIsApplying(false)}
            className="absolute top-4 right-4 text-white/80 hover:text-white bg-black/10 hover:bg-black/20 p-2 rounded-full transition-all"
          >
            <X className="w-4 h-4" />
          </button>
          
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/10 rounded-2xl">
              <Store className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-black tracking-tight">Restaurant Partner Application</h3>
              <p className="text-xs text-orange-100">Step {currentStep} of 4: {
                currentStep === 1 ? "General Information" :
                currentStep === 2 ? "Branding & Operations" :
                currentStep === 3 ? "Location Details" :
                "Opening Hours & Review"
              }</p>
            </div>
          </div>

          {/* Stepper bar */}
          <div className="flex gap-2 mt-6">
            {[1, 2, 3, 4].map(step => (
              <div 
                key={step} 
                className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                  step <= currentStep ? "bg-white" : "bg-white/20"
                }`}
              />
            ))}
          </div>
        </div>

        <form onSubmit={handleFormSubmit} className="p-8 space-y-6">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-bold p-4 rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          {/* STEP 1: GENERAL INFO */}
          {currentStep === 1 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5">Restaurant Name *</label>
                  <input 
                    type="text" 
                    name="name"
                    required
                    value={formData.name}
                    onChange={handleFormChange}
                    placeholder="e.g. Burger Palace"
                    className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 focus:border-orange-500 focus:outline-none text-zinc-950 dark:text-zinc-50 text-sm rounded-xl p-3"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5">Cuisine Type *</label>
                  <input 
                    type="text" 
                    name="cuisineType"
                    required
                    value={formData.cuisineType}
                    onChange={handleFormChange}
                    placeholder="e.g. American, Fast Food, Italian"
                    className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 focus:border-orange-500 focus:outline-none text-zinc-950 dark:text-zinc-50 text-sm rounded-xl p-3"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5">Description</label>
                <textarea 
                  name="description"
                  value={formData.description}
                  onChange={handleFormChange}
                  placeholder="Tell customers about your story, ingredients, and signature dishes..."
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 focus:border-orange-500 focus:outline-none text-zinc-950 dark:text-zinc-50 text-sm rounded-xl p-3 h-24 resize-none"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5">Contact Email *</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-3.5 w-4 h-4 text-zinc-400" />
                    <input 
                      type="email" 
                      name="email"
                      required
                      value={formData.email}
                      onChange={handleFormChange}
                      placeholder="partner@restaurant.com"
                      className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 focus:border-orange-500 focus:outline-none text-zinc-950 dark:text-zinc-50 text-sm rounded-xl pl-10 pr-3 py-3"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5">Contact Phone *</label>
                  <div className="relative">
                    <Phone className="absolute left-3.5 top-3.5 w-4 h-4 text-zinc-400" />
                    <input 
                      type="tel" 
                      name="phone"
                      required
                      value={formData.phone}
                      onChange={handleFormChange}
                      placeholder="+96650000000"
                      className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 focus:border-orange-500 focus:outline-none text-zinc-950 dark:text-zinc-50 text-sm rounded-xl pl-10 pr-3 py-3"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5">Website (Optional)</label>
                  <div className="relative">
                    <Globe className="absolute left-3.5 top-3.5 w-4 h-4 text-zinc-400" />
                    <input 
                      type="url" 
                      name="website"
                      value={formData.website}
                      onChange={handleFormChange}
                      placeholder="https://restaurant.com"
                      className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 focus:border-orange-500 focus:outline-none text-zinc-950 dark:text-zinc-50 text-sm rounded-xl pl-10 pr-3 py-3"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: OPERATIONS & BRANDING */}
          {currentStep === 2 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5">Logo URL *</label>
                  <div className="relative">
                    <FileImage className="absolute left-3.5 top-3.5 w-4 h-4 text-zinc-400" />
                    <input 
                      type="url" 
                      name="logo"
                      required
                      value={formData.logo}
                      onChange={handleFormChange}
                      placeholder="https://example.com/logo.jpg"
                      className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 focus:border-orange-500 focus:outline-none text-zinc-950 dark:text-zinc-50 text-sm rounded-xl pl-10 pr-3 py-3"
                    />
                  </div>
                  <span className="text-[10px] text-zinc-400 mt-1 block">You can use direct image links from Unsplash or other hosting sites.</span>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5">Cover Banner URL *</label>
                  <div className="relative">
                    <FileImage className="absolute left-3.5 top-3.5 w-4 h-4 text-zinc-400" />
                    <input 
                      type="url" 
                      name="coverImage"
                      required
                      value={formData.coverImage}
                      onChange={handleFormChange}
                      placeholder="https://example.com/banner.jpg"
                      className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 focus:border-orange-500 focus:outline-none text-zinc-950 dark:text-zinc-50 text-sm rounded-xl pl-10 pr-3 py-3"
                    />
                  </div>
                  <span className="text-[10px] text-zinc-400 mt-1 block">Recommended size: 1200 x 400 pixels.</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5">Delivery Fee ($) *</label>
                  <div className="relative">
                    <DollarSign className="absolute left-3.5 top-3.5 w-4 h-4 text-zinc-400" />
                    <input 
                      type="number" 
                      name="deliveryFee"
                      step="0.5"
                      min="0"
                      required
                      value={formData.deliveryFee}
                      onChange={handleFormChange}
                      className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 focus:border-orange-500 focus:outline-none text-zinc-950 dark:text-zinc-50 text-sm rounded-xl pl-10 pr-3 py-3"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5">Estimated Delivery Time (Mins) *</label>
                  <div className="relative">
                    <Clock className="absolute left-3.5 top-3.5 w-4 h-4 text-zinc-400" />
                    <input 
                      type="number" 
                      name="estimatedDeliveryMinutes"
                      min="5"
                      required
                      value={formData.estimatedDeliveryMinutes}
                      onChange={handleFormChange}
                      className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 focus:border-orange-500 focus:outline-none text-zinc-950 dark:text-zinc-50 text-sm rounded-xl pl-10 pr-3 py-3"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: LOCATION DETAILS */}
          {currentStep === 3 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-1">
                  <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5">City *</label>
                  <select 
                    name="city"
                    value={formData.city}
                    onChange={handleFormChange}
                    className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 focus:border-orange-500 focus:outline-none text-zinc-950 dark:text-zinc-50 text-sm rounded-xl p-3"
                  >
                    <option value="Riyadh">Riyadh</option>
                    <option value="Jeddah">Jeddah</option>
                    <option value="Dammam">Dammam</option>
                    <option value="Beirut">Beirut</option>
                    <option value="Dubai">Dubai</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5">Physical Street Address *</label>
                  <input 
                    type="text" 
                    name="address"
                    required
                    value={formData.address}
                    onChange={handleFormChange}
                    placeholder="e.g. Olaya Street, Building 45"
                    className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 focus:border-orange-500 focus:outline-none text-zinc-950 dark:text-zinc-50 text-sm rounded-xl p-3"
                  />
                </div>
              </div>

              <div className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-850 p-4 rounded-2xl grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase mb-1">Latitude Coordinate</label>
                  <input 
                    type="number" 
                    step="0.000001"
                    name="latitude"
                    value={formData.latitude}
                    onChange={handleFormChange}
                    className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 focus:outline-none text-xs rounded-lg p-2.5"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase mb-1">Longitude Coordinate</label>
                  <input 
                    type="number" 
                    step="0.000001"
                    name="longitude"
                    value={formData.longitude}
                    onChange={handleFormChange}
                    className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 focus:outline-none text-xs rounded-lg p-2.5"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: HOURS & SUBMIT */}
          {currentStep === 4 && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div>
                <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-2">Configure Weekly Opening Hours</label>
                <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-2 border border-zinc-100 dark:border-zinc-850 rounded-xl p-3 bg-zinc-50 dark:bg-zinc-950 custom-scrollbar">
                  {(formData.openingHours?.entries || []).map((entry, idx) => (
                    <div key={idx} className="flex flex-wrap items-center gap-3 py-1.5 border-b border-zinc-200/40 dark:border-zinc-800/40 last:border-b-0 text-xs">
                      <span className="font-extrabold w-20 text-zinc-700 dark:text-zinc-300">{entry.day}</span>
                      
                      <label className="flex items-center gap-1.5 text-zinc-500 cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={entry.is24Hours}
                          onChange={e => handleHoursChange(idx, "is24Hours", e.target.checked)}
                          className="accent-orange-500"
                        />
                        <span>24h Open</span>
                      </label>

                      {!entry.is24Hours && (
                        <div className="flex items-center gap-2 ml-auto">
                          <input 
                            type="text" 
                            placeholder="08:00"
                            value={entry.openTime || ""}
                            onChange={e => handleHoursChange(idx, "openTime", e.target.value)}
                            className="w-16 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded p-1 text-center font-semibold text-xs text-zinc-700 dark:text-zinc-300"
                          />
                          <span>to</span>
                          <input 
                            type="text" 
                            placeholder="23:00"
                            value={entry.closeTime || ""}
                            onChange={e => handleHoursChange(idx, "closeTime", e.target.value)}
                            className="w-16 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded p-1 text-center font-semibold text-xs text-zinc-700 dark:text-zinc-300"
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Review summary preview */}
              <div className="bg-orange-500/5 border border-orange-500/10 rounded-2xl p-4 space-y-2.5">
                <h4 className="text-xs font-bold text-orange-500 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                  Ready to submit your application!
                </h4>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  By submitting this form, you verify that you own this restaurant business and all coordinate locations are correct. Administrators will review your submission within 24-48 hours.
                </p>
              </div>
            </div>
          )}

          {/* Action Navigation buttons */}
          <div className="pt-6 border-t border-zinc-100 dark:border-zinc-800 flex justify-between">
            {currentStep > 1 ? (
              <button 
                type="button" 
                onClick={handlePrevStep}
                disabled={isSubmitting}
                className="flex items-center gap-1.5 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-bold px-4 py-2.5 rounded-xl transition-all"
              >
                <ChevronLeft className="w-4 h-4" />
                Back
              </button>
            ) : (
              <div />
            )}

            {currentStep < 4 ? (
              <button 
                type="button" 
                onClick={handleNextStep}
                className="flex items-center gap-1.5 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:opacity-90 text-xs font-bold px-5 py-2.5 rounded-xl transition-all shadow-md ml-auto"
              >
                Continue
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button 
                type="submit" 
                disabled={isSubmitting}
                className="flex items-center gap-1.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white hover:opacity-90 active:scale-95 text-xs font-bold px-6 py-2.5 rounded-xl transition-all shadow-lg shadow-orange-500/20 disabled:opacity-50 ml-auto"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    Submit Application
                    <Send className="w-4 h-4" />
                  </>
                )}
              </button>
            )}
          </div>
        </form>
      </div>
    );
  }

  // Application pending state dashboard
  if (submission && submission.status === "pending") {
    return (
      <div className="max-w-xl mx-auto space-y-6">
        <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border border-zinc-200 dark:border-zinc-800 p-8 rounded-3xl text-center space-y-6 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500 to-orange-500 animate-pulse" />
          
          <div className="relative inline-flex items-center justify-center">
            <div className="absolute inset-0 bg-amber-500/20 rounded-full blur-xl animate-ping duration-1000" />
            <div className="p-4 bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded-full relative">
              <Clock className="w-10 h-10 animate-spin" style={{ animationDuration: "8s" }} />
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-xl font-black text-zinc-900 dark:text-white tracking-tight">Application Under Review</h3>
            <p className="text-xs text-zinc-400 max-w-sm mx-auto leading-relaxed">
              We have received your request to launch <span className="font-extrabold text-orange-500">"{submission.name}"</span> on Nowlny. Our administrators are currently reviewing your documents.
            </p>
          </div>

          <div className="p-4 bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-100 dark:border-zinc-800/80 rounded-2xl text-left space-y-2.5 text-xs">
            <div className="flex justify-between items-center text-zinc-400">
              <span>Application ID</span>
              <span className="font-mono font-bold text-zinc-700 dark:text-zinc-300">{submission.id}</span>
            </div>
            <div className="flex justify-between items-center text-zinc-400">
              <span>Contact Email</span>
              <span className="font-bold text-zinc-700 dark:text-zinc-300">{submission.email || "Not provided"}</span>
            </div>
            <div className="flex justify-between items-center text-zinc-400">
              <span>Submission Date</span>
              <span className="font-bold text-zinc-700 dark:text-zinc-300">
                {submission.createdAt ? new Date(submission.createdAt).toLocaleDateString() : "Just now"}
              </span>
            </div>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row gap-3 justify-center">
            <button 
              onClick={handleCancelApplication}
              className="bg-zinc-850 dark:bg-zinc-800/40 text-red-500 border border-red-500/10 hover:bg-red-500 hover:text-white text-xs font-bold px-5 py-3 rounded-xl transition-all"
            >
              Cancel Application
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Application rejected state dashboard
  if (submission && submission.status === "rejected") {
    return (
      <div className="max-w-xl mx-auto space-y-6">
        <div className="bg-red-500/5 dark:bg-red-500/10 border border-red-500/20 p-8 rounded-3xl text-center space-y-6 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-red-500" />
          
          <div className="p-4 bg-red-500/10 text-red-500 border border-red-500/20 rounded-full inline-flex">
            <ShieldAlert className="w-10 h-10" />
          </div>

          <div className="space-y-2">
            <h3 className="text-xl font-black text-red-500 tracking-tight">Application Declined</h3>
            <p className="text-xs text-zinc-400 max-w-sm mx-auto leading-relaxed">
              Unfortunately, your application for <span className="font-extrabold text-orange-500">"{submission.name}"</span> was rejected. Please review the reason below.
            </p>
          </div>

          {/* Rejection reason box */}
          <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-5 text-left text-xs text-red-600 dark:text-red-400 space-y-1.5">
            <p className="font-extrabold uppercase tracking-wider text-[10px]">Rejection Reason:</p>
            <p className="font-bold leading-relaxed">{submission.rejectionReason || "No details provided by administrator."}</p>
          </div>

          <div className="pt-2">
            <button 
              onClick={handleApplyClick}
              className="bg-gradient-to-r from-orange-500 to-amber-500 text-white hover:opacity-90 active:scale-95 text-xs font-bold px-6 py-3 rounded-xl transition-all shadow-lg shadow-orange-500/20"
            >
              Edit & Re-submit Application
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Application cancelled state dashboard
  if (submission && submission.status === "cancelled") {
    return (
      <div className="max-w-xl mx-auto space-y-6">
        <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border border-zinc-200 dark:border-zinc-800 p-8 rounded-3xl text-center space-y-6 shadow-xl">
          <div className="p-4 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 rounded-full inline-flex">
            <X className="w-10 h-10" />
          </div>

          <div className="space-y-2">
            <h3 className="text-xl font-black text-zinc-900 dark:text-white tracking-tight">Application Cancelled</h3>
            <p className="text-xs text-zinc-400 max-w-sm mx-auto leading-relaxed">
              Your application was cancelled. You can launch a brand-new application anytime.
            </p>
          </div>

          <div className="pt-2">
            <button 
              onClick={handleApplyClick}
              className="bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold px-6 py-3 rounded-xl transition-all shadow-lg"
            >
              Start New Application
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Standard Welcome Screen (No submission yet)
  return (
    <div className="max-w-4xl mx-auto space-y-10 animate-in fade-in duration-300">
      {/* Premium Hero Banner */}
      <div className="relative bg-zinc-950 border border-zinc-800 rounded-3xl p-8 md:p-12 overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-80 h-80 bg-orange-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-amber-500/5 rounded-full blur-3xl" />

        <div className="relative space-y-6 max-w-lg">
          <span className="bg-gradient-to-r from-orange-500 to-amber-500 text-white text-[10px] font-black uppercase px-3 py-1.5 rounded-full tracking-widest shadow-md">
            Partner Portal
          </span>
          <h2 className="text-3xl md:text-4xl font-black text-white leading-tight tracking-tight">
            Grow Your Business with Nowlny Food
          </h2>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Reach thousands of hungry food lovers in your city. Partner with us to boost your sales, expand your kitchen's digital presence, and manage orders on our premium, state-of-the-art merchant ecosystem.
          </p>
          
          <button 
            onClick={handleApplyClick}
            className="flex items-center gap-2 bg-gradient-to-r from-orange-500 via-orange-600 to-amber-600 text-white text-xs font-extrabold px-6 py-3.5 rounded-2xl hover:opacity-90 active:scale-95 shadow-lg shadow-orange-500/20 transition-all"
          >
            <Store className="w-4 h-4" />
            Apply to be a Restaurant Partner
          </button>
        </div>
      </div>

      {/* Feature Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-2xl shadow-sm space-y-3">
          <div className="p-3 bg-orange-500/10 text-orange-500 rounded-xl w-fit">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <h4 className="font-bold text-sm text-zinc-900 dark:text-white">Seamless Management</h4>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Configure catalogs, prices, descriptions, and categories dynamically using our merchant management app.
          </p>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-2xl shadow-sm space-y-3">
          <div className="p-3 bg-emerald-500/10 text-emerald-500 rounded-xl w-fit">
            <DollarSign className="w-5 h-5" />
          </div>
          <h4 className="font-bold text-sm text-zinc-900 dark:text-white">Instant Revenue tracking</h4>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Track daily gross revenue, successful orders count, and rating reviews in a real-time responsive dashboard.
          </p>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-2xl shadow-sm space-y-3">
          <div className="p-3 bg-blue-500/10 text-blue-500 rounded-xl w-fit">
            <Clock className="w-5 h-5" />
          </div>
          <h4 className="font-bold text-sm text-zinc-900 dark:text-white">Fast Logistics</h4>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Our optimized delivery dispatch fleet ensures that food arrives warm, fresh, and on-time to customer doorsteps.
          </p>
        </div>
      </div>
    </div>
  );
}
