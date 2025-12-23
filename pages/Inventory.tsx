import React, { useState } from 'react';
import { generateItemDescription } from '../services/geminiService';
import { InventoryItem } from '../types';
import { useData } from '../contexts/DataContext';
import { useLanguage } from '../contexts/LanguageContext';

const Inventory: React.FC = () => {
  const { inventory, addInventoryItem, updateInventoryItem, deleteInventoryItem } = useData();
  const { t } = useLanguage();
  const [showModal, setShowModal] = useState(false);
  
  // Form State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [itemName, setItemName] = useState('');
  const [itemCategory, setItemCategory] = useState('');
  const [itemStock, setItemStock] = useState('');
  const [itemMinStock, setItemMinStock] = useState('5');
  const [itemUnit, setItemUnit] = useState('pcs');
  const [itemDescription, setItemDescription] = useState('');
  
  // UI State
  const [isGenerating, setIsGenerating] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [sortOrder, setSortOrder] = useState<'name' | 'stock-asc' | 'stock-desc'>('stock-asc');
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const handleGenerateDescription = async () => {
    if (!itemName) return;
    setIsGenerating(true);
    // Simple logic to guess category if empty based on name
    if (!itemCategory) {
        if (itemName.toLowerCase().includes('beer') || itemName.toLowerCase().includes('water') || itemName.toLowerCase().includes('coffee')) setItemCategory('drink');
        else if (itemName.toLowerCase().includes('beef') || itemName.toLowerCase().includes('rice') || itemName.toLowerCase().includes('chicken')) setItemCategory('food');
        else setItemCategory('ingredient');
    }
    const cat = itemCategory || 'food';
    const desc = await generateItemDescription(itemName, cat);
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

  const handleSaveItem = () => {
    if (!itemName || !itemCategory || !itemStock) return;

    let icon = 'inventory_2';
    if (itemCategory === 'food') icon = 'restaurant';
    if (itemCategory === 'drink') icon = 'local_drink';
    if (itemCategory === 'ingredient') icon = 'nutrition';

    const stockNum = Number(itemStock);
    const minStockNum = Number(itemMinStock);

    if (editingId) {
        // Update Existing
        const existingItem = inventory.find(i => i.id === editingId);
        if (existingItem) {
            updateInventoryItem({
                ...existingItem,
                name: itemName,
                category: itemCategory,
                stock: stockNum,
                minStock: minStockNum,
                unit: itemUnit,
                status: stockNum <= minStockNum ? 'low-stock' : 'in-stock',
                description: itemDescription,
                icon: icon
            });
        }
    } else {
        // Create New
        const newItem: InventoryItem = {
            id: Date.now().toString(),
            name: itemName,
            category: itemCategory,
            stock: stockNum,
            unit: itemUnit,
            minStock: minStockNum,
            status: stockNum <= minStockNum ? 'low-stock' : 'in-stock',
            icon: icon,
            description: itemDescription
        };
        addInventoryItem(newItem);
    }

    setShowModal(false);
  };

  const handleDelete = (id: string) => {
      deleteInventoryItem(id);
      setDeleteConfirmId(null);
  };

  const handleUpdateStock = (item: InventoryItem, delta: number) => {
      const newStock = Math.max(0, item.stock + delta);
      updateInventoryItem({
          ...item,
          stock: newStock,
          status: newStock <= item.minStock ? 'low-stock' : 'in-stock'
      });
  };

  // Filter & Sort Logic
  const filteredItems = inventory
    .filter(item => {
        // Category Filter
        if (categoryFilter !== 'all') {
            if (categoryFilter === 'low-stock') {
                if (item.stock > item.minStock) return false;
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

  const filterChips = [
      { id: 'all', label: t('inventory.filter_all') },
      { id: 'low-stock', label: t('inventory.filter_low') },
      { id: 'food', label: t('inventory.filter_food') },
      { id: 'drink', label: t('inventory.filter_drink') },
      { id: 'ingredient', label: t('inventory.filter_ingredient') },
  ];

  return (
    <div className="flex flex-col h-full w-full bg-background-light dark:bg-background-dark overflow-hidden relative">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between px-6 pt-12 pb-4 z-10 sticky top-0 bg-background-light dark:bg-background-dark gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{t('inventory.title')}</h1>
          <p className="text-xs text-slate-500 dark:text-gray-400">{t('inventory.subtitle')}</p>
        </div>
        <div className="flex gap-2">
           <button className="flex items-center justify-center w-10 h-10 rounded-full bg-slate-200 dark:bg-surface-dark text-slate-900 dark:text-primary hover:bg-slate-300 dark:hover:bg-opacity-80 transition-colors">
             <span className="material-symbols-outlined text-[20px]">print</span>
           </button>
           <button 
             onClick={() => openModal()}
             className="flex items-center justify-center gap-2 px-4 h-10 rounded-full bg-primary text-background-dark hover:bg-primary-dark transition-colors font-bold text-sm shadow-lg shadow-primary/20"
           >
             <span className="material-symbols-outlined text-[20px]">add</span>
             {t('inventory.add_item')}
           </button>
        </div>
      </header>

      {/* Controls Row */}
      <div className="px-6 pb-2 shrink-0 flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1 h-11 rounded-xl bg-white dark:bg-surface-dark shadow-sm border border-slate-200 dark:border-none overflow-hidden group focus-within:ring-2 focus-within:ring-primary/50 transition-all">
           <div className="grid place-items-center h-full w-10 text-slate-400 dark:text-primary/70 absolute top-0 left-0">
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
        
        {/* Sort Dropdown */}
        <div className="relative min-w-[140px]">
             <select 
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as any)}
                className="w-full h-11 appearance-none bg-white dark:bg-surface-dark border border-slate-200 dark:border-none rounded-xl pl-3 pr-8 text-sm font-bold text-slate-700 dark:text-white focus:ring-2 focus:ring-primary cursor-pointer"
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

      {/* Filter Chips */}
      <div className="w-full shrink-0">
         <div className="flex gap-2 px-6 py-3 overflow-x-auto no-scrollbar">
            {filterChips.map(chip => (
                <button 
                    key={chip.id}
                    onClick={() => setCategoryFilter(chip.id)}
                    className={`flex h-8 shrink-0 items-center justify-center px-4 rounded-lg transition-all border ${
                        categoryFilter === chip.id 
                        ? 'bg-slate-800 dark:bg-white text-white dark:text-slate-900 border-transparent font-bold' 
                        : 'bg-white dark:bg-surface-dark border-slate-200 dark:border-transparent text-slate-600 dark:text-gray-400 hover:bg-slate-50 dark:hover:bg-white/5 font-medium'
                    }`}
                >
                    <span className="text-xs">{chip.label}</span>
                </button>
            ))}
         </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-6 pb-24 space-y-3 no-scrollbar">
          {filteredItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                  <span className="material-symbols-outlined text-5xl mb-3 opacity-50">inventory_2</span>
                  <p>{t('inventory.no_items')}</p>
              </div>
          ) : (
            filteredItems.map(item => (
              <div key={item.id} className="group flex items-center justify-between p-4 rounded-2xl bg-white dark:bg-surface-dark border border-slate-100 dark:border-white/5 shadow-sm hover:shadow-md transition-all">
                  <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                          item.status === 'low-stock' 
                          ? 'bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400' 
                          : item.status === 'out-of-stock'
                          ? 'bg-slate-800 text-white dark:bg-white/10 dark:text-gray-300'
                          : 'bg-slate-100 text-slate-600 dark:bg-white/5 dark:text-gray-300'
                      }`}>
                          <span className="material-symbols-outlined">{item.icon}</span>
                      </div>
                      <div>
                          <h3 className="font-bold text-slate-900 dark:text-white">{item.name}</h3>
                          <div className="flex items-center gap-2 mt-0.5">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${
                                  item.status === 'low-stock' 
                                  ? 'bg-amber-100 text-amber-600' 
                                  : item.status === 'out-of-stock' 
                                  ? 'bg-slate-200 text-slate-600'
                                  : 'bg-emerald-100 text-emerald-600'
                              }`}>
                                  {item.status === 'low-stock' ? t('inventory.restock') : item.status === 'out-of-stock' ? t('pos.out_of_stock') : t('inventory.healthy')}
                              </span>
                              <span className="text-xs text-slate-400">• {item.category}</span>
                          </div>
                      </div>
                  </div>
                  
                  <div className="flex items-center gap-6">
                      <div className="text-right hidden sm:block">
                          <p className="text-lg font-bold text-slate-900 dark:text-white">{item.stock} <span className="text-xs font-normal text-slate-400">{item.unit}</span></p>
                          <p className="text-xs text-slate-400">{t('inventory.min_threshold')}: {item.minStock}</p>
                      </div>

                      <div className="flex items-center gap-2">
                           <button 
                                onClick={() => handleUpdateStock(item, -1)}
                                className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-white/5 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-white/10 text-slate-600 dark:text-gray-300 transition-colors"
                           >
                               <span className="material-symbols-outlined text-[18px]">remove</span>
                           </button>
                           <button 
                                onClick={() => handleUpdateStock(item, 1)}
                                className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-white/5 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-white/10 text-slate-600 dark:text-gray-300 transition-colors"
                           >
                               <span className="material-symbols-outlined text-[18px]">add</span>
                           </button>
                           <button 
                                onClick={() => openModal(item)}
                                className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-white/5 flex items-center justify-center hover:bg-primary hover:text-white dark:hover:bg-primary transition-colors text-slate-400 ml-2"
                           >
                               <span className="material-symbols-outlined text-[18px]">edit</span>
                           </button>
                      </div>
                  </div>
              </div>
            ))
          )}
      </div>

      {/* Modal */}
      {showModal && (
          <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
              <div className="w-full max-w-lg bg-white dark:bg-surface-dark rounded-2xl shadow-2xl p-6 border border-gray-100 dark:border-white/5 animate-in zoom-in-95 flex flex-col max-h-[90vh]">
                  <div className="flex justify-between items-center mb-6">
                      <h3 className="text-xl font-bold text-slate-900 dark:text-white">{editingId ? t('inventory.modal_edit') : t('inventory.modal_new')}</h3>
                      <button onClick={() => setShowModal(false)} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 text-gray-500">
                          <span className="material-symbols-outlined">close</span>
                      </button>
                  </div>
                  
                  <div className="overflow-y-auto pr-2 -mr-2 space-y-4 flex-1">
                      {/* Basic Info */}
                      <div>
                          <p className="text-xs font-bold text-primary uppercase tracking-wider mb-3">{t('inventory.basic_info')}</p>
                          <div className="grid grid-cols-1 gap-4">
                              <div>
                                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Name</label>
                                  <input 
                                     value={itemName}
                                     onChange={(e) => setItemName(e.target.value)}
                                     className="w-full h-11 px-4 rounded-xl bg-gray-50 dark:bg-background-dark border border-gray-200 dark:border-white/5 focus:ring-2 focus:ring-primary dark:text-white"
                                     placeholder="Item Name"
                                  />
                              </div>
                              <div>
                                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Category</label>
                                  <select 
                                     value={itemCategory}
                                     onChange={(e) => setItemCategory(e.target.value)}
                                     className="w-full h-11 px-4 rounded-xl bg-gray-50 dark:bg-background-dark border border-gray-200 dark:border-white/5 focus:ring-2 focus:ring-primary dark:text-white"
                                  >
                                      <option value="">Select Category</option>
                                      <option value="food">Food</option>
                                      <option value="drink">Drink</option>
                                      <option value="ingredient">Ingredient</option>
                                  </select>
                              </div>
                          </div>
                      </div>

                      {/* Stock Details */}
                      <div>
                          <p className="text-xs font-bold text-primary uppercase tracking-wider mb-3 mt-2">{t('inventory.stock_details')}</p>
                          <div className="grid grid-cols-3 gap-4">
                              <div>
                                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t('inventory.current')}</label>
                                  <input 
                                     type="number"
                                     value={itemStock}
                                     onChange={(e) => setItemStock(e.target.value)}
                                     className="w-full h-11 px-4 rounded-xl bg-gray-50 dark:bg-background-dark border border-gray-200 dark:border-white/5 focus:ring-2 focus:ring-primary dark:text-white font-bold"
                                     placeholder="0"
                                  />
                              </div>
                              <div>
                                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t('inventory.min_threshold')}</label>
                                  <input 
                                     type="number"
                                     value={itemMinStock}
                                     onChange={(e) => setItemMinStock(e.target.value)}
                                     className="w-full h-11 px-4 rounded-xl bg-gray-50 dark:bg-background-dark border border-gray-200 dark:border-white/5 focus:ring-2 focus:ring-primary dark:text-white"
                                     placeholder="5"
                                  />
                              </div>
                              <div>
                                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t('inventory.unit')}</label>
                                  <input 
                                     value={itemUnit}
                                     onChange={(e) => setItemUnit(e.target.value)}
                                     className="w-full h-11 px-4 rounded-xl bg-gray-50 dark:bg-background-dark border border-gray-200 dark:border-white/5 focus:ring-2 focus:ring-primary dark:text-white"
                                     placeholder="pcs"
                                  />
                              </div>
                          </div>
                      </div>

                      {/* Description with AI */}
                      <div>
                          <div className="flex justify-between items-center mb-1">
                              <label className="block text-xs font-bold text-slate-500 uppercase">{t('inventory.description')}</label>
                              <button 
                                onClick={handleGenerateDescription}
                                disabled={isGenerating || !itemName}
                                className="flex items-center gap-1 text-[10px] font-bold text-purple-500 hover:text-purple-600 disabled:opacity-50"
                              >
                                  <span className={`material-symbols-outlined text-[14px] ${isGenerating ? 'animate-spin' : ''}`}>auto_awesome</span>
                                  {isGenerating ? t('inventory.thinking') : t('inventory.ai_fill')}
                              </button>
                          </div>
                          <textarea 
                             value={itemDescription}
                             onChange={(e) => setItemDescription(e.target.value)}
                             className="w-full h-24 p-4 rounded-xl bg-gray-50 dark:bg-background-dark border border-gray-200 dark:border-white/5 focus:ring-2 focus:ring-primary dark:text-white resize-none"
                             placeholder="Details about the item..."
                          ></textarea>
                      </div>
                  </div>

                  <div className="mt-6 pt-4 border-t border-gray-100 dark:border-white/5 flex gap-3">
                      {editingId && (
                           <button 
                             onClick={() => setDeleteConfirmId(editingId)}
                             className="px-4 h-12 rounded-xl bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 font-bold hover:bg-red-100 dark:hover:bg-red-500/20"
                           >
                               <span className="material-symbols-outlined">delete</span>
                           </button>
                      )}
                      <button 
                          onClick={() => setShowModal(false)}
                          className="flex-1 h-12 rounded-xl bg-gray-100 dark:bg-white/5 font-bold text-slate-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/10"
                      >
                          {t('inventory.cancel')}
                      </button>
                      <button 
                          onClick={handleSaveItem}
                          className="flex-1 h-12 rounded-xl bg-primary text-background-dark font-bold shadow-lg shadow-primary/20 hover:bg-primary-dark"
                      >
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
                            onClick={() => {
                                handleDelete(deleteConfirmId);
                                setShowModal(false);
                            }}
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