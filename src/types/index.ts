import { Timestamp } from 'firebase/firestore';

export interface UserMapping {
  company: string;
}

export interface Company {
  id: string;
  name: string;
  createdAt: Timestamp;
  ownerId: string;
}

export type UserRole = 'owner' | 'admin' | 'cashier' | 'manager';
export type UserStatus = 'active' | 'suspended';

export interface User {
  uid: string;
  email: string;
  userName: string;
  role: UserRole;
  status: UserStatus;
  employeeId: string;
  permissions: string[];
  createdAt: Timestamp;
  createdBy: string;
  lastLoginAt: Timestamp | null;
  companyId: string;
}

export interface SaleItem {
  itemId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  total: number;
}

export interface Payment {
  method: string;
  amount: number;
  status: string;
}

export interface Sale {
  id: string;
  transactionId: string;
  timestamp: Timestamp;
  cashierId: string;
  items: SaleItem[];
  subtotal: number;
  tax: number;
  discountTotal: number;
  grandTotal: number;
  payments: Payment[];
  status: 'completed' | 'pending' | 'cancelled';
  companyId: string;
}

export interface InventoryItem {
  id: string;
  productId: string;
  name: string;
  quantity: number;
  reorderLevel: number;
  unitCost: number;
  lastUpdated: Timestamp;
  companyId: string;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  category: string;
  price: number;
  cost: number;
  createdAt: Timestamp;
  createdBy: string;
  companyId: string;
}

export interface ProductionJob {
  id: string;
  jobId: string;
  product: string;
  rawMaterials: any[];
  status: 'pending' | 'in_progress' | 'completed';
  outputQuantity: number;
  createdAt: Timestamp;
  companyId: string;
}

export interface Stats {
  noOfUsers: number;
  totalSales: number;
  totalRevenue: number;
}
