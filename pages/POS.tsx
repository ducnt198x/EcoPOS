import React, { useState, useEffect, useRef } from 'react';
import { MenuItem, CartItem, InventoryItem, Category } from '../types';
import { useNavigate, useLocation } from 'react-router-dom';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';

const POS: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { t } = useLanguage();
  const { 
      menuItems, 
      activeOrders, 
      updateActiveOrder, 
      tables, 
      inventory, 
      updateInventoryItem,
      addInventoryItem,
      updateMenuItem, 
      addMenuItem, 
      deleteMenuItem, 
      taxRate, 
      updateTaxRate,
      categories,
      addCategory,
      updateCategory,
      deleteCategory,
      reorderCategories
  } = useData();
  
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

  // Construct display categories including 'All'
  const displayCategories = [
      { id: 'all', name: t('pos.cat_all'), icon: 'restaurant_menu' },
      ...categories
  ];

  // Drag and Drop Refs
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

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
  const [editFormCategory, setEditFormCategory] = useState('');
  const [editFormInvCategory, setEditFormInvCategory] = useState('food');
  const [editFormImage, setEditFormImage] = useState('');
  const [editFormDescription, setEditFormDescription] = useState('');
  const [editFormStock, setEditFormStock] = useState('');

  // Category Management Modal State
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [catFormId, setCatFormId] = useState('');
  const [catFormName, setCatFormName] = useState('');
  const [catFormIcon, setCatFormIcon] = useState('');
  const [catEditingId, setCatEditingId] = useState<string | null>(null);
  const [isSavingCategory, setIsSavingCategory] = useState(false);

  // Stock Alert State
  const [stockAlert, setStockAlert] = useState<{ message: string; type: 'warning' | 'error' | 'success' } | null>(null);

  useEffect(() => {
    if (stockAlert) {
      const timer = setTimeout(() => setStockAlert(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [stockAlert]);

  // Helper: Generate robust IDs
  const generateId = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

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

  // --- Drag and Drop Handlers ---
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, position: number) => {
    dragItem.current = position;
    // Add visual effect if needed
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>, position: number) => {
    dragOverItem.current = position;
    e.preventDefault();
  };

  const handleDragEnd = async () => {
    const fromIndex = dragItem.current;
    const toIndex = dragOverItem.current;

    if (fromIndex !== null && toIndex !== null && fromIndex !== toIndex) {
        const newCategories = [...categories];
        const item = newCategories.splice(fromIndex, 1)[0];
        newCategories.splice(toIndex, 0, item);
        
        // Optimistic update
        await reorderCategories(newCategories);
    }

    dragItem.current = null;
    dragOverItem.current = null;
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
          
          // Pre-fill inventory category if linked item exists
          const linkedInv = inventory.find(i => i.name.toLowerCase() === item.name.toLowerCase());
          setEditFormInvCategory(linkedInv ? linkedInv.category : 'food');
      } else {
          setEditFormId(null);
          setEditFormName('');
          setEditFormPrice('');
          setEditFormCategory(selectedCategory !== 'all' ? selectedCategory : (categories[0]?.id || ''));
          setEditFormImage('');
          setEditFormDescription('');
          setEditFormStock('20');
          setEditFormInvCategory('food');
      }
      setIsEditItemModalOpen(true);
  };

  const handleSaveMenuItem = async () => {
      if (!editFormName || !editFormPrice) return;

      const price = parseFloat(editFormPrice);
      const stock = editFormStock ? parseInt(editFormStock) : undefined;
      // Default placeholder image if empty
      const image = editFormImage || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=500&q=80';

      const itemData: MenuItem = {
          id: editFormId || generateId(),
          name: editFormName,
          price,
          category: editFormCategory,
          image,
          description: editFormDescription,
          stock
      };

      // Pass the inventory category to DataContext functions.
      // The context will handle syncing inventory creation/update, name changes, and stock.
      if (editFormId) {
          await updateMenuItem(itemData, editFormInvCategory);
      } else {
          await addMenuItem(itemData, editFormInvCategory);
      }

      setStockAlert({ message: editFormId ? 'Item updated & synced' : 'Item added & synced to inventory', type: 'success' });
      setIsEditItemModalOpen(false);
  };

  const handleDeleteMenuItem = (id: string) => {
      if (window.confirm('Are you sure you want to delete this item? This will also remove the linked inventory.')) {
          deleteMenuItem(id);
      }
  };

  const handleQuickStockUpdate = (e: React.MouseEvent, item: MenuItem, delta: number) => {
      e.stopPropagation();
      const currentStock = item.stock || 0;
      const newStock = Math.max(0, currentStock + delta);
      // We don't pass inventory category here as it's a quick update, just syncs numbers
      updateMenuItem({ ...item, stock: newStock });
  };

  // --- Category Management Handlers (Admin Only) ---
  
  const handleOpenCategoryModal = () => {
      setCatEditingId(null);
      setCatFormId('');
      setCatFormName('');
      setCatFormIcon('');
      setIsCategoryModalOpen(true);
  };

  const handleEditCategory = (cat: Category) => {
      setCatEditingId(cat.id);
      setCatFormId(cat.id);
      setCatFormName(cat.name);
      setCatFormIcon(cat.icon);
  };

  const handleSaveCategory = async () => {
      if (!catFormName || !catFormIcon) return;
      setIsSavingCategory(true);

      // Auto-generate slug ID from name if creating new
      const generatedId = catFormName.toLowerCase().trim()
        .replace(/[^a-z0-9]+/g, '-') // Replace non-alphanumeric with hyphens
        .replace(/^-+|-+$/g, '');   // Trim hyphens from start/end

      const finalId = catEditingId || catFormId || generatedId || `cat-${Date.now()}`;

      const catData: Category = {
          id: finalId,
          name: catFormName,
          icon: catFormIcon
      };

      let result;
      if (catEditingId) {
          result = await updateCategory(catData); 
          if (!result?.error) {
             setStockAlert({ message: 'Category updated', type: 'success' });
          }
      } else {
          result = await addCategory(catData);
          if (!result?.error) {
             setStockAlert({ message: 'Category added', type: 'success' });
          }
      }
      
      setIsSavingCategory(false);

      if (result?.error) {
          setStockAlert({ message: 'Operation failed. Check console for details.', type: 'error' });
      } else {
          // Reset form only on success
          setCatEditingId(null);
          setCatFormId('');
          setCatFormName('');
          setCatFormIcon('');
      }
  };

  const handleDeleteCategory = async (id: string) => {
      if (window.confirm('Are you sure? Items in this category will remain but may be hidden from filters.')) {
          const result = await deleteCategory(id);
          if (result?.error) {
              setStockAlert({ message: 'Failed to delete category', type: 'error' });
          } else {
              setStockAlert({ message: 'Category deleted', type: 'success' });
          }
      }
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
             
             {/* Admin: Manage Categories Button */}
             {user?.role === 'admin' && (
                 <button 
                    onClick={handleOpenCategoryModal}
                    className="h-12 w-12 rounded-xl flex items-center justify-center bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors shadow-sm"
                    title={t('pos.manage_categories')}
                 >
                    <span className="material-symbols-outlined">category</span>
                 </button>
             )}

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
                {displayCategories.map(cat => (
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
                <div className="mb-3 px-3 py-2 bg-amber-50 dark:bg-amber-500/10 rounded-lg border border-amber-100 dark:border-amber-500/20 text-amber-700 dark:text-amber-400 text-xs font-medium flex gap-2">
                   <span className="material-symbols-outlined text-[16px] shrink-0">sticky_note_2</span>
                   <p className="line-clamp-2 italic">"{orderNote}"</p>
                </div>
            )}

            {/* Order Type Selector */}
            <div className="grid grid-cols-3 gap-2">
                {orderTypes.map(type => (
                    <button
                        key={type.id}
                        onClick={() => setOrderType(type.id as any)}
                        className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all border ${
                            orderType === type.id
                            ? `${type.color} text-white shadow-md border-transparent`
                            : 'bg-gray-5 dark:bg-white/5 text-gray-500 dark:text-gray-400 border-transparent hover:bg-gray-100 dark:hover:bg-white/10'
                        }`}
                    >
                        <span className="material-symbols-outlined text-[20px] mb-1">{type.icon}</span>
                        <span className="text-[10px] font-bold uppercase">{type.label}</span>
                    </button>
                ))}
            </div>
         </div>

         {/* Cart Items List */}
         <div className="flex-1 overflow-y-auto p-4 space-y-3">
             {cart.length === 0 ? (
                 <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-2 opacity-60">
                     <span className="material-symbols-outlined text-6xl">shopping_cart_off</span>
                     <p className="font-bold">{t('pos.cart_empty')}</p>
                 </div>
             ) : (
                 cart.map((item, index) => (
                     <div key={`${item.id}-${index}`} className="flex justify-between items-start animate-in slide-in-from-right-2 fade-in duration-300">
                         <div className="flex-1">
                             <div className="flex justify-between items-start mb-1">
                                 <p className="font-bold text-slate-800 dark:text-white text-sm">{item.name}</p>
                                 <p className="font-bold text-slate-800 dark:text-white text-sm">{(item.price * item.quantity).toLocaleString()} ₫</p>
                             </div>
                             {item.notes && <p className="text-xs text-gray-400 italic mb-2">Note: {item.notes}</p>}
                             
                             <div className="flex items-center gap-3">
                                 <div className="flex items-center bg-gray-100 dark:bg-white/5 rounded-lg p-1">
                                     <button 
                                        onClick={() => updateQuantity(index, -1)}
                                        className="w-6 h-6 rounded flex items-center justify-center hover:bg-white dark:hover:bg-white/10 text-gray-600 dark:text-gray-300 transition-colors"
                                     >
                                         <span className="material-symbols-outlined text-[14px]">remove</span>
                                     </button>
                                     <span className="w-8 text-center text-sm font-bold text-slate-800 dark:text-white">{item.quantity}</span>
                                     <button 
                                        onClick={() => updateQuantity(index, 1)}
                                        className="w-6 h-6 rounded flex items-center justify-center hover:bg-white dark:hover:bg-white/10 text-gray-600 dark:text-gray-300 transition-colors"
                                     >
                                         <span className="material-symbols-outlined text-[14px]">add</span>
                                     </button>
                                 </div>
                                 <span className="text-xs text-gray-400">@ {item.price.toLocaleString()}</span>
                             </div>
                         </div>
                     </div>
                 ))
             )}
         </div>

         {/* Footer Totals & Action */}
         <div className="p-4 bg-gray-50 dark:bg-black/20 border-t border-gray-200 dark:border-white/5 space-y-3">
             <div className="space-y-1 text-sm">
                 <div className="flex justify-between text-gray-500 dark:text-gray-400">
                     <span>{t('pos.subtotal')}</span>
                     <span className="font-medium">{subtotal.toLocaleString()} ₫</span>
                 </div>
                 
                 <div className="flex justify-between items-center text-gray-500 dark:text-gray-400 cursor-pointer hover:text-primary transition-colors" onClick={() => setIsDiscountModalOpen(true)}>
                     <span className="flex items-center gap-1 border-b border-dashed border-gray-300 dark:border-gray-600">{t('pos.discount')} ({discount}%)</span>
                     <span className="font-medium text-red-500">- {discountAmount.toLocaleString()} ₫</span>
                 </div>

                 <div className="flex justify-between items-center text-gray-500 dark:text-gray-400 cursor-pointer hover:text-primary transition-colors" onClick={() => setIsTaxModalOpen(true)}>
                     <span className="flex items-center gap-1 border-b border-dashed border-gray-300 dark:border-gray-600">{t('pos.tax')} ({taxRate}%)</span>
                     <span className="font-medium">{tax.toLocaleString()} ₫</span>
                 </div>
             </div>

             <div className="flex justify-between items-end pt-2 border-t border-gray-200 dark:border-white/5">
                 <div>
                     <p className="text-xs font-bold text-gray-400 uppercase">{t('pos.total')}</p>
                     <p className="text-2xl font-black text-slate-900 dark:text-white">{total.toLocaleString()} ₫</p>
                 </div>
             </div>

             <button 
                onClick={handlePlaceOrderClick}
                disabled={cart.length === 0}
                className="w-full py-4 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-lg shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
             >
                 <span className="material-symbols-outlined">payments</span>
                 {t('pos.place_order')}
             </button>
         </div>
      </aside>

      {/* --- Modals --- */}
      
      {/* 1. Item Detail / Add to Cart Modal */}
      {isModalOpen && selectedItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
              <div className="bg-white dark:bg-surface-dark w-full max-w-md rounded-3xl shadow-2xl p-6 relative animate-in zoom-in-95">
                  <button onClick={() => setIsModalOpen(false)} className="absolute top-4 right-4 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 text-gray-500">
                      <span className="material-symbols-outlined">close</span>
                  </button>
                  
                  <div className="flex gap-4 mb-6">
                      <div className="w-24 h-24 rounded-2xl bg-gray-100 dark:bg-black/20 overflow-hidden shrink-0">
                          <img src={selectedItem.image} alt={selectedItem.name} className="w-full h-full object-cover" />
                      </div>
                      <div>
                          <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-1">{selectedItem.name}</h3>
                          <p className="text-primary font-bold text-lg">{selectedItem.price.toLocaleString()} ₫</p>
                          <p className="text-sm text-gray-500 mt-2">{t('pos.modal_stock_avail')}: {getAvailableStock(selectedItem)}</p>
                      </div>
                  </div>

                  <div className="mb-6">
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-2">{t('pos.modal_special')}</label>
                      <textarea 
                          value={itemNotes}
                          onChange={(e) => setItemNotes(e.target.value)}
                          className="w-full h-24 rounded-xl bg-gray-50 dark:bg-black/20 border-none p-4 text-sm focus:ring-2 focus:ring-primary dark:text-white resize-none"
                          placeholder="e.g. No onions, extra spicy..."
                      ></textarea>
                  </div>

                  <div className="flex items-center justify-between mb-6 bg-gray-50 dark:bg-black/20 p-2 rounded-xl">
                      <button 
                        onClick={() => setItemQuantity(Math.max(1, itemQuantity - 1))}
                        className="w-12 h-12 rounded-xl bg-white dark:bg-white/10 shadow-sm flex items-center justify-center text-slate-900 dark:text-white hover:text-primary"
                      >
                          <span className="material-symbols-outlined">remove</span>
                      </button>
                      <span className="text-2xl font-bold text-slate-900 dark:text-white w-16 text-center">{itemQuantity}</span>
                      <button 
                        onClick={() => setItemQuantity(itemQuantity + 1)}
                        className="w-12 h-12 rounded-xl bg-white dark:bg-white/10 shadow-sm flex items-center justify-center text-slate-900 dark:text-white hover:text-primary"
                      >
                          <span className="material-symbols-outlined">add</span>
                      </button>
                  </div>

                  <button 
                    onClick={confirmAddToCart}
                    className="w-full py-4 rounded-xl bg-primary text-background-dark font-bold text-lg shadow-lg shadow-primary/20 hover:opacity-90 active:scale-95 transition-all"
                  >
                      {t('pos.modal_add')} - {(selectedItem.price * itemQuantity).toLocaleString()} ₫
                  </button>
              </div>
          </div>
      )}

      {/* 2. Order Note Modal */}
      {isOrderNoteModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
              <div className="bg-white dark:bg-surface-dark w-full max-w-sm rounded-3xl shadow-2xl p-6 relative animate-in zoom-in-95">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">{t('checkout.note')}</h3>
                  <textarea 
                      value={orderNote}
                      onChange={(e) => setOrderNote(e.target.value)}
                      className="w-full h-32 rounded-xl bg-gray-50 dark:bg-black/20 border-none p-4 text-sm focus:ring-2 focus:ring-primary dark:text-white resize-none mb-4"
                      placeholder="Order-wide instructions..."
                  ></textarea>
                  <div className="flex gap-3">
                      <button onClick={() => setOrderNote('')} className="flex-1 py-3 rounded-xl bg-red-50 text-red-500 font-bold text-sm">Clear</button>
                      <button onClick={() => setIsOrderNoteModalOpen(false)} className="flex-[2] py-3 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-sm">Save Note</button>
                  </div>
              </div>
          </div>
      )}

      {/* 3. Confirmation Modal */}
      {isOrderConfirmationOpen && (
           <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
              <div className="bg-white dark:bg-surface-dark w-full max-w-sm rounded-3xl shadow-2xl p-6 relative animate-in zoom-in-95 text-center">
                  <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4 text-primary">
                      <span className="material-symbols-outlined text-3xl">payments</span>
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">{t('pos.place_order')}?</h3>
                  <p className="text-gray-500 mb-6">Proceed to payment for <b>{total.toLocaleString()} ₫</b>?</p>
                  <div className="flex gap-3">
                      <button onClick={() => setIsOrderConfirmationOpen(false)} className="flex-1 py-3 rounded-xl bg-gray-100 dark:bg-white/5 font-bold text-gray-600 dark:text-gray-300">Cancel</button>
                      <button onClick={proceedToCheckout} className="flex-1 py-3 rounded-xl bg-primary text-background-dark font-bold shadow-lg shadow-primary/20">Confirm</button>
                  </div>
              </div>
           </div>
      )}

      {/* 4. Clear Cart Confirmation */}
      {isClearCartConfirmOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
              <div className="bg-white dark:bg-surface-dark w-full max-w-sm rounded-3xl shadow-2xl p-6 relative animate-in zoom-in-95 text-center">
                  <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 text-red-500">
                      <span className="material-symbols-outlined text-3xl">delete</span>
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Clear Cart?</h3>
                  <p className="text-gray-500 mb-6">Are you sure you want to remove all items?</p>
                  <div className="flex gap-3">
                      <button onClick={() => setIsClearCartConfirmOpen(false)} className="flex-1 py-3 rounded-xl bg-gray-100 dark:bg-white/5 font-bold text-gray-600 dark:text-gray-300">Cancel</button>
                      <button onClick={confirmClearCart} className="flex-1 py-3 rounded-xl bg-red-500 text-white font-bold shadow-lg shadow-red-500/20">Clear All</button>
                  </div>
              </div>
           </div>
      )}

      {/* 5. Discount Modal */}
      {isDiscountModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
              <div className="bg-white dark:bg-surface-dark w-full max-w-xs rounded-3xl shadow-2xl p-6 animate-in zoom-in-95">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Set Discount (%)</h3>
                  <input 
                    type="number" 
                    min="0" 
                    max="100" 
                    value={discount} 
                    onChange={(e) => setDiscount(Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
                    className="w-full h-12 text-center text-2xl font-bold rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-black/20 mb-6 focus:ring-primary outline-none dark:text-white"
                  />
                  <button onClick={() => setIsDiscountModalOpen(false)} className="w-full py-3 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold">Done</button>
              </div>
          </div>
      )}

      {/* 6. Tax Modal */}
      {isTaxModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
              <div className="bg-white dark:bg-surface-dark w-full max-w-xs rounded-3xl shadow-2xl p-6 animate-in zoom-in-95">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Set Tax Rate (%)</h3>
                  <input 
                    type="number" 
                    min="0" 
                    max="100" 
                    value={taxRate} 
                    onChange={(e) => updateTaxRate(Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))}
                    className="w-full h-12 text-center text-2xl font-bold rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-black/20 mb-6 focus:ring-primary outline-none dark:text-white"
                  />
                  <p className="text-xs text-gray-500 mb-4 text-center">This updates the global tax setting.</p>
                  <button onClick={() => setIsTaxModalOpen(false)} className="w-full py-3 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold">Done</button>
              </div>
          </div>
      )}
      
      {/* 7. Edit Menu Item Modal */}
      {isEditItemModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
              <div className="bg-white dark:bg-surface-dark w-full max-w-lg rounded-3xl shadow-2xl p-6 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4">{editFormId ? 'Edit Item' : 'New Item'}</h3>
                  <div className="space-y-4">
                      <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Name</label>
                          <input className="w-full h-11 px-4 rounded-xl bg-gray-50 dark:bg-black/20 border-none dark:text-white" value={editFormName} onChange={e => setEditFormName(e.target.value)} />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                          <div>
                              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Price</label>
                              <input type="number" className="w-full h-11 px-4 rounded-xl bg-gray-50 dark:bg-black/20 border-none dark:text-white" value={editFormPrice} onChange={e => setEditFormPrice(e.target.value)} />
                          </div>
                          <div>
                              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Stock</label>
                              <input type="number" className="w-full h-11 px-4 rounded-xl bg-gray-50 dark:bg-black/20 border-none dark:text-white" value={editFormStock} onChange={e => setEditFormStock(e.target.value)} />
                          </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                          <div>
                              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Menu Category</label>
                              <select className="w-full h-11 px-4 rounded-xl bg-gray-50 dark:bg-black/20 border-none dark:text-white" value={editFormCategory} onChange={e => setEditFormCategory(e.target.value)}>
                                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                              </select>
                          </div>
                          <div>
                              <label className="block text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase mb-1">Inventory Category</label>
                              <select className="w-full h-11 px-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border-none dark:text-emerald-300 font-medium" value={editFormInvCategory} onChange={e => setEditFormInvCategory(e.target.value)}>
                                  <option value="food">Food</option>
                                  <option value="drink">Drink</option>
                                  <option value="ingredient">Ingredient</option>
                                  <option value="other">Other</option>
                              </select>
                          </div>
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Image URL</label>
                          <input className="w-full h-11 px-4 rounded-xl bg-gray-50 dark:bg-black/20 border-none dark:text-white" value={editFormImage} onChange={e => setEditFormImage(e.target.value)} placeholder="https://..." />
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Description</label>
                          <textarea className="w-full h-20 p-4 rounded-xl bg-gray-50 dark:bg-black/20 border-none dark:text-white resize-none" value={editFormDescription} onChange={e => setEditFormDescription(e.target.value)} />
                      </div>
                  </div>
                  <div className="flex gap-3 mt-6">
                      <button onClick={() => setIsEditItemModalOpen(false)} className="flex-1 py-3 rounded-xl bg-gray-100 dark:bg-white/5 font-bold text-gray-600 dark:text-gray-300">Cancel</button>
                      <button onClick={handleSaveMenuItem} className="flex-1 py-3 rounded-xl bg-primary text-background-dark font-bold shadow-lg shadow-primary/20">Save & Sync</button>
                  </div>
              </div>
          </div>
      )}

      {/* 8. Category Manager Modal */}
      {isCategoryModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
              <div className="bg-white dark:bg-surface-dark w-full max-w-md rounded-3xl shadow-2xl p-6 animate-in zoom-in-95 max-h-[80vh] flex flex-col">
                  <div className="flex justify-between items-center mb-4">
                      <h3 className="text-xl font-bold text-slate-900 dark:text-white">Manage Categories</h3>
                      <button onClick={() => setIsCategoryModalOpen(false)} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 text-gray-500">
                          <span className="material-symbols-outlined">close</span>
                      </button>
                  </div>

                  {/* Form */}
                  <div className="bg-gray-50 dark:bg-white/5 p-4 rounded-2xl mb-4 border border-gray-100 dark:border-white/5">
                      <h4 className="text-sm font-bold text-slate-700 dark:text-white mb-3">{catEditingId ? t('pos.cat_edit') : t('pos.cat_new')}</h4>
                      <div className="space-y-3">
                          {/* ID is auto-generated for new items, or read-only if editing */}
                          <input 
                              placeholder={t('pos.cat_name')} 
                              value={catFormName} 
                              onChange={e => setCatFormName(e.target.value)} 
                              className="w-full h-10 px-3 rounded-lg bg-white dark:bg-black/20 border-none text-sm dark:text-white focus:ring-2 focus:ring-primary"
                          />
                          <div className="flex gap-2">
                             <input 
                                  placeholder={t('pos.cat_icon')} 
                                  value={catFormIcon} 
                                  onChange={e => setCatFormIcon(e.target.value)} 
                                  className="flex-1 h-10 px-3 rounded-lg bg-white dark:bg-black/20 border-none text-sm dark:text-white focus:ring-2 focus:ring-primary"
                              />
                              <div className="w-10 h-10 flex items-center justify-center bg-white dark:bg-black/20 rounded-lg shadow-sm">
                                  {catFormIcon ? <span className="material-symbols-outlined text-gray-600 dark:text-gray-300">{catFormIcon}</span> : <span className="material-symbols-outlined text-gray-300">image</span>}
                              </div>
                          </div>
                          <div className="flex justify-end gap-2 pt-2">
                              {catEditingId && <button onClick={() => { setCatEditingId(null); setCatFormId(''); setCatFormName(''); setCatFormIcon(''); }} className="px-3 py-1.5 text-xs font-bold text-gray-500">Cancel</button>}
                              <button onClick={handleSaveCategory} disabled={isSavingCategory} className="px-4 py-2 bg-primary text-background-dark rounded-lg text-sm font-bold shadow-sm">{isSavingCategory ? 'Saving...' : (catEditingId ? 'Update' : 'Add')}</button>
                          </div>
                      </div>
                  </div>

                  {/* List */}
                  <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                      {categories.map((cat, index) => (
                          <div 
                            key={cat.id} 
                            className="flex items-center justify-between p-3 bg-white dark:bg-white/5 border border-gray-100 dark:border-white/5 rounded-xl group"
                            draggable
                            onDragStart={(e) => handleDragStart(e, index)}
                            onDragEnter={(e) => handleDragEnter(e, index)}
                            onDragEnd={handleDragEnd}
                            onDragOver={(e) => e.preventDefault()}
                          >
                              <div className="flex items-center gap-3">
                                  <span className="material-symbols-outlined text-gray-400 cursor-move">drag_indicator</span>
                                  <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-white/10 flex items-center justify-center">
                                      <span className="material-symbols-outlined text-[18px] text-gray-600 dark:text-gray-300">{cat.icon}</span>
                                  </div>
                                  <div>
                                      <p className="font-bold text-sm text-slate-800 dark:text-white">{cat.name}</p>
                                      <p className="text-[10px] text-gray-400">ID: {cat.id}</p>
                                  </div>
                              </div>
                              <div className="flex gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button onClick={() => handleEditCategory(cat)} className="p-1.5 text-gray-500 hover:text-primary"><span className="material-symbols-outlined text-[18px]">edit</span></button>
                                  <button onClick={() => handleDeleteCategory(cat.id)} className="p-1.5 text-gray-500 hover:text-red-500"><span className="material-symbols-outlined text-[18px]">delete</span></button>
                              </div>
                          </div>
                      ))}
                  </div>
              </div>
          </div>
      )}

    </div>
  );
};

export default POS;