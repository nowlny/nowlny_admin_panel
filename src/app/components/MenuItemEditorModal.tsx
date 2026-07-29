"use client";

import React, { useState, useEffect, useId } from "react";
import { X, Loader2, Store, Plus, Trash2, Edit2, Check } from "lucide-react";
import toast from "react-hot-toast";
import { menuService, MenuItem as ApiMenuItem, MenuSection, MenuOptionGroup, MenuOption } from "../../services/menu";
import { formatMoney } from "../../lib/format";
import Modal from "./ui/Modal";
import { useConfirm } from "./ui/ConfirmDialog";
import { ErrorState } from "./ui/States";

import { useI18n } from "../../lib/i18n";
interface MenuItemEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: ApiMenuItem | null;
  sections: MenuSection[];
  onSuccess: () => void;
}

export default function MenuItemEditorModal({
  isOpen,
  onClose,
  item,
  sections,
  onSuccess,
}: MenuItemEditorModalProps) {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<"basic" | "options">("basic");

  // Basic Info State
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [discountedPrice, setDiscountedPrice] = useState("");
  const [image, setImage] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [isAvailable, setIsAvailable] = useState(true);
  const [isActive, setIsActive] = useState(true);
  const [isPopular, setIsPopular] = useState(false);

  // Submitting State
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Guards Escape / backdrop-click from discarding typing.
  const [isDirty, setIsDirty] = useState(false);

  // Option Groups State (Only available if editing an existing item)
  const [optionGroups, setOptionGroups] = useState<MenuOptionGroup[]>([]);
  const [optionsByGroup, setOptionsByGroup] = useState<Record<string, MenuOption[]>>({});
  const [isLoadingOptions, setIsLoadingOptions] = useState(false);
  // A failed fetch used to set `[]`, so an API error rendered as "this item has
  // no add-ons" — indistinguishable from a dish that genuinely has none.
  const [optionsError, setOptionsError] = useState<string | null>(null);

  // Option Group Editor State
  const [editingGroup, setEditingGroup] = useState<MenuOptionGroup | null>(null);
  const [groupName, setGroupName] = useState("");
  const [groupType, setGroupType] = useState<"radio" | "checkbox">("checkbox");
  const [groupIsRequired, setGroupIsRequired] = useState(false);
  const [pendingGroupId, setPendingGroupId] = useState<string | null>(null);

  // Option Editor State
  const [addingOptionToGroup, setAddingOptionToGroup] = useState<string | null>(null);
  const [optionName, setOptionName] = useState("");
  const [optionPrice, setOptionPrice] = useState("");
  const [pendingOptionId, setPendingOptionId] = useState<string | null>(null);
  const [isSavingOption, setIsSavingOption] = useState(false);

  const confirm = useConfirm();
  const fieldId = useId();

  useEffect(() => {
    if (item) {
      setName(item.name);
      setDescription(item.description || "");
      setPrice(item.price.toString());
      setDiscountedPrice(item.discountedPrice?.toString() || "");
      setImage(item.image || "");
      setSectionId(item.sectionId);
      setIsAvailable(item.isAvailable);
      setIsActive(item.isActive);
      setIsPopular(item.isPopular);
      setActiveTab("basic");
      loadOptionGroups(item.id);
    } else {
      setName("");
      setDescription("");
      setPrice("");
      setDiscountedPrice("");
      setImage("");
      setSectionId(sections.length > 0 ? sections[0].id : "");
      setIsAvailable(true);
      setIsActive(true);
      setIsPopular(false);
      setActiveTab("basic");
      setOptionGroups([]);
      setOptionsByGroup({});
      setOptionsError(null);
    }
    setIsDirty(false);
    resetGroupEditor();
    resetOptionEditor();
  }, [item, isOpen, sections]);

  const loadOptionGroups = async (menuItemId: string) => {
    setIsLoadingOptions(true);
    setOptionsError(null);
    try {
      const response = await menuService.getOptionGroupsByItem(menuItemId);
      const baseGroups = Array.isArray(response) ? response : (response as any)?.data || [];

      const groupsWithOptions = await Promise.all(
        baseGroups.map(async (group: any) => {
          try {
            const details = await menuService.getOptionGroupById(group.id);
            return details;
          } catch (e) {
            console.error(`Failed to load details for group ${group.id}:`, e);
            return group;
          }
        })
      );

      setOptionGroups(groupsWithOptions);
    } catch (err: any) {
      setOptionGroups([]);
      setOptionsError(err?.message || t("mi.addons_load_failed"));
    } finally {
      setIsLoadingOptions(false);
    }
  };

  const resetGroupEditor = () => {
    setEditingGroup(null);
    setGroupName("");
    setGroupType("checkbox");
    setGroupIsRequired(false);
  };

  const resetOptionEditor = () => {
    setAddingOptionToGroup(null);
    setOptionName("");
    setOptionPrice("");
  };

  if (!isOpen) return null;

  const handleSaveBasic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !price || !sectionId) {
      toast.error(t("mi.required_fields"));
      return;
    }

    setIsSubmitting(true);

    try {
      if (item) {
        await menuService.updateItem(item.id, {
          name,
          description,
          price: parseFloat(price),
          discountedPrice: discountedPrice ? parseFloat(discountedPrice) : undefined,
          image,
          sectionId,
          isAvailable,
          isActive,
          isPopular,
        });
      } else {
        await menuService.createItem({
          name,
          description,
          price: parseFloat(price),
          discountedPrice: discountedPrice ? parseFloat(discountedPrice) : undefined,
          image: image || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=300&auto=format&fit=crop&q=80",
          sectionId,
          isAvailable,
          isActive,
          isPopular,
        });
      }
      toast.success(t("mi.saved"));
      setIsDirty(false);
      onSuccess();
    } catch (err: any) {
      toast.error(err.message || t("mi.save_failed"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveGroup = async () => {
    if (!item) return;
    if (!groupName.trim()) return;

    setIsSubmitting(true);
    try {
      if (editingGroup) {
        await menuService.updateOptionGroup(editingGroup.id, {
          name: groupName,
          type: groupType,
          isRequired: groupIsRequired,
          sortOrder: 0,
        });
      } else {
        await menuService.createOptionGroup({
          menuItemId: item.id,
          name: groupName,
          type: groupType,
          isRequired: groupIsRequired,
          sortOrder: 0,
          options: [],
        });
      }
      await loadOptionGroups(item.id);
      toast.success(t("mi.group_saved"));
      resetGroupEditor();
    } catch (err: any) {
      toast.error(err.message || t("mi.group_save_failed"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteGroup = async (group: MenuOptionGroup) => {
    const choices = ((group as any).options || []).length;
    const confirmed = await confirm({
      title: `Delete the “${group.name}” option group?`,
      description:
        choices > 0
          ? `Its ${choices} choice${choices > 1 ? "s" : ""} will be removed from this dish as well.`
          : t("mi.group_delete_body"),
      confirmLabel: t("mi.group_delete_cta"),
      variant: "danger",
    });
    if (!confirmed) return;

    setPendingGroupId(group.id);
    try {
      await menuService.deleteOptionGroup(group.id);
      await loadOptionGroups(item!.id);
      toast.success(`“${group.name}” deleted.`);
    } catch (err: any) {
      // A failed delete used to only hit console.error and looked like success.
      toast.error(err?.message || t("mi.group_delete_failed"));
    } finally {
      setPendingGroupId(null);
    }
  };

  const handleSaveOption = async (groupId: string) => {
    if (!optionName.trim() || !optionPrice) {
      toast.error(t("mi.option_required"));
      return;
    }
    setIsSavingOption(true);
    try {
      await menuService.createOption(groupId, {
        name: optionName,
        price: parseFloat(optionPrice),
        sortOrder: 0,
      });
      await loadOptionGroups(item!.id);
      toast.success(t("mi.option_added"));
      resetOptionEditor();
    } catch (err: any) {
      toast.error(err.message || t("mi.option_add_failed"));
    } finally {
      setIsSavingOption(false);
    }
  };

  const handleDeleteOption = async (option: { id: string; name: string }) => {
    // This used to delete on a single unconfirmed click, from an icon that was
    // visually identical to the "cancel add" X next to it.
    const confirmed = await confirm({
      title: `Delete the “${option.name}” choice?`,
      description: t("mi.choice_delete_body"),
      confirmLabel: t("mi.choice_delete_cta"),
      variant: "danger",
    });
    if (!confirmed) return;

    setPendingOptionId(option.id);
    try {
      await menuService.deleteOption(option.id);
      await loadOptionGroups(item!.id);
      toast.success(t("mi.choice_deleted"));
    } catch (err: any) {
      toast.error(err.message || t("mi.choice_delete_failed"));
    } finally {
      setPendingOptionId(null);
    }
  };

  const inputClass =
    "w-full bg-zinc-50 border border-zinc-200 text-zinc-850 placeholder-zinc-400 rounded-xl p-2.5 focus:outline-none focus:ring-1 focus:ring-orange-500 dark:bg-zinc-950/20 dark:border-zinc-800 dark:text-zinc-200";
  const labelClass =
    "text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide block";

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      dismissable={!isDirty && !isSubmitting}
      maxWidth="max-w-2xl"
      title={item ? t("mi.edit_title") : t("mi.add_title")}
      description={item ? item.name : t("mi.add_desc")}
      icon={
        <span className="p-2 bg-orange-500/10 text-orange-500 rounded-xl shrink-0">
          <Store className="w-4 h-4" />
        </span>
      }
      footer={
        activeTab === "basic" ? (
          <>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-zinc-200 dark:border-zinc-850 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-400 font-bold rounded-xl transition-all text-xs"
            >
              {t("common.cancel")}
            </button>
            <button
              form="basic-form"
              type="submit"
              disabled={isSubmitting}
              className="bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-bold px-4 py-2 rounded-xl shadow-lg shadow-orange-500/10 transition-all flex items-center gap-2 text-xs"
            >
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {t("mi.save")}
            </button>
          </>
        ) : undefined
      }
    >
      {/* Tabs */}
      {item && (
        <div className="flex border-b border-zinc-200 dark:border-zinc-800 -mt-1 mb-5">
          <button
            type="button"
            onClick={() => setActiveTab("basic")}
            aria-current={activeTab === "basic"}
            className={`flex-1 py-3 text-xs font-bold transition-all ${
              activeTab === "basic" ? "text-orange-500 border-b-2 border-orange-500" : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
            }`}
          >
            {t("mi.basic")}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("options")}
            aria-current={activeTab === "options"}
            className={`flex-1 py-3 text-xs font-bold transition-all ${
              activeTab === "options" ? "text-orange-500 border-b-2 border-orange-500" : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
            }`}
          >
            {t("mi.groups")}
          </button>
        </div>
      )}

      {activeTab === "basic" && (
        <form
          id="basic-form"
          onSubmit={handleSaveBasic}
          onChange={() => setIsDirty(true)}
          className="space-y-4 text-xs font-semibold text-zinc-700 dark:text-zinc-300"
        >
          <div className="space-y-1.5">
            <label htmlFor={`${fieldId}-name`} className={labelClass}>{t("mi.dish_title")}</label>
            <input id={`${fieldId}-name`} type="text" required placeholder={t("mi.name_placeholder")} value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor={`${fieldId}-price`} className={labelClass}>{t("mi.price")}</label>
              <input id={`${fieldId}-price`} type="number" step="0.01" min="0" inputMode="decimal" required placeholder="9.99" value={price} onChange={(e) => setPrice(e.target.value)} className={inputClass} />
            </div>
            <div className="space-y-1.5">
              <label htmlFor={`${fieldId}-discounted-price`} className={labelClass}>{t("mi.discounted")}</label>
              <input id={`${fieldId}-discounted-price`} type="number" step="0.01" min="0" inputMode="decimal" placeholder={t("mi.optional")} value={discountedPrice} onChange={(e) => setDiscountedPrice(e.target.value)} className={inputClass} />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor={`${fieldId}-image`} className={labelClass}>{t("mi.image_url")}</label>
            <input id={`${fieldId}-image`} type="text" placeholder="https://..." value={image} onChange={(e) => setImage(e.target.value)} className={inputClass} />
          </div>

          <div className="space-y-1.5">
            <label htmlFor={`${fieldId}-section`} className={labelClass}>{t("mi.category_section")}</label>
            <select id={`${fieldId}-section`} required value={sectionId} onChange={(e) => setSectionId(e.target.value)} className={`${inputClass} cursor-pointer`}>
              {sections.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label htmlFor={`${fieldId}-description`} className={labelClass}>{t("mi.description")}</label>
            <textarea id={`${fieldId}-description`} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} className={`${inputClass} resize-none font-sans`} />
          </div>

          <div className="flex flex-col gap-2 pt-2">
            <div className="flex items-center gap-2">
              <input id={`${fieldId}-available`} type="checkbox" checked={isAvailable} onChange={(e) => setIsAvailable(e.target.checked)} className="rounded border-zinc-300 text-orange-500 focus:ring-orange-500" />
              <label htmlFor={`${fieldId}-available`} className="text-xs font-bold text-zinc-700 dark:text-zinc-300">{t("mi.item_available")}</label>
            </div>
            <div className="flex items-center gap-2">
              <input id={`${fieldId}-active`} type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="rounded border-zinc-300 text-orange-500 focus:ring-orange-500" />
              <label htmlFor={`${fieldId}-active`} className="text-xs font-bold text-zinc-700 dark:text-zinc-300">{t("mi.item_active")}</label>
            </div>
            <div className="flex items-center gap-2">
              <input id={`${fieldId}-popular`} type="checkbox" checked={isPopular} onChange={(e) => setIsPopular(e.target.checked)} className="rounded border-zinc-300 text-orange-500 focus:ring-orange-500" />
              <label htmlFor={`${fieldId}-popular`} className="text-xs font-bold text-zinc-700 dark:text-zinc-300">{t("mi.mark_popular")}</label>
            </div>
          </div>
        </form>
      )}

      {activeTab === "options" && item && (
        <div className="space-y-6">
          {isLoadingOptions ? (
            <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin text-orange-500" /></div>
          ) : optionsError ? (
            <ErrorState
              message={optionsError}
              onRetry={() => loadOptionGroups(item.id)}
              title={t("mi.addons_failed")}
            />
          ) : (
            <>
              {optionGroups.map(group => (
                <div key={group.id} className="border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
                  <div className="bg-zinc-50 dark:bg-zinc-800/50 p-4 flex justify-between items-center gap-3 border-b border-zinc-200 dark:border-zinc-800">
                    <div className="min-w-0">
                      <h4 className="text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-2 flex-wrap">
                        {group.name}
                        {group.isRequired && <span className="bg-red-500/10 text-red-500 text-[9px] px-1.5 py-0.5 rounded font-black uppercase tracking-wider">{t("mi.required_badge")}</span>}
                        <span className="bg-blue-500/10 text-blue-500 text-[9px] px-1.5 py-0.5 rounded font-black uppercase tracking-wider">{group.type === 'radio' ? 'Single Choice' : 'Multiple Choice'}</span>
                      </h4>
                      <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                        {group.type === "radio"
                          ? t("mi.must_choose_one")
                          : t("mi.can_choose_many")}
                      </p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button
                        type="button"
                        aria-label={`Edit the ${group.name} option group`}
                        onClick={() => {
                          setEditingGroup(group);
                          setGroupName(group.name);
                          setGroupType(group.type);
                          setGroupIsRequired(group.isRequired);
                        }}
                        className="p-2.5 text-zinc-500 dark:text-zinc-400 hover:text-orange-500 bg-white dark:bg-zinc-900 rounded-lg shadow-sm"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Delete the ${group.name} option group`}
                        disabled={pendingGroupId === group.id}
                        onClick={() => handleDeleteGroup(group)}
                        className="p-2.5 text-zinc-500 dark:text-zinc-400 hover:text-red-500 bg-white dark:bg-zinc-900 rounded-lg shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {pendingGroupId === group.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div className="p-4 space-y-3 bg-white dark:bg-zinc-900">
                    {/* Render options if they exist in the response type (mocking it by casting since types don't show it explicitly) */}
                    {((group as any).options || []).map((opt: any) => (
                      <div key={opt.id} className="flex justify-between items-center text-xs p-2 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-lg">
                        <span className="font-semibold text-zinc-700 dark:text-zinc-300">{opt.name}</span>
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-zinc-900 dark:text-white">+${formatMoney(opt.price ?? 0)}</span>
                          <button
                            type="button"
                            aria-label={`Delete the ${opt.name} choice`}
                            disabled={pendingOptionId === opt.id}
                            onClick={() => handleDeleteOption(opt)}
                            className="p-2.5 -m-1.5 text-zinc-500 dark:text-zinc-400 hover:text-red-500 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {pendingOptionId === opt.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>
                    ))}

                    {addingOptionToGroup === group.id ? (
                      <div className="flex gap-2 items-center mt-2 p-2 bg-zinc-50 dark:bg-zinc-800/30 rounded-lg border border-zinc-200 dark:border-zinc-700">
                        <input type="text" aria-label={t("mi.option_name_aria")} placeholder={t("mi.option_name")} value={optionName} onChange={e => setOptionName(e.target.value)} className="flex-1 text-xs px-2 py-1.5 rounded bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700" />
                        <input type="number" step="0.01" min="0" inputMode="decimal" aria-label={t("mi.option_price_aria")} placeholder={t("mi.option_price")} value={optionPrice} onChange={e => setOptionPrice(e.target.value)} className="w-20 text-xs px-2 py-1.5 rounded bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700" />
                        <button type="button" aria-label={t("mi.save_choice")} disabled={isSavingOption} onClick={() => handleSaveOption(group.id)} className="p-2 bg-orange-500 text-white rounded hover:bg-orange-600 disabled:opacity-50">
                          {isSavingOption ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                        </button>
                        <button type="button" aria-label={t("mi.cancel_choice")} onClick={resetOptionEditor} className="p-2 text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-white"><X className="w-3.5 h-3.5" /></button>
                      </div>
                    ) : (
                      <button type="button" onClick={() => setAddingOptionToGroup(group.id)} className="text-[10px] font-bold text-orange-500 flex items-center gap-1 hover:underline mt-2 ms-2">
                        <Plus className="w-3 h-3" /> {t("mi.add_choice")}
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {/* Group Editor / Adder */}
              <div className="p-4 border border-dashed border-zinc-300 dark:border-zinc-700 rounded-2xl bg-zinc-50 dark:bg-zinc-900/30">
                <h4 className="text-xs font-bold text-zinc-800 dark:text-zinc-200 mb-3">{editingGroup ? "Edit Option Group" : "Create New Option Group"}</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                  <div className="space-y-1.5">
                    <label htmlFor={`${fieldId}-group-name`} className={labelClass}>{t("mi.group_name")}</label>
                    <input id={`${fieldId}-group-name`} type="text" placeholder={t("mi.group_placeholder")} value={groupName} onChange={e => setGroupName(e.target.value)} className="text-xs px-3 py-2 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 w-full" />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor={`${fieldId}-group-type`} className={labelClass}>{t("mi.selection_type")}</label>
                    <div className="flex items-center gap-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2">
                      <select id={`${fieldId}-group-type`} value={groupType} onChange={e => setGroupType(e.target.value as any)} className="bg-transparent focus:outline-none text-xs text-zinc-800 dark:text-zinc-200 flex-1 border-e border-zinc-200 dark:border-zinc-700 pe-2">
                        <option value="radio">{t("mi.single_choice")}</option>
                        <option value="checkbox">{t("mi.multi_choice")}</option>
                      </select>
                      <div className="flex items-center gap-2 shrink-0">
                        <input id={`${fieldId}-group-required`} type="checkbox" checked={groupIsRequired} onChange={e => setGroupIsRequired(e.target.checked)} className="rounded text-orange-500" />
                        <label htmlFor={`${fieldId}-group-required`} className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">{t("mi.required_q")}</label>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  {editingGroup && <button type="button" onClick={resetGroupEditor} className="px-3 py-1.5 text-xs font-bold text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-lg">{t("common.cancel")}</button>}
                  <button type="button" onClick={handleSaveGroup} disabled={isSubmitting || !groupName.trim()} className="bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-xs font-bold px-4 py-1.5 rounded-lg flex items-center gap-1.5">
                    {isSubmitting && <Loader2 className="w-3 h-3 animate-spin" />}
                    {t("mi.save_group")}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </Modal>
  );
}
