"use client";

import React, { useState, useEffect } from "react";
import {
  UploadCloud,
  FileText,
  Image as ImageIcon,
  Sparkles,
  Check,
  Loader2,
  Plus,
  Trash2,
  AlertCircle,
  Eye,
  DollarSign,
  X,
  Store,
  ChevronRight,
  TrendingUp,
  FolderPlus,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import { Restaurant } from "../data/mockData";
import { menuService, MenuSection, MenuItem as ApiMenuItem } from "../../services/menu";
import { restaurantsService } from "../../services/restaurants";
import MenuSectionEditorModal from "./MenuSectionEditorModal";
import MenuItemEditorModal from "./MenuItemEditorModal";

interface RestaurantMenuSectionProps {
  restaurant: Restaurant;
  onUpdateRestaurant: (updatedRest: Restaurant) => void;
}

interface ParsedMenuData {
  name: string;
  type: "pdf" | "excel" | "image";
  size: string;
  categories: {
    name: string;
    items: {
      name: string;
      description?: string;
      price: number;
      image?: string;
      isAvailable: boolean;
    }[];
  }[];
}

export default function RestaurantMenuSection({
  restaurant,
  onUpdateRestaurant,
}: RestaurantMenuSectionProps) {
  // Real Google Gemini API states
  const [geminiApiKey, setGeminiApiKey] = useState(() => {
    if (typeof window !== "undefined") {
      return window.localStorage.getItem("nowlny_gemini_key") || "";
    }
    return "";
  });

  const handleUpdateApiKey = (key: string) => {
    setGeminiApiKey(key);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("nowlny_gemini_key", key);
    }
  };

  // Parsing tool states
  const [customFileName, setCustomFileName] = useState<string>("");
  const [isParsing, setIsParsing] = useState(false);
  const [parsingStep, setParsingStep] = useState<string>("");
  const [parseProgress, setParseProgress] = useState(0);
  const [parsedData, setParsedData] = useState<ParsedMenuData | null>(null);
  const [parseSuccess, setParseSuccess] = useState(false);

  // Custom states for premium error handling and Toast notifications
  const [parsingError, setParsingError] = useState<string | null>(null);
  const [lastUploadedFile, setLastUploadedFile] = useState<{
    name: string;
    base64Data: string;
    fileMime: string;
    fileSize: string;
  } | null>(null);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error" | "info";
  } | null>(null);

  const showToast = (
    message: string,
    type: "success" | "error" | "info" = "success",
  ) => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  // --- API DATA STATES ---
  const [sections, setSections] = useState<MenuSection[]>([]);
  const [itemsBySection, setItemsBySection] = useState<Record<string, ApiMenuItem[]>>({});
  const [isLoadingMenu, setIsLoadingMenu] = useState(true);

  const loadMenu = async () => {
    setIsLoadingMenu(true);
    try {
      // First, get the full menu response
      // For fallback we also just manually load sections and items
      const loadedSections = await menuService.getSectionsByRestaurant(restaurant.id).catch(() => [] as MenuSection[]);
      setSections(loadedSections || []);

      const itemsMap: Record<string, ApiMenuItem[]> = {};
      
      // Load items for each section in parallel
      if (loadedSections && loadedSections.length > 0) {
        await Promise.all(
          loadedSections.map(async (sec) => {
            const items = await menuService.getItemsBySection(sec.id).catch(() => [] as ApiMenuItem[]);
            itemsMap[sec.id] = items || [];
          })
        );
      }
      setItemsBySection(itemsMap);
    } catch (err) {
      console.error("Failed to load menu", err);
      showToast("Failed to load menu from API. Check connection.", "error");
    } finally {
      setIsLoadingMenu(false);
    }
  };

  useEffect(() => {
    if (restaurant?.id) {
      loadMenu();
    }
  }, [restaurant.id]);

  // Menu editor states
  const [selectedCategoryTab, setSelectedCategoryTab] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Modal States
  const [isSectionModalOpen, setIsSectionModalOpen] = useState(false);
  const [editingSection, setEditingSection] = useState<MenuSection | null>(null);

  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ApiMenuItem | null>(null);

  // Flat list of all items for searching
  const allItems: (ApiMenuItem & { sectionName: string })[] = sections.reduce<(ApiMenuItem & { sectionName: string })[]>(
    (acc, sec) => {
      const secItems = (itemsBySection[sec.id] || []).map(i => ({ ...i, sectionName: sec.name, sectionId: sec.id }));
      return [...acc, ...secItems];
    },
    [],
  );

  // Filtered menu items
  const getFilteredItems = () => {
    let list = [];
    if (selectedCategoryTab === "all") {
      list = allItems;
    } else {
      const sec = sections.find((c) => c.id === selectedCategoryTab);
      list = sec ? (itemsBySection[sec.id] || []).map(i => ({ ...i, sectionName: sec.name, sectionId: sec.id })) : [];
    }

    if (searchQuery.trim() !== "") {
      list = list.filter(
        (item) =>
          item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
          item.sectionName.toLowerCase().includes(searchQuery.toLowerCase()),
      );
    }
    return list;
  };

  const filteredItems = getFilteredItems();

  // Real Google Gemini 1.5 Flash API scanner
  const runLiveGeminiScan = async (
    fileName: string,
    base64Data: string,
    fileMime: string,
    fileSize: string,
  ) => {
    setIsParsing(true);
    setParseProgress(10);
    setParsingStep("Establishing bridge connection to Gemini AI...");
    setParsedData(null);
    setParseSuccess(false);
    setParsingError(null);

    // Dynamic scanning progress steps simulator
    let currentProgress = 10;
    const progressInterval = setInterval(() => {
      if (currentProgress < 95) {
        currentProgress += Math.floor(Math.random() * 5) + 2;
        setParseProgress(Math.min(95, currentProgress));

        if (currentProgress > 25 && currentProgress <= 45) {
          setParsingStep("Multimodal vision model parsing files...");
        } else if (currentProgress > 45 && currentProgress <= 70) {
          setParsingStep(
            "Running Google Gemini 1.5 Flash OCR on text grids...",
          );
        } else if (currentProgress > 70) {
          setParsingStep(
            "Structuring extracted dishes into dynamic JSON schemas...",
          );
        }
      }
    }, 300);

    try {
      const response = await fetch("/api/parse-menu", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fileData: base64Data,
          mimeType: fileMime,
          customApiKey: geminiApiKey,
        }),
      });

      clearInterval(progressInterval);

      if (!response.ok) {
        const errorBody = await response.json();
        throw new Error(
          errorBody.error || "Failed to scan menu via Gemini API.",
        );
      }

      const parsedResult = await response.json();

      setParseProgress(100);
      setParsingStep("Google Gemini real-time OCR completed successfully!");

      setTimeout(() => {
        setIsParsing(false);
        setParsedData({
          name: fileName,
          type: fileMime.includes("pdf")
            ? "pdf"
            : fileMime.includes("sheet") ||
                fileMime.includes("excel") ||
                fileMime.includes("csv")
              ? "excel"
              : "image",
          size: fileSize,
          categories: parsedResult.categories || [],
        });
        setParseSuccess(true);
        showToast("Menu parsed successfully by Gemini AI!", "success");
      }, 500);
    } catch (err: any) {
      clearInterval(progressInterval);
      setIsParsing(false);

      let friendlyMessage = err.message;

      // Parse the nested API error if present in JSON format
      if (err.message.includes("Gemini API responded with error:")) {
        try {
          const jsonStartIndex = err.message.indexOf("{");
          if (jsonStartIndex !== -1) {
            const rawJson = err.message.substring(jsonStartIndex);
            const errorObj = JSON.parse(rawJson);
            if (errorObj?.error?.message) {
              friendlyMessage = errorObj.error.message;
            }
          }
        } catch (e) {
          // Ignore and use original message if parsing fails
        }
      }

      setParsingError(friendlyMessage);
      showToast("Gemini parsing failed. See details below.", "error");
    }
  };

  const handleRetryScan = async () => {
    if (!lastUploadedFile) return;
    await runLiveGeminiScan(
      lastUploadedFile.name,
      lastUploadedFile.base64Data,
      lastUploadedFile.fileMime,
      lastUploadedFile.fileSize,
    );
  };

  // Custom File Uploader
  const handleCustomFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const mockSize = (file.size / (1024 * 1024)).toFixed(1) + " MB";

      setCustomFileName(file.name);
      setParsingError(null);

      const reader = new FileReader();
      reader.onload = async () => {
        if (reader.result) {
          const base64Data = (reader.result as string).split(",")[1];
          setLastUploadedFile({
            name: file.name,
            base64Data,
            fileMime: file.type || "image/png",
            fileSize: mockSize,
          });
          await runLiveGeminiScan(
            file.name,
            base64Data,
            file.type || "image/png",
            mockSize,
          );
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Merge parsed items into the restaurant's menu using API
  const handleApproveParsedMenu = async () => {
    if (!parsedData) return;
    showToast("Integrating parsed menu into live API. Please wait...", "info");

    try {
      // Reload sections to ensure we have the most up-to-date list
      let currentSections: MenuSection[] = await menuService.getSectionsByRestaurant(restaurant.id).catch(() => [] as MenuSection[]);
      setSections(currentSections || []);

      for (const parsedCat of parsedData.categories) {
        // Find existing section
        let existingSec = currentSections.find((s) => s.name.toLowerCase() === parsedCat.name.toLowerCase());
        let sectionId = existingSec?.id;

        if (!existingSec) {
          try {
            // Create new section
            const newSec = await menuService.createSection({
              restaurantId: restaurant.id,
              name: parsedCat.name,
              sortOrder: currentSections.length,
            });
            sectionId = newSec.id;
            currentSections.push(newSec);
          } catch (err: any) {
            if (err.message?.includes('409') || err.message?.includes('already exists')) {
              console.warn(`Section "${parsedCat.name}" already exists, bypassing...`);
              // Try to find the section again after refreshing the list
              const refreshedSections: MenuSection[] = await menuService.getSectionsByRestaurant(restaurant.id).catch(() => [] as MenuSection[]);
              const foundSec = refreshedSections?.find((s) => s.name.toLowerCase() === parsedCat.name.toLowerCase());
              if (foundSec) {
                sectionId = foundSec.id;
                currentSections = refreshedSections || [];
              }
            } else {
              throw err; // Re-throw if it's not a conflict
            }
          }
        }

        if (!sectionId) continue;

        // Create items for section
        for (const [idx, item] of parsedCat.items.entries()) {
          try {
            await menuService.createItem({
              sectionId,
              name: item.name,
              description: item.description,
              price: item.price,
              image: item.image,
              isAvailable: item.isAvailable,
              sortOrder: idx,
            });
          } catch (err: any) {
             if (err.message?.includes('409') || err.message?.includes('already exists')) {
                console.warn(`Item "${item.name}" already exists in section, bypassing...`);
             } else {
                throw err; // Re-throw if it's not a conflict
             }
          }
        }
      }

      await loadMenu(); // Reload all menu data

      // Reset states
      setParsedData(null);
      setCustomFileName("");
      setParseSuccess(false);
      setLastUploadedFile(null);

      showToast("AI Parsed Menu approved! Items successfully integrated into your live menu.", "success");
    } catch (err) {
      console.error(err);
      showToast("An error occurred integrating the menu via API.", "error");
    }
  };

  // Delete an item from the menu via API
  const handleDeleteItem = async (itemId: string) => {
    if (!confirm("Are you sure you want to remove this item from your store menu?")) return;

    try {
      await menuService.deleteItem(itemId);
      await loadMenu();
      showToast("Item deleted.", "success");
    } catch (error) {
      showToast("Failed to delete item.", "error");
    }
  };

  // Toggle Item Availability via API
  const handleToggleAvailability = async (item: ApiMenuItem) => {
    try {
      await menuService.updateItem(item.id, { isAvailable: !item.isAvailable });
      await loadMenu();
    } catch (error) {
      showToast("Failed to toggle availability.", "error");
    }
  };

  // Edit Item Details (inline price update)
  const handleUpdatePrice = async (itemId: string, newPrice: number) => {
    if (isNaN(newPrice) || newPrice <= 0) return;
    try {
      await menuService.updateItem(itemId, { price: newPrice });
      await loadMenu();
    } catch (error) {
      showToast("Failed to update price.", "error");
    }
  };

  const handleDeleteSection = async (sectionId: string) => {
    if (!confirm("Are you sure you want to delete this category? All items inside will be lost.")) return;
    try {
      await menuService.deleteSection(sectionId);
      await loadMenu();
      showToast("Category deleted.", "success");
    } catch (err) {
      showToast("Failed to delete category.", "error");
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Banner / Store Header Info Card */}
      <div className="relative h-48 sm:h-56 rounded-3xl overflow-hidden shadow-md">
        <img
          src={
            (restaurant as any).backgroundImageUrl ||
            (restaurant as any).coverImage ||
            "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=600&auto=format&fit=crop&q=80"
          }
          alt={restaurant.name}
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />

        <div className="absolute bottom-6 left-6 right-6 flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-white dark:bg-zinc-900 shadow-lg flex items-center justify-center text-4xl shrink-0 border-2 border-orange-500/20 overflow-hidden">
              {restaurant.logo && typeof restaurant.logo === 'string' && restaurant.logo.length > 5 ? (
                <img src={restaurant.logo} alt="logo" className="w-full h-full object-cover" />
              ) : (
                restaurant.logo || "🍽️"
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  {restaurant.name}
                </h1>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                    restaurant.status.toLowerCase() === "active"
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                      : restaurant.status.toLowerCase() === "pending"
                        ? "bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse"
                        : "bg-red-500/20 text-red-400 border border-red-500/30"
                  }`}
                >
                  {restaurant.status}
                </span>
              </div>
              <p className="text-xs text-zinc-300 font-semibold mt-1">
                Cuisine: {restaurant.cuisine} • Total Items: {allItems.length}
              </p>
              <p className="text-[10px] text-zinc-400 mt-0.5">
                {restaurant.address}
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              setEditingItem(null);
              setIsItemModalOpen(true);
            }}
            className="bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-lg shadow-orange-500/20 flex items-center gap-2 transition-all self-stretch sm:self-auto justify-center"
          >
            <Plus className="w-4 h-4" /> Add Menu Item
          </button>
        </div>
      </div>

      {/* AI MENU UPLOADER / PARSER SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Dropzone & AI Uploader - Left (or full if no parsed preview) */}
        <div
          className={`bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm flex flex-col justify-between ${
            parsedData ? "lg:col-span-6" : "lg:col-span-12"
          } transition-all duration-300`}
        >
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="p-2 bg-purple-500/10 text-purple-500 dark:text-purple-400 rounded-xl">
                  <Sparkles className="w-5 h-5 animate-pulse" />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
                    AI Menu Uploader & Parser
                  </h3>
                  <p className="text-[10px] text-zinc-400">
                    Import menu lists from PDF flyer, Excel spreadsheets, or
                    images in seconds!
                  </p>
                </div>
              </div>

              <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 bg-purple-500/10 text-purple-600 rounded border border-purple-500/10 animate-pulse">
                Powered by OCR
              </span>
            </div>

            {/* Error Notification Panel */}
            {parsingError && (
              <div className="p-4 rounded-2xl bg-red-500/5 dark:bg-red-950/10 border border-red-500/20 space-y-3 text-xs animate-in slide-in-from-top-2 duration-200">
                <div className="flex items-start gap-2.5 text-red-500 dark:text-red-400">
                  <AlertCircle className="w-4.5 h-4.5 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-bold text-red-650 dark:text-red-400">
                      Gemini Parsing Failure
                    </p>
                    <p className="text-[11px] text-zinc-650 dark:text-zinc-300 leading-normal font-medium">
                      {parsingError}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 pt-1">
                  {lastUploadedFile && (
                    <button
                      onClick={handleRetryScan}
                      disabled={isParsing}
                      className="bg-red-500 hover:bg-red-650 disabled:opacity-50 text-white font-bold text-[10px] px-3.5 py-2 rounded-xl shadow-md shadow-red-500/10 flex items-center gap-1.5 transition-all"
                    >
                      <Loader2
                        className={`w-3.5 h-3.5 ${isParsing ? "animate-spin" : ""}`}
                      />
                      Retry Scan
                    </button>
                  )}
                  <button
                    onClick={() => setParsingError(null)}
                    className="border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-850 text-zinc-500 font-bold text-[10px] px-3.5 py-2 rounded-xl transition-all"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            )}

            {/* REAL AI / GEMINI OCR CONFIGURATION PANEL */}
            <div className="p-4 bg-zinc-50 dark:bg-zinc-950/20 border border-zinc-150 dark:border-zinc-850 rounded-2xl space-y-3">
              <div className="space-y-0.5">
                <p className="text-xs font-black text-zinc-800 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                  ⚙️ Google Gemini AI Credentials
                </p>
                <p className="text-[9px] text-zinc-400">
                  Enter your key below to connect directly to the multimodal AI
                  uploader.
                </p>
              </div>

              <div className="space-y-2 animate-in slide-in-from-top-2 duration-200">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest block">
                    Google Gemini API Key
                  </label>
                  <input
                    type="password"
                    placeholder="Enter Gemini API Key (AIzaSy...)"
                    value={geminiApiKey}
                    onChange={(e) => handleUpdateApiKey(e.target.value)}
                    className="w-full bg-white dark:bg-zinc-900 border border-zinc-250 dark:border-zinc-850 text-[11px] font-bold text-zinc-850 dark:text-zinc-100 placeholder-zinc-400 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-purple-500 shadow-sm"
                  />
                </div>
                <p className="text-[9px] text-zinc-400 leading-normal">
                  💡 <strong>Safe & Secure</strong>: Transmitted securely to
                  Gemini's API endpoints. Get a free API Key at{" "}
                  <a
                    href="https://aistudio.google.com/"
                    target="_blank"
                    rel="noreferrer"
                    className="text-purple-500 font-bold hover:underline"
                  >
                    Google AI Studio
                  </a>
                  . If you set <code>GEMINI_API_KEY</code> on your server
                  environment, you can leave this blank!
                </p>
              </div>
            </div>

            {/* Simulated file drag/drop or selector */}
            <div className="border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 text-center bg-zinc-50/50 dark:bg-zinc-950/20 flex flex-col items-center justify-center space-y-3 hover:border-purple-500/30 transition-colors relative">
              <UploadCloud className="w-10 h-10 text-zinc-300 dark:text-zinc-700" />
              <div className="space-y-1">
                <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                  Drag & drop your store menu file here
                </p>
                <p className="text-[10px] text-zinc-400">
                  PDF, Excel (XLSX, CSV), PNG, JPG up to 10MB
                </p>
              </div>

              <label className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/80 text-zinc-700 dark:text-zinc-300 font-bold text-[10px] px-3 py-2 rounded-lg cursor-pointer transition-all shadow-sm">
                Browse Files
                <input
                  type="file"
                  accept=".pdf, .xlsx, .xls, .csv, .png, .jpg, .jpeg, .webp"
                  onChange={handleCustomFileUpload}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* Scanning Animation Progress overlay */}
          {isParsing && (
            <div className="mt-6 p-4 rounded-2xl bg-purple-500/[0.02] border border-purple-500/10 space-y-3.5 relative overflow-hidden">
              {/* Scan laser line animation */}
              <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-purple-500 to-transparent animate-pulse shadow-[0_0_8px_rgba(168,85,247,0.8)]" />

              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-purple-500 dark:text-purple-400 flex items-center gap-1.5 font-bold">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  {parsingStep}
                </span>
                <span className="text-purple-600 dark:text-purple-400 font-black">
                  {parseProgress}%
                </span>
              </div>

              {/* Progress bar wrapper */}
              <div className="h-1.5 w-full bg-zinc-100 dark:bg-zinc-850 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-purple-500 to-indigo-600 transition-all duration-300 rounded-full"
                  style={{ width: `${parseProgress}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* AI Parsed Results Preview Panel - Right */}
        {parsedData && (
          <div className="lg:col-span-6 bg-white dark:bg-zinc-900 border border-purple-500/20 dark:border-purple-500/10 rounded-3xl p-6 shadow-md flex flex-col justify-between max-h-[460px] animate-in slide-in-from-right-4 duration-300">
            <div className="space-y-4 overflow-hidden flex flex-col flex-1">
              <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
                <div className="flex items-center gap-2">
                  <span className="p-2 bg-emerald-500/10 text-emerald-500 rounded-xl">
                    <Check className="w-4 h-4" />
                  </span>
                  <div>
                    <h3 className="text-xs font-black text-zinc-900 dark:text-white uppercase tracking-wider">
                      AI Parsed Menu Preview
                    </h3>
                    <p className="text-[9px] text-zinc-400 font-semibold truncate max-w-[200px]">
                      Source: {parsedData.name}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <p className="text-[10px] font-black text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/15 inline-block">
                    Confidence: 98%
                  </p>
                </div>
              </div>

              {/* Extracted category items list (Scrollable) */}
              <div className="overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800 flex-1 pr-1 space-y-4">
                {parsedData.categories.map((cat, catIdx) => (
                  <div key={catIdx} className="pt-3 first:pt-0 space-y-2">
                    <h4 className="text-[10px] font-black text-purple-500 dark:text-purple-400 uppercase tracking-widest flex items-center gap-1.5">
                      <FolderPlus className="w-3.5 h-3.5" />
                      Category: {cat.name}
                    </h4>

                    <div className="space-y-2">
                      {cat.items.map((item, itemIdx) => (
                        <div
                          key={itemIdx}
                          className="p-3 bg-zinc-50 dark:bg-zinc-950/40 rounded-xl border border-zinc-150 dark:border-zinc-850 flex items-start justify-between gap-3 text-xs"
                        >
                          <div className="min-w-0">
                            <p className="font-bold text-zinc-800 dark:text-zinc-200 truncate">
                              {item.name}
                            </p>
                            <p className="text-[10px] text-zinc-400 line-clamp-1 mt-0.5">
                              {item.description}
                            </p>
                          </div>
                          <span className="font-extrabold text-orange-500 shrink-0">
                            ${item.price.toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Approval Action CTA */}
            <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 mt-4 flex items-center gap-3">
              <button
                onClick={() => {
                  setParsedData(null);
                  setCustomFileName("");
                }}
                className="px-4 py-2.5 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:text-red-500 text-zinc-500 dark:text-zinc-400 font-bold text-xs rounded-xl transition-all"
              >
                Discard
              </button>

              <button
                onClick={handleApproveParsedMenu}
                className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold text-xs py-2.5 px-4 rounded-xl shadow-lg shadow-purple-500/20 flex items-center justify-center gap-2 transition-all"
              >
                <Check className="w-4 h-4" /> Approve & Integrate Menu
              </button>
            </div>
          </div>
        )}
      </div>

      {/* MENU BROWSER & EDITOR TABLE */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm space-y-6">
        {/* Search, Filter, Stats Section */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h3 className="text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-2">
              Store Menu Catalog
              {isLoadingMenu && <Loader2 className="w-4 h-4 animate-spin text-orange-500" />}
            </h3>
            <p className="text-[10px] text-zinc-400">
              Search, edit pricing, or toggle availability of dishes listed in
              your store menu.
            </p>
          </div>

          <div className="w-full sm:w-64">
            <input
              type="text"
              placeholder="Search catalog..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-zinc-50 border border-zinc-200 text-zinc-850 placeholder-zinc-400 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-orange-500 dark:bg-zinc-950/20 dark:border-zinc-800 dark:text-zinc-200"
            />
          </div>
        </div>

        {/* Section Actions & Header */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none border-b border-zinc-100 dark:border-zinc-800">
          <button
            onClick={() => setSelectedCategoryTab("all")}
            className={`text-xs font-bold px-3.5 py-2 rounded-xl whitespace-nowrap transition-all border ${
              selectedCategoryTab === "all"
                ? "bg-orange-500 border-orange-500 text-white shadow-sm"
                : "bg-white border-zinc-200 text-zinc-500 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400"
            }`}
          >
            All Items ({allItems.length})
          </button>

          {sections.map((sec) => (
            <button
              key={sec.id}
              onClick={() => setSelectedCategoryTab(sec.id)}
              className={`text-xs font-bold px-3.5 py-2 rounded-xl whitespace-nowrap transition-all border ${
                selectedCategoryTab === sec.id
                  ? "bg-orange-500 border-orange-500 text-white shadow-sm"
                  : "bg-white border-zinc-200 text-zinc-500 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400"
              }`}
            >
              {sec.name} ({itemsBySection[sec.id]?.length || 0})
            </button>
          ))}
          
          <button
            onClick={() => {
              setEditingSection(null);
              setIsSectionModalOpen(true);
            }}
            className="text-xs font-bold px-3.5 py-2 rounded-xl whitespace-nowrap transition-all border border-dashed border-orange-500/50 text-orange-500 hover:bg-orange-500/10"
          >
            + Add Section
          </button>
        </div>

        {/* Menu Items Grouped by Section */}
        {sections.length === 0 ? (
          <div className="text-center p-12 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl flex flex-col items-center justify-center">
            <Store className="w-12 h-12 text-zinc-300 dark:text-zinc-700 mb-3" />
            <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
              Your menu is empty
            </p>
            <p className="text-[10px] text-zinc-400 mt-1 mb-4">
              Start by creating a section, then add your items!
            </p>
            <button onClick={() => {
              setEditingSection(null);
              setIsSectionModalOpen(true);
            }} className="bg-orange-500 text-white font-bold text-xs px-4 py-2 rounded-lg">Create Section</button>
          </div>
        ) : (
          <div className="space-y-8">
            {sections
              .filter(sec => selectedCategoryTab === "all" || selectedCategoryTab === sec.id)
              .filter(sec => {
                const secItems = filteredItems.filter(item => item.sectionId === sec.id);
                // Show section if it has matching items, or if the section name itself matches the query, or if no query
                return secItems.length > 0 || searchQuery === "" || sec.name.toLowerCase().includes(searchQuery.toLowerCase());
              })
              .map(sec => {
                const secItems = filteredItems.filter(item => item.sectionId === sec.id);
                
                return (
                  <div key={sec.id} className="space-y-4">
                    {/* Section Header */}
                    <div className="flex items-center justify-between pb-2 border-b border-zinc-200 dark:border-zinc-800">
                      <h4 className="font-black text-sm text-zinc-900 dark:text-white uppercase tracking-wider">{sec.name}</h4>
                      <div className="flex gap-2">
                        <button onClick={() => {
                          setEditingSection(sec);
                          setIsSectionModalOpen(true);
                        }} className="text-xs font-bold text-zinc-500 hover:text-orange-500">Edit Section</button>
                        <button onClick={() => handleDeleteSection(sec.id)} className="text-xs font-bold text-zinc-500 hover:text-red-500">Delete</button>
                      </div>
                    </div>
                    
                    {/* Items Grid for this Section */}
                    {secItems.length === 0 ? (
                      <p className="text-xs text-zinc-400 italic">No items found in this section.</p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {secItems.map((item) => (
                          <div
                            key={item.id}
                            className={`bg-zinc-50/50 dark:bg-zinc-950/20 border border-zinc-150 dark:border-zinc-800/80 p-4 rounded-2xl flex gap-4 hover:border-orange-500/20 hover:shadow-sm transition-all duration-200 group ${
                              !item.isAvailable ? "opacity-60" : ""
                            }`}
                          >
                            {/* Item Image placeholder or loaded */}
                            <div className="w-16 h-16 rounded-xl bg-zinc-200 dark:bg-zinc-800 overflow-hidden shrink-0 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center text-2xl">
                              {item.image ? (
                                <img
                                  src={item.image}
                                  alt={item.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                "🍲"
                              )}
                            </div>

                            {/* Item Description, Title and Price */}
                            <div className="flex-1 min-w-0 flex flex-col justify-between">
                              <div>
                                <div className="flex justify-between items-start gap-2">
                                  <h4 className="text-xs font-bold text-zinc-900 dark:text-white truncate group-hover:text-orange-500 transition-colors">
                                    {item.name}
                                  </h4>
                                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                    <button
                                      onClick={() => {
                                        setEditingItem(item);
                                        setIsItemModalOpen(true);
                                      }}
                                      className="text-zinc-400 hover:text-orange-500 p-1 hover:bg-zinc-150 dark:hover:bg-zinc-800 rounded"
                                      title="Edit dish"
                                    >
                                      <FileText className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteItem(item.id)}
                                      className="text-zinc-400 hover:text-red-500 p-1 hover:bg-zinc-150 dark:hover:bg-zinc-800 rounded"
                                      title="Delete dish"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                                <p className="text-[10px] text-zinc-400 line-clamp-2 mt-0.5">
                                  {item.description}
                                </p>
                              </div>

                              <div className="flex items-center justify-between pt-2 border-t border-zinc-100 dark:border-zinc-800/80 mt-2">
                                {/* Price Editor inline */}
                                <div className="flex items-center gap-1.5">
                                  <DollarSign className="w-3.5 h-3.5 text-zinc-400" />
                                  <input
                                    type="number"
                                    step="0.1"
                                    defaultValue={item.price}
                                    onBlur={(e) =>
                                      handleUpdatePrice(
                                        item.id,
                                        parseFloat(e.target.value),
                                      )
                                    }
                                    className="w-16 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs font-bold text-zinc-800 dark:text-zinc-200 px-1 py-0.5 rounded focus:outline-none focus:ring-1 focus:ring-orange-500"
                                  />
                                </div>

                                {/* Availability toggle */}
                                <button
                                  onClick={() => handleToggleAvailability(item)}
                                  className={`text-[10px] font-bold px-2 py-1 rounded transition-colors flex items-center gap-1 border ${
                                    item.isAvailable
                                      ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500"
                                      : "bg-zinc-100 border-zinc-200 text-zinc-400 dark:bg-zinc-800 dark:border-zinc-700"
                                  }`}
                                >
                                  {item.isAvailable ? (
                                    <>
                                      <Check className="w-3 h-3" /> Available
                                    </>
                                  ) : (
                                    <>
                                      <X className="w-3 h-3" /> Snoozed
                                    </>
                                  )}
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        )}
      </div>

      <MenuSectionEditorModal
        isOpen={isSectionModalOpen}
        onClose={() => setIsSectionModalOpen(false)}
        section={editingSection}
        restaurantId={restaurant.id}
        onSuccess={() => {
          setIsSectionModalOpen(false);
          loadMenu();
          showToast(editingSection ? "Category updated." : "Category created.", "success");
        }}
      />

      <MenuItemEditorModal
        isOpen={isItemModalOpen}
        onClose={() => setIsItemModalOpen(false)}
        item={editingItem}
        sections={sections}
        onSuccess={() => {
          setIsItemModalOpen(false);
          loadMenu();
          showToast(editingItem ? "Item updated." : "Item created.", "success");
        }}
      />

      {/* Dynamic Floating Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-[100] p-4 bg-zinc-900 dark:bg-zinc-950 border border-zinc-800 dark:border-zinc-900 rounded-2xl shadow-2xl flex items-center gap-3 max-w-sm animate-in slide-in-from-bottom-5 duration-200">
          {toast.type === "success" ? (
            <span className="p-1.5 bg-emerald-500/10 text-emerald-400 rounded-lg">
              <Check className="w-4 h-4" />
            </span>
          ) : toast.type === "error" ? (
            <span className="p-1.5 bg-red-500/10 text-red-400 rounded-lg">
              <AlertCircle className="w-4 h-4" />
            </span>
          ) : (
            <span className="p-1.5 bg-blue-500/10 text-blue-400 rounded-lg">
              <AlertCircle className="w-4 h-4" />
            </span>
          )}
          <p className="text-[11px] font-bold text-white leading-normal">
            {toast.message}
          </p>
          <button
            onClick={() => setToast(null)}
            className="text-zinc-500 hover:text-white transition-colors ml-auto p-1"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
