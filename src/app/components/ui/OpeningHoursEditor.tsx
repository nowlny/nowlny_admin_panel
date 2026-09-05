"use client";

import React from "react";
import {
  OpeningHourEntry,
  WEEK_DAYS,
  WeekDay,
} from "../../../services/restaurants";
import { useI18n, type MessageKey } from "../../../lib/i18n";

/* ---------------------------------------------------------------------------
   Weekly opening-hours editor shared by the admin "add" and "edit" restaurant
   forms.

   The API has no "closed" flag — a day that is absent from `openingHours` is
   closed. The form therefore keeps all seven days with an `enabled` switch and
   only the enabled ones are sent (see `toOpeningHours`).
--------------------------------------------------------------------------- */

export interface DaySchedule {
  /** Unticked = closed that day (omitted from the payload). */
  enabled: boolean;
  is24Hours: boolean;
  /** 24h "HH:mm". Ignored by the API when `is24Hours` is set. */
  openTime: string;
  closeTime: string;
}

export type WeekSchedule = Record<WeekDay, DaySchedule>;

export interface WeekScheduleError {
  day: WeekDay;
  message: string;
}

export const DAY_LABEL_KEYS: Record<WeekDay, MessageKey> = {
  monday: "day.monday",
  tuesday: "day.tuesday",
  wednesday: "day.wednesday",
  thursday: "day.thursday",
  friday: "day.friday",
  saturday: "day.saturday",
  sunday: "day.sunday",
};

const DEFAULT_DAY: DaySchedule = {
  enabled: true,
  is24Hours: false,
  openTime: "08:00",
  closeTime: "23:00",
};

/** `"8:00"` / `"08:00:00"` → `"08:00"`; anything unparseable → `""`. */
export function normalizeTime(value: string | null | undefined): string {
  if (!value) return "";
  const match = /^(\d{1,2}):(\d{2})/.exec(value.trim());
  if (!match) return "";
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return "";
  return `${String(hours).padStart(2, "0")}:${match[2]}`;
}

/** Every day open 08:00–23:00 — what a brand-new merchant starts from. */
export function defaultWeekSchedule(): WeekSchedule {
  return WEEK_DAYS.reduce((week, day) => {
    week[day] = { ...DEFAULT_DAY };
    return week;
  }, {} as WeekSchedule);
}

/**
 * API entries → editor state. Days missing from the list come back disabled
 * (closed). `null`/empty means the merchant never set hours, which is shown as
 * the defaults so the operator has something sensible to start from.
 */
export function toWeekSchedule(
  entries: OpeningHourEntry[] | null | undefined,
): WeekSchedule {
  if (!entries || entries.length === 0) return defaultWeekSchedule();
  const week = WEEK_DAYS.reduce((acc, day) => {
    acc[day] = { ...DEFAULT_DAY, enabled: false };
    return acc;
  }, {} as WeekSchedule);
  for (const entry of entries) {
    const day = String(entry.day).toLowerCase() as WeekDay;
    if (!(day in week)) continue;
    week[day] = {
      enabled: true,
      is24Hours: Boolean(entry.is24Hours),
      openTime: normalizeTime(entry.openTime) || DEFAULT_DAY.openTime,
      closeTime: normalizeTime(entry.closeTime) || DEFAULT_DAY.closeTime,
    };
  }
  return week;
}

/** Editor state → API entries. Closed days are simply left out. */
export function toOpeningHours(week: WeekSchedule): OpeningHourEntry[] {
  return WEEK_DAYS.filter((day) => week[day].enabled).map((day) =>
    week[day].is24Hours
      ? { day, is24Hours: true }
      : {
          day,
          is24Hours: false,
          openTime: week[day].openTime,
          closeTime: week[day].closeTime,
        },
  );
}

/** First invalid row, or `null` when the whole week is consistent. */
export function validateWeekSchedule(
  week: WeekSchedule,
  t: (key: MessageKey, vars?: Record<string, string | number>) => string,
): WeekScheduleError | null {
  for (const day of WEEK_DAYS) {
    const entry = week[day];
    if (!entry.enabled || entry.is24Hours) continue;
    const label = t(DAY_LABEL_KEYS[day]);
    if (!entry.openTime || !entry.closeTime) {
      return { day, message: t("rest.hours_both", { day: label }) };
    }
    if (entry.openTime === entry.closeTime) {
      return { day, message: t("rest.hours_same", { day: label }) };
    }
  }
  return null;
}

export const hoursFieldId = (idPrefix: string, day: WeekDay) =>
  `${idPrefix}-open-${day}`;

const TIME_CLASS =
  "w-[6.5rem] py-1.5 px-2 bg-white dark:bg-zinc-900 border rounded-lg text-center font-semibold text-xs text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-orange-500/30 disabled:opacity-50";

interface OpeningHoursEditorProps {
  value: WeekSchedule;
  onChange: (next: WeekSchedule) => void;
  /** Used to build stable input ids so validation can move focus to a row. */
  idPrefix: string;
  error?: WeekScheduleError | null;
  disabled?: boolean;
}

export default function OpeningHoursEditor({
  value,
  onChange,
  idPrefix,
  error,
  disabled = false,
}: OpeningHoursEditorProps) {
  const { t } = useI18n();

  const setDay = (day: WeekDay, patch: Partial<DaySchedule>) =>
    onChange({ ...value, [day]: { ...value[day], ...patch } });

  const allClosed = WEEK_DAYS.every((day) => !value[day].enabled);

  return (
    <div className="space-y-3">
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        {t("rest.hours_hint")}
      </p>

      <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl divide-y divide-zinc-100 dark:divide-zinc-800 bg-zinc-50 dark:bg-zinc-950">
        {WEEK_DAYS.map((day) => {
          const entry = value[day];
          const rowError = error?.day === day ? error.message : undefined;
          const dayName = t(DAY_LABEL_KEYS[day]);
          // Closing before opening is a legitimate overnight shift
          // (e.g. 18:00 → 02:00), so it is flagged, not rejected.
          const overnight =
            entry.enabled &&
            !entry.is24Hours &&
            !!entry.openTime &&
            !!entry.closeTime &&
            entry.closeTime < entry.openTime;

          return (
            <div key={day} className="px-3 py-2 text-xs">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <label className="flex items-center gap-2 w-32 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={entry.enabled}
                    disabled={disabled}
                    onChange={(e) => setDay(day, { enabled: e.target.checked })}
                    className="accent-orange-500 w-4 h-4"
                    aria-label={`${dayName}: ${t("rest.hours_open_day")}`}
                  />
                  <span
                    className={`font-extrabold ${
                      entry.enabled
                        ? "text-zinc-800 dark:text-zinc-200"
                        : "text-zinc-400 dark:text-zinc-600 line-through"
                    }`}
                  >
                    {dayName}
                  </span>
                </label>

                {!entry.enabled ? (
                  <span className="text-zinc-400 dark:text-zinc-500 font-semibold">
                    {t("rest.hours_closed")}
                  </span>
                ) : (
                  <>
                    <label className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-400 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={entry.is24Hours}
                        disabled={disabled}
                        onChange={(e) =>
                          setDay(day, { is24Hours: e.target.checked })
                        }
                        className="accent-orange-500 w-4 h-4"
                      />
                      <span>{t("rest.hours_24h")}</span>
                    </label>

                    {!entry.is24Hours && (
                      <div className="flex items-center gap-2 ms-auto">
                        <span className="text-zinc-500 dark:text-zinc-400">
                          {t("rest.hours_from")}
                        </span>
                        <input
                          id={hoursFieldId(idPrefix, day)}
                          type="time"
                          disabled={disabled}
                          aria-label={`${dayName} ${t("rest.hours_from")}`}
                          aria-invalid={!!rowError}
                          value={entry.openTime}
                          onChange={(e) =>
                            setDay(day, { openTime: e.target.value })
                          }
                          className={`${TIME_CLASS} ${
                            rowError
                              ? "border-red-500"
                              : "border-zinc-200 dark:border-zinc-800"
                          }`}
                        />
                        <span className="text-zinc-500 dark:text-zinc-400">
                          {t("rest.hours_to")}
                        </span>
                        <input
                          type="time"
                          disabled={disabled}
                          aria-label={`${dayName} ${t("rest.hours_to")}`}
                          aria-invalid={!!rowError}
                          value={entry.closeTime}
                          onChange={(e) =>
                            setDay(day, { closeTime: e.target.value })
                          }
                          className={`${TIME_CLASS} ${
                            rowError
                              ? "border-red-500"
                              : "border-zinc-200 dark:border-zinc-800"
                          }`}
                        />
                      </div>
                    )}
                  </>
                )}
              </div>

              {rowError ? (
                <p
                  role="alert"
                  className="mt-1 text-[11px] font-semibold text-red-600 dark:text-red-400"
                >
                  {rowError}
                </p>
              ) : overnight ? (
                <p className="mt-1 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                  {t("app.closes_after_midnight")}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>

      {allClosed && (
        <p className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">
          {t("rest.hours_all_closed")}
        </p>
      )}
    </div>
  );
}
