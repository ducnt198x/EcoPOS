
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { generateItemDescription } from '../services/geminiService';
import { InventoryItem } from '../types';
import { useData } from '../contexts/DataContext';
import { useLanguage } from '../contexts/LanguageContext';

const Inventory: React.FC = () => {
  const { inventory, addInventoryItem, updateInventoryItem, deleteInventoryItem, categories } = useData();
  const { t } = useLanguage();
  
  // UI State
  const [showModal, setShowModal] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isAnimating, setIsAnimating] = useState(false);
  
  // Real-time Visual Feedback State
  const [updatedIds, setUpdatedIds] = useState<Set<string>>(new Set());
  const prevInventoryRef = useRef<InventoryItem[]>(inventory);

  // Filters
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [sortOrder, setSortOrder] = useState<'name' | 'stock-asc' | 'stock-desc'>('stock-asc');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Form State
  const [isGenerating, setIsGenerating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [itemName, setItemName] = useState('');
  const [itemCategory, setItemCategory] = useState('');
  const [itemStock, setItemStock] = useState('');
  const [itemMinStock, setItemMinStock] = useState('5');
  const [itemUnit, setItemUnit] = useState('pcs');
  const [itemDescription, setItemDescription] = useState('');

  // --- Real-time Change Detection ---
  useEffect(() => {
      const changes = new Set<string>();
      
      inventory.forEach(item => {
          const prev = prevInventoryRef.current.find(p => p.id === item.id);
          // Detect changes in Stock or Status specifically for visual alerting
          if (prev && (prev.stock !== item.stock || prev.status !== item.status)) {
              changes.add(item.id);
          }
      });

      if (changes.size > 0) {
          setUpdatedIds(prev => {
              const next = new Set(prev);
              changes.forEach(id => next.add(id));
              return next;
          });

          // Remove highlight after 2 seconds
          const timer = setTimeout(() => {
              setUpdatedIds(prev => {
                  const next = new Set(prev);
                  changes.forEach(id => next.delete(id));
                  return next;
              });
          }, 2000);

          return () => clearTimeout(timer);
      }
      
      prevInventoryRef.current = inventory;
  }, [inventory]);

  // --- Helpers ---

  const generateId = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return `inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

  const calculateStatus = (stock: number, min: number): 'in-stock' | 'low-stock' | 'out-of-stock' => {
      if (stock <= 0) return 'out-of-stock';
      if (stock <= min) return 'low-stock';
      return 'in-stock';
  };

  // --- Actions ---

  const handleGenerateDescription = async () => {
    if (!itemName) return;
    setIsGenerating(true);
    
    // Auto-detect category if missing
    let catToUse = itemCategory;
    if (!catToUse) {
        const lowerName = itemName.toLowerCase();
        if (lowerName.match(/beer|wine|water|coke|juice|tea|coffee/)) catToUse = 'drink';
        else if (lowerName.match(/beef|chicken|pork|rice|noodle|bread|soup/)) catToUse = 'food';
        else catToUse = 'ingredient';
        setItemCategory(catToUse);
    }

    const desc = await generateItemDescription(itemName, catToUse || 'general');
    setItemDescription(desc);
    setIsGenerating(false);
  };

  const openModal = (item?: InventoryItem) => {
      if (item) {
          setEditingId(item.id);
          setItemName(item.name);
          setItemCategory(item.category);
          setItemStock(item.stock.toString());
          setItemMinStock(item.minStock.toString());
          setItemUnit(item.unit);
          setItemDescription(item.description || '');
      } else {
          setEditingId(null);
          setItemName('');
          setItemCategory('');
          setItemStock('');
          setItemMinStock('5');
          setItemUnit('pcs');
          setItemDescription('');
      }
      setShowModal(true);
  };

  const handleSaveItem = async () => {
    if (!itemName || !itemStock) return;

    let icon = 'inventory_2';
    if (itemCategory === 'food') icon = 'restaurant';
    if (itemCategory === 'drink') icon = 'local_drink';
    if (itemCategory === 'ingredient') icon = 'nutrition';

    const stockNum = Number(itemStock);
    const minStockNum = Number(itemMinStock);
    const status = calculateStatus(stockNum, minStockNum);

    const itemData: InventoryItem = {
        id: editingId || generateId(),
        name: itemName,
        category: itemCategory || 'general',
        stock: stockNum,
        unit: itemUnit,
        minStock: minStockNum,
        status: status,
        icon: icon,
        description: itemDescription
    };

    setIsAnimating(true);
    if (editingId) {
        await updateInventoryItem(itemData);
    } else {
        await addInventoryItem(itemData);
    }
    
    setTimeout(() => {
        setIsAnimating(false);
        setShowModal(false);
    }, 300);
  };

  const handleDelete = async (id: string) => {
      await deleteInventoryItem(id);
      setDeleteConfirmId(null);
  };

  const handleQuickStockUpdate = async (e: React.MouseEvent, item: InventoryItem, delta: number) => {
      e.stopPropagation();
      const newStock = Math.max(0, item.stock + delta);
      const newStatus = calculateStatus(newStock, item.minStock);

      await updateInventoryItem({
          ...item,
          stock: newStock,
          status: newStatus
      });
  };

  // --- Derived State ---

  const filteredItems = useMemo(() => {
    return inventory
        .filter(item => {
            // Category Filter
            if (categoryFilter !== 'all') {
                if (categoryFilter === 'low-stock') {
                    if (item.status === 'in-stock') return false;
                } else if (item.category !== categoryFilter) {
                    return false;
                }
            }
            // Search Filter
            if (searchQuery && !item.name.toLowerCase().includes(searchQuery.toLowerCase())) {
                return false;
            }
            return true;
        })
        .sort((a, b) => {
            if (sortOrder === 'name') return a.name.localeCompare(b.name);
            if (sortOrder === 'stock-asc') return a.stock - b.stock;
            if (sortOrder === 'stock-desc') return b.stock - a.stock;
            return 0;
        });
  }, [inventory, categoryFilter, searchQuery, sortOrder]);

  const stats = useMemo(() => {
      return {
          total: inventory.length,
          low: inventory.filter(i => i.status === 'low-stock').length,
          out: inventory.filter(i => i.status === 'out-of-stock').length
      };
  }, [inventory]);

  // Use dynamic categories from DataContext + Static filters
  const filterChips = useMemo(() => {
      const staticFilters = [
          { id: 'all', label: t('inventory.filter_all') },
          { id: 'low-stock', label: t('inventory.filter_low') }
      ];
      
      // Default standard categories if custom ones aren't mapped yet, or use context categories
      // We map the category IDs to labels. 
      // Note: Inventory 'category' field is currently a string, typically matching category IDs.
      const categoryFilters = categories.map(c => ({ id: c.id, label: c.name }));
      
      // Add standard fallbacks if context categories are empty (though DataContext initializes defaults)
      if (categoryFilters.length === 0) {
          return [
              ...staticFilters,
              { id: 'food', label: t('inventory.filter_food') },
              { id: 'drink', label: t('inventory.filter_drink') },
              { id: 'ingredient', label: t('inventory.filter_ingredient') },
          ];
      }

      return [...staticFilters, ...categoryFilters];
  }, [categories, t]);

  return (
    <div className="flex flex-col h-full w-full bg-background-light dark:bg-background-dark overflow-hidden relative">
      
      {/* Header Section */}
      <header className="flex flex-col gap-6 px-6 pt-8 pb-4 z-10 sticky top-0 bg-background-light dark:bg-background-dark">
        <div className="flex items-center justify-between">
            <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{t('inventory.title')}</h1>
                <p className="text-xs text-slate-500 dark:text-gray-400">{t('inventory.subtitle')}</p>
            </div>
            <div className="flex gap-3">
                <div className="bg-white dark:bg-surface-dark rounded-xl p-1 border border-gray-200 dark:border-white/10 flex">
                    <button 
                        onClick={() => setViewMode('grid')}
                        className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-gray-100 dark:bg-white/10 text-slate-900 dark:text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                        title="Grid View"
                    >
                        <span className="material-symbols-outlined text-[20px]">grid_view</span>
                    </button>
                    <button 
                        onClick={() => setViewMode('list')}
                        className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-gray-100 dark:bg-white/10 text-slate-900 dark:text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                        title="List View"
                    >
                        <span className="material-symbols-outlined text-[20px]">view_list</span>
                    </button>
                </div>
                <button 
                    onClick={() => openModal()}
                    className="flex items-center justify-center gap-2 px-5 h-12 rounded-xl bg-slate-900 dark:bg-primary text-white dark:text-background-dark hover:opacity-90 transition-all font-bold text-sm shadow-lg shadow-slate-900/20 dark:shadow-primary/20 active:scale-95"
                >
                    <span className="material-symbols-outlined text-[20px]">add</span>
                    <span className="hidden sm:inline">{t('inventory.add_item')}</span>
                </button>
            </div>
        </div>

        {/* Live Stats Dashboard */}
        <div className="grid grid-cols-3 gap-4">
            <div className="bg-white dark:bg-surface-dark p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-white/5 flex items-center gap-3 relative overflow-hidden group">
                <div className="absolute right-0 top-0 w-24 h-24 bg-blue-500/5 rounded-full -mr-6 -mt-6 group-hover:scale-110 transition-transform"></div>
                <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400 z-10 shrink-0">
                    <span className="material-symbols-outlined">inventory_2</span>
                </div>
                <div className="z-10 overflow-hidden">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider truncate">Total Items</p>
                    <p className="text-xl font-black text-slate-900 dark:text-white">{stats.total}</p>
                </div>
            </div>
            <div className="bg-white dark:bg-surface-dark p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-white/5 flex items-center gap-3 relative overflow-hidden group">
                <div className="absolute right-0 top-0 w-24 h-24 bg-amber-500/5 rounded-full -mr-6 -mt-6 group-hover:scale-110 transition-transform"></div>
                <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400 z-10 shrink-0">
                    <span className="material-symbols-outlined">warning</span>
                </div>
                <div className="z-10 overflow-hidden">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider truncate">Low Stock</p>
                    <p className="text-xl font-black text-slate-900 dark:text-white">{stats.low}</p>
                </div>
            </div>
            <div className="bg-white dark:bg-surface-dark p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-white/5 flex items-center gap-3 relative overflow-hidden group">
                <div className="absolute right-0 top-0 w-24 h-24 bg-red-500/5 rounded-full -mr-6 -mt-6 group-hover:scale-110 transition-transform"></div>
                <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-500/20 flex items-center justify-center text-red-600 dark:text-red-400 z-10 shrink-0">
                    <span className="material-symbols-outlined">block</span>
                </div>
                <div className="z-10 overflow-hidden">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider truncate">Out of Stock</p>
                    <p className="text-xl font-black text-slate-900 dark:text-white">{stats.out}</p>
                </div>
            </div>
        </div>

        {/* Filters & Search */}
        <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1 h-11 rounded-xl bg-white dark:bg-surface-dark shadow-sm border border-slate-200 dark:border-none overflow-hidden group focus-within:ring-2 focus-within:ring-primary/50 transition-all">
                <div className="grid place-items-center h-full w-10 text-slate-400 dark:text-gray-500 absolute top-0 left-0">
                    <span className="material-symbols-outlined text-[20px]">search</span>
                </div>
                <input 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="peer h-full w-full outline-none text-sm text-slate-700 dark:text-white pl-10 pr-2 bg-transparent placeholder-slate-400 dark:placeholder-gray-500 border-none focus:ring-0" 
                    placeholder={t('inventory.search')}
                    type="text"
                />
            </div>
            
            <div className="relative min-w-[160px]">
                <select 
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value as any)}
                    className="w-full h-11 appearance-none bg-white dark:bg-surface-dark border border-slate-200 dark:border-none rounded-xl pl-3 pr-8 text-sm font-bold text-slate-700 dark:text-white focus:ring-2 focus:ring-primary cursor-pointer outline-none"
                >
                    <option value="name">{t('inventory.sort_name')}</option>
                    <option value="stock-asc">{t('inventory.sort_low')}</option>
                    <option value="stock-desc">{t('inventory.sort_high')}</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500 dark:text-gray-400">
                    <span className="material-symbols-outlined text-[20px]">sort</span>
                </div>
            </div>
        </div>

        {/* Filter Chips Row */}
        <div className="w-full shrink-0 -mt-2">
            <div className="flex gap-2 pb-2 overflow-x-auto no-scrollbar">
                {filterChips.map(chip => (
                    <button 
                        key={chip.id}
                        onClick={() => setCategoryFilter(chip.id)}
                        className={`flex h-8 shrink-0 items-center justify-center px-4 rounded-lg transition-all border ${
                            categoryFilter === chip.id 
                            ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-transparent font-bold shadow-md' 
                            : 'bg-white dark:bg-surface-dark border-slate-200 dark:border-transparent text-slate-600 dark:text-gray-400 hover:bg-slate-50 dark:hover:bg-white/5 font-medium'
                        }`}
                    >
                        <span className="text-xs">{chip.label}</span>
                    </button>
                ))}
            </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto px-6 pb-24 no-scrollbar">
          {filteredItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                  <div className="w-20 h-20 rounded-full bg-gray-100 dark:bg-white/5 flex items-center justify-center mb-4">
                      <span className="material-symbols-outlined text-4xl opacity-50">inventory_2</span>
                  </div>
                  <p className="font-bold">{t('inventory.no_items')}</p>
                  <p className="text-sm opacity-60 mt-1">Try adjusting your search or filters</p>
              </div>
          ) : viewMode === 'grid' ? (
            // GRID VIEW
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {filteredItems.map(item => {
                    const healthPercentage = Math.min(100, (item.stock / (item.minStock * 3)) * 100);
                    const isUpdated = updatedIds.has(item.id);
                    
                    const statusColor = item.status === 'out-of-stock' ? 'bg-red-500' 
                                      : item.status === 'low-stock' ? 'bg-amber-500' 
                                      : 'bg-emerald-500';
                    
                    const lightStatusClass = item.status === 'out-of-stock' ? 'bg-red-50 text-red-600 dark:bg-red-500/20 dark:text-red-400' 
                                           : item.status === 'low-stock' ? 'bg-amber-50 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400' 
                                           : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400';
                    
                    return (
                    <div 
                        key={item.id} 
                        className={`group bg-white dark:bg-surface-dark rounded-2xl p-4 shadow-sm hover:shadow-md border border-slate-100 dark:border-white/5 transition-all flex flex-col justify-between h-[200px] ${isUpdated ? 'ring-2 ring-primary bg-primary/5' : ''}`}
                    >
                        
                        {/* Top Row */}
                        <div className="flex justify-between items-start">
                            <div className="flex items-center gap-3">
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${lightStatusClass}`}>
                                    <span className="material-symbols-outlined">{item.icon}</span>
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-900 dark:text-white line-clamp-1 text-sm" title={item.name}>{item.name}</h3>
                                    <span className="text-xs text-slate-400 capitalize">{item.category}</span>
                                </div>
                            </div>
                            <button 
                                onClick={() => openModal(item)} 
                                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-300 hover:text-primary hover:bg-gray-100 dark:hover:bg-white/10 transition-all"
                            >
                                <span className="material-symbols-outlined text-[18px]">edit</span>
                            </button>
                        </div>

                        {/* Middle: Stock Stats */}
                        <div className="my-2">
                            <div className="flex justify-between items-end mb-1">
                                <span className={`text-3xl font-black transition-colors duration-300 ${isUpdated ? 'text-primary scale-110' : 'text-slate-900 dark:text-white'}`}>{item.stock}</span>
                                <span className="text-xs font-bold text-slate-400 mb-1">{item.unit}</span>
                            </div>
                            
                            {/* Visual Stock Bar */}
                            <div className="w-full h-2 bg-gray-100 dark:bg-white/10 rounded-full overflow-hidden">
                                <div 
                                    className={`h-full rounded-full transition-all duration-500 ease-out ${statusColor}`} 
                                    style={{ width: `${healthPercentage}%` }}
                                ></div>
                            </div>
                            
                            <div className="flex justify-between mt-1">
                                <span className={`text-[10px] font-bold uppercase tracking-wide ${item.status === 'out-of-stock' ? 'text-red-500' : item.status === 'low-stock' ? 'text-amber-500' : 'text-emerald-500'}`}>
                                    {item.status === 'out-of-stock' ? 'Out of Stock' : item.status === 'low-stock' ? 'Low Stock' : 'Healthy'}
                                </span>
                                <span className="text-[10px] text-slate-400">Min: {item.minStock}</span>
                            </div>
                        </div>

                        {/* Bottom: Quick Actions */}
                        <div className="flex gap-2 pt-2 border-t border-gray-100 dark:border-white/5">
                            <button 
                                onClick={(e) => handleQuickStockUpdate(e, item, -1)}
                                className="flex-1 h-9 rounded-lg bg-gray-50 dark:bg-white/5 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-500 dark:hover:text-red-400 transition-colors flex items-center justify-center group/btn"
                            >
                                <span className="material-symbols-outlined text-[18px] group-active/btn:scale-90 transition-transform">remove</span>
                            </button>
                            <button 
                                onClick={(e) => handleQuickStockUpdate(e, item, 1)}
                                className="flex-1 h-9 rounded-lg bg-gray-50 dark:bg-white/5 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 hover:text-emerald-500 dark:hover:text-emerald-400 transition-colors flex items-center justify-center group/btn"
                            >
                                <span className="material-symbols-outlined text-[18px] group-active/btn:scale-90 transition-transform">add</span>
                            </button>
                        </div>
                    </div>
                )})}
            </div>
          ) : (
            // LIST VIEW
            <div className="flex flex-col gap-2 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {filteredItems.map(item => {
                    const isUpdated = updatedIds.has(item.id);
                    const statusColor = item.status === 'out-of-stock' ? 'text-red-500' : item.status === 'low-stock' ? 'text-amber-500' : 'text-emerald-500';
                    const lightStatusClass = item.status === 'out-of-stock' ? 'bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400' : item.status === 'low-stock' ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400' : 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400';

                    return (
                        <div key={item.id} className={`flex items-center justify-between bg-white dark:bg-surface-dark p-3 rounded-xl border border-gray-100 dark:border-white/5 shadow-sm hover:border-primary/30 transition-all group ${isUpdated ? 'ring-2 ring-primary bg-primary/5' : ''}`}>
                            <div className="flex items-center gap-4 flex-1">
                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${lightStatusClass}`}>
                                    <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <h4 className="font-bold text-slate-900 dark:text-white truncate">{item.name}</h4>
                                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${lightStatusClass} bg-opacity-20`}>
                                            {item.status === 'out-of-stock' ? 'Out' : item.status === 'low-stock' ? 'Low' : 'OK'}
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-500 dark:text-gray-400 capitalize">{item.category}</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-6">
                                <div className="text-right w-20">
                                    <p className={`font-black text-slate-900 dark:text-white transition-transform ${isUpdated ? 'text-primary scale-110' : ''}`}>{item.stock} <span className="text-xs font-normal text-slate-400">{item.unit}</span></p>
                                    <p className="text-[10px] text-slate-400">Min: {item.minStock}</p>
                                </div>
                                
                                <div className="flex items-center gap-1 bg-gray-100 dark:bg-white/5 rounded-lg p-1">
                                    <button onClick={(e) => handleQuickStockUpdate(e, item, -1)} className="w-7 h-7 flex items-center justify-center rounded hover:bg-white dark:hover:bg-white/10 text-slate-600 dark:text-gray-300 transition-colors">
                                        <span className="material-symbols-outlined text-[16px]">remove</span>
                                    </button>
                                    <button onClick={(e) => handleQuickStockUpdate(e, item, 1)} className="w-7 h-7 flex items-center justify-center rounded hover:bg-white dark:hover:bg-white/10 text-slate-600 dark:text-gray-300 transition-colors">
                                        <span className="material-symbols-outlined text-[16px]">add</span>
                                    </button>
                                </div>

                                <button onClick={() => openModal(item)} className="p-2 text-slate-400 hover:text-primary transition-colors">
                                    <span className="material-symbols-outlined text-[20px]">edit</span>
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
          )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
          <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
              <div className="w-full max-w-lg bg-white dark:bg-surface-dark rounded-2xl shadow-2xl p-6 border border-gray-100 dark:border-white/5 animate-in zoom-in-95 flex flex-col max-h-[90vh]">
                  <div className="flex justify-between items-center mb-6">
                      <h3 className="text-xl font-bold text-slate-900 dark:text-white">{editingId ? t('inventory.modal_edit') : t('inventory.modal_new')}</h3>
                      <button onClick={() => setShowModal(false)} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 text-gray-500 transition-colors">
                          <span className="material-symbols-outlined">close</span>
                      </button>
                  </div>
                  
                  <div className="overflow-y-auto pr-2 -mr-2 space-y-5 flex-1">
                      {/* Basic Info */}
                      <div>
                          <p className="text-xs font-bold text-primary uppercase tracking-wider mb-3">{t('inventory.basic_info')}</p>
                          <div className="space-y-4">
                              <div>
                                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Name</label>
                                  <input 
                                     value={itemName}
                                     onChange={(e) => setItemName(e.target.value)}
                                     className="w-full h-11 px-4 rounded-xl bg-gray-50 dark:bg-background-dark border border-gray-200 dark:border-white/5 focus:ring-2 focus:ring-primary dark:text-white transition-all outline-none"
                                     placeholder="e.g. Tiger Beer"
                                  />
                              </div>
                              <div className="grid grid-cols-2 gap-4">
                                  <div>
                                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Category</label>
                                      <select 
                                         value={itemCategory}
                                         onChange={(e) => setItemCategory(e.target.value)}
                                         className="w-full h-11 px-4 rounded-xl bg-gray-50 dark:bg-background-dark border border-gray-200 dark:border-white/5 focus:ring-2 focus:ring-primary dark:text-white transition-all outline-none appearance-none"
                                      >
                                          <option value="">Select...</option>
                                          {categories.map(c => (
                                              <option key={c.id} value={c.id}>{c.name}</option>
                                          ))}
                                          {/* Fallbacks if empty */}
                                          {categories.length === 0 && (
                                              <>
                                                <option value="food">Food</option>
                                                <option value="drink">Drink</option>
                                                <option value="ingredient">Ingredient</option>
                                              </>
                                          )}
                                      </select>
                                  </div>
                                  <div>
                                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t('inventory.unit')}</label>
                                      <input 
                                         value={itemUnit}
                                         onChange={(e) => setItemUnit(e.target.value)}
                                         className="w-full h-11 px-4 rounded-xl bg-gray-50 dark:bg-background-dark border border-gray-200 dark:border-white/5 focus:ring-2 focus:ring-primary dark:text-white transition-all outline-none"
                                         placeholder="e.g. cans"
                                      />
                                  </div>
                              </div>
                          </div>
                      </div>

                      {/* Stock Details */}
                      <div>
                          <p className="text-xs font-bold text-primary uppercase tracking-wider mb-3">{t('inventory.stock_details')}</p>
                          <div className="grid grid-cols-2 gap-4">
                              <div>
                                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t('inventory.current')}</label>
                                  <input 
                                     type="number"
                                     value={itemStock}
                                     onChange={(e) => setItemStock(e.target.value)}
                                     className="w-full h-11 px-4 rounded-xl bg-gray-50 dark:bg-background-dark border border-gray-200 dark:border-white/5 focus:ring-2 focus:ring-primary dark:text-white font-bold outline-none"
                                     placeholder="0"
                                  />
                              </div>
                              <div>
                                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t('inventory.min_threshold')}</label>
                                  <input 
                                     type="number"
                                     value={itemMinStock}
                                     onChange={(e) => setItemMinStock(e.target.value)}
                                     className="w-full h-11 px-4 rounded-xl bg-gray-50 dark:bg-background-dark border border-gray-200 dark:border-white/5 focus:ring-2 focus:ring-primary dark:text-white outline-none"
                                     placeholder="5"
                                  />
                              </div>
                          </div>
                      </div>

                      {/* Description with AI */}
                      <div className="bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/10 dark:to-indigo-900/10 p-4 rounded-2xl border border-purple-100 dark:border-white/5">
                          <div className="flex justify-between items-center mb-2">
                              <label className="block text-xs font-bold text-purple-700 dark:text-purple-300 uppercase">{t('inventory.description')}</label>
                              <button 
                                onClick={handleGenerateDescription}
                                disabled={isGenerating || !itemName}
                                className="flex items-center gap-1 text-[10px] font-bold text-white bg-purple-500 px-2 py-1 rounded-lg hover:bg-purple-600 disabled:opacity-50 transition-colors shadow-sm"
                              >
                                  <span className={`material-symbols-outlined text-[14px] ${isGenerating ? 'animate-spin' : ''}`}>auto_awesome</span>
                                  {isGenerating ? t('inventory.thinking') : t('inventory.ai_fill')}
                              </button>
                          </div>
                          <textarea 
                             value={itemDescription}
                             onChange={(e) => setItemDescription(e.target.value)}
                             className="w-full h-20 p-3 rounded-xl bg-white dark:bg-black/20 border-none focus:ring-2 focus:ring-purple-500 dark:text-white resize-none text-sm placeholder-purple-300 outline-none"
                             placeholder="AI generated details..."
                          ></textarea>
                      </div>
                  </div>

                  <div className="mt-6 pt-4 border-t border-gray-100 dark:border-white/5 flex gap-3">
                      {editingId && (
                           <button 
                             onClick={() => setDeleteConfirmId(editingId)}
                             className="px-4 h-12 rounded-xl bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 font-bold hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors flex items-center justify-center"
                           >
                               <span className="material-symbols-outlined">delete</span>
                           </button>
                      )}
                      <button 
                          onClick={() => setShowModal(false)}
                          className="flex-1 h-12 rounded-xl bg-gray-100 dark:bg-white/5 font-bold text-slate-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/10 transition-colors"
                      >
                          {t('inventory.cancel')}
                      </button>
                      <button 
                          onClick={handleSaveItem}
                          className="flex-1 h-12 rounded-xl bg-primary text-background-dark font-bold shadow-lg shadow-primary/20 hover:bg-primary-dark transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                      >
                          {isAnimating && <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>}
                          {editingId ? t('inventory.update') : t('inventory.save')}
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
          <div className="absolute inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
               <div className="w-full max-w-sm bg-white dark:bg-surface-dark rounded-2xl shadow-2xl p-6 border border-gray-100 dark:border-white/5 animate-in zoom-in-95">
                    <div className="text-center mb-6">
                        <div className="w-16 h-16 bg-red-100 dark:bg-red-500/20 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                            <span className="material-symbols-outlined text-3xl">delete_forever</span>
                        </div>
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">{t('inventory.delete_title')}</h2>
                        <p className="text-slate-500 dark:text-gray-400 text-sm">
                            {t('inventory.delete_confirm')}
                        </p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <button 
                            onClick={() => setDeleteConfirmId(null)}
                            className="py-3 rounded-xl font-bold text-slate-600 dark:text-gray-300 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 transition-colors"
                        >
                            {t('inventory.cancel')}
                        </button>
                        <button 
                            onClick={() => handleDelete(deleteConfirmId)}
                            className="py-3 rounded-xl font-bold bg-red-500 text-white hover:bg-red-600 shadow-lg shadow-red-500/20 transition-all active:scale-[0.98]"
                        >
                            {t('inventory.delete')}
                        </button>
                    </div>
               </div>
          </div>
      )}
    </div>
  );
};

export default Inventory;
