"use client";

import React from "react";
import { Phone } from "lucide-react";
import { LEBANON_DIAL_CODE, nationalDigits } from "../../../lib/phone";

/**
 * A phone field with the country code fixed in place.
 *
 * The platform runs on +961 numbers, but the plain text inputs left it to the
 * operator to remember the prefix — and a merchant saved as `76049018` is a
 * merchant whose owner account never links. The code is shown, not typed, and
 * `value` is the national part; the caller converts with `toInternationalPhone`
 * on submit.
 */
export interface PhoneNumberInputProps {
  id: string;
  /** National digits only, no country code. */
  value: string;
  onChange: (nationalDigits: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}

export default function PhoneNumberInput({
  id,
  value,
  onChange,
  placeholder = "71 000 000",
  required = false,
  disabled = false,
  className = "",
}: PhoneNumberInputProps) {
  return (
    <div className="relative flex items-center" dir="ltr">
      <span className="absolute inset-y-0 start-0 ps-3 flex items-center gap-2 pointer-events-none">
        <Phone className="h-4 w-4 text-zinc-400 dark:text-zinc-500" />
        <span className="text-sm text-zinc-500 dark:text-zinc-400 font-medium">
          {LEBANON_DIAL_CODE}
        </span>
        <span className="h-4 w-px bg-zinc-200 dark:bg-zinc-700" />
      </span>
      <input
        id={id}
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        required={required}
        disabled={disabled}
        placeholder={placeholder}
        // A pasted `+961 76 049 018` loses its prefix rather than doubling it.
        value={value}
        onChange={(e) => onChange(nationalDigits(e.target.value))}
        className={`w-full ps-[88px] pe-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm text-start focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-colors disabled:opacity-50 ${className}`}
      />
    </div>
  );
}
