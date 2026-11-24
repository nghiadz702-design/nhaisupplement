import type {
  CategoryMeta,
  CategorySlug,
  Product,
  ProductFlavor,
  ProductShape,
  ShakerOption,
} from '../types/product';
import { withBasePath } from '../utils/assetPath';
import { buildFlavorStudioDataUri } from '../utils/flavorImageGenerator';
import rawRealCatalogData from './realCatalogData.json';

export const BRAND_INFO = {
  name: 'NhaiSupplement',
  domain: 'nhaisupplement.com',
  phone: '094618430',
  email: 'nghiatrinh808@gmail.com',
  zaloUrl: 'https://zalo.me/094618430',
  warehouseCity: 'Hà Nội',
  warehouseAddress: 'Kho NhaiSupplement – Quận Đống Đa, TP. Hà Nội',
  logoPath: withBasePath('/assets/aistudio/modern-bold-logo-for-a-dietary-supplement-brand-na_a91a8267.png'),
  heroImage: withBasePath('/src/assets/images/hero_supplement_studio_1795535037091.jpg'),
};

export const CATEGORIES: CategoryMeta[] = [
  {
    slug: 'whey-hydrolyzed',
    name: 'Whey & Hydrolyzed',
    shortName: 'Whey & Hydro',
    description: 'Đạm tinh khiết Isolate & Hydrolyzed hấp thu nhanh, phục hồi cơ bắp tối ưu.',
    targetCount: 17,
    isWaterMixPowder: true,
    studioPhoto: withBasePath('/src/assets/images/category_powder_tub_1795535036984.jpg'),
  },
  {
    slug: 'creatine',
    name: 'Creatine',
    shortName: 'Creatine',
    description: 'Tăng sức mạnh bùng nổ, tái tạo ATP và hiệu suất tập nặng.',
    targetCount: 6,
    isWaterMixPowder: true,
    studioPhoto: withBasePath('/src/assets/images/category_powder_tub_1795535036984.jpg'),
  },
  {
    slug: 'bar-cookie',
    name: 'Bar / Cookie',
    shortName: 'Bar / Cookie',
    description: 'Bánh protein tiện lợi, ít đường, ăn nhanh mọi lúc trước hoặc sau tập.',
    targetCount: 3,
    isWaterMixPowder: false,
    studioPhoto: withBasePath('/src/assets/images/category_protein_bar_1795535037273.jpg'),
  },
  {
    slug: 'mass',
    name: 'Mass',
    shortName: 'Mass Gainer',
    description: 'Sữa tăng cân giàu calories, carb phức hợp và protein cho người gầy.',
    targetCount: 2,
    isWaterMixPowder: true,
    studioPhoto: withBasePath('/src/assets/images/category_powder_tub_1795535036984.jpg'),
  },
  {
    slug: 'pre-workout',
    name: 'Pre-Workout',
    shortName: 'Pre-Workout',
    description: 'Bùng nổ năng lượng, tỉnh táo, bơm cơ và tăng sức bền trước buổi tập.',
    targetCount: 7,
    isWaterMixPowder: true,
    studioPhoto: withBasePath('/src/assets/images/category_powder_tub_1795535036984.jpg'),
  },
  {
    slug: 'eaa',
    name: 'EAA',
    shortName: 'EAA',
    description: '9 axit amin thiết yếu chống dị hóa và tổng hợp protein trong lúc tập.',
    targetCount: 3,
    isWaterMixPowder: true,
    studioPhoto: withBasePath('/src/assets/images/category_powder_tub_1795535036984.jpg'),
  },
  {
    slug: 'bcaa',
    name: 'BCAA',
    shortName: 'BCAA',
    description: 'Leucine, Isoleucine, Valine tỉ lệ 2:1:1 giảm đau nhức cơ bắp.',
    targetCount: 2,
    isWaterMixPowder: true,
    studioPhoto: withBasePath('/src/assets/images/category_powder_tub_1795535036984.jpg'),
  },
  {
    slug: 'vitamin',
    name: 'Vitamin',
    shortName: 'Vitamin',
    description: 'Vitamin tổng hợp, D3+K2, ZMA, Magie tăng đề kháng và phục hồi giấc ngủ.',
    targetCount: 15,
    isWaterMixPowder: false,
    studioPhoto: withBasePath('/src/assets/images/category_vitamin_softgel_1795535039343.jpg'),
  },
  {
    slug: 'dau-ca',
    name: 'Dầu cá',
    shortName: 'Dầu cá',
    description: 'Omega-3 EPA/DHA hàm lượng cao bảo vệ tim mạch, xương khớp và não bộ.',
    targetCount: 7,
    isWaterMixPowder: false,
    studioPhoto: withBasePath('/src/assets/images/category_vitamin_softgel_1795535039343.jpg'),
  },
];

export const SHAKER_OPTIONS: ShakerOption[] = [
  {
    id: 'shaker-black-orange',
    name: 'Bình Lắc NhaiSupplement Signature Đen Cam',
    colorHex: '#FF5A00',
    capacity: '700ml · Lò xo inox 304',
  },
  {
    id: 'shaker-matte-black',
    name: 'Bình Lắc Nhám Đen Pro Sport',
    colorHex: '#1F1F1F',
    capacity: '700ml · Nhựa PP không BPA',
  },
  {
    id: 'shaker-clear-smoke',
    name: 'Bình Lắc Khói Trong Suốt Vạch Chia ml',
    colorHex: '#64748B',
    capacity: '750ml · Nắp bật chống tràn',
  },
];

export const VIETNAM_PROVINCES: string[] = [
  'Hà Nội (Giao nhanh nội thành)',
  'TP. Hồ Chí Minh',
  'Đà Nẵng',
  'Hải Phòng',
  'Cần Thơ',
  'Bắc Ninh',
  'Bình Dương',
  'Đồng Nai',
  'Quảng Ninh',
  'Thanh Hóa',
  'Nghệ An',
  'Thừa Thiên Huế',
  'Khánh Hòa',
  'Lâm Đồng',
  'Thái Nguyên',
  'Hải Dương',
  'Nam Định',
  'Vĩnh Phúc',
  'Hưng Yên',
  'Bà Rịa - Vũng Tàu',
  'Long An',
  'Tiền Giang',
  'Đắk Lắk',
  'Gia Lai',
  'Tỉnh/Thành phố khác (Ship toàn quốc)',
];

interface RawRealProduct {
  id: string;
  slug: string;
  name: string;
  brand: string;
  category: CategorySlug;
  shape: ProductShape;
  weightLabel: string;
  price: number;
  compareAtPrice?: number;
  shortDescription: string;
  description: string;
  servingSize: string;
  servingsPerContainer: number;
  calories: string;
  protein: string;
  carbs: string;
  fat: string;
  highlightKey: string;
  highlightValue: string;
  badge?: string;
  rating: number;
  soldCount: number;
  flavors: {
    id: string;
    name: string;
    colorHex: string;
    accentHex: string;
    image: string;
    stock: number;
  }[];
}

const categoryMap = new Map<CategorySlug, CategoryMeta>(CATEGORIES.map((c) => [c.slug, c]));

export const PRODUCTS: Product[] = (rawRealCatalogData as RawRealProduct[]).map((seed) => {
  const catMeta = categoryMap.get(seed.category)!;

  const flavors: ProductFlavor[] = seed.flavors.map((fl) => {
    const fallbackImage = buildFlavorStudioDataUri({
      productName: seed.name,
      brand: seed.brand,
      categoryName: catMeta.name,
      weightLabel: seed.weightLabel,
      shape: seed.shape,
      flavorName: fl.name,
      colorHex: fl.colorHex,
      accentHex: fl.accentHex,
      highlightKey: seed.highlightKey,
      highlightValue: seed.highlightValue,
      viewAngle: 'front',
      isPowder: catMeta.isWaterMixPowder,
    });

    const resolvedImage = fl.image ? withBasePath(fl.image) : fallbackImage;

    return {
      id: fl.id,
      name: fl.name,
      colorHex: fl.colorHex,
      accentHex: fl.accentHex,
      image: resolvedImage,
      fallbackImage,
      localOptimizedPath: resolvedImage,
      stock: fl.stock,
    };
  });

  return {
    id: seed.id,
    slug: seed.slug,
    name: seed.name,
    brand: seed.brand,
    category: seed.category,
    categoryName: catMeta.name,
    shape: seed.shape,
    isWaterMixPowder: catMeta.isWaterMixPowder,
    weightLabel: seed.weightLabel,
    price: seed.price,
    compareAtPrice: seed.compareAtPrice,
    shortDescription: seed.shortDescription,
    description: seed.description,
    nutritionInfo: {
      servingSize: seed.servingSize,
      servingsPerContainer: seed.servingsPerContainer,
      calories: seed.calories,
      protein: seed.protein,
      carbs: seed.carbs,
      fat: seed.fat,
      highlightKey: seed.highlightKey,
      highlightValue: seed.highlightValue,
    },
    badge: seed.badge,
    defaultImage: flavors[0].image,
    rating: seed.rating,
    soldCount: seed.soldCount,
    flavors,
  };
});

export const CATALOG_STATS = {
  totalProducts: PRODUCTS.length,
  totalCategories: CATEGORIES.length,
  totalFlavors: PRODUCTS.reduce((acc, p) => acc + p.flavors.length, 0),
  totalImagesTarget: 180,
  categoryBreakdown: CATEGORIES.map((cat) => {
    const items = PRODUCTS.filter((p) => p.category === cat.slug);
    return {
      ...cat,
      productCount: items.length,
      flavorCount: items.reduce((acc, p) => acc + p.flavors.length, 0),
    };
  }),
};

export function formatVND(amount: number): string {
  return `${amount.toLocaleString('vi-VN')}đ`;
}
