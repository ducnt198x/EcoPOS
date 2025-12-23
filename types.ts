export interface MenuItem {
  id: string;
  name: string;
  price: number;
  image: string;
  category: string;
  description?: string;
  stock?: number;
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
}

export interface AppSetting {
  key: string;
  value: any;
}