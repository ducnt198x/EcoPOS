export interface MenuItem {
  id: string;
  name: string;
  price: number;
  image: string;
  category: string;
  description?: string;
  /**
   * @deprecated DO NOT USE. Stock is now managed exclusively via the 'inventory' table.
   * Use 'inventoryId' to link to the correct stock record.
   */
  stock?: number;
  inventoryId?: string;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  sortOrder?: number;
}

export interface CartItem extends MenuItem {
  quantity: number;
  notes?: string;
}

export interface Table {
  id: string;
  name: string;
  status: 'available' | 'occupied' | 'dirty';
  seats: number;
  guests?: number;
  timeElapsed?: string; // Display string
  occupiedSince?: string; // ISO Timestamp
  server?: string;
  total?: number;
  area?: string;
  x: number;
  y: number;
  shape: 'round' | 'rect';
}

export interface InventoryItem {
  id: string;
  name: string;
  category: string;
  stock: number;
  unit: string;
  minStock: number;
  status: 'in-stock' | 'low-stock' | 'out-of-stock';
  icon: string;
  description?: string;
}

export interface OrderItem {
  name: string;
  quantity: number;
}

export interface Order {
  id: string;
  customerName: string;
  table: string;
  date: string; // ISO string
  total: number;
  status: 'completed' | 'cancelled' | 'refunded';
  items: OrderItem[];
  paymentMethod: string;
  orderType?: 'dine-in' | 'takeaway' | 'delivery';
  discount?: number;
  notes?: string;
}

/**
 * DBOrder represents the raw database shape (snake_case).
 * This acts as a strict contract for writes to the 'orders' table.
 */
export interface DBOrder {
  id: string;
  customer_name: string;
  table_name: string;
  date: string;
  total: number;
  status: string;
  items: any[];
  payment_method: string;
  order_type: string;
  discount: number;
  notes: string | null;
}

export interface Transaction {
  id: string;
  table: string;
  time: string;
  amount: number;
  type: 'dine-in' | 'takeaway';
  status: 'completed' | 'pending';
}

export type Role = 'admin' | 'manager' | 'cashier';

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  avatar?: string;
  password?: string; // Added to sync with profile database
}

export interface AppSetting {
  key: string;
  value: any;
}