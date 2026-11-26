import { useEffect, useState } from 'react';
import type { CartItem, Product } from '../types/product';

export interface ProductReview {
  id: string;
  productId: string;
  authorName: string;
  flavorName?: string;
  rating: 1 | 2 | 3 | 4 | 5;
  comment: string;
  createdAt: string;
}

export interface ProductRatingStats {
  averageRating: number;
  reviewCount: number;
  starCounts: Record<1 | 2 | 3 | 4 | 5, number>;
}

const REVIEWS_STORAGE_KEY = 'nhaisupplement_reviews_v1';
const SALES_STORAGE_KEY = 'nhaisupplement_sales_v1';
const REVIEWS_EVENT = 'nhaisupplement:reviews-updated';
const SALES_EVENT = 'nhaisupplement:sales-updated';

function readAllReviewsMap(): Record<string, ProductReview[]> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(REVIEWS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, ProductReview[]>) : {};
  } catch {
    return {};
  }
}

function readAllSalesMap(): Record<string, number> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(SALES_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, number>) : {};
  } catch {
    return {};
  }
}

export function getProductReviews(productId: string): ProductReview[] {
  const map = readAllReviewsMap();
  const list = map[productId];
  return Array.isArray(list) ? list : [];
}

export function getProductRatingStats(productId: string): ProductRatingStats {
  const reviews = getProductReviews(productId);
  const starCounts: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

  if (reviews.length === 0) {
    return {
      averageRating: 0,
      reviewCount: 0,
      starCounts,
    };
  }

  let sum = 0;
  for (const r of reviews) {
    const clamped = Math.min(5, Math.max(1, Math.round(r.rating))) as 1 | 2 | 3 | 4 | 5;
    starCounts[clamped] += 1;
    sum += clamped;
  }

  return {
    averageRating: Math.round((sum / reviews.length) * 10) / 10,
    reviewCount: reviews.length,
    starCounts,
  };
}

export function addProductReview(input: {
  productId: string;
  authorName: string;
  flavorName?: string;
  rating: 1 | 2 | 3 | 4 | 5;
  comment: string;
}): ProductReview {
  const map = readAllReviewsMap();
  const existing = Array.isArray(map[input.productId]) ? map[input.productId] : [];
  const nextReview: ProductReview = {
    id: `rev-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    productId: input.productId,
    authorName: input.authorName.trim(),
    flavorName: input.flavorName?.trim() || undefined,
    rating: input.rating,
    comment: input.comment.trim(),
    createdAt: new Date().toLocaleDateString('vi-VN'),
  };

  map[input.productId] = [nextReview, ...existing];
  try {
    window.localStorage.setItem(REVIEWS_STORAGE_KEY, JSON.stringify(map));
    window.dispatchEvent(new CustomEvent(REVIEWS_EVENT, { detail: { productId: input.productId } }));
  } catch {
    // Ignore storage quota restrictions
  }
  return nextReview;
}

export function getProductSoldCount(product: Product): number {
  const salesMap = readAllSalesMap();
  const extra = typeof salesMap[product.id] === 'number' ? salesMap[product.id] : 0;
  return Math.max(0, product.soldCount + extra);
}

export function recordCompletedOrderSales(items: CartItem[]): void {
  if (typeof window === 'undefined' || items.length === 0) return;
  const salesMap = readAllSalesMap();
  for (const item of items) {
    const qty = Math.max(1, item.quantity);
    salesMap[item.product.id] = (salesMap[item.product.id] ?? 0) + qty;
  }
  try {
    window.localStorage.setItem(SALES_STORAGE_KEY, JSON.stringify(salesMap));
    window.dispatchEvent(new CustomEvent(SALES_EVENT));
  } catch {
    // Ignore storage quota restrictions
  }
}

export function useProductReviews(productId: string): {
  reviews: ProductReview[];
  stats: ProductRatingStats;
} {
  const [reviews, setReviews] = useState<ProductReview[]>(() => getProductReviews(productId));

  useEffect(() => {
    const sync = () => setReviews(getProductReviews(productId));
    sync();
    window.addEventListener(REVIEWS_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(REVIEWS_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, [productId]);

  return {
    reviews,
    stats: getProductRatingStats(productId),
  };
}

export function useProductSoldCount(product: Product): number {
  const [soldCount, setSoldCount] = useState<number>(() => getProductSoldCount(product));

  useEffect(() => {
    const sync = () => setSoldCount(getProductSoldCount(product));
    sync();
    window.addEventListener(SALES_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(SALES_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, [product]);

  return soldCount;
}
