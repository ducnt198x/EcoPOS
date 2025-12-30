import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../services/supabase';
import { 
    Table, MenuItem, InventoryItem, Order, Category, CartItem, AppSetting, DBOrder
} from '../types';

/**
 * ARCHITECTURAL INVARIANT: UNIDIRECTIONAL DATA FLOW
 * -------------------------------------------------
 * 1. Write Path: UI -> Context Method -> Supabase API
 * 2. Read Path:  Supabase DB -> Realtime Subscription -> Context State -> UI
 * 
 * GUARD: Do NOT update local state (setTables, setOrders, etc.) inside the 
 * write functions when Supabase is connected. This prevents race conditions 
 * where an optimistic update conflicts with the authoritative Realtime event.
 */

interface DataContextType {
    tables: Table[];
    updateTable: (table: Table) => Promise<void>;
    updateTables: (tables: Table[]) => void;
    deleteTable: (id: string) => Promise<void>;
    
    activeOrders: Record<string, CartItem[]>;
    updateActiveOrder: (tableId: string, items: CartItem[]) => void;
    clearActiveOrder: (tableId: string) => Promise<void>;
    
    menuItems: MenuItem[];
    addMenuItem: (item: MenuItem, inventoryCategory?: string) => Promise<{ error?: any }>;
    updateMenuItem: (item: MenuItem, inventoryCategory?: string) => Promise<{ error?: any }>;
    deleteMenuItem: (id: string) => Promise<{ error?: any }>;
    
    inventory: InventoryItem[];
    addInventoryItem: (item: InventoryItem) => Promise<void>;
    updateInventoryItem: (item: InventoryItem) => Promise<void>;
    deleteInventoryItem: (id: string) => Promise<void>;
    fixInventoryDuplicates: () => Promise<{ message?: string; error?: any }>;
    
    orders: Order[];
    addOrder: (order: Order) => Promise<void>;
    
    categories: Category[];
    addCategory: (category: Category) => Promise<{ error?: any }>;
    updateCategory: (category: Category) => Promise<{ error?: any }>;
    deleteCategory: (id: string) => Promise<{ error?: any }>;
    reorderCategories: (categories: Category[]) => Promise<void>;

    taxRate: number;
    updateTaxRate: (rate: number) => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

const DEFAULT_TABLES: Table[] = [
    { id: 'T1', name: '1', status: 'available', seats: 4, x: 50, y: 50, shape: 'rect', area: 'Main Dining' },
    { id: 'T2', name: '2', status: 'available', seats: 4, x: 200, y: 50, shape: 'round', area: 'Main Dining' },
];

const DEFAULT_CATEGORIES: Category[] = [
    { id: 'food', name: 'Food', icon: 'restaurant' },
    { id: 'drink', name: 'Drinks', icon: 'local_bar' },
];

export const DataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [tables, setTables] = useState<Table[]>(DEFAULT_TABLES);
    const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
    const [inventory, setInventory] = useState<InventoryItem[]>([]);
    const [orders, setOrders] = useState<Order[]>([]);
    const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES);
    const [activeOrders, setActiveOrders] = useState<Record<string, CartItem[]>>({});
    const [taxRate, setTaxRate] = useState<number>(10);

    useEffect(() => {
        if (!supabase) return;

        const fetchData = async () => {
            const { data: tablesData } = await supabase.from('tables').select('*');
            if (tablesData && tablesData.length > 0) {
                // Map snake_case to camelCase
                const mappedTables = tablesData.map((t: any) => ({
                    id: t.id,
                    name: t.name,
                    status: t.status,
                    seats: t.seats,
                    x: t.x,
                    y: t.y,
                    shape: t.shape,
                    area: t.area,
                    guests: t.guests,
                    total: t.total,
                    server: t.server,
                    occupiedSince: t.occupied_since, // Map snake_case
                    // timeElapsed is computed client-side, do not map from DB
                }));
                setTables(mappedTables);
            }

            const { data: menuData } = await supabase.from('menu_items').select('*');
            if (menuData) {
                // Map snake_case DB columns to camelCase App models
                const mappedMenu = menuData.map((m: any) => ({
                    id: m.id,
                    name: m.name,
                    price: m.price,
                    image: m.image,
                    category: m.category,
                    description: m.description,
                    inventoryId: m.inventory_id // Map snake_case back to camelCase
                }));
                setMenuItems(mappedMenu);
            }

            const { data: invData } = await supabase.from('inventory').select('*');
            if (invData) {
                 // Map snake_case from DB to camelCase if needed
                 const mapped = invData.map((i: any) => ({
                    ...i,
                    minStock: i.min_stock !== undefined ? i.min_stock : i.minStock
                 }));
                 setInventory(mapped);
            }

            const { data: ordersData } = await supabase.from('orders').select('*').order('date', { ascending: false }).limit(100);
            if (ordersData) {
                // Map snake_case DB columns to camelCase App models
                const mappedOrders = ordersData.map((o: any) => ({
                    id: o.id,
                    customerName: o.customer_name,
                    table: o.table_name || o.table, // Handle legacy schema if needed
                    date: o.date,
                    total: o.total,
                    status: o.status,
                    items: o.items,
                    paymentMethod: o.payment_method,
                    orderType: o.order_type,
                    discount: o.discount,
                    notes: o.notes
                }));
                setOrders(mappedOrders);
            }

            const { data: catData } = await supabase.from('categories').select('*').order('sortOrder', { ascending: true });
            if (catData && catData.length > 0) setCategories(catData);
            
            const { data: settingsData } = await supabase.from('settings').select('*').eq('key', 'tax_rate').single();
            if (settingsData) setTaxRate(settingsData.value);
        };

        fetchData();

        const channels = [
            supabase.channel('public:tables').on('postgres_changes', { event: '*', schema: 'public', table: 'tables' }, (payload) => {
                if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
                    const t = payload.new as any;
                    const newTable: Table = {
                        id: t.id,
                        name: t.name,
                        status: t.status,
                        seats: t.seats,
                        x: t.x,
                        y: t.y,
                        shape: t.shape,
                        area: t.area,
                        guests: t.guests,
                        total: t.total,
                        server: t.server,
                        occupiedSince: t.occupied_since,
                        // timeElapsed is local only
                    };
                    setTables(prev => {
                        const exists = prev.find(p => p.id === newTable.id);
                        if (exists) return prev.map(p => p.id === newTable.id ? newTable : p);
                        return [...prev, newTable];
                    });
                }
                if (payload.eventType === 'DELETE') setTables(prev => prev.filter(t => t.id !== payload.old.id));
            }).subscribe(),
            supabase.channel('public:menu').on('postgres_changes', { event: '*', schema: 'public', table: 'menu_items' }, (payload) => {
                const m = payload.new as any;
                const newItem = m ? {
                    id: m.id,
                    name: m.name,
                    price: m.price,
                    image: m.image,
                    category: m.category,
                    description: m.description,
                    inventoryId: m.inventory_id
                } as MenuItem : null;

                if (payload.eventType === 'INSERT' && newItem) setMenuItems(prev => {
                    if (prev.some(i => i.id === newItem.id)) return prev;
                    return [...prev, newItem];
                });
                if (payload.eventType === 'UPDATE' && newItem) setMenuItems(prev => prev.map(i => i.id === newItem.id ? newItem : i));
                if (payload.eventType === 'DELETE') setMenuItems(prev => prev.filter(i => i.id !== payload.old.id));
            }).subscribe(),
            supabase.channel('public:inventory').on('postgres_changes', { event: '*', schema: 'public', table: 'inventory' }, (payload) => {
                const mapItem = (i: any) => ({ ...i, minStock: i.min_stock !== undefined ? i.min_stock : i.minStock });
                if (payload.eventType === 'INSERT') setInventory(prev => {
                    if (prev.some(i => i.id === payload.new.id)) return prev;
                    return [...prev, mapItem(payload.new)];
                });
                if (payload.eventType === 'UPDATE') setInventory(prev => prev.map(i => i.id === payload.new.id ? mapItem(payload.new) : i));
                if (payload.eventType === 'DELETE') setInventory(prev => prev.filter(i => i.id !== payload.old.id));
            }).subscribe(),
            supabase.channel('public:orders').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, (payload) => {
                const o = payload.new as any;
                const newOrder: Order = {
                    id: o.id,
                    customerName: o.customer_name,
                    table: o.table_name || o.table,
                    date: o.date,
                    total: o.total,
                    status: o.status,
                    items: o.items,
                    paymentMethod: o.payment_method,
                    orderType: o.order_type,
                    discount: o.discount,
                    notes: o.notes
                };
                setOrders(prev => {
                    if (prev.some(x => x.id === newOrder.id)) return prev;
                    return [newOrder, ...prev];
                });
            }).subscribe(),
            supabase.channel('public:categories').on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, (payload) => {
                 if (payload.eventType === 'INSERT') setCategories(prev => {
                     if (prev.some(c => c.id === payload.new.id)) return prev;
                     return [...prev, payload.new as Category];
                 });
                 if (payload.eventType === 'UPDATE') setCategories(prev => prev.map(c => c.id === payload.new.id ? payload.new as Category : c));
                 if (payload.eventType === 'DELETE') setCategories(prev => prev.filter(c => c.id !== payload.old.id));
            }).subscribe(),
             supabase.channel('public:settings').on('postgres_changes', { event: '*', schema: 'public', table: 'settings' }, (payload) => {
                 if (payload.new && (payload.new as AppSetting).key === 'tax_rate') setTaxRate((payload.new as AppSetting).value);
            }).subscribe(),
        ];

        return () => {
            channels.forEach(c => c.unsubscribe());
        };
    }, []);

    const updateTable = async (table: Table) => {
        if (!supabase) {
             console.warn("Supabase client not initialized. Update local only.");
             setTables(prev => prev.map(t => t.id === table.id ? table : t));
             return;
        }
        
        // GUARD: Strict mapping + No local state mutation.
        // We only dispatch the write. The Realtime subscription updates the UI.
        const dbTable = {
            id: table.id,
            name: table.name,
            status: table.status,
            seats: table.seats,
            x: table.x,
            y: table.y,
            shape: table.shape,
            area: table.area,
            guests: table.guests,
            total: table.total,
            server: table.server,
            occupied_since: table.occupiedSince // snake_case
        };

        const { error } = await supabase.from('tables').upsert(dbTable);
        if (error) console.error("Error updating table:", error);
    };

    const updateTables = async (newTables: Table[]) => {
        if (!supabase) {
            setTables(newTables);
            return;
        }
        
        // GUARD: No local mutation.
        const dbTables = newTables.map(table => ({
            id: table.id,
            name: table.name,
            status: table.status,
            seats: table.seats,
            x: table.x,
            y: table.y,
            shape: table.shape,
            area: table.area,
            guests: table.guests,
            total: table.total,
            server: table.server,
            occupied_since: table.occupiedSince
        }));

        const { error } = await supabase.from('tables').upsert(dbTables);
        if (error) console.error("Error updating tables:", error);
    };

    const deleteTable = async (id: string) => {
        if (!supabase) {
            setTables(prev => prev.filter(t => t.id !== id));
            return;
        }
        // GUARD: No local mutation.
        const { error } = await supabase.from('tables').delete().eq('id', id);
        if (error) console.error("Error deleting table:", error);
    };

    const updateActiveOrder = (tableId: string, items: CartItem[]) => {
        // Active orders are CLIENT-SIDE only until checkout.
        // This is an exception to the rule as these are temporary.
        setActiveOrders(prev => ({
            ...prev,
            [tableId]: items
        }));
    };

    const clearActiveOrder = async (tableId: string) => {
        setActiveOrders(prev => {
            const next = { ...prev };
            delete next[tableId];
            return next;
        });
    };

    const addMenuItem = async (item: MenuItem, inventoryCategory: string = 'food') => {
        if (!supabase) {
            setMenuItems(prev => [...prev, item]);
            return { error: null };
        }
        
        // GUARD: No local mutation.
        let finalItem = { ...item };

        if (!finalItem.inventoryId && finalItem.stock !== undefined) {
             const { data: existingInv } = await supabase.from('inventory').select('*').ilike('name', finalItem.name).maybeSingle();
             
             if (existingInv) {
                 finalItem.inventoryId = existingInv.id;
             } else {
                 const newInvId = `inv_${finalItem.id}`;
                 await addInventoryItem({
                     id: newInvId,
                     name: finalItem.name,
                     category: inventoryCategory,
                     stock: finalItem.stock,
                     unit: 'portion',
                     minStock: 10,
                     status: finalItem.stock > 10 ? 'in-stock' : (finalItem.stock > 0 ? 'low-stock' : 'out-of-stock'),
                     icon: inventoryCategory === 'drink' ? 'local_bar' : 'restaurant'
                 });
                 finalItem.inventoryId = newInvId;
             }
        }
        
        const dbPayload = {
            id: finalItem.id,
            name: finalItem.name,
            price: finalItem.price,
            image: finalItem.image,
            category: finalItem.category,
            description: finalItem.description,
            inventory_id: finalItem.inventoryId
        };

        const { error } = await supabase.from('menu_items').insert(dbPayload);
        return { error };
    };

    const updateMenuItem = async (item: MenuItem, inventoryCategory?: string) => {
        if (!supabase) {
             setMenuItems(prev => prev.map(i => i.id === item.id ? item : i));
             return { error: null };
        }
        
        // GUARD: No local mutation.
        const dbPayload = {
            name: item.name,
            price: item.price,
            image: item.image,
            category: item.category,
            description: item.description,
            inventory_id: item.inventoryId
        };

        const { error } = await supabase.from('menu_items').update(dbPayload).eq('id', item.id);
        
        if (!error) {
            // Logic: Ensure inventory link exists.
            if (item.stock !== undefined && !item.inventoryId && inventoryCategory) {
                 const { data: invItem } = await supabase.from('inventory').select('*').ilike('name', item.name).maybeSingle();
                 if (!invItem) {
                     const newInvId = `inv_${item.id}`;
                     await addInventoryItem({
                         id: newInvId,
                         name: item.name,
                         category: inventoryCategory,
                         stock: item.stock,
                         unit: 'portion',
                         minStock: 10,
                         status: 'in-stock',
                         icon: 'restaurant'
                     });
                     await supabase.from('menu_items').update({ inventory_id: newInvId }).eq('id', item.id);
                 }
            }
        }
        
        return { error };
    };

    const deleteMenuItem = async (id: string) => {
        if (!supabase) {
            setMenuItems(prev => prev.filter(i => i.id !== id));
            return { error: null };
        }
        // GUARD: No local mutation.
        const { error } = await supabase.from('menu_items').delete().eq('id', id);
        return { error };
    };

    const addInventoryItem = async (item: InventoryItem) => {
        if (!supabase) {
            setInventory(prev => [...prev, item]);
            return;
        }

        // GUARD: No local mutation.
        const normalize = (str: string) => str?.trim().toLowerCase() || '';
        let existingItem = inventory.find(i => 
            normalize(i.name) === normalize(item.name) && 
            normalize(i.unit) === normalize(item.unit)
        );

        if (!existingItem) {
             const { data } = await supabase
                .from('inventory')
                .select('*')
                .ilike('name', item.name.trim())
                .ilike('unit', item.unit.trim())
                .maybeSingle();

             if (data) {
                 existingItem = {
                     id: data.id,
                     name: data.name,
                     category: data.category,
                     stock: data.stock,
                     unit: data.unit,
                     minStock: data.min_stock,
                     status: data.status,
                     icon: data.icon,
                     description: data.description
                 };
             }
        }

        if (existingItem) {
            const newStock = existingItem.stock + item.stock;
            const newStatus = newStock <= 0 ? 'out-of-stock' : (newStock <= existingItem.minStock ? 'low-stock' : 'in-stock');
            
            const { error } = await supabase.from('inventory').update({
                stock: newStock,
                status: newStatus
            }).eq('id', existingItem.id);
            
            if (error) console.error("Error updating existing inventory stock", error);

        } else {
            const dbItem = {
                id: item.id,
                name: item.name,
                category: item.category,
                stock: item.stock,
                unit: item.unit,
                status: item.status,
                icon: item.icon,
                description: item.description,
                min_stock: item.minStock
            };
            
            const { error } = await supabase.from('inventory').insert(dbItem);
            if (error) console.error("Error adding inventory", error);
        }
    };

    const updateInventoryItem = async (item: InventoryItem) => {
        if (!supabase) {
             console.warn("Supabase client not initialized. Update local only.");
             setInventory(prev => prev.map(i => i.id === item.id ? item : i));
             return;
        }
        
        // GUARD: No local mutation.
        const dbItem = {
            name: item.name,
            category: item.category,
            stock: item.stock,
            unit: item.unit,
            status: item.status,
            icon: item.icon,
            description: item.description,
            min_stock: item.minStock // snake_case
        };

        const { error } = await supabase.from('inventory').update(dbItem).eq('id', item.id);
        if (error) console.error("Error updating inventory item", error);
    };

    const deleteInventoryItem = async (id: string) => {
        if (!supabase) {
            setInventory(prev => prev.filter(i => i.id !== id));
            return;
        }
        // GUARD: No local mutation.
        const { error } = await supabase.from('inventory').delete().eq('id', id);
        if (error) console.error("Error deleting inventory item", error);
    };

    const fixInventoryDuplicates = async () => {
        if (!supabase) return { message: "Database not connected" };

        const { data: allItems, error } = await supabase.from('inventory').select('*');
        if (error || !allItems) return { error };

        const groups: Record<string, any[]> = {};
        
        allItems.forEach(item => {
            const name = item.name?.trim().toLowerCase() || '';
            const unit = item.unit?.trim().toLowerCase() || '';
            const key = `${name}|${unit}`;
            
            if (!groups[key]) groups[key] = [];
            groups[key].push(item);
        });

        let fixedGroups = 0;
        let removedCount = 0;

        for (const key in groups) {
            const group = groups[key];
            if (group.length > 1) {
                const canonical = group[0];
                const duplicates = group.slice(1);
                
                const totalStock = group.reduce((sum: number, i: any) => sum + (Number(i.stock) || 0), 0);
                
                const minStock = canonical.min_stock || 0;
                let status = 'in-stock';
                if (totalStock <= 0) status = 'out-of-stock';
                else if (totalStock <= minStock) status = 'low-stock';

                const { error: updateError } = await supabase
                    .from('inventory')
                    .update({ 
                        stock: totalStock,
                        status: status
                    })
                    .eq('id', canonical.id);

                if (!updateError) {
                    const duplicateIds = duplicates.map((d: any) => d.id);
                    await supabase.from('inventory').delete().in('id', duplicateIds);
                    removedCount += duplicates.length;
                    fixedGroups++;
                }
            }
        }
        
        // GUARD: No manual refetch here. 
        // The batched UPDATE and DELETE operations will trigger the realtime subscriptions
        // defined in useEffect, ensuring consistent state updates.

        return { message: `Merged ${fixedGroups} items. Removed ${removedCount} duplicates.` };
    };

    const addOrder = async (order: Order) => {
        if (!supabase) {
            setOrders(prev => [order, ...prev]);
            return;
        }
        
        // GUARD: No local mutation.
        const dbOrder: DBOrder = {
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
            notes: order.notes || null
        };

        const { error } = await supabase.from('orders').insert(dbOrder);
        
        if (error) {
            console.error("Failed to insert order. Check DB Schema.", error);
            throw error;
        }
    };

    const addCategory = async (category: Category) => {
        if (!supabase) {
            setCategories(prev => [...prev, category]);
            return { error: null };
        }
        // GUARD: No local mutation.
        const maxSort = categories.reduce((max, c) => Math.max(max, c.sortOrder || 0), 0);
        const { error } = await supabase.from('categories').insert({ ...category, sortOrder: maxSort + 1 });
        return { error };
    };

    const updateCategory = async (category: Category) => {
        if (!supabase) {
             setCategories(prev => prev.map(c => c.id === category.id ? category : c));
             return { error: null };
        }
        // GUARD: No local mutation.
        const { error } = await supabase.from('categories').update(category).eq('id', category.id);
        return { error };
    };

    const deleteCategory = async (id: string) => {
        if (!supabase) {
             setCategories(prev => prev.filter(c => c.id !== id));
             return { error: null };
        }
        // GUARD: No local mutation.
        const { error } = await supabase.from('categories').delete().eq('id', id);
        return { error };
    };

    const reorderCategories = async (newCategories: Category[]) => {
        if (!supabase) {
            setCategories(newCategories);
            return;
        }
        
        // GUARD: No local mutation.
        const updates = newCategories.map((c, index) => ({
            id: c.id,
            name: c.name,
            icon: c.icon,
            sortOrder: index
        }));
        
        const { error } = await supabase.from('categories').upsert(updates);
        if (error) console.error("Reorder failed", error);
    };
    
    const updateTaxRate = async (rate: number) => {
        if (!supabase) {
            setTaxRate(rate);
            return;
        }
        // GUARD: No local mutation.
        await supabase.from('settings').upsert({ key: 'tax_rate', value: rate });
    }

    return (
        <DataContext.Provider value={{
            tables, updateTable, updateTables, deleteTable,
            activeOrders, updateActiveOrder, clearActiveOrder,
            menuItems, addMenuItem, updateMenuItem, deleteMenuItem,
            inventory, addInventoryItem, updateInventoryItem, deleteInventoryItem, fixInventoryDuplicates,
            orders, addOrder,
            categories, addCategory, updateCategory, deleteCategory, reorderCategories,
            taxRate, updateTaxRate
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