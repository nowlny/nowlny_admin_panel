/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { authService } from "../../services/auth";
import { Loader2, Phone, ArrowRight } from "lucide-react";
import toast from "react-hot-toast";

interface LoginScreenProps {
  onLoginSuccess: (token: string) => void;
}

const OTP_LENGTH = 4;
const RESEND_COOLDOWN_SECONDS = 30;

export default function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
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

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otpArr];
    newOtp[index] = value.substring(value.length - 1);
    setOtpArr(newOtp);
    setOtp(newOtp.join(""));

    if (value && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
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
    if (pastedData) {
      const newOtp = [...otpArr];
      for (let i = 0; i < pastedData.length; i++) {
        newOtp[i] = pastedData[i];
      }
      setOtpArr(newOtp);
      setOtp(newOtp.join(""));
      const nextIndex = Math.min(pastedData.length, OTP_LENGTH - 1);
      inputRefs.current[nextIndex]?.focus();
    }
  };

  const getFullPhone = () => {
    const cleanPhone = phoneNumber.replace(/\s+/g, "");
    if (cleanPhone.startsWith("+961")) return cleanPhone;
    if (cleanPhone.startsWith("961")) return "+" + cleanPhone;
    if (cleanPhone.startsWith("00961")) return "+" + cleanPhone.substring(2);
    return "+961" + cleanPhone;
  };

  const sendOtp = useCallback(async () => {
    await authService.sendOtp({
      phoneNumber: getFullPhone(),
      channel: "sms",
    });
    setResendIn(RESEND_COOLDOWN_SECONDS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phoneNumber]);

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const digits = phoneNumber.replace(/\D/g, "");
    if (digits.length < 7) {
      toast.error("Enter a valid phone number");
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
      toast.success("A new code is on its way");
    } catch (err: any) {
      toast.error(err.message || "Couldn't resend the code.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = useCallback(
    async (e?: React.FormEvent, codeOverride?: string) => {
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
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [otp, phoneNumber, onLoginSuccess],
  );

  // Submit as soon as the last digit lands — including after an SMS autofill —
  // rather than making the user reach for the button.
  useEffect(() => {
    if (step === "otp" && otp.length === OTP_LENGTH && !isLoading) {
      handleVerifyOtp(undefined, otp);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otp, step]);

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[30%] -right-[10%] w-[70%] h-[70%] rounded-full bg-orange-600/10 blur-[120px]" />
        <div className="absolute -bottom-[20%] -left-[10%] w-[60%] h-[60%] rounded-full bg-red-600/10 blur-[100px]" />
      </div>

      <div className="w-full max-w-md relative z-10 animate-in fade-in zoom-in-95 duration-500">
        <div className="text-center mb-8">
          <div className="h-16 w-16 mx-auto rounded-2xl bg-gradient-to-tr from-orange-500 to-red-600 flex items-center justify-center shadow-lg shadow-orange-500/20 mb-4">
            <span className="text-white font-black text-3xl">N</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            NOWLNY Admin
          </h1>
          <p className="text-zinc-500 text-sm mt-2 font-medium">
            Secure Operations Portal
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
                  Phone Number
                </label>
                <div className="relative flex items-center">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none gap-2">
                    <Phone className="h-5 w-5 text-zinc-500" />
                    <span className="text-zinc-400 font-medium">+961</span>
                    <div className="h-5 w-px bg-zinc-800 ml-1"></div>
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
                    className="w-full bg-black border border-zinc-800 text-white rounded-xl pl-[105px] pr-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
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
                    Send OTP <ArrowRight className="w-4 h-4" />
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
                  Verification Code
                </p>
                <div
                  className="flex justify-center gap-3"
                  role="group"
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
                  Code sent to{" "}
                  <span className="text-zinc-300 font-medium">
                    {getFullPhone()}
                  </span>
                </p>
                <div className="flex items-center justify-center gap-3 mt-2 text-[11px]">
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={resendIn > 0 || isLoading}
                    className="text-orange-500 hover:underline disabled:text-zinc-600 disabled:no-underline disabled:cursor-not-allowed font-semibold"
                  >
                    {resendIn > 0 ? `Resend in ${resendIn}s` : "Resend code"}
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
                    Change number
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
                  "Verify & Login"
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
