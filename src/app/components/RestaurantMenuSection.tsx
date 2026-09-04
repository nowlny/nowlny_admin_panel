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
import toast from "react-hot-toast";
import { RestaurantResponse } from "../../services/restaurants";
import { menuService, MenuSection, MenuItem as ApiMenuItem } from "../../services/menu";
import { formatAddress, formatMoney } from "../../lib/format";
import MenuSectionEditorModal from "./MenuSectionEditorModal";
import MenuItemEditorModal from "./MenuItemEditorModal";
import { useConfirm } from "./ui/ConfirmDialog";
import { EmptyState, ErrorBanner, ErrorState, Skeleton } from "./ui/States";

import { useI18n } from "../../lib/i18n";
import {
  type AiProvider,
  maxUploadMb,
  readErrorMessage,
} from "../../lib/httpErrors";
import {
  DIRECT_UPLOAD_OVER_BYTES,
  DirectUploadError,
  uploadMenuFileToClaude,
} from "../../lib/claudeDirectUpload";
interface RestaurantMenuSectionProps {
  /** The live API record, not the retired localStorage `Restaurant` fixture. */
  restaurant: RestaurantResponse;
}

/**
 * A menu can be scanned from an uploaded file or from a link to the
 * restaurant's own menu page — kept as one value so "retry" works for both.
 */
type ScanSource =
  | { kind: "file"; name: string; base64Data: string; fileMime: string; fileSize: string }
  // Uploaded straight to Claude because it was past what the server's host
  // accepts in one request body; only the id travels to /api/parse-menu.
  | { kind: "claude-file"; name: string; fileId: string; fileSize: string }
  | { kind: "link"; url: string };

interface ParsedMenuData {
  name: string;
  type: "pdf" | "excel" | "image";
  size: string;
  /**
   * ISO code of the language the scanner found in the file. The import keeps
   * that language as-is — an Arabic menu imports as Arabic, an English one as
   * English — so this is shown, not chosen.
   */
  language?: string;
  categories: {
    name: string;
    items: {
      name: string;
      description?: string;
      price: number;
      image?: string;
      /** English search phrase the scanner wrote for the photo lookup. */
      imageQuery?: string;
      /** Which library the photo came from, once one has been found. */
      imageSource?: string;
      isAvailable: boolean;
    }[];
  }[];
}

export default function RestaurantMenuSection({
  restaurant,
}: RestaurantMenuSectionProps) {
  const { t } = useI18n();
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

  // Which scanner runs. Gemini's free tier allows 20 requests a day, which one
  // afternoon of onboarding exhausts, so the operator can point the scanner at
  // a Claude key instead without touching the server.
  const [aiProvider, setAiProvider] = useState<AiProvider>(() => {
    if (typeof window === "undefined") return "gemini";
    return window.localStorage.getItem("nowlny_ai_provider") === "claude"
      ? "claude"
      : "gemini";
  });

  const handleUpdateProvider = (next: AiProvider) => {
    setAiProvider(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("nowlny_ai_provider", next);
    }
  };

  const [claudeApiKey, setClaudeApiKey] = useState(() => {
    if (typeof window !== "undefined") {
      return window.localStorage.getItem("nowlny_claude_key") || "";
    }
    return "";
  });

  const handleUpdateClaudeKey = (key: string) => {
    setClaudeApiKey(key);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("nowlny_claude_key", key);
    }
  };

  // Dishes the uploaded menu has no picture for get one looked up online.
  const [autoFindImages, setAutoFindImages] = useState(() => {
    if (typeof window === "undefined") return true;
    return window.localStorage.getItem("nowlny_menu_autoimages") !== "off";
  });

  const handleToggleAutoImages = (enabled: boolean) => {
    setAutoFindImages(enabled);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("nowlny_menu_autoimages", enabled ? "on" : "off");
    }
  };

  // Parsing tool states
  const [customFileName, setCustomFileName] = useState<string>("");
  const [menuUrl, setMenuUrl] = useState("");
  const [isParsing, setIsParsing] = useState(false);
  const [parsingStep, setParsingStep] = useState<string>("");
  const [parseProgress, setParseProgress] = useState(0);
  const [parsedData, setParsedData] = useState<ParsedMenuData | null>(null);
  const [parseSuccess, setParseSuccess] = useState(false);
  const [isFindingImages, setIsFindingImages] = useState(false);
  const [imagesError, setImagesError] = useState<string | null>(null);
  /**
   * Photo lookup finishes after the preview is already on screen, so a result
   * from a previous file must not be written over a newer scan's dishes.
   */
  const scanToken = React.useRef(0);

  // Custom states for premium error handling and Toast notifications
  const [parsingError, setParsingError] = useState<string | null>(null);
  const [lastScanSource, setLastScanSource] = useState<ScanSource | null>(null);
  const confirm = useConfirm();

  // --- API DATA STATES ---
  const [sections, setSections] = useState<MenuSection[]>([]);
  const [itemsBySection, setItemsBySection] = useState<Record<string, ApiMenuItem[]>>({});
  const [isLoadingMenu, setIsLoadingMenu] = useState(true);
  // Only the *first* fetch shows skeletons; later refreshes keep the list on
  // screen behind the spinner in the catalog header.
  const [hasLoadedMenu, setHasLoadedMenu] = useState(false);
  // A failed fetch used to fall back to `[]`, which rendered the "your menu is
  // empty" CTA — an outage looked exactly like a brand new store.
  const [menuError, setMenuError] = useState<string | null>(null);
  const [itemsError, setItemsError] = useState<string | null>(null);

  // Inline price editing (controlled — see handlePriceBlur).
  const [priceDrafts, setPriceDrafts] = useState<Record<string, string>>({});
  const [priceErrors, setPriceErrors] = useState<Record<string, string>>({});

  // Integration / row-level mutation guards
  const [isIntegrating, setIsIntegrating] = useState(false);
  const [integrationProgress, setIntegrationProgress] = useState({ done: 0, total: 0 });
  const [pendingItemId, setPendingItemId] = useState<string | null>(null);
  const [pendingSectionId, setPendingSectionId] = useState<string | null>(null);

  const loadMenu = async () => {
    setIsLoadingMenu(true);
    setMenuError(null);
    setItemsError(null);
    try {
      const loadedSections = (await menuService.getSectionsByRestaurant(restaurant.id)) || [];
      setSections(loadedSections);

      const itemsMap: Record<string, ApiMenuItem[]> = {};
      let failedSections = 0;

      // Load items for each section in parallel
      await Promise.all(
        loadedSections.map(async (sec) => {
          try {
            itemsMap[sec.id] = (await menuService.getItemsBySection(sec.id)) || [];
          } catch {
            // Keep the rest of the menu usable, but say so rather than
            // rendering the section as genuinely empty.
            itemsMap[sec.id] = [];
            failedSections += 1;
          }
        })
      );

      setItemsBySection(itemsMap);
      // Drop any inline price edits that are now stale.
      setPriceDrafts({});
      setPriceErrors({});

      if (failedSections > 0) {
        setItemsError(
          `Couldn't load the dishes for ${failedSections} section${failedSections > 1 ? "s" : ""}. They may look empty below.`,
        );
      }
    } catch (err: any) {
      setSections([]);
      setItemsBySection({});
      setMenuError(err?.message || t("rmenu.load_failed"));
    } finally {
      setIsLoadingMenu(false);
      setHasLoadedMenu(true);
    }
  };

  useEffect(() => {
    if (restaurant?.id) {
      setHasLoadedMenu(false); // a different store starts from skeletons again
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

  // Flattened preview items — the photo counter and the lookup share this order.
  const parsedItems = parsedData?.categories.flatMap((cat) => cat.items) ?? [];
  const parsedItemsWithImage = parsedItems.filter((item) => Boolean(item.image)).length;

  /** Which language the scanner found in the file, and therefore imported in. */
  const detectedLanguageLabel = (code?: string) => {
    if (!code) return null;
    if (code.startsWith("ar")) return t("rmenu.lang_ar");
    if (code.startsWith("en")) return t("rmenu.lang_en");
    return code.toUpperCase();
  };

  /**
   * Fill in a stock photo for every parsed dish that arrived without one.
   *
   * Deliberately a second request, fired once the preview is already visible:
   * the operator reads the extracted dishes straight away and the pictures
   * drop in behind them, instead of the scan looking stuck while a handful of
   * photo libraries are queried.
   */
  const findMenuImages = async (data: ParsedMenuData, token: number) => {
    // `null` holds the slot of an item that already has a picture, so the
    // response stays aligned with the flattened item order below.
    const queries = data.categories.flatMap((cat) =>
      cat.items.map((item) => (item.image ? null : item.imageQuery || item.name)),
    );
    if (queries.every((query) => query === null)) return;

    setIsFindingImages(true);
    setImagesError(null);

    try {
      const authToken =
        typeof window !== "undefined" ? localStorage.getItem("token") : null;

      const response = await fetch("/api/menu-images", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({ queries }),
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response, t("rmenu.images_failed")));
      }

      const { images } = await response.json();
      if (scanToken.current !== token) return; // a newer scan owns the preview now

      setParsedData((prev) => {
        if (!prev) return prev;
        let cursor = 0;
        return {
          ...prev,
          categories: prev.categories.map((cat) => ({
            ...cat,
            items: cat.items.map((item) => {
              const found = images?.[cursor++];
              if (item.image || !found?.url) return item;
              return { ...item, image: found.url, imageSource: found.source };
            }),
          })),
        };
      });
    } catch (err: any) {
      if (scanToken.current !== token) return;
      // Non-fatal: the dishes still import, just without pictures.
      setImagesError(err?.message || t("rmenu.images_failed"));
    } finally {
      if (scanToken.current === token) setIsFindingImages(false);
    }
  };

  const handleFindImagesNow = () => {
    if (parsedData && !isFindingImages) {
      void findMenuImages(parsedData, scanToken.current);
    }
  };

  // Real Google Gemini 1.5 Flash API scanner
  const runLiveGeminiScan = async (source: ScanSource) => {
    // Invalidates any photo lookup still in flight for the previous file.
    scanToken.current += 1;
    const token = scanToken.current;

    setLastScanSource(source);
    setIsParsing(true);
    setParseProgress(10);
    setParsingStep(
      source.kind === "link"
        ? t("rmenu.step_fetching_link")
        : "Establishing bridge connection to Gemini AI...",
    );
    setParsedData(null);
    setParseSuccess(false);
    setParsingError(null);
    setIsFindingImages(false);
    setImagesError(null);

    // Dynamic scanning progress steps simulator
    let currentProgress = 10;
    const progressInterval = setInterval(() => {
      if (currentProgress < 95) {
        currentProgress += Math.floor(Math.random() * 5) + 2;
        setParseProgress(Math.min(95, currentProgress));

        if (currentProgress > 25 && currentProgress <= 45) {
          setParsingStep(
            source.kind === "link"
              ? t("rmenu.step_fetching_link")
              : "Multimodal vision model parsing files...",
          );
        } else if (currentProgress > 45 && currentProgress <= 70) {
          setParsingStep(
            source.kind === "link"
              ? t("rmenu.step_reading_page")
              : "Running Google Gemini 1.5 Flash OCR on text grids...",
          );
        } else if (currentProgress > 70) {
          setParsingStep(
            "Structuring extracted dishes into dynamic JSON schemas...",
          );
        }
      }
    }, 300);

    try {
      // /api/parse-menu falls back to the server's GEMINI_API_KEY, so the
      // route now requires a bearer token to stop it being an open proxy.
      const authToken =
        typeof window !== "undefined" ? localStorage.getItem("token") : null;

      const response = await fetch("/api/parse-menu", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({
          provider: aiProvider,
          customApiKey: geminiApiKey,
          claudeApiKey,
          ...(source.kind === "link"
            ? { url: source.url }
            : source.kind === "claude-file"
              ? { claudeFileId: source.fileId }
              : {
                  fileData: source.base64Data,
                  mimeType: source.fileMime,
                }),
        }),
      });

      clearInterval(progressInterval);

      if (!response.ok) {
        throw new Error(
          await readErrorMessage(response, "Failed to scan menu via Gemini API."),
        );
      }

      const parsedResult = await response.json();

      setParseProgress(100);
      setParsingStep("Google Gemini real-time OCR completed successfully!");

      setTimeout(() => {
        setIsParsing(false);
        const scanned: ParsedMenuData = {
          // Platform imports name themselves ("Foron Mallah"); a scanned page
          // has nothing better to show than the link.
          name:
            source.kind === "link"
              ? parsedResult.label || source.url
              : source.name,
          type:
            source.kind === "link" ||
            source.kind === "claude-file" ||
            source.fileMime.includes("pdf")
              ? "pdf"
              : source.fileMime.includes("sheet") ||
                  source.fileMime.includes("excel") ||
                  source.fileMime.includes("csv")
                ? "excel"
                : "image",
          size: source.kind === "link" ? "" : source.fileSize,
          language: parsedResult.language,
          categories: parsedResult.categories || [],
        };
        setParsedData(scanned);
        setParseSuccess(true);
        toast.success(t("rmenu.parsed_ok"));

        if (autoFindImages) void findMenuImages(scanned, token);
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
      toast.error(t("rmenu.parse_failed"));
    }
  };

  const handleRetryScan = async () => {
    if (!lastScanSource) return;
    await runLiveGeminiScan(lastScanSource);
  };

  /**
   * Scan the restaurant's own menu page. The link is fetched server-side —
   * the browser can't read another site's HTML — and photos found on the page
   * are carried through onto the matching dishes.
   */
  const handleScanLink = async () => {
    const url = menuUrl.trim();
    if (!url || isParsing) return;

    if (!/^https?:\/\/\S+\.\S+/i.test(url)) {
      setParsingError(t("rmenu.link_invalid"));
      return;
    }

    setCustomFileName("");
    setParsingError(null);
    await runLiveGeminiScan({ kind: "link", url });
  };

  // Custom File Uploader
  const handleCustomFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const sizeMb = file.size / (1024 * 1024);
      const mockSize = sizeMb.toFixed(1) + " MB";

      setCustomFileName(file.name);
      setParsingError(null);

      // Only files the selected scanner could never accept are refused here;
      // anything smaller is attempted, and a host that says no answers with a
      // 413 we explain. Claude takes more than Gemini, so the ceiling moves
      // with the picker rather than being one number for both.
      const limitMb = maxUploadMb(aiProvider);
      if (sizeMb > limitMb) {
        setParsingError(
          t(
            aiProvider === "gemini"
              ? "rmenu.file_too_large_gemini"
              : "rmenu.file_too_large",
            { size: sizeMb.toFixed(1), limit: String(limitMb) },
          ),
        );
        e.target.value = "";
        return;
      }

      /*
       * Big files never go through our own server.
       *
       * The admin runs on Vercel, whose functions refuse a request body over
       * 4.5 MB at the infrastructure level — no server-side setting can lift
       * it. Claude's Files API takes the upload directly instead, and the scan
       * request then carries nothing but the id.
       */
      if (aiProvider === "claude" && file.size > DIRECT_UPLOAD_OVER_BYTES) {
        setMenuUrl("");
        void (async () => {
          setIsParsing(true);
          setParsingStep(t("rmenu.step_uploading"));
          try {
            const fileId = await uploadMenuFileToClaude(file, claudeApiKey);
            await runLiveGeminiScan({
              kind: "claude-file",
              name: file.name,
              fileId,
              fileSize: mockSize,
            });
          } catch (error) {
            // `runLiveGeminiScan` owns these once it starts; reaching here
            // means it never did.
            setIsParsing(false);
            setParsingStep("");
            setParsingError(
              error instanceof DirectUploadError
                ? error.message
                : t("rmenu.upload_failed"),
            );
          }
        })();
        e.target.value = "";
        return;
      }

      const reader = new FileReader();
      reader.onload = async () => {
        if (reader.result) {
          const base64Data = (reader.result as string).split(",")[1];
          setMenuUrl("");
          await runLiveGeminiScan({
            kind: "file",
            name: file.name,
            base64Data,
            fileMime: file.type || "image/png",
            fileSize: mockSize,
          });
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Merge parsed items into the restaurant's menu using API
  const handleApproveParsedMenu = async () => {
    // The button is disabled while this runs, but re-entrancy would duplicate
    // every create call in the loop below, so guard here too.
    if (!parsedData || isIntegrating) return;

    const totalSteps = parsedData.categories.reduce(
      (steps, cat) => steps + 1 + cat.items.length,
      0,
    );
    setIntegrationProgress({ done: 0, total: totalSteps });
    setIsIntegrating(true);
    const step = () => setIntegrationProgress((p) => ({ ...p, done: p.done + 1 }));

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

        step();

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
          step();
        }
      }

      await loadMenu(); // Reload all menu data

      // Reset states
      setParsedData(null);
      setCustomFileName("");
      setMenuUrl("");
      setParseSuccess(false);
      setLastScanSource(null);

      toast.success(t("rmenu.approved"));
    } catch (err: any) {
      toast.error(err?.message || t("rmenu.integrate_failed"));
    } finally {
      setIsIntegrating(false);
    }
  };

  /** Patch one item in local state without refetching the whole menu. */
  const patchItem = (item: ApiMenuItem, patch: Partial<ApiMenuItem>) => {
    setItemsBySection((prev) => ({
      ...prev,
      [item.sectionId]: (prev[item.sectionId] || []).map((i) =>
        i.id === item.id ? { ...i, ...patch } : i,
      ),
    }));
  };

  // Delete an item from the menu via API
  const handleDeleteItem = async (item: ApiMenuItem) => {
    const confirmed = await confirm({
      title: `Delete “${item.name}”?`,
      description: t("rmenu.delete_dish_body"),
      confirmLabel: t("rmenu.delete_dish_cta"),
      variant: "danger",
    });
    if (!confirmed) return;

    setPendingItemId(item.id);
    try {
      await menuService.deleteItem(item.id);
      await loadMenu();
      toast.success(`“${item.name}” deleted.`);
    } catch (err: any) {
      toast.error(err?.message || t("rmenu.delete_item_failed"));
    } finally {
      setPendingItemId(null);
    }
  };

  /**
   * Toggle availability optimistically. This used to call loadMenu(), which
   * refetches every section plus one request per section and remounts the list
   * (losing scroll position) just to flip one boolean.
   */
  const handleToggleAvailability = async (item: ApiMenuItem) => {
    const next = !item.isAvailable;
    patchItem(item, { isAvailable: next });
    try {
      await menuService.updateItem(item.id, { isAvailable: next });
      toast.success(next ? `“${item.name}” is available again.` : `“${item.name}” snoozed.`);
    } catch (err: any) {
      patchItem(item, { isAvailable: !next }); // roll back
      toast.error(err?.message || t("rmenu.toggle_failed"));
    }
  };

  // Inline price editor -------------------------------------------------
  const priceValue = (item: ApiMenuItem) =>
    priceDrafts[item.id] ?? String(item.price ?? "");

  const handlePriceChange = (item: ApiMenuItem, value: string) => {
    setPriceDrafts((prev) => ({ ...prev, [item.id]: value }));
    setPriceErrors((prev) => {
      if (!prev[item.id]) return prev;
      const next = { ...prev };
      delete next[item.id];
      return next;
    });
  };

  const clearPriceDraft = (itemId: string) =>
    setPriceDrafts((prev) => {
      const next = { ...prev };
      delete next[itemId];
      return next;
    });

  /**
   * The editor used to be uncontrolled (`defaultValue` + onBlur): clearing it
   * or typing text produced NaN, `handleUpdatePrice` returned silently, and the
   * invalid text stayed on screen — so the merchant believed the price saved.
   */
  const handlePriceBlur = async (item: ApiMenuItem) => {
    const draft = priceDrafts[item.id];
    if (draft === undefined) return; // untouched

    const parsed = parseFloat(draft);
    if (draft.trim() === "" || !Number.isFinite(parsed) || parsed <= 0) {
      clearPriceDraft(item.id); // revert to the stored price
      setPriceErrors((prev) => ({
        ...prev,
        [item.id]: t("rmenu.price_invalid"),
      }));
      toast.error(`“${item.name}”: price must be a number above 0. Reverted.`);
      return;
    }

    clearPriceDraft(item.id);
    if (parsed === item.price) return;

    const previousPrice = item.price;
    patchItem(item, { price: parsed }); // optimistic
    try {
      await menuService.updateItem(item.id, { price: parsed });
      toast.success(
        `“${item.name}” priced at ${formatMoney(parsed, restaurant.currency?.code)}.`,
      );
    } catch (err: any) {
      patchItem(item, { price: previousPrice }); // roll back
      toast.error(err?.message || t("rmenu.price_failed"));
    }
  };

  const handleDeleteSection = async (section: MenuSection) => {
    const itemCount = itemsBySection[section.id]?.length ?? 0;
    const confirmed = await confirm({
      title: `Delete the “${section.name}” category?`,
      description:
        itemCount > 0
          ? `${itemCount} dish${itemCount > 1 ? "es" : ""} inside this category will be permanently deleted with it.`
          : t("rmenu.empty_category_body"),
      confirmLabel: t("rmenu.delete_category_cta"),
      variant: "danger",
      ...(itemCount > 0 ? { confirmPhrase: section.name } : {}),
    });
    if (!confirmed) return;

    setPendingSectionId(section.id);
    try {
      await menuService.deleteSection(section.id);
      if (selectedCategoryTab === section.id) setSelectedCategoryTab("all");
      await loadMenu();
      toast.success(`“${section.name}” deleted.`);
    } catch (err: any) {
      toast.error(err?.message || t("rmenu.delete_category_failed"));
    } finally {
      setPendingSectionId(null);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Banner / Store Header Info Card */}
      <div className="relative h-48 sm:h-56 rounded-3xl overflow-hidden shadow-md">
        {restaurant.backgroundImageUrl ? (
          <img
            src={restaurant.backgroundImageUrl}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-zinc-800" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />

        <div className="absolute bottom-6 start-6 end-6 flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4">
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
                    restaurant.status === "active"
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                      : restaurant.status === "pending"
                        ? "bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse"
                        : "bg-red-500/20 text-red-400 border border-red-500/30"
                  }`}
                >
                  {restaurant.status ?? "unknown"}
                </span>
              </div>
              <p className="text-xs text-zinc-300 font-semibold mt-1">
                {restaurant.categories?.map((c) => c.name).join(", ") ||
t("rmenu.no_categories")}{" "}
                • {allItems.length} item{allItems.length === 1 ? "" : "s"}
              </p>
              <p className="text-[10px] text-zinc-400 mt-0.5">
                {formatAddress(restaurant.restaurantAddress) ||
                  t("rmenu.no_address")}
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
            <Plus className="w-4 h-4" /> {t("rmenu.add_item")}
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
                    {t("rmenu.uploader")}
                  </h3>
                  <p className="text-[10px] text-zinc-400">
                    Import menu lists from PDF flyer, Excel spreadsheets, or
                    images in seconds!
                  </p>
                </div>
              </div>

              <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 bg-purple-500/10 text-purple-600 rounded border border-purple-500/10 animate-pulse">
                {t("rmenu.powered_by")}
              </span>
            </div>

            {/* Error Notification Panel */}
            {parsingError && (
              <div className="p-4 rounded-2xl bg-red-500/5 dark:bg-red-950/10 border border-red-500/20 space-y-3 text-xs animate-in slide-in-from-top-2 duration-200">
                <div className="flex items-start gap-2.5 text-red-500 dark:text-red-400">
                  <AlertCircle className="w-4.5 h-4.5 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-bold text-red-650 dark:text-red-400">
                      {t("rmenu.parse_failure")}
                    </p>
                    <p className="text-[11px] text-zinc-650 dark:text-zinc-300 leading-normal font-medium">
                      {parsingError}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 pt-1">
                  {lastScanSource && (
                    <button
                      onClick={handleRetryScan}
                      disabled={isParsing}
                      className="bg-red-500 hover:bg-red-650 disabled:opacity-50 text-white font-bold text-[10px] px-3.5 py-2 rounded-xl shadow-md shadow-red-500/10 flex items-center gap-1.5 transition-all"
                    >
                      <Loader2
                        className={`w-3.5 h-3.5 ${isParsing ? "animate-spin" : ""}`}
                      />
                      {t("rmenu.retry_scan")}
                    </button>
                  )}
                  <button
                    onClick={() => setParsingError(null)}
                    className="border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-850 text-zinc-500 font-bold text-[10px] px-3.5 py-2 rounded-xl transition-all"
                  >
                    {t("rmenu.dismiss")}
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
                  <span className="text-[9px] font-black text-zinc-500 dark:text-zinc-400 uppercase tracking-widest block">
                    {t("rmenu.provider_label")}
                  </span>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(["gemini", "claude"] as const).map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => handleUpdateProvider(option)}
                        aria-pressed={aiProvider === option}
                        className={`px-3 py-2 rounded-xl text-[10px] font-black transition-colors border ${
                          aiProvider === option
                            ? "bg-purple-600 border-purple-600 text-white shadow-sm"
                            : "bg-white dark:bg-zinc-900 border-zinc-250 dark:border-zinc-850 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                        }`}
                      >
                        {t(
                          option === "gemini"
                            ? "rmenu.provider_gemini"
                            : "rmenu.provider_claude",
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {aiProvider === "gemini" ? (
                  <>
                    <div className="space-y-1">
                      <label
                        htmlFor="gemini-api-key"
                        className="text-[9px] font-black text-zinc-500 dark:text-zinc-400 uppercase tracking-widest block"
                      >
                        {t("rmenu.api_key_label")}
                      </label>
                      <input
                        id="gemini-api-key"
                        type="password"
                        placeholder={t("rmenu.api_key_placeholder")}
                        value={geminiApiKey}
                        onChange={(e) => handleUpdateApiKey(e.target.value)}
                        className="w-full bg-white dark:bg-zinc-900 border border-zinc-250 dark:border-zinc-850 text-[11px] font-bold text-zinc-850 dark:text-zinc-100 placeholder-zinc-400 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-purple-500 shadow-sm"
                      />
                    </div>
                    <p className="text-[9px] text-zinc-400 leading-normal">
                      💡 <strong>{t("rmenu.safe_secure")}</strong>: Transmitted securely to
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
                  </>
                ) : (
                  <>
                    <div className="space-y-1">
                      <label
                        htmlFor="claude-api-key"
                        className="text-[9px] font-black text-zinc-500 dark:text-zinc-400 uppercase tracking-widest block"
                      >
                        {t("rmenu.claude_key_label")}
                      </label>
                      <input
                        id="claude-api-key"
                        type="password"
                        placeholder={t("rmenu.claude_key_placeholder")}
                        value={claudeApiKey}
                        onChange={(e) => handleUpdateClaudeKey(e.target.value)}
                        className="w-full bg-white dark:bg-zinc-900 border border-zinc-250 dark:border-zinc-850 text-[11px] font-bold text-zinc-850 dark:text-zinc-100 placeholder-zinc-400 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-purple-500 shadow-sm"
                      />
                    </div>
                    <p className="text-[9px] text-zinc-400 leading-normal">
                      💡 <strong>{t("rmenu.safe_secure")}</strong>: {t("rmenu.claude_key_hint")}{" "}
                      <a
                        href="https://console.anthropic.com/settings/keys"
                        target="_blank"
                        rel="noreferrer"
                        className="text-purple-500 font-bold hover:underline"
                      >
                        Anthropic Console
                      </a>
                      . <code>ANTHROPIC_API_KEY</code> {t("rmenu.server_key_note")}
                    </p>
                  </>
                )}

                <label className="flex items-start gap-2 pt-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoFindImages}
                    onChange={(e) => handleToggleAutoImages(e.target.checked)}
                    className="mt-0.5 accent-purple-600"
                  />
                  <span>
                    <span className="text-[10px] font-black text-zinc-700 dark:text-zinc-200 flex items-center gap-1.5">
                      <ImageIcon className="w-3 h-3" />
                      {t("rmenu.auto_images")}
                    </span>
                    <span className="block text-[9px] text-zinc-400 leading-normal mt-0.5">
                      {t("rmenu.auto_images_hint")}
                    </span>
                  </span>
                </label>
              </div>
            </div>

            {/* Simulated file drag/drop or selector */}
            <div className="border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 text-center bg-zinc-50/50 dark:bg-zinc-950/20 flex flex-col items-center justify-center space-y-3 hover:border-purple-500/30 transition-colors relative">
              <UploadCloud className="w-10 h-10 text-zinc-300 dark:text-zinc-700" />
              <div className="space-y-1">
                <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                  {t("rmenu.drag_drop")}
                </p>
                <p className="text-[10px] text-zinc-400">
                  {t("rmenu.file_types", { limit: String(maxUploadMb(aiProvider)) })}
                </p>
              </div>

              <label className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/80 text-zinc-700 dark:text-zinc-300 font-bold text-[10px] px-3 py-2 rounded-lg cursor-pointer transition-all shadow-sm">
                {t("rmenu.browse")}
                <input
                  type="file"
                  accept=".pdf, .xlsx, .xls, .csv, .png, .jpg, .jpeg, .webp"
                  onChange={handleCustomFileUpload}
                  className="hidden"
                />
              </label>
            </div>

            {/* Menu link — fetched on the server, since the browser can't read
                another site's page. */}
            <div className="space-y-1.5">
              <label
                htmlFor="menu-url"
                className="text-[9px] font-black text-zinc-500 dark:text-zinc-400 uppercase tracking-widest block"
              >
                {t("rmenu.link_label")}
              </label>

              <div className="flex items-center gap-2">
                <input
                  id="menu-url"
                  type="url"
                  inputMode="url"
                  dir="ltr"
                  placeholder={t("rmenu.link_placeholder")}
                  value={menuUrl}
                  onChange={(e) => setMenuUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void handleScanLink();
                    }
                  }}
                  disabled={isParsing}
                  className="flex-1 min-w-0 bg-white dark:bg-zinc-900 border border-zinc-250 dark:border-zinc-850 text-[11px] font-bold text-zinc-850 dark:text-zinc-100 placeholder-zinc-400 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-purple-500 disabled:opacity-50 shadow-sm"
                />

                <button
                  type="button"
                  onClick={handleScanLink}
                  disabled={isParsing || !menuUrl.trim()}
                  className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-[10px] px-3.5 py-2.5 rounded-xl shadow-md shadow-purple-500/20 flex items-center gap-1.5 shrink-0 transition-all"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  {t("rmenu.scan_link")}
                </button>
              </div>

              <p className="text-[9px] text-zinc-400 leading-normal">
                {t("rmenu.link_hint")}
              </p>
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
          <div className="lg:col-span-6 bg-white dark:bg-zinc-900 border border-purple-500/20 dark:border-purple-500/10 rounded-3xl p-6 shadow-md flex flex-col justify-between max-h-[460px] animate-in slide-in-from-end-4 duration-300">
            <div className="space-y-4 overflow-hidden flex flex-col flex-1">
              <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
                <div className="flex items-center gap-2">
                  <span className="p-2 bg-emerald-500/10 text-emerald-500 rounded-xl">
                    <Check className="w-4 h-4" />
                  </span>
                  <div>
                    <h3 className="text-xs font-black text-zinc-900 dark:text-white uppercase tracking-wider">
                      {t("rmenu.preview")}
                    </h3>
                    <p className="text-[9px] text-zinc-500 dark:text-zinc-400 font-semibold truncate max-w-[200px]">
                      Source: {parsedData.name}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1 shrink-0">
                  {/* Item count is real; the old "Confidence: 98%" was a literal
                      that /api/parse-menu never returns. */}
                  <p className="text-[10px] font-black text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/15">
                    {parsedItems.length} dishes found
                  </p>

                  {/* Nothing is translated on import — this says which language
                      the dishes below (and the live menu) will be in. */}
                  {parsedData.language && (
                    <p
                      title={t("rmenu.lang_kept")}
                      className="text-[9px] font-black text-purple-500 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/15"
                    >
                      {detectedLanguageLabel(parsedData.language)}
                    </p>
                  )}
                </div>
              </div>

              {/* Photo lookup runs after the dishes are already listed. */}
              <div className="flex items-center justify-between gap-2 -mt-1">
                <p className="text-[9px] font-bold text-zinc-400 flex items-center gap-1.5 min-w-0">
                  {isFindingImages ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin text-purple-500 shrink-0" />
                      {t("rmenu.finding_images")}
                    </>
                  ) : imagesError ? (
                    <span className="text-red-500 truncate">{imagesError}</span>
                  ) : (
                    <>
                      <ImageIcon className="w-3 h-3 shrink-0" />
                      {t("rmenu.images_summary", {
                        count: parsedItemsWithImage,
                        total: parsedItems.length,
                      })}
                    </>
                  )}
                </p>

                {!isFindingImages && parsedItemsWithImage < parsedItems.length && (
                  <button
                    type="button"
                    onClick={handleFindImagesNow}
                    className="text-[9px] font-black text-purple-500 hover:text-purple-600 border border-purple-500/20 hover:bg-purple-500/5 px-2 py-1 rounded-lg transition-all shrink-0"
                  >
                    {t("rmenu.find_images_cta")}
                  </button>
                )}
              </div>

              {/* Extracted category items list (Scrollable) */}
              <div className="overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800 flex-1 pe-1 space-y-4">
                {parsedData.categories.map((cat, catIdx) => (
                  <div key={catIdx} className="pt-3 first:pt-0 space-y-2">
                    <h4 className="text-[10px] font-black text-purple-500 dark:text-purple-400 uppercase tracking-widest flex items-center gap-1.5">
                      <FolderPlus className="w-3.5 h-3.5 shrink-0" />
                      <span dir="auto" className="truncate">Category: {cat.name}</span>
                    </h4>

                    <div className="space-y-2">
                      {cat.items.map((item, itemIdx) => (
                        <div
                          key={itemIdx}
                          className="p-3 bg-zinc-50 dark:bg-zinc-950/40 rounded-xl border border-zinc-150 dark:border-zinc-850 flex items-start justify-between gap-3 text-xs"
                        >
                          <div className="flex items-start gap-2.5 min-w-0">
                            {/* Photos arrive a beat after the dishes do, so the
                                slot is reserved rather than popped in later. */}
                            {item.image ? (
                              <img
                                src={item.image}
                                alt=""
                                loading="lazy"
                                className="w-10 h-10 rounded-lg object-cover bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shrink-0"
                              />
                            ) : (
                              <span className="w-10 h-10 rounded-lg border border-dashed border-zinc-250 dark:border-zinc-800 flex items-center justify-center text-zinc-300 dark:text-zinc-700 shrink-0">
                                {isFindingImages ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <ImageIcon className="w-3.5 h-3.5" />
                                )}
                              </span>
                            )}

                            {/* dir="auto" so an Arabic import reads right-to-left
                                even while the admin UI is in English. */}
                            <div className="min-w-0">
                              <p dir="auto" className="font-bold text-zinc-800 dark:text-zinc-200 truncate">
                                {item.name}
                              </p>
                              <p dir="auto" className="text-[10px] text-zinc-400 line-clamp-1 mt-0.5">
                                {item.description}
                              </p>
                            </div>
                          </div>
                          <span className="font-extrabold text-orange-500 shrink-0">
                            ${Number(item.price ?? 0).toFixed(2)}
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
                type="button"
                disabled={isIntegrating}
                onClick={() => {
                  setParsedData(null);
                  setCustomFileName("");
                }}
                className="px-4 py-2.5 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:text-red-500 disabled:opacity-50 disabled:cursor-not-allowed text-zinc-500 dark:text-zinc-400 font-bold text-xs rounded-xl transition-all"
              >
                {t("rmenu.discard")}
              </button>

              {/* Disabled while integrating: a second click used to re-run the
                  whole create loop and duplicate every parsed dish. */}
              <button
                type="button"
                onClick={handleApproveParsedMenu}
                disabled={isIntegrating}
                aria-busy={isIntegrating}
                className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold text-xs py-2.5 px-4 rounded-xl shadow-lg shadow-purple-500/20 flex items-center justify-center gap-2 transition-all"
              >
                {isIntegrating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Integrating {integrationProgress.done}/{integrationProgress.total}…
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" /> {t("rmenu.approve_cta")}
                  </>
                )}
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
            <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
              Search, edit pricing, or toggle availability of dishes listed in
              your store menu.
            </p>
          </div>

          <div className="w-full sm:w-64">
            <input
              id="menu-catalog-search"
              type="search"
              aria-label={t("rmenu.search_aria")}
              placeholder={t("rmenu.search_placeholder")}
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

        {/* Menu Items Grouped by Section.
            Loading, failed and genuinely-empty are three different states: this
            used to key off `sections.length === 0`, so during the initial fetch
            the user saw the "create a section" CTA and created duplicates. */}
        {isLoadingMenu && !hasLoadedMenu ? (
          <div className="space-y-8" aria-busy="true" aria-label={t("rmenu.loading_menu")}>
            {[0, 1].map((sectionIdx) => (
              <div key={sectionIdx} className="space-y-4">
                <Skeleton className="h-4 w-40 rounded" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[0, 1, 2, 3].map((cardIdx) => (
                    <Skeleton key={cardIdx} className="h-28 w-full rounded-2xl" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : menuError ? (
          <ErrorState message={menuError} onRetry={loadMenu} title={t("rmenu.load_error_title")} />
        ) : sections.length === 0 ? (
          <EmptyState
            icon={Store}
            title={t("rmenu.empty_title")}
            hint={t("rmenu.empty_hint")}
            action={
              <button
                type="button"
                onClick={() => {
                  setEditingSection(null);
                  setIsSectionModalOpen(true);
                }}
                className="bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-colors"
              >
                {t("rmenu.create_section")}
              </button>
            }
          />
        ) : (
          <div className="space-y-8">
            {itemsError && <ErrorBanner message={itemsError} onRetry={loadMenu} />}
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
                      <div className="flex gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingSection(sec);
                            setIsSectionModalOpen(true);
                          }}
                          className="text-xs font-bold text-zinc-500 dark:text-zinc-400 hover:text-orange-500"
                        >
                          {t("rmenu.edit_section")}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteSection(sec)}
                          disabled={pendingSectionId === sec.id}
                          className="text-xs font-bold text-zinc-500 dark:text-zinc-400 hover:text-red-500 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1"
                        >
                          {pendingSectionId === sec.id && <Loader2 className="w-3 h-3 animate-spin" />}
                          {pendingSectionId === sec.id
                            ? t("rmenu.deleting")
                            : t("common.delete")}
                        </button>
                      </div>
                    </div>

                    {/* Items Grid for this Section */}
                    {secItems.length === 0 ? (
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 italic">{t("rmenu.no_items_section")}</p>
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
                                  {/* Hover-only actions were unreachable on touch
                                      devices and invisible to keyboard focus. */}
                                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 max-md:opacity-100 transition-opacity">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingItem(item);
                                        setIsItemModalOpen(true);
                                      }}
                                      className="text-zinc-500 dark:text-zinc-400 hover:text-orange-500 p-2.5 hover:bg-zinc-150 dark:hover:bg-zinc-800 rounded-lg"
                                      title={t("rmenu.edit_dish")}
                                      aria-label={`Edit ${item.name}`}
                                    >
                                      <FileText className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteItem(item)}
                                      disabled={pendingItemId === item.id}
                                      className="text-zinc-500 dark:text-zinc-400 hover:text-red-500 p-2.5 hover:bg-zinc-150 dark:hover:bg-zinc-800 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                                      title={t("rmenu.delete_dish")}
                                      aria-label={`Delete ${item.name}`}
                                    >
                                      {pendingItemId === item.id ? (
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                      ) : (
                                        <Trash2 className="w-3.5 h-3.5" />
                                      )}
                                    </button>
                                  </div>
                                </div>
                                <p className="text-[10px] text-zinc-500 dark:text-zinc-400 line-clamp-2 mt-0.5">
                                  {item.description}
                                </p>
                              </div>

                              <div className="flex items-start justify-between pt-2 border-t border-zinc-100 dark:border-zinc-800/80 mt-2 gap-2">
                                {/* Inline price editor — controlled, validated on blur */}
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <DollarSign className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                                    <input
                                      type="number"
                                      step="0.1"
                                      min="0"
                                      inputMode="decimal"
                                      aria-label={`Price for ${item.name}`}
                                      aria-invalid={priceErrors[item.id] ? true : undefined}
                                      aria-describedby={priceErrors[item.id] ? `price-error-${item.id}` : undefined}
                                      value={priceValue(item)}
                                      onChange={(e) => handlePriceChange(item, e.target.value)}
                                      onBlur={() => handlePriceBlur(item)}
                                      className={`w-16 bg-white dark:bg-zinc-900 border text-xs font-bold text-zinc-800 dark:text-zinc-200 px-1 py-0.5 rounded focus:outline-none focus:ring-1 ${
                                        priceErrors[item.id]
                                          ? "border-red-500 focus:ring-red-500"
                                          : "border-zinc-200 dark:border-zinc-800 focus:ring-orange-500"
                                      }`}
                                    />
                                  </div>
                                  {priceErrors[item.id] && (
                                    <p id={`price-error-${item.id}`} className="text-[9px] font-bold text-red-500 mt-1">
                                      {priceErrors[item.id]}
                                    </p>
                                  )}
                                </div>

                                {/* Availability toggle */}
                                <button
                                  type="button"
                                  onClick={() => handleToggleAvailability(item)}
                                  aria-pressed={item.isAvailable}
                                  className={`text-[10px] font-bold px-2 py-1.5 rounded transition-colors flex items-center gap-1 border shrink-0 ${
                                    item.isAvailable
                                      ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500"
                                      : "bg-zinc-100 border-zinc-200 text-zinc-500 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-400"
                                  }`}
                                >
                                  {item.isAvailable ? (
                                    <>
                                      <Check className="w-3 h-3" /> {t("rmenu.available")}
                                    </>
                                  ) : (
                                    <>
                                      <X className="w-3 h-3" /> {t("rmenu.snoozed")}
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
          // The modal already raises its own react-hot-toast on success.
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
          // The modal already raises its own react-hot-toast on success.
        }}
      />
    </div>
  );
}
