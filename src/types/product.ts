export type CategorySlug =
  | 'whey-hydrolyzed'
  | 'creatine'
  | 'bar-cookie'
  | 'mass'
  | 'pre-workout'
  | 'eaa'
  | 'bcaa'
  | 'vitamin'
  | 'dau-ca';

export type ProductShape = 'tub' | 'bottle' | 'bar' | 'pouch';

export interface CategoryMeta {
  slug: CategorySlug;
  name: string;
  shortName: string;
  description: string;
  targetCount: number;
  isWaterMixPowder: boolean;
  studioPhoto: string;
}

export interface ProductFlavor {
  id: string;
  name: string;
  colorHex: string;
  accentHex: string;
  image: string;
  fallbackImage: string;
  localOptimizedPath: string;
  stock: number;
  priceOverride?: number;
  note?: string;
}

export interface NutritionInfo {
  servingSize: string;
  servingsPerContainer: number;
  calories: string;
  protein: string;
  carbs: string;
  fat: string;
  highlightKey: string;
  highlightValue: string;
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  brand: string;
  category: CategorySlug;
  categoryName: string;
  shape: ProductShape;
  weightLabel: string;
  isWaterMixPowder: boolean;
  price: number;
  compareAtPrice?: number;
  shortDescription: string;
  description: string;
  nutritionInfo: NutritionInfo;
  badge?: string;
  rating: number;
  soldCount: number;
  defaultImage: string;
  flavors: ProductFlavor[];
}

export interface CartItem {
  cartKey: string;
  product: Product;
  selectedFlavor: ProductFlavor;
  quantity: number;
}

export interface ShakerOption {
  id: string;
  name: string;
  colorHex: string;
  capacity: string;
}

export interface OrderFormData {
  fullName: string;
  phone: string;
  province: string;
  address: string;
  note: string;
  isFirstOrder: boolean;
  shakerId: string;
}

export interface OrderConfirmation {
  orderCode: string;
  createdAt: string;
  customer: OrderFormData;
  items: CartItem[];
  subtotal: number;
  shippingFee: number;
  shippingDiscount: number;
  total: number;
  hasFreeShaker: boolean;
  selectedShaker?: ShakerOption;
}
