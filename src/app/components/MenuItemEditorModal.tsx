"use client";

import React, { useState, useEffect } from "react";
import { X, Loader2, Store, Plus, Trash2, Edit2, Check, AlertCircle } from "lucide-react";
import toast from "react-hot-toast";
import { menuService, MenuItem as ApiMenuItem, MenuSection, MenuOptionGroup, MenuOption } from "../../services/menu";

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

  // Option Groups State (Only available if editing an existing item)
  const [optionGroups, setOptionGroups] = useState<MenuOptionGroup[]>([]);
  const [optionsByGroup, setOptionsByGroup] = useState<Record<string, MenuOption[]>>({});
  const [isLoadingOptions, setIsLoadingOptions] = useState(false);

  // Option Group Editor State
  const [editingGroup, setEditingGroup] = useState<MenuOptionGroup | null>(null);
  const [groupName, setGroupName] = useState("");
  const [groupType, setGroupType] = useState<"radio" | "checkbox">("checkbox");
  const [groupIsRequired, setGroupIsRequired] = useState(false);

  // Option Editor State
  const [addingOptionToGroup, setAddingOptionToGroup] = useState<string | null>(null);
  const [optionName, setOptionName] = useState("");
  const [optionPrice, setOptionPrice] = useState("");

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
    }
    resetGroupEditor();
    resetOptionEditor();
  }, [item, isOpen, sections]);

  const loadOptionGroups = async (menuItemId: string) => {
    setIsLoadingOptions(true);
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
    } catch (err) {
      console.error("Failed to load option groups:", err);
      setOptionGroups([]);
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
      toast.error("Name, price, and section are required");
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
      toast.success("Menu item saved successfully!");
      onSuccess();
    } catch (err: any) {
      toast.error(err.message || "Failed to save menu item");
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
      toast.success("Option group saved successfully!");
      resetGroupEditor();
    } catch (err: any) {
      toast.error(err.message || "Failed to save option group");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteGroup = async (groupId: string) => {
    if (!confirm("Delete this option group?")) return;
    try {
      await menuService.deleteOptionGroup(groupId);
      await loadOptionGroups(item!.id);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveOption = async (groupId: string) => {
    if (!optionName.trim() || !optionPrice) return;
    try {
      await menuService.createOption(groupId, {
        name: optionName,
        price: parseFloat(optionPrice),
        sortOrder: 0,
      });
      await loadOptionGroups(item!.id);
      toast.success("Option choice added!");
      resetOptionEditor();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to create option choice");
    }
  };

  const handleDeleteOption = async (optionId: string) => {
    try {
      await menuService.deleteOption(optionId);
      toast.success("Option choice deleted!");
      await loadOptionGroups(item!.id);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to delete option choice");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl animate-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="p-5 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center bg-zinc-50 dark:bg-zinc-900/40 shrink-0">
          <div className="flex items-center gap-2">
            <span className="p-2 bg-orange-500/10 text-orange-500 rounded-xl">
              <Store className="w-4 h-4" />
            </span>
            <h3 className="text-xs font-black text-zinc-900 dark:text-white uppercase tracking-wider">
              {item ? "Edit Menu Item" : "Add New Menu Item"}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        {item && (
          <div className="flex border-b border-zinc-200 dark:border-zinc-800 shrink-0">
            <button
              onClick={() => setActiveTab("basic")}
              className={`flex-1 py-3 text-xs font-bold transition-all ${
                activeTab === "basic" ? "text-orange-500 border-b-2 border-orange-500" : "text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
              }`}
            >
              Basic Information
            </button>
            <button
              onClick={() => setActiveTab("options")}
              className={`flex-1 py-3 text-xs font-bold transition-all ${
                activeTab === "options" ? "text-orange-500 border-b-2 border-orange-500" : "text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
              }`}
            >
              Option Groups (Add-ons)
            </button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">

          {activeTab === "basic" && (
            <form id="basic-form" onSubmit={handleSaveBasic} className="space-y-4 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide">Dish Title *</label>
                <input type="text" required placeholder="e.g. Classic Cheeseburger" value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-zinc-50 border border-zinc-200 text-zinc-850 placeholder-zinc-400 rounded-xl p-2.5 focus:outline-none focus:ring-1 focus:ring-orange-500 dark:bg-zinc-950/20 dark:border-zinc-800 dark:text-zinc-200" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide">Price ($) *</label>
                  <input type="number" step="0.01" required placeholder="9.99" value={price} onChange={(e) => setPrice(e.target.value)} className="w-full bg-zinc-50 border border-zinc-200 text-zinc-850 placeholder-zinc-400 rounded-xl p-2.5 focus:outline-none focus:ring-1 focus:ring-orange-500 dark:bg-zinc-950/20 dark:border-zinc-800 dark:text-zinc-200" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide">Discounted Price ($)</label>
                  <input type="number" step="0.01" placeholder="Optional" value={discountedPrice} onChange={(e) => setDiscountedPrice(e.target.value)} className="w-full bg-zinc-50 border border-zinc-200 text-zinc-850 placeholder-zinc-400 rounded-xl p-2.5 focus:outline-none focus:ring-1 focus:ring-orange-500 dark:bg-zinc-950/20 dark:border-zinc-800 dark:text-zinc-200" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide">Image URL</label>
                <input type="text" placeholder="https://..." value={image} onChange={(e) => setImage(e.target.value)} className="w-full bg-zinc-50 border border-zinc-200 text-zinc-850 placeholder-zinc-400 rounded-xl p-2.5 focus:outline-none focus:ring-1 focus:ring-orange-500 dark:bg-zinc-950/20 dark:border-zinc-800 dark:text-zinc-200" />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide">Category Section *</label>
                <select required value={sectionId} onChange={(e) => setSectionId(e.target.value)} className="w-full bg-zinc-50 border border-zinc-200 text-zinc-850 rounded-xl p-2.5 focus:outline-none focus:ring-1 focus:ring-orange-500 dark:bg-zinc-950/20 dark:border-zinc-800 dark:text-zinc-200 cursor-pointer">
                  {sections.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide">Description</label>
                <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} className="w-full bg-zinc-50 border border-zinc-200 text-zinc-850 placeholder-zinc-400 rounded-xl p-2.5 focus:outline-none focus:ring-1 focus:ring-orange-500 dark:bg-zinc-950/20 dark:border-zinc-800 dark:text-zinc-200 resize-none font-sans" />
              </div>

              <div className="flex flex-col gap-2 pt-2">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={isAvailable} onChange={(e) => setIsAvailable(e.target.checked)} className="rounded border-zinc-300 text-orange-500 focus:ring-orange-500" />
                  <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Item is available (in stock)</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="rounded border-zinc-300 text-orange-500 focus:ring-orange-500" />
                  <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Item is active (shown on menu)</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={isPopular} onChange={(e) => setIsPopular(e.target.checked)} className="rounded border-zinc-300 text-orange-500 focus:ring-orange-500" />
                  <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Mark as popular</span>
                </label>
              </div>
            </form>
          )}

          {activeTab === "options" && item && (
            <div className="space-y-6">
              {isLoadingOptions ? (
                <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin text-orange-500" /></div>
              ) : (
                <>
                  {optionGroups.map(group => (
                    <div key={group.id} className="border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
                      <div className="bg-zinc-50 dark:bg-zinc-800/50 p-4 flex justify-between items-center border-b border-zinc-200 dark:border-zinc-800">
                        <div>
                          <h4 className="text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                            {group.name}
                            {group.isRequired && <span className="bg-red-500/10 text-red-500 text-[9px] px-1.5 py-0.5 rounded font-black uppercase tracking-wider">Required</span>}
                            <span className="bg-blue-500/10 text-blue-500 text-[9px] px-1.5 py-0.5 rounded font-black uppercase tracking-wider">{group.type === 'radio' ? 'Single Choice' : 'Multiple Choice'}</span>
                          </h4>
                          <p className="text-[10px] text-zinc-500 mt-0.5">
                            {group.type === 'radio' ? "Customer must choose exactly one option" : "Customer can choose multiple options"}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => {
                            setEditingGroup(group);
                            setGroupName(group.name);
                            setGroupType(group.type);
                            setGroupIsRequired(group.isRequired);
                          }} className="p-1.5 text-zinc-400 hover:text-orange-500 bg-white dark:bg-zinc-900 rounded-lg shadow-sm"><Edit2 className="w-3.5 h-3.5" /></button>
                          <button onClick={() => handleDeleteGroup(group.id)} className="p-1.5 text-zinc-400 hover:text-red-500 bg-white dark:bg-zinc-900 rounded-lg shadow-sm"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </div>
                      
                      <div className="p-4 space-y-3 bg-white dark:bg-zinc-900">
                        {/* Render options if they exist in the response type (mocking it by casting since types don't show it explicitly) */}
                        {((group as any).options || []).map((opt: any) => (
                          <div key={opt.id} className="flex justify-between items-center text-xs p-2 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-lg">
                            <span className="font-semibold text-zinc-700 dark:text-zinc-300">{opt.name}</span>
                            <div className="flex items-center gap-3">
                              <span className="font-bold text-zinc-900 dark:text-white">+{Number(opt.price || 0).toFixed(2)}</span>
                              <button onClick={() => handleDeleteOption(opt.id)} className="text-zinc-400 hover:text-red-500"><X className="w-3.5 h-3.5" /></button>
                            </div>
                          </div>
                        ))}

                        {addingOptionToGroup === group.id ? (
                          <div className="flex gap-2 items-center mt-2 p-2 bg-zinc-50 dark:bg-zinc-800/30 rounded-lg border border-zinc-200 dark:border-zinc-700">
                            <input type="text" placeholder="Option name" value={optionName} onChange={e => setOptionName(e.target.value)} className="flex-1 text-xs px-2 py-1.5 rounded bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700" />
                            <input type="number" step="0.01" placeholder="Price" value={optionPrice} onChange={e => setOptionPrice(e.target.value)} className="w-20 text-xs px-2 py-1.5 rounded bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700" />
                            <button onClick={() => handleSaveOption(group.id)} className="p-1.5 bg-orange-500 text-white rounded hover:bg-orange-600"><Check className="w-3.5 h-3.5" /></button>
                            <button onClick={resetOptionEditor} className="p-1.5 text-zinc-500 hover:text-zinc-800 dark:hover:text-white"><X className="w-3.5 h-3.5" /></button>
                          </div>
                        ) : (
                          <button onClick={() => setAddingOptionToGroup(group.id)} className="text-[10px] font-bold text-orange-500 flex items-center gap-1 hover:underline mt-2 ml-2">
                            <Plus className="w-3 h-3" /> Add Option Choice
                          </button>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* Group Editor / Adder */}
                  <div className="p-4 border border-dashed border-zinc-300 dark:border-zinc-700 rounded-2xl bg-zinc-50 dark:bg-zinc-900/30">
                    <h4 className="text-xs font-bold text-zinc-800 dark:text-zinc-200 mb-3">{editingGroup ? "Edit Option Group" : "Create New Option Group"}</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                      <input type="text" placeholder="Group Name (e.g. Size, Toppings)" value={groupName} onChange={e => setGroupName(e.target.value)} className="text-xs px-3 py-2 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 w-full" />
                      <div className="flex items-center gap-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2">
                        <select value={groupType} onChange={e => setGroupType(e.target.value as any)} className="bg-transparent focus:outline-none text-xs text-zinc-800 dark:text-zinc-200 flex-1 border-r border-zinc-200 dark:border-zinc-700 pr-2">
                          <option value="radio">Single Choice (Radio)</option>
                          <option value="checkbox">Multiple Choice (Checkbox)</option>
                        </select>
                        <label className="flex items-center gap-2 text-xs font-semibold text-zinc-600 dark:text-zinc-400 shrink-0">
                          <input type="checkbox" checked={groupIsRequired} onChange={e => setGroupIsRequired(e.target.checked)} className="rounded text-orange-500" />
                          Required?
                        </label>
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      {editingGroup && <button onClick={resetGroupEditor} className="px-3 py-1.5 text-xs font-bold text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-lg">Cancel</button>}
                      <button onClick={handleSaveGroup} disabled={isSubmitting || !groupName.trim()} className="bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-xs font-bold px-4 py-1.5 rounded-lg flex items-center gap-1.5">
                        {isSubmitting && <Loader2 className="w-3 h-3 animate-spin" />}
                        Save Group
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions (Only for Basic Form) */}
        {activeTab === "basic" && (
          <div className="p-4 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/40 shrink-0 flex justify-end gap-2.5">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-zinc-200 dark:border-zinc-850 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-500 font-bold rounded-xl transition-all text-xs"
            >
              Cancel
            </button>
            <button
              form="basic-form"
              type="submit"
              disabled={isSubmitting}
              className="bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-bold px-4 py-2 rounded-xl shadow-lg shadow-orange-500/10 transition-all flex items-center gap-2 text-xs"
            >
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Save Item Details
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
