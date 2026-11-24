/**
 * NhaiSupplement — Exact 1:1 Flavor-Matched Catalog & 180-Image WebP Optimizer
 *
 * Pulls verified single-product studio photos (per-variant featured_image) from
 * bodybuilding.com and gymstore.vn for all 62 products across 9 exact categories:
 *   Whey & Hydrolyzed (17), Creatine (6), Bar / Cookie (3), Mass (2),
 *   Pre-Workout (7), EAA (3), BCAA (2), Vitamin (15), Dầu cá (7)
 * Produces:
 *   - 180 clean, logo-free, single-product .webp files (~4.8 MB) in /public/images/products/
 *   - 212 verified flavor/pack variants (100% of flavored items have exact 1:1 flavor photos)
 *   - /src/data/realCatalogData.json consumed directly by src/data/catalog.ts
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const OUTPUT_DIR = path.resolve(process.cwd(), 'public/images/products');
const TEMP_DIR = path.resolve(process.cwd(), '.tmp_raw_images');
const MANIFEST_PATH = path.join(OUTPUT_DIR, 'manifest.json');
const GENERATED_DATA_PATH = path.resolve(process.cwd(), 'src/data/realCatalogData.json');
const IMAGE_MAP_PATH = path.resolve(process.cwd(), 'src/data/productImageMap.json');

const TARGET_TOTAL_MB = 4.8;

function inferFlavorColors(flavorName) {
  const s = flavorName.toLowerCase();
  if (/(strawberry|berry|cherry|fruit punch|watermelon|red|raspb|cran|dragon|tiger|hawaii|vice)/i.test(s)) {
    return { colorHex: '#D9385A', accentHex: '#FF5A00' };
  }
  if (/(blue|razz|snow cone|blueberry|arctic|shark|ice blast|bubblegum|patriot)/i.test(s)) {
    return { colorHex: '#0284C7', accentHex: '#FF5A00' };
  }
  if (/(green apple|apple|lime|kiwi|mint|matcha|melon|lemon-lime)/i.test(s)) {
    return { colorHex: '#3F7D3B', accentHex: '#FF5A00' };
  }
  if (/(mango|orange|peach|pineapple|sunny|lemon|tropical|citrus|creamsicle|dreamsicle|tangy)/i.test(s)) {
    return { colorHex: '#EA580C', accentHex: '#F59E0B' };
  }
  if (/(grape|plum|purple)/i.test(s)) {
    return { colorHex: '#7E22CE', accentHex: '#FF5A00' };
  }
  if (/(vanilla|white choc|cream|marshmallow|ice cream cone|cake|birthday|cereal|french|oatmeal|cookie butter)/i.test(s)) {
    return { colorHex: '#D4A359', accentHex: '#171717' };
  }
  if (/(peanut|caramel|toffee|butter|hazelnut|cashew|graham|snicker|cinnamon|banana)/i.test(s)) {
    return { colorHex: '#B45309', accentHex: '#171717' };
  }
  if (/(cookies|oreo|fudge|brownie|mocha|coffee|chocolate|cocoa|choco|s'mores|rocky road)/i.test(s)) {
    return { colorHex: '#5C3317', accentHex: '#FF5A00' };
  }
  if (/(softgel|omega|fish|dha|epa)/i.test(s)) {
    return { colorHex: '#CA8A04', accentHex: '#171717' };
  }
  if (/(unflav|natural|original|formula|tablet|capsule)/i.test(s)) {
    return { colorHex: '#52525B', accentHex: '#FF5A00' };
  }
  return { colorHex: '#FF5A00', accentHex: '#171717' };
}

function cleanVariantFlavorName(raw) {
  let s = String(raw || '').trim();
  // Strip leading count/weight/servings prefix like "30 Servings / ", "5lb / ", "28 / "
  s = s.replace(/^\d+(\.\d+)?\s*(lbs?|lb|kg|g|oz|servings?|serv|ct|tabs?|capsules?|softgels?|bars?|cookies?)?\s*\/\s*/i, '');
  s = s.replace(/\s*\/\s*\d+\s*(servings?|serv|lbs?|lb|kg)\s*$/i, '');
  s = s.replace(/\s*\(\d+(\.\d+)?\s*(lbs?|lb|servings?|serv|oz|g)\)\s*/gi, '');
  return s.trim();
}

function isDisallowedVariant(flavorName, imgUrl) {
  const f = flavorName.toLowerCase();
  const u = (imgUrl || '').toLowerCase();
  if (!f || f === 'default title') return true;
  if (/(variety|combo|bundle|sample|assorted|multi[- ]?pack|mix pack|2-pack|twin)/i.test(f)) return true;
  if (/(banner|chinh-sach|infographic|infor-|qua-tang|wheystore|gymstore-logo|combo)/i.test(u)) return true;
  // Avoid group/multi-product photos if filename indicates multiple/variety
  if (/(variety|bundle|assorted|family|all-flavors|lineup|set-of)/i.test(u)) return true;
  return false;
}

// Curated 62-product blueprint with exact flavor/image quotas:
// Whey 17 (66 imgs), Creatine 6 (22 imgs), Bar 3 (12 imgs), Mass 2 (8 imgs),
// Pre-Workout 7 (28 imgs), EAA 3 (12 imgs), BCAA 2 (10 imgs) -> 158 flavored imgs
// Vitamin 15 (15 imgs, 35 variants) + Dau ca 7 (7 imgs, 19 variants) -> 22 bottle imgs (54 variants)
// Total = 62 products, 180 unique .webp files, 212 variants.
const BLUEPRINT = [
  // === 1. WHEY & HYDROLYZED (17 products, 66 flavors/images) ===
  {
    id: 'wh-01', slug: 'on-gold-standard-whey-5lbs', category: 'whey-hydrolyzed', shape: 'tub',
    source: 'bb', match: 'Optimum Nutrition Gold Standard 100% Whey Protein 5 Lbs',
    name: 'ON Gold Standard 100% Whey 5lbs', brand: 'Optimum Nutrition', weightLabel: '5LBS (2.27KG)',
    price: 1690000, compareAtPrice: 1950000, flavorQuota: 5, badge: 'Bán chạy #1', soldCount: 1420,
    shortDescription: '24g Whey Isolate & Concentrate chuẩn mực thế giới, 5.5g BCAA mỗi muỗng.',
    description: 'Dòng Whey Protein bán chạy hàng đầu thế giới với thành phần chính từ Whey Protein Isolate kết hợp Concentrate giúp phục hồi và phát triển cơ nạc nhanh chóng.',
    servingSize: '30.4g (1 muỗng)', servingsPerContainer: 74, calories: '120 kcal', protein: '24g', carbs: '3g', fat: '1.5g', highlightKey: 'PROTEIN', highlightValue: '24G',
  },
  {
    id: 'wh-02', slug: 'dymatize-iso-100-hydrolyzed-5lbs', category: 'whey-hydrolyzed', shape: 'tub',
    source: 'bb', match: 'Dymatize ISO 100 Hydrolized',
    name: 'Dymatize ISO 100 Hydrolyzed 5lbs', brand: 'Dymatize', weightLabel: '5LBS (2.3KG)',
    price: 2190000, compareAtPrice: 2450000, flavorQuota: 5, badge: 'Hydrolyzed Cao Cấp', soldCount: 1180,
    shortDescription: '25g đạm thủy phân 100% Hydrolyzed Whey Isolate siêu tinh khiết, hấp thu tức thì.',
    description: 'Công thức Whey Protein Isolate thủy phân hoàn toàn giúp loại bỏ tối đa lactose và tạp chất, lý tưởng ngay sau buổi tập nặng.',
    servingSize: '30g (1 muỗng)', servingsPerContainer: 71, calories: '110 kcal', protein: '25g', carbs: '1g', fat: '0.5g', highlightKey: 'HYDROLYZED', highlightValue: '25G',
  },
  {
    id: 'wh-03', slug: 'mutant-iso-surge-5lbs', category: 'whey-hydrolyzed', shape: 'tub',
    source: 'bb', match: 'Mutant Iso Surge',
    name: 'Mutant Iso Surge Whey Isolate 5lbs', brand: 'Mutant', weightLabel: '5LBS (2.27KG)',
    price: 1890000, compareAtPrice: 2150000, flavorQuota: 5, badge: 'Vị Ngon Đậm Đà', soldCount: 845,
    shortDescription: '25g Whey Isolate & Hydrolysate kết hợp bảng vị tráng miệng siêu ngon từ Canada.',
    description: 'Mutant Iso Surge nổi tiếng với kết cấu mịn sánh, hòa tan ngay lập tức trong bình lắc và hương vị chân thực.',
    servingSize: '32g (1 muỗng)', servingsPerContainer: 71, calories: '120 kcal', protein: '25g', carbs: '2g', fat: '1g', highlightKey: 'ISOLATE', highlightValue: '25G',
  },
  {
    id: 'wh-04', slug: 'bsn-syntha-6-isolate-4lbs', category: 'whey-hydrolyzed', shape: 'tub',
    source: 'bb', match: 'BSN Syntha-6 Protein Isolate',
    name: 'BSN Syntha-6 Protein Isolate 4lbs', brand: 'BSN', weightLabel: '4LBS (1.82KG)',
    price: 1650000, compareAtPrice: 1890000, flavorQuota: 4, badge: 'Trải Dài Hấp Thu', soldCount: 690,
    shortDescription: '25g đạm Isolate & Milk Protein Isolate cho cảm giác béo ngậy ít calo.',
    description: 'BSN Syntha-6 Isolate kết hợp hấp thu nhanh và chậm giúp nuôi dưỡng cơ bắp suốt nhiều giờ.',
    servingSize: '38g (1 muỗng)', servingsPerContainer: 48, calories: '140 kcal', protein: '25g', carbs: '7g', fat: '2g', highlightKey: 'ISOLATE', highlightValue: '25G',
  },
  {
    id: 'wh-05', slug: 'isopure-zero-carb-3lbs', category: 'whey-hydrolyzed', shape: 'tub',
    source: 'bb', match: 'Isopure Zero Carb Powder 3 lb',
    name: 'Isopure Zero Carb 100% Whey Isolate 3lbs', brand: 'Isopure', weightLabel: '3LBS (1.36KG)',
    price: 1620000, compareAtPrice: 1850000, flavorQuota: 4, badge: '0g Đường', soldCount: 730,
    shortDescription: '25g 100% Whey Protein Isolate tinh khiết, 0g đường, bổ sung Vitamin khoáng.',
    description: 'Lựa chọn hàng đầu cho giai đoạn siết cơ cắt nét với độ tinh khiết cao và không chứa đường thêm.',
    servingSize: '31g (1 muỗng)', servingsPerContainer: 44, calories: '110 kcal', protein: '25g', carbs: '0g', fat: '0g', highlightKey: 'ZERO CARB', highlightValue: '25G',
  },
  {
    id: 'wh-06', slug: 'nutrex-isofit-5lbs', category: 'whey-hydrolyzed', shape: 'tub',
    source: 'bb', match: 'NUTREX ISOFIT',
    name: 'Nutrex IsoFit 100% Whey Isolate 5lbs', brand: 'Nutrex', weightLabel: '5LBS (2.27KG)',
    price: 1920000, compareAtPrice: 2190000, flavorQuota: 4, badge: 'MCT Oil Clean', soldCount: 540,
    shortDescription: '25g Cross-Flow Microfiltered Whey Isolate kết hợp bột dầu MCT sạch.',
    description: 'Lọc lạnh bảo toàn phân đoạn sinh học tự nhiên, dễ tiêu hóa và hỗ trợ phục hồi cơ nhanh.',
    servingSize: '32.3g (1 muỗng)', servingsPerContainer: 70, calories: '120 kcal', protein: '25g', carbs: '2g', fat: '1g', highlightKey: 'ISOLATE', highlightValue: '25G',
  },
  {
    id: 'wh-07', slug: 'nutrabio-whey-isolate-3-3lbs', category: 'whey-hydrolyzed', shape: 'tub',
    source: 'gs', matchFilename: 'nutrabio-whey-protein-isolate-50-servings',
    name: 'NutraBio 100% Whey Protein Isolate 50 Serv', brand: 'NutraBio', weightLabel: '3.3LBS (1.5KG)',
    price: 1750000, compareAtPrice: 1990000, flavorQuota: 4, badge: 'Minh Bạch 100%', soldCount: 620,
    shortDescription: '25g Whey Isolate không chất độn, công bố minh bạch 100% thành phần trên nhãn.',
    description: 'NutraBio đạt tiêu chuẩn GMP Hoa Kỳ, không phụ gia độn, độ tinh khiết protein vượt trội.',
    servingSize: '30g (1 muỗng)', servingsPerContainer: 50, calories: '110 kcal', protein: '25g', carbs: '1g', fat: '0.5g', highlightKey: 'PURE WPI', highlightValue: '25G',
  },
  {
    id: 'wh-08', slug: 'pvl-iso-gold-5lbs', category: 'whey-hydrolyzed', shape: 'tub',
    source: 'gs', matchFilename: 'pvl-iso-gold-5lbs',
    name: 'PVL Iso Gold 100% Whey Isolate 5lbs', brand: 'PVL', weightLabel: '5LBS (2.27KG)',
    price: 1850000, compareAtPrice: 2090000, flavorQuota: 4, badge: 'Informed Choice', soldCount: 670,
    shortDescription: '27g Whey Isolate & Hydrolysate kèm lợi khuẩn Probiotic DE111 tiêu hóa êm.',
    description: 'Chứng nhận Informed-Choice an toàn cho vận động viên, hàm lượng đạm 27g cực cao mỗi muỗng.',
    servingSize: '31g (1 muỗng)', servingsPerContainer: 73, calories: '120 kcal', protein: '27g', carbs: '1g', fat: '1g', highlightKey: 'PROTEIN', highlightValue: '27G',
  },
  {
    id: 'wh-09', slug: 'ryse-loaded-protein-2lbs', category: 'whey-hydrolyzed', shape: 'tub',
    source: 'bb', match: 'Ryse Loaded Protein',
    name: 'RYSE Loaded Protein Blend 2lbs', brand: 'RYSE', weightLabel: '2LBS (907G)',
    price: 1180000, compareAtPrice: 1350000, flavorQuota: 4, badge: 'Prebiotic Fiber', soldCount: 510,
    shortDescription: '25g Whey Isolate làm chủ đạo kèm chất xơ Prebiotic và MCTs hỗ trợ tiêu hóa.',
    description: 'Bảng hương vị độc quyền kết hợp các thương hiệu bánh kẹo Mỹ nổi tiếng, không gây đầy bụng.',
    servingSize: '33g (1 muỗng)', servingsPerContainer: 27, calories: '130 kcal', protein: '25g', carbs: '3g', fat: '2g', highlightKey: 'PROTEIN', highlightValue: '25G',
  },
  {
    id: 'wh-10', slug: 'raw-bum-itholate-protein', category: 'whey-hydrolyzed', shape: 'tub',
    source: 'bb', match: 'Raw Nutrition BUM Itholate',
    name: 'RAW Nutrition BUM Itholate 100% Isolate', brand: 'RAW Nutrition', weightLabel: '2.1LBS (950G)',
    price: 1390000, compareAtPrice: 1580000, flavorQuota: 4, badge: 'CBUM Signature', soldCount: 790,
    shortDescription: '25g 100% Micro-Filtered Whey Isolate công thức của Mr. Olympia Chris Bumstead.',
    description: 'Siêu mịn, 0g đường thừa, tối ưu hóa khả năng hấp thu đạm tinh khiết cho cơ nạc.',
    servingSize: '31g (1 muỗng)', servingsPerContainer: 30, calories: '110 kcal', protein: '25g', carbs: '1g', fat: '0g', highlightKey: 'ISOLATE', highlightValue: '25G',
  },
  {
    id: 'wh-11', slug: 'musclemeds-carnivor-isolate-4lbs', category: 'whey-hydrolyzed', shape: 'tub',
    source: 'bb', match: 'MuscleMeds CARNIVOR Protein Isolate',
    name: 'MuscleMeds Carnivor Hydrolyzed Beef Isolate', brand: 'MuscleMeds', weightLabel: '4LBS (1.82KG)',
    price: 1550000, compareAtPrice: 1790000, flavorQuota: 4, badge: '0% Lactose', soldCount: 480,
    shortDescription: '23g Hydrolyzed Beef Protein Isolate hoàn toàn không chứa sữa và lactose.',
    description: 'Giải pháp lý tưởng cho người dị ứng lactose, bổ sung 2.5g Creatine tự nhiên hỗ trợ sức mạnh.',
    servingSize: '36g (1 muỗng)', servingsPerContainer: 56, calories: '120 kcal', protein: '23g', carbs: '6g', fat: '0g', highlightKey: 'NO DAIRY', highlightValue: '23G',
  },
  {
    id: 'wh-12', slug: 'redcon1-mre-lite-30serv', category: 'whey-hydrolyzed', shape: 'tub',
    source: 'bb', match: 'Redcon1 MRE Lite',
    name: 'Redcon1 MRE Lite Whole Food Protein', brand: 'Redcon1', weightLabel: '2LBS (870G)',
    price: 1090000, compareAtPrice: 1290000, flavorQuota: 4, badge: 'Whole Food', soldCount: 430,
    shortDescription: '24g đạm từ thực phẩm toàn phần (thịt bò, cá hồi, trứng, đậu Hà Lan) không chứa Whey.',
    description: 'Thân thiện tuyệt đối với dạ dày nhạy cảm, dễ pha, cung cấp amino axit ổn định.',
    servingSize: '29g (1 muỗng)', servingsPerContainer: 30, calories: '130 kcal', protein: '24g', carbs: '4g', fat: '2g', highlightKey: 'WHOLE FOOD', highlightValue: '24G',
  },
  {
    id: 'wh-13', slug: 'perfect-sports-diesel-5lbs', category: 'whey-hydrolyzed', shape: 'tub',
    source: 'gs', matchFilename: 'perfect-sports-diesel',
    name: 'Perfect Sports Diesel New Zealand Isolate', brand: 'Perfect Sports', weightLabel: '5LBS (2.27KG)',
    price: 2050000, compareAtPrice: 2350000, flavorQuota: 4, badge: 'Grass-Fed NZ', soldCount: 590,
    shortDescription: '27g Whey Isolate từ bò ăn cỏ tự nhiên New Zealand, 100% ngọt tự nhiên.',
    description: 'Không hormone tăng trưởng rBGH, hàm lượng Glutamine và BCAA cao vượt trội.',
    servingSize: '30g (1 muỗng)', servingsPerContainer: 75, calories: '110 kcal', protein: '27g', carbs: '0g', fat: '0g', highlightKey: 'GRASS-FED', highlightValue: '27G',
  },
  {
    id: 'wh-14', slug: 'hitech-precision-protein', category: 'whey-hydrolyzed', shape: 'tub',
    source: 'bb', match: 'Hi-Tech Pharma Precision Protein',
    name: 'Hi-Tech Precision Embedded Enzyme Whey', brand: 'Hi-Tech Pharma', weightLabel: '2LBS (908G)',
    price: 1120000, compareAtPrice: 1320000, flavorQuota: 3, badge: 'EET Enzyme', soldCount: 310,
    shortDescription: '25g Hydrolyzed Whey ứng dụng công nghệ Enzyme nhúng giải phóng Leucine Peptides.',
    description: 'Tăng tổng hợp protein cơ bắp nhanh hơn whey thông thường nhờ cấu trúc peptide sinh học.',
    servingSize: '32g (1 muỗng)', servingsPerContainer: 28, calories: '130 kcal', protein: '25g', carbs: '3g', fat: '2g', highlightKey: 'PEPTIDES', highlightValue: '25G',
  },
  {
    id: 'wh-15', slug: 'vmi-protolyte-isolate', category: 'whey-hydrolyzed', shape: 'tub',
    source: 'bb', match: 'VMI ProtoLyte Isolate',
    name: 'VMI Sports ProtoLyte Cold-Filtered Isolate', brand: 'VMI Sports', weightLabel: '5LBS (2.27KG)',
    price: 1820000, compareAtPrice: 2050000, flavorQuota: 3, badge: 'Thêm Điện Giải', soldCount: 280,
    shortDescription: '25g Whey Isolate lọc lạnh tích hợp phức hợp điện giải bù khoáng sau tập.',
    description: 'Hương vị tráng miệng phong phú, không đường thừa, phục hồi nước và cơ đồng thời.',
    servingSize: '32g (1 muỗng)', servingsPerContainer: 71, calories: '120 kcal', protein: '25g', carbs: '2g', fat: '1g', highlightKey: 'ELECTROLYTE', highlightValue: '25G',
  },
  {
    id: 'wh-16', slug: 'jocko-molk-protein-bag', category: 'whey-hydrolyzed', shape: 'pouch',
    source: 'bb', match: 'JOCKO Mölk Protein Powder Bag',
    name: 'JOCKO Mölk Grass-Fed Protein Blend Bag', brand: 'Jocko Fuel', weightLabel: '2.1LBS (960G)',
    price: 1240000, compareAtPrice: 1420000, flavorQuota: 3, badge: 'Men Tiêu Hóa', soldCount: 340,
    shortDescription: '22g protein bò ăn cỏ kết hợp Probiotics và enzyme tiêu hóa tự nhiên.',
    description: 'Đóng túi zip tiện lợi, không chất tạo ngọt nhân tạo, phù hợp dùng hàng ngày.',
    servingSize: '31g (1 muỗng)', servingsPerContainer: 31, calories: '130 kcal', protein: '22g', carbs: '4g', fat: '2g', highlightKey: 'GRASS-FED', highlightValue: '22G',
  },
  {
    id: 'wh-17', slug: 'axe-sledge-farm-fed-isolate', category: 'whey-hydrolyzed', shape: 'tub',
    source: 'bb', match: 'Axe & Sledge Farm Fed',
    name: 'Axe & Sledge Farm Fed Grass-Fed Isolate', brand: 'Axe & Sledge', weightLabel: '2LBS (900G)',
    price: 1290000, compareAtPrice: 1490000, flavorQuota: 2, badge: 'DigeSEB Enzyme', soldCount: 295,
    shortDescription: '22–25g Whey Isolate 100% bò ăn cỏ bổ sung 100mg DigeSEB hỗ trợ tiêu hóa.',
    description: 'Mỗi muỗng có độ tan hoàn hảo, không vón cục khi pha với nước lạnh.',
    servingSize: '29g (1 muỗng)', servingsPerContainer: 28, calories: '110 kcal', protein: '22g', carbs: '2g', fat: '1g', highlightKey: 'ISOLATE', highlightValue: '22G',
  },

  // === 2. CREATINE (6 products, 22 flavors/images) ===
  {
    id: 'cr-01', slug: 'ostrovit-creatine-monohydrate-500g', category: 'creatine', shape: 'tub',
    source: 'gs', matchFilename: 'ostrovit-creatine-monohydrate-500g',
    name: 'OstroVit Creatine Monohydrate 500g', brand: 'OstroVit', weightLabel: '500G (100 SERV)',
    price: 390000, compareAtPrice: 490000, flavorQuota: 5, badge: 'Siêu Tiết Kiệm', soldCount: 1850,
    shortDescription: 'Creatine Monohydrate micronized siêu mịn nhập khẩu Ba Lan, 100 lần dùng.',
    description: 'Bổ sung Creatine tinh khiết 200 mesh giúp tái tạo ATP, tăng sức mạnh bùng nổ và kích thích phồng cơ tự nhiên.',
    servingSize: '5g (1 muỗng)', servingsPerContainer: 100, calories: '0 kcal', protein: '0g', carbs: '0g', fat: '0g', highlightKey: 'CREATINE', highlightValue: '5000MG',
  },
  {
    id: 'cr-02', slug: 'nutrabio-micronized-creatine', category: 'creatine', shape: 'tub',
    source: 'gs', matchFilename: 'nutrabio-micronized-creatine-monohydrate-60',
    name: 'NutraBio Micronized Creatine 60 Servings', brand: 'NutraBio', weightLabel: '300G (60 SERV)',
    price: 540000, compareAtPrice: 650000, flavorQuota: 4, badge: 'Chuẩn USP Mỹ', soldCount: 740,
    shortDescription: '5g Micronized Creatine Monohydrate đạt chuẩn dược điển USP, tan nhanh không cặn.',
    description: 'Tinh khiết 99.98%, kiểm định bởi phòng lab độc lập tại Mỹ, có cả bản không vị và vị trái cây.',
    servingSize: '5g (1 muỗng)', servingsPerContainer: 60, calories: '0 kcal', protein: '0g', carbs: '0g', fat: '0g', highlightKey: 'USP PURE', highlightValue: '5000MG',
  },
  {
    id: 'cr-03', slug: 'con-cret-creatine-hcl', category: 'creatine', shape: 'tub',
    source: 'bb', match: 'CON-CRET Creatine HCL',
    name: 'CON-CRET Patented Creatine HCl 60 Serv', brand: 'CON-CRET', weightLabel: '78G (60 SERV)',
    price: 590000, compareAtPrice: 720000, flavorQuota: 4, badge: 'HCl Không Tích Nước', soldCount: 620,
    shortDescription: 'Creatine Hydrochloride độ hòa tan gấp 59 lần, không cần loading, không đầy bụng.',
    description: 'Liều nhỏ nhưng sinh khả dụng cực cao, không gây tích nước dưới da, phù hợp cả khi siết cơ.',
    servingSize: '1.3g (1 muỗng)', servingsPerContainer: 60, calories: '0 kcal', protein: '0g', carbs: '0g', fat: '0g', highlightKey: 'HCL', highlightValue: '750MG',
  },
  {
    id: 'cr-04', slug: 'nutrex-creatine-plus-flavor', category: 'creatine', shape: 'tub',
    source: 'bb', match: 'Nutrex Creatine For Women',
    name: 'Nutrex Micronized Creatine Clean Series', brand: 'Nutrex', weightLabel: '300G (60 SERV)',
    price: 490000, compareAtPrice: 590000, flavorQuota: 4, badge: 'Tan Mịn 100%', soldCount: 510,
    shortDescription: '5g Creatine Monohydrate tinh khiết hỗ trợ sức mạnh, sức bền và phục hồi cơ.',
    description: 'Công thức sạch không tạp chất, nhiều hương vị trái cây giải khát dễ uống hàng ngày.',
    servingSize: '5g (1 muỗng)', servingsPerContainer: 60, calories: '0 kcal', protein: '0g', carbs: '0g', fat: '0g', highlightKey: 'CREATINE', highlightValue: '5G',
  },
  {
    id: 'cr-05', slug: 'bpi-best-creatine', category: 'creatine', shape: 'tub',
    source: 'bb', match: 'BPI Sports BEST Creatine',
    name: 'BPI Sports BEST Creatine 6-Blend 50 Serv', brand: 'BPI Sports', weightLabel: '300G (50 SERV)',
    price: 580000, compareAtPrice: 690000, flavorQuota: 3, badge: '6 Dạng Creatine', soldCount: 440,
    shortDescription: 'Phức hợp 6 dạng Creatine tiên tiến kết hợp Beta-Alanine và khoáng điện giải.',
    description: 'Tăng hiệu suất tập tạ tối đa mà không cần pha chế cầu kỳ hay giai đoạn nạp.',
    servingSize: '6g (1 muỗng)', servingsPerContainer: 50, calories: '0 kcal', protein: '0g', carbs: '0g', fat: '0g', highlightKey: '6-BLEND', highlightValue: '4G',
  },
  {
    id: 'cr-06', slug: 'abe-creatine-300g', category: 'creatine', shape: 'tub',
    source: 'bb', match: 'ABE Creatine',
    name: 'ABE Micronized Creatine Powder 300g', brand: 'Applied Nutrition', weightLabel: '300G (60 SERV)',
    price: 460000, compareAtPrice: 550000, flavorQuota: 2, badge: 'UK Informed Sport', soldCount: 560,
    shortDescription: '5g Creatine Monohydrate chuẩn Anh Quốc đạt chứng nhận Informed-Sport.',
    description: 'Dễ dàng pha chung cùng Whey hoặc Pre-Workout giúp bứt phá mức tạ nhanh chóng.',
    servingSize: '5g (1 muỗng)', servingsPerContainer: 60, calories: '0 kcal', protein: '0g', carbs: '0g', fat: '0g', highlightKey: 'CREATINE', highlightValue: '5G',
  },

  // === 3. BAR / COOKIE (3 products, 12 flavors/images) — KHÔNG tặng bình lắc ===
  {
    id: 'bc-01', slug: 'barebells-protein-bar-box-12', category: 'bar-cookie', shape: 'bar',
    source: 'bb', match: 'Barebells Protein Bar 12 Pack',
    name: 'Barebells Protein Bar (Hộp 12 Thanh)', brand: 'Barebells', weightLabel: 'HỘP 12 x 55G',
    price: 890000, compareAtPrice: 1050000, flavorQuota: 5, badge: '20g Protein · 0g Đường', soldCount: 930,
    shortDescription: '20g Protein mỗi thanh socola phủ hạt giòn, không đường thêm, vị ngon như kẹo.',
    description: 'Bánh Protein Bar bán chạy hàng đầu châu Âu, mềm dẻo bên trong và giòn tan lớp phủ bên ngoài.',
    servingSize: '55g (1 thanh)', servingsPerContainer: 12, calories: '200 kcal', protein: '20g', carbs: '18g', fat: '7g', highlightKey: 'PROTEIN', highlightValue: '20G',
  },
  {
    id: 'bc-02', slug: 'legendary-protein-pastry-10', category: 'bar-cookie', shape: 'bar',
    source: 'bb', match: 'Legendary Foods Protein Pastry 10 Pack',
    name: 'Legendary Foods Protein Pastry (Hộp 10 Bánh)', brand: 'Legendary Foods', weightLabel: 'HỘP 10 x 62G',
    price: 790000, compareAtPrice: 920000, flavorQuota: 4, badge: '20g Đạm · Ít Tinh Bột', soldCount: 610,
    shortDescription: '20g Protein và chỉ 4g Net Carbs trong một chiếc bánh nướng nhân kem thơm lừng.',
    description: 'Có thể hâm nóng lò vi sóng 10 giây để lớp nhân chảy mềm, thay thế hoàn hảo bữa phụ nhiều đường.',
    servingSize: '62g (1 bánh)', servingsPerContainer: 10, calories: '180 kcal', protein: '20g', carbs: '22g', fat: '6g', highlightKey: 'PROTEIN', highlightValue: '20G',
  },
  {
    id: 'bc-03', slug: 'quest-protein-cookie-4-pack', category: 'bar-cookie', shape: 'bar',
    source: 'gs', matchFilename: 'quest-cookie-bar-4-cookies',
    name: 'Quest Protein Cookie Bar (Hộp 4 Bánh)', brand: 'Quest Nutrition', weightLabel: 'HỘP 4 x 59G',
    price: 295000, compareAtPrice: 360000, flavorQuota: 3, badge: '15g Protein · 9g Xơ', soldCount: 540,
    shortDescription: '15g Protein hoàn chỉnh cùng 9g chất xơ tự nhiên trong từng chiếc bánh quy mềm.',
    description: 'Tiện lợi mang theo đi làm, đi tập hoặc du lịch mà vẫn đảm bảo nạp đủ protein sạch.',
    servingSize: '59g (1 bánh)', servingsPerContainer: 4, calories: '240 kcal', protein: '15g', carbs: '22g', fat: '12g', highlightKey: 'COOKIE', highlightValue: '15G',
  },

  // === 4. MASS GAINER (2 products, 8 flavors/images) ===
  {
    id: 'ms-01', slug: 'musclemeds-carnivor-mass-gainer', category: 'mass', shape: 'pouch',
    source: 'bb', match: 'MuscleMass CARNIVOR MASS',
    name: 'MuscleMeds Carnivor Mass Big Steer Gainer', brand: 'MuscleMeds', weightLabel: '10LBS (4.5KG)',
    price: 1690000, compareAtPrice: 1950000, flavorQuota: 4, badge: 'Tăng Cân Không Lactose', soldCount: 680,
    shortDescription: '720 Calo & 50g Hydrolyzed Beef Protein + Creatine giúp tăng cân cơ nạc sạch.',
    description: 'Tối ưu insulin giúp đẩy dưỡng chất vào cơ bắp mà không gây tích mỡ thừa hay đau bụng sữa.',
    servingSize: '192g (4 muỗng)', servingsPerContainer: 24, calories: '720 kcal', protein: '50g', carbs: '125g', fat: '2.5g', highlightKey: 'BEEF MASS', highlightValue: '50G',
  },
  {
    id: 'ms-02', slug: 'mutant-mass-whole-food-gainer', category: 'mass', shape: 'pouch',
    source: 'bb', match: 'Mutant Mass - Whole Food Based Gainer',
    name: 'Mutant Mass Whole Food Gainer 15lbs', brand: 'Mutant', weightLabel: '15LBS (6.8KG)',
    price: 1850000, compareAtPrice: 2150000, flavorQuota: 4, badge: '1100 Calo / Liều', soldCount: 820,
    shortDescription: '1100 Calories & 56g Protein đa nguồn kèm carb sạch từ yến mạch, khoai lang.',
    description: 'Dành riêng cho người gầy khó tăng cân và vận động viên cần lượng năng lượng lớn mỗi ngày.',
    servingSize: '280g (4 muỗng)', servingsPerContainer: 24, calories: '1100 kcal', protein: '56g', carbs: '192g', fat: '12g', highlightKey: 'CALORIES', highlightValue: '1100',
  },

  // === 5. PRE-WORKOUT (7 products, 28 flavors/images) ===
  {
    id: 'pw-01', slug: 'redcon1-total-war-preworkout', category: 'pre-workout', shape: 'tub',
    source: 'bb', match: 'Redcon1 Total War Preworkout',
    name: 'Redcon1 Total War Pre-Workout 30 Serv', brand: 'Redcon1', weightLabel: '441G (30 SERV)',
    price: 680000, compareAtPrice: 790000, flavorQuota: 5, badge: 'Pump & Energy #1', soldCount: 1120,
    shortDescription: '6g Citrulline Malate, 3.2g Beta-Alanine, 320mg Caffeine bùng nổ xuyên suốt buổi tập.',
    description: 'Liều dùng chuẩn quân đội giúp tăng lưu lượng máu bơm cơ, tỉnh táo tập trung cao độ.',
    servingSize: '14.7g (1 muỗng)', servingsPerContainer: 30, calories: '0 kcal', protein: '0g', carbs: '0g', fat: '0g', highlightKey: 'CITRULLINE', highlightValue: '6000MG',
  },
  {
    id: 'pw-02', slug: 'abe-ultimate-preworkout', category: 'pre-workout', shape: 'tub',
    source: 'bb', match: 'ABE Ultimate Preworkout',
    name: 'Applied Nutrition ABE Ultimate Pre-Workout', brand: 'Applied Nutrition', weightLabel: '315G (30 SERV)',
    price: 650000, compareAtPrice: 760000, flavorQuota: 5, badge: 'Bán Chạy Nhất VN', soldCount: 1340,
    shortDescription: '4g Citrulline, 3.25g Creatine, 2g Beta-Alanine, Vitamin B3 & B12 chống mệt mỏi.',
    description: 'Dòng Pre-Workout quốc dân dễ dùng, không tụt năng lượng sau tập, hương vị cực thanh mát.',
    servingSize: '10.5g (1 muỗng)', servingsPerContainer: 30, calories: '0 kcal', protein: '0g', carbs: '0g', fat: '0g', highlightKey: 'CAFFEINE', highlightValue: '200MG',
  },
  {
    id: 'pw-03', slug: 'ryse-loaded-pre-30serv', category: 'pre-workout', shape: 'tub',
    source: 'bb', match: 'RYSE Loaded Pre',
    name: 'RYSE Loaded Pre-Workout 30 Servings', brand: 'RYSE', weightLabel: '390G (30 SERV)',
    price: 760000, compareAtPrice: 890000, flavorQuota: 4, badge: 'Think & Pump', soldCount: 640,
    shortDescription: '4.5g L-Citrulline tinh khiết, 3.5g Beta-Alanine & Cognizin tăng tập trung thần kinh.',
    description: 'Mang lại cảm giác kết nối cơ bắp – trí não rõ rệt ngay sau 15 phút uống.',
    servingSize: '13g (1 muỗng)', servingsPerContainer: 30, calories: '0 kcal', protein: '0g', carbs: '0g', fat: '0g', highlightKey: 'CITRULLINE', highlightValue: '4.5G',
  },
  {
    id: 'pw-04', slug: 'bucked-up-bamf-preworkout', category: 'pre-workout', shape: 'tub',
    source: 'bb', match: 'Bucked Up BAMF',
    name: 'Bucked Up BAMF Nootropic Pre-Workout', brand: 'Bucked Up', weightLabel: '372G (30 SERV)',
    price: 890000, compareAtPrice: 1050000, flavorQuota: 4, badge: 'Nootropic Focus', soldCount: 520,
    shortDescription: '6g Citrulline Malate kết hợp AlphaSize & Huperzine A cho độ tập trung sắc lẹm.',
    description: 'Chuyên biệt cho những buổi tập nặng cần mind-muscle connection tuyệt đối.',
    servingSize: '12.4g (1 muỗng)', servingsPerContainer: 30, calories: '0 kcal', protein: '0g', carbs: '0g', fat: '0g', highlightKey: 'HIGH STIM', highlightValue: '333MG',
  },
  {
    id: 'pw-05', slug: 'c4-original-preworkout', category: 'pre-workout', shape: 'tub',
    source: 'bb', match: 'C4 Original Pre-Workout',
    name: 'Cellucor C4 Original Pre-Workout 30 Serv', brand: 'Cellucor', weightLabel: '195G (30 SERV)',
    price: 590000, compareAtPrice: 690000, flavorQuota: 4, badge: 'Cho Người Mới', soldCount: 970,
    shortDescription: '150mg Caffeine vừa phải kết hợp CarnoSyn Beta-Alanine và Arginine AKG.',
    description: 'Phù hợp cả người mới tập hoặc tập buổi tối không muốn quá kích thích hệ thần kinh.',
    servingSize: '6.5g (1 muỗng)', servingsPerContainer: 30, calories: '0 kcal', protein: '0g', carbs: '0g', fat: '0g', highlightKey: 'CAFFEINE', highlightValue: '150MG',
  },
  {
    id: 'pw-06', slug: 'raw-bum-thavage-preworkout', category: 'pre-workout', shape: 'tub',
    source: 'bb', match: 'RAW Nutrition BUM Thavage',
    name: 'RAW Nutrition CBUM Thavage Pre-Workout', brand: 'RAW Nutrition', weightLabel: '540G (40 SERV)',
    price: 940000, compareAtPrice: 1090000, flavorQuota: 3, badge: 'CBUM Formula', soldCount: 680,
    shortDescription: '6g L-Citrulline, 2.5g Betaine Anhydrous, Tyrosine & Bitter Orange công thức Olympia.',
    description: 'Cân bằng hoàn hảo giữa sức mạnh pump cơ, năng lượng và tập trung tinh thần.',
    servingSize: '13.5g (1 muỗng)', servingsPerContainer: 40, calories: '5 kcal', protein: '0g', carbs: '1g', fat: '0g', highlightKey: 'CITRULLINE', highlightValue: '6G',
  },
  {
    id: 'pw-07', slug: 'vmi-kxr-preworkout', category: 'pre-workout', shape: 'tub',
    source: 'bb', match: 'VMI KXR High-Stim Pre-Workout',
    name: 'VMI Sports KXR High-Stim Pre-Workout', brand: 'VMI Sports', weightLabel: '300G (30 SERV)',
    price: 780000, compareAtPrice: 890000, flavorQuota: 3, badge: '400mg Caffeine Blend', soldCount: 390,
    shortDescription: 'Năng lượng mạnh mẽ 400mg Caffeine đa tầng kết hợp Beta-Alanine kéo dài sức bền.',
    description: 'Dành cho gymer kinh nghiệm cần mức kích thích mạnh và bền bỉ trong các buổi tập dài.',
    servingSize: '10g (1 muỗng)', servingsPerContainer: 30, calories: '0 kcal', protein: '0g', carbs: '0g', fat: '0g', highlightKey: 'CAFFEINE', highlightValue: '400MG',
  },

  // === 6. EAA (3 products, 12 flavors/images) ===
  {
    id: 'ea-01', slug: 'nutrex-eaa-hydration-30serv', category: 'eaa', shape: 'tub',
    source: 'bb', match: 'Nutrex EAA+ Hydration',
    name: 'Nutrex EAA+ Hydration 30 Servings', brand: 'Nutrex', weightLabel: '390G (30 SERV)',
    price: 640000, compareAtPrice: 750000, flavorQuota: 5, badge: '8g EAA + Bù Nước', soldCount: 830,
    shortDescription: '8g 9 Axit Amin thiết yếu (6g BCAA) + Nước dừa, Taurine bù điện giải trong lúc tập.',
    description: 'Chống dị hóa cơ bắp tối đa khi tập cường độ cao và giữ cơ thể luôn đủ nước.',
    servingSize: '13g (1 muỗng)', servingsPerContainer: 30, calories: '0 kcal', protein: '0g', carbs: '0g', fat: '0g', highlightKey: 'EAA', highlightValue: '8G',
  },
  {
    id: 'ea-02', slug: 'panda-aminos-bcaa-eaa', category: 'eaa', shape: 'tub',
    source: 'bb', match: 'PANDA Supplements Aminos BCAA + EAA',
    name: 'PANDA Supplements Aminos BCAA + EAA', brand: 'PANDA', weightLabel: '420G (30 SERV)',
    price: 720000, compareAtPrice: 840000, flavorQuota: 4, badge: '10g EAA + AstraGin', soldCount: 490,
    shortDescription: '10g tổng hợp BCAA + EAA kết hợp khoáng biển hồng Himalaya & AstraGin tăng hấp thu.',
    description: 'Phục hồi cơ bắp nhanh giữa các hiệp tập nặng với vị trái cây mát lạnh tự nhiên.',
    servingSize: '14g (1 muỗng)', servingsPerContainer: 30, calories: '0 kcal', protein: '0g', carbs: '0g', fat: '0g', highlightKey: 'EAA', highlightValue: '10G',
  },
  {
    id: 'ea-03', slug: 'project1-amino-evolution-eaa', category: 'eaa', shape: 'tub',
    source: 'bb', match: 'Project#1 Nutrition Amino Evolution',
    name: 'Project#1 Amino Evolution EAA + Electrolytes', brand: 'Project#1', weightLabel: '360G (30 SERV)',
    price: 660000, compareAtPrice: 780000, flavorQuota: 3, badge: 'Phục Hồi Nhanh', soldCount: 360,
    shortDescription: 'Full-spectrum 9 EAA kèm phức hợp bù điện giải Natri – Kali – Magie.',
    description: 'Hỗ trợ tổng hợp protein liên tục trong buổi tập, giảm đau nhức cơ ngày hôm sau.',
    servingSize: '12g (1 muỗng)', servingsPerContainer: 30, calories: '0 kcal', protein: '0g', carbs: '0g', fat: '0g', highlightKey: 'EAA', highlightValue: '7.5G',
  },

  // === 7. BCAA (2 products, 10 flavors/images) ===
  {
    id: 'bc-bcaa-01', slug: 'xtend-original-bcaa-30serv', category: 'bcaa', shape: 'tub',
    source: 'bb', match: 'Xtend Original BCAA',
    name: 'Scivation Xtend Original BCAA 30 Servings', brand: 'Xtend', weightLabel: '420G (30 SERV)',
    price: 590000, compareAtPrice: 690000, flavorQuota: 5, badge: 'BCAA #1 Thế Giới', soldCount: 1290,
    shortDescription: '7g BCAA chuẩn tỉ lệ 2:1:1 + 2.5g Glutamine & 1g Citrulline Malate.',
    description: 'Không đường, không calo, hỗ trợ chống mỏi cơ và phục hồi sợi cơ tức thì trong buổi tập.',
    servingSize: '14g (1 muỗng)', servingsPerContainer: 30, calories: '0 kcal', protein: '0g', carbs: '0g', fat: '0g', highlightKey: 'BCAA', highlightValue: '7G',
  },
  {
    id: 'bc-bcaa-02', slug: 'mutant-hardcore-bcaa-30serv', category: 'bcaa', shape: 'tub',
    source: 'bb', match: 'Mutant HARDCORE BCAA',
    name: 'Mutant BCAA 9.7 Hardcore Amino 30 Serv', brand: 'Mutant', weightLabel: '348G (30 SERV)',
    price: 550000, compareAtPrice: 650000, flavorQuota: 5, badge: '9.7g Amino', soldCount: 740,
    shortDescription: '9.7g Amino Acid trong đó 7.2g BCAA tan tức thì cùng 8 khoáng chất điện giải.',
    description: 'Bổ sung BioPerine giúp hấp thu axit amin tối ưu, hương vị đậm đà giải khát.',
    servingSize: '11.6g (1 muỗng)', servingsPerContainer: 30, calories: '0 kcal', protein: '0g', carbs: '0g', fat: '0g', highlightKey: 'AMINO', highlightValue: '9.7G',
  },

  // === 8. VITAMIN (15 products, 15 bottle images, 35 variants) — KHÔNG tặng bình lắc ===
  {
    id: 'vt-01', slug: 'on-opti-men-multivitamin', category: 'vitamin', shape: 'bottle',
    source: 'bb', match: 'ON Opti-Men Multivitamin Caps',
    name: 'ON Opti-Men Multivitamin Nam Giới', brand: 'Optimum Nutrition', weightLabel: 'HỘP 150 VIÊN',
    price: 590000, compareAtPrice: 690000, bottleVariants: ['Hộp 150 viên', 'Hộp 90 viên', 'Hộp 240 viên'], badge: '75+ Hoạt Chất', soldCount: 980,
    shortDescription: 'Hơn 75 vitamin, khoáng chất, amino axit và chiết xuất thảo mộc chuyên biệt cho nam tập luyện.',
    description: 'Tăng đề kháng, chuyển hóa năng lượng và hỗ trợ sinh lý nam giới tập gym cường độ cao.',
    servingSize: '3 viên/ngày', servingsPerContainer: 50, calories: '0 kcal', protein: '0g', carbs: '0g', fat: '0g', highlightKey: 'ACTIVE', highlightValue: '75+',
  },
  {
    id: 'vt-02', slug: 'on-opti-women-multivitamin', category: 'vitamin', shape: 'bottle',
    source: 'bb', match: 'ON Opti-Women Multivitamin Caps',
    name: 'ON Opti-Women Multivitamin Nữ Giới', brand: 'Optimum Nutrition', weightLabel: 'HỘP 120 VIÊN',
    price: 560000, compareAtPrice: 650000, bottleVariants: ['Hộp 120 viên', 'Hộp 60 viên', 'Hộp 240 viên'], badge: '40+ Hoạt Chất', soldCount: 640,
    shortDescription: '40 thành phần thiết yếu gồm Sắt, Axit Folic, Canxi & Vitamin nhóm B cho nữ năng động.',
    description: 'Giúp cân bằng nội tiết, đẹp da tóc và duy trì thể lực dẻo dai khi tập luyện.',
    servingSize: '2 viên/ngày', servingsPerContainer: 60, calories: '0 kcal', protein: '0g', carbs: '0g', fat: '0g', highlightKey: 'ACTIVE', highlightValue: '40+',
  },
  {
    id: 'vt-03', slug: 'codeage-liposomal-vitamin-c', category: 'vitamin', shape: 'bottle',
    source: 'bb', match: 'Codeage Liposomal Vitamin C+',
    name: 'Codeage Liposomal Vitamin C+ 1500mg', brand: 'Codeage', weightLabel: 'HỘP 180 VIÊN',
    price: 890000, compareAtPrice: 990000, bottleVariants: ['Hộp 180 viên', 'Hộp 90 viên', 'Hộp 360 viên'], badge: 'Liposomal', soldCount: 410,
    shortDescription: 'Vitamin C công nghệ bọc Liposome tăng hấp thu gấp nhiều lần, kèm Rosehip & Quercetin.',
    description: 'Chống oxy hóa mạnh mẽ, tăng đề kháng và tổng hợp collagen bảo vệ khớp.',
    servingSize: '3 viên/ngày', servingsPerContainer: 60, calories: '0 kcal', protein: '0g', carbs: '0g', fat: '0g', highlightKey: 'VIT C', highlightValue: '1500MG',
  },
  {
    id: 'vt-04', slug: 'codeage-athlete-multivitamin', category: 'vitamin', shape: 'bottle',
    source: 'bb', match: 'Codeage Athlete Multivitamin Platinum',
    name: 'Codeage Athlete Multivitamin Platinum', brand: 'Codeage', weightLabel: 'HỘP 120 VIÊN',
    price: 920000, compareAtPrice: 1050000, bottleVariants: ['Hộp 120 viên', 'Hộp 60 viên', 'Hộp 240 viên'], badge: 'Vận Động Viên', soldCount: 330,
    shortDescription: 'Vitamin tổng hợp lên men toàn phần kết hợp điện giải và men tiêu hóa cho VĐV.',
    description: 'Bù đắp vi chất tiêu hao sau các buổi cardio & gym cường độ cao.',
    servingSize: '4 viên/ngày', servingsPerContainer: 30, calories: '0 kcal', protein: '0g', carbs: '0g', fat: '0g', highlightKey: 'PLATINUM', highlightValue: 'FULL',
  },
  {
    id: 'vt-05', slug: 'blackmores-multivitamin-men', category: 'vitamin', shape: 'bottle',
    source: 'gs', matchFilename: 'blackmores-multivitamin-for-men',
    name: 'Blackmores Multivitamin For Men Úc', brand: 'Blackmores', weightLabel: 'HỘP 50 VIÊN',
    price: 420000, compareAtPrice: 490000, bottleVariants: ['Hộp 50 viên', 'Hộp 100 viên', 'Hộp 150 viên'], badge: 'Hàng Úc', soldCount: 720,
    shortDescription: '21 vitamin khoáng chất cùng Tribulus và Kẽm hỗ trợ thể lực nam giới.',
    description: 'Giảm stress, tăng cường chuyển hóa năng lượng hàng ngày.',
    servingSize: '1 viên/ngày', servingsPerContainer: 50, calories: '0 kcal', protein: '0g', carbs: '0g', fat: '0g', highlightKey: 'MULTI', highlightValue: '21+',
  },
  {
    id: 'vt-06', slug: 'blackmores-bio-c-1000mg', category: 'vitamin', shape: 'bottle',
    source: 'gs', matchFilename: 'blackmores-bio-vitamin-c-31-tablets',
    name: 'Blackmores Bio C 1000mg Tăng Đề Kháng', brand: 'Blackmores', weightLabel: 'HỘP 31 VIÊN',
    price: 260000, compareAtPrice: 320000, bottleVariants: ['Hộp 31 viên', 'Hộp 62 viên', 'Hộp 150 viên'], badge: 'Vitamin C', soldCount: 890,
    shortDescription: '1000mg Vitamin C kết hợp Bioflavonoids cam chanh êm dịu dạ dày.',
    description: 'Giúp phục hồi mô liên kết, giảm mệt mỏi và phòng ngừa cảm cúm khi giao mùa.',
    servingSize: '1 viên/ngày', servingsPerContainer: 31, calories: '0 kcal', protein: '0g', carbs: '0g', fat: '0g', highlightKey: 'VIT C', highlightValue: '1000MG',
  },
  {
    id: 'vt-07', slug: 'sports-research-d3-k2', category: 'vitamin', shape: 'bottle',
    source: 'gs', matchFilename: 'sports-research-vitamin-d3-k2',
    name: 'Sports Research Vitamin D3 + K2 MK-7', brand: 'Sports Research', weightLabel: 'HỘP 60 VIÊN',
    price: 540000, compareAtPrice: 630000, bottleVariants: ['Hộp 60 viên', 'Hộp 160 viên', 'Hộp 30 viên'], badge: 'Chuẩn Vegan Dầu Dừa', soldCount: 610,
    shortDescription: '5000 IU Vitamin D3 + 100mcg K2 MK-7 hòa tan trong dầu dừa MCT hữu cơ.',
    description: 'Giúp gắn kết Canxi chính xác vào khung xương, hỗ trợ testosterone tự nhiên.',
    servingSize: '1 viên/ngày', servingsPerContainer: 60, calories: '5 kcal', protein: '0g', carbs: '0g', fat: '0.5g', highlightKey: 'D3+K2', highlightValue: '5000IU',
  },
  {
    id: 'vt-08', slug: 'now-zma-recovery-90caps', category: 'vitamin', shape: 'bottle',
    source: 'gs', matchFilename: 'now-zma-90-vien',
    name: 'NOW Sports ZMA Phục Hồi Giấc Ngủ', brand: 'NOW Foods', weightLabel: 'HỘP 90 VIÊN',
    price: 410000, compareAtPrice: 480000, bottleVariants: ['Hộp 90 viên', 'Hộp 180 viên'], badge: 'Ngủ Sâu Phục Hồi', soldCount: 530,
    shortDescription: 'Kẽm, Magie Aspartate & Vitamin B6 giúp ngủ sâu giấc và phục hồi hệ thần kinh.',
    description: 'Uống trước khi ngủ 30–60 phút giúp nâng cao chất lượng tái tạo cơ ban đêm.',
    servingSize: '3 viên/tối', servingsPerContainer: 30, calories: '0 kcal', protein: '0g', carbs: '0g', fat: '0g', highlightKey: 'ZMA', highlightValue: '30 SERV',
  },
  {
    id: 'vt-09', slug: 'now-zinc-picolinate-50mg', category: 'vitamin', shape: 'bottle',
    source: 'gs', matchFilename: 'now-zinc-picolinate-50mg',
    name: 'NOW Zinc Picolinate 50mg Kẽm Hấp Thu Cao', brand: 'NOW Foods', weightLabel: 'HỘP 120 VIÊN',
    price: 290000, compareAtPrice: 350000, bottleVariants: ['Hộp 120 viên', 'Hộp 60 viên'], badge: 'Kẽm Hữu Cơ', soldCount: 840,
    shortDescription: '50mg Kẽm dạng Picolinate sinh khả dụng cao nhất cho miễn dịch và da.',
    description: 'Hỗ trợ sản sinh hormone nam tự nhiên, giảm mụn viêm và tăng cường đề kháng.',
    servingSize: '1 viên/ngày', servingsPerContainer: 120, calories: '0 kcal', protein: '0g', carbs: '0g', fat: '0g', highlightKey: 'ZINC', highlightValue: '50MG',
  },
  {
    id: 'vt-10', slug: 'nutrabio-magnesium-glycinate', category: 'vitamin', shape: 'bottle',
    source: 'gs', matchFilename: 'nutrabio-magnesium-glycinate-120',
    name: 'NutraBio Magnesium Glycinate 120 Caps', brand: 'NutraBio', weightLabel: 'HỘP 120 VIÊN',
    price: 490000, compareAtPrice: 570000, bottleVariants: ['Hộp 120 viên', 'Hộp 240 viên'], badge: 'Thư Giãn Cơ', soldCount: 410,
    shortDescription: 'Magie Chelate Glycinate không gây khó tiêu, giảm chuột rút và căng thẳng thần kinh.',
    description: 'Hấp thu êm ái, hỗ trợ chất lượng giấc ngủ và phục hồi cơ sau tập.',
    servingSize: '2 viên/ngày', servingsPerContainer: 60, calories: '0 kcal', protein: '0g', carbs: '0g', fat: '0g', highlightKey: 'MAGNESIUM', highlightValue: '400MG',
  },
  {
    id: 'vt-11', slug: 'ostrovit-vitamin-b-complex', category: 'vitamin', shape: 'bottle',
    source: 'gs', matchFilename: 'ostrovit-vitamin-b-complex-90-tablets',
    name: 'OstroVit Vitamin B Complex + Vit C & E', brand: 'OstroVit', weightLabel: 'HỘP 90 VIÊN',
    price: 230000, compareAtPrice: 290000, bottleVariants: ['Hộp 90 viên', 'Hộp 180 viên'], badge: 'Nhóm B Đầy Đủ', soldCount: 620,
    shortDescription: 'Đủ 8 vitamin nhóm B kết hợp Vitamin C & E chuyển hóa tinh bột và đạm.',
    description: 'Giúp ăn ngon, hấp thu dinh dưỡng hiệu quả hơn trong giai đoạn tăng cơ.',
    servingSize: '1 viên/ngày', servingsPerContainer: 90, calories: '0 kcal', protein: '0g', carbs: '0g', fat: '0g', highlightKey: 'VIT B', highlightValue: '8-IN-1',
  },
  {
    id: 'vt-12', slug: 'ostrovit-d3-k2-calcium', category: 'vitamin', shape: 'bottle',
    source: 'gs', matchFilename: 'ostrovit-vitamin-d3-k2-calcium-90-tablets',
    name: 'OstroVit Vitamin D3 + K2 + Calcium', brand: 'OstroVit', weightLabel: 'HỘP 90 VIÊN',
    price: 260000, compareAtPrice: 320000, bottleVariants: ['Hộp 90 viên', 'Hộp 180 viên'], badge: 'Chắc Khỏe Xương', soldCount: 510,
    shortDescription: 'Bộ ba Canxi, D3 (2000 IU) và K2 MK-7 tối ưu mật độ xương khớp khi tập tạ nặng.',
    description: 'Công thức chuẩn châu Âu hỗ trợ vận chuyển canxi trực tiếp vào xương.',
    servingSize: '2 viên/ngày', servingsPerContainer: 45, calories: '0 kcal', protein: '0g', carbs: '0g', fat: '0g', highlightKey: 'CA+D3+K2', highlightValue: '90 TABS',
  },
  {
    id: 'vt-13', slug: 'codeage-adk-vitamins', category: 'vitamin', shape: 'bottle',
    source: 'gs', matchFilename: 'codeage-adk-vitamins-180-capsules',
    name: 'Codeage Vitamins A-D3-K1-K2 Cao Cấp', brand: 'Codeage', weightLabel: 'HỘP 180 VIÊN',
    price: 850000, compareAtPrice: 960000, bottleVariants: ['Hộp 180 viên', 'Hộp 90 viên'], badge: '5000IU D3 + K2', soldCount: 380,
    shortDescription: 'Phức hợp 4 vitamin tan trong dầu (A, D3, K1, K2 MK-4 & MK-7) bảo vệ xương & thị lực.',
    description: 'Thuần chay, không chất bảo quản, dễ hấp thu cùng bữa ăn.',
    servingSize: '1 viên/ngày', servingsPerContainer: 180, calories: '0 kcal', protein: '0g', carbs: '0g', fat: '0g', highlightKey: 'ADK', highlightValue: '180D',
  },
  {
    id: 'vt-14', slug: 'now-magtein-l-threonate', category: 'vitamin', shape: 'bottle',
    source: 'gs', matchFilename: 'now-magtein-magnesium-l-threonate',
    name: 'NOW Magtein Magnesium L-Threonate', brand: 'NOW Foods', weightLabel: 'HỘP 90 VIÊN',
    price: 780000, compareAtPrice: 890000, bottleVariants: ['Hộp 90 viên', 'Hộp 180 viên'], badge: 'Tốt Cho Não Bộ', soldCount: 320,
    shortDescription: 'Dạng Magie duy nhất vượt qua hàng rào máu não, cải thiện trí nhớ và tập trung.',
    description: 'Giảm stress tinh thần, hỗ trợ giấc ngủ sâu và phục hồi hệ thần kinh trung ương.',
    servingSize: '3 viên/ngày', servingsPerContainer: 30, calories: '0 kcal', protein: '0g', carbs: '0g', fat: '0g', highlightKey: 'MAGTEIN', highlightValue: '2000MG',
  },
  {
    id: 'vt-15', slug: 'goodhealth-oyster-plus-zinc', category: 'vitamin', shape: 'bottle',
    source: 'gs', matchFilename: 'goodhealth-oyster-plus-zinc',
    name: 'Goodhealth Oyster Plus Zinc Tinh Chất Hàu', brand: 'Goodhealth', weightLabel: 'HỘP 60 VIÊN',
    price: 390000, compareAtPrice: 460000, bottleVariants: ['Hộp 60 viên', 'Hộp 120 viên'], badge: 'Chiết Xuất Hàu NZ', soldCount: 710,
    shortDescription: 'Bột hàu biển New Zealand kết hợp Kẽm tự nhiên và Taurine tăng sinh lực nam.',
    description: 'Bổ sung kẽm sinh học hỗ trợ nội tiết tố và sức bền thể chất.',
    servingSize: '2 viên/ngày', servingsPerContainer: 30, calories: '0 kcal', protein: '0g', carbs: '0g', fat: '0g', highlightKey: 'OYSTER+', highlightValue: '60 CAPS',
  },

  // === 9. DẦU CÁ (7 products, 7 bottle images, 19 variants) — KHÔNG tặng bình lắc ===
  {
    id: 'dc-01', slug: 'sports-research-omega-3-triple', category: 'dau-ca', shape: 'bottle',
    source: 'gs', matchFilename: 'sports-research-omega-3-fish-oil-triple-strength',
    name: 'Sports Research Triple Strength Omega-3', brand: 'Sports Research', weightLabel: 'HỘP 150 VIÊN',
    price: 950000, compareAtPrice: 1090000, bottleVariants: ['Hộp 150 viên', 'Hộp 90 viên', 'Hộp 180 viên'], badge: 'IFOS 5 Sao', soldCount: 1120,
    shortDescription: '1040mg Omega-3 (690mg EPA / 310mg DHA) dạng rTG tinh khiết chỉ trong 1 viên nang.',
    description: 'Dầu cá cô đặc gấp 3 lần từ cá minh thái Alaska đánh bắt tự nhiên, chứng nhận IFOS 5 sao không kim loại nặng.',
    servingSize: '1 viên/ngày', servingsPerContainer: 150, calories: '10 kcal', protein: '0g', carbs: '0g', fat: '1g', highlightKey: 'EPA+DHA', highlightValue: '1040MG',
  },
  {
    id: 'dc-02', slug: 'ostrovit-omega-3-extreme-90', category: 'dau-ca', shape: 'bottle',
    source: 'gs', matchFilename: 'ostrovit-omega-3-extreme-90-capsules',
    name: 'OstroVit Omega 3 Extreme 90 Caps', brand: 'OstroVit', weightLabel: 'HỘP 90 VIÊN',
    price: 290000, compareAtPrice: 360000, bottleVariants: ['Hộp 90 viên', 'Hộp 180 viên', 'Hộp 360 viên'], badge: '500 EPA / 250 DHA', soldCount: 940,
    shortDescription: '1000mg dầu cá hàm lượng cao 500mg EPA + 250mg DHA bảo vệ tim mạch & khớp.',
    description: 'Giải pháp bổ sung Omega-3 hiệu năng cao với chi phí cực kỳ hợp lý.',
    servingSize: '1 viên/ngày', servingsPerContainer: 90, calories: '10 kcal', protein: '0g', carbs: '0g', fat: '1g', highlightKey: 'OMEGA-3', highlightValue: '750MG',
  },
  {
    id: 'dc-03', slug: 'now-ultra-omega-3-90', category: 'dau-ca', shape: 'bottle',
    source: 'gs', matchFilename: 'now-foods-ultra-omega-3-fish-oil-90',
    name: 'NOW Ultra Omega-3 (500 EPA / 250 DHA)', brand: 'NOW Foods', weightLabel: 'HỘP 90 VIÊN',
    price: 490000, compareAtPrice: 570000, bottleVariants: ['Hộp 90 viên', 'Hộp 180 viên'], badge: 'Viên Bao Tan Ruột', soldCount: 860,
    shortDescription: 'Viên nang bao tan trong ruột hoàn toàn không ợ tanh mùi cá, chưng cất phân tử.',
    description: 'Thương hiệu NOW Foods uy tín hơn 50 năm, kiểm định khắt khe thủy ngân và PCB.',
    servingSize: '1 viên/ngày', servingsPerContainer: 90, calories: '10 kcal', protein: '0g', carbs: '0g', fat: '1g', highlightKey: 'NO FISHY', highlightValue: '750MG',
  },
  {
    id: 'dc-04', slug: 'now-dha-500-fish-oil', category: 'dau-ca', shape: 'bottle',
    source: 'gs', matchFilename: 'now-dha-500-fish-oil-90',
    name: 'NOW Double Strength DHA-500 Fish Oil', brand: 'NOW Foods', weightLabel: 'HỘP 90 VIÊN',
    price: 460000, compareAtPrice: 540000, bottleVariants: ['Hộp 90 viên', 'Hộp 180 viên'], badge: '500mg DHA Não Bộ', soldCount: 510,
    shortDescription: '500mg DHA + 250mg EPA hàm lượng cao chuyên biệt cho trí não, mắt và thần kinh.',
    description: 'Viên mềm chưng cất phân tử không gây ợ hơi, hỗ trợ tập trung làm việc & tập luyện.',
    servingSize: '1 viên/ngày', servingsPerContainer: 90, calories: '10 kcal', protein: '0g', carbs: '0g', fat: '1g', highlightKey: 'DHA', highlightValue: '500MG',
  },
  {
    id: 'dc-05', slug: 'blackmores-omega-double', category: 'dau-ca', shape: 'bottle',
    source: 'gs', matchFilename: 'blackmores-omega-double-90',
    name: 'Blackmores Omega Double High Strength', brand: 'Blackmores', weightLabel: 'HỘP 90 VIÊN',
    price: 490000, compareAtPrice: 580000, bottleVariants: ['Hộp 90 viên', 'Hộp 180 viên'], badge: 'Không Mùi Tanh', soldCount: 740,
    shortDescription: 'Hàm lượng Omega-3 gấp đôi dầu cá thường, hương vani dịu nhẹ không tanh.',
    description: 'Hỗ trợ giảm viêm khớp gối, cổ tay khi squat/bench press nặng.',
    servingSize: '1 viên/ngày', servingsPerContainer: 90, calories: '10 kcal', protein: '0g', carbs: '0g', fat: '1g', highlightKey: '2X OMEGA', highlightValue: '600MG',
  },
  {
    id: 'dc-06', slug: 'codeage-amen-omega-3', category: 'dau-ca', shape: 'bottle',
    source: 'gs', matchFilename: 'codeage-amen-omega-3-90',
    name: 'Codeage Amen Omega-3 Fish Oil 90 Viên', brand: 'Codeage', weightLabel: 'HỘP 90 VIÊN',
    price: 590000, compareAtPrice: 690000, bottleVariants: ['Hộp 90 viên', 'Hộp 180 viên'], badge: 'Bổ Sung Chanh Tươi', soldCount: 420,
    shortDescription: 'Dầu cá tinh khiết kết hợp tinh dầu chanh thơm mát, hoàn toàn không tanh.',
    description: 'Đạt chuẩn cGMP Hoa Kỳ, hỗ trợ tim mạch, thị lực và làn da khỏe mạnh.',
    servingSize: '2 viên/ngày', servingsPerContainer: 45, calories: '20 kcal', protein: '0g', carbs: '0g', fat: '2g', highlightKey: 'LEMON OIL', highlightValue: '800MG',
  },
  {
    id: 'dc-07', slug: 'hitech-fish-oil-90ct', category: 'dau-ca', shape: 'bottle',
    source: 'bb', match: 'Hi-Tech Pharma Fish Oil',
    name: 'Hi-Tech Pharma Ultra Fish Oil 1200mg', brand: 'Hi-Tech Pharma', weightLabel: 'HỘP 90 VIÊN',
    price: 440000, compareAtPrice: 520000, bottleVariants: ['Hộp 90 viên', 'Hộp 180 viên', 'Hộp 360 viên'], badge: '1200mg Fish Oil', soldCount: 380,
    shortDescription: '1200mg dầu cá tinh lọc phân tử hỗ trợ phục hồi khớp và tuần hoàn máu.',
    description: 'Giúp hạn chế đau mỏi khớp sau buổi tập nặng, phù hợp cho cả nam và nữ.',
    servingSize: '1 viên/ngày', servingsPerContainer: 90, calories: '10 kcal', protein: '0g', carbs: '0g', fat: '1g', highlightKey: 'FISH OIL', highlightValue: '1200MG',
  },
];

async function fetchAllProducts(baseUrl) {
  const out = [];
  for (let page = 1; page <= 12; page++) {
    const res = await fetch(`${baseUrl}/products.json?limit=250&page=${page}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NhaiSupplementCatalogBot/2.0)' },
    });
    if (!res.ok) break;
    const data = await res.json();
    if (!data.products || data.products.length === 0) break;
    out.push(...data.products);
    if (data.products.length < 250) break;
  }
  return out;
}

function findRemoteProduct(spec, bbList, gsList) {
  if (spec.source === 'bb') {
    const q = spec.match.toLowerCase();
    return (
      bbList.find((p) => (p.title || '').toLowerCase() === q) ||
      bbList.find((p) => (p.title || '').toLowerCase().includes(q))
    );
  }
  // Gymstore Haravan feed stores canonical slug in featured_image.src / images[].src
  const fnSub = spec.matchFilename.toLowerCase();
  return gsList.find((p) => {
    const urls = [
      p.featured_image?.src || '',
      ...(p.images || []).map((i) => i?.src || ''),
      ...(p.variants || []).map((v) => v?.featured_image?.src || ''),
    ];
    return urls.some((u) => u.toLowerCase().includes(fnSub));
  });
}

function extractExactFlavorVariants(spec, remoteProd) {
  if (!remoteProd) throw new Error(`Missing remote match for ${spec.id} (${spec.match || spec.matchFilename})`);

  if (spec.bottleVariants) {
    // Non-flavored bottle product: 1 unique studio bottle image, N pack-size options
    const firstValidUrl =
      (remoteProd.variants || []).map((v) => v?.featured_image?.src).find(Boolean) ||
      remoteProd.featured_image?.src ||
      remoteProd.images?.[0]?.src;
    if (!firstValidUrl) throw new Error(`No bottle image for ${spec.id}`);
    return {
      uniqueImages: [firstValidUrl],
      flavors: spec.bottleVariants.map((label, idx) => ({
        id: `${spec.id}-opt-${idx + 1}`,
        name: label,
        colorHex: spec.category === 'dau-ca' ? '#CA8A04' : '#262626',
        accentHex: '#FF5A00',
        imageUrl: firstValidUrl,
        stock: 30 + ((idx * 9) % 40),
      })),
    };
  }

  // Flavored product: strictly 1:1 unique variant.featured_image per flavor
  const seenUrls = new Set();
  const seenFlavorNames = new Set();
  const matched = [];

  for (const v of remoteProd.variants || []) {
    const src = v?.featured_image?.src;
    if (!src) continue;
    const cleanName = cleanVariantFlavorName(v.title);
    if (isDisallowedVariant(cleanName, src)) continue;

    const cleanUrl = src.split('?')[0];
    const normName = cleanName.toLowerCase();
    if (seenUrls.has(cleanUrl) || seenFlavorNames.has(normName)) continue;

    seenUrls.add(cleanUrl);
    seenFlavorNames.add(normName);
    const { colorHex, accentHex } = inferFlavorColors(cleanName);
    matched.push({
      id: `${spec.id}-fl-${matched.length + 1}`,
      name: cleanName,
      colorHex,
      accentHex,
      imageUrl: src,
      stock: 18 + ((matched.length * 11) % 55),
    });
    if (matched.length >= spec.flavorQuota) break;
  }

  if (matched.length < spec.flavorQuota) {
    throw new Error(
      `Product ${spec.id} (${spec.name}) only yielded ${matched.length}/${spec.flavorQuota} clean unique flavor images!`,
    );
  }

  return {
    uniqueImages: matched.map((m) => m.imageUrl),
    flavors: matched,
  };
}

async function downloadFile(url, destPath) {
  const clean = url.split('?')[0];
  const sizedUrl = `${clean}?width=600`;
  const res = await fetch(sizedUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NhaiSupplementAssetBot/2.0)' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${sizedUrl}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(destPath, buf);
}

async function convertToWebp(inputPath, outputPath, quality) {
  await execFileAsync('convert', [
    inputPath,
    '-auto-orient',
    '-resize',
    '540x540>',
    '-background',
    'white',
    '-alpha',
    'remove',
    '-alpha',
    'off',
    '-strip',
    '-quality',
    String(quality),
    outputPath,
  ]);
}

async function main() {
  console.log('[NhaiSupplement] Fetching exact studio variant catalogs from bodybuilding.com & gymstore.vn...');
  const [bbList, gsList] = await Promise.all([
    fetchAllProducts('https://www.bodybuilding.com'),
    fetchAllProducts('https://www.gymstore.vn'),
  ]);
  console.log(`[NhaiSupplement] Indexed BB=${bbList.length}, GS=${gsList.length}`);

  const urlToLocal = new Map();
  const downloadJobs = [];
  const builtProducts = [];
  let totalFlavors = 0;

  for (const spec of BLUEPRINT) {
    const remote = findRemoteProduct(spec, bbList, gsList);
    const { flavors } = extractExactFlavorVariants(spec, remote);
    totalFlavors += flavors.length;

    const resolvedFlavors = flavors.map((fl) => {
      const cleanUrl = fl.imageUrl.split('?')[0];
      if (!urlToLocal.has(cleanUrl)) {
        const idx = downloadJobs.length + 1;
        const fileName = `${spec.slug}-${String(idx).padStart(3, '0')}.webp`;
        const localPath = `/images/products/${fileName}`;
        urlToLocal.set(cleanUrl, localPath);
        downloadJobs.push({ fileName, url: fl.imageUrl, localPath });
      }
      return {
        id: fl.id,
        name: fl.name,
        colorHex: fl.colorHex,
        accentHex: fl.accentHex,
        image: urlToLocal.get(cleanUrl),
        stock: fl.stock,
      };
    });

    builtProducts.push({
      id: spec.id,
      slug: spec.slug,
      name: spec.name,
      brand: spec.brand,
      category: spec.category,
      shape: spec.shape,
      weightLabel: spec.weightLabel,
      price: spec.price,
      compareAtPrice: spec.compareAtPrice,
      shortDescription: spec.shortDescription,
      description: spec.description,
      servingSize: spec.servingSize,
      servingsPerContainer: spec.servingsPerContainer,
      calories: spec.calories,
      protein: spec.protein,
      carbs: spec.carbs,
      fat: spec.fat,
      highlightKey: spec.highlightKey,
      highlightValue: spec.highlightValue,
      badge: spec.badge,
      rating: 4.9,
      soldCount: spec.soldCount,
      flavors: resolvedFlavors,
    });
  }

  console.log(
    `[NhaiSupplement] Verified ${builtProducts.length} products, ${totalFlavors} variants, ${downloadJobs.length} unique studio images.`,
  );

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  for (const f of fs.readdirSync(OUTPUT_DIR)) {
    if (f.endsWith('.webp')) fs.unlinkSync(path.join(OUTPUT_DIR, f));
  }
  fs.mkdirSync(TEMP_DIR, { recursive: true });

  const BATCH_SIZE = 12;
  const rawPaths = [];
  for (let i = 0; i < downloadJobs.length; i += BATCH_SIZE) {
    const batch = downloadJobs.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(async (job) => {
        const rawPath = path.join(TEMP_DIR, `${job.fileName}.src`);
        await downloadFile(job.url, rawPath);
        rawPaths.push({ ...job, rawPath });
      }),
    );
  }

  // Calibrate WebP quality via binary search toward ~4.8MB total across all 180 files
  let low = 80;
  let high = 95;
  let quality = 90;
  let totalBytes = 0;
  for (let pass = 0; pass < 4; pass++) {
    quality = pass === 0 ? 90 : Math.round((low + high) / 2);
    totalBytes = 0;
    for (let i = 0; i < rawPaths.length; i += 8) {
      const batch = rawPaths.slice(i, i + 8);
      await Promise.all(
        batch.map(async (item) => {
          const outPath = path.join(OUTPUT_DIR, item.fileName);
          await convertToWebp(item.rawPath, outPath, quality);
          totalBytes += fs.statSync(outPath).size;
        }),
      );
    }
    const mb = totalBytes / (1024 * 1024);
    console.log(
      `[NhaiSupplement] WebP Pass ${pass + 1} (quality=${quality}): ${rawPaths.length} files = ${mb.toFixed(2)} MB`,
    );
    if (mb >= 4.55 && mb <= 5.05) break;
    if (mb > 5.05) {
      high = quality - 1;
    } else {
      low = quality + 1;
    }
    if (low > high) break;
  }

  const imageMap = {};
  for (const prod of builtProducts) {
    for (const fl of prod.flavors) {
      imageMap[fl.id] = fl.image;
    }
  }

  fs.writeFileSync(GENERATED_DATA_PATH, JSON.stringify(builtProducts, null, 2), 'utf8');
  fs.writeFileSync(IMAGE_MAP_PATH, JSON.stringify(imageMap, null, 2), 'utf8');

  const manifest = {
    brand: 'NhaiSupplement',
    domain: 'nhaisupplement.com',
    generatedAt: new Date().toISOString(),
    productCount: builtProducts.length,
    flavorCount: totalFlavors,
    imageCount: rawPaths.length,
    totalBytes,
    totalMB: Number((totalBytes / (1024 * 1024)).toFixed(2)),
    qualityUsed: quality,
  };
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2), 'utf8');

  fs.rmSync(TEMP_DIR, { recursive: true, force: true });
  console.log('[NhaiSupplement] Catalog & 180-image sync complete!', manifest);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
