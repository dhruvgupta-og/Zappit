export interface User {
  uid: string;
  email: string;
  name?: string;
  phone?: string;
  college_id?: string;
  college_name?: string;
  college?: string;
  address?: string;
  profile_complete?: boolean;
  auth_method?: 'email' | 'google';
  role?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Store {
  id: string;
  _id?: string;
  name: string;
  description?: string;
  image: string;
  college_id?: string;
  college_name?: string;
  is_open: boolean;
  rating?: number;
  delivery_time_mins?: number;
  tags?: string[];
  owner_id?: string;
  created_at?: string;
  menuItemsForSearch?: string[];
}

export interface MenuItem {
  id: string;
  _id?: string;
  store_id?: string;
  storeId?: string;
  name: string;
  desc?: string;
  description?: string;
  price: number;
  image: string;
  category: string;
  isVeg: boolean;
  isAvailable?: boolean;
  available?: boolean;
}

export interface OrderItem {
  menuItem: MenuItem | string;
  name?: string;
  quantity: number;
  qty?: number;
  price: number;
}

export interface Order {
  id: string;
  _id?: string;
  user_id?: string;
  userId?: string;
  store_id?: string;
  storeId?: string;
  store_name?: string;
  storeName?: string;
  items: OrderItem[];
  total_amount?: number;
  totalAmount?: number;
  delivery_fee?: number;
  deliveryFee?: number;
  status: 'placed' | 'accepted' | 'preparing' | 'ready' | 'out_for_delivery' | 'delivered' | 'cancelled';
  delivery_address?: string;
  deliveryAddress?: string;
  payment_method?: string;
  payment_status?: string;
  coupon_code?: string;
  otp?: string;
  created_at?: string;
  createdAt?: string;
  updated_at?: string;
}

export interface College {
  id: string;
  _id?: string;
  name: string;
  city?: string;
  location?: string;
  isActive?: boolean;
  active?: boolean;
}

export interface Banner {
  id: string;
  _id?: string;
  image: string;
  imageUrl?: string;
  link?: string;
  linkUrl?: string;
  coupon_code?: string;
  active?: boolean;
  isActive?: boolean;
}

export interface Config {
  key: string;
  value: any;
}
