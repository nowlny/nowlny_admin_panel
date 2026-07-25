"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Store,
  Send,
  X,
  ShieldAlert,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  DollarSign,
  Clock,
  Loader2,
  AlertCircle,
  Sparkles,
  Phone,
  Mail,
  Globe,
  FileImage,
  Pencil,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  restaurantsService,
  RestaurantSubmission,
  RestaurantCreate,
  OpeningHourEntry,
} from "../../services/restaurants";
import { useConfirm } from "./ui/ConfirmDialog";
import { formatDate, shortId } from "../../lib/format";

interface RestaurantApplicationSectionProps {
  onRefreshSubmissionStatus: () => void;
  initialSubmission: RestaurantSubmission | null;
}

/**
 * Numbers live in state as raw strings.
 *
 * They used to be coerced with `parseFloat(value) || 0` on every keystroke,
 * which made a decimal literally untypeable: after "24." the input value is ""
 * (an incomplete number), `parseFloat` returned NaN, `|| 0` wrote 0 and React
 * re-rendered the field as "24" — the "." was eaten every time. Clearing the
 * latitude also silently wrote 0, submitting the restaurant at 0,0 in the Gulf
 * of Guinea. The strings are coerced exactly once, at submit.
 */
type ApplicationForm = {
  name: string;
  description: string;
  cuisineType: string;
  email: string;
  phone: string;
  website: string;
  logo: string;
  coverImage: string;
  deliveryFee: string;
  estimatedDeliveryMinutes: string;
  city: string;
  address: string;
  latitude: string;
  longitude: string;
  openingHours: { entries: OpeningHourEntry[] };
};

const STEP_TITLES = [
  "General Information",
  "Branding & Operations",
  "Location Details",
  "Opening Hours & Review",
] as const;

const DEFAULT_HOURS: OpeningHourEntry[] = [
  { day: "Monday", is24Hours: false, openTime: "08:00", closeTime: "23:00" },
  { day: "Tuesday", is24Hours: false, openTime: "08:00", closeTime: "23:00" },
  { day: "Wednesday", is24Hours: false, openTime: "08:00", closeTime: "23:00" },
  { day: "Thursday", is24Hours: false, openTime: "08:00", closeTime: "23:00" },
  { day: "Friday", is24Hours: true, openTime: "00:00", closeTime: "00:00" },
  { day: "Saturday", is24Hours: false, openTime: "08:00", closeTime: "23:00" },
  { day: "Sunday", is24Hours: false, openTime: "08:00", closeTime: "23:00" },
];

const EMPTY_FORM: ApplicationForm = {
  name: "",
  description: "",
  cuisineType: "",
  email: "",
  phone: "",
  website: "",
  logo: "",
  coverImage: "",
  deliveryFee: "3",
  estimatedDeliveryMinutes: "25",
  city: "Riyadh",
  address: "",
  latitude: "24.7136",
  longitude: "46.6753",
  openingHours: { entries: DEFAULT_HOURS },
};

function formFromSubmission(s: RestaurantSubmission): ApplicationForm {
  return {
    name: s.name || "",
    description: s.description || "",
    cuisineType: s.cuisineType || "",
    email: s.email || "",
    phone: s.phone || "",
    website: s.website || "",
    logo: s.logo || "",
    coverImage: s.coverImage || "",
    deliveryFee: s.deliveryFee != null ? String(s.deliveryFee) : "3",
    estimatedDeliveryMinutes:
      s.estimatedDeliveryMinutes != null
        ? String(s.estimatedDeliveryMinutes)
        : "25",
    city: s.address?.city || "Riyadh",
    address: s.address?.street || "",
    latitude: s.address?.latitude != null ? String(s.address.latitude) : "",
    longitude: s.address?.longitude != null ? String(s.address.longitude) : "",
    openingHours: {
      entries: s.openingHours?.length ? s.openingHours : DEFAULT_HOURS,
    },
  };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^\+?[\d\s()-]{7,20}$/;

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

type Errors = Record<string, string>;

/** Field-level validation, per step. Step 4 covers the opening-hours rows. */
function validateStep(step: number, data: ApplicationForm): Errors {
  const errors: Errors = {};

  if (step === 1) {
    if (!data.name.trim()) errors.name = "Restaurant name is required.";
    if (!data.cuisineType.trim())
      errors.cuisineType = "Tell customers what you cook.";
    if (!data.email.trim()) errors.email = "A contact email is required.";
    else if (!EMAIL_RE.test(data.email.trim()))
      errors.email = "Enter a valid email address, e.g. owner@restaurant.com.";
    if (!data.phone.trim()) errors.phone = "A contact phone number is required.";
    else if (!PHONE_RE.test(data.phone.trim()))
      errors.phone = "Enter a valid phone number, e.g. +966500000000.";
    if (data.website.trim() && !isHttpUrl(data.website))
      errors.website = "Enter a full URL starting with https://.";
  }

  if (step === 2) {
    if (!data.logo.trim()) errors.logo = "A logo image URL is required.";
    else if (!isHttpUrl(data.logo))
      errors.logo = "Enter a full image URL starting with https://.";
    if (!data.coverImage.trim())
      errors.coverImage = "A cover banner image URL is required.";
    else if (!isHttpUrl(data.coverImage))
      errors.coverImage = "Enter a full image URL starting with https://.";

    const fee = Number(data.deliveryFee);
    if (!data.deliveryFee.trim() || !Number.isFinite(fee))
      errors.deliveryFee = "Enter a delivery fee, e.g. 3.50.";
    else if (fee < 0) errors.deliveryFee = "The fee cannot be negative.";

    const eta = Number(data.estimatedDeliveryMinutes);
    if (!data.estimatedDeliveryMinutes.trim() || !Number.isFinite(eta))
      errors.estimatedDeliveryMinutes = "Enter an estimate in minutes.";
    else if (eta < 5)
      errors.estimatedDeliveryMinutes = "Give yourself at least 5 minutes.";
  }

  if (step === 3) {
    if (!data.address.trim())
      errors.address = "The physical street address is required.";

    const lat = Number(data.latitude);
    if (!data.latitude.trim() || !Number.isFinite(lat))
      errors.latitude = "Enter a latitude, e.g. 24.7136.";
    else if (lat < -90 || lat > 90)
      errors.latitude = "Latitude must be between -90 and 90.";

    const lng = Number(data.longitude);
    if (!data.longitude.trim() || !Number.isFinite(lng))
      errors.longitude = "Enter a longitude, e.g. 46.6753.";
    else if (lng < -180 || lng > 180)
      errors.longitude = "Longitude must be between -180 and 180.";
  }

  if (step === 4) {
    data.openingHours.entries.forEach((entry, idx) => {
      if (entry.is24Hours) return;
      if (!entry.openTime || !entry.closeTime) {
        errors[`hours-${idx}`] = `Set both times for ${entry.day}, or tick 24h.`;
      } else if (entry.openTime === entry.closeTime) {
        errors[`hours-${idx}`] =
          `${entry.day} opens and closes at the same time — tick 24h instead.`;
      }
    });
  }

  return errors;
}

/** DOM id for a form field, so labels, errors and focus management agree. */
const fid = (name: string) => `app-${name}`;

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p
      id={id}
      className="mt-1.5 flex items-start gap-1 text-[11px] font-semibold text-red-600 dark:text-red-400"
    >
      <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
      {message}
    </p>
  );
}

const LABEL =
  "block text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5";
const HELP = "text-[10px] text-zinc-500 dark:text-zinc-400 mt-1 block";
const BODY = "text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed";

/** Orange asterisk — the old `text-zinc-400` one was invisible next to the label. */
const Req = () => (
  <span className="text-orange-500" aria-hidden="true">
    {" "}
    *
  </span>
);

function inputCls(hasError: boolean, padding = "p-3") {
  return [
    "w-full bg-zinc-50 dark:bg-zinc-950 border text-zinc-950 dark:text-zinc-50 text-sm rounded-xl transition-colors",
    padding,
    "focus:outline-none focus:ring-2",
    hasError
      ? "border-red-500 focus:border-red-500 focus:ring-red-500/30"
      : "border-zinc-200 dark:border-zinc-800 focus:border-orange-500 focus:ring-orange-500/30",
  ].join(" ");
}

export default function RestaurantApplicationSection({
  onRefreshSubmissionStatus,
  initialSubmission,
}: RestaurantApplicationSectionProps) {
  const confirm = useConfirm();
  const [submission, setSubmission] = useState<RestaurantSubmission | null>(
    initialSubmission,
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form states
  const [isApplying, setIsApplying] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [errors, setErrors] = useState<Errors>({});
  const [focusField, setFocusField] = useState<string | null>(null);

  const [formData, setFormData] = useState<ApplicationForm>(EMPTY_FORM);

  // Serialised snapshot of the last "saved or freshly opened" form, so we can
  // tell whether the merchant has unsaved typing.
  const pristineRef = useRef(JSON.stringify(EMPTY_FORM));
  const isDirty = JSON.stringify(formData) !== pristineRef.current;

  const setPristine = useCallback((next: ApplicationForm) => {
    pristineRef.current = JSON.stringify(next);
  }, []);

  useEffect(() => {
    setSubmission(initialSubmission);
  }, [initialSubmission]);

  // Move focus to the first invalid field, after the step has rendered.
  useEffect(() => {
    if (!focusField) return;
    const el = document.getElementById(focusField);
    el?.focus();
    el?.scrollIntoView({ block: "center", behavior: "smooth" });
    setFocusField(null);
  }, [focusField, currentStep]);

  // A reload or tab close mid-application would silently bin four steps of typing.
  useEffect(() => {
    if (!isApplying || !isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isApplying, isDirty]);

  const loadStatus = async () => {
    try {
      setIsLoading(true);
      const data = await restaurantsService.getMySubmission();
      setSubmission(data);
    } catch (err: any) {
      console.error("Failed to load submission:", err);
      // If 404, the user has no application yet, which is expected.
      if (err.message && err.message.includes("404")) {
        setSubmission(null);
      } else {
        toast.error("Could not retrieve application status. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplyClick = () => {
    // Only re-prefill when there is nothing unsaved to lose — re-opening the
    // form used to silently overwrite edits with the server's copy.
    if (!isDirty) {
      const next =
        submission &&
        (submission.status === "rejected" || submission.status === "pending")
          ? formFromSubmission(submission)
          : EMPTY_FORM;
      setFormData(next);
      setPristine(next);
    }
    setErrors({});
    setIsApplying(true);
    setCurrentStep(1);
  };

  const handleCloseForm = async () => {
    if (isDirty) {
      const ok = await confirm({
        title: "Discard your application?",
        description:
          "You have unsaved changes on this form. Closing it now loses everything you have typed.",
        confirmLabel: "Discard changes",
        cancelLabel: "Keep editing",
        variant: "danger",
      });
      if (!ok) return;
    }
    setErrors({});
    setIsApplying(false);
  };

  const handleCancelApplication = async () => {
    const ok = await confirm({
      title: `Cancel the application for “${submission?.name ?? "your restaurant"}”?`,
      description:
        "Your pending application is withdrawn from review. You can start a new one afterwards.",
      confirmLabel: "Cancel application",
      cancelLabel: "Keep it pending",
      variant: "danger",
    });
    if (!ok) return;
    try {
      setIsLoading(true);
      await restaurantsService.cancelMySubmission();
      await loadStatus();
      toast.success("Application cancelled successfully.");
      onRefreshSubmissionStatus();
    } catch (err: any) {
      toast.error(`Failed to cancel application: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFormChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    const { name, value } = e.target;
    // Raw string in, no numeric coercion — see the ApplicationForm note.
    setFormData((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => {
      if (!prev[name]) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
  };

  const handleHoursChange = (
    index: number,
    field: keyof OpeningHourEntry,
    value: any,
  ) => {
    const entries = [...formData.openingHours.entries];
    entries[index] = { ...entries[index], [field]: value };
    setFormData((prev) => ({ ...prev, openingHours: { entries } }));
    setErrors((prev) => {
      if (!prev[`hours-${index}`]) return prev;
      const next = { ...prev };
      delete next[`hours-${index}`];
      return next;
    });
  };

  /** Maps an error key to the DOM id that should receive focus. */
  const errorFieldId = (key: string) =>
    key.startsWith("hours-") ? fid(`openTime-${key.slice(6)}`) : fid(key);

  const applyErrors = (step: number, found: Errors) => {
    setErrors(found);
    const firstKey = Object.keys(found)[0];
    if (firstKey) setFocusField(errorFieldId(firstKey));
    const count = Object.keys(found).length;
    toast.error(
      count === 1
        ? found[firstKey]
        : `${count} fields on step ${step} need attention.`,
    );
  };

  const handleNextStep = () => {
    const found = validateStep(currentStep, formData);
    if (Object.keys(found).length > 0) {
      applyErrors(currentStep, found);
      return;
    }
    setErrors({});
    setCurrentStep((prev) => Math.min(prev + 1, 4));
  };

  const handlePrevStep = () => {
    setErrors({});
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  /** Stepper navigation: back is always free, forward validates what it skips. */
  const goToStep = (target: number) => {
    if (target === currentStep) return;
    if (target < currentStep) {
      setErrors({});
      setCurrentStep(target);
      return;
    }
    for (let step = currentStep; step < target; step++) {
      const found = validateStep(step, formData);
      if (Object.keys(found).length > 0) {
        setCurrentStep(step);
        applyErrors(step, found);
        return;
      }
    }
    setErrors({});
    setCurrentStep(target);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Enter inside a text field triggers implicit submission. On steps 1-3 that
    // must advance the wizard, never fire off the whole application unreviewed.
    if (currentStep < 4) {
      handleNextStep();
      return;
    }

    // The steps are conditionally unmounted, so the browser's own `required` /
    // `type="email"` / `type="url"` checks never saw steps 1-3. Re-run every
    // gate here before anything reaches the API.
    for (let step = 1; step <= 4; step++) {
      const found = validateStep(step, formData);
      if (Object.keys(found).length > 0) {
        setCurrentStep(step);
        applyErrors(step, found);
        return;
      }
    }

    const isUpdate = !!submission && submission.status === "pending";
    const numbers = {
      deliveryFee: Number(formData.deliveryFee),
      estimatedDeliveryMinutes: Number(formData.estimatedDeliveryMinutes),
      latitude: Number(formData.latitude),
      longitude: Number(formData.longitude),
    };

    try {
      setIsSubmitting(true);
      if (isUpdate) {
        const updatePayload: Partial<RestaurantSubmission> = {
          name: formData.name,
          description: formData.description,
          logo: formData.logo,
          coverImage: formData.coverImage,
          email: formData.email,
          phone: formData.phone,
          website: formData.website,
          cuisineType: formData.cuisineType,
          deliveryFee: numbers.deliveryFee,
          estimatedDeliveryMinutes: numbers.estimatedDeliveryMinutes,
          openingHours: formData.openingHours.entries,
          address: {
            city: formData.city,
            street: formData.address,
            latitude: numbers.latitude,
            longitude: numbers.longitude,
          },
        };
        await restaurantsService.updateMySubmission(updatePayload);
      } else {
        const createPayload: RestaurantCreate = {
          name: formData.name,
          description: formData.description,
          cuisineType: formData.cuisineType,
          email: formData.email,
          phone: formData.phone,
          website: formData.website,
          logo: formData.logo,
          coverImage: formData.coverImage,
          city: formData.city,
          address: formData.address,
          openingHours: formData.openingHours,
          ...numbers,
        };
        await restaurantsService.applyRestaurant(createPayload);
      }
      setPristine(formData);
      setIsApplying(false);
      await loadStatus();
      toast.success(
        isUpdate
          ? "Application updated successfully!"
          : "Application submitted successfully!",
      );
      onRefreshSubmissionStatus();
    } catch (err: any) {
      console.error("Submission failed:", err);
      toast.error(
        `Application submission failed: ${err.message || "Unknown error"}`,
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-24 text-zinc-500 dark:text-zinc-400">
        <Loader2 className="w-8 h-8 animate-spin mb-4 text-orange-500" />
        <p className="text-sm font-semibold">Updating application status...</p>
      </div>
    );
  }

  // Render multi-step application form
  if (isApplying) {
    const reviewGroups: {
      step: number;
      title: string;
      rows: [string, string][];
    }[] = [
      {
        step: 1,
        title: "General information",
        rows: [
          ["Restaurant name", formData.name],
          ["Cuisine type", formData.cuisineType],
          ["Description", formData.description || "—"],
          ["Contact email", formData.email],
          ["Contact phone", formData.phone],
          ["Website", formData.website || "—"],
        ],
      },
      {
        step: 2,
        title: "Branding & operations",
        rows: [
          ["Logo URL", formData.logo],
          ["Cover banner URL", formData.coverImage],
          ["Delivery fee", `$${formData.deliveryFee}`],
          ["Estimated delivery", `${formData.estimatedDeliveryMinutes} min`],
        ],
      },
      {
        step: 3,
        title: "Location",
        rows: [
          ["City", formData.city],
          ["Street address", formData.address],
          ["Coordinates", `${formData.latitude}, ${formData.longitude}`],
        ],
      },
    ];

    return (
      <div className="max-w-3xl mx-auto bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-300">
        {/* Progress Bar & Header */}
        <div className="bg-gradient-to-r from-orange-500 via-orange-600 to-amber-600 p-6 text-white relative">
          <button
            type="button"
            onClick={handleCloseForm}
            aria-label="Close application form"
            className="absolute top-4 right-4 text-white/80 hover:text-white bg-black/10 hover:bg-black/20 p-2.5 rounded-full transition-all"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/10 rounded-2xl">
              <Store className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-black tracking-tight">
                Restaurant Partner Application
              </h3>
              <p className="text-xs text-orange-100">
                Step {currentStep} of 4: {STEP_TITLES[currentStep - 1]}
              </p>
            </div>
          </div>

          {/* Stepper — navigable, not four decorative bars */}
          <div
            role="progressbar"
            aria-valuemin={1}
            aria-valuemax={4}
            aria-valuenow={currentStep}
            aria-valuetext={`Step ${currentStep} of 4: ${STEP_TITLES[currentStep - 1]}`}
            className="sr-only"
          />
          <nav aria-label="Application steps" className="mt-6">
            <ol className="flex gap-2">
              {STEP_TITLES.map((label, index) => {
                const step = index + 1;
                const done = step < currentStep;
                const active = step === currentStep;
                return (
                  <li key={label} className="flex-1">
                    <button
                      type="button"
                      onClick={() => goToStep(step)}
                      aria-current={active ? "step" : undefined}
                      className="w-full text-left rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                    >
                      <span
                        className={`block h-1.5 rounded-full transition-all duration-300 ${
                          done || active ? "bg-white" : "bg-white/25"
                        }`}
                      />
                      <span
                        className={`mt-1.5 hidden sm:block text-[10px] font-bold leading-tight transition-colors ${
                          active
                            ? "text-white"
                            : "text-orange-100/70 hover:text-white"
                        }`}
                      >
                        {step}. {label}
                      </span>
                      <span className="sr-only">
                        {active ? " (current step)" : ""}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </nav>
        </div>

        <form onSubmit={handleFormSubmit} noValidate className="p-8 space-y-6">
          {/* STEP 1: GENERAL INFO */}
          {currentStep === 1 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor={fid("name")} className={LABEL}>
                    Restaurant Name
                    <Req />
                  </label>
                  <input
                    id={fid("name")}
                    type="text"
                    name="name"
                    required
                    aria-invalid={!!errors.name}
                    aria-describedby={
                      errors.name ? `${fid("name")}-error` : undefined
                    }
                    value={formData.name}
                    onChange={handleFormChange}
                    placeholder="e.g. Burger Palace"
                    className={inputCls(!!errors.name)}
                  />
                  <FieldError
                    id={`${fid("name")}-error`}
                    message={errors.name}
                  />
                </div>
                <div>
                  <label htmlFor={fid("cuisineType")} className={LABEL}>
                    Cuisine Type
                    <Req />
                  </label>
                  <input
                    id={fid("cuisineType")}
                    type="text"
                    name="cuisineType"
                    required
                    aria-invalid={!!errors.cuisineType}
                    aria-describedby={
                      errors.cuisineType
                        ? `${fid("cuisineType")}-error`
                        : undefined
                    }
                    value={formData.cuisineType}
                    onChange={handleFormChange}
                    placeholder="e.g. American, Fast Food, Italian"
                    className={inputCls(!!errors.cuisineType)}
                  />
                  <FieldError
                    id={`${fid("cuisineType")}-error`}
                    message={errors.cuisineType}
                  />
                </div>
              </div>

              <div>
                <label htmlFor={fid("description")} className={LABEL}>
                  Description
                </label>
                <textarea
                  id={fid("description")}
                  name="description"
                  value={formData.description}
                  onChange={handleFormChange}
                  placeholder="Tell customers about your story, ingredients, and signature dishes..."
                  className={`${inputCls(false)} h-24 resize-none`}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label htmlFor={fid("email")} className={LABEL}>
                    Contact Email
                    <Req />
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-3.5 w-4 h-4 text-zinc-400 pointer-events-none" />
                    <input
                      id={fid("email")}
                      type="email"
                      name="email"
                      required
                      aria-invalid={!!errors.email}
                      aria-describedby={
                        errors.email ? `${fid("email")}-error` : undefined
                      }
                      value={formData.email}
                      onChange={handleFormChange}
                      placeholder="partner@restaurant.com"
                      className={inputCls(!!errors.email, "pl-10 pr-3 py-3")}
                    />
                  </div>
                  <FieldError
                    id={`${fid("email")}-error`}
                    message={errors.email}
                  />
                </div>
                <div>
                  <label htmlFor={fid("phone")} className={LABEL}>
                    Contact Phone
                    <Req />
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3.5 top-3.5 w-4 h-4 text-zinc-400 pointer-events-none" />
                    <input
                      id={fid("phone")}
                      type="tel"
                      name="phone"
                      required
                      aria-invalid={!!errors.phone}
                      aria-describedby={
                        errors.phone ? `${fid("phone")}-error` : undefined
                      }
                      value={formData.phone}
                      onChange={handleFormChange}
                      placeholder="+96650000000"
                      className={inputCls(!!errors.phone, "pl-10 pr-3 py-3")}
                    />
                  </div>
                  <FieldError
                    id={`${fid("phone")}-error`}
                    message={errors.phone}
                  />
                </div>
                <div>
                  <label htmlFor={fid("website")} className={LABEL}>
                    Website (Optional)
                  </label>
                  <div className="relative">
                    <Globe className="absolute left-3.5 top-3.5 w-4 h-4 text-zinc-400 pointer-events-none" />
                    <input
                      id={fid("website")}
                      type="url"
                      name="website"
                      aria-invalid={!!errors.website}
                      aria-describedby={
                        errors.website ? `${fid("website")}-error` : undefined
                      }
                      value={formData.website}
                      onChange={handleFormChange}
                      placeholder="https://restaurant.com"
                      className={inputCls(!!errors.website, "pl-10 pr-3 py-3")}
                    />
                  </div>
                  <FieldError
                    id={`${fid("website")}-error`}
                    message={errors.website}
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: OPERATIONS & BRANDING */}
          {currentStep === 2 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor={fid("logo")} className={LABEL}>
                    Logo URL
                    <Req />
                  </label>
                  <div className="relative">
                    <FileImage className="absolute left-3.5 top-3.5 w-4 h-4 text-zinc-400 pointer-events-none" />
                    <input
                      id={fid("logo")}
                      type="url"
                      name="logo"
                      required
                      aria-invalid={!!errors.logo}
                      aria-describedby={`${fid("logo")}-help${errors.logo ? ` ${fid("logo")}-error` : ""}`}
                      value={formData.logo}
                      onChange={handleFormChange}
                      placeholder="https://example.com/logo.jpg"
                      className={inputCls(!!errors.logo, "pl-10 pr-3 py-3")}
                    />
                  </div>
                  <FieldError
                    id={`${fid("logo")}-error`}
                    message={errors.logo}
                  />
                  <span id={`${fid("logo")}-help`} className={HELP}>
                    You can use direct image links from Unsplash or other
                    hosting sites.
                  </span>
                </div>
                <div>
                  <label htmlFor={fid("coverImage")} className={LABEL}>
                    Cover Banner URL
                    <Req />
                  </label>
                  <div className="relative">
                    <FileImage className="absolute left-3.5 top-3.5 w-4 h-4 text-zinc-400 pointer-events-none" />
                    <input
                      id={fid("coverImage")}
                      type="url"
                      name="coverImage"
                      required
                      aria-invalid={!!errors.coverImage}
                      aria-describedby={`${fid("coverImage")}-help${errors.coverImage ? ` ${fid("coverImage")}-error` : ""}`}
                      value={formData.coverImage}
                      onChange={handleFormChange}
                      placeholder="https://example.com/banner.jpg"
                      className={inputCls(
                        !!errors.coverImage,
                        "pl-10 pr-3 py-3",
                      )}
                    />
                  </div>
                  <FieldError
                    id={`${fid("coverImage")}-error`}
                    message={errors.coverImage}
                  />
                  <span id={`${fid("coverImage")}-help`} className={HELP}>
                    Recommended size: 1200 x 400 pixels.
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div>
                  <label htmlFor={fid("deliveryFee")} className={LABEL}>
                    Delivery Fee ($)
                    <Req />
                  </label>
                  <div className="relative">
                    <DollarSign className="absolute left-3.5 top-3.5 w-4 h-4 text-zinc-400 pointer-events-none" />
                    <input
                      id={fid("deliveryFee")}
                      type="text"
                      inputMode="decimal"
                      name="deliveryFee"
                      required
                      aria-invalid={!!errors.deliveryFee}
                      aria-describedby={
                        errors.deliveryFee
                          ? `${fid("deliveryFee")}-error`
                          : undefined
                      }
                      value={formData.deliveryFee}
                      onChange={handleFormChange}
                      placeholder="3.50"
                      className={inputCls(
                        !!errors.deliveryFee,
                        "pl-10 pr-3 py-3",
                      )}
                    />
                  </div>
                  <FieldError
                    id={`${fid("deliveryFee")}-error`}
                    message={errors.deliveryFee}
                  />
                </div>
                <div>
                  <label
                    htmlFor={fid("estimatedDeliveryMinutes")}
                    className={LABEL}
                  >
                    Estimated Delivery Time (Mins)
                    <Req />
                  </label>
                  <div className="relative">
                    <Clock className="absolute left-3.5 top-3.5 w-4 h-4 text-zinc-400 pointer-events-none" />
                    <input
                      id={fid("estimatedDeliveryMinutes")}
                      type="text"
                      inputMode="numeric"
                      name="estimatedDeliveryMinutes"
                      required
                      aria-invalid={!!errors.estimatedDeliveryMinutes}
                      aria-describedby={
                        errors.estimatedDeliveryMinutes
                          ? `${fid("estimatedDeliveryMinutes")}-error`
                          : undefined
                      }
                      value={formData.estimatedDeliveryMinutes}
                      onChange={handleFormChange}
                      placeholder="25"
                      className={inputCls(
                        !!errors.estimatedDeliveryMinutes,
                        "pl-10 pr-3 py-3",
                      )}
                    />
                  </div>
                  <FieldError
                    id={`${fid("estimatedDeliveryMinutes")}-error`}
                    message={errors.estimatedDeliveryMinutes}
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: LOCATION DETAILS */}
          {currentStep === 3 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-1">
                  <label htmlFor={fid("city")} className={LABEL}>
                    City
                    <Req />
                  </label>
                  <select
                    id={fid("city")}
                    name="city"
                    value={formData.city}
                    onChange={handleFormChange}
                    className={`${inputCls(false)} pr-8`}
                  >
                    <option value="Riyadh">Riyadh</option>
                    <option value="Jeddah">Jeddah</option>
                    <option value="Dammam">Dammam</option>
                    <option value="Beirut">Beirut</option>
                    <option value="Dubai">Dubai</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label htmlFor={fid("address")} className={LABEL}>
                    Physical Street Address
                    <Req />
                  </label>
                  <input
                    id={fid("address")}
                    type="text"
                    name="address"
                    required
                    aria-invalid={!!errors.address}
                    aria-describedby={
                      errors.address ? `${fid("address")}-error` : undefined
                    }
                    value={formData.address}
                    onChange={handleFormChange}
                    placeholder="e.g. Olaya Street, Building 45"
                    className={inputCls(!!errors.address)}
                  />
                  <FieldError
                    id={`${fid("address")}-error`}
                    message={errors.address}
                  />
                </div>
              </div>

              <div className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-850 p-4 rounded-2xl grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor={fid("latitude")} className={LABEL}>
                    Latitude Coordinate
                    <Req />
                  </label>
                  <input
                    id={fid("latitude")}
                    type="text"
                    inputMode="decimal"
                    name="latitude"
                    required
                    aria-invalid={!!errors.latitude}
                    aria-describedby={
                      errors.latitude ? `${fid("latitude")}-error` : undefined
                    }
                    value={formData.latitude}
                    onChange={handleFormChange}
                    placeholder="24.7136"
                    className={`${inputCls(!!errors.latitude, "p-2.5")} bg-white dark:bg-zinc-900 text-xs rounded-lg`}
                  />
                  <FieldError
                    id={`${fid("latitude")}-error`}
                    message={errors.latitude}
                  />
                </div>
                <div>
                  <label htmlFor={fid("longitude")} className={LABEL}>
                    Longitude Coordinate
                    <Req />
                  </label>
                  <input
                    id={fid("longitude")}
                    type="text"
                    inputMode="decimal"
                    name="longitude"
                    required
                    aria-invalid={!!errors.longitude}
                    aria-describedby={
                      errors.longitude ? `${fid("longitude")}-error` : undefined
                    }
                    value={formData.longitude}
                    onChange={handleFormChange}
                    placeholder="46.6753"
                    className={`${inputCls(!!errors.longitude, "p-2.5")} bg-white dark:bg-zinc-900 text-xs rounded-lg`}
                  />
                  <FieldError
                    id={`${fid("longitude")}-error`}
                    message={errors.longitude}
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: HOURS & REVIEW */}
          {currentStep === 4 && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div>
                <h4 className={LABEL}>Configure Weekly Opening Hours</h4>
                <div className="space-y-2.5 max-h-[260px] overflow-y-auto pr-2 border border-zinc-100 dark:border-zinc-850 rounded-xl p-3 bg-zinc-50 dark:bg-zinc-950 custom-scrollbar">
                  {formData.openingHours.entries.map((entry, idx) => {
                    const rowError = errors[`hours-${idx}`];
                    // Closing before opening is a legitimate overnight shift
                    // (e.g. 18:00 → 02:00), so it's flagged, not rejected.
                    const overnight =
                      !entry.is24Hours &&
                      !!entry.openTime &&
                      !!entry.closeTime &&
                      entry.closeTime < entry.openTime;
                    return (
                      <div
                        key={entry.day}
                        className="py-1.5 border-b border-zinc-200/40 dark:border-zinc-800/40 last:border-b-0 text-xs"
                      >
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="font-extrabold w-20 text-zinc-700 dark:text-zinc-300">
                            {entry.day}
                          </span>

                          <label className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-400 cursor-pointer py-2">
                            <input
                              type="checkbox"
                              checked={entry.is24Hours}
                              onChange={(e) =>
                                handleHoursChange(
                                  idx,
                                  "is24Hours",
                                  e.target.checked,
                                )
                              }
                              className="accent-orange-500 w-4 h-4"
                            />
                            <span>24h Open</span>
                          </label>

                          {!entry.is24Hours && (
                            <div className="flex items-center gap-2 ml-auto">
                              <input
                                id={fid(`openTime-${idx}`)}
                                type="time"
                                aria-label={`${entry.day} opening time`}
                                aria-invalid={!!rowError}
                                value={entry.openTime || ""}
                                onChange={(e) =>
                                  handleHoursChange(
                                    idx,
                                    "openTime",
                                    e.target.value,
                                  )
                                }
                                className={`w-24 py-2 px-2 bg-white dark:bg-zinc-900 border rounded text-center font-semibold text-xs text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-orange-500/30 ${
                                  rowError
                                    ? "border-red-500"
                                    : "border-zinc-200 dark:border-zinc-800"
                                }`}
                              />
                              <span className="text-zinc-600 dark:text-zinc-400">
                                to
                              </span>
                              <input
                                id={fid(`closeTime-${idx}`)}
                                type="time"
                                aria-label={`${entry.day} closing time`}
                                aria-invalid={!!rowError}
                                value={entry.closeTime || ""}
                                onChange={(e) =>
                                  handleHoursChange(
                                    idx,
                                    "closeTime",
                                    e.target.value,
                                  )
                                }
                                className={`w-24 py-2 px-2 bg-white dark:bg-zinc-900 border rounded text-center font-semibold text-xs text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-orange-500/30 ${
                                  rowError
                                    ? "border-red-500"
                                    : "border-zinc-200 dark:border-zinc-800"
                                }`}
                              />
                            </div>
                          )}
                        </div>
                        {rowError ? (
                          <FieldError
                            id={`${fid(`openTime-${idx}`)}-error`}
                            message={rowError}
                          />
                        ) : overnight ? (
                          <p className="mt-1 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                            Closes after midnight, the next day.
                          </p>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Read-only review of everything typed so far */}
              <div className="space-y-3">
                <h4 className={LABEL}>Review your answers</h4>
                {reviewGroups.map((group) => (
                  <div
                    key={group.step}
                    className="border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden"
                  >
                    <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-zinc-50 dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800">
                      <span className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
                        {group.title}
                      </span>
                      <button
                        type="button"
                        onClick={() => goToStep(group.step)}
                        className="flex items-center gap-1 text-[11px] font-bold text-orange-500 hover:text-orange-600 transition-colors"
                      >
                        <Pencil className="w-3 h-3" />
                        Edit
                        <span className="sr-only"> {group.title}</span>
                      </button>
                    </div>
                    <dl className="divide-y divide-zinc-100 dark:divide-zinc-850">
                      {group.rows.map(([label, value]) => (
                        <div
                          key={label}
                          className="flex justify-between gap-4 px-4 py-2"
                        >
                          <dt className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 shrink-0">
                            {label}
                          </dt>
                          <dd className="text-[11px] font-bold text-zinc-800 dark:text-zinc-200 text-right break-all">
                            {value || "—"}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                ))}
              </div>

              <div className="bg-orange-500/5 border border-orange-500/10 rounded-2xl p-4 space-y-2.5">
                <h4 className="text-xs font-bold text-orange-500 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                  Ready to submit your application!
                </h4>
                <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  By submitting this form, you verify that you own this
                  restaurant business and all coordinate locations are correct.
                  Administrators will review your submission within 24-48 hours.
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
                    {submission && submission.status === "pending"
                      ? "Update Application"
                      : "Submit Application"}
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
              <Clock
                className="w-10 h-10 animate-spin"
                style={{ animationDuration: "8s" }}
              />
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-xl font-black text-zinc-900 dark:text-white tracking-tight">
              Application Under Review
            </h3>
            <p className={`${BODY} max-w-sm mx-auto`}>
              We have received your request to launch{" "}
              <span className="font-extrabold text-orange-500">
                &ldquo;{submission.name}&rdquo;
              </span>{" "}
              on Nowlny. Our administrators are currently reviewing your
              documents.
            </p>
          </div>

          <div className="p-4 bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-100 dark:border-zinc-800/80 rounded-2xl text-left space-y-2.5 text-xs">
            <div className="flex justify-between items-center gap-3 text-zinc-500 dark:text-zinc-400">
              <span>Reference</span>
              {/* A full UUID meant nothing to a merchant and overflowed the row. */}
              <span
                className="font-mono font-bold text-zinc-700 dark:text-zinc-300"
                title={submission.id}
              >
                {shortId(submission.id)}
              </span>
            </div>
            <div className="flex justify-between items-center gap-3 text-zinc-500 dark:text-zinc-400">
              <span>Contact Email</span>
              <span className="font-bold text-zinc-700 dark:text-zinc-300 truncate">
                {submission.email || "Not provided"}
              </span>
            </div>
            <div className="flex justify-between items-center gap-3 text-zinc-500 dark:text-zinc-400">
              <span>Submission Date</span>
              <span className="font-bold text-zinc-700 dark:text-zinc-300">
                {submission.createdAt
                  ? formatDate(submission.createdAt)
                  : "Just now"}
              </span>
            </div>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={handleApplyClick}
              className="bg-zinc-100 dark:bg-zinc-800/40 text-blue-500 border border-blue-500/10 hover:bg-blue-500 hover:text-white text-xs font-bold px-5 py-3 rounded-xl transition-all"
            >
              Edit Application
            </button>
            <button
              onClick={handleCancelApplication}
              className="bg-zinc-100 dark:bg-zinc-800/40 text-red-500 border border-red-500/10 hover:bg-red-500 hover:text-white text-xs font-bold px-5 py-3 rounded-xl transition-all"
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
            <h3 className="text-xl font-black text-red-500 tracking-tight">
              Application Declined
            </h3>
            <p className={`${BODY} max-w-sm mx-auto`}>
              Unfortunately, your application for{" "}
              <span className="font-extrabold text-orange-500">
                &ldquo;{submission.name}&rdquo;
              </span>{" "}
              was rejected. Please review the reason below.
            </p>
          </div>

          {/* Rejection reason box */}
          <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-5 text-left text-xs text-red-600 dark:text-red-400 space-y-1.5">
            <p className="font-extrabold uppercase tracking-wider text-[10px]">
              Rejection Reason:
            </p>
            <p className="font-bold leading-relaxed">
              {submission.rejectionReason ||
                "No details provided by administrator."}
            </p>
          </div>

          <div className="pt-2">
            <button
              onClick={handleApplyClick}
              className="bg-gradient-to-r from-orange-500 to-amber-500 text-white hover:opacity-90 active:scale-95 text-xs font-bold px-6 py-3 rounded-xl transition-all shadow-lg shadow-orange-500/20"
            >
              Edit &amp; Re-submit Application
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
            <h3 className="text-xl font-black text-zinc-900 dark:text-white tracking-tight">
              Application Cancelled
            </h3>
            <p className={`${BODY} max-w-sm mx-auto`}>
              Your application was cancelled. You can launch a brand-new
              application anytime.
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
          <span className="inline-block bg-gradient-to-r from-orange-500 to-amber-500 text-white text-[10px] font-black uppercase px-3 py-1.5 rounded-full tracking-widest shadow-md">
            Partner Portal
          </span>
          <h2 className="text-3xl md:text-4xl font-black text-white leading-tight tracking-tight">
            Grow Your Business with Nowlny Food
          </h2>
          {/* Always on the dark hero — zinc-300 keeps contrast in both themes. */}
          <p className="text-xs text-zinc-300 leading-relaxed">
            Reach thousands of hungry food lovers in your city. Partner with us
            to boost your sales, expand your kitchen&apos;s digital presence, and
            manage orders on our premium, state-of-the-art merchant ecosystem.
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
          <h4 className="font-bold text-sm text-zinc-900 dark:text-white">
            Seamless Management
          </h4>
          <p className={BODY}>
            Configure catalogs, prices, descriptions, and categories dynamically
            using our merchant management app.
          </p>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-2xl shadow-sm space-y-3">
          <div className="p-3 bg-emerald-500/10 text-emerald-500 rounded-xl w-fit">
            <DollarSign className="w-5 h-5" />
          </div>
          <h4 className="font-bold text-sm text-zinc-900 dark:text-white">
            Instant Revenue Tracking
          </h4>
          <p className={BODY}>
            Track daily gross revenue, successful orders count, and rating
            reviews in a real-time responsive dashboard.
          </p>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-2xl shadow-sm space-y-3">
          <div className="p-3 bg-blue-500/10 text-blue-500 rounded-xl w-fit">
            <Clock className="w-5 h-5" />
          </div>
          <h4 className="font-bold text-sm text-zinc-900 dark:text-white">
            Fast Logistics
          </h4>
          <p className={BODY}>
            Our optimized delivery dispatch fleet ensures that food arrives
            warm, fresh, and on-time to customer doorsteps.
          </p>
        </div>
      </div>
    </div>
  );
}
