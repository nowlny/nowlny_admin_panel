"use client";

import React, { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { customersService, CustomerUpdateData } from "../../services/customers";
import Modal from "./ui/Modal";

interface EditCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  customerId: string | null;
  customerData: any; // Using currently mapped customer data
}

export default function EditCustomerModal({
  isOpen,
  onClose,
  onSuccess,
  customerId,
  customerData,
}: EditCustomerModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    fullName: "",
    nickname: "",
    phoneNumber: "",
    status: "active",
  });

  useEffect(() => {
    if (isOpen && customerData) {
      setFormData({
        fullName: customerData.name || "",
        nickname: customerData.nickname || "",
        phoneNumber:
          customerData.phone === "No phone" ? "" : customerData.phone || "",
        status:
          customerData.status?.toLowerCase() === "suspended"
            ? "suspended"
            : "active",
      });
    }
  }, [isOpen, customerData]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerId) return;
    setIsSubmitting(true);

    const payload: CustomerUpdateData = {
      fullName: formData.fullName,
      phoneNumber: formData.phoneNumber,
      nickname: formData.nickname || undefined,
      status: formData.status,
    };

    try {
      await customersService.updateCustomer(customerId, payload);
      toast.success("Customer updated successfully!");
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error("Failed to update customer", err);
      toast.error(
        err.message || "An error occurred while updating the customer.",
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
      isOpen={isOpen && !!customerId}
      onClose={onClose}
      title="Edit Customer"
      description={customerData?.name}
      // Backdrop click / Escape must not silently discard edits.
      dismissable={false}
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
            form="edit-customer-form"
            disabled={isSubmitting}
            className="px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg shadow-sm shadow-orange-500/20 transition-all flex items-center gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Updating...
              </>
            ) : (
              "Save Changes"
            )}
          </button>
        </>
      }
    >
      <form
        id="edit-customer-form"
        onSubmit={handleSubmit}
        className="space-y-4"
      >
        <div className="space-y-1.5">
          <label htmlFor="edit-customer-fullName" className={labelClass}>
            Full Name
          </label>
          <input
            id="edit-customer-fullName"
            required
            name="fullName"
            value={formData.fullName}
            onChange={handleChange}
            className={inputClass}
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="edit-customer-phoneNumber" className={labelClass}>
            Phone Number
          </label>
          <input
            id="edit-customer-phoneNumber"
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
          <label htmlFor="edit-customer-nickname" className={labelClass}>
            Nickname (Optional)
          </label>
          <input
            id="edit-customer-nickname"
            name="nickname"
            value={formData.nickname}
            onChange={handleChange}
            className={inputClass}
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="edit-customer-status" className={labelClass}>
            Status
          </label>
          {/* Only the two states the customer list can actually render — an
              `inactive` customer showed up as a red "Suspended" pill. */}
          <select
            id="edit-customer-status"
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
