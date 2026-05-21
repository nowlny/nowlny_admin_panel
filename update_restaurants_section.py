import re

with open("src/app/components/RestaurantsSection.tsx", "r") as f:
    content = f.read()

# 1. Update State variables
content = content.replace(
"""  const [selectedRestId, setSelectedRestId] = useState<string | null>(null);
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'pending' | 'suspended'>('all');""",
"""  const [selectedRestId, setSelectedRestId] = useState<string | null>(null);
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'merchants' | 'applications'>('merchants');
  const [merchantStatus, setMerchantStatus] = useState<'all' | 'active' | 'suspended'>('all');
  const [appStatus, setAppStatus] = useState<string>('pending');
  const [appPage, setAppPage] = useState(1);
  const [appTotalPages, setAppTotalPages] = useState(1);
  const [appTotalItems, setAppTotalItems] = useState(0);"""
)

# 2. Update fetching logic
fetch_regex = r"const fetchRestaurants = async \(\) => \{.*?\};\n\n  useEffect\(\(\) => \{\n    fetchRestaurants\(\);\n  \}, \[\]\);"
new_fetch = """  const fetchMerchants = async () => {
    try {
      setIsLoading(true);
      let restsData: RestaurantResponse[] = [];
      try {
        restsData = await restaurantsService.getRestaurants();
      } catch (err) {
        console.error("Failed to fetch restaurants via API:", err);
      }
      const finalRests = Array.isArray(restsData) ? restsData : (restsData && (restsData as any).data ? (restsData as any).data : []);
      setRestaurants(finalRests);
      setError(null);
    } catch (err: any) {
      console.error("General error in fetchMerchants:", err);
      setError("An unexpected error occurred while loading data.");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSubmissions = async () => {
    try {
      setIsLoading(true);
      let subsData: any = null;
      try {
        subsData = await restaurantsService.getSubmissions({ status: appStatus, page: appPage, limit: 20 });
      } catch (err) {
        console.error("Failed to fetch submissions via API:", err);
      }

      if (subsData && subsData.data) {
        setSubmissions(subsData.data);
        setAppTotalPages(subsData.totalPages || Math.ceil((subsData.total || 0) / 20) || 1);
        setAppTotalItems(subsData.total || 0);
      } else if (Array.isArray(subsData)) {
        setSubmissions(subsData);
        setAppTotalPages(1);
        setAppTotalItems(subsData.length);
      } else {
        setSubmissions([]);
        setAppTotalPages(1);
        setAppTotalItems(0);
      }
      setError(null);
    } catch (err: any) {
      console.error("General error in fetchSubmissions:", err);
      setError("An unexpected error occurred while loading data.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (viewMode === 'merchants') {
      fetchMerchants();
    } else {
      fetchSubmissions();
    }
  }, [viewMode, appStatus, appPage]);"""

content = re.sub(fetch_regex, new_fetch, content, flags=re.DOTALL)

# 3. Update Filtering logic
filter_regex = r"  // Filter restaurants\n  const filteredRestaurants = restaurants\.filter\(r => \{.*?\n  const isPendingTab = statusFilter === 'pending';\n  const displayList = isPendingTab \? filteredSubmissions : filteredRestaurants;"
new_filter = """  // Filter restaurants locally (if you want local search/status for merchants)
  const filteredRestaurants = restaurants.filter(r => {
    const matchesSearch = r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.cuisineType || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.address || "").toLowerCase().includes(searchQuery.toLowerCase());
      
    const matchesStatus = merchantStatus === 'all' || r.status?.toLowerCase() === merchantStatus.toLowerCase();
    return matchesSearch && matchesStatus;
  });

  // Filter submissions (search locally since backend doesn't have search query param yet, or assume it does)
  const filteredSubmissions = submissions.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.cuisineType || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.address?.street || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.address?.city || "").toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const isPendingTab = viewMode === 'applications';
  const displayList = isPendingTab ? filteredSubmissions : filteredRestaurants;"""

content = re.sub(filter_regex, new_filter, content, flags=re.DOTALL)

# 4. Replace handle calls to fetchMerchants instead of fetchRestaurants
content = content.replace("fetchRestaurants();", "if (viewMode === 'merchants') fetchMerchants(); else fetchSubmissions();")

# 5. Update tabs UI
tabs_ui_regex = r"\{/\* Search & Tabs Filter Row \*/\}.*?(?=\{/\* Grid of Restaurant / Submission Cards \*/\})"
new_tabs_ui = """{/* View Toggle & Filter Row */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-2xl shadow-sm flex flex-col gap-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          
          <div className="flex items-center gap-4">
            {/* View Mode Switcher */}
            <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl border border-zinc-200/60 dark:border-zinc-700/80">
              <button
                onClick={() => { setViewMode('merchants'); setSelectedRestId(null); setSelectedSubmissionId(null); }}
                className={`text-xs font-bold px-4 py-2 rounded-lg transition-all duration-200 ${
                  viewMode === 'merchants' 
                    ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-sm border border-zinc-200/30 dark:border-zinc-800" 
                    : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white"
                }`}
              >
                Merchants Registry
              </button>
              <button
                onClick={() => { setViewMode('applications'); setSelectedRestId(null); setSelectedSubmissionId(null); }}
                className={`text-xs font-bold px-4 py-2 rounded-lg transition-all duration-200 ${
                  viewMode === 'applications' 
                    ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-sm border border-zinc-200/30 dark:border-zinc-800" 
                    : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white"
                }`}
              >
                Applications
              </button>
            </div>

            {/* Dynamic Filters based on view mode */}
            <div className="flex items-center gap-1.5 bg-zinc-50 dark:bg-zinc-800/50 p-1 rounded-xl border border-zinc-200/60 dark:border-zinc-700/80">
              {viewMode === 'merchants' ? (
                (['all', 'active', 'suspended'] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setMerchantStatus(filter)}
                    className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all duration-200 capitalize ${
                      merchantStatus === filter 
                        ? "bg-white dark:bg-zinc-900 text-orange-500 shadow-sm border border-zinc-200/30 dark:border-zinc-800" 
                        : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white"
                    }`}
                  >
                    {filter}
                  </button>
                ))
              ) : (
                (['all', 'pending', 'approved', 'rejected', 'cancelled'] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => { setAppStatus(filter); setAppPage(1); }}
                    className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all duration-200 capitalize ${
                      appStatus === filter 
                        ? "bg-white dark:bg-zinc-900 text-orange-500 shadow-sm border border-zinc-200/30 dark:border-zinc-800" 
                        : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white"
                    }`}
                  >
                    {filter}
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Counter summary & Actions */}
          <div className="flex items-center gap-4">
            <span className="text-xs font-semibold text-zinc-500">
              Showing {displayList.length} of {isPendingTab ? appTotalItems : restaurants.length} {isPendingTab ? "applications" : "merchants"}
            </span>
            <button 
              onClick={() => setIsAddModalOpen(true)}
              className="text-xs font-bold px-3 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-all shadow-sm"
            >
              Add Restaurant
            </button>
          </div>
        </div>
      </div>

      """

content = re.sub(tabs_ui_regex, new_tabs_ui, content, flags=re.DOTALL)

# 6. Pagination UI (at the bottom of the list)
pagination_ui = """
      {viewMode === 'applications' && appTotalPages > 1 && displayList.length > 0 && (
        <div className="flex justify-center items-center gap-2 mt-8">
          <button 
            disabled={appPage === 1}
            onClick={() => setAppPage(p => Math.max(1, p - 1))}
            className="px-3 py-1.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs font-bold disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-xs font-semibold text-zinc-500">Page {appPage} of {appTotalPages}</span>
          <button 
            disabled={appPage === appTotalPages}
            onClick={() => setAppPage(p => Math.min(appTotalPages, p + 1))}
            className="px-3 py-1.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs font-bold disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
"""
content = content.replace("        </div>\n      )}\n      {/* Add Restaurant Modal */}", f"        </div>\n      )}\n{pagination_ui}\n      {{/* Add Restaurant Modal */}}")

with open("src/app/components/RestaurantsSection.tsx", "w") as f:
    f.write(content)

