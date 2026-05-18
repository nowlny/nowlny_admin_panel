"use client";

import React, { useState } from "react";
import { 
  Store, 
  Search, 
  Star, 
  MapPin, 
  Calendar, 
  DollarSign, 
  ShoppingBag, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Plus, 
  Edit3, 
  Trash2, 
  FileText, 
  Eye,
  Check,
  ChevronRight,
  ArrowLeft
} from "lucide-react";
import { Restaurant, MenuItem, MenuCategory, loadDb } from "../data/mockData";

interface RestaurantsSectionProps {
  db: ReturnType<typeof loadDb>;
  onUpdateRestaurant: (updatedRestaurant: Restaurant) => void;
  searchQuery: string;
}

export default function RestaurantsSection({
  db,
  onUpdateRestaurant,
  searchQuery
}: RestaurantsSectionProps) {
  const { restaurants } = db;
  const [selectedRestId, setSelectedRestId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Pending' | 'Suspended'>('All');
  
  // Menu Editing Form States
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [isAddingItem, setIsAddingItem] = useState<boolean>(false);
  const [newItemCategory, setNewItemCategory] = useState<string | null>(null);
  const [newCategoryName, setNewCategoryName] = useState<string>("");
  const [isAddingCategory, setIsAddingCategory] = useState<boolean>(false);

  // New item form inputs
  const [itemFormName, setItemFormName] = useState("");
  const [itemFormDesc, setItemFormDesc] = useState("");
  const [itemFormPrice, setItemFormPrice] = useState("");
  const [itemFormImg, setItemFormImg] = useState("");

  const selectedRest = restaurants.find(r => r.id === selectedRestId);

  // Filter restaurants
  const filteredRestaurants = restaurants.filter(r => {
    const matchesSearch = r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.cuisine.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.address.toLowerCase().includes(searchQuery.toLowerCase());
      
    const matchesStatus = statusFilter === 'All' || r.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const handleStatusChange = (restId: string, newStatus: 'Active' | 'Pending' | 'Suspended') => {
    const rest = restaurants.find(r => r.id === restId);
    if (rest) {
      const updated = { ...rest, status: newStatus };
      onUpdateRestaurant(updated);
    }
  };

  // Add a new Category to Restaurant Menu
  const handleAddCategory = () => {
    if (!selectedRest || !newCategoryName.trim()) return;
    
    const newCat: MenuCategory = {
      id: `cat-${selectedRest.id}-${Date.now()}`,
      name: newCategoryName,
      items: []
    };

    const updatedMenu = [...selectedRest.menu, newCat];
    const updatedRest = { ...selectedRest, menu: updatedMenu };
    
    onUpdateRestaurant(updatedRest);
    setNewCategoryName("");
    setIsAddingCategory(false);
  };

  // Delete Category from Restaurant Menu
  const handleDeleteCategory = (catId: string) => {
    if (!selectedRest) return;
    if (!confirm("Are you sure you want to delete this category and all its menu items?")) return;

    const updatedMenu = selectedRest.menu.filter(c => c.id !== catId);
    const updatedRest = { ...selectedRest, menu: updatedMenu };
    onUpdateRestaurant(updatedRest);
  };

  // Save changes to an existing Menu Item
  const handleSaveEditItem = () => {
    if (!selectedRest || !editingItem) return;

    const updatedMenu = selectedRest.menu.map(cat => {
      if (cat.items.some(item => item.id === editingItem.id)) {
        return {
          ...cat,
          items: cat.items.map(item => item.id === editingItem.id ? editingItem : item)
        };
      }
      return cat;
    });

    const updatedRest = { ...selectedRest, menu: updatedMenu };
    onUpdateRestaurant(updatedRest);
    setEditingItem(null);
  };

  // Open form to add new item
  const openAddItemForm = (catId: string) => {
    setNewItemCategory(catId);
    setItemFormName("");
    setItemFormDesc("");
    setItemFormPrice("");
    setItemFormImg("");
    setIsAddingItem(true);
  };

  // Submit adding a new Menu Item
  const handleAddItem = () => {
    if (!selectedRest || !newItemCategory) return;
    if (!itemFormName.trim() || !itemFormPrice) {
      alert("Name and Price are required.");
      return;
    }

    const targetCategory = selectedRest.menu.find(c => c.id === newItemCategory);
    if (!targetCategory) return;

    const newItem: MenuItem = {
      id: `item-${selectedRest.id}-${Date.now()}`,
      name: itemFormName,
      description: itemFormDesc,
      price: parseFloat(itemFormPrice),
      image: itemFormImg || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=100&auto=format&fit=crop&q=80",
      isAvailable: true,
      category: targetCategory.name
    };

    const updatedMenu = selectedRest.menu.map(cat => {
      if (cat.id === newItemCategory) {
        return {
          ...cat,
          items: [...cat.items, newItem]
        };
      }
      return cat;
    });

    const updatedRest = { ...selectedRest, menu: updatedMenu };
    onUpdateRestaurant(updatedRest);
    setIsAddingItem(false);
    setNewItemCategory(null);
  };

  // Delete a Menu Item
  const handleDeleteItem = (itemId: string) => {
    if (!selectedRest) return;
    if (!confirm("Delete this dish?")) return;

    const updatedMenu = selectedRest.menu.map(cat => {
      return {
        ...cat,
        items: cat.items.filter(item => item.id !== itemId)
      };
    });

    const updatedRest = { ...selectedRest, menu: updatedMenu };
    onUpdateRestaurant(updatedRest);
  };

  // Toggle Item availability status quickly
  const handleToggleItemAvailability = (itemId: string, currentStatus: boolean) => {
    if (!selectedRest) return;
    
    const updatedMenu = selectedRest.menu.map(cat => {
      return {
        ...cat,
        items: cat.items.map(item => item.id === itemId ? { ...item, isAvailable: !currentStatus } : item)
      };
    });

    const updatedRest = { ...selectedRest, menu: updatedMenu };
    onUpdateRestaurant(updatedRest);
  };

  // Render detail view if open
  if (selectedRest) {
    return (
      <div className="space-y-6 animate-in slide-in-from-right duration-200">
        {/* Back Button */}
        <button 
          onClick={() => {
            setSelectedRestId(null);
            setEditingItem(null);
            setIsAddingItem(false);
            setIsAddingCategory(false);
          }}
          className="flex items-center gap-2 text-xs font-bold text-zinc-500 hover:text-zinc-950 dark:hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Restaurant Registry</span>
        </button>

        {/* Restaurant Header Jumbotron */}
        <div className="relative bg-zinc-900 rounded-2xl overflow-hidden border border-zinc-800 shadow-lg">
          <div className="h-40 relative">
            <img 
              src={selectedRest.banner} 
              alt={selectedRest.name} 
              className="w-full h-full object-cover opacity-40"
            />
            <div className="absolute top-4 right-4 flex gap-2">
              <span className={`text-xs font-bold px-3 py-1.5 rounded-full shadow-lg border ${
                selectedRest.status === "Active" ? "bg-emerald-500/90 text-white border-emerald-400" :
                selectedRest.status === "Pending" ? "bg-amber-500/90 text-black border-amber-400 animate-pulse" :
                "bg-red-500/90 text-white border-red-400"
              }`}>
                {selectedRest.status}
              </span>
            </div>
          </div>
          
          <div className="p-6 relative -mt-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-6 bg-gradient-to-t from-zinc-950 via-zinc-950/95 to-zinc-950/40">
            <div className="flex gap-4 items-end">
              <span className="text-4xl p-3 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-xl">{selectedRest.logo}</span>
              <div>
                <h3 className="text-xl font-bold text-white tracking-tight">{selectedRest.name}</h3>
                <p className="text-xs text-orange-400 font-semibold">{selectedRest.cuisine}</p>
                <div className="flex items-center gap-4 mt-2 text-[11px] text-zinc-400">
                  <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {selectedRest.address}</span>
                  <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> Joined {selectedRest.joinedDate}</span>
                </div>
              </div>
            </div>

            {/* Admin Override Action Bar */}
            <div className="flex gap-2 shrink-0">
              {selectedRest.status === "Pending" && (
                <>
                  <button 
                    onClick={() => handleStatusChange(selectedRest.id, 'Active')}
                    className="bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all shadow-lg shadow-emerald-500/20"
                  >
                    Approve Application
                  </button>
                  <button 
                    onClick={() => handleStatusChange(selectedRest.id, 'Suspended')}
                    className="bg-zinc-800 hover:bg-red-500 hover:text-white text-zinc-300 text-xs font-bold px-4 py-2.5 rounded-xl transition-all"
                  >
                    Reject/Deny
                  </button>
                </>
              )}
              {selectedRest.status === "Active" && (
                <button 
                  onClick={() => handleStatusChange(selectedRest.id, 'Suspended')}
                  className="bg-red-600 hover:bg-red-700 active:scale-95 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all"
                >
                  Suspend Merchant
                </button>
              )}
              {selectedRest.status === "Suspended" && (
                <button 
                  onClick={() => handleStatusChange(selectedRest.id, 'Active')}
                  className="bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all"
                >
                  Activate Merchant
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Info Grid (Summary Payouts + Documents Verification) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl shadow-sm flex items-center gap-4">
            <div className="p-3 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide">Gross Income</p>
              <p className="text-lg font-black text-zinc-900 dark:text-white">${selectedRest.revenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl shadow-sm flex items-center gap-4">
            <div className="p-3 bg-orange-500/10 text-orange-600 dark:text-orange-400 rounded-xl">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide">Total Sales Orders</p>
              <p className="text-lg font-black text-zinc-900 dark:text-white">{selectedRest.ordersCount} Orders</p>
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl shadow-sm flex items-center gap-4">
            <div className="p-3 bg-amber-500/10 text-amber-500 rounded-xl">
              <Star className="w-5 h-5 fill-amber-500" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide">Review Rating</p>
              <p className="text-lg font-black text-zinc-900 dark:text-white">{selectedRest.rating} ★ <span className="text-xs font-normal text-zinc-400">({selectedRest.reviewsCount} votes)</span></p>
            </div>
          </div>
        </div>

        {/* Main Work Area: MENU EDITOR */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
          <div className="flex justify-between items-center mb-6 pb-4 border-b border-zinc-100 dark:border-zinc-800">
            <div>
              <h4 className="text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                <Store className="w-4 h-4 text-orange-500" /> Menu Catalog & Availability
              </h4>
              <p className="text-xs text-zinc-400">Admin override: Edit categories, items, and control online menus</p>
            </div>
            
            <button
              onClick={() => setIsAddingCategory(true)}
              className="flex items-center gap-1.5 text-xs font-bold text-orange-500 border border-orange-500/20 bg-orange-500/5 hover:bg-orange-500/10 px-3 py-2 rounded-lg transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Add Category</span>
            </button>
          </div>

          {/* Add Category Form */}
          {isAddingCategory && (
            <div className="mb-6 p-4 border border-orange-500/30 rounded-xl bg-orange-500/[0.01] flex items-end gap-3 animate-in slide-in-from-top-2 duration-150">
              <div className="flex-1">
                <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1">New Category Title</label>
                <input
                  type="text"
                  placeholder="e.g. Burgers, Hot Appetizers, Fresh Desserts"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  className="w-full bg-zinc-50 border border-zinc-200 text-zinc-800 rounded-lg p-2 text-xs focus:outline-none focus:ring-1 focus:ring-orange-500 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-200"
                />
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={handleAddCategory}
                  className="bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold px-4 py-2 rounded-lg"
                >
                  Create Category
                </button>
                <button
                  onClick={() => setIsAddingCategory(false)}
                  className="bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs font-bold px-4 py-2 rounded-lg"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Menu Categories List */}
          {selectedRest.menu.length === 0 ? (
            <div className="p-12 text-center text-zinc-400 text-xs font-medium">
              No categories exist. Click "Add Category" to get started!
            </div>
          ) : (
            <div className="space-y-6">
              {selectedRest.menu.map((category) => (
                <div key={category.id} className="border border-zinc-100 dark:border-zinc-800/80 rounded-xl p-4 space-y-4">
                  <div className="flex justify-between items-center bg-zinc-50 dark:bg-zinc-800/30 p-2.5 rounded-lg">
                    <h5 className="text-xs font-black text-zinc-900 dark:text-white uppercase tracking-wider">{category.name}</h5>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openAddItemForm(category.id)}
                        className="text-[10px] font-bold text-orange-500 hover:underline inline-flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add Dish
                      </button>
                      <button
                        onClick={() => handleDeleteCategory(category.id)}
                        className="text-[10px] font-bold text-red-500 hover:underline pl-2 border-l border-zinc-200 dark:border-zinc-800"
                      >
                        Delete Category
                      </button>
                    </div>
                  </div>

                  {/* Add dish form */}
                  {isAddingItem && newItemCategory === category.id && (
                    <div className="p-4 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 grid grid-cols-1 md:grid-cols-2 gap-4 animate-in slide-in-from-top-2 duration-150">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-zinc-400 uppercase">Dish Name</label>
                        <input
                          type="text"
                          placeholder="Double Cheese Melt"
                          value={itemFormName}
                          onChange={(e) => setItemFormName(e.target.value)}
                          className="w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 rounded-lg p-2 text-xs focus:ring-1 focus:ring-orange-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-zinc-400 uppercase">Price ($)</label>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="8.50"
                          value={itemFormPrice}
                          onChange={(e) => setItemFormPrice(e.target.value)}
                          className="w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 rounded-lg p-2 text-xs focus:ring-1 focus:ring-orange-500"
                        />
                      </div>
                      <div className="md:col-span-2 space-y-1">
                        <label className="text-[10px] font-bold text-zinc-400 uppercase">Description</label>
                        <input
                          type="text"
                          placeholder="Gourmet patty with toasted brioche, cheddar slice, pickles and hot sauce."
                          value={itemFormDesc}
                          onChange={(e) => setItemFormDesc(e.target.value)}
                          className="w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 rounded-lg p-2 text-xs focus:ring-1 focus:ring-orange-500"
                        />
                      </div>
                      <div className="space-y-1 md:col-span-2">
                        <label className="text-[10px] font-bold text-zinc-400 uppercase">Image URL (Optional)</label>
                        <input
                          type="text"
                          placeholder="https://images.unsplash.com/photo-..."
                          value={itemFormImg}
                          onChange={(e) => setItemFormImg(e.target.value)}
                          className="w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 rounded-lg p-2 text-xs focus:ring-1 focus:ring-orange-500"
                        />
                      </div>
                      <div className="md:col-span-2 flex justify-end gap-2 mt-2">
                        <button
                          onClick={handleAddItem}
                          className="bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold px-4 py-2 rounded-lg"
                        >
                          Add to Category
                        </button>
                        <button
                          onClick={() => setIsAddingItem(false)}
                          className="bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs font-bold px-4 py-2 rounded-lg"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Dishes Cards Grid */}
                  {category.items.length === 0 ? (
                    <div className="p-6 text-center text-zinc-400 text-[11px] font-medium border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl">
                      Empty Category. Add a dish to populate.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {category.items.map((item) => (
                        <div 
                          key={item.id} 
                          className={`p-3.5 rounded-xl border flex gap-3 items-center transition-all bg-white dark:bg-zinc-900 ${
                            !item.isAvailable ? "opacity-60 border-zinc-200 bg-zinc-50/50" : "border-zinc-200/60 dark:border-zinc-800 hover:border-orange-500/30"
                          }`}
                        >
                          <img 
                            src={item.image || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=100&auto=format&fit=crop&q=80"}
                            alt={item.name} 
                            className="w-14 h-14 rounded-lg object-cover bg-zinc-100 shadow-sm shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            {editingItem?.id === item.id ? (
                              <div className="space-y-1.5">
                                <input 
                                  type="text" 
                                  value={editingItem.name} 
                                  onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
                                  className="w-full bg-zinc-50 border border-zinc-200 text-xs p-1 rounded font-bold"
                                />
                                <input 
                                  type="number" 
                                  step="0.01"
                                  value={editingItem.price} 
                                  onChange={(e) => setEditingItem({ ...editingItem, price: parseFloat(e.target.value) || 0 })}
                                  className="w-20 bg-zinc-50 border border-zinc-200 text-xs p-1 rounded font-bold"
                                />
                                <textarea 
                                  value={editingItem.description} 
                                  onChange={(e) => setEditingItem({ ...editingItem, description: e.target.value })}
                                  className="w-full bg-zinc-50 border border-zinc-200 text-[10px] p-1 rounded text-zinc-400"
                                />
                                <div className="flex gap-2">
                                  <button onClick={handleSaveEditItem} className="text-[10px] bg-emerald-500 text-white font-bold px-2 py-0.5 rounded">Save</button>
                                  <button onClick={() => setEditingItem(null)} className="text-[10px] bg-zinc-200 dark:bg-zinc-800 font-bold px-2 py-0.5 rounded">Cancel</button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <div className="flex justify-between items-start gap-1">
                                  <h6 className="text-xs font-bold text-zinc-950 dark:text-white truncate">{item.name}</h6>
                                  <span className="text-xs font-black text-orange-500">${item.price.toFixed(2)}</span>
                                </div>
                                <p className="text-[10px] text-zinc-400 mt-0.5 line-clamp-1 leading-normal">{item.description}</p>
                                
                                {/* Status Actions */}
                                <div className="flex items-center justify-between mt-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                                  <div className="flex items-center gap-1.5">
                                    <input 
                                      type="checkbox"
                                      checked={item.isAvailable}
                                      onChange={() => handleToggleItemAvailability(item.id, item.isAvailable)}
                                      className="rounded text-orange-500 w-3 h-3 cursor-pointer"
                                      id={`avail-${item.id}`}
                                    />
                                    <label htmlFor={`avail-${item.id}`} className="text-[10px] text-zinc-400 font-semibold cursor-pointer select-none">
                                      {item.isAvailable ? "Available" : "Sold Out"}
                                    </label>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <button 
                                      onClick={() => setEditingItem(item)}
                                      className="text-zinc-400 hover:text-orange-500 transition-colors p-1"
                                      title="Edit Dish"
                                    >
                                      <Edit3 className="w-3.5 h-3.5" />
                                    </button>
                                    <button 
                                      onClick={() => handleDeleteItem(item.id)}
                                      className="text-zinc-400 hover:text-red-500 transition-colors p-1"
                                      title="Delete Dish"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Registry Listing Grid
  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Search & Tabs Filter Row */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-2xl shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        {/* Status Filter Tab Buttons */}
        <div className="flex items-center gap-1.5 bg-zinc-50 dark:bg-zinc-800 p-1 rounded-xl border border-zinc-200/60 dark:border-zinc-700/80">
          {(['All', 'Active', 'Pending', 'Suspended'] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setStatusFilter(filter)}
              className={`text-xs font-bold px-4 py-2 rounded-lg transition-all duration-200 ${
                statusFilter === filter 
                  ? "bg-white dark:bg-zinc-900 text-orange-500 shadow-sm border border-zinc-200/30 dark:border-zinc-800" 
                  : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white"
              }`}
            >
              <span>{filter}</span>
              {filter === 'Pending' && restaurants.filter(r => r.status === 'Pending').length > 0 && (
                <span className="ml-1.5 bg-amber-500 text-black px-1.5 py-0.5 text-[9px] font-black rounded-full">
                  {restaurants.filter(r => r.status === 'Pending').length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Counter summary */}
        <span className="text-xs font-semibold text-zinc-500">
          Showing {filteredRestaurants.length} of {restaurants.length} merchants
        </span>
      </div>

      {/* Grid of Restaurant Cards */}
      {filteredRestaurants.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-12 text-center rounded-2xl flex flex-col items-center justify-center">
          <Store className="w-12 h-12 text-zinc-300 dark:text-zinc-700 mb-3" />
          <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">No restaurants match criteria</p>
          <p className="text-xs text-zinc-400 mt-1">Try relaxing filters or updating search search terms</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredRestaurants.map((rest) => (
            <div 
              key={rest.id} 
              className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 group flex flex-col cursor-pointer"
              onClick={() => setSelectedRestId(rest.id)}
            >
              {/* Banner Area */}
              <div className="h-32 relative">
                <img 
                  src={rest.banner} 
                  alt={rest.name} 
                  className="w-full h-full object-cover group-hover:scale-105 transition-all duration-300 opacity-80"
                />
                <div className="absolute top-3 right-3">
                  <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-full shadow border ${
                    rest.status === "Active" ? "bg-emerald-500/90 text-white border-emerald-400" :
                    rest.status === "Pending" ? "bg-amber-500/95 text-black border-amber-400 animate-pulse" :
                    "bg-red-500/90 text-white border-red-400"
                  }`}>
                    {rest.status}
                  </span>
                </div>
              </div>

              {/* Body */}
              <div className="p-5 space-y-4 flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex gap-3 items-start">
                    <span className="text-3xl p-1 bg-zinc-50 dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-100 dark:border-zinc-700">{rest.logo}</span>
                    <div className="min-w-0">
                      <h4 className="text-sm font-bold text-zinc-950 dark:text-white truncate group-hover:text-orange-500 transition-colors">{rest.name}</h4>
                      <p className="text-[10px] text-zinc-400 font-medium truncate mt-0.5">{rest.cuisine}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 mt-3.5">
                    <MapPin className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                    <span className="truncate">{rest.address}</span>
                  </div>
                </div>

                {/* mini analytics stats */}
                <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 grid grid-cols-2 gap-2 text-center text-xs">
                  <div className="bg-zinc-50 dark:bg-zinc-800/40 p-2 rounded-xl">
                    <p className="text-[9px] font-bold text-zinc-400 uppercase">GMV Sales</p>
                    <p className="font-extrabold text-zinc-900 dark:text-white mt-0.5">${rest.revenue.toFixed(0)}</p>
                  </div>
                  <div className="bg-zinc-50 dark:bg-zinc-800/40 p-2 rounded-xl">
                    <p className="text-[9px] font-bold text-zinc-400 uppercase">Rating</p>
                    <p className="font-extrabold text-zinc-900 dark:text-white mt-0.5 inline-flex items-center justify-center gap-0.5">
                      {rest.rating} <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
