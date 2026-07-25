"use client";

import React, { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { customersService, CustomerCreateData } from "../../services/customers";
import Modal from "./ui/Modal";

interface AddCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const EMPTY_FORM = {
  fullName: "",
  nickname: "",
  phoneNumber: "",
  status: "active",
};

export default function AddCustomerModal({
  isOpen,
  onClose,
  onSuccess,
}: AddCustomerModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);

  // `<Modal>` keeps this component mounted between openings, so without an
  // explicit reset the previous customer's name and phone were still in the
  // fields the next time it opened — one click from creating a duplicate.
  useEffect(() => {
    if (isOpen) setFormData(EMPTY_FORM);
  }, [isOpen]);

  const isDirty =
    formData.fullName !== "" ||
    formData.nickname !== "" ||
    formData.phoneNumber !== "" ||
    formData.status !== "active";

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const payload: CustomerCreateData = {
      fullName: formData.fullName,
      phoneNumber: formData.phoneNumber,
      nickname: formData.nickname || undefined,
      status: formData.status,
    };

    try {
      await customersService.createCustomer(payload);
      toast.success("Customer created successfully!");
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error("Failed to create customer", err);
      toast.error(
        err.message || "An error occurred while creating the customer.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputClass =
    "w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-colors";
  const labelClass =
    "text-xs font-semibold text-zinc-600 dark:text-zinc-300 block";

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add New Customer"
      description="Creates a customer account that can place orders."
      // A stray backdrop click or Escape must not discard typing.
      dismissable={!isDirty && !isSubmitting}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="add-customer-form"
            disabled={isSubmitting}
            className="px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg shadow-sm shadow-orange-500/20 transition-all flex items-center gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Creating...
              </>
            ) : (
              "Create Customer"
            )}
          </button>
        </>
      }
    >
      <form id="add-customer-form" onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="add-customer-fullName" className={labelClass}>
            Full Name
          </label>
          <input
            id="add-customer-fullName"
            required
            name="fullName"
            value={formData.fullName}
            onChange={handleChange}
            placeholder="e.g. Johnny Doe"
            className={inputClass}
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="add-customer-phoneNumber" className={labelClass}>
            Phone Number
          </label>
          <input
            id="add-customer-phoneNumber"
            required
            type="tel"
            name="phoneNumber"
            value={formData.phoneNumber}
            onChange={handleChange}
            placeholder="+966501234567"
            className={inputClass}
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="add-customer-nickname" className={labelClass}>
            Nickname (Optional)
          </label>
          <input
            id="add-customer-nickname"
            name="nickname"
            value={formData.nickname}
            onChange={handleChange}
            placeholder="e.g. Johnny"
            className={inputClass}
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="add-customer-status" className={labelClass}>
            Status
          </label>
          {/* Only the two states the customer list can actually render — an
              `inactive` customer showed up as a red "Suspended" pill. */}
          <select
            id="add-customer-status"
            name="status"
            value={formData.status}
            onChange={handleChange}
            className={`${inputClass} pr-8`}
          >
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>
      </form>
    </Modal>
  );
}
