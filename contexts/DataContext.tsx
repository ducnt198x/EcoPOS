import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Table, InventoryItem, Order, MenuItem, CartItem, AppSetting, Category } from '../types';
import { supabase } from '../services/supabase';

interface DataContextType {
  tables: Table[];
  updateTable: (updatedTable: Table) => Promise<void>;
  updateTables: (updatedTables: Table[]) => Promise<void>;
  deleteTable: (tableId: string) => Promise<void>;
  inventory: InventoryItem[];
  updateInventoryItem: (updatedItem: InventoryItem) => Promise<void>;
  addInventoryItem: (item: InventoryItem) => Promise<void>;
  deleteInventoryItem: (itemId: string) => Promise<void>;
  orders: Order[];
  addOrder: (order: Order) => Promise<void>;
  menuItems: MenuItem[];
  updateMenuItem: (item: MenuItem, inventoryCategory?: string) => Promise<void>;
  addMenuItem: (item: MenuItem, inventoryCategory?: string) => Promise<void>;
  deleteMenuItem: (itemId: string) => Promise<void>;
  categories: Category[];
  addCategory: (category: Category) => Promise<{ error: any } | void>;
  updateCategory: (category: Category) => Promise<{ error: any } | void>;
  deleteCategory: (categoryId: string) => Promise<{ error: any } | void>;
  reorderCategories: (categories: Category[]) => Promise<void>;
  activeOrders: Record<string, CartItem[]>; // tableId -> items
  updateActiveOrder: (tableId: string, items: CartItem[]) => Promise<void>;
  clearActiveOrder: (tableId: string) => Promise<void>;
  taxRate: number;
  updateTaxRate: (rate: number) => Promise<void>;
  error: string | null;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

// --- Mappers (DB <-> App) ---

const mapTableFromDB = (row: any): Table => ({
  id: row.id,
  name: row.name,
  status: row.status,
  seats: Number(row.seats),
  guests: row.guests ? Number(row.guests) : undefined,
  timeElapsed: row.time_elapsed,
  occupiedSince: row.occupied_since,
  server: row.server,
  total: row.total ? Number(row.total) : undefined,
  area: row.area,
  x: Number(row.x),
  y: Number(row.y),
  shape: row.shape
});

const mapTableToDB = (table: Table) => ({
  id: table.id,
  name: table.name,
  status: table.status,
  seats: table.seats,
  guests: table.guests,
  time_elapsed: table.timeElapsed,
  occupied_since: table.occupiedSince,
  server: table.server,
  total: table.total,
  area: table.area,
  x: table.x,
  y: table.y,
  shape: table.shape
});

const mapInventoryFromDB = (row: any): InventoryItem => ({
  id: row.id,
  name: row.name,
  category: row.category,
  stock: Number(row.stock),
  unit: row.unit,
  // Provide defaults if columns are missing in DB return
  minStock: row.min_stock !== undefined ? Number(row.min_stock) : 5, 
  status: row.status,
  icon: row.icon,
  description: row.description || ''
});

const mapInventoryToDB = (item: InventoryItem) => ({
  id: item.id,
  name: item.name,
  category: item.category,
  stock: item.stock,
  unit: item.unit,
  // Removed 'min_stock' and 'description' from write payload due to schema errors if columns missing
  // min_stock: item.minStock, 
  status: item.status,
  icon: item.icon,
  // description: item.description 
});

const mapMenuItemFromDB = (row: any): MenuItem => ({
  id: row.id,
  name: row.name,
  price: Number(row.price),
  image: row.image,
  category: row.category,
  description: row.description || '',
  stock: row.stock !== null ? Number(row.stock) : undefined
});

const mapMenuItemToDB = (item: MenuItem) => ({
  id: item.id,
  name: item.name,
  price: item.price,
  image: item.image,
  category: item.category,
  description: item.description,
  stock: item.stock
});

const mapOrderFromDB = (row: any): Order => ({
  id: row.id,
  customerName: row.customer || row.customer_name || 'Guest', // Handle potential schema variance
  table: row.table_name || row.table || 'Unknown',
  date: row.date,
  total: Number(row.total),
  status: row.status,
  items: row.items,
  paymentMethod: row.payment_method || 'cash',
  orderType: row.order_type || 'dine-in',
  discount: Number(row.discount || 0),
  notes: row.notes || ''
});

const mapOrderToDB = (order: Order) => ({
  id: order.id,
  customer_name: order.customerName,
  table_name: order.table,
  date: order.date,
  total: order.total,
  status: order.status,
  items: order.items,
  payment_method: order.paymentMethod,
  order_type: order.orderType || 'dine-in',
  discount: order.discount || 0,
  notes: order.notes || ''
});

const mapCategoryToDB = (cat: Category) => ({
    id: cat.id,
    name: cat.name,
    icon: cat.icon,
    sort_order: cat.sortOrder
});

const mapCategoryFromDB = (row: any): Category => ({
    id: row.id,
    name: row.name,
    icon: row.icon,
    sortOrder: row.sort_order
});

// --- Initial Mock Data ---
const INITIAL_TABLES: Table[] = [
    { id: 'T1', name: '01', status: 'occupied', seats: 4, guests: 4, timeElapsed: '1h 12m', occupiedSince: new Date(Date.now() - 3600000).toISOString(), server: 'Sarah', x: 50, y: 50, shape: 'rect', area: 'Main Dining', total: 1250000 },
    { id: 'T2', name: '02', status: 'available', seats: 2, x: 200, y: 50, shape: 'round', area: 'Main Dining' },
    { id: 'T3', name: '03', status: 'dirty', seats: 4, x: 320, y: 50, shape: 'rect', area: 'Main Dining' },
    { id: 'T4', name: '04', status: 'occupied', seats: 6, guests: 5, timeElapsed: '45m', occupiedSince: new Date(Date.now() - 2700000).toISOString(), server: 'Mike', total: 1250000, x: 50, y: 220, shape: 'rect', area: 'Main Dining' },
    { id: 'T5', name: '05', status: 'available', seats: 8, x: 250, y: 220, shape: 'rect', area: 'Main Dining' },
    { id: 'B1', name: 'Bar 1', status: 'occupied', seats: 1, guests: 1, timeElapsed: '20m', occupiedSince: new Date(Date.now() - 1200000).toISOString(), server: 'Alex', x: 500, y: 50, shape: 'round', area: 'Bar', total: 150000 },
    { id: 'B2', name: 'Bar 2', status: 'available', seats: 1, x: 500, y: 120, shape: 'round', area: 'Bar' },
    { id: 'P1', name: 'Patio 1', status: 'available', seats: 4, x: 50, y: 50, shape: 'round', area: 'Patio' },
];

const INITIAL_INVENTORY: InventoryItem[] = [
    { id: '1', name: 'Phở Bò Đặc Biệt', category: 'food', stock: 15, unit: 'Bowls', minStock: 10, status: 'in-stock', icon: 'ramen_dining' },
    { id: '2', name: 'Bún Chả Hà Nội', category: 'food', stock: 8, unit: 'Portions', minStock: 5, status: 'in-stock', icon: 'rice_bowl' },
    { id: '3', name: 'Tiger Beer', category: 'drink', stock: 45, unit: 'Cans', minStock: 24, status: 'in-stock', icon: 'sports_bar' },
    { id: '4', name: 'Ribeye Steak', category: 'ingredient', stock: 12, unit: 'kg', minStock: 5, status: 'in-stock', icon: 'restaurant' },
    { id: '5', name: 'Bánh Mì Thịt Nướng', category: 'food', stock: 0, unit: 'Pcs', minStock: 10, status: 'out-of-stock', icon: 'lunch_dining' },
    { id: '6', name: 'Cà Phê Sữa Đá', category: 'drink', stock: 120, unit: 'Cups', minStock: 24, status: 'in-stock', icon: 'local_cafe' },
    { id: '7', name: 'Cơm Tấm Sườn Bì', category: 'food', stock: 2, unit: 'Plates', minStock: 5, status: 'low-stock', icon: 'restaurant' },
    { id: '8', name: 'Gỏi Cuốn Tôm Thịt', category: 'food', stock: 5, unit: 'Rolls', minStock: 10, status: 'low-stock', icon: 'nutrition' }
];

const INITIAL_CATEGORIES: Category[] = [
    { id: 'pho', name: 'Phở & Noodles', icon: 'ramen_dining', sortOrder: 0 },
    { id: 'rice', name: 'Rice Dishes', icon: 'rice_bowl', sortOrder: 1 },
    { id: 'banhmi', name: 'Bánh Mì', icon: 'lunch_dining', sortOrder: 2 },
    { id: 'beverages', name: 'Beverages', icon: 'local_cafe', sortOrder: 3 },
    { id: 'desserts', name: 'Desserts', icon: 'icecream', sortOrder: 4 },
];

const INITIAL_MENU_ITEMS: MenuItem[] = [
    { id: '1', name: 'Phở Bò Đặc Biệt', price: 65000, category: 'pho', stock: 15, image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuA0G1DD2ZPmSmp9LhsxJgtHUClq7zz9vHHizD_98olHbyvKmPV3T1P6JWhvhgmy8wAtVzICCYu703iFg1OUB2fRmvu6U5po5I4qJIYrARHMu9H5rSj9tZEm_jQ3UmdSYLAk-WbPezebnl4uqLFE_yuvSKf9_Dz5sC9ZJXZfjnRiNpMDZogyGBMqJiyOwmh2OGxQsRJ0HmO_GqpfN7mp8kIB3TRBR4TRY0ZZsDZyGiaeihqE8SWzhnBmja_GhE4XjqXGBh93IGTLokg' },
    { id: '2', name: 'Bún Chả Hà Nội', price: 55000, category: 'pho', stock: 8, image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDbqlHyAZCJXmxQpTRwOGQQnF2hbij2IN5KVwnM_zohGTRDXknOKuAZqeKyeLRj0fFxQt_T3lhgPgutLB3ke18NL54FLMm4kFxe0BEm3FiXCB339Io4ks1m8B9m92KLP94wYziKvk-bI6Ooo3OiapZKF79CN-1PNZTbcVNpsL8khCmfG9bSccSuusggOEElvvqIJAyHnliOYp8GxNOum6kBVHainjvDe-0TSlrV4EbchjjK7CDmgURQ3DbxwTXR3xlkUbqmFmz4_cA' },
    { id: '3', name: 'Bánh Mì Thịt Nướng', price: 35000, category: 'banhmi', stock: 0, image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCtOSg-3tKZ6S-D1UUfTMUfC53Vb7TBhWQbPeXDSw2JoG21icKJaU6-sOvr-ktEWwZWcTe8A2Am1T6hw96s0jsrB_NQEh7Q8IdEr_omnYtK9pXqGwnRN29eH8O5VKUvDYuWLxk17liWoaXzMfNPMzGIdNJcnGk-BsG4HSMJmtXQx5nNAqf0HB8rgblXGkHmiiyZTJgftuTdVxOCk5ntagmoXBtbcQ2gCeh5VeI77jyf9s9JRj3r0hwJLMxxX5nV9urp6bx5QTIMwcI' },
    { id: '4', name: 'Cơm Tấm Sườn Bì', price: 50000, category: 'rice', stock: 2, image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAwfArW_E6ClhkyuKvDB6R181IszL2WuF4jqUASEHt3WKq9iCYIIurXtHKPkcX4ENEMLoW5H730zHi7dW--jHPlYYMMLJmn1edDzRcpDol8jhXo5ZhJ9xzm--Q84PSh7UI6FVJXwp1DvtWYm5PjWgcVhlquCRvL8U265X6mgB0o-QvsFFZ290BPEotteu7BZdGuGcqA9BpjnHlCocOOlTEo2gQFbAZwG8oraBgEX558W9l3nKyKrsBWe69ZR_4fSfArR6v51PDrcCs' },
    { id: '5', name: 'Cà Phê Sữa Đá', price: 25000, category: 'beverages', stock: 120, image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuArBle8qp118Q7wv5tB-_KrMUH1YsFdr44xKyRSuuMONJWangOcOvkJzB2sj9WO1HNTy70wED6isaJkDE9Ez8GKKNXDvSlshKBG8in2GAjAfGg_7PwhNa1VMZtcExcgvVMtfTAAiX4JmAH1Vubi4vIumc-4oMPLC0BHn58LBT02wjFGy7UwKgFcShQS-tqfzGO4LIVLKIhFL7E95g1qpcp8rmbfbjd6epjAtP2k6grYp57tGFIE3PSIWfLibtUIa1mOo8o8lq0HeJM' },
    { id: '6', name: 'Gỏi Cuốn Tôm Thịt', price: 15000, category: 'pho', stock: 5, image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDqzICyHLXsX_EPVmk_uh3VORBFyzLxXGixmx7u6Qwsq6yxb7aJqI9Z560UQEJWJ96itwQGllyE9kW4n9lyxhYvq6l-YYVojs_oKc7jwYXOKyX5YH4hti5WO9PFCd14v5Mo3h8TqElLon8zGd94FvmetcuLhKvP9DbwIwKPSvOl_j2qqNF_CiUWboZz-uvn3RPhCOWUPZPaT4vA6g3DgLGdmk1fU2CwkiAgs_wtK77UMF1qtBRttJHOAKOtcqUahRxyIN6vhUktqCE' },
];

const INITIAL_ORDERS: Order[] = [];

// Helper to check if error is "Table missing"
const isTableMissingError = (error: any) => {
    if (!error) return false;
    const msg = (error.message || '').toLowerCase();
    const code = error.code || '';
    return code === '42P01' || msg.includes('does not exist') || msg.includes('could not find the table');
};

export const DataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [tables, setTables] = useState<Table[]>(() => {
      const saved = localStorage.getItem('eco_tables');
      return saved ? JSON.parse(saved) : INITIAL_TABLES;
  });

  const [inventory, setInventory] = useState<InventoryItem[]>(() => {
      const saved = localStorage.getItem('eco_inventory');
      return saved ? JSON.parse(saved) : INITIAL_INVENTORY;
  });

  const [orders, setOrders] = useState<Order[]>(() => {
      const saved = localStorage.getItem('eco_orders');
      return saved ? JSON.parse(saved) : INITIAL_ORDERS;
  });

  const [menuItems, setMenuItems] = useState<MenuItem[]>(() => {
      const saved = localStorage.getItem('eco_menu');
      return saved ? JSON.parse(saved) : INITIAL_MENU_ITEMS;
  });

  const [categories, setCategories] = useState<Category[]>(() => {
      const saved = localStorage.getItem('eco_categories');
      return saved ? JSON.parse(saved) : INITIAL_CATEGORIES;
  });

  const [activeOrders, setActiveOrders] = useState<Record<string, CartItem[]>>(() => {
      const saved = localStorage.getItem('eco_active_orders');
      return saved ? JSON.parse(saved) : {};
  });

  const [taxRate, setTaxRate] = useState<number>(() => {
      const saved = localStorage.getItem('eco_tax_rate');
      return saved ? Number(saved) : 8;
  });

  const [error, setError] = useState<string | null>(null);

  // Clear error after 5 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // Fetch Initial Data & Setup Subscriptions
  useEffect(() => {
    if (!supabase) {
        console.warn("Supabase not configured. Using local storage.");
        return;
    }

    const initData = async () => {
      try {
        // 1. Tables
        const { data: tablesData, error: tablesError } = await supabase.from('tables').select('*');
        if (!tablesError && tablesData) {
            if (tablesData.length > 0) setTables(tablesData.map(mapTableFromDB));
            else {
                // Seed if empty and no error
                const { error } = await supabase.from('tables').insert(INITIAL_TABLES.map(mapTableToDB));
                if (!error) setTables(INITIAL_TABLES);
            }
        }

        // 2. Inventory
        const { data: inventoryData, error: invError } = await supabase.from('inventory').select('*');
        if (!invError && inventoryData) {
            if (inventoryData.length > 0) setInventory(inventoryData.map(mapInventoryFromDB));
            else {
                const { error } = await supabase.from('inventory').insert(INITIAL_INVENTORY.map(mapInventoryToDB));
                if (!error) setInventory(INITIAL_INVENTORY);
            }
        }

        // 3. Menu Items
        const { data: menuData, error: menuError } = await supabase.from('menu_items').select('*');
        if (!menuError && menuData) {
            if (menuData.length > 0) setMenuItems(menuData.map(mapMenuItemFromDB));
            else {
                const { error } = await supabase.from('menu_items').insert(INITIAL_MENU_ITEMS.map(mapMenuItemToDB));
                if (!error) setMenuItems(INITIAL_MENU_ITEMS);
            }
        }

        // 3.5 Categories
        const { data: categoryData, error: categoryError } = await supabase.from('categories').select('*').order('sort_order', { ascending: true });
        if (!categoryError && categoryData) {
            if (categoryData.length > 0) setCategories(categoryData.map(mapCategoryFromDB));
            else {
                const { error } = await supabase.from('categories').insert(INITIAL_CATEGORIES.map(mapCategoryToDB));
                if (!error) setCategories(INITIAL_CATEGORIES);
            }
        } else if (isTableMissingError(categoryError)) {
             setCategories(INITIAL_CATEGORIES);
        }

        // 4. Orders
        const { data: ordersData } = await supabase.from('orders').select('*');
        if (ordersData && ordersData.length > 0) {
            setOrders(ordersData.map(mapOrderFromDB));
        }

        // 5. Active Orders
        const { data: activeOrdersData } = await supabase.from('active_orders').select('*');
        if (activeOrdersData) {
            const ordersMap: Record<string, CartItem[]> = {};
            activeOrdersData.forEach((row: any) => {
                ordersMap[row.table_id] = row.items;
            });
            setActiveOrders(ordersMap);
        }

        // 6. Settings (Tax Rate)
        const { data: settingsData, error: settingsError } = await supabase.from('settings').select('*').eq('key', 'tax_rate').single();
        if (settingsData) {
            setTaxRate(Number(settingsData.value));
        } else if (!settingsError || isTableMissingError(settingsError)) {
            // Init setting if missing or table missing logic handled later
            if (!settingsError) await supabase.from('settings').insert({ key: 'tax_rate', value: 8 });
        }
      } catch (e: any) {
        console.error("Initialization Error:", e);
        setError("Failed to load initial data. Using offline mode where possible.");
      }
    };

    initData();

    // Supabase Realtime Subscriptions
    const channel = supabase.channel('realtime_updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tables' }, (payload) => {
         if (payload.eventType === 'INSERT') setTables(prev => [...prev, mapTableFromDB(payload.new)]);
         if (payload.eventType === 'UPDATE') setTables(prev => prev.map(t => t.id === payload.new.id ? mapTableFromDB(payload.new) : t));
         if (payload.eventType === 'DELETE') setTables(prev => prev.filter(t => t.id !== payload.old.id));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory' }, (payload) => {
         if (payload.eventType === 'INSERT') {
            const newItem = mapInventoryFromDB(payload.new);
            setInventory(prev => {
                if (prev.some(i => i.id === newItem.id)) return prev;
                return [newItem, ...prev];
            });
         }
         if (payload.eventType === 'UPDATE') setInventory(prev => prev.map(i => i.id === payload.new.id ? mapInventoryFromDB(payload.new) : i));
         if (payload.eventType === 'DELETE') setInventory(prev => prev.filter(i => i.id !== payload.old.id));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
         if (payload.eventType === 'INSERT') {
            const newOrder = mapOrderFromDB(payload.new);
            setOrders(prev => {
                if (prev.some(o => o.id === newOrder.id)) return prev;
                return [newOrder, ...prev];
            });
         }
         if (payload.eventType === 'UPDATE') setOrders(prev => prev.map(o => o.id === payload.new.id ? mapOrderFromDB(payload.new) : o));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'menu_items' }, (payload) => {
         if (payload.eventType === 'INSERT') {
             const newItem = mapMenuItemFromDB(payload.new);
             setMenuItems(prev => {
                 // Prevent duplicates if optimistic update already added it
                 if (prev.some(i => i.id === newItem.id)) return prev;
                 return [...prev, newItem];
             });
         }
         if (payload.eventType === 'UPDATE') {
             const updatedItem = mapMenuItemFromDB(payload.new);
             setMenuItems(prev => prev.map(m => m.id === updatedItem.id ? updatedItem : m));
         }
         if (payload.eventType === 'DELETE') {
             setMenuItems(prev => prev.filter(m => m.id !== payload.old.id));
         }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, (payload) => {
         // Re-fetch categories on change to ensure order is correct, or manually handle sort
         // Simple handling:
         if (payload.eventType === 'INSERT') setCategories(prev => [...prev, mapCategoryFromDB(payload.new)].sort((a,b) => (a.sortOrder||0) - (b.sortOrder||0)));
         if (payload.eventType === 'UPDATE') setCategories(prev => prev.map(c => c.id === payload.new.id ? mapCategoryFromDB(payload.new) : c).sort((a,b) => (a.sortOrder||0) - (b.sortOrder||0)));
         if (payload.eventType === 'DELETE') setCategories(prev => prev.filter(c => c.id !== payload.old.id));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'active_orders' }, (payload) => {
         const row = payload.new as any;
         if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
             setActiveOrders(prev => ({ ...prev, [row.table_id]: row.items }));
         }
         if (payload.eventType === 'DELETE') {
             setActiveOrders(prev => {
                 const next = { ...prev };
                 delete next[payload.old.table_id];
                 return next;
             });
         }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'settings' }, (payload) => {
          if (payload.eventType === 'UPDATE' && payload.new.key === 'tax_rate') {
              setTaxRate(Number(payload.new.value));
          }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Persistence Effects - ALWAYS ENABLED for offline support and sync issues
  useEffect(() => {
    localStorage.setItem('eco_tables', JSON.stringify(tables));
  }, [tables]);

  useEffect(() => {
    localStorage.setItem('eco_inventory', JSON.stringify(inventory));
  }, [inventory]);

  useEffect(() => {
    localStorage.setItem('eco_orders', JSON.stringify(orders));
  }, [orders]);

  useEffect(() => {
    localStorage.setItem('eco_menu', JSON.stringify(menuItems));
  }, [menuItems]);

  useEffect(() => {
    localStorage.setItem('eco_categories', JSON.stringify(categories));
  }, [categories]);

  useEffect(() => {
    localStorage.setItem('eco_active_orders', JSON.stringify(activeOrders));
  }, [activeOrders]);


  // Actions with Rollback Support (Soft Fail if Table Missing)
  const updateTable = async (updatedTable: Table) => {
      const prevTables = [...tables];
      setTables(prev => prev.map(t => t.id === updatedTable.id ? updatedTable : t));
      
      if (supabase) {
          try {
              const { error } = await supabase.from('tables').upsert(mapTableToDB(updatedTable));
              if (error && !isTableMissingError(error)) {
                  console.error("Failed to update table:", error.message || error);
                  setError("Failed to update table status.");
                  setTables(prevTables); 
              } else if (isTableMissingError(error)) {
                  console.warn("Tables table missing. Using local.");
              }
          } catch (err) {
              console.error("Failed to update table (Network):", err);
              setTables(prevTables);
          }
      }
  };

  const updateTables = async (updatedTables: Table[]) => {
      setTables(updatedTables);
      if (supabase) {
          try {
              const { error } = await supabase.from('tables').upsert(updatedTables.map(mapTableToDB));
              if (isTableMissingError(error)) console.warn("Tables table missing. Using local.");
          } catch (err) { console.error("Update tables failed", err); }
      }
  };

  const deleteTable = async (tableId: string) => {
      const prevTables = [...tables];
      setTables(prev => prev.filter(t => t.id !== tableId));
      
      if (supabase) {
          try {
              const { error } = await supabase.from('tables').delete().eq('id', tableId);
              if (error && !isTableMissingError(error)) {
                  console.error("Failed to delete table:", error);
                  setError("Failed to delete table.");
                  setTables(prevTables);
              }
          } catch (err) {
              console.error("Delete table failed", err);
              setTables(prevTables);
          }
      }
  };

  const updateInventoryItem = async (updatedItem: InventoryItem) => {
      const prevInventory = [...inventory];
      
      // 1. Optimistic Inventory Update
      setInventory(prev => prev.map(i => i.id === updatedItem.id ? updatedItem : i));
      
      // 2. Optimistic Menu Update (Cross-sync by name)
      const linkedMenuItem = menuItems.find(m => m.name.toLowerCase() === updatedItem.name.toLowerCase());
      if (linkedMenuItem) {
          setMenuItems(prev => prev.map(m => m.id === linkedMenuItem.id ? { ...m, stock: updatedItem.stock } : m));
      }
      
      if (supabase) {
          try {
              const { error } = await supabase.from('inventory').upsert(mapInventoryToDB(updatedItem));
              if (error && !isTableMissingError(error)) {
                  console.error("Failed to update inventory:", error.message || error);
                  setError(`Failed to update inventory: ${error.message || JSON.stringify(error)}`);
                  setInventory(prevInventory);
              } else if (!error && linkedMenuItem) {
                  // 3. DB Menu Update (Sync)
                  await supabase.from('menu_items').update({ stock: updatedItem.stock }).eq('id', linkedMenuItem.id);
              }
          } catch (err) {
              console.error("Update inventory failed", err);
              setInventory(prevInventory);
          }
      }
  };

  const addInventoryItem = async (item: InventoryItem) => {
      const prevInventory = [...inventory];
      setInventory(prev => [item, ...prev]);
      
      if (supabase) {
          try {
              const { error } = await supabase.from('inventory').insert(mapInventoryToDB(item));
              if (error && !isTableMissingError(error)) {
                  console.error("Failed to add inventory item:", error.message || error);
                  setError(`Failed to create item: ${error.message || JSON.stringify(error)}`);
                  setInventory(prevInventory);
              }
          } catch (err) {
              console.error("Add inventory failed", err);
              setInventory(prevInventory);
          }
      }
  };

  const deleteInventoryItem = async (itemId: string) => {
      const prevInventory = [...inventory];
      setInventory(prev => prev.filter(i => i.id !== itemId));
      
      if (supabase) {
          try {
              const { error } = await supabase.from('inventory').delete().eq('id', itemId);
              if (error && !isTableMissingError(error)) {
                  console.error("Failed to delete inventory item:", error.message || error);
                  setError(`Failed to delete item: ${error.message || JSON.stringify(error)}`);
                  setInventory(prevInventory);
              }
          } catch (err) {
              console.error("Delete inventory failed", err);
              setInventory(prevInventory);
          }
      }
  };

  const addOrder = async (order: Order) => {
      setOrders(prev => [order, ...prev]);
      if (supabase) {
          try {
              const { error } = await supabase.from('orders').insert(mapOrderToDB(order));
              if (error) {
                  if (!isTableMissingError(error)) {
                      const msg = error.message || JSON.stringify(error);
                      console.error("Failed to save order:", msg);
                      setError(`Order saved locally. Sync failed: ${msg}`);
                  }
              }
          } catch (err: any) {
              const msg = err.message || 'Network error';
              console.error("Failed to save order (Network):", msg);
              setError(`Order saved locally. Sync failed: ${msg}`);
          }
      }
  };

  const updateMenuItem = async (item: MenuItem, inventoryCategory?: string) => {
      const prevMenu = [...menuItems];
      const oldItem = prevMenu.find(m => m.id === item.id);
      
      // 1. Optimistic Menu Update
      setMenuItems(prev => prev.map(m => m.id === item.id ? item : m));
      
      // 2. Cascade Sync Inventory (Name, Stock, Category change)
      if (oldItem) {
          // Use OLD name to find the link in case of rename
          const linkedInventoryItem = inventory.find(i => i.name.toLowerCase() === oldItem.name.toLowerCase());
          
          if (linkedInventoryItem) {
              const updates: any = {};
              let hasUpdates = false;

              // Check for changes
              if (oldItem.name !== item.name) {
                  updates.name = item.name;
                  hasUpdates = true;
              }
              if (inventoryCategory && linkedInventoryItem.category !== inventoryCategory) {
                  updates.category = inventoryCategory;
                  hasUpdates = true;
              }
              if (item.stock !== undefined && item.stock !== linkedInventoryItem.stock) {
                  updates.stock = item.stock;
                  updates.status = (item.stock === 0) ? 'out-of-stock' : (item.stock <= linkedInventoryItem.minStock ? 'low-stock' : 'in-stock');
                  hasUpdates = true;
              }
              
              if (hasUpdates) {
                  const updatedInv = { ...linkedInventoryItem, ...updates };
                  
                  // Update local inventory state immediately
                  setInventory(prev => prev.map(i => i.id === linkedInventoryItem.id ? updatedInv : i));
                  
                  // Update DB
                  if (supabase) {
                      try {
                          await supabase.from('inventory').update(mapInventoryToDB(updatedInv)).eq('id', linkedInventoryItem.id);
                      } catch (err) { console.error("Inventory sync failed", err); }
                  }
              }
          } else {
              // Edge case: Linked inventory doesn't exist, create it to ensure sync
              const newInv: InventoryItem = {
                  id: `inv-${Date.now()}`,
                  name: item.name,
                  category: inventoryCategory || 'food',
                  stock: item.stock || 0,
                  unit: 'unit',
                  minStock: 5,
                  status: (item.stock || 0) > 5 ? 'in-stock' : 'low-stock',
                  icon: inventoryCategory === 'drink' ? 'local_drink' : inventoryCategory === 'ingredient' ? 'nutrition' : 'restaurant',
                  description: item.description
              };
              await addInventoryItem(newInv);
          }
      }
      
      if (supabase) {
          try {
              const { error } = await supabase.from('menu_items').upsert(mapMenuItemToDB(item));
              if (error && !isTableMissingError(error)) {
                  console.error("Failed to update menu:", error);
                  setError("Failed to update menu item.");
                  setMenuItems(prevMenu); // Rollback
              }
          } catch (err) {
              console.error("Update menu failed", err);
              setMenuItems(prevMenu);
          }
      }
  };

  const addMenuItem = async (item: MenuItem, inventoryCategory?: string) => {
      const prevMenu = [...menuItems];
      // Optimistic update
      setMenuItems(prev => [...prev, item]);
      
      // Sync Inventory Creation
      const newInv: InventoryItem = {
          id: `inv-${Date.now()}`,
          name: item.name,
          category: inventoryCategory || 'food',
          stock: item.stock || 0,
          unit: 'unit',
          minStock: 5,
          status: (item.stock || 0) > 5 ? 'in-stock' : 'low-stock',
          icon: inventoryCategory === 'drink' ? 'local_drink' : inventoryCategory === 'ingredient' ? 'nutrition' : 'restaurant',
          description: item.description
      };
      
      // Use internal function to handle optimistic + DB for inventory
      await addInventoryItem(newInv);
      
      if (supabase) {
          try {
              const { error } = await supabase.from('menu_items').insert(mapMenuItemToDB(item));
              if (error && !isTableMissingError(error)) {
                  console.error("Failed to add menu item:", error);
                  setError("Failed to add menu item.");
                  setMenuItems(prevMenu); // Rollback
              }
          } catch (err) {
              console.error("Add menu item failed", err);
              setMenuItems(prevMenu);
          }
      }
  };

  const deleteMenuItem = async (itemId: string) => {
      const prevMenu = [...menuItems];
      const itemToDelete = prevMenu.find(m => m.id === itemId);
      
      // Optimistic update
      setMenuItems(prev => prev.filter(m => m.id !== itemId));
      
      // Also delete corresponding inventory item if it exists
      if (itemToDelete) {
          const linkedInventoryItem = inventory.find(i => i.name.toLowerCase() === itemToDelete.name.toLowerCase());
          if (linkedInventoryItem) {
              setInventory(prev => prev.filter(i => i.id !== linkedInventoryItem.id));
              if (supabase) {
                  try {
                      await supabase.from('inventory').delete().eq('id', linkedInventoryItem.id);
                  } catch (err) { console.error("Inventory delete failed", err); }
              }
          }
      }
      
      if (supabase) {
          try {
              const { error } = await supabase.from('menu_items').delete().eq('id', itemId);
              if (error && !isTableMissingError(error)) {
                  console.error("Failed to delete menu item:", error);
                  setError("Failed to delete menu item.");
                  setMenuItems(prevMenu); // Rollback
              }
          } catch (err) {
              console.error("Delete menu item failed", err);
              setMenuItems(prevMenu);
          }
      }
  };

  const addCategory = async (category: Category) => {
      const prevCategories = [...categories];
      const newCategory = { ...category, sortOrder: categories.length };
      setCategories(prev => [...prev, newCategory]);
      if (supabase) {
          try {
              const { error } = await supabase.from('categories').insert(mapCategoryToDB(newCategory));
              if (error) {
                  if (isTableMissingError(error)) {
                      console.warn("Categories table missing. Using local only.");
                      return { error: null }; // Treat as success for UI
                  }
                  console.error("Failed to add category:", error);
                  setError("Failed to add category.");
                  setCategories(prevCategories);
                  return { error };
              }
          } catch (err: any) {
              console.error("Add category failed", err);
              setCategories(prevCategories);
              return { error: err };
          }
      }
      return { error: null };
  };

  const updateCategory = async (category: Category) => {
      const prevCategories = [...categories];
      setCategories(prev => prev.map(c => c.id === category.id ? category : c));
      if (supabase) {
          try {
              const { error } = await supabase.from('categories').upsert(mapCategoryToDB(category));
              if (error) {
                  if (isTableMissingError(error)) {
                      console.warn("Categories table missing. Using local only.");
                      return { error: null };
                  }
                  console.error("Failed to update category:", error.message || error);
                  setError(`Failed to update category: ${error.message || 'Unknown error'}`);
                  setCategories(prevCategories);
                  return { error };
              }
          } catch (err: any) {
              console.error("Update category failed", err);
              setCategories(prevCategories);
              return { error: err };
          }
      }
      return { error: null };
  };

  const deleteCategory = async (categoryId: string) => {
      const prevCategories = [...categories];
      setCategories(prev => prev.filter(c => c.id !== categoryId));
      if (supabase) {
          try {
              const { error } = await supabase.from('categories').delete().eq('id', categoryId);
              if (error) {
                  if (isTableMissingError(error)) {
                      console.warn("Categories table missing. Using local only.");
                      return { error: null };
                  }
                  console.error("Failed to delete category:", error.message || error);
                  setError(`Failed to delete category: ${error.message || 'Unknown error'}`);
                  setCategories(prevCategories);
                  return { error };
              }
          } catch (err: any) {
              console.error("Delete category failed", err);
              setCategories(prevCategories);
              return { error: err };
          }
      }
      return { error: null };
  };

  const reorderCategories = async (newCategories: Category[]) => {
      // Create a new array with updated sortOrder property for each item
      const updatedCategories = newCategories.map((cat, index) => ({
          ...cat,
          sortOrder: index
      }));

      // Update local state immediately with the correctly sorted items
      setCategories(updatedCategories);
      
      // Update DB in background
      if (supabase) {
          try {
              const updates = updatedCategories.map(cat => mapCategoryToDB(cat));
              const { error } = await supabase.from('categories').upsert(updates);
              if (error) {
                  if (isTableMissingError(error)) {
                      console.warn("Categories table missing. Sorting local only.");
                  } else {
                      console.error("Failed to reorder categories:", error);
                      setError("Failed to save category order.");
                  }
              }
          } catch (err) { console.error("Reorder categories failed", err); }
      }
  };

  const updateActiveOrder = async (tableId: string, items: CartItem[]) => {
      setActiveOrders(prev => ({ ...prev, [tableId]: items }));
      
      const total = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      
      if (supabase) {
        try {
            const { error } = await supabase.from('active_orders').upsert({ table_id: tableId, items });
            if (isTableMissingError(error)) console.warn("Active orders table missing. Using local.");
        } catch (err) { console.error("Update active order failed", err); }
      }
      
      // Update table total
      const table = tables.find(t => t.id === tableId);
      if (table) {
          await updateTable({ ...table, total });
      }
  };

  const clearActiveOrder = async (tableId: string) => {
      setActiveOrders(prev => {
          const next = { ...prev };
          delete next[tableId];
          return next;
      });

      if (supabase) {
        try {
            const { error } = await supabase.from('active_orders').delete().eq('table_id', tableId);
            if (isTableMissingError(error)) console.warn("Active orders table missing. Using local.");
        } catch (err) { console.error("Clear active order failed", err); }
      }
      
      const table = tables.find(t => t.id === tableId);
      if (table) {
          await updateTable({ ...table, total: 0 });
      }
  };

  const updateTaxRate = async (rate: number) => {
      setTaxRate(rate);
      localStorage.setItem('eco_tax_rate', rate.toString());
      if (supabase) {
          try {
              const { error } = await supabase.from('settings').upsert({ key: 'tax_rate', value: rate });
              if (error && !isTableMissingError(error)) console.error("Failed to sync tax rate:", error);
          } catch (err) { console.error("Update tax rate failed", err); }
      }
  }

  return (
    <DataContext.Provider value={{
      tables,
      updateTable,
      updateTables,
      deleteTable,
      inventory,
      updateInventoryItem,
      addInventoryItem,
      deleteInventoryItem,
      orders,
      addOrder,
      menuItems,
      updateMenuItem,
      addMenuItem,
      deleteMenuItem,
      categories,
      addCategory,
      updateCategory,
      deleteCategory,
      reorderCategories,
      activeOrders,
      updateActiveOrder,
      clearActiveOrder,
      taxRate,
      updateTaxRate,
      error
    }}>
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};