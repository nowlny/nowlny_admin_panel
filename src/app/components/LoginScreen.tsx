/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useState, useRef, useEffect } from "react";
import { authService } from "../../services/auth";
import { Loader2, Phone, ArrowRight } from "lucide-react";
import toast from "react-hot-toast";
import { useI18n } from "../../lib/i18n";
import LanguageToggle from "./ui/LanguageToggle";

interface LoginScreenProps {
  onLoginSuccess: (token: string) => void;
}

const OTP_LENGTH = 4;
const RESEND_COOLDOWN_SECONDS = 30;

export default function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const { t } = useI18n();
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [otp, setOtp] = useState("");
  const [otpArr, setOtpArr] = useState<string[]>(
    Array(OTP_LENGTH).fill(""),
  );
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const [isLoading, setIsLoading] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  // Countdown for the resend button. Without a resend path the only recovery
  // from an undelivered SMS was to back out via "Change number" and start over.
  useEffect(() => {
    if (resendIn <= 0) return;
    const id = setInterval(() => setResendIn((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [resendIn]);

  // Move focus to the first OTP box as soon as the code step opens.
  useEffect(() => {
    if (step === "otp") inputRefs.current[0]?.focus();
  }, [step]);

  const getFullPhone = () => {
    const cleanPhone = phoneNumber.replace(/\s+/g, "");
    if (cleanPhone.startsWith("+961")) return cleanPhone;
    if (cleanPhone.startsWith("961")) return "+" + cleanPhone;
    if (cleanPhone.startsWith("00961")) return "+" + cleanPhone.substring(2);
    return "+961" + cleanPhone;
  };

  const sendOtp = async () => {
    await authService.sendOtp({
      phoneNumber: getFullPhone(),
      channel: "sms",
    });
    setResendIn(RESEND_COOLDOWN_SECONDS);
  };

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const digits = phoneNumber.replace(/\D/g, "");
    if (digits.length < 7) {
      toast.error(t("login.invalid_phone"));
      return;
    }

    try {
      setIsLoading(true);
      await sendOtp();
      setStep("otp");
    } catch (err: any) {
      toast.error(err.message || "Failed to send OTP. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendIn > 0 || isLoading) return;
    try {
      setIsLoading(true);
      await sendOtp();
      setOtpArr(Array(OTP_LENGTH).fill(""));
      setOtp("");
      inputRefs.current[0]?.focus();
      toast.success(t("login.code_on_way"));
    } catch (err: any) {
      toast.error(err.message || "Couldn't resend the code.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (
    e?: React.FormEvent,
    codeOverride?: string,
  ) => {
    e?.preventDefault();
    const code = codeOverride ?? otp;
    if (code.length !== OTP_LENGTH) {
      toast.error(`Enter the ${OTP_LENGTH}-digit code`);
      return;
    }

    try {
      setIsLoading(true);
      const res = await authService.verifyOtp({
        phoneNumber: getFullPhone(),
        code,
      });

      const token = res.access_token || res.accessToken;
      const rToken = res.refresh_token || res.refreshToken;

      if (!token) {
        throw new Error(
          "Invalid response from server. No access token provided.",
        );
      }

      // Save token to localStorage for apiClient to use
      localStorage.setItem("token", token);
      if (rToken) {
        localStorage.setItem("refreshToken", rToken);
      }

      // Trigger parent callback to show main app
      onLoginSuccess(token);
    } catch (err: any) {
      toast.error(err.message || "Invalid OTP. Please try again.");
      // Clear the boxes so the operator can retype without 4 backspaces.
      setOtpArr(Array(OTP_LENGTH).fill(""));
      setOtp("");
      inputRefs.current[0]?.focus();
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Writes `digits` into the boxes from `startIndex` on, advances focus, and
   * submits the moment the last box is filled — so a complete code still logs
   * the operator in without them reaching for the button.
   *
   * The submit fires from the event that completed the code rather than from an
   * effect watching `otp`: filling the last box is something the operator did,
   * not state that needs synchronizing, and driving it from an effect meant an
   * extra render pass before the request went out.
   */
  const fillDigits = (startIndex: number, digits: string) => {
    const next = [...otpArr];
    for (let i = 0; i < digits.length && startIndex + i < OTP_LENGTH; i++) {
      next[startIndex + i] = digits[i];
    }
    const code = next.join("");
    setOtpArr(next);
    setOtp(code);

    inputRefs.current[
      Math.min(startIndex + digits.length, OTP_LENGTH - 1)
    ]?.focus();

    // Every box holds one character, so a full-length join means none are empty.
    if (code.length === OTP_LENGTH && !isLoading) {
      void handleVerifyOtp(undefined, code);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;

    if (!value) {
      const cleared = [...otpArr];
      cleared[index] = "";
      setOtpArr(cleared);
      setOtp(cleared.join(""));
      return;
    }

    // A platform SMS autofill drops the whole code into a single box, so take
    // however many digits arrived instead of only the last one.
    fillDigits(index, value);
  };

  const handleOtpKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (e.key === "Backspace" && !otpArr[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, OTP_LENGTH);
    if (pastedData) fillDigits(0, pastedData);
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[30%] -end-[10%] w-[70%] h-[70%] rounded-full bg-orange-600/10 blur-[120px]" />
        <div className="absolute -bottom-[20%] -start-[10%] w-[60%] h-[60%] rounded-full bg-red-600/10 blur-[100px]" />
      </div>

      <div className="w-full max-w-md relative z-10 animate-in fade-in zoom-in-95 duration-500">
        <div className="flex justify-center mb-6">
          <LanguageToggle />
        </div>
        <div className="text-center mb-8">
          <div className="h-16 w-16 mx-auto rounded-2xl bg-gradient-to-tr from-orange-500 to-red-600 flex items-center justify-center shadow-lg shadow-orange-500/20 mb-4">
            <span className="text-white font-black text-3xl">N</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            {t("login.title")}
          </h1>
          <p className="text-zinc-500 text-sm mt-2 font-medium">
            {t("login.subtitle")}
          </p>
        </div>

        <div className="bg-zinc-900/80 backdrop-blur-xl border border-zinc-800 rounded-3xl p-8 shadow-2xl">
          {step === "phone" ? (
            <form onSubmit={handleRequestOtp} className="space-y-6">
              <div>
                <label
                  htmlFor="login-phone"
                  className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2"
                >
                  {t("login.phone_label")}
                </label>
                <div className="relative flex items-center">
                  <div className="absolute inset-y-0 start-0 ps-4 flex items-center pointer-events-none gap-2">
                    <Phone className="h-5 w-5 text-zinc-500" />
                    <span className="text-zinc-400 font-medium" dir="ltr">
                      +961
                    </span>
                    <div className="h-5 w-px bg-zinc-800 ms-1"></div>
                  </div>
                  <input
                    id="login-phone"
                    name="phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel-national"
                    autoFocus
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="71 000 000"
                    dir="ltr"
                    className="w-full bg-black border border-zinc-800 text-white rounded-xl ps-[105px] pe-4 py-3.5 text-start focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-orange-500/25 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    {t("login.send_code")}{" "}
                    <ArrowRight className="w-4 h-4 rtl:rotate-180" />
                  </>
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-6">
              <div>
                <p
                  id="otp-label"
                  className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-4 text-center"
                >
                  {t("login.otp_title")}
                </p>
                {/* Codes read start-to-right in every locale. */}
                <div
                  className="flex justify-center gap-3"
                  role="group"
                  dir="ltr"
                  aria-labelledby="otp-label"
                >
                  {otpArr.map((digit, index) => (
                    <input
                      key={index}
                      ref={(el) => {
                        inputRefs.current[index] = el;
                      }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      // `one-time-code` on the first box is what lets iOS and
                      // Android offer the SMS code straight from the keyboard.
                      autoComplete={index === 0 ? "one-time-code" : "off"}
                      aria-label={`Digit ${index + 1} of ${OTP_LENGTH}`}
                      value={digit}
                      onChange={(e) => handleOtpChange(index, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(index, e)}
                      onFocus={(e) => e.target.select()}
                      onPaste={handlePaste}
                      className="w-14 h-14 bg-black border border-zinc-800 text-white text-center text-2xl font-bold rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
                    />
                  ))}
                </div>
                <p className="text-[11px] text-zinc-500 mt-4 text-center">
                  {t("login.otp_sent_to", { phone: "\u0000" })
                    .split("\u0000")
                    .map((part, idx) => (
                      <React.Fragment key={idx}>
                        {part}
                        {idx === 0 && (
                          <span className="text-zinc-300 font-medium" dir="ltr">
                            {getFullPhone()}
                          </span>
                        )}
                      </React.Fragment>
                    ))}
                </p>
                <div className="flex items-center justify-center gap-3 mt-2 text-[11px]">
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={resendIn > 0 || isLoading}
                    className="text-orange-500 hover:underline disabled:text-zinc-600 disabled:no-underline disabled:cursor-not-allowed font-semibold"
                  >
                    {resendIn > 0
                      ? t("login.resend_in", { seconds: resendIn })
                      : t("login.resend")}
                  </button>
                  <span className="text-zinc-700" aria-hidden="true">
                    ·
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setStep("phone");
                      setOtpArr(Array(OTP_LENGTH).fill(""));
                      setOtp("");
                    }}
                    className="text-zinc-400 hover:text-white hover:underline font-semibold"
                  >
                    {t("login.change_number")}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading || otp.length !== OTP_LENGTH}
                className="w-full bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-orange-500/25 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  t("login.verify")
                )}
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-xs text-zinc-600 font-semibold mt-8">
          &copy; {new Date().getFullYear()} NOWLNY Delivery. All rights
          reserved.
        </p>
      </div>
    </div>
  );
}
