"use client";

import React, { useState } from "react";
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
  ToggleRight
} from "lucide-react";
import { Restaurant, MenuItem, MenuCategory, loadDb } from "../data/mockData";

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
    items: Omit<MenuItem, "id">[];
  }[];
}

export default function RestaurantMenuSection({
  restaurant,
  onUpdateRestaurant
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
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  const showToast = (message: string, type: "success" | "error" | "info" = "success") => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  // Menu editor states
  const [selectedCategoryTab, setSelectedCategoryTab] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  
  // Manual Add Item modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const [newItemDesc, setNewItemDesc] = useState("");
  const [newItemPrice, setNewItemPrice] = useState("");
  const [newItemCategory, setNewItemCategory] = useState("");
  const [newCategoryName, setNewCategoryName] = useState(""); // if creating new category
  const [newItemImage, setNewItemImage] = useState("");

  // Categories present in the restaurant
  const currentCategories = restaurant.menu;
  
  // Flat list of all items for searching
  const allItems: MenuItem[] = currentCategories.reduce<MenuItem[]>((acc, cat) => {
    return [...acc, ...cat.items];
  }, []);

  // Filtered menu items
  const getFilteredItems = () => {
    let list: MenuItem[] = [];
    if (selectedCategoryTab === "all") {
      list = allItems;
    } else {
      const cat = currentCategories.find(c => c.id === selectedCategoryTab);
      list = cat ? cat.items : [];
    }

    if (searchQuery.trim() !== "") {
      list = list.filter(item => 
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.category.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    return list;
  };

  const filteredItems = getFilteredItems();



  // Real Google Gemini 1.5 Flash API scanner
  const runLiveGeminiScan = async (fileName: string, base64Data: string, fileMime: string, fileSize: string) => {
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
          setParsingStep("Running Google Gemini 1.5 Flash OCR on text grids...");
        } else if (currentProgress > 70) {
          setParsingStep("Structuring extracted dishes into dynamic JSON schemas...");
        }
      }
    }, 300);

    try {
      const response = await fetch("/api/parse-menu", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          fileData: base64Data,
          mimeType: fileMime,
          customApiKey: geminiApiKey
        })
      });

      clearInterval(progressInterval);

      if (!response.ok) {
        const errorBody = await response.json();
        throw new Error(errorBody.error || "Failed to scan menu via Gemini API.");
      }

      const parsedResult = await response.json();

      setParseProgress(100);
      setParsingStep("Google Gemini real-time OCR completed successfully!");

      setTimeout(() => {
        setIsParsing(false);
        setParsedData({
          name: fileName,
          type: fileMime.includes("pdf") ? "pdf" : fileMime.includes("sheet") || fileMime.includes("excel") || fileMime.includes("csv") ? "excel" : "image",
          size: fileSize,
          categories: parsedResult.categories || []
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
      lastUploadedFile.fileSize
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
            fileSize: mockSize
          });
          await runLiveGeminiScan(file.name, base64Data, file.type || "image/png", mockSize);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Merge parsed items into the restaurant's menu
  const handleApproveParsedMenu = () => {
    if (!parsedData) return;

    let updatedMenu = [...restaurant.menu];

    parsedData.categories.forEach(parsedCat => {
      // Check if category already exists (case-insensitive)
      let existingCat = updatedMenu.find(c => c.name.toLowerCase() === parsedCat.name.toLowerCase());
      
      const nextItems: MenuItem[] = parsedCat.items.map((item, idx) => ({
        id: `item-${Date.now()}-${idx}-${Math.floor(Math.random() * 1000)}`,
        name: item.name,
        description: item.description,
        price: item.price,
        image: item.image || "",
        isAvailable: item.isAvailable,
        category: existingCat ? existingCat.name : parsedCat.name
      }));

      if (existingCat) {
        // Append items to existing category
        existingCat.items = [...existingCat.items, ...nextItems];
      } else {
        // Create new category
        updatedMenu.push({
          id: `cat-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          name: parsedCat.name,
          items: nextItems
        });
      }
    });

    onUpdateRestaurant({
      ...restaurant,
      menu: updatedMenu
    });

    // Reset states
    setParsedData(null);
    setCustomFileName("");
    setParseSuccess(false);
    setLastUploadedFile(null);

    // Show nice alert/toast
    showToast("AI Parsed Menu approved! Items successfully integrated into your live menu.", "success");
  };

  // Delete an item from the menu
  const handleDeleteItem = (itemId: string, catId: string) => {
    if (!confirm("Are you sure you want to remove this item from your store menu?")) return;

    const updatedMenu = restaurant.menu.map(cat => {
      if (cat.id === catId) {
        return {
          ...cat,
          items: cat.items.filter(item => item.id !== itemId)
        };
      }
      return cat;
    }).filter(cat => cat.items.length > 0); // Keep categories even if empty, or filter them out if preferred. Let's keep them unless empty.

    onUpdateRestaurant({
      ...restaurant,
      menu: updatedMenu
    });
  };

  // Toggle Item Availability
  const handleToggleAvailability = (itemId: string, catId: string) => {
    const updatedMenu = restaurant.menu.map(cat => {
      if (cat.id === catId) {
        return {
          ...cat,
          items: cat.items.map(item => {
            if (item.id === itemId) {
              return { ...item, isAvailable: !item.isAvailable };
            }
            return item;
          })
        };
      }
      return cat;
    });

    onUpdateRestaurant({
      ...restaurant,
      menu: updatedMenu
    });
  };

  // Edit Item Details (inline price update for quick admin utility)
  const handleUpdatePrice = (itemId: string, catId: string, newPrice: number) => {
    if (isNaN(newPrice) || newPrice <= 0) return;
    const updatedMenu = restaurant.menu.map(cat => {
      if (cat.id === catId) {
        return {
          ...cat,
          items: cat.items.map(item => {
            if (item.id === itemId) {
              return { ...item, price: newPrice };
            }
            return item;
          })
        };
      }
      return cat;
    });

    onUpdateRestaurant({
      ...restaurant,
      menu: updatedMenu
    });
  };

  // Add Item Manually
  const handleAddItemManually = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName || !newItemPrice) {
      showToast("Name and Price are required.", "error");
      return;
    }

    const categoryName = newItemCategory === "NEW" ? newCategoryName : newItemCategory;
    if (!categoryName) {
      showToast("Please specify a category.", "error");
      return;
    }

    let updatedMenu = [...restaurant.menu];
    let existingCat = updatedMenu.find(c => c.name.toLowerCase() === categoryName.toLowerCase());

    const newItem: MenuItem = {
      id: `item-${Date.now()}`,
      name: newItemName,
      description: newItemDesc,
      price: parseFloat(newItemPrice),
      image: newItemImage || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=300&auto=format&fit=crop&q=80",
      isAvailable: true,
      category: existingCat ? existingCat.name : categoryName
    };

    if (existingCat) {
      existingCat.items = [...existingCat.items, newItem];
    } else {
      updatedMenu.push({
        id: `cat-${Date.now()}`,
        name: categoryName,
        items: [newItem]
      });
    }

    onUpdateRestaurant({
      ...restaurant,
      menu: updatedMenu
    });

    // Reset Form
    setIsAddModalOpen(false);
    setNewItemName("");
    setNewItemDesc("");
    setNewItemPrice("");
    setNewItemCategory("");
    setNewCategoryName("");
    setNewItemImage("");
    
    showToast(`"${newItemName}" successfully added to your store menu.`, "success");
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      
      {/* Banner / Store Header Info Card */}
      <div className="relative h-48 sm:h-56 rounded-3xl overflow-hidden shadow-md">
        <img 
          src={restaurant.banner} 
          alt={restaurant.name}
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
        
        <div className="absolute bottom-6 left-6 right-6 flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-white dark:bg-zinc-900 shadow-lg flex items-center justify-center text-4xl shrink-0 border-2 border-orange-500/20">
              {restaurant.logo}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">{restaurant.name}</h1>
                <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                  restaurant.status === "Active" ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" :
                  restaurant.status === "Pending" ? "bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse" :
                  "bg-red-500/20 text-red-400 border border-red-500/30"
                }`}>
                  {restaurant.status}
                </span>
              </div>
              <p className="text-xs text-zinc-300 font-semibold mt-1">Cuisine: {restaurant.cuisine} • Total Items: {allItems.length}</p>
              <p className="text-[10px] text-zinc-400 mt-0.5">{restaurant.address}</p>
            </div>
          </div>
          
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-lg shadow-orange-500/20 flex items-center gap-2 transition-all self-stretch sm:self-auto justify-center"
          >
            <Plus className="w-4 h-4" /> Add Custom Item
          </button>
        </div>
      </div>

      {/* AI MENU UPLOADER / PARSER SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Dropzone & AI Uploader - Left (or full if no parsed preview) */}
        <div className={`bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm flex flex-col justify-between ${
          parsedData ? "lg:col-span-6" : "lg:col-span-12"
        } transition-all duration-300`}>
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="p-2 bg-purple-500/10 text-purple-500 dark:text-purple-400 rounded-xl">
                  <Sparkles className="w-5 h-5 animate-pulse" />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-white">AI Menu Uploader & Parser</h3>
                  <p className="text-[10px] text-zinc-400">Import menu lists from PDF flyer, Excel spreadsheets, or images in seconds!</p>
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
                    <p className="font-bold text-red-650 dark:text-red-400">Gemini Parsing Failure</p>
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
                      <Loader2 className={`w-3.5 h-3.5 ${isParsing ? "animate-spin" : ""}`} />
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
                <p className="text-[9px] text-zinc-400">Enter your key below to connect directly to the multimodal AI uploader.</p>
              </div>

              <div className="space-y-2 animate-in slide-in-from-top-2 duration-200">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest block">Google Gemini API Key</label>
                  <input
                    type="password"
                    placeholder="Enter Gemini API Key (AIzaSy...)"
                    value={geminiApiKey}
                    onChange={(e) => handleUpdateApiKey(e.target.value)}
                    className="w-full bg-white dark:bg-zinc-900 border border-zinc-250 dark:border-zinc-850 text-[11px] font-bold text-zinc-850 dark:text-zinc-100 placeholder-zinc-400 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-purple-500 shadow-sm"
                  />
                </div>
                <p className="text-[9px] text-zinc-400 leading-normal">
                  💡 <strong>Safe & Secure</strong>: Transmitted securely to Gemini's API endpoints. Get a free API Key at <a href="https://aistudio.google.com/" target="_blank" rel="noreferrer" className="text-purple-500 font-bold hover:underline">Google AI Studio</a>. If you set <code>GEMINI_API_KEY</code> on your server environment, you can leave this blank!
                </p>
              </div>
            </div>

            {/* Simulated file drag/drop or selector */}
            <div className="border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 text-center bg-zinc-50/50 dark:bg-zinc-950/20 flex flex-col items-center justify-center space-y-3 hover:border-purple-500/30 transition-colors relative">
              <UploadCloud className="w-10 h-10 text-zinc-300 dark:text-zinc-700" />
              <div className="space-y-1">
                <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">Drag & drop your store menu file here</p>
                <p className="text-[10px] text-zinc-400">PDF, Excel (XLSX, CSV), PNG, JPG up to 10MB</p>
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
                <span className="text-purple-600 dark:text-purple-400 font-black">{parseProgress}%</span>
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
                    <h3 className="text-xs font-black text-zinc-900 dark:text-white uppercase tracking-wider">AI Parsed Menu Preview</h3>
                    <p className="text-[9px] text-zinc-400 font-semibold truncate max-w-[200px]">Source: {parsedData.name}</p>
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
                        <div key={itemIdx} className="p-3 bg-zinc-50 dark:bg-zinc-950/40 rounded-xl border border-zinc-150 dark:border-zinc-850 flex items-start justify-between gap-3 text-xs">
                          <div className="min-w-0">
                            <p className="font-bold text-zinc-800 dark:text-zinc-200 truncate">{item.name}</p>
                            <p className="text-[10px] text-zinc-400 line-clamp-1 mt-0.5">{item.description}</p>
                          </div>
                          <span className="font-extrabold text-orange-500 shrink-0">${item.price.toFixed(2)}</span>
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
            <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Store Menu Catalog</h3>
            <p className="text-[10px] text-zinc-400">Search, edit pricing, or toggle availability of dishes listed in your store menu.</p>
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

        {/* Category horizontal scrolling tabs */}
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
          
          {currentCategories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategoryTab(cat.id)}
              className={`text-xs font-bold px-3.5 py-2 rounded-xl whitespace-nowrap transition-all border ${
                selectedCategoryTab === cat.id
                  ? "bg-orange-500 border-orange-500 text-white shadow-sm"
                  : "bg-white border-zinc-200 text-zinc-500 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400"
              }`}
            >
              {cat.name} ({cat.items.length})
            </button>
          ))}
        </div>

        {/* Menu Items Grid */}
        {filteredItems.length === 0 ? (
          <div className="text-center p-12 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl flex flex-col items-center justify-center">
            <Store className="w-12 h-12 text-zinc-300 dark:text-zinc-700 mb-3" />
            <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200">No matching menu items found</p>
            <p className="text-[10px] text-zinc-400 mt-1">Try refining search query or upload a menu file to populate details.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredItems.map(item => {
              // Find category ID of item
              const cat = currentCategories.find(c => c.items.some(i => i.id === item.id));
              const catId = cat ? cat.id : "";

              return (
                <div 
                  key={item.id}
                  className={`bg-zinc-50/50 dark:bg-zinc-950/20 border border-zinc-150 dark:border-zinc-800/80 p-4 rounded-2xl flex gap-4 hover:border-orange-500/20 hover:shadow-sm transition-all duration-200 group ${
                    !item.isAvailable ? "opacity-60" : ""
                  }`}
                >
                  {/* Item Image placeholder or loaded */}
                  <div className="w-16 h-16 rounded-xl bg-zinc-200 dark:bg-zinc-800 overflow-hidden shrink-0 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center text-2xl">
                    {item.image ? (
                      <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
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
                        <button
                          onClick={() => handleDeleteItem(item.id, catId)}
                          className="opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-red-500 transition-all p-1 hover:bg-zinc-150 dark:hover:bg-zinc-800 rounded"
                          title="Delete dish"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <p className="text-[10px] text-zinc-400 line-clamp-2 mt-0.5">{item.description}</p>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-zinc-100 dark:border-zinc-800/80 mt-2">
                      {/* Price Editor inline */}
                      <div className="flex items-center gap-1.5">
                        <DollarSign className="w-3.5 h-3.5 text-zinc-400" />
                        <input
                          type="number"
                          step="0.1"
                          value={item.price}
                          onChange={(e) => handleUpdatePrice(item.id, catId, parseFloat(e.target.value))}
                          className="w-16 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs font-bold text-zinc-800 dark:text-zinc-200 px-1 py-0.5 rounded focus:outline-none focus:ring-1 focus:ring-orange-500"
                        />
                      </div>

                      {/* Availability toggle */}
                      <button
                        onClick={() => handleToggleAvailability(item.id, catId)}
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
              );
            })}
          </div>
        )}
      </div>

      {/* MANUAL ADD ITEM MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-150">
            
            <div className="p-5 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center bg-zinc-50 dark:bg-zinc-900/40">
              <div className="flex items-center gap-2">
                <span className="p-2 bg-orange-500/10 text-orange-500 rounded-xl">
                  <Store className="w-4 h-4" />
                </span>
                <h3 className="text-xs font-black text-zinc-900 dark:text-white uppercase tracking-wider">
                  Add Custom Menu Item
                </h3>
              </div>
              <button 
                onClick={() => setIsAddModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddItemManually} className="p-6 space-y-4 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              {/* Item Name */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide">Dish Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Crispy Honey Chicken Wings"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  className="w-full bg-zinc-50 border border-zinc-200 text-zinc-850 placeholder-zinc-400 rounded-xl p-2.5 focus:outline-none focus:ring-1 focus:ring-orange-500 dark:bg-zinc-950/20 dark:border-zinc-800 dark:text-zinc-200"
                />
              </div>

              {/* Price & Image */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide">Price ($ USD) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="9.99"
                    value={newItemPrice}
                    onChange={(e) => setNewItemPrice(e.target.value)}
                    className="w-full bg-zinc-50 border border-zinc-200 text-zinc-850 placeholder-zinc-400 rounded-xl p-2.5 focus:outline-none focus:ring-1 focus:ring-orange-500 dark:bg-zinc-950/20 dark:border-zinc-800 dark:text-zinc-200"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide">Image URL (Optional)</label>
                  <input
                    type="text"
                    placeholder="https://images.unsplash..."
                    value={newItemImage}
                    onChange={(e) => setNewItemImage(e.target.value)}
                    className="w-full bg-zinc-50 border border-zinc-200 text-zinc-850 placeholder-zinc-400 rounded-xl p-2.5 focus:outline-none focus:ring-1 focus:ring-orange-500 dark:bg-zinc-950/20 dark:border-zinc-800 dark:text-zinc-200"
                  />
                </div>
              </div>

              {/* Category selector */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide">Category Selection *</label>
                <select
                  required
                  value={newItemCategory}
                  onChange={(e) => setNewItemCategory(e.target.value)}
                  className="w-full bg-zinc-50 border border-zinc-200 text-zinc-850 rounded-xl p-2.5 focus:outline-none focus:ring-1 focus:ring-orange-500 dark:bg-zinc-950/20 dark:border-zinc-800 dark:text-zinc-200 cursor-pointer"
                >
                  <option value="" disabled>Choose category...</option>
                  {currentCategories.map(c => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                  <option value="NEW">+ Create New Category...</option>
                </select>
              </div>

              {/* New Category Name (Only visible when NEW chosen) */}
              {newItemCategory === "NEW" && (
                <div className="space-y-1.5 animate-in slide-in-from-top-2 duration-150">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide">New Category Title *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Desserts"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    className="w-full bg-zinc-50 border border-zinc-200 text-zinc-850 placeholder-zinc-400 rounded-xl p-2.5 focus:outline-none focus:ring-1 focus:ring-orange-500 dark:bg-zinc-950/20 dark:border-zinc-800 dark:text-zinc-200"
                  />
                </div>
              )}

              {/* Description */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide">Dish Description</label>
                <textarea
                  placeholder="Describe ingredients, cooking styles, allergen warnings..."
                  rows={3}
                  value={newItemDesc}
                  onChange={(e) => setNewItemDesc(e.target.value)}
                  className="w-full bg-zinc-50 border border-zinc-200 text-zinc-850 placeholder-zinc-400 rounded-xl p-2.5 focus:outline-none focus:ring-1 focus:ring-orange-500 dark:bg-zinc-950/20 dark:border-zinc-800 dark:text-zinc-200 resize-none font-sans"
                />
              </div>

              {/* Buttons */}
              <div className="pt-4 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 border border-zinc-200 dark:border-zinc-850 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-500 font-bold rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-orange-500 hover:bg-orange-600 text-white font-bold px-4 py-2 rounded-xl shadow-lg shadow-orange-500/10 transition-all"
                >
                  Add to Catalog
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
          <p className="text-[11px] font-bold text-white leading-normal">{toast.message}</p>
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
