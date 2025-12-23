import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Table, InventoryItem, Order, MenuItem, CartItem, AppSetting } from '../types';
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
  updateMenuItem: (item: MenuItem) => Promise<void>;
  addMenuItem: (item: MenuItem) => Promise<void>;
  deleteMenuItem: (itemId: string) => Promise<void>;
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
  seats: row.seats,
  guests: row.guests,
  timeElapsed: row.time_elapsed,
  occupiedSince: row.occupied_since,
  server: row.server,
  total: row.total,
  area: row.area,
  x: row.x,
  y: row.y,
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
  stock: row.stock,
  unit: row.unit,
  minStock: row.min_stock,
  status: row.status,
  icon: row.icon,
  description: row.description
});

const mapInventoryToDB = (item: InventoryItem) => ({
  id: item.id,
  name: item.name,
  category: item.category,
  stock: item.stock,
  unit: item.unit,
  min_stock: item.minStock,
  status: item.status,
  icon: item.icon,
  description: item.description
});

const mapOrderFromDB = (row: any): Order => ({
  id: row.id,
  customerName: row.customer_name,
  table: row.table_name,
  date: row.date,
  total: row.total,
  status: row.status,
  items: row.items,
  paymentMethod: row.payment_method,
  orderType: row.order_type,
  discount: row.discount,
  notes: row.notes
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
  order_type: order.orderType,
  discount: order.discount,
  notes: order.notes
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

const INITIAL_MENU_ITEMS: MenuItem[] = [
    { id: '1', name: 'Phở Bò Đặc Biệt', price: 65000, category: 'pho', stock: 15, image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuA0G1DD2ZPmSmp9LhsxJgtHUClq7zz9vHHizD_98olHbyvKmPV3T1P6JWhvhgmy8wAtVzICCYu703iFg1OUB2fRmvu6U5po5I4qJIYrARHMu9H5rSj9tZEm_jQ3UmdSYLAk-WbPezebnl4uqLFE_yuvSKf9_Dz5sC9ZJXZfjnRiNpMDZogyGBMqJiyOwmh2OGxQsRJ0HmO_GqpfN7mp8kIB3TRBR4TRY0ZZsDZyGiaeihqE8SWzhnBmja_GhE4XjqXGBh93IGTLokg' },
    { id: '2', name: 'Bún Chả Hà Nội', price: 55000, category: 'pho', stock: 8, image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDbqlHyAZCJXmxQpTRwOGQQnF2hbij2IN5KVwnM_zohGTRDXknOKuAZqeKyeLRj0fFxQt_T3lhgPgutLB3ke18NL54FLMm4kFxe0BEm3FiXCB339Io4ks1m8B9m92KLP94wYziKvk-bI6Ooo3OiapZKF79CN-1PNZTbcVNpsL8khCmfG9bSccSuusggOEElvvqIJAyHnliOYp8GxNOum6kBVHainjvDe-0TSlrV4EbchjjK7CDmgURQ3DbxwTXR3xlkUbqmFmz4_cA' },
    { id: '3', name: 'Bánh Mì Thịt Nướng', price: 35000, category: 'banhmi', stock: 0, image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCtOSg-3tKZ6S-D1UUfTMUfC53Vb7TBhWQbPeXDSw2JoG21icKJaU6-sOvr-ktEWwZWcTe8A2Am1T6hw96s0jsrB_NQEh7Q8IdEr_omnYtK9pXqGwnRN29eH8O5VKUvDYuWLxk17liWoaXzMfNPMzGIdNJcnGk-BsG4HSMJmtXQx5nNAqf0HB8rgblXGkHmiiyZTJgftuTdVxOCk5ntagmoXBtbcQ2gCeh5VeI77jyf9s9JRj3r0hwJLMxxX5nV9urp6bx5QTIMwcI' },
    { id: '4', name: 'Cơm Tấm Sườn Bì', price: 50000, category: 'rice', stock: 2, image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAwfArW_E6ClhkyuKvDB6R181IszL2WuF4jqUASEHt3WKq9iCYIIurXtHKPkcX4ENEMLoW5H730zHi7dW--jHPlYYMMLJmn1edDzRcpDol8jhXo5ZhJ9xzm--Q84PSh7UI6FVJXwp1DvtWYm5PjWgcVhlquCRvL8U265X6mgB0o-QvsFFZ290BPEotteu7BZdGuGcqA9BpjnHlCocOOlTEo2gQFbAZwG8oraBgEX558W9l3nKyKrsBWe69ZR_4fSfArR6v51PDrcCs' },
    { id: '5', name: 'Cà Phê Sữa Đá', price: 25000, category: 'beverages', stock: 120, image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuArBle8qp118Q7wv5tB-_KrMUH1YsFdr44xKyRSuuMONJWangOcOvkJzB2sj9WO1HNTy70wED6isaJkDE9Ez8GKKNXDvSlshKBG8in2GAjAfGg_7PwhNa1VMZtcExcgvVMtfTAAiX4JmAH1Vubi4vIumc-4oMPLC0BHn58LBT02wjFGy7UwKgFcShQS-tqfzGO4LIVLKIhFL7E95g1qpcp8rmbfbjd6epjAtP2k6grYp57tGFIE3PSIWfLibtUIa1mOo8o8lq0HeJM' },
    { id: '6', name: 'Gỏi Cuốn Tôm Thịt', price: 15000, category: 'pho', stock: 5, image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDqzICyHLXsX_EPVmk_uh3VORBFyzLxXGixmx7u6Qwsq6yxb7aJqI9Z560UQEJWJ96itwQGllyE9kW4n9lyxhYvq6l-YYVojs_oKc7jwYXOKyX5YH4hti5WO9PFCd14v5Mo3h8TqElLon8zGd94FvmetcuLhKvP9DbwIwKPSvOl_j2qqNF_CiUWboZz-uvn3RPhCOWUPZPaT4vA6g3DgLGdmk1fU2CwkiAgs_wtK77UMF1qtBRttJHOAKOtcqUahRxyIN6vhUktqCE' },
];

const INITIAL_ORDERS: Order[] = [
    {
      id: 'ORD-2490',
      customerName: 'Nguyen Van A',
      table: 'T1',
      date: '2023-10-24T12:45:00',
      total: 335600,
      status: 'completed',
      paymentMethod: 'Credit Card',
      items: [
        { name: 'Phở Bò Tái', quantity: 2 },
        { name: 'Cà Phê Sữa Đá', quantity: 1 }
      ]
    }
];

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
        if (tablesData && tablesData.length > 0) {
            setTables(tablesData.map(mapTableFromDB));
        } else if (!tablesError && tablesData?.length === 0) {
            // Seed tables if empty and no error
            await supabase.from('tables').insert(INITIAL_TABLES.map(mapTableToDB));
            setTables(INITIAL_TABLES);
        }

        // 2. Inventory
        const { data: inventoryData, error: invError } = await supabase.from('inventory').select('*');
        if (inventoryData && inventoryData.length > 0) {
            setInventory(inventoryData.map(mapInventoryFromDB));
        } else if (!invError && inventoryData?.length === 0) {
            await supabase.from('inventory').insert(INITIAL_INVENTORY.map(mapInventoryToDB));
            setInventory(INITIAL_INVENTORY);
        }

        // 3. Menu Items
        const { data: menuData, error: menuError } = await supabase.from('menu_items').select('*');
        if (menuData && menuData.length > 0) {
            setMenuItems(menuData);
        } else if (!menuError && menuData?.length === 0) {
            await supabase.from('menu_items').insert(INITIAL_MENU_ITEMS);
            setMenuItems(INITIAL_MENU_ITEMS);
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
        const { data: settingsData } = await supabase.from('settings').select('*').eq('key', 'tax_rate').single();
        if (settingsData) {
            setTaxRate(Number(settingsData.value));
        } else {
            // Init setting if missing
            await supabase.from('settings').insert({ key: 'tax_rate', value: 8 });
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
         if (payload.eventType === 'INSERT') setInventory(prev => [mapInventoryFromDB(payload.new), ...prev]);
         if (payload.eventType === 'UPDATE') setInventory(prev => prev.map(i => i.id === payload.new.id ? mapInventoryFromDB(payload.new) : i));
         if (payload.eventType === 'DELETE') setInventory(prev => prev.filter(i => i.id !== payload.old.id));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
         if (payload.eventType === 'INSERT') setOrders(prev => [mapOrderFromDB(payload.new), ...prev]);
         if (payload.eventType === 'UPDATE') setOrders(prev => prev.map(o => o.id === payload.new.id ? mapOrderFromDB(payload.new) : o));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'menu_items' }, (payload) => {
         if (payload.eventType === 'INSERT') setMenuItems(prev => [...prev, payload.new as MenuItem]);
         if (payload.eventType === 'UPDATE') setMenuItems(prev => prev.map(m => m.id === payload.new.id ? payload.new as MenuItem : m));
         if (payload.eventType === 'DELETE') setMenuItems(prev => prev.filter(m => m.id !== payload.old.id));
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

  // Persistence Effects (Fallback)
  useEffect(() => {
    if (!supabase) localStorage.setItem('eco_tables', JSON.stringify(tables));
  }, [tables]);

  useEffect(() => {
    if (!supabase) localStorage.setItem('eco_inventory', JSON.stringify(inventory));
  }, [inventory]);

  useEffect(() => {
    if (!supabase) localStorage.setItem('eco_orders', JSON.stringify(orders));
  }, [orders]);

  useEffect(() => {
    if (!supabase) localStorage.setItem('eco_menu', JSON.stringify(menuItems));
  }, [menuItems]);

  useEffect(() => {
    if (!supabase) localStorage.setItem('eco_active_orders', JSON.stringify(activeOrders));
  }, [activeOrders]);


  // Actions with Rollback Support
  const updateTable = async (updatedTable: Table) => {
      const prevTables = [...tables];
      setTables(prev => prev.map(t => t.id === updatedTable.id ? updatedTable : t));
      
      if (supabase) {
          const { error } = await supabase.from('tables').upsert(mapTableToDB(updatedTable));
          if (error) {
              console.error("Failed to update table:", error);
              setError("Failed to update table status.");
              setTables(prevTables); // Rollback
          }
      }
  };

  const updateTables = async (updatedTables: Table[]) => {
      setTables(updatedTables);
      if (supabase) await supabase.from('tables').upsert(updatedTables.map(mapTableToDB));
  };

  const deleteTable = async (tableId: string) => {
      const prevTables = [...tables];
      setTables(prev => prev.filter(t => t.id !== tableId));
      
      if (supabase) {
          const { error } = await supabase.from('tables').delete().eq('id', tableId);
          if (error) {
              console.error("Failed to delete table:", error);
              setError("Failed to delete table.");
              setTables(prevTables);
          }
      }
  };

  const updateInventoryItem = async (updatedItem: InventoryItem) => {
      const prevInventory = [...inventory];
      setInventory(prev => prev.map(i => i.id === updatedItem.id ? updatedItem : i));
      
      if (supabase) {
          const { error } = await supabase.from('inventory').upsert(mapInventoryToDB(updatedItem));
          if (error) {
              console.error("Failed to update inventory:", error);
              setError("Failed to update inventory.");
              setInventory(prevInventory);
          }
      }
  };

  const addInventoryItem = async (item: InventoryItem) => {
      const prevInventory = [...inventory];
      setInventory(prev => [item, ...prev]);
      
      if (supabase) {
          const { error } = await supabase.from('inventory').insert(mapInventoryToDB(item));
          if (error) {
              console.error("Failed to add inventory item:", error);
              setError("Failed to create item.");
              setInventory(prevInventory);
          }
      }
  };

  const deleteInventoryItem = async (itemId: string) => {
      const prevInventory = [...inventory];
      setInventory(prev => prev.filter(i => i.id !== itemId));
      
      if (supabase) {
          const { error } = await supabase.from('inventory').delete().eq('id', itemId);
          if (error) {
              console.error("Failed to delete inventory item:", error);
              setError("Failed to delete item.");
              setInventory(prevInventory);
          }
      }
  };

  const addOrder = async (order: Order) => {
      setOrders(prev => [order, ...prev]);
      if (supabase) {
          const { error } = await supabase.from('orders').insert(mapOrderToDB(order));
          if (error) {
              console.error("Failed to save order:", error);
              setError("Order saved locally but failed to sync.");
              // No rollback for orders usually, we want to keep it locally at least
          }
      }
  };

  const updateMenuItem = async (item: MenuItem) => {
      const prevMenu = [...menuItems];
      setMenuItems(prev => prev.map(m => m.id === item.id ? item : m));
      
      if (supabase) {
          const { error } = await supabase.from('menu_items').upsert(item);
          if (error) {
              console.error("Failed to update menu:", error);
              setError("Failed to update menu item.");
              setMenuItems(prevMenu);
          }
      }
  };

  const addMenuItem = async (item: MenuItem) => {
      const prevMenu = [...menuItems];
      setMenuItems(prev => [...prev, item]);
      
      if (supabase) {
          const { error } = await supabase.from('menu_items').insert(item);
          if (error) {
              console.error("Failed to add menu item:", error);
              setError("Failed to add menu item.");
              setMenuItems(prevMenu);
          }
      }
  };

  const deleteMenuItem = async (itemId: string) => {
      const prevMenu = [...menuItems];
      setMenuItems(prev => prev.filter(m => m.id !== itemId));
      
      if (supabase) {
          const { error } = await supabase.from('menu_items').delete().eq('id', itemId);
          if (error) {
              console.error("Failed to delete menu item:", error);
              setError("Failed to delete menu item.");
              setMenuItems(prevMenu);
          }
      }
  };

  const updateActiveOrder = async (tableId: string, items: CartItem[]) => {
      setActiveOrders(prev => ({ ...prev, [tableId]: items }));
      
      const total = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      
      if (supabase) {
        await supabase.from('active_orders').upsert({ table_id: tableId, items });
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
        await supabase.from('active_orders').delete().eq('table_id', tableId);
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
          const { error } = await supabase.from('settings').upsert({ key: 'tax_rate', value: rate });
          if (error) console.error("Failed to sync tax rate:", error);
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