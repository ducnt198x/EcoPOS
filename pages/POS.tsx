import React, { useState, useEffect } from 'react';
import { MenuItem, CartItem, InventoryItem } from '../types';
import { useNavigate, useLocation } from 'react-router-dom';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';

const POS: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { t } = useLanguage();
  const { menuItems, activeOrders, updateActiveOrder, tables, inventory, updateMenuItem, addMenuItem, deleteMenuItem, taxRate, updateTaxRate } = useData();
  
  // UI State
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [menuSearch, setMenuSearch] = useState(''); // Main menu search
  const [cartSearch, setCartSearch] = useState(''); // Cart specific search
  const [isEditMode, setIsEditMode] = useState(false);
  
  // Order State
  const [discount, setDiscount] = useState(0);
  const [orderType, setOrderType] = useState<'dine-in' | 'takeaway' | 'delivery'>('dine-in');
  const [orderNote, setOrderNote] = useState('');
  
  // Use state from navigation or default to T1
  const [selectedTableId, setSelectedTableId] = useState<string>(location.state?.tableId || 'T1');

  const categories = [
    { id: 'all', name: t('pos.cat_all'), icon: 'restaurant_menu' },
    { id: 'pho', name: t('pos.cat_pho'), icon: 'ramen_dining' },
    { id: 'rice', name: t('pos.cat_rice'), icon: 'rice_bowl' },
    { id: 'banhmi', name: t('pos.cat_banhmi'), icon: 'lunch_dining' },
    { id: 'beverages', name: t('pos.cat_beverages'), icon: 'local_cafe' },
    { id: 'desserts', name: t('pos.cat_desserts'), icon: 'icecream' },
  ];

  // Ensure selectedTableId matches an existing table, otherwise fallback
  useEffect(() => {
     if (location.state?.tableId) {
         setSelectedTableId(location.state.tableId);
     }
  }, [location.state]);

  // Computed Cart from Global State
  const cart = activeOrders[selectedTableId] || [];

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isClearCartConfirmOpen, setIsClearCartConfirmOpen] = useState(false);
  const [isOrderConfirmationOpen, setIsOrderConfirmationOpen] = useState(false);
  const [isDiscountModalOpen, setIsDiscountModalOpen] = useState(false);
  const [isTaxModalOpen, setIsTaxModalOpen] = useState(false);
  const [isOrderNoteModalOpen, setIsOrderNoteModalOpen] = useState(false);
  
  // Item Detail Modal State
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [itemQuantity, setItemQuantity] = useState(1);
  const [itemNotes, setItemNotes] = useState('');

  // Edit Menu Item Modal State
  const [isEditItemModalOpen, setIsEditItemModalOpen] = useState(false);
  const [editFormId, setEditFormId] = useState<string | null>(null);
  const [editFormName, setEditFormName] = useState('');
  const [editFormPrice, setEditFormPrice] = useState('');
  const [editFormCategory, setEditFormCategory] = useState('pho');
  const [editFormImage, setEditFormImage] = useState('');
  const [editFormDescription, setEditFormDescription] = useState('');
  const [editFormStock, setEditFormStock] = useState('');

  // Stock Alert State
  const [stockAlert, setStockAlert] = useState<{ message: string; type: 'warning' | 'error' | 'success' } | null>(null);

  useEffect(() => {
    if (stockAlert) {
      const timer = setTimeout(() => setStockAlert(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [stockAlert]);

  // Filter Menu Items
  const filteredItems = menuItems.filter(item => {
    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
    const matchesSearch = item.name.toLowerCase().includes(menuSearch.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const filteredCart = cart.filter(item => item.name.toLowerCase().includes(cartSearch.toLowerCase()));

  const updateCart = (newCart: CartItem[]) => {
      updateActiveOrder(selectedTableId, newCart);
  };

  const getItemTotalInCart = (itemName: string) => {
      // Find all cart items with this name (ignoring notes differences)
      return cart.filter(i => i.name === itemName).reduce((acc, i) => acc + i.quantity, 0);
  };

  // Helper to get real-time stock from Inventory
  const getInventoryItem = (menuItem: MenuItem): InventoryItem | undefined => {
      return inventory.find(i => i.name === menuItem.name);
  };

  // Calculates stock available relative to what is ALREADY in the specific table's cart
  const getAvailableStock = (menuItem: MenuItem) => {
      // Prioritize Menu Item specific stock if it exists, otherwise check inventory, otherwise assume unlimited
      let stock = menuItem.stock;
      if (stock === undefined) {
         const invItem = getInventoryItem(menuItem);
         stock = invItem ? invItem.stock : 9999;
      }
      
      const inCart = getItemTotalInCart(menuItem.name);
      return Math.max(0, stock - inCart);
  };

  // Real-time stock check effect
  useEffect(() => {
      if (isModalOpen && selectedItem) {
          const available = getAvailableStock(selectedItem);
          
          if (available === 0) {
              setIsModalOpen(false);
              setStockAlert({ message: `${selectedItem.name} just went out of stock!`, type: 'error' });
          } else if (itemQuantity > available) {
              setItemQuantity(available);
              setStockAlert({ message: `Stock limited. Quantity adjusted to ${available}.`, type: 'warning' });
          }
      }
  }, [inventory, activeOrders, selectedItem, isModalOpen, menuItems]);

  const handleItemClick = (item: MenuItem) => {
    if (isEditMode) return; // Disable ordering in edit mode

    const available = getAvailableStock(item);

    if (available <= 0) {
        setStockAlert({ message: `${item.name} is currently out of stock`, type: 'error' });
        return;
    }

    setSelectedItem(item);
    setItemQuantity(1);
    setItemNotes('');
    setIsModalOpen(true);
  };

  // --- Edit Mode Handlers ---

  const handleOpenEditModal = (item?: MenuItem) => {
      if (item) {
          setEditFormId(item.id);
          setEditFormName(item.name);
          setEditFormPrice(item.price.toString());
          setEditFormCategory(item.category);
          setEditFormImage(item.image);
          setEditFormDescription(item.description || '');
          setEditFormStock(item.stock !== undefined ? item.stock.toString() : '');
      } else {
          setEditFormId(null);
          setEditFormName('');
          setEditFormPrice('');
          setEditFormCategory(selectedCategory !== 'all' ? selectedCategory : 'pho');
          setEditFormImage('');
          setEditFormDescription('');
          setEditFormStock('20');
      }
      setIsEditItemModalOpen(true);
  };

  const handleSaveMenuItem = () => {
      if (!editFormName || !editFormPrice) return;

      const price = parseFloat(editFormPrice);
      const stock = editFormStock ? parseInt(editFormStock) : undefined;
      // Default placeholder image if empty
      const image = editFormImage || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=500&q=80';

      const itemData: MenuItem = {
          id: editFormId || Date.now().toString(),
          name: editFormName,
          price,
          category: editFormCategory,
          image,
          description: editFormDescription,
          stock
      };

      if (editFormId) {
          updateMenuItem(itemData);
          setStockAlert({ message: 'Item updated successfully', type: 'success' });
      } else {
          addMenuItem(itemData);
          setStockAlert({ message: 'New item added to menu', type: 'success' });
      }

      setIsEditItemModalOpen(false);
  };

  const handleDeleteMenuItem = (id: string) => {
      if (window.confirm('Are you sure you want to delete this item?')) {
          deleteMenuItem(id);
      }
  };

  const handleQuickStockUpdate = (e: React.MouseEvent, item: MenuItem, delta: number) => {
      e.stopPropagation();
      const currentStock = item.stock || 0;
      const newStock = Math.max(0, currentStock + delta);
      updateMenuItem({ ...item, stock: newStock });
  };

  const confirmAddToCart = () => {
    if (!selectedItem) return;
    
    // Final check before adding
    const available = getAvailableStock(selectedItem);
    
    if (available <= 0) {
        setIsModalOpen(false);
        setStockAlert({ message: `Unable to add. ${selectedItem.name} is out of stock.`, type: 'error' });
        return;
    }

    if (itemQuantity > available) {
        setItemQuantity(available);
        setStockAlert({ message: `Only ${available} left. Please confirm again.`, type: 'warning' });
        return;
    }

    const existingIndex = cart.findIndex(i => i.id === selectedItem.id && (i.notes || '') === itemNotes.trim());
    let newCart = [...cart];

    if (existingIndex >= 0) {
        newCart[existingIndex] = {
            ...newCart[existingIndex],
            quantity: newCart[existingIndex].quantity + itemQuantity
        };
    } else {
        newCart.push({ ...selectedItem, quantity: itemQuantity, notes: itemNotes.trim() });
    }
    
    updateCart(newCart);
    
    // Check for low stock after addition (Prediction)
    if (available - itemQuantity <= 5 && available - itemQuantity > 0) {
        setStockAlert({ message: `Added to cart. ${selectedItem.name} is now low on stock!`, type: 'warning' });
    } else {
        setStockAlert({ message: `Added ${itemQuantity} ${selectedItem.name} to cart`, type: 'success' });
    }

    setIsModalOpen(false);
  };

  const updateQuantity = (index: number, delta: number) => {
      const newCart = [...cart];
      const item = newCart[index];
      const menuItem = menuItems.find(m => m.id === item.id);
      
      if (!menuItem) return;

      // Check stock if increasing
      if (delta > 0) {
          const available = getAvailableStock(menuItem);
          // Note: getAvailableStock already subtracts the CURRENT cart qty.
          // Since we are adding 1 more to the existing cart qty, available must be >= 1.
          if (available < 1) {
             setStockAlert({ message: `Max stock reached for ${item.name}`, type: 'error' });
             return;
          }
      }

      const newQty = item.quantity + delta;
      if (newQty <= 0) {
          updateCart(newCart.filter((_, i) => i !== index));
      } else {
          newCart[index] = { ...item, quantity: newQty };
          updateCart(newCart);
      }
  };

  const handleClearCart = () => {
    if (cart.length === 0) return;
    setIsClearCartConfirmOpen(true);
  };

  const confirmClearCart = () => {
      updateCart([]);
      setIsClearCartConfirmOpen(false);
  };

  const handlePlaceOrderClick = () => {
      if (cart.length === 0) return;
      
      // Pre-flight check: validate all items in cart against stock
      for (const item of cart) {
        const menuItem = menuItems.find(m => m.id === item.id);
        if (menuItem) {
            const stock = menuItem.stock !== undefined ? menuItem.stock : (getInventoryItem(menuItem)?.stock || 9999);
            if (stock < getItemTotalInCart(item.name)) {
                setStockAlert({ 
                    message: `Not enough stock for ${item.name}. Available: ${stock}`, 
                    type: 'error' 
                });
                return;
            }
        }
      }

      setIsOrderConfirmationOpen(true);
  };

  const proceedToCheckout = () => {
      setIsOrderConfirmationOpen(false);
      navigate('/checkout', { 
          state: { 
              tableId: selectedTableId,
              orderType: orderType,
              discount: discount,
              orderNote: orderNote,
              taxRate: taxRate
          } 
      });
  };

  // Helper for UI Badges on Menu Cards
  const getStockStatus = (menuItem: MenuItem) => {
      const stock = menuItem.stock !== undefined ? menuItem.stock : (getInventoryItem(menuItem)?.stock || 9999);
      const available = getAvailableStock(menuItem);

      if (stock === 0) {
          return { label: t('pos.out_of_stock'), classes: 'bg-slate-800/90 text-white backdrop-blur-sm', icon: 'block' };
      }
      if (available === 0 && stock > 0) {
          return { label: t('pos.limit_reached'), classes: 'bg-blue-600/90 text-white backdrop-blur-sm', icon: 'shopping_cart_checkout' };
      }
      if (stock <= 5) {
          return { label: `${t('pos.low_stock')}: ${stock}`, classes: 'bg-amber-500/90 text-white backdrop-blur-sm', icon: 'warning' };
      }
      
      return { label: t('pos.in_stock'), classes: 'bg-emerald-500/90 text-white backdrop-blur-sm', icon: 'check_circle' };
  };

  const subtotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  const discountAmount = subtotal * (discount / 100);
  const subtotalAfterDiscount = subtotal - discountAmount;
  const tax = subtotalAfterDiscount * (taxRate / 100);
  const total = subtotalAfterDiscount + tax;

  const orderTypes = [
    { id: 'dine-in', label: t('pos.dine_in'), icon: 'restaurant', color: 'bg-primary' },
    { id: 'takeaway', label: t('pos.takeaway'), icon: 'shopping_bag', color: 'bg-orange-500' },
    { id: 'delivery', label: t('pos.delivery'), icon: 'delivery_dining', color: 'bg-blue-500' },
  ];

  const currentOrderTypeColor = orderTypes.find(t => t.id === orderType)?.color || 'bg-primary';

  return (
    <div className="flex h-full w-full flex-col md:flex-row overflow-hidden relative">
      
      {/* Toast Notification */}
      {stockAlert && (
          <div className={`absolute top-6 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-top-4 fade-in duration-300 ${
              stockAlert.type === 'error' ? 'bg-red-500 text-white' : 
              stockAlert.type === 'warning' ? 'bg-amber-500 text-white' : 
              'bg-slate-800 text-white'
          }`}>
              <span className="material-symbols-outlined">
                  {stockAlert.type === 'error' ? 'error' : stockAlert.type === 'warning' ? 'warning' : 'check_circle'}
              </span>
              <span className="font-bold text-sm">{stockAlert.message}</span>
          </div>
      )}

      {/* Left Column: Menu */}
      <div className="flex-1 flex flex-col h-full relative overflow-hidden bg-background-light dark:bg-background-dark">
        {/* Header */}
        <header className="flex items-center justify-between p-4 gap-4 z-10">
          <div className="flex-1 max-w-lg">
            <div className="flex w-full items-center rounded-xl h-12 bg-white dark:bg-surface-dark shadow-sm">
                <div className="text-primary flex items-center justify-center pl-4 pr-2">
                    <span className="material-symbols-outlined text-[24px]">search</span>
                </div>
                <input 
                    value={menuSearch}
                    onChange={(e) => setMenuSearch(e.target.value)}
                    className="flex-1 bg-transparent border-none text-slate-900 dark:text-white placeholder-slate-400 focus:ring-0" 
                    placeholder={t('pos.search_placeholder')}
                />
                {menuSearch && (
                    <button onClick={() => setMenuSearch('')} className="pr-4 text-gray-400 hover:text-gray-600">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                )}
            </div>
          </div>
          <div className="flex items-center gap-3">
             <div className="hidden sm:flex flex-col text-right">
                <span className="text-xs text-slate-500 dark:text-gray-400 font-medium capitalize">{t(`role.${user?.role}`)}</span>
                <span className="text-sm font-bold dark:text-white">{user?.name || 'User'}</span>
             </div>
             {/* Edit Mode Toggle (Admin/Manager) */}
             {['admin', 'manager'].includes(user?.role || '') && (
                 <button 
                    onClick={() => setIsEditMode(!isEditMode)}
                    className={`h-12 px-4 rounded-xl flex items-center gap-2 font-bold transition-all ${
                        isEditMode 
                        ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20' 
                        : 'bg-white dark:bg-surface-dark text-slate-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5'
                    }`}
                 >
                    <span className="material-symbols-outlined">{isEditMode ? 'check' : 'edit_note'}</span>
                    <span className="hidden sm:inline">{isEditMode ? t('tables.done') : t('pos.edit_menu')}</span>
                 </button>
             )}
             <button className="size-12 rounded-xl bg-white dark:bg-surface-dark flex items-center justify-center text-slate-500 dark:text-gray-400 hover:text-primary relative shadow-sm active:scale-95 transition-transform">
                <span className="material-symbols-outlined">notifications</span>
                {stockAlert && <span className="absolute top-3 right-3 size-2 bg-red-500 rounded-full animate-ping"></span>}
             </button>
          </div>
        </header>

        {/* Categories */}
        <div className="px-4 pb-2">
            <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-2">
                {categories.map(cat => (
                    <button 
                        key={cat.id}
                        onClick={() => setSelectedCategory(cat.id)}
                        className={`flex h-10 shrink-0 items-center justify-center gap-x-2 rounded-xl px-4 transition-all active:scale-95 ${
                            selectedCategory === cat.id 
                            ? 'bg-primary text-background-dark shadow-lg shadow-primary/20' 
                            : 'bg-white dark:bg-surface-dark text-slate-600 dark:text-gray-300 hover:border-primary/50 border border-transparent'
                        }`}
                    >
                        <span className="material-symbols-outlined text-[20px]">{cat.icon}</span>
                        <span className="text-sm font-bold">{cat.name}</span>
                    </button>
                ))}
            </div>
        </div>

        {/* Menu Grid */}
        <div className="flex-1 overflow-y-auto p-4 pt-0 hide-scrollbar">
            <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4 sticky top-0 bg-background-light dark:bg-background-dark py-2 z-10 flex items-center gap-2">
                {t('nav.menu')}
                {isEditMode && <span className="text-xs bg-amber-500 text-white px-2 py-0.5 rounded-full">{t('pos.editing_mode')}</span>}
            </h3>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 pb-24">
                {/* Add New Item Card */}
                {isEditMode && (
                    <div 
                        onClick={() => handleOpenEditModal()} 
                        className="group bg-transparent border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-primary dark:hover:border-primary rounded-2xl p-3 flex flex-col items-center justify-center gap-3 transition-all cursor-pointer min-h-[220px]"
                    >
                        <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-white/5 flex items-center justify-center group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                            <span className="material-symbols-outlined text-3xl text-gray-400 group-hover:text-primary">add</span>
                        </div>
                        <span className="font-bold text-gray-500 dark:text-gray-400 group-hover:text-primary">{t('pos.add_dish')}</span>
                    </div>
                )}

                {filteredItems.map(item => {
                    const status = getStockStatus(item);
                    const available = getAvailableStock(item);
                    const stock = item.stock !== undefined ? item.stock : (getInventoryItem(item)?.stock || 0);
                    const isFullyOutOfStock = stock === 0;
                    const isMaxedOut = available <= 0;

                    return (
                    <div 
                        key={item.id} 
                        onClick={() => !isEditMode && !isMaxedOut && handleItemClick(item)} 
                        className={`relative group bg-white dark:bg-surface-dark rounded-2xl p-3 flex flex-col gap-3 shadow-sm transition-all border border-transparent ${
                            isEditMode ? 'ring-2 ring-transparent hover:ring-amber-400' :
                            isMaxedOut ? 'opacity-70 grayscale-[0.5] border-gray-100 dark:border-white/5' : 'hover:shadow-md cursor-pointer hover:border-primary/30'
                        }`}
                    >
                        <div className="w-full aspect-square rounded-xl bg-gray-200 dark:bg-gray-800 overflow-hidden relative">
                             <img 
                                src={item.image} 
                                alt={item.name}
                                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                onError={(e) => {
                                    (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=500&q=80';
                                }}
                             />
                            
                            {/* Stock Badge - Only show if NOT in edit mode */}
                            {!isEditMode && status && (
                                <div className={`absolute top-2 left-2 px-2 py-1 rounded-md text-[10px] font-bold shadow-sm flex items-center gap-1 ${status.classes}`}>
                                    <span className="material-symbols-outlined text-[12px]">{status.icon}</span>
                                    <span>{status.label}</span>
                                </div>
                            )}

                            {/* Edit Mode Overlays */}
                            {isEditMode && (
                                <>
                                   <div className="absolute top-2 right-2 flex gap-2">
                                       <button 
                                            onClick={(e) => { e.stopPropagation(); handleOpenEditModal(item); }}
                                            className="p-1.5 rounded-lg bg-white/90 text-slate-700 shadow-sm hover:bg-amber-500 hover:text-white transition-colors"
                                       >
                                           <span className="material-symbols-outlined text-[18px]">edit</span>
                                       </button>
                                       <button 
                                            onClick={(e) => { e.stopPropagation(); handleDeleteMenuItem(item.id); }}
                                            className="p-1.5 rounded-lg bg-white/90 text-red-500 shadow-sm hover:bg-red-500 hover:text-white transition-colors"
                                       >
                                           <span className="material-symbols-outlined text-[18px]">delete</span>
                                       </button>
                                   </div>
                                </>
                            )}

                            {/* Add Button (Normal Mode) */}
                            {!isEditMode && (
                                <button 
                                    disabled={isMaxedOut}
                                    className={`absolute bottom-2 right-2 size-8 rounded-full flex items-center justify-center text-background-dark shadow-lg active:scale-90 transition-transform ${isMaxedOut ? 'bg-gray-500 cursor-not-allowed' : 'bg-primary'}`}
                                >
                                    <span className="material-symbols-outlined text-[20px]">{isMaxedOut ? 'block' : 'add'}</span>
                                </button>
                            )}
                        </div>
                        
                        <div>
                            <h4 className="text-sm font-bold text-slate-900 dark:text-white leading-tight mb-1 truncate">{item.name}</h4>
                            <div className="flex justify-between items-center">
                                <p className="text-primary font-bold text-base">{item.price.toLocaleString()}₫</p>
                            </div>
                            
                            {/* Edit Mode Stock Controls */}
                            {isEditMode && (
                                <div className="mt-3 bg-gray-100 dark:bg-black/20 rounded-lg p-1 flex items-center justify-between">
                                    <button onClick={(e) => handleQuickStockUpdate(e, item, -1)} className="w-8 h-8 rounded-md bg-white dark:bg-white/10 flex items-center justify-center hover:bg-red-50 dark:hover:bg-red-500/20 text-slate-600 dark:text-gray-300">
                                        <span className="material-symbols-outlined text-[16px]">remove</span>
                                    </button>
                                    <span className="font-bold text-sm text-slate-700 dark:text-white">{stock}</span>
                                    <button onClick={(e) => handleQuickStockUpdate(e, item, 1)} className="w-8 h-8 rounded-md bg-white dark:bg-white/10 flex items-center justify-center hover:bg-emerald-50 dark:hover:bg-emerald-500/20 text-slate-600 dark:text-gray-300">
                                        <span className="material-symbols-outlined text-[16px]">add</span>
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )})}
                {filteredItems.length === 0 && !isEditMode && (
                    <div className="col-span-full flex flex-col items-center justify-center py-10 text-gray-400">
                        <span className="material-symbols-outlined text-4xl mb-2">search_off</span>
                        <p>{t('pos.no_results')}</p>
                    </div>
                )}
            </div>
        </div>

        {/* Sticky Table Footer - Only show for Dine-In */}
        {!isEditMode && orderType === 'dine-in' && (
            <div className="bg-white dark:bg-surface-dark p-3 border-t border-slate-100 dark:border-white/5 absolute bottom-0 w-full z-20">
                <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider shrink-0 mr-2">{t('nav.tables')}</span>
                    {tables.map(table => (
                        <label key={table.id} className="shrink-0 cursor-pointer">
                            <input 
                                type="radio" 
                                name="table" 
                                value={table.id} 
                                className="peer sr-only" 
                                checked={selectedTableId === table.id}
                                onChange={() => setSelectedTableId(table.id)} 
                            />
                            <div className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${table.status === 'occupied' ? 'bg-red-900/20 border border-red-500/30 text-red-500 opacity-70' : 'bg-gray-100 dark:bg-background-dark text-gray-500 dark:text-gray-400 peer-checked:bg-primary peer-checked:text-background-dark'}`}>
                                {table.name}
                            </div>
                        </label>
                    ))}
                </div>
            </div>
        )}
      </div>

      {/* Right Column: Cart */}
      <aside className="w-full md:w-[380px] bg-white dark:bg-surface-dark border-t md:border-t-0 md:border-l border-gray-200 dark:border-white/5 flex flex-col shadow-2xl z-30 h-[40vh] md:h-full">
         <div className={`p-4 pb-2 border-b border-gray-100 dark:border-white/5 transition-colors duration-500 ${orderType !== 'dine-in' ? `${currentOrderTypeColor}/10` : ''}`}>
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">{t('pos.order_details')}</h2>
                    <button 
                        onClick={() => setIsOrderNoteModalOpen(true)}
                        className={`size-8 rounded-full flex items-center justify-center hover:bg-gray-100 dark:hover:bg-white/5 ${orderNote ? 'text-amber-500' : 'text-gray-400'}`}
                    >
                        <span className={`material-symbols-outlined ${orderNote ? 'filled' : ''}`}>sticky_note_2</span>
                    </button>
                </div>
                <button onClick={handleClearCart} className="p-2 text-gray-400 hover:text-red-500 transition-colors">
                    <span className="material-symbols-outlined">delete_sweep</span>
                </button>
            </div>
            
            {orderNote && (
                <div className="mb-3 px-3 py-2 bg-amber-50 dark:bg-amber-500/10 rounded-lg border border-amber-100 dark:border-amber-500/20 flex justify-between items-start gap-2">
                    <p className="text-xs text-amber-700 dark:text-amber-400 italic flex-1 line-clamp-2">"{orderNote}"</p>
                    <button onClick={() => setOrderNote('')} className="text-amber-500 hover:text-amber-700">
                        <span className="material-symbols-outlined text-[14px]">close</span>
                    </button>
                </div>
            )}

            <div className="flex flex-wrap items-center gap-2 mb-3">
                 <p className={`text-xs font-bold uppercase tracking-wide px-2 py-0.5 rounded w-fit ${orderType === 'dine-in' ? 'bg-primary/10 text-primary' : orderType === 'takeaway' ? 'bg-orange-500/10 text-orange-500' : 'bg-blue-500/10 text-blue-500'}`}>
                    {orderType === 'dine-in' ? `${t('checkout.table')} ${tables.find(t => t.id === selectedTableId)?.name || '?'}` : orderType.toUpperCase()}
                </p>
            </div>

            {/* Order Type Selector */}
            <div className="grid grid-cols-3 gap-1 mb-3 bg-gray-100 dark:bg-background-dark p-1 rounded-xl">
                {orderTypes.map((type) => (
                    <button 
                        key={type.id}
                        onClick={() => setOrderType(type.id as any)}
                        className={`flex flex-col items-center justify-center py-2 rounded-lg transition-all gap-1 ${
                            orderType === type.id 
                            ? `bg-white dark:bg-surface-dark text-slate-900 dark:text-white shadow-md ring-1 ring-black/5` 
                            : 'text-gray-500 dark:text-gray-400 hover:text-slate-700 dark:hover:text-gray-200 hover:bg-white/50 dark:hover:bg-white/5'
                        }`}
                    >
                        <span className={`material-symbols-outlined text-[18px] ${orderType === type.id ? (type.id === 'takeaway' ? 'text-orange-500' : type.id === 'delivery' ? 'text-blue-500' : 'text-primary') : ''}`}>{type.icon}</span>
                        <span className="text-[10px] font-bold uppercase tracking-wide">{type.label}</span>
                    </button>
                ))}
            </div>

            {/* Search within Cart */}
            <div className="relative flex items-center w-full h-10 rounded-lg bg-background-light dark:bg-background-dark overflow-hidden group focus-within:ring-2 focus-within:ring-primary/50 transition-all">
                <div className="grid place-items-center h-full w-10 text-slate-400 dark:text-gray-500">
                    <span className="material-symbols-outlined text-[20px]">search</span>
                </div>
                <input 
                    value={cartSearch}
                    onChange={(e) => setCartSearch(e.target.value)}
                    className="peer h-full w-full outline-none text-xs text-slate-700 dark:text-white pr-2 bg-transparent placeholder-slate-400 dark:placeholder-gray-600 border-none focus:ring-0" 
                    placeholder={t('pos.filter_cart')}
                    type="text"
                />
            </div>
         </div>

         <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 hide-scrollbar">
            {filteredCart.map((item, index) => {
                const menuItem = menuItems.find(m => m.id === item.id);
                // Calculate if we can add more (Inventory Stock - Current Cart Qty)
                const available = menuItem ? getAvailableStock(menuItem) : 0;

                return (
                <div key={`${item.id}-${index}`} className="flex gap-3 items-start animate-in fade-in slide-in-from-right-4 duration-300">
                     <div className="w-16 h-16 rounded-lg bg-gray-200 dark:bg-gray-800 shrink-0 overflow-hidden">
                        <img 
                            src={menuItem?.image || item.image} 
                            alt={item.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                                (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=500&q=80';
                            }}
                        />
                     </div>
                     <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start mb-1">
                            <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate pr-2">{item.name}</h4>
                            <span className="text-sm font-bold text-primary whitespace-nowrap">{(item.price / 1000).toFixed(0)}k</span>
                        </div>
                        {item.notes && <p className="text-xs text-orange-500 dark:text-orange-400 mb-2 truncate italic">{t('checkout.note')}: {item.notes}</p>}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 bg-background-light dark:bg-background-dark rounded-lg p-1">
                                <button onClick={() => updateQuantity(index, -1)} className="size-6 flex items-center justify-center rounded bg-white dark:bg-surface-dark shadow-sm text-gray-600 dark:text-white hover:text-primary">
                                    <span className="material-symbols-outlined text-[16px]">remove</span>
                                </button>
                                <span className="text-sm font-bold w-4 text-center dark:text-white">{item.quantity}</span>
                                <button 
                                    onClick={() => updateQuantity(index, 1)} 
                                    disabled={available <= 0}
                                    className={`size-6 flex items-center justify-center rounded bg-white dark:bg-surface-dark shadow-sm transition-colors ${available <= 0 ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed' : 'text-gray-600 dark:text-white hover:text-primary'}`}
                                >
                                    <span className="material-symbols-outlined text-[16px]">add</span>
                                </button>
                            </div>
                        </div>
                     </div>
                </div>
            )})}
            {filteredCart.length === 0 && cart.length > 0 && (
                <div className="flex flex-col items-center justify-center h-full text-gray-400">
                    <span className="material-symbols-outlined text-4xl mb-2">search_off</span>
                    <span className="text-sm">{t('pos.no_results')}</span>
                </div>
            )}
            {cart.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-gray-400 opacity-50">
                    <span className="material-symbols-outlined text-4xl mb-2">shopping_basket</span>
                    <span className="text-sm">{t('pos.cart_empty')}</span>
                </div>
            )}
         </div>

         <div className="bg-background-light dark:bg-background-dark p-4 border-t border-gray-200 dark:border-white/5">
            <div className="flex flex-col gap-2 mb-4">
                <div className="flex justify-between text-sm text-gray-500 dark:text-gray-400">
                    <span>{t('pos.subtotal')}</span>
                    <span>{subtotal.toLocaleString()}₫</span>
                </div>
                <div className="flex justify-between text-sm text-primary cursor-pointer hover:bg-primary/5 rounded px-1 -mx-1 transition-colors" onClick={() => setIsDiscountModalOpen(true)}>
                    <div className="flex items-center gap-1">
                        <span>{t('pos.discount')} ({discount}%)</span>
                        <span className="material-symbols-outlined text-[14px]">edit</span>
                    </div>
                    <span>- {discountAmount.toLocaleString()}₫</span>
                </div>
                <div 
                    className={`flex justify-between text-sm ${user?.role === 'admin' ? 'text-primary cursor-pointer hover:bg-primary/5 rounded px-1 -mx-1 transition-colors' : 'text-gray-500 dark:text-gray-400'}`}
                    onClick={() => user?.role === 'admin' && setIsTaxModalOpen(true)}
                >
                    <div className="flex items-center gap-1">
                        <span>{t('pos.tax')} ({taxRate}%)</span>
                        {user?.role === 'admin' && <span className="material-symbols-outlined text-[14px]">edit</span>}
                    </div>
                    <span>{tax.toLocaleString()}₫</span>
                </div>
                <div className="w-full h-px bg-gray-200 dark:bg-gray-700 my-1"></div>
                <div className="flex justify-between items-end">
                    <span className="text-base font-bold text-slate-900 dark:text-white">{t('pos.total')}</span>
                    <span className="text-xl font-bold text-primary">{total.toLocaleString()}₫</span>
                </div>
            </div>
            <button 
                onClick={handlePlaceOrderClick}
                disabled={cart.length === 0}
                className={`w-full font-bold text-lg py-3 rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all active:scale-[0.98] ${cart.length === 0 ? 'bg-gray-300 dark:bg-white/10 text-gray-500 cursor-not-allowed shadow-none' : 'bg-primary hover:bg-primary-dark text-background-dark shadow-primary/20'}`}
            >
                <span>{t('pos.place_order')}</span>
                <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
            </button>
         </div>
      </aside>

      {/* Item Details Modal (For Adding to Cart) */}
      {isModalOpen && selectedItem && (
        <div className="absolute inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full sm:max-w-md bg-white dark:bg-surface-dark rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[90%] animate-in slide-in-from-bottom-10 sm:zoom-in-95 duration-300">
                <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-white/5">
                     <h3 className="text-lg font-bold text-slate-900 dark:text-white truncate pr-4">{selectedItem.name}</h3>
                     <button onClick={() => setIsModalOpen(false)} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 text-gray-500 dark:text-gray-400">
                         <span className="material-symbols-outlined">close</span>
                     </button>
                </div>
                <div className="p-6 overflow-y-auto">
                    <div className="flex gap-4 mb-6">
                         <div className="w-24 h-24 rounded-xl bg-gray-200 dark:bg-gray-800 shrink-0 overflow-hidden">
                             <img 
                                src={selectedItem.image} 
                                alt={selectedItem.name} 
                                className="w-full h-full object-cover" 
                                onError={(e) => {
                                    (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=500&q=80';
                                }}
                             />
                         </div>
                         <div className="flex-1">
                             <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">{selectedItem.category}</p>
                             <p className="text-xl font-bold text-primary mb-2">{selectedItem.price.toLocaleString()} ₫</p>
                             
                             {/* Quantity Control */}
                             <div className="flex items-center gap-3 bg-gray-100 dark:bg-background-dark rounded-lg p-1 w-fit">
                                <button onClick={() => setItemQuantity(Math.max(1, itemQuantity - 1))} className="size-8 flex items-center justify-center rounded bg-white dark:bg-surface-dark shadow-sm text-gray-600 dark:text-white hover:text-primary">
                                    <span className="material-symbols-outlined text-[20px]">remove</span>
                                </button>
                                <span className="text-base font-bold w-8 text-center dark:text-white">{itemQuantity}</span>
                                <button 
                                    onClick={() => {
                                        const available = getAvailableStock(selectedItem);
                                        if (itemQuantity >= available) {
                                            setStockAlert({ message: `Cannot add more. Max stock is ${selectedItem.stock !== undefined ? selectedItem.stock : (getInventoryItem(selectedItem)?.stock || 0)}.`, type: 'warning' });
                                            return;
                                        }
                                        setItemQuantity(itemQuantity + 1);
                                    }} 
                                    className={`size-8 flex items-center justify-center rounded bg-white dark:bg-surface-dark shadow-sm hover:text-primary ${itemQuantity >= getAvailableStock(selectedItem) ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed' : 'text-gray-600 dark:text-white'}`}
                                >
                                    <span className="material-symbols-outlined text-[20px]">add</span>
                                </button>
                             </div>
                             <p className="text-xs text-gray-400 mt-2">
                                 {t('pos.modal_stock_avail')}: <span className="font-bold text-slate-700 dark:text-white">{getAvailableStock(selectedItem)}</span>
                             </p>
                         </div>
                    </div>
                    <div className="mb-4">
                        <label className="block text-sm font-bold text-slate-700 dark:text-white mb-2">{t('pos.modal_special')}</label>
                        <textarea 
                            value={itemNotes}
                            onChange={(e) => setItemNotes(e.target.value)}
                            className="w-full h-24 bg-gray-50 dark:bg-background-dark border border-gray-200 dark:border-none rounded-xl p-3 text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-primary focus:border-transparent resize-none text-sm"
                            placeholder="e.g. No onions, Extra spicy..."
                        ></textarea>
                    </div>
                </div>
                <div className="p-4 border-t border-gray-100 dark:border-white/5 bg-gray-50 dark:bg-background-dark rounded-b-2xl">
                    <button 
                        onClick={confirmAddToCart}
                        className="w-full h-12 bg-primary hover:bg-primary-dark text-background-dark font-bold text-lg rounded-xl shadow-lg shadow-primary/20 flex items-center justify-center gap-2 transition-transform active:scale-[0.98]"
                    >
                        <span>{t('pos.modal_add')}</span>
                        <span className="text-sm bg-black/10 px-2 py-0.5 rounded-md">{(selectedItem.price * itemQuantity).toLocaleString()} ₫</span>
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* Edit Item Modal (For Admin/Manager) */}
      {isEditItemModalOpen && (
          <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
              <div className="w-full max-w-lg bg-white dark:bg-surface-dark rounded-2xl shadow-2xl p-6 border border-gray-100 dark:border-white/5 animate-in zoom-in-95 flex flex-col max-h-[90vh]">
                  <div className="flex justify-between items-center mb-6">
                      <h3 className="text-xl font-bold text-slate-900 dark:text-white">{editFormId ? 'Edit Dish' : 'Add New Dish'}</h3>
                      <button onClick={() => setIsEditItemModalOpen(false)} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 text-gray-500">
                          <span className="material-symbols-outlined">close</span>
                      </button>
                  </div>
                  
                  <div className="overflow-y-auto pr-2 -mr-2 space-y-4 flex-1">
                      <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Dish Name</label>
                          <input 
                             value={editFormName}
                             onChange={(e) => setEditFormName(e.target.value)}
                             className="w-full h-11 px-4 rounded-xl bg-gray-50 dark:bg-background-dark border border-gray-200 dark:border-white/5 focus:ring-2 focus:ring-primary dark:text-white"
                             placeholder="e.g. Special Beef Pho"
                          />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                          <div>
                              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Price</label>
                              <input 
                                 type="number"
                                 value={editFormPrice}
                                 onChange={(e) => setEditFormPrice(e.target.value)}
                                 className="w-full h-11 px-4 rounded-xl bg-gray-50 dark:bg-background-dark border border-gray-200 dark:border-white/5 focus:ring-2 focus:ring-primary dark:text-white"
                                 placeholder="50000"
                              />
                          </div>
                          <div>
                              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Category</label>
                              <select 
                                 value={editFormCategory}
                                 onChange={(e) => setEditFormCategory(e.target.value)}
                                 className="w-full h-11 px-4 rounded-xl bg-gray-50 dark:bg-background-dark border border-gray-200 dark:border-white/5 focus:ring-2 focus:ring-primary dark:text-white"
                              >
                                  {categories.filter(c => c.id !== 'all').map(cat => (
                                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                                  ))}
                              </select>
                          </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                           <div>
                               <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Stock (Qty)</label>
                               <input 
                                    type="number"
                                    value={editFormStock}
                                    onChange={(e) => setEditFormStock(e.target.value)}
                                    className="w-full h-11 px-4 rounded-xl bg-gray-50 dark:bg-background-dark border border-gray-200 dark:border-white/5 focus:ring-2 focus:ring-primary dark:text-white"
                                    placeholder="20"
                                />
                           </div>
                           <div className="flex items-end">
                               <p className="text-xs text-gray-400 italic mb-3">Leave empty to use inventory tracking</p>
                           </div>
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Image URL</label>
                          <input 
                             value={editFormImage}
                             onChange={(e) => setEditFormImage(e.target.value)}
                             className="w-full h-11 px-4 rounded-xl bg-gray-50 dark:bg-background-dark border border-gray-200 dark:border-white/5 focus:ring-2 focus:ring-primary dark:text-white"
                             placeholder="https://..."
                          />
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Description</label>
                          <textarea 
                             value={editFormDescription}
                             onChange={(e) => setEditFormDescription(e.target.value)}
                             className="w-full h-24 p-4 rounded-xl bg-gray-50 dark:bg-background-dark border border-gray-200 dark:border-white/5 focus:ring-2 focus:ring-primary dark:text-white resize-none"
                             placeholder="Ingredients, allergens, etc."
                          ></textarea>
                      </div>
                  </div>

                  <div className="mt-6 pt-4 border-t border-gray-100 dark:border-white/5 flex gap-3">
                      <button 
                          onClick={() => setIsEditItemModalOpen(false)}
                          className="flex-1 h-12 rounded-xl bg-gray-100 dark:bg-white/5 font-bold text-slate-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/10"
                      >
                          Cancel
                      </button>
                      <button 
                          onClick={handleSaveMenuItem}
                          className="flex-1 h-12 rounded-xl bg-primary text-background-dark font-bold shadow-lg shadow-primary/20 hover:bg-primary-dark"
                      >
                          Save Item
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* Discount Modal */}
      {isDiscountModalOpen && (
          <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
              <div className="w-full max-w-sm bg-white dark:bg-surface-dark rounded-2xl shadow-2xl p-6 border border-gray-100 dark:border-white/5 animate-in zoom-in-95">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Apply Discount</h3>
                  <div className="mb-6">
                      <label className="block text-sm text-slate-500 mb-2">Percentage (%)</label>
                      <input 
                        type="number" 
                        min="0" 
                        max="100" 
                        value={discount} 
                        onChange={(e) => setDiscount(Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
                        className="w-full text-3xl font-bold text-center p-4 rounded-xl bg-gray-50 dark:bg-background-dark border-2 border-primary focus:outline-none text-primary"
                      />
                  </div>
                  <div className="grid grid-cols-4 gap-2 mb-6">
                      {[0, 5, 10, 20].map(pct => (
                          <button 
                            key={pct} 
                            onClick={() => setDiscount(pct)}
                            className={`py-2 rounded-lg font-bold ${discount === pct ? 'bg-primary text-background-dark' : 'bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-gray-400'}`}
                          >
                              {pct}%
                          </button>
                      ))}
                  </div>
                  <button onClick={() => setIsDiscountModalOpen(false)} className="w-full py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold rounded-xl">
                      Done
                  </button>
              </div>
          </div>
      )}

      {/* Tax Modal */}
      {isTaxModalOpen && (
          <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
              <div className="w-full max-w-sm bg-white dark:bg-surface-dark rounded-2xl shadow-2xl p-6 border border-gray-100 dark:border-white/5 animate-in zoom-in-95">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Set Tax Rate</h3>
                  <div className="mb-6">
                      <label className="block text-sm text-slate-500 mb-2">Percentage (%)</label>
                      <input 
                        type="number" 
                        min="0" 
                        max="100" 
                        value={taxRate} 
                        onChange={(e) => updateTaxRate(Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
                        className="w-full text-3xl font-bold text-center p-4 rounded-xl bg-gray-50 dark:bg-background-dark border-2 border-primary focus:outline-none text-primary"
                      />
                  </div>
                  <div className="grid grid-cols-4 gap-2 mb-6">
                      {[0, 5, 8, 10].map(pct => (
                          <button 
                            key={pct} 
                            onClick={() => updateTaxRate(pct)}
                            className={`py-2 rounded-lg font-bold ${taxRate === pct ? 'bg-primary text-background-dark' : 'bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-gray-400'}`}
                          >
                              {pct}%
                          </button>
                      ))}
                  </div>
                  <button onClick={() => setIsTaxModalOpen(false)} className="w-full py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold rounded-xl">
                      Done
                  </button>
              </div>
          </div>
      )}

      {/* Order Note Modal */}
      {isOrderNoteModalOpen && (
          <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
              <div className="w-full max-w-sm bg-white dark:bg-surface-dark rounded-2xl shadow-2xl p-6 border border-gray-100 dark:border-white/5 animate-in zoom-in-95">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Add Order Note</h3>
                  <textarea 
                    value={orderNote}
                    onChange={(e) => setOrderNote(e.target.value)}
                    className="w-full h-32 p-3 bg-gray-50 dark:bg-background-dark rounded-xl border-none resize-none mb-6 focus:ring-2 focus:ring-primary text-slate-900 dark:text-white placeholder-slate-400"
                    placeholder="Allergies, special requests, or delivery instructions..."
                    autoFocus
                  ></textarea>
                  <button onClick={() => setIsOrderNoteModalOpen(false)} className="w-full py-3 bg-primary text-background-dark font-bold rounded-xl shadow-lg shadow-primary/20">
                      Save Note
                  </button>
              </div>
          </div>
      )}

      {/* Order Confirmation Modal */}
      {isOrderConfirmationOpen && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-sm bg-white dark:bg-surface-dark rounded-2xl shadow-2xl p-6 animate-in zoom-in-95 duration-200 border border-gray-100 dark:border-white/5">
                <div className="text-center mb-6">
                    <div className="w-20 h-20 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-4 animate-in zoom-in duration-300">
                        <span className="material-symbols-outlined text-4xl">check_circle</span>
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">{t('checkout.confirm')}?</h2>
                    <p className="text-slate-500 dark:text-gray-400 text-sm leading-relaxed">
                        Ready to place order for <span className="font-bold text-slate-900 dark:text-white">Table {tables.find(t => t.id === selectedTableId)?.name}</span>?
                    </p>
                </div>

                <div className="bg-gray-50 dark:bg-white/5 rounded-xl p-4 mb-6 border border-gray-100 dark:border-white/5">
                    <div className="flex justify-between items-center mb-2">
                         <span className="text-sm text-slate-500 dark:text-gray-400">{t('history.items')}</span>
                         <span className="text-sm font-bold text-slate-900 dark:text-white">{cart.reduce((a, b) => a + b.quantity, 0)}</span>
                    </div>
                    {discount > 0 && (
                        <div className="flex justify-between items-center mb-2 text-primary">
                            <span className="text-sm">{t('pos.discount')}</span>
                            <span className="text-sm font-bold">-{discount}%</span>
                        </div>
                    )}
                    <div className="flex justify-between items-center">
                        <span className="text-base font-bold text-slate-700 dark:text-gray-200">{t('pos.total')}</span>
                        <span className="text-xl font-black text-primary">{total.toLocaleString()} ₫</span>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <button 
                        onClick={() => setIsOrderConfirmationOpen(false)}
                        className="py-3.5 rounded-xl font-bold text-slate-600 dark:text-gray-300 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 transition-colors"
                    >
                        {t('inventory.cancel')}
                    </button>
                    <button 
                        onClick={proceedToCheckout}
                        className="py-3.5 rounded-xl font-bold bg-primary text-background-dark hover:bg-primary-dark shadow-lg shadow-primary/20 transition-all active:scale-[0.98]"
                    >
                        Checkout
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* Clear Cart Confirmation Modal */}
      {isClearCartConfirmOpen && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-sm bg-white dark:bg-surface-dark rounded-2xl shadow-2xl p-6 animate-in zoom-in-95 duration-200 border border-gray-100 dark:border-white/5">
                <div className="text-center mb-6">
                    <div className="w-16 h-16 bg-red-100 dark:bg-red-500/20 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                        <span className="material-symbols-outlined text-3xl">delete_forever</span>
                    </div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">{t('pos.clear_cart')}?</h2>
                    <p className="text-slate-500 dark:text-gray-400 text-sm">
                        Are you sure you want to remove all items from this order? This action cannot be undone.
                    </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <button 
                        onClick={() => setIsClearCartConfirmOpen(false)}
                        className="py-3 rounded-xl font-bold text-slate-600 dark:text-gray-300 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 transition-colors"
                    >
                        {t('inventory.cancel')}
                    </button>
                    <button 
                        onClick={confirmClearCart}
                        className="py-3 rounded-xl font-bold bg-red-500 text-white hover:bg-red-600 shadow-lg shadow-red-500/20 transition-all active:scale-[0.98]"
                    >
                        {t('pos.clear_all')}
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default POS;