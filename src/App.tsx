import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  ArrowUp,
  Box,
  ChevronLeft,
  ChevronRight,
  Gift,
  MapPin,
  Menu,
  MessageCircle,
  Phone,
  Search,
  ShoppingBag,
  Truck,
  X,
} from 'lucide-react';
import {
  BRAND_INFO,
  CATALOG_STATS,
  CATEGORIES,
  PRODUCTS,
  SHAKER_OPTIONS,
  formatVND,
} from './data/catalog';
import type {
  CartItem,
  CategorySlug,
  Product,
  ProductFlavor,
} from './types/product';
import ProductCard from './components/ProductCard';
import ProductDetailModal from './components/ProductDetailModal';
import Product3DViewer, { type ViewerMode } from './components/Product3DViewer';
import CartDrawer from './components/CartDrawer';
import CheckoutPage from './components/CheckoutPage';
import SupplementConsultAndFaq from './components/SupplementConsultAndFaq';
import InfoPoliciesContact from './components/InfoPoliciesContact';
import { withBasePath } from './utils/assetPath';

type SortOption = 'popular' | 'price-asc' | 'price-desc' | 'flavors-desc';
type PageRoute = 'home' | 'checkout';

const CART_STORAGE_KEY = 'nhaisupplement_cart_v1';
const PREFS_STORAGE_KEY = 'nhaisupplement_prefs_v1';

interface StoredCartRow {
  productId: string;
  flavorId: string;
  quantity: number;
}

interface StoredPrefs {
  isFirstOrder: boolean;
  shakerId: string;
  voucherCode: string;
}

const HERO_SLIDES = [
  {
    src: BRAND_INFO.heroImage,
    alt: 'NhaiSupplement Whey Protein và Bình Lắc Studio',
    tag: 'WHEY ISOLATE & HYDROLYZED',
    caption: 'Tặng bình lắc 0đ cho sản phẩm dạng bột pha với nước',
  },
  {
    src: withBasePath('/src/assets/images/category_powder_tub_1795535036984.jpg'),
    alt: 'Thực phẩm bổ sung Whey, Pre-Workout và Creatine NhaiSupplement',
    tag: '212 HƯƠNG VỊ ĐỔI ẢNH 1:1',
    caption: 'Chọn từng hương vị — hiển thị đúng ảnh thực tế của vị đó',
  },
  {
    src: withBasePath('/src/assets/images/category_vitamin_softgel_1795535039343.jpg'),
    alt: 'Vitamin, Dầu cá Omega-3 và viên uống hỗ trợ sức khỏe',
    tag: 'VITAMIN & DẦU CÁ CHÍNH HÃNG',
    caption: 'Kho Hà Nội giao hỏa tốc 2–4h · Ship toàn quốc Freeship đơn đầu',
  },
];

const BENEFIT_TICKER_ITEMS = [
  'KHO HÀ NỘI · GIAO NHANH TOÀN QUỐC',
  'FREESHIP CHO ĐƠN HÀNG ĐẦU TIÊN',
  'TẶNG BÌNH LẮC 0Đ CHO SẢN PHẨM DẠNG BỘT PHA NƯỚC',
  '62 SẢN PHẨM · 212 HƯƠNG VỊ ĐỔI ẢNH THỰC TẾ 1:1',
  'MÃ NHAI10 GIẢM 10% · NHAI100K GIẢM 100.000Đ',
  'TRÌNH XEM 3D XOAY 360° · AR CAMERA · VR STEREO',
  'ĐỔI TRẢ MIỄN PHÍ 7 NGÀY · KIỂM TRA SEAL TRƯỚC KHI NHẬN',
];

function loadInitialCart(): CartItem[] {
  try {
    const raw = window.localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredCartRow[];
    if (!Array.isArray(parsed)) return [];
    const hydrated: CartItem[] = [];
    for (const row of parsed) {
      const product = PRODUCTS.find((p) => p.id === row.productId);
      if (!product) continue;
      const flavor =
        product.flavors.find((f) => f.id === row.flavorId) ?? product.flavors[0];
      if (!flavor) continue;
      const quantity = Math.max(1, Math.min(99, Number(row.quantity) || 1));
      hydrated.push({
        cartKey: `${product.id}__${flavor.id}`,
        product,
        selectedFlavor: flavor,
        quantity,
      });
    }
    return hydrated;
  } catch {
    return [];
  }
}

function loadInitialPrefs(): StoredPrefs {
  const defaults: StoredPrefs = {
    isFirstOrder: true,
    shakerId: SHAKER_OPTIONS[0].id,
    voucherCode: '',
  };
  try {
    const raw = window.localStorage.getItem(PREFS_STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<StoredPrefs>;
    return {
      isFirstOrder: typeof parsed.isFirstOrder === 'boolean' ? parsed.isFirstOrder : true,
      shakerId: SHAKER_OPTIONS.some((s) => s.id === parsed.shakerId)
        ? (parsed.shakerId as string)
        : defaults.shakerId,
      voucherCode: typeof parsed.voucherCode === 'string' ? parsed.voucherCode : '',
    };
  } catch {
    return defaults;
  }
}

function detectInitialRoute(): PageRoute {
  if (typeof window === 'undefined') return 'home';
  return window.location.pathname.endsWith('/thanh-toan') ? 'checkout' : 'home';
}

export default function App() {
  const [pageRoute, setPageRoute] = useState<PageRoute>(detectInitialRoute);
  const [selectedCategory, setSelectedCategory] = useState<'all' | CategorySlug>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('popular');
  const [onlyPowderShaker, setOnlyPowderShaker] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Hero slideshow & scroll-to-top progress ring
  const [heroSlideIdx, setHeroSlideIdx] = useState(0);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [showScrollTop, setShowScrollTop] = useState(false);

  // Product Detail Modal State
  const [detailState, setDetailState] = useState<{
    product: Product;
    flavor: ProductFlavor;
    tab: 'image' | ViewerMode;
  } | null>(null);

  // Interactive 3D Showcase Featured Product & Flavor
  const [showcaseProductId, setShowcaseProductId] = useState<string>(PRODUCTS[0].id);
  const showcaseProduct = useMemo(
    () => PRODUCTS.find((p) => p.id === showcaseProductId) ?? PRODUCTS[0],
    [showcaseProductId],
  );
  const [showcaseFlavorId, setShowcaseFlavorId] = useState<string>(PRODUCTS[0].flavors[0].id);
  const showcaseFlavor = useMemo(
    () =>
      showcaseProduct.flavors.find((f) => f.id === showcaseFlavorId) ??
      showcaseProduct.flavors[0],
    [showcaseProduct, showcaseFlavorId],
  );

  // Persistent Cart & Checkout Preferences State
  const [cartItems, setCartItems] = useState<CartItem[]>(loadInitialCart);
  const [prefs, setPrefs] = useState<StoredPrefs>(loadInitialPrefs);
  const [cartOpen, setCartOpen] = useState(false);
  const [toastText, setToastText] = useState<string | null>(null);

  // Sync cart items to localStorage
  useEffect(() => {
    try {
      const compact: StoredCartRow[] = cartItems.map((item) => ({
        productId: item.product.id,
        flavorId: item.selectedFlavor.id,
        quantity: item.quantity,
      }));
      window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(compact));
    } catch {
      // Ignore storage quota errors
    }
  }, [cartItems]);

  // Sync checkout prefs to localStorage
  useEffect(() => {
    try {
      window.localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(prefs));
    } catch {
      // Ignore storage quota errors
    }
  }, [prefs]);

  // Browser back/forward route sync
  useEffect(() => {
    const onPopState = () => {
      setPageRoute(detectInitialRoute());
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // Hero slideshow auto-rotate (4.5s)
  useEffect(() => {
    if (pageRoute !== 'home') return;
    const timer = window.setInterval(() => {
      setHeroSlideIdx((prev) => (prev + 1) % HERO_SLIDES.length);
    }, 4500);
    return () => window.clearInterval(timer);
  }, [pageRoute]);

  // Scroll-to-top button + circular reading progress ring
  useEffect(() => {
    const updateScroll = () => {
      const y = window.scrollY || 0;
      const docHeight =
        document.documentElement.scrollHeight - document.documentElement.clientHeight;
      const pct = docHeight > 0 ? Math.min(100, Math.max(0, (y / docHeight) * 100)) : 0;
      setScrollProgress(pct);
      setShowScrollTop(y > 250);
    };
    updateScroll();
    window.addEventListener('scroll', updateScroll, { passive: true });
    return () => window.removeEventListener('scroll', updateScroll);
  }, [pageRoute]);

  const navigateToCheckout = useCallback(() => {
    setCartOpen(false);
    setMobileMenuOpen(false);
    setPageRoute('checkout');
    try {
      if (!window.location.pathname.endsWith('/thanh-toan')) {
        window.history.pushState({}, '', '/thanh-toan');
      }
    } catch {
      // Ignore history restriction
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const navigateToHome = useCallback((sectionHash?: string) => {
    setMobileMenuOpen(false);
    setPageRoute('home');
    try {
      if (window.location.pathname.endsWith('/thanh-toan')) {
        window.history.pushState({}, '', sectionHash ? `/${sectionHash}` : '/');
      }
    } catch {
      // Ignore history restriction
    }
    if (sectionHash) {
      window.setTimeout(() => {
        const el = document.querySelector(sectionHash);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth' });
        }
      }, 60);
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, []);

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = PRODUCTS.filter((product) => {
      if (selectedCategory !== 'all' && product.category !== selectedCategory) return false;
      if (onlyPowderShaker && !product.isWaterMixPowder) return false;
      if (!q) return true;
      const matchesBasic =
        product.name.toLowerCase().includes(q) ||
        product.brand.toLowerCase().includes(q) ||
        product.categoryName.toLowerCase().includes(q);
      const matchesFlavor = product.flavors.some((f) => f.name.toLowerCase().includes(q));
      return matchesBasic || matchesFlavor;
    });

    return [...list].sort((a, b) => {
      if (sortBy === 'price-asc') return a.price - b.price;
      if (sortBy === 'price-desc') return b.price - a.price;
      if (sortBy === 'flavors-desc') return b.flavors.length - a.flavors.length;
      return b.soldCount - a.soldCount;
    });
  }, [selectedCategory, searchQuery, sortBy, onlyPowderShaker]);

  const totalCartQty = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  const handleAddToCart = (product: Product, flavor: ProductFlavor, quantity = 1) => {
    const cartKey = `${product.id}__${flavor.id}`;
    setCartItems((prev) => {
      const existing = prev.find((i) => i.cartKey === cartKey);
      if (existing) {
        return prev.map((i) =>
          i.cartKey === cartKey ? { ...i, quantity: i.quantity + quantity } : i,
        );
      }
      return [...prev, { cartKey, product, selectedFlavor: flavor, quantity }];
    });
    const nextToast = `Đã thêm ${product.name} (${flavor.name}) vào giỏ`;
    setToastText(nextToast);
    window.setTimeout(() => {
      setToastText((curr) => (curr === nextToast ? null : curr));
    }, 2600);
  };

  const handleUpdateQty = (cartKey: string, nextQty: number) => {
    if (nextQty <= 0) {
      setCartItems((prev) => prev.filter((i) => i.cartKey !== cartKey));
      return;
    }
    setCartItems((prev) =>
      prev.map((i) => (i.cartKey === cartKey ? { ...i, quantity: nextQty } : i)),
    );
  };

  const handleRemoveItem = (cartKey: string) => {
    setCartItems((prev) => prev.filter((i) => i.cartKey !== cartKey));
  };

  const handleShowcaseProductChange = (nextProductId: string) => {
    const nextProd = PRODUCTS.find((p) => p.id === nextProductId) ?? PRODUCTS[0];
    setShowcaseProductId(nextProd.id);
    setShowcaseFlavorId(nextProd.flavors[0].id);
  };

  const activeSlide = HERO_SLIDES[heroSlideIdx];

  return (
    <div className="min-h-screen bg-white text-neutral-950">
      {/* Slim Announcement Bar (<= 40px) */}
      <div className="border-b border-neutral-800 bg-neutral-950 text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-2 text-[11px] font-medium sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 overflow-x-auto whitespace-nowrap">
            <span className="font-bold text-[#FF5A00]">KHO HÀ NỘI · SHIP TOÀN QUỐC</span>
            <span aria-hidden="true" className="text-neutral-600">|</span>
            <span>Freeship cho đơn hàng đầu tiên</span>
            <span aria-hidden="true" className="hidden text-neutral-600 sm:inline">|</span>
            <span className="hidden sm:inline">Tặng bình lắc cho sản phẩm dạng bột pha với nước</span>
          </div>
          <a
            href={BRAND_INFO.zaloUrl}
            target="_blank"
            rel="noreferrer"
            className="hidden shrink-0 items-center gap-1 whitespace-nowrap font-mono font-semibold text-[#FF5A00] hover:underline md:inline-flex"
          >
            Zalo {BRAND_INFO.phone}
          </a>
        </div>
      </div>

      {/* 3-Zone Header Navigation */}
      <header className="sticky top-0 z-40 border-b-2 border-neutral-950 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          {/* Zone 1: Logo + Single-line Brand Wordmark */}
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              navigateToHome();
            }}
            className="flex shrink-0 items-center gap-2.5 whitespace-nowrap focus-visible:outline-2 focus-visible:outline-[#FF5A00]"
          >
            <img
              src={BRAND_INFO.logoPath}
              alt="Logo NhaiSupplement"
              className="h-10 w-10 border border-neutral-950 bg-black object-cover"
            />
            <span className="font-display text-2xl font-extrabold uppercase tracking-tight text-neutral-950">
              Nhai<span className="text-[#FF5A00]">Supplement</span>
            </span>
          </a>

          {/* Zone 2: Concise Single-Line Navigation Links */}
          <nav className="hidden items-center gap-5 text-sm font-semibold text-neutral-700 lg:flex">
            <a
              href="#san-pham"
              onClick={(e) => {
                if (pageRoute === 'checkout') {
                  e.preventDefault();
                  navigateToHome('#san-pham');
                }
              }}
              className="shrink-0 whitespace-nowrap transition-colors hover:text-[#FF5A00]"
            >
              Sản phẩm
            </a>
            <a
              href="#trinh-xem-3d"
              onClick={(e) => {
                if (pageRoute === 'checkout') {
                  e.preventDefault();
                  navigateToHome('#trinh-xem-3d');
                }
              }}
              className="shrink-0 whitespace-nowrap transition-colors hover:text-[#FF5A00]"
            >
              Xem 3D · AR · VR
            </a>
            <a
              href="#tu-van"
              onClick={(e) => {
                if (pageRoute === 'checkout') {
                  e.preventDefault();
                  navigateToHome('#tu-van');
                }
              }}
              className="shrink-0 whitespace-nowrap transition-colors hover:text-[#FF5A00]"
            >
              Tư vấn
            </a>
            <a
              href="#hoi-dap"
              onClick={(e) => {
                if (pageRoute === 'checkout') {
                  e.preventDefault();
                  navigateToHome('#hoi-dap');
                }
              }}
              className="shrink-0 whitespace-nowrap transition-colors hover:text-[#FF5A00]"
            >
              Hỏi đáp
            </a>
            <a
              href="#chinh-sach"
              onClick={(e) => {
                if (pageRoute === 'checkout') {
                  e.preventDefault();
                  navigateToHome('#chinh-sach');
                }
              }}
              className="shrink-0 whitespace-nowrap transition-colors hover:text-[#FF5A00]"
            >
              Chính sách
            </a>
            <a
              href="#lien-he"
              onClick={(e) => {
                if (pageRoute === 'checkout') {
                  e.preventDefault();
                  navigateToHome('#lien-he');
                }
              }}
              className="shrink-0 whitespace-nowrap transition-colors hover:text-[#FF5A00]"
            >
              Liên hệ
            </a>
          </nav>

          {/* Zone 3: Cart & Checkout Action */}
          <div className="flex shrink-0 items-center gap-2">
            {pageRoute === 'home' && totalCartQty > 0 && (
              <button
                type="button"
                onClick={navigateToCheckout}
                className="hidden h-10 items-center gap-1.5 border-2 border-[#FF5A00] bg-white px-3.5 text-xs font-bold uppercase tracking-wide text-[#FF5A00] transition-colors hover:bg-[#FF5A00] hover:text-white whitespace-nowrap sm:inline-flex"
              >
                <span>Thanh toán</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            )}

            <button
              type="button"
              onClick={() => setCartOpen(true)}
              className="flex h-10 shrink-0 items-center gap-2 whitespace-nowrap bg-neutral-950 px-4 text-xs font-bold uppercase tracking-wide text-white transition-colors hover:bg-[#FF5A00]"
            >
              <ShoppingBag className="h-4 w-4 text-[#FF5A00]" />
              <span>Giỏ hàng</span>
              <span className="bg-[#FF5A00] px-1.5 py-0.5 font-mono text-[11px] font-bold text-white tabular-nums">
                {totalCartQty}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-label="Mở menu điều hướng"
              className="flex h-10 w-10 items-center justify-center border border-neutral-950 lg:hidden"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Nav Drawer */}
        {mobileMenuOpen && (
          <nav className="border-t border-neutral-200 bg-white px-4 py-3 lg:hidden">
            <div className="flex flex-col gap-2 text-sm font-semibold">
              <a
                href="#san-pham"
                onClick={(e) => {
                  e.preventDefault();
                  navigateToHome('#san-pham');
                }}
                className="py-1.5"
              >
                Sản phẩm ({CATALOG_STATS.totalProducts})
              </a>
              <a
                href="#trinh-xem-3d"
                onClick={(e) => {
                  e.preventDefault();
                  navigateToHome('#trinh-xem-3d');
                }}
                className="py-1.5"
              >
                Xem 3D · AR · VR
              </a>
              <a
                href="#tu-van"
                onClick={(e) => {
                  e.preventDefault();
                  navigateToHome('#tu-van');
                }}
                className="py-1.5"
              >
                Tư vấn lộ trình
              </a>
              <a
                href="#hoi-dap"
                onClick={(e) => {
                  e.preventDefault();
                  navigateToHome('#hoi-dap');
                }}
                className="py-1.5"
              >
                Câu hỏi thường gặp
              </a>
              <a
                href="#chinh-sach"
                onClick={(e) => {
                  e.preventDefault();
                  navigateToHome('#chinh-sach');
                }}
                className="py-1.5"
              >
                Chính sách &amp; Đổi trả
              </a>
              <a
                href="#lien-he"
                onClick={(e) => {
                  e.preventDefault();
                  navigateToHome('#lien-he');
                }}
                className="py-1.5"
              >
                Liên hệ trực tiếp ({BRAND_INFO.phone})
              </a>
              {totalCartQty > 0 && (
                <button
                  type="button"
                  onClick={navigateToCheckout}
                  className="mt-1 flex items-center justify-between bg-[#FF5A00] px-3 py-2 text-left text-xs font-bold uppercase text-white"
                >
                  <span>Đến trang thanh toán (/thanh-toan)</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              )}
            </div>
          </nav>
        )}
      </header>

      {/* Main Content or Dedicated Checkout Page (/thanh-toan) */}
      {pageRoute === 'checkout' ? (
        <main id="top">
          <CheckoutPage
            items={cartItems}
            isFirstOrder={prefs.isFirstOrder}
            onChangeFirstOrder={(next) =>
              setPrefs((prev) => ({ ...prev, isFirstOrder: next }))
            }
            shakerId={prefs.shakerId}
            onChangeShakerId={(next) =>
              setPrefs((prev) => ({ ...prev, shakerId: next }))
            }
            voucherCode={prefs.voucherCode}
            onChangeVoucherCode={(next) =>
              setPrefs((prev) => ({ ...prev, voucherCode: next }))
            }
            onBackToShop={() => navigateToHome('#san-pham')}
            onClearCart={() => setCartItems([])}
          />
        </main>
      ) : (
        <main id="top">
          {/* Hero Split Section with Studio Slideshow */}
          <section className="border-b border-neutral-800 bg-neutral-950 text-white">
            <div className="mx-auto grid max-w-7xl grid-cols-1 items-stretch lg:grid-cols-12">
              {/* Hero Copy */}
              <div className="flex flex-col justify-between p-6 sm:p-10 lg:col-span-6 lg:p-12">
                <div>
                  <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-neutral-300">
                    <span className="font-mono font-bold text-[#FF5A00]">
                      {BRAND_INFO.domain}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>Kho Hà Nội · Ship toàn quốc</span>
                  </div>

                  <h1 className="mt-4 font-display text-4xl font-extrabold uppercase leading-[1.02] tracking-tight text-white [text-wrap:balance] sm:text-5xl lg:text-6xl">
                    Thực Phẩm Bổ Sung{' '}
                    <span className="text-[#FF5A00]">Hiệu Năng Cao</span>
                  </h1>

                  <p className="mt-4 max-w-xl text-sm leading-relaxed text-neutral-300 sm:text-base">
                    Hệ thống {CATALOG_STATS.totalProducts} sản phẩm qua 9 danh mục và{' '}
                    {CATALOG_STATS.totalFlavors} hương vị. Đổi ảnh 1:1 chuẩn theo từng vị, hỗ trợ
                    xem 3D, AR Camera &amp; VR cùng mã ưu đãi ngay tại giỏ.
                  </p>

                  {/* Primary CTAs */}
                  <div className="mt-7 flex flex-wrap items-center gap-3">
                    <a
                      href="#san-pham"
                      className="inline-flex h-12 items-center gap-2 whitespace-nowrap bg-[#FF5A00] px-6 text-xs font-bold uppercase tracking-wider text-white transition-colors hover:bg-white hover:text-neutral-950"
                    >
                      <span>Mua sắm {CATALOG_STATS.totalProducts} sản phẩm</span>
                      <ArrowRight className="h-4 w-4" />
                    </a>
                    <a
                      href="#trinh-xem-3d"
                      className="inline-flex h-12 items-center gap-2 whitespace-nowrap border border-neutral-600 px-5 text-xs font-bold uppercase tracking-wider text-white transition-colors hover:border-[#FF5A00] hover:text-[#FF5A00]"
                    >
                      <Box className="h-4 w-4" />
                      <span>Thử 3D · AR · VR</span>
                    </a>
                  </div>
                </div>

                {/* Clean Metric Strip */}
                <div className="mt-8 grid grid-cols-2 gap-4 border-t border-neutral-800 pt-6 sm:grid-cols-4">
                  <div>
                    <span className="block font-mono text-2xl font-extrabold text-[#FF5A00] tabular-nums">
                      {CATALOG_STATS.totalProducts}
                    </span>
                    <span className="text-xs text-neutral-400">Sản phẩm · 9 nhóm</span>
                  </div>
                  <div>
                    <span className="block font-mono text-2xl font-extrabold text-white tabular-nums">
                      {CATALOG_STATS.totalFlavors}
                    </span>
                    <span className="text-xs text-neutral-400">Hương vị đổi ảnh</span>
                  </div>
                  <div>
                    <span className="block font-mono text-2xl font-extrabold text-white tabular-nums">
                      0đ
                    </span>
                    <span className="text-xs text-neutral-400">Freeship đơn đầu</span>
                  </div>
                  <div>
                    <span className="block font-mono text-2xl font-extrabold text-[#FF5A00] tabular-nums">
                      700ml
                    </span>
                    <span className="text-xs text-neutral-400">Tặng bình lắc bột</span>
                  </div>
                </div>
              </div>

              {/* Hero Studio Slideshow (ported slideshow concept from MiuGo Pets) */}
              <div className="relative min-h-[300px] border-t border-neutral-800 lg:col-span-6 lg:border-l lg:border-t-0">
                <img
                  key={activeSlide.src}
                  src={activeSlide.src}
                  alt={activeSlide.alt}
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-cover transition-opacity duration-500"
                />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-transparent" />

                {/* Top Slide Controls */}
                <div className="absolute right-4 top-4 flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      setHeroSlideIdx(
                        (prev) => (prev - 1 + HERO_SLIDES.length) % HERO_SLIDES.length,
                      )
                    }
                    aria-label="Ảnh trước"
                    className="flex h-8 w-8 items-center justify-center border border-white/25 bg-black/70 text-white hover:border-[#FF5A00] hover:bg-[#FF5A00]"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setHeroSlideIdx((prev) => (prev + 1) % HERO_SLIDES.length)
                    }
                    aria-label="Ảnh tiếp theo"
                    className="flex h-8 w-8 items-center justify-center border border-white/25 bg-black/70 text-white hover:border-[#FF5A00] hover:bg-[#FF5A00]"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>

                <div className="absolute bottom-4 left-4 right-4 border border-white/15 bg-black/85 px-4 py-3 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-white">
                      <Gift className="h-4 w-4 shrink-0 text-[#FF5A00]" />
                      <span>{activeSlide.caption}</span>
                    </div>
                    <span className="font-mono font-bold text-[#FF5A00]">
                      {activeSlide.tag}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-1.5">
                    {HERO_SLIDES.map((s, idx) => (
                      <button
                        key={s.tag}
                        type="button"
                        onClick={() => setHeroSlideIdx(idx)}
                        aria-label={`Slide ${idx + 1}`}
                        className={`h-1.5 transition-all ${
                          heroSlideIdx === idx ? 'w-6 bg-[#FF5A00]' : 'w-2.5 bg-neutral-600'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Horizontal Benefit Ticker Strip (ported from MiuGo Pets .tick strip) */}
          <div className="overflow-hidden border-b-2 border-neutral-950 bg-[#FF5A00] py-2 text-white">
            <div className="nhai-ticker-track">
              {[...BENEFIT_TICKER_ITEMS, ...BENEFIT_TICKER_ITEMS].map((item, idx) => (
                <span
                  key={`${item}-${idx}`}
                  className="inline-flex items-center gap-4 px-5 text-[11px] font-extrabold uppercase tracking-wider whitespace-nowrap"
                >
                  <span>{item}</span>
                  <span aria-hidden="true" className="text-black/40">
                    ✦
                  </span>
                </span>
              ))}
            </div>
          </div>

          {/* Catalog Section: Search, 9 Categories, Dynamic Flavor Cards */}
          <section id="san-pham" className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
            {/* Header & Search Toolbar */}
            <div className="flex flex-col gap-4 border-b border-neutral-200 pb-6 md:flex-row md:items-end md:justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-[#FF5A00]">
                  Danh mục đầy đủ
                </span>
                <h2 className="mt-1 font-display text-3xl font-extrabold uppercase tracking-tight text-neutral-950 sm:text-4xl">
                  {CATALOG_STATS.totalProducts} Sản Phẩm · {CATALOG_STATS.totalFlavors} Hương Vị
                </h2>
                <p className="mt-1 text-xs text-neutral-600">
                  Bấm vào bất kỳ nút hương vị nào ngay trên thẻ sản phẩm để đổi hình ảnh thực tế của
                  vị đó.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <div className="relative flex-1 sm:w-72 sm:flex-initial">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Tìm tên sản phẩm, vị Chocolate, Whey..."
                    className="h-10 w-full border border-neutral-300 bg-white pl-9 pr-3 text-xs font-medium text-neutral-950 focus:border-[#FF5A00] focus:outline-none"
                  />
                </div>

                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  aria-label="Sắp xếp sản phẩm"
                  className="h-10 border border-neutral-300 bg-white px-3 text-xs font-semibold text-neutral-950 focus:border-[#FF5A00] focus:outline-none"
                >
                  <option value="popular">Bán chạy nhất</option>
                  <option value="price-asc">Giá: Thấp → Cao</option>
                  <option value="price-desc">Giá: Cao → Thấp</option>
                  <option value="flavors-desc">Nhiều hương vị nhất</option>
                </select>
              </div>
            </div>

            {/* 9 Category Filter Tabs + Powder Shaker Filter */}
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setSelectedCategory('all')}
                  className={`h-9 whitespace-nowrap border px-3 text-xs font-bold transition-colors ${
                    selectedCategory === 'all'
                      ? 'border-neutral-950 bg-neutral-950 text-white'
                      : 'border-neutral-300 bg-white text-neutral-800 hover:border-neutral-950'
                  }`}
                >
                  Tất cả ({CATALOG_STATS.totalProducts})
                </button>

                {CATALOG_STATS.categoryBreakdown.map((cat) => {
                  const active = selectedCategory === cat.slug;
                  return (
                    <button
                      key={cat.slug}
                      type="button"
                      onClick={() => setSelectedCategory(cat.slug)}
                      className={`h-9 whitespace-nowrap border px-3 text-xs font-bold transition-colors ${
                        active
                          ? 'border-[#FF5A00] bg-[#FF5A00] text-white'
                          : 'border-neutral-300 bg-white text-neutral-800 hover:border-neutral-950'
                      }`}
                    >
                      {cat.name} ({cat.productCount})
                    </button>
                  );
                })}
              </div>

              <label className="flex cursor-pointer items-center gap-2 border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs font-semibold text-neutral-900">
                <input
                  type="checkbox"
                  checked={onlyPowderShaker}
                  onChange={(e) => setOnlyPowderShaker(e.target.checked)}
                  className="accent-[#FF5A00]"
                />
                <span>Chỉ sản phẩm bột pha nước (Tặng bình lắc)</span>
              </label>
            </div>

            {/* Results Summary Bar */}
            <div className="mt-4 flex items-center justify-between text-xs text-neutral-500">
              <span>
                Đang hiển thị{' '}
                <strong className="font-mono text-neutral-950 tabular-nums">
                  {filteredProducts.length}
                </strong>{' '}
                sản phẩm
                {selectedCategory !== 'all' &&
                  ` · Danh mục ${CATEGORIES.find((c) => c.slug === selectedCategory)?.name}`}
              </span>
              {(selectedCategory !== 'all' || searchQuery || onlyPowderShaker) && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCategory('all');
                    setSearchQuery('');
                    setOnlyPowderShaker(false);
                  }}
                  className="font-semibold text-[#FF5A00] hover:underline"
                >
                  Xóa bộ lọc
                </button>
              )}
            </div>

            {/* Product Grid */}
            {filteredProducts.length === 0 ? (
              <div className="mt-8 border border-neutral-200 bg-neutral-50 p-12 text-center">
                <p className="font-display text-2xl font-bold uppercase text-neutral-950">
                  Không tìm thấy sản phẩm phù hợp
                </p>
                <p className="mt-1 text-xs text-neutral-600">
                  Thử tìm tên thương hiệu hoặc hương vị khác (ví dụ: Chocolate, Isolate, Creatine,
                  Omega).
                </p>
              </div>
            ) : (
              <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {filteredProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onOpenDetail={(prod, flav, tab = 'image') =>
                      setDetailState({ product: prod, flavor: flav, tab })
                    }
                    onAddToCart={(prod, flav) => handleAddToCart(prod, flav, 1)}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Interactive 3D / AR / VR Product Showcase Section */}
          <section
            id="trinh-xem-3d"
            className="border-t-2 border-neutral-950 bg-neutral-950 py-14 text-white"
          >
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
                {/* Selector Panel */}
                <div className="flex flex-col justify-between lg:col-span-5">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-[#FF5A00]">
                      Trình xem WebGL · AR Camera · VR Stereo
                    </span>
                    <h2 className="mt-1 font-display text-3xl font-extrabold uppercase tracking-tight text-white sm:text-4xl">
                      Kiểm Tra Sản Phẩm 3D, AR &amp; VR Trực Tiếp
                    </h2>
                    <p className="mt-2 text-sm leading-relaxed text-neutral-300">
                      Mỗi trong số {CATALOG_STATS.totalProducts} sản phẩm đều hỗ trợ mô hình 3D xoay
                      360°, mở nắp xem lõi bột/viên, chế độ AR đặt qua camera và VR song thị cơ bản.
                    </p>

                    {/* Pick any of the 62 products */}
                    <div className="mt-6 space-y-3 border border-neutral-800 bg-neutral-900 p-4">
                      <div>
                        <label className="block text-xs font-bold uppercase text-neutral-300">
                          Chọn sản phẩm muốn xem 3D / AR / VR
                        </label>
                        <select
                          value={showcaseProduct.id}
                          onChange={(e) => handleShowcaseProductChange(e.target.value)}
                          className="mt-1.5 h-11 w-full border border-neutral-700 bg-neutral-950 px-3 text-xs font-semibold text-white focus:border-[#FF5A00] focus:outline-none"
                        >
                          {PRODUCTS.map((p) => (
                            <option key={p.id} value={p.id}>
                              [{p.categoryName}] {p.name} ({p.weightLabel})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <span className="block text-xs font-bold uppercase text-neutral-300">
                          Đổi hương vị trên nhãn 3D ({showcaseProduct.flavors.length} vị)
                        </span>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {showcaseProduct.flavors.map((flav) => {
                            const active = flav.id === showcaseFlavor.id;
                            return (
                              <button
                                key={flav.id}
                                type="button"
                                onClick={() => setShowcaseFlavorId(flav.id)}
                                className={`flex items-center gap-1.5 border px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                                  active
                                    ? 'border-[#FF5A00] bg-[#FF5A00] text-white'
                                    : 'border-neutral-700 bg-neutral-950 text-neutral-300 hover:border-white'
                                }`}
                              >
                                <span
                                  className="h-2.5 w-2.5 border border-white/30"
                                  style={{ backgroundColor: flav.colorHex }}
                                />
                                <span>{flav.name}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Selected Product Quick Action */}
                  <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-neutral-800 pt-5">
                    <div>
                      <span className="block text-xs text-neutral-400">
                        {showcaseProduct.brand} · Vị {showcaseFlavor.name}
                      </span>
                      <span className="font-mono text-2xl font-extrabold text-[#FF5A00] tabular-nums">
                        {formatVND(showcaseFlavor.priceOverride ?? showcaseProduct.price)}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAddToCart(showcaseProduct, showcaseFlavor, 1)}
                      className="h-11 bg-[#FF5A00] px-5 text-xs font-bold uppercase tracking-wider text-white transition-colors hover:bg-white hover:text-neutral-950"
                    >
                      Thêm vào giỏ hàng
                    </button>
                  </div>
                </div>

                {/* Live Three.js 3D + AR + VR Viewport */}
                <div className="lg:col-span-7">
                  <Product3DViewer
                    product={showcaseProduct}
                    selectedFlavor={showcaseFlavor}
                    initialMode="3d"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Supplement Consultation & FAQ Accordion (#tu-van + #hoi-dap) */}
          <SupplementConsultAndFaq />

          {/* Policies, Return Policy & Direct Contact */}
          <InfoPoliciesContact />
        </main>
      )}

      {/* Footer */}
      <footer className="border-t-2 border-neutral-950 bg-neutral-950 text-white">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
            <div className="md:col-span-2">
              <div className="flex items-center gap-2.5">
                <img
                  src={BRAND_INFO.logoPath}
                  alt="Logo NhaiSupplement"
                  className="h-10 w-10 border border-neutral-800 object-cover"
                />
                <span className="font-display text-2xl font-extrabold uppercase tracking-tight">
                  Nhai<span className="text-[#FF5A00]">Supplement</span>
                </span>
              </div>
              <p className="mt-3 max-w-md text-xs leading-relaxed text-neutral-400">
                Website thương mại điện tử thực phẩm bổ sung thể hình tại {BRAND_INFO.domain}. Trụ
                sở &amp; kho hàng đặt tại Hà Nội, giao hàng toàn quốc. Tự động tặng bình lắc cho
                sản phẩm dạng bột pha với nước và Freeship cho đơn hàng đầu tiên.
              </p>
              <div className="mt-4 flex flex-wrap gap-3 text-xs font-semibold">
                <a
                  href={`tel:${BRAND_INFO.phone}`}
                  className="inline-flex items-center gap-1.5 text-[#FF5A00] hover:underline"
                >
                  <Phone className="h-3.5 w-3.5" />
                  <span>{BRAND_INFO.phone}</span>
                </a>
                <a
                  href={BRAND_INFO.zaloUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-neutral-200 hover:text-[#FF5A00]"
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                  <span>Zalo {BRAND_INFO.phone}</span>
                </a>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#FF5A00]">
                9 Danh mục
              </h4>
              <ul className="mt-3 space-y-1.5 text-xs text-neutral-400">
                {CATALOG_STATS.categoryBreakdown.map((c) => (
                  <li key={c.slug}>
                    <a
                      href="#san-pham"
                      onClick={(e) => {
                        e.preventDefault();
                        setSelectedCategory(c.slug);
                        navigateToHome('#san-pham');
                      }}
                      className="hover:text-white"
                    >
                      {c.name} ({c.productCount})
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#FF5A00]">
                Thông tin &amp; Chính sách
              </h4>
              <ul className="mt-3 space-y-2 text-xs text-neutral-400">
                <li className="flex items-start gap-2">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#FF5A00]" />
                  <span>{BRAND_INFO.warehouseAddress}</span>
                </li>
                <li className="flex items-start gap-2">
                  <Truck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#FF5A00]" />
                  <span>Ship toàn quốc · Freeship đơn đầu</span>
                </li>
                <li>
                  <a
                    href="#tu-van"
                    onClick={(e) => {
                      e.preventDefault();
                      navigateToHome('#tu-van');
                    }}
                    className="hover:text-white"
                  >
                    Tư vấn lộ trình miễn phí
                  </a>
                </li>
                <li>
                  <a
                    href="#hoi-dap"
                    onClick={(e) => {
                      e.preventDefault();
                      navigateToHome('#hoi-dap');
                    }}
                    className="hover:text-white"
                  >
                    Câu hỏi thường gặp (FAQ)
                  </a>
                </li>
                <li>
                  <a
                    href="#chinh-sach"
                    onClick={(e) => {
                      e.preventDefault();
                      navigateToHome('#chinh-sach');
                    }}
                    className="hover:text-white"
                  >
                    Chính sách cơ bản &amp; Đổi trả
                  </a>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={navigateToCheckout}
                    className="text-left text-[#FF5A00] hover:underline"
                  >
                    Trang thanh toán (/thanh-toan)
                  </button>
                </li>
                <li>
                  <a href={`mailto:${BRAND_INFO.email}`} className="hover:text-white">
                    {BRAND_INFO.email}
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-10 flex flex-col items-start justify-between gap-2 border-t border-neutral-800 pt-6 text-[11px] text-neutral-500 sm:flex-row sm:items-center">
            <span>
              © 2026 {BRAND_INFO.name} ({BRAND_INFO.domain}). Portfolio Demo — Không thu tiền thật.
            </span>
            <span>Hà Nội · Giao hàng toàn quốc</span>
          </div>
        </div>
      </footer>

      {/* Product Detail Modal */}
      {detailState && (
        <ProductDetailModal
          product={detailState.product}
          initialFlavor={detailState.flavor}
          initialVisualTab={detailState.tab}
          onClose={() => setDetailState(null)}
          onAddToCart={(prod, flav, qty) => handleAddToCart(prod, flav, qty)}
        />
      )}

      {/* Slide-out Cart Drawer */}
      <CartDrawer
        isOpen={cartOpen}
        items={cartItems}
        isFirstOrder={prefs.isFirstOrder}
        onChangeFirstOrder={(next) =>
          setPrefs((prev) => ({ ...prev, isFirstOrder: next }))
        }
        shakerId={prefs.shakerId}
        onChangeShakerId={(next) =>
          setPrefs((prev) => ({ ...prev, shakerId: next }))
        }
        voucherCode={prefs.voucherCode}
        onChangeVoucherCode={(next) =>
          setPrefs((prev) => ({ ...prev, voucherCode: next }))
        }
        onClose={() => setCartOpen(false)}
        onUpdateQty={handleUpdateQty}
        onRemoveItem={handleRemoveItem}
        onGoToCheckout={navigateToCheckout}
      />

      {/* Non-intrusive Add-to-Cart Toast */}
      {toastText && (
        <div className="fixed bottom-5 left-4 z-50 flex items-center gap-3 border-2 border-[#FF5A00] bg-neutral-950 px-4 py-3 text-xs font-semibold text-white">
          <span>{toastText}</span>
          <button
            type="button"
            onClick={() => setCartOpen(true)}
            className="bg-[#FF5A00] px-2.5 py-1 text-[11px] font-bold uppercase text-white hover:bg-white hover:text-neutral-950"
          >
            Xem giỏ
          </button>
          <button
            type="button"
            onClick={navigateToCheckout}
            className="border border-neutral-700 px-2.5 py-1 text-[11px] font-bold uppercase text-white hover:border-[#FF5A00]"
          >
            Thanh toán
          </button>
        </div>
      )}

      {/* Scroll-to-Top Progress Ring Button (ported from MiuGo Pets) */}
      {showScrollTop && (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          aria-label="Cuộn lên đầu trang"
          className="fixed bottom-5 right-5 z-40 flex h-11 w-11 items-center justify-center rounded-full p-[2.5px] transition-transform hover:scale-105"
          style={{
            background: `conic-gradient(#FF5A00 ${scrollProgress}%, #262626 ${scrollProgress}% 100%)`,
          }}
        >
          <span className="flex h-full w-full items-center justify-center rounded-full bg-neutral-950 text-white">
            <ArrowUp className="h-4 w-4 text-[#FF5A00]" />
          </span>
        </button>
      )}
    </div>
  );
}
