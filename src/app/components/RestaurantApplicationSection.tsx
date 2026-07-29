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
  Globe,
  FileImage,
  Pencil,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  restaurantsService,
  RestaurantSubmission,
  RestaurantApplyPayload,
  SubmissionUpdatePayload,
  OpeningHourEntry,
  WEEK_DAYS,
} from "../../services/restaurants";
import {
  restaurantCategoriesService,
  RestaurantCategory,
} from "../../services/restaurantCategories";
import { currenciesService, Currency } from "../../services/currencies";
import { isNotFound } from "../../services/apiClient";
import { useI18n, type MessageKey } from "../../lib/i18n";
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
  /** `SubmitRestaurantApplicationDto.categoryIds` — replaces free-text cuisine. */
  categoryIds: string[];
  currencyId: string;
  phone: string;
  website: string;
  logo: string;
  backgroundImageUrl: string;
  deliveryFee: string;
  deliveryTimeMinMinutes: string;
  deliveryTimeMaxMinutes: string;
  city: string;
  address: string;
  building: string;
  latitude: string;
  longitude: string;
  openingHours: { entries: OpeningHourEntry[] };
};

const STEP_TITLE_KEYS: MessageKey[] = [
  "app.step1",
  "app.step2",
  "app.step3",
  "app.step4",
];

/** The API's day enum is lowercase; capitalised names were rejected outright. */
const DEFAULT_HOURS: OpeningHourEntry[] = WEEK_DAYS.map((day) => ({
  day,
  is24Hours: false,
  openTime: "08:00",
  closeTime: "23:00",
}));

const dayLabel = (day: string) =>
  day.charAt(0).toUpperCase() + day.slice(1).toLowerCase();

const EMPTY_FORM: ApplicationForm = {
  name: "",
  description: "",
  categoryIds: [],
  currencyId: "",
  phone: "",
  website: "",
  logo: "",
  backgroundImageUrl: "",
  deliveryFee: "0",
  deliveryTimeMinMinutes: "20",
  deliveryTimeMaxMinutes: "45",
  city: "",
  address: "",
  building: "",
  latitude: "",
  longitude: "",
  openingHours: { entries: DEFAULT_HOURS },
};

function formFromSubmission(s: RestaurantSubmission): ApplicationForm {
  return {
    name: s.name || "",
    description: s.description || "",
    categoryIds: s.categoryIds ?? [],
    currencyId: s.currencyId || "",
    phone: s.phone || "",
    website: s.website || "",
    logo: s.logo || "",
    backgroundImageUrl: s.backgroundImageUrl || "",
    deliveryFee: s.deliveryFee != null ? String(s.deliveryFee) : "0",
    deliveryTimeMinMinutes:
      s.deliveryTimeMinMinutes != null ? String(s.deliveryTimeMinMinutes) : "20",
    deliveryTimeMaxMinutes:
      s.deliveryTimeMaxMinutes != null ? String(s.deliveryTimeMaxMinutes) : "45",
    city: s.address?.city || "",
    address: s.address?.street || "",
    building: s.address?.building || "",
    latitude: s.address?.latitude != null ? String(s.address.latitude) : "",
    longitude: s.address?.longitude != null ? String(s.address.longitude) : "",
    openingHours: {
      entries: s.openingHours?.length ? s.openingHours : DEFAULT_HOURS,
    },
  };
}

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
/** `t` is threaded in because this runs outside the component tree. */
function validateStep(
  step: number,
  data: ApplicationForm,
  t: (key: MessageKey, vars?: Record<string, string | number>) => string,
): Errors {
  const errors: Errors = {};

  if (step === 1) {
    if (!data.name.trim()) errors.name = t("app.v_name");
    if (data.categoryIds.length === 0)
      errors.categoryIds = t("app.v_categories");
    if (!data.phone.trim()) errors.phone = t("app.v_phone_required");
    else if (!PHONE_RE.test(data.phone.trim()))
      errors.phone = t("app.v_phone_invalid");
    if (data.website.trim() && !isHttpUrl(data.website))
      errors.website = t("app.v_url");
  }

  if (step === 2) {
    if (!data.logo.trim()) errors.logo = t("app.v_logo_required");
    else if (!isHttpUrl(data.logo))
      errors.logo = t("app.v_image_url");
    if (
      data.backgroundImageUrl.trim() &&
      !isHttpUrl(data.backgroundImageUrl)
    )
      errors.backgroundImageUrl = t("app.v_image_url");

    const fee = Number(data.deliveryFee);
    if (!data.deliveryFee.trim() || !Number.isFinite(fee))
      errors.deliveryFee = t("app.v_fee");
    else if (fee < 0) errors.deliveryFee = t("app.v_fee_negative");

    const min = Number(data.deliveryTimeMinMinutes);
    const max = Number(data.deliveryTimeMaxMinutes);
    if (!data.deliveryTimeMinMinutes.trim() || !Number.isFinite(min))
      errors.deliveryTimeMinMinutes = t("app.v_min_time");
    else if (min < 5)
      errors.deliveryTimeMinMinutes = t("app.v_min_low");
    if (!data.deliveryTimeMaxMinutes.trim() || !Number.isFinite(max))
      errors.deliveryTimeMaxMinutes = t("app.v_max_time");
    else if (Number.isFinite(min) && max < min)
      errors.deliveryTimeMaxMinutes = t("app.v_max_lt_min");
  }

  if (step === 3) {
    if (!data.city.trim()) errors.city = t("app.v_city");
    if (!data.address.trim())
      errors.address = t("app.v_address");

    const lat = Number(data.latitude);
    if (!data.latitude.trim() || !Number.isFinite(lat))
      errors.latitude = t("app.v_lat");
    else if (lat < -90 || lat > 90)
      errors.latitude = t("app.v_lat_range");

    const lng = Number(data.longitude);
    if (!data.longitude.trim() || !Number.isFinite(lng))
      errors.longitude = t("app.v_lng");
    else if (lng < -180 || lng > 180)
      errors.longitude = t("app.v_lng_range");
  }

  if (step === 4) {
    data.openingHours.entries.forEach((entry, idx) => {
      if (entry.is24Hours) return;
      if (!entry.openTime || !entry.closeTime) {
        errors[`hours-${idx}`] = t("app.v_hours_both", {
          day: dayLabel(entry.day),
        });
      } else if (entry.openTime === entry.closeTime) {
        errors[`hours-${idx}`] = t("app.v_hours_same", {
          day: dayLabel(entry.day),
        });
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
  const { t } = useI18n();
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

  // The application takes category *ids* and a currency code, so both lists
  // have to be on hand before the owner can fill the form in.
  const [categories, setCategories] = useState<RestaurantCategory[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      restaurantCategoriesService
        .getActiveCategories()
        .then((res) => res.data)
        .catch(() => [] as RestaurantCategory[]),
      currenciesService.getActiveCurrencies().catch(() => [] as Currency[]),
    ]).then(([categoryList, currencyList]) => {
      if (cancelled) return;
      setCategories(categoryList);
      setCurrencies(currencyList);
      setFormData((prev) =>
        prev.currencyId || currencyList.length === 0
          ? prev
          : { ...prev, currencyId: currencyList[0].code },
      );
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleCategory = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      categoryIds: prev.categoryIds.includes(id)
        ? prev.categoryIds.filter((c) => c !== id)
        : [...prev.categoryIds, id],
    }));
  };

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
      // The endpoint answers with a *paginated list*, newest first — not one
      // record. Reading `.status` off the envelope always gave `undefined`,
      // which showed owners the "you haven't applied yet" screen while their
      // application sat pending.
      setSubmission(await restaurantsService.getLatestSubmission());
    } catch (err) {
      // A 404 just means no application yet, which is the expected state for
      // a new owner. Anything else is worth surfacing.
      if (isNotFound(err)) {
        setSubmission(null);
      } else {
        console.error("Failed to load submission:", err);
        toast.error(t("app.status_failed"));
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
        title: t("app.discard_title"),
        description: t("app.discard_body"),
        confirmLabel: t("app.discard_cta"),
        cancelLabel: t("app.keep_editing"),
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
        t("app.cancel_body"),
      confirmLabel: t("app.cancel_cta"),
      cancelLabel: t("app.keep_pending"),
      variant: "danger",
    });
    if (!ok) return;
    try {
      setIsLoading(true);
      await restaurantsService.cancelMySubmission();
      await loadStatus();
      toast.success(t("app.cancelled"));
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
    const found = validateStep(currentStep, formData, t);
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
      const found = validateStep(step, formData, t);
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
      const found = validateStep(step, formData, t);
      if (Object.keys(found).length > 0) {
        setCurrentStep(step);
        applyErrors(step, found);
        return;
      }
    }

    const isUpdate = !!submission && submission.status === "pending";

    /*
     * `SubmitRestaurantApplicationDto` names the restaurant `restaurantName`,
     * takes the location as a nested `address` object, and has no `email`,
     * `cuisineType`, `coverImage` or `estimatedDeliveryMinutes` at all. The
     * previous payload sent the admin `CreateRestaurantDto` shape instead, so
     * every application submitted from this screen was rejected.
     */
    const payload: SubmissionUpdatePayload = {
      restaurantName: formData.name.trim(),
      description: formData.description.trim() || undefined,
      logo: formData.logo.trim() || undefined,
      backgroundImageUrl: formData.backgroundImageUrl.trim() || undefined,
      phone: formData.phone.trim() || undefined,
      website: formData.website.trim() || undefined,
      currencyId: formData.currencyId || undefined,
      categoryIds: formData.categoryIds,
      deliveryFee: Number(formData.deliveryFee),
      deliveryTimeMinMinutes: Number(formData.deliveryTimeMinMinutes),
      deliveryTimeMaxMinutes: Number(formData.deliveryTimeMaxMinutes),
      openingHours: formData.openingHours.entries,
      address: {
        city: formData.city.trim(),
        street: formData.address.trim(),
        building: formData.building.trim() || undefined,
        latitude: Number(formData.latitude),
        longitude: Number(formData.longitude),
      },
    };

    try {
      setIsSubmitting(true);
      if (isUpdate) {
        await restaurantsService.updateMySubmission(payload);
      } else {
        await restaurantsService.applyRestaurant(
          payload as RestaurantApplyPayload,
        );
      }
      setPristine(formData);
      setIsApplying(false);
      await loadStatus();
      toast.success(
        isUpdate
          ? t("app.updated")
          : t("app.submitted"),
      );
      onRefreshSubmissionStatus();
    } catch (err: any) {
      console.error("Submission failed:", err);
      toast.error(
        t("app.submit_failed", {
          error: err.message || t("common.unexpected"),
        }),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-24 text-zinc-500 dark:text-zinc-400">
        <Loader2 className="w-8 h-8 animate-spin mb-4 text-orange-500" />
        <p className="text-sm font-semibold">{t("app.updating_status")}</p>
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
        title: t("app.review_general"),
        rows: [
          [t("app.name"), formData.name],
          [
            t("common.categories"),
            formData.categoryIds
              .map((id) => categories.find((c) => c.id === id)?.name ?? id)
              .join(", ") || "—",
          ],
          [t("common.description"), formData.description || "—"],
          [t("app.contact_phone"), formData.phone],
          [t("common.website"), formData.website || "—"],
        ],
      },
      {
        step: 2,
        title: t("app.review_branding"),
        rows: [
          [t("common.logo_url"), formData.logo],
          [t("common.background_url"), formData.backgroundImageUrl || "—"],
          [
            t("common.delivery_fee"),
            `${formData.deliveryFee} ${formData.currencyId || ""}`.trim(),
          ],
          [
            t("common.delivery_window"),
            `${formData.deliveryTimeMinMinutes}–${formData.deliveryTimeMaxMinutes} min`,
          ],
        ],
      },
      {
        step: 3,
        title: t("app.review_location"),
        rows: [
          [t("common.city"), formData.city],
          [t("rest.street_address"), formData.address],
          [t("common.building"), formData.building || "—"],
          [t("rests.coordinates"), `${formData.latitude}, ${formData.longitude}`],
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
            aria-label={t("app.close_form")}
            className="absolute top-4 end-4 text-white/80 hover:text-white bg-black/10 hover:bg-black/20 p-2.5 rounded-full transition-all"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/10 rounded-2xl">
              <Store className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-black tracking-tight">
                {t("app.title")}
              </h3>
              <p className="text-xs text-orange-100">
                {t("app.step_of", {
                  step: currentStep,
                  title: t(STEP_TITLE_KEYS[currentStep - 1]),
                })}
              </p>
            </div>
          </div>

          {/* Stepper — navigable, not four decorative bars */}
          <div
            role="progressbar"
            aria-valuemin={1}
            aria-valuemax={4}
            aria-valuenow={currentStep}
            aria-valuetext={t("app.step_of", {
              step: currentStep,
              title: t(STEP_TITLE_KEYS[currentStep - 1]),
            })}
            className="sr-only"
          />
          <nav aria-label={t("app.steps_nav")} className="mt-6">
            <ol className="flex gap-2">
              {STEP_TITLE_KEYS.map((labelKey, index) => {
                const step = index + 1;
                const done = step < currentStep;
                const active = step === currentStep;
                return (
                  <li key={labelKey} className="flex-1">
                    <button
                      type="button"
                      onClick={() => goToStep(step)}
                      aria-current={active ? "step" : undefined}
                      className="w-full text-start rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
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
                        {step}. {t(labelKey)}
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
                    {t("app.name")}
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
                    placeholder={t("app.name_placeholder")}
                    className={inputCls(!!errors.name)}
                  />
                  <FieldError
                    id={`${fid("name")}-error`}
                    message={errors.name}
                  />
                </div>
                <div>
                  <label htmlFor={fid("currencyId")} className={LABEL}>
                    {t("rest.pricing_currency")}
                  </label>
                  <select
                    id={fid("currencyId")}
                    name="currencyId"
                    value={formData.currencyId}
                    onChange={handleFormChange}
                    className={`${inputCls(false)} pe-8`}
                  >
                    <option value="">{t("rest.platform_default")}</option>
                    {currencies.map((currency) => (
                      <option key={currency.code} value={currency.code}>
                        {currency.code} — {currency.name}
                      </option>
                    ))}
                  </select>
                  <span className={HELP}>
                    {t("app.currency_hint")}
                  </span>
                </div>
              </div>

              {/*
                Categories replace the old free-text "cuisine type" box: the API
                takes ids from the platform's own category list, and anything
                typed into that box was silently dropped on submit.
              */}
              <fieldset>
                <legend className={LABEL}>
                  {t("common.categories")}
                  <Req />
                </legend>
                {categories.length === 0 ? (
                  <p className={BODY}>{t("app.loading_categories")}</p>
                ) : (
                  <div
                    className="flex flex-wrap gap-2"
                    aria-describedby={
                      errors.categoryIds
                        ? `${fid("categoryIds")}-error`
                        : undefined
                    }
                  >
                    {categories.map((category) => {
                      const selected = formData.categoryIds.includes(
                        category.id,
                      );
                      return (
                        <button
                          key={category.id}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => toggleCategory(category.id)}
                          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
                            selected
                              ? "bg-orange-500 text-white border-orange-500 shadow-sm shadow-orange-500/20"
                              : "bg-zinc-50 dark:bg-zinc-950 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800 hover:border-orange-500/50"
                          }`}
                        >
                          {category.icon && (
                            <img
                              src={category.icon}
                              alt=""
                              className="w-3.5 h-3.5 object-contain"
                            />
                          )}
                          {category.name}
                        </button>
                      );
                    })}
                  </div>
                )}
                <FieldError
                  id={`${fid("categoryIds")}-error`}
                  message={errors.categoryIds}
                />
              </fieldset>

              <div>
                <label htmlFor={fid("description")} className={LABEL}>
                  {t("common.description")}
                </label>
                <textarea
                  id={fid("description")}
                  name="description"
                  value={formData.description}
                  onChange={handleFormChange}
                  placeholder={t("app.desc_placeholder")}
                  className={`${inputCls(false)} h-24 resize-none`}
                />
              </div>

              {/*
                The email field was removed: the application DTO has no email
                property, so anything typed here was discarded on submit while
                still being enforced as required.
              */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor={fid("phone")} className={LABEL}>
                    {t("app.contact_phone")}
                    <Req />
                  </label>
                  <div className="relative">
                    <Phone className="absolute start-3.5 top-3.5 w-4 h-4 text-zinc-400 pointer-events-none" />
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
                      placeholder={t("app.phone_placeholder")}
                      className={inputCls(!!errors.phone, "ps-10 pe-3 py-3")}
                    />
                  </div>
                  <FieldError
                    id={`${fid("phone")}-error`}
                    message={errors.phone}
                  />
                </div>
                <div>
                  <label htmlFor={fid("website")} className={LABEL}>
                    {t("app.website_optional")}
                  </label>
                  <div className="relative">
                    <Globe className="absolute start-3.5 top-3.5 w-4 h-4 text-zinc-400 pointer-events-none" />
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
                      className={inputCls(!!errors.website, "ps-10 pe-3 py-3")}
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
                    {t("common.logo_url")}
                    <Req />
                  </label>
                  <div className="relative">
                    <FileImage className="absolute start-3.5 top-3.5 w-4 h-4 text-zinc-400 pointer-events-none" />
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
                      className={inputCls(!!errors.logo, "ps-10 pe-3 py-3")}
                    />
                  </div>
                  <FieldError
                    id={`${fid("logo")}-error`}
                    message={errors.logo}
                  />
                  <span id={`${fid("logo")}-help`} className={HELP}>
                    {t("app.logo_hint")}
                  </span>
                </div>
                <div>
                  <label htmlFor={fid("backgroundImageUrl")} className={LABEL}>
                    {t("app.background_url")}
                  </label>
                  <div className="relative">
                    <FileImage className="absolute start-3.5 top-3.5 w-4 h-4 text-zinc-400 pointer-events-none" />
                    <input
                      id={fid("backgroundImageUrl")}
                      type="url"
                      name="backgroundImageUrl"
                      aria-invalid={!!errors.backgroundImageUrl}
                      aria-describedby={`${fid("backgroundImageUrl")}-help${errors.backgroundImageUrl ? ` ${fid("backgroundImageUrl")}-error` : ""}`}
                      value={formData.backgroundImageUrl}
                      onChange={handleFormChange}
                      placeholder="https://example.com/banner.jpg"
                      className={inputCls(
                        !!errors.backgroundImageUrl,
                        "ps-10 pe-3 py-3",
                      )}
                    />
                  </div>
                  <FieldError
                    id={`${fid("backgroundImageUrl")}-error`}
                    message={errors.backgroundImageUrl}
                  />
                  <span
                    id={`${fid("backgroundImageUrl")}-help`}
                    className={HELP}
                  >
                    {t("app.recommended_size")}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div>
                  <label htmlFor={fid("deliveryFee")} className={LABEL}>
                    Delivery Fee{" "}
                    {formData.currencyId ? `(${formData.currencyId})` : ""}
                    <Req />
                  </label>
                  <div className="relative">
                    <DollarSign className="absolute start-3.5 top-3.5 w-4 h-4 text-zinc-400 pointer-events-none" />
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
                      placeholder="50000"
                      className={inputCls(
                        !!errors.deliveryFee,
                        "ps-10 pe-3 py-3",
                      )}
                    />
                  </div>
                  <FieldError
                    id={`${fid("deliveryFee")}-error`}
                    message={errors.deliveryFee}
                  />
                </div>
                {/*
                  The API models the delivery estimate as a window
                  (`deliveryTimeMinMinutes`/`deliveryTimeMaxMinutes`) and shows
                  customers "20m - 45m". The single `estimatedDeliveryMinutes`
                  field this replaces did not exist on any DTO.
                */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor={fid("deliveryTimeMinMinutes")}
                      className={LABEL}
                    >
                      {t("app.fastest")}
                      <Req />
                    </label>
                    <div className="relative">
                      <Clock className="absolute start-3.5 top-3.5 w-4 h-4 text-zinc-400 pointer-events-none" />
                      <input
                        id={fid("deliveryTimeMinMinutes")}
                        type="text"
                        inputMode="numeric"
                        name="deliveryTimeMinMinutes"
                        required
                        aria-invalid={!!errors.deliveryTimeMinMinutes}
                        aria-describedby={
                          errors.deliveryTimeMinMinutes
                            ? `${fid("deliveryTimeMinMinutes")}-error`
                            : undefined
                        }
                        value={formData.deliveryTimeMinMinutes}
                        onChange={handleFormChange}
                        placeholder="20"
                        className={inputCls(
                          !!errors.deliveryTimeMinMinutes,
                          "ps-10 pe-3 py-3",
                        )}
                      />
                    </div>
                    <FieldError
                      id={`${fid("deliveryTimeMinMinutes")}-error`}
                      message={errors.deliveryTimeMinMinutes}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor={fid("deliveryTimeMaxMinutes")}
                      className={LABEL}
                    >
                      {t("app.slowest")}
                      <Req />
                    </label>
                    <div className="relative">
                      <Clock className="absolute start-3.5 top-3.5 w-4 h-4 text-zinc-400 pointer-events-none" />
                      <input
                        id={fid("deliveryTimeMaxMinutes")}
                        type="text"
                        inputMode="numeric"
                        name="deliveryTimeMaxMinutes"
                        required
                        aria-invalid={!!errors.deliveryTimeMaxMinutes}
                        aria-describedby={
                          errors.deliveryTimeMaxMinutes
                            ? `${fid("deliveryTimeMaxMinutes")}-error`
                            : undefined
                        }
                        value={formData.deliveryTimeMaxMinutes}
                        onChange={handleFormChange}
                        placeholder="45"
                        className={inputCls(
                          !!errors.deliveryTimeMaxMinutes,
                          "ps-10 pe-3 py-3",
                        )}
                      />
                    </div>
                    <FieldError
                      id={`${fid("deliveryTimeMaxMinutes")}-error`}
                      message={errors.deliveryTimeMaxMinutes}
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
                {/*
                  City was a five-item dropdown of Saudi cities. The API takes
                  free text and the platform runs on +961 numbers and LBP
                  pricing, so any merchant outside that list simply could not
                  enter their own address.
                */}
                <div className="md:col-span-1">
                  <label htmlFor={fid("city")} className={LABEL}>
                    {t("common.city")}
                    <Req />
                  </label>
                  <input
                    id={fid("city")}
                    type="text"
                    name="city"
                    required
                    aria-invalid={!!errors.city}
                    aria-describedby={
                      errors.city ? `${fid("city")}-error` : undefined
                    }
                    value={formData.city}
                    onChange={handleFormChange}
                    placeholder={t("app.city_placeholder")}
                    className={inputCls(!!errors.city)}
                  />
                  <FieldError
                    id={`${fid("city")}-error`}
                    message={errors.city}
                  />
                </div>
                <div className="md:col-span-1">
                  <label htmlFor={fid("address")} className={LABEL}>
                    {t("app.street")}
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
                    placeholder={t("app.street_placeholder")}
                    className={inputCls(!!errors.address)}
                  />
                  <FieldError
                    id={`${fid("address")}-error`}
                    message={errors.address}
                  />
                </div>
                <div className="md:col-span-1">
                  <label htmlFor={fid("building")} className={LABEL}>
                    {t("common.building")}
                  </label>
                  <input
                    id={fid("building")}
                    type="text"
                    name="building"
                    value={formData.building}
                    onChange={handleFormChange}
                    placeholder={t("app.building_placeholder")}
                    className={inputCls(false)}
                  />
                </div>
              </div>

              <div className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-850 p-4 rounded-2xl grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor={fid("latitude")} className={LABEL}>
                    {t("app.latitude")}
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
                    {t("app.longitude")}
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
                <h4 className={LABEL}>{t("app.hours_title")}</h4>
                <div className="space-y-2.5 max-h-[260px] overflow-y-auto pe-2 border border-zinc-100 dark:border-zinc-850 rounded-xl p-3 bg-zinc-50 dark:bg-zinc-950 custom-scrollbar">
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
                            {dayLabel(entry.day)}
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
                            <div className="flex items-center gap-2 ms-auto">
                              <input
                                id={fid(`openTime-${idx}`)}
                                type="time"
                                aria-label={`${dayLabel(entry.day)} opening time`}
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
                                aria-label={`${dayLabel(entry.day)} closing time`}
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
                            {t("app.closes_after_midnight")}
                          </p>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Read-only review of everything typed so far */}
              <div className="space-y-3">
                <h4 className={LABEL}>{t("app.review_answers")}</h4>
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
                        {t("app.edit_step")}
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
                          <dd className="text-[11px] font-bold text-zinc-800 dark:text-zinc-200 text-end break-all">
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
                  {t("app.ready")}
                </h4>
                <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  {t("app.terms")}
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
                <ChevronLeft className="w-4 h-4 rtl:rotate-180" />
                {t("app.back")}
              </button>
            ) : (
              <div />
            )}

            {currentStep < 4 ? (
              <button
                type="button"
                onClick={handleNextStep}
                className="flex items-center gap-1.5 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:opacity-90 text-xs font-bold px-5 py-2.5 rounded-xl transition-all shadow-md ms-auto"
              >
                {t("app.continue")}
                <ChevronRight className="w-4 h-4 rtl:rotate-180" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center gap-1.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white hover:opacity-90 active:scale-95 text-xs font-bold px-6 py-2.5 rounded-xl transition-all shadow-lg shadow-orange-500/20 disabled:opacity-50 ms-auto"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {t("app.submitting")}
                  </>
                ) : (
                  <>
                    {submission && submission.status === "pending"
                      ? t("app.update_cta")
                      : t("app.submit_cta")}
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
          <div className="absolute top-0 start-0 w-full h-1 bg-gradient-to-r from-amber-500 to-orange-500 animate-pulse" />

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
              {t("app.under_review")}
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

          <div className="p-4 bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-100 dark:border-zinc-800/80 rounded-2xl text-start space-y-2.5 text-xs">
            <div className="flex justify-between items-center gap-3 text-zinc-500 dark:text-zinc-400">
              <span>{t("app.reference")}</span>
              {/* A full UUID meant nothing to a merchant and overflowed the row. */}
              <span
                className="font-mono font-bold text-zinc-700 dark:text-zinc-300"
                title={submission.id}
              >
                {shortId(submission.id)}
              </span>
            </div>
            <div className="flex justify-between items-center gap-3 text-zinc-500 dark:text-zinc-400">
              <span>{t("app.contact_phone")}</span>
              <span className="font-bold text-zinc-700 dark:text-zinc-300 truncate">
                {submission.phone || t("rests.not_provided")}
              </span>
            </div>
            <div className="flex justify-between items-center gap-3 text-zinc-500 dark:text-zinc-400">
              <span>{t("app.submission_date")}</span>
              <span className="font-bold text-zinc-700 dark:text-zinc-300">
                {submission.createdAt
                  ? formatDate(submission.createdAt)
: t("app.just_now")}
              </span>
            </div>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={handleApplyClick}
              className="bg-zinc-100 dark:bg-zinc-800/40 text-blue-500 border border-blue-500/10 hover:bg-blue-500 hover:text-white text-xs font-bold px-5 py-3 rounded-xl transition-all"
            >
              {t("app.edit_application")}
            </button>
            <button
              onClick={handleCancelApplication}
              className="bg-zinc-100 dark:bg-zinc-800/40 text-red-500 border border-red-500/10 hover:bg-red-500 hover:text-white text-xs font-bold px-5 py-3 rounded-xl transition-all"
            >
              {t("app.cancel_application")}
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
          <div className="absolute top-0 start-0 w-full h-1 bg-red-500" />

          <div className="p-4 bg-red-500/10 text-red-500 border border-red-500/20 rounded-full inline-flex">
            <ShieldAlert className="w-10 h-10" />
          </div>

          <div className="space-y-2">
            <h3 className="text-xl font-black text-red-500 tracking-tight">
              {t("app.declined_title")}
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
          <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-5 text-start text-xs text-red-600 dark:text-red-400 space-y-1.5">
            <p className="font-extrabold uppercase tracking-wider text-[10px]">
              {t("app.rejection_reason")}
            </p>
            <p className="font-bold leading-relaxed">
              {submission.rejectionReason ||
t("app.no_admin_details")}
            </p>
          </div>

          <div className="pt-2">
            <button
              onClick={handleApplyClick}
              className="bg-gradient-to-r from-orange-500 to-amber-500 text-white hover:opacity-90 active:scale-95 text-xs font-bold px-6 py-3 rounded-xl transition-all shadow-lg shadow-orange-500/20"
            >
              {t("app.edit_resubmit")}
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
              {t("app.cancelled_title")}
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
              {t("app.start_new")}
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
        <div className="absolute top-0 end-0 w-80 h-80 bg-orange-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 start-0 w-80 h-80 bg-amber-500/5 rounded-full blur-3xl" />

        <div className="relative space-y-6 max-w-lg">
          <span className="inline-block bg-gradient-to-r from-orange-500 to-amber-500 text-white text-[10px] font-black uppercase px-3 py-1.5 rounded-full tracking-widest shadow-md">
            {t("app.partner_portal")}
          </span>
          <h2 className="text-3xl md:text-4xl font-black text-white leading-tight tracking-tight">
            {t("app.hero_title")}
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
            {t("app.hero_cta")}
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
            {t("app.perk_management")}
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
            {t("app.perk_revenue")}
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
            {t("app.perk_logistics")}
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
