import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  ArrowUp,
  Box,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Menu,
  MessageCircle,
  Phone,
  Search,
  ShoppingBag,
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

const HERO_SLIDE_PRODUCT_IDS = ['wh-01', 'pw-01', 'dc-01'] as const;

const HERO_SLIDES = HERO_SLIDE_PRODUCT_IDS.map((pid, idx) => {
  const product = PRODUCTS.find((p) => p.id === pid) ?? PRODUCTS[idx] ?? PRODUCTS[0];
  const flavor = product.flavors[0];
  return {
    product,
    flavor,
    src: flavor?.image ?? product.defaultImage,
    fallbackSrc: flavor?.fallbackImage ?? product.defaultImage,
    alt: `${product.name} - ${flavor?.name ?? ''}`,
    tag: `${product.categoryName.toUpperCase()} · ${product.weightLabel}`,
    caption: `${product.name}${flavor ? ` · Vị ${flavor.name}` : ''}`,
  };
});

interface FooterPolicyItem {
  label: string;
  title: string;
  content: string;
  sectionHref?: string;
}

const FOOTER_SUPPORT_LINKS: FooterPolicyItem[] = [
  {
    label: 'Hướng dẫn thanh toán',
    title: 'Hướng dẫn thanh toán tại NhaiSupplement',
    content:
      'Quý khách có thể lựa chọn 2 hình thức thanh toán linh hoạt: (1) Thanh toán tiền mặt khi nhận hàng (COD) sau khi kiểm tra tem nhãn và đúng hương vị đã đặt; (2) Chuyển khoản nhanh qua mã VietQR xác nhận tức thì tại bước thanh toán.',
  },
  {
    label: 'Hướng dẫn mua hàng Online',
    title: 'Hướng dẫn mua hàng Online nhanh chóng',
    content:
      'Bước 1: Chọn sản phẩm và bấm đúng hương vị mong muốn. Bước 2: Thêm vào giỏ hàng — đơn hàng từ 500.000đ sẽ tự động mở mục chọn Bình lắc 0đ và đơn đầu tiên được Freeship. Bước 3: Nhập địa chỉ nhận hàng tại trang thanh toán để kho Hà Nội đóng gói giao ngay.',
  },
  {
    label: 'Chính sách khách hàng',
    title: 'Chính sách ưu đãi khách hàng',
    content:
      'NhaiSupplement tự động áp dụng Freeship cho đơn hàng đầu tiên, tặng miễn phí Bình lắc 700ml cho mọi đơn hàng từ 500.000đ và hỗ trợ các mã giảm giá NHAI10 (giảm 10%), NHAI100K (giảm 100.000đ cho đơn từ 1.500.000đ).',
    sectionHref: '#chinh-sach',
  },
  {
    label: 'Góp ý, Khiếu Nại',
    title: 'Tiếp nhận góp ý & khiếu nại',
    content:
      'Mọi phản hồi về chất lượng sản phẩm, thái độ phục vụ hoặc tiến độ giao hàng xin gửi trực tiếp qua Hotline/Zalo 094618430 hoặc email nghiatrinh808@gmail.com để được phản hồi và xử lý trong ngày.',
    sectionHref: '#lien-he',
  },
];

const FOOTER_POLICY_LINKS: FooterPolicyItem[] = [
  {
    label: 'Chính sách, quy định chung',
    title: 'Chính sách & Quy định chung',
    content:
      'Mọi sản phẩm thực phẩm bổ sung thể hình đăng bán trên nhaisupplement.com đều minh bạch nguồn gốc, giá niêm yết, giá trị dinh dưỡng và hình ảnh bao bì thực tế theo từng hương vị để khách hàng dễ dàng đối chiếu khi nhận hàng.',
    sectionHref: '#chinh-sach',
  },
  {
    label: 'Chính sách đổi trả và hoàn tiền',
    title: 'Chính sách đổi trả và hoàn tiền 7 ngày',
    content:
      'Hỗ trợ đổi mới 1–1 hoặc hoàn tiền trong vòng 07 ngày kể từ khi nhận hàng nếu sản phẩm giao sai hương vị/trọng lượng, rách tem niêm phong khi vận chuyển hoặc có lỗi từ nhà sản xuất. Miễn phí cước vận chuyển đổi trả 2 chiều.',
    sectionHref: '#doi-tra',
  },
  {
    label: 'Chính sách vận chuyển hàng',
    title: 'Chính sách vận chuyển toàn quốc từ kho Hà Nội',
    content:
      'Tất cả đơn hàng xuất trực tiếp từ kho Hà Nội (Quận Đống Đa). Giao hỏa tốc nội thành Hà Nội trong 2–4 giờ; TP.HCM, Đà Nẵng và các tỉnh thành khác nhận hàng sau 1–3 ngày. Đơn hàng đầu tiên được Freeship 0đ toàn quốc.',
    sectionHref: '#chinh-sach',
  },
  {
    label: 'Bảo mật thông tin khách hàng',
    title: 'Chính sách bảo mật thông tin khách hàng',
    content:
      'Thông tin họ tên, số điện thoại và địa chỉ giao hàng của quý khách chỉ được dùng duy nhất cho mục đích đóng gói, giao nhận đơn hàng và hỗ trợ đổi trả/bảo hành sản phẩm, tuyệt đối không chia sẻ cho bên thứ ba.',
  },
  {
    label: 'Chính sách hàng chính hãng',
    title: 'Cam kết hàng chính hãng 100%',
    content:
      '100% sản phẩm tại NhaiSupplement nguyên seal từ thương hiệu chính hãng (Optimum Nutrition, Dymatize, Rule 1, Nutrabio, Redcon1, Sports Research...). Khách hàng được kiểm tra bao bì, mã vạch và hạn sử dụng trước khi thanh toán.',
  },
];

const BENEFIT_TICKER_ITEMS = [
  'KHO HÀ NỘI · GIAO NHANH TOÀN QUỐC',
  'FREESHIP CHO ĐƠN HÀNG ĐẦU TIÊN',
  'TẶNG BÌNH LẮC 0Đ CHO ĐƠN HÀNG TỪ 500.000Đ',
  'ĐỔI ẢNH THEO TỪNG HƯƠNG VỊ THỰC TẾ 1:1',
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
  const [activePolicyModal, setActivePolicyModal] = useState<FooterPolicyItem | null>(null);

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
  }, [selectedCategory, searchQuery, sortBy]);

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
            <span className="hidden sm:inline">Tặng bình lắc 0đ cho đơn từ 500.000đ</span>
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
                    Hệ thống thực phẩm bổ sung chính hãng qua 9 danh mục, đổi ảnh 1:1 chuẩn theo
                    từng vị, hỗ trợ xem 3D, AR Camera &amp; VR cùng mã ưu đãi ngay tại giỏ.
                  </p>

                  {/* Primary CTAs */}
                  <div className="mt-7 flex flex-wrap items-center gap-3">
                    <a
                      href="#san-pham"
                      className="inline-flex h-12 items-center gap-2 whitespace-nowrap bg-[#FF5A00] px-6 text-xs font-bold uppercase tracking-wider text-white transition-colors hover:bg-white hover:text-neutral-950"
                    >
                      <span>Khám phá sản phẩm</span>
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
                      9 Nhóm
                    </span>
                    <span className="text-xs text-neutral-400">Đa dạng hương vị</span>
                  </div>
                  <div>
                    <span className="block font-mono text-2xl font-extrabold text-white tabular-nums">
                      2–4h
                    </span>
                    <span className="text-xs text-neutral-400">Giao nhanh Hà Nội</span>
                  </div>
                  <div>
                    <span className="block font-mono text-2xl font-extrabold text-white tabular-nums">
                      0đ
                    </span>
                    <span className="text-xs text-neutral-400">Freeship đơn đầu</span>
                  </div>
                  <div>
                    <span className="block font-mono text-2xl font-extrabold text-[#FF5A00] tabular-nums">
                      500K+
                    </span>
                    <span className="text-xs text-neutral-400">Tặng bình lắc 0đ</span>
                  </div>
                </div>
              </div>

              {/* Hero Real Store Product Slideshow */}
              <div className="relative flex min-h-[340px] flex-col justify-between border-t border-neutral-800 bg-white lg:col-span-6 lg:border-l lg:border-t-0">
                <div className="relative flex flex-1 items-center justify-center p-6 pb-28 sm:p-10 sm:pb-28">
                  <img
                    key={activeSlide.product.id}
                    src={activeSlide.src}
                    alt={activeSlide.alt}
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      if (e.currentTarget.src !== activeSlide.fallbackSrc) {
                        e.currentTarget.src = activeSlide.fallbackSrc;
                      }
                    }}
                    onClick={() =>
                      setDetailState({
                        product: activeSlide.product,
                        flavor: activeSlide.flavor,
                        tab: 'image',
                      })
                    }
                    className="max-h-[260px] w-full cursor-pointer object-contain transition-transform duration-300 hover:scale-[1.03] sm:max-h-[300px]"
                  />

                  <span className="absolute left-4 top-4 border border-neutral-950 bg-neutral-950 px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-white">
                    {activeSlide.product.brand}
                  </span>

                  {/* Top Slide Controls */}
                  <div className="absolute right-4 top-4 flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        setHeroSlideIdx(
                          (prev) => (prev - 1 + HERO_SLIDES.length) % HERO_SLIDES.length,
                        )
                      }
                      aria-label="Sản phẩm trước"
                      className="flex h-8 w-8 items-center justify-center border border-neutral-950 bg-neutral-950 text-white transition-colors hover:border-[#FF5A00] hover:bg-[#FF5A00]"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setHeroSlideIdx((prev) => (prev + 1) % HERO_SLIDES.length)
                      }
                      aria-label="Sản phẩm tiếp theo"
                      className="flex h-8 w-8 items-center justify-center border border-neutral-950 bg-neutral-950 text-white transition-colors hover:border-[#FF5A00] hover:bg-[#FF5A00]"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="absolute bottom-4 left-4 right-4 border border-neutral-800 bg-neutral-950/95 px-4 py-3 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <span className="block font-mono text-[10px] font-bold text-[#FF5A00]">
                        {activeSlide.tag}
                      </span>
                      <span className="block truncate text-sm font-bold text-white">
                        {activeSlide.caption}
                      </span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono text-sm font-extrabold text-[#FF5A00] tabular-nums">
                        {formatVND(activeSlide.product.price)}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setDetailState({
                            product: activeSlide.product,
                            flavor: activeSlide.flavor,
                            tab: 'image',
                          })
                        }
                        className="bg-[#FF5A00] px-3 py-1.5 text-[11px] font-bold uppercase text-white transition-colors hover:bg-white hover:text-neutral-950"
                      >
                        Xem ngay
                      </button>
                    </div>
                  </div>
                  <div className="mt-2.5 flex items-center gap-1.5">
                    {HERO_SLIDES.map((s, idx) => (
                      <button
                        key={s.product.id}
                        type="button"
                        onClick={() => setHeroSlideIdx(idx)}
                        aria-label={`Sản phẩm ${idx + 1}: ${s.product.name}`}
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
            {/* Search & Sort Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-neutral-200 pb-5">
              <div className="relative flex-1 sm:max-w-sm">
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

            {/* 9 Category Filter Tabs */}
            <div className="mt-5 flex flex-wrap items-center gap-1.5">
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
              {(selectedCategory !== 'all' || searchQuery) && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCategory('all');
                    setSearchQuery('');
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
                      Mỗi sản phẩm đều hỗ trợ xoay 360°, góc xem nhanh bảng thành phần, mở nắp xem
                      lõi, kèm bình lắc 700ml so tỉ lệ, AR Camera có chụp ảnh và VR Showroom 360°
                      hỗ trợ toàn màn hình &amp; cảm biến xoay đầu.
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
          <div className="grid grid-cols-1 gap-10 md:grid-cols-12">
            {/* Brand & Warehouse Contact */}
            <div className="md:col-span-5">
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
                Hệ thống phân phối thực phẩm bổ sung thể hình chính hãng tại {BRAND_INFO.domain}.
                Tặng bình lắc 0đ cho đơn từ 500.000đ và Freeship cho đơn hàng đầu tiên.
              </p>
              <ul className="mt-4 space-y-1.5 text-xs text-neutral-300">
                <li className="flex items-start gap-2">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#FF5A00]" />
                  <span>{BRAND_INFO.warehouseAddress} · Ship toàn quốc</span>
                </li>
                <li className="flex items-center gap-3 pt-1 font-semibold">
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
                </li>
              </ul>
            </div>

            {/* Hỗ trợ khách hàng */}
            <div className="md:col-span-3">
              <h4 className="text-sm font-extrabold uppercase tracking-wide text-white">
                HỖ TRỢ KHÁCH HÀNG
              </h4>
              <div className="mt-2 h-[2px] w-16 bg-[#FF5A00]" />
              <ul className="mt-4 space-y-2.5 text-sm text-neutral-300">
                {FOOTER_SUPPORT_LINKS.map((item) => (
                  <li key={item.label}>
                    <button
                      type="button"
                      onClick={() => setActivePolicyModal(item)}
                      className="text-left transition-colors hover:text-[#FF5A00]"
                    >
                      {item.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            {/* Chính sách chung */}
            <div className="md:col-span-4">
              <h4 className="text-sm font-extrabold uppercase tracking-wide text-white">
                CHÍNH SÁCH CHUNG
              </h4>
              <div className="mt-2 h-[2px] w-16 bg-[#FF5A00]" />
              <ul className="mt-4 space-y-2.5 text-sm text-neutral-300">
                {FOOTER_POLICY_LINKS.map((item) => (
                  <li key={item.label}>
                    <button
                      type="button"
                      onClick={() => setActivePolicyModal(item)}
                      className="text-left transition-colors hover:text-[#FF5A00]"
                    >
                      {item.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-10 flex flex-col items-start justify-between gap-2 border-t border-neutral-800 pt-6 text-[11px] text-neutral-500 sm:flex-row sm:items-center">
            <span>
              © 2026 {BRAND_INFO.name} ({BRAND_INFO.domain}).
            </span>
            <span>Kho Hà Nội · Giao hàng toàn quốc</span>
          </div>
        </div>
      </footer>

      {/* Footer Policy / Support Quick Modal */}
      {activePolicyModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={activePolicyModal.title}
        >
          <div className="w-full max-w-lg border-2 border-neutral-950 bg-white p-6">
            <div className="flex items-start justify-between gap-4 border-b border-neutral-200 pb-3">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#FF5A00]">
                  NhaiSupplement · Thông tin hỗ trợ
                </span>
                <h3 className="mt-0.5 font-display text-xl font-extrabold uppercase text-neutral-950">
                  {activePolicyModal.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActivePolicyModal(null)}
                aria-label="Đóng"
                className="flex h-8 w-8 items-center justify-center border border-neutral-300 text-neutral-950 hover:border-neutral-950"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-neutral-700">
              {activePolicyModal.content}
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-end gap-2 border-t border-neutral-200 pt-4">
              {activePolicyModal.sectionHref && (
                <button
                  type="button"
                  onClick={() => {
                    const href = activePolicyModal.sectionHref;
                    setActivePolicyModal(null);
                    if (href) navigateToHome(href);
                  }}
                  className="border border-neutral-950 px-4 py-2 text-xs font-bold uppercase text-neutral-950 hover:bg-neutral-100"
                >
                  Xem mục chi tiết
                </button>
              )}
              <button
                type="button"
                onClick={() => setActivePolicyModal(null)}
                className="bg-[#FF5A00] px-5 py-2 text-xs font-bold uppercase text-white hover:bg-neutral-950"
              >
                Đã hiểu
              </button>
            </div>
          </div>
        </div>
      )}

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
