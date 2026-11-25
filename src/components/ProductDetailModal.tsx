import { useEffect, useState } from 'react';
import {
  Box,
  Camera,
  Check,
  Eye,
  Gift,
  Image as ImageIcon,
  ShieldCheck,
  ShoppingBag,
  Truck,
  X,
} from 'lucide-react';
import type { Product, ProductFlavor } from '../types/product';
import { formatVND } from '../data/catalog';
import { checkIsMobilePhone, useIsMobilePhone } from '../utils/deviceDetection';
import ErrorBoundary from './ErrorBoundary';
import Product3DViewer, { type ViewerMode } from './Product3DViewer';

interface ProductDetailModalProps {
  product: Product;
  initialFlavor: ProductFlavor;
  initialVisualTab?: 'image' | ViewerMode;
  onClose: () => void;
  onAddToCart: (product: Product, flavor: ProductFlavor, quantity: number) => void;
}

export default function ProductDetailModal({
  product,
  initialFlavor,
  initialVisualTab = 'image',
  onClose,
  onAddToCart,
}: ProductDetailModalProps) {
  const isMobilePhone = useIsMobilePhone();
  const safeInitialVisualTab =
    initialVisualTab === 'vr' && !checkIsMobilePhone() ? '3d' : initialVisualTab;

  const [selectedFlavor, setSelectedFlavor] = useState<ProductFlavor>(initialFlavor);
  const [visualTab, setVisualTab] = useState<'image' | ViewerMode>(safeInitialVisualTab);
  const [infoTab, setInfoTab] = useState<'overview' | 'nutrition' | 'usage'>('overview');
  const [quantity, setQuantity] = useState(1);
  const [addedNotice, setAddedNotice] = useState(false);

  useEffect(() => {
    setSelectedFlavor(initialFlavor);
    setVisualTab(initialVisualTab === 'vr' && !isMobilePhone ? '3d' : initialVisualTab);
    setInfoTab('overview');
    setQuantity(1);
  }, [product, initialFlavor, initialVisualTab, isMobilePhone]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const activePrice = selectedFlavor.priceOverride ?? product.price;

  const handleFlavorChange = (flavor: ProductFlavor) => {
    setSelectedFlavor(flavor);
  };

  const handleAdd = () => {
    onAddToCart(product, selectedFlavor, quantity);
    setAddedNotice(true);
    window.setTimeout(() => setAddedNotice(false), 1800);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-2 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={`Chi tiết sản phẩm ${product.name}`}
    >
      <div className="relative flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden border-2 border-neutral-950 bg-white">
        {/* Modal Top Bar */}
        <div className="flex items-center justify-between border-b border-neutral-200 bg-neutral-950 px-4 py-3 text-white sm:px-6">
          <div className="flex items-center gap-2 text-xs font-medium text-neutral-300">
            <span className="font-bold text-[#FF5A00]">{product.brand}</span>
            <span aria-hidden="true">·</span>
            <span>{product.categoryName}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono">{product.weightLabel}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng chi tiết sản phẩm"
            className="flex h-9 w-9 items-center justify-center border border-neutral-700 text-white transition-colors hover:border-[#FF5A00] hover:bg-[#FF5A00]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable Two-Column PDP */}
        <div className="grid flex-1 grid-cols-1 overflow-y-auto lg:grid-cols-12">
          {/* Left Visual Stage: Dynamic Flavor Image Switcher + 3D / AR / VR */}
          <div className="flex flex-col border-b border-neutral-200 bg-neutral-50 p-4 sm:p-6 lg:col-span-6 lg:border-b-0 lg:border-r">
            {/* Visual Mode Switcher Tabs */}
            <div className="mb-3 flex flex-wrap items-center gap-1.5 bg-neutral-200/70 p-1">
              <button
                type="button"
                onClick={() => setVisualTab('image')}
                className={`flex flex-1 items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold whitespace-nowrap transition-colors ${
                  visualTab === 'image'
                    ? 'bg-neutral-950 text-white'
                    : 'text-neutral-700 hover:text-neutral-950'
                }`}
              >
                <ImageIcon className="h-3.5 w-3.5" />
                <span>Ảnh theo vị</span>
              </button>
              <button
                type="button"
                onClick={() => setVisualTab('3d')}
                className={`flex flex-1 items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold whitespace-nowrap transition-colors ${
                  visualTab === '3d'
                    ? 'bg-[#FF5A00] text-white'
                    : 'text-neutral-700 hover:text-neutral-950'
                }`}
              >
                <Box className="h-3.5 w-3.5" />
                <span>Xem 3D</span>
              </button>
              <button
                type="button"
                onClick={() => setVisualTab('ar')}
                className={`flex flex-1 items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold whitespace-nowrap transition-colors ${
                  visualTab === 'ar'
                    ? 'bg-[#FF5A00] text-white'
                    : 'text-neutral-700 hover:text-neutral-950'
                }`}
              >
                <Camera className="h-3.5 w-3.5" />
                <span>AR</span>
              </button>
              {isMobilePhone && (
                <button
                  type="button"
                  onClick={() => setVisualTab('vr')}
                  className={`flex flex-1 items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold whitespace-nowrap transition-colors ${
                    visualTab === 'vr'
                      ? 'bg-[#FF5A00] text-white'
                      : 'text-neutral-700 hover:text-neutral-950'
                  }`}
                >
                  <Eye className="h-3.5 w-3.5" />
                  <span>VR</span>
                </button>
              )}
            </div>

            {visualTab === 'image' ? (
              <>
                <div className="relative aspect-[4/3] w-full overflow-hidden border border-neutral-200 bg-white">
                  <img
                    key={selectedFlavor.id}
                    src={selectedFlavor.image}
                    alt={`${product.name} - ${selectedFlavor.name}`}
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      if (e.currentTarget.src !== selectedFlavor.fallbackImage) {
                        e.currentTarget.src = selectedFlavor.fallbackImage;
                      }
                    }}
                    className="h-full w-full object-contain p-3 transition-opacity duration-200"
                  />
                  <div className="absolute bottom-3 left-3 flex items-center gap-2 border border-neutral-900 bg-white/95 px-3 py-1.5 text-xs font-bold text-neutral-950">
                    <span
                      className="h-3 w-3 border border-black/20"
                      style={{ backgroundColor: selectedFlavor.colorHex }}
                    />
                    <span>Hương vị: {selectedFlavor.name}</span>
                  </div>
                </div>

                {/* Real Flavor Photo Strip + 3D Square Tile */}
                <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-5">
                  {product.flavors.map((flavor) => {
                    const isActive = flavor.id === selectedFlavor.id;
                    return (
                      <button
                        key={flavor.id}
                        type="button"
                        onClick={() => handleFlavorChange(flavor)}
                        title={flavor.name}
                        className={`aspect-square overflow-hidden border bg-white p-1.5 transition-all ${
                          isActive
                            ? 'border-2 border-[#FF5A00]'
                            : 'border-neutral-200 hover:border-neutral-950'
                        }`}
                      >
                        <img
                          src={flavor.image}
                          alt={`${product.name} - ${flavor.name}`}
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            if (e.currentTarget.src !== flavor.fallbackImage) {
                              e.currentTarget.src = flavor.fallbackImage;
                            }
                          }}
                          className="h-full w-full object-contain"
                        />
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => setVisualTab('3d')}
                    title="Mở trình xem 3D tương tác"
                    className="flex aspect-square flex-col items-center justify-center gap-1.5 border border-neutral-950 bg-neutral-950 text-white transition-colors hover:border-[#FF5A00] hover:bg-neutral-900"
                  >
                    <Box className="h-6 w-6 text-[#FF5A00]" />
                    <span className="text-xs font-extrabold tracking-wide">3D</span>
                  </button>
                </div>
              </>
            ) : (
              <ErrorBoundary
                resetKeys={[product.id, selectedFlavor.id, visualTab]}
                fallback={(reset) => (
                  <div className="flex h-[390px] flex-col items-center justify-center border border-neutral-200 bg-white p-6 text-center sm:h-[450px]">
                    <img
                      src={selectedFlavor.image}
                      alt={`${product.name} - ${selectedFlavor.name}`}
                      referrerPolicy="no-referrer"
                      className="mb-3 max-h-52 w-auto object-contain"
                    />
                    <p className="text-xs font-semibold text-neutral-700">
                      Không thể khởi chạy chế độ 3D/AR trên thiết bị này.
                    </p>
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={reset}
                        className="bg-neutral-950 px-3 py-1.5 text-xs font-bold uppercase text-white hover:bg-[#FF5A00]"
                      >
                        Thử lại 3D
                      </button>
                      <button
                        type="button"
                        onClick={() => setVisualTab('image')}
                        className="border border-neutral-300 px-3 py-1.5 text-xs font-bold uppercase text-neutral-950 hover:border-neutral-950"
                      >
                        Xem ảnh sản phẩm
                      </button>
                    </div>
                  </div>
                )}
              >
                <Product3DViewer
                  product={product}
                  selectedFlavor={selectedFlavor}
                  initialMode={visualTab}
                  onModeChange={setVisualTab}
                  compact
                />
              </ErrorBoundary>
            )}

            {/* Warehouse & Authenticity Summary */}
            <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
              <div className="border border-neutral-200 bg-white p-3">
                <div className="flex items-center gap-1.5 font-bold text-neutral-950">
                  <Truck className="h-4 w-4 text-[#FF5A00]" />
                  <span>Kho Hà Nội · Ship Toàn Quốc</span>
                </div>
                <p className="mt-1 text-neutral-600">
                  Nội thành Hà Nội nhận trong 2–4h. Giao tỉnh 2–3 ngày.
                </p>
              </div>
              <div className="border border-neutral-200 bg-white p-3">
                <div className="flex items-center gap-1.5 font-bold text-neutral-950">
                  <ShieldCheck className="h-4 w-4 text-[#FF5A00]" />
                  <span>Đổi Trả 7 Ngày</span>
                </div>
                <p className="mt-1 text-neutral-600">
                  Miễn phí đổi mới nếu lỗi NSX hoặc giao sai hương vị.
                </p>
              </div>
            </div>
          </div>

          {/* Right Contiguous Purchase Module */}
          <div className="flex flex-col justify-between p-4 sm:p-6 lg:col-span-6">
            <div>
              <h2 className="font-display text-2xl font-extrabold uppercase tracking-tight text-neutral-950 sm:text-3xl">
                {product.name}
              </h2>

              <p className="mt-2 text-sm leading-relaxed text-neutral-600">
                {product.description}
              </p>

              {/* Price Block */}
              <div className="mt-4 flex flex-wrap items-baseline gap-3 border-y border-neutral-200 py-3">
                <span className="font-mono text-3xl font-extrabold text-[#FF5A00] tabular-nums">
                  {formatVND(activePrice)}
                </span>
                {product.compareAtPrice && product.compareAtPrice > activePrice && (
                  <span className="font-mono text-base text-neutral-400 line-through tabular-nums">
                    {formatVND(product.compareAtPrice)}
                  </span>
                )}
                <span className="ml-auto font-mono text-xs font-semibold text-neutral-700 tabular-nums">
                  Còn {selectedFlavor.stock} hộp · Đã bán {product.soldCount}
                </span>
              </div>

              {/* Dynamic Flavor Selector */}
              <div className="mt-5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold uppercase tracking-wide text-neutral-950">
                    Chọn hương vị ({product.flavors.length} tùy chọn)
                  </span>
                  <span className="font-semibold text-[#FF5A00]">{selectedFlavor.name}</span>
                </div>
                <div className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {product.flavors.map((flavor) => {
                    const active = flavor.id === selectedFlavor.id;
                    return (
                      <button
                        key={flavor.id}
                        type="button"
                        onClick={() => handleFlavorChange(flavor)}
                        className={`flex items-center gap-2 border px-2.5 py-2 text-left text-xs font-semibold transition-all ${
                          active
                            ? 'border-[#FF5A00] bg-neutral-950 text-white'
                            : 'border-neutral-300 bg-white text-neutral-800 hover:border-neutral-950'
                        }`}
                      >
                        <span
                          className="h-3.5 w-3.5 shrink-0 border border-white/30"
                          style={{ backgroundColor: flavor.colorHex }}
                        />
                        <span className="truncate">{flavor.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Shaker Gift Rule Notice (Orders >= 500,000đ) */}
              <div className="mt-5 border border-[#FF5A00] bg-orange-50/70 p-3 text-xs text-neutral-900">
                <div className="flex items-start gap-2">
                  <Gift className="mt-0.5 h-4 w-4 shrink-0 text-[#FF5A00]" />
                  <div>
                    <p className="font-bold text-neutral-950">
                      Tặng kèm Bình Lắc NhaiSupplement 0đ cho đơn từ 500.000đ
                    </p>
                    <p className="mt-0.5 text-neutral-700">
                      Mỗi đơn hàng có tổng giá trị từ 500.000đ trở lên sẽ tự động hiện mục chọn mẫu
                      bình lắc tặng kèm trong giỏ hàng. Kèm Freeship cho đơn đầu tiên!
                    </p>
                  </div>
                </div>
              </div>

              {/* Structured Detail Tabs (Overview / Nutrition / Usage Guide — inspired by MiuGo Pets) */}
              <div className="mt-5 border border-neutral-950 bg-white">
                <div className="grid grid-cols-3 border-b border-neutral-950 bg-neutral-950 text-xs font-bold uppercase tracking-wider">
                  <button
                    type="button"
                    onClick={() => setInfoTab('overview')}
                    className={`py-2 px-2 text-center transition-colors ${
                      infoTab === 'overview'
                        ? 'bg-[#FF5A00] text-white'
                        : 'text-neutral-300 hover:text-white'
                    }`}
                  >
                    Thành phần chính
                  </button>
                  <button
                    type="button"
                    onClick={() => setInfoTab('nutrition')}
                    className={`py-2 px-2 text-center transition-colors ${
                      infoTab === 'nutrition'
                        ? 'bg-[#FF5A00] text-white'
                        : 'text-neutral-300 hover:text-white'
                    }`}
                  >
                    Thông số chi tiết
                  </button>
                  <button
                    type="button"
                    onClick={() => setInfoTab('usage')}
                    className={`py-2 px-2 text-center transition-colors ${
                      infoTab === 'usage'
                        ? 'bg-[#FF5A00] text-white'
                        : 'text-neutral-300 hover:text-white'
                    }`}
                  >
                    Cách sử dụng
                  </button>
                </div>

                {infoTab === 'overview' && (
                  <div className="grid grid-cols-2 divide-x divide-y divide-neutral-200 text-xs sm:grid-cols-3">
                    <div className="p-2.5">
                      <span className="block text-neutral-500">Khẩu phần</span>
                      <span className="font-mono font-bold text-neutral-950 tabular-nums">
                        {product.nutritionInfo.servingSize}
                      </span>
                    </div>
                    <div className="p-2.5">
                      <span className="block text-neutral-500">Số lần dùng</span>
                      <span className="font-mono font-bold text-neutral-950 tabular-nums">
                        {product.nutritionInfo.servingsPerContainer} lần
                      </span>
                    </div>
                    <div className="p-2.5">
                      <span className="block text-neutral-500">Năng lượng</span>
                      <span className="font-mono font-bold text-neutral-950 tabular-nums">
                        {product.nutritionInfo.calories}
                      </span>
                    </div>
                    <div className="p-2.5">
                      <span className="block text-neutral-500">Protein</span>
                      <span className="font-mono font-bold text-[#FF5A00] tabular-nums">
                        {product.nutritionInfo.protein}
                      </span>
                    </div>
                    <div className="p-2.5">
                      <span className="block text-neutral-500">Carbs / Fat</span>
                      <span className="font-mono font-bold text-neutral-950 tabular-nums">
                        {product.nutritionInfo.carbs} / {product.nutritionInfo.fat}
                      </span>
                    </div>
                    <div className="p-2.5">
                      <span className="block text-neutral-500">Điểm nổi bật</span>
                      <span className="font-mono font-bold text-neutral-950 tabular-nums">
                        {product.nutritionInfo.highlightValue}
                      </span>
                    </div>
                  </div>
                )}

                {infoTab === 'nutrition' && (
                  <div className="space-y-1.5 p-3 text-xs text-neutral-700">
                    <div className="flex justify-between border-b border-neutral-100 pb-1">
                      <span className="text-neutral-500">Thương hiệu</span>
                      <strong className="text-neutral-950">{product.brand}</strong>
                    </div>
                    <div className="flex justify-between border-b border-neutral-100 pb-1">
                      <span className="text-neutral-500">Danh mục</span>
                      <strong className="text-neutral-950">{product.categoryName}</strong>
                    </div>
                    <div className="flex justify-between border-b border-neutral-100 pb-1">
                      <span className="text-neutral-500">Quy cách đóng gói</span>
                      <strong className="font-mono text-neutral-950">{product.weightLabel}</strong>
                    </div>
                    <div className="flex justify-between border-b border-neutral-100 pb-1">
                      <span className="text-neutral-500">Hương vị đang chọn</span>
                      <strong className="text-[#FF5A00]">{selectedFlavor.name}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-500">Quà tặng bình lắc 700ml</span>
                      <strong className="text-neutral-950">
                        Tặng kèm đơn từ 500.000đ
                      </strong>
                    </div>
                  </div>
                )}

                {infoTab === 'usage' && (
                  <div className="space-y-1.5 p-3 text-xs leading-relaxed text-neutral-700">
                    {product.isWaterMixPowder ? (
                      <>
                        <p>
                          <strong>Cách pha chuẩn:</strong> Pha 1 khẩu phần ({product.nutritionInfo.servingSize}) với 250–350ml nước lọc lạnh bằng bình lắc tặng kèm, lắc đều 15–20 giây.
                        </p>
                        <p>
                          <strong>Thời điểm tốt nhất:</strong> Ngay sau buổi tập (Whey/EAA) hoặc trước tập 20–30 phút (Pre-Workout) / hàng ngày (Creatine).
                        </p>
                      </>
                    ) : (
                      <>
                        <p>
                          <strong>Cách dùng chuẩn:</strong> Dùng trực tiếp {product.nutritionInfo.servingSize} với nước lọc (Vitamin / Dầu cá dùng ngay sau bữa ăn chính có chất béo) hoặc ăn trực tiếp làm bữa phụ.
                        </p>
                        <p>
                          <strong>Bảo quản:</strong> Nơi khô ráo thoáng mát, đậy kín nắp sau khi mở, tránh ánh nắng trực tiếp.
                        </p>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Add to Cart Bar */}
            <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-neutral-200 pt-4">
              <div className="flex h-12 items-center border border-neutral-950">
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="h-full w-10 text-base font-bold text-neutral-950 hover:bg-neutral-100"
                  aria-label="Giảm số lượng"
                >
                  -
                </button>
                <span className="w-10 text-center font-mono text-sm font-bold tabular-nums">
                  {quantity}
                </span>
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.min(20, q + 1))}
                  className="h-full w-10 text-base font-bold text-neutral-950 hover:bg-neutral-100"
                  aria-label="Tăng số lượng"
                >
                  +
                </button>
              </div>

              <button
                type="button"
                onClick={handleAdd}
                className="flex h-12 flex-1 items-center justify-center gap-2 bg-[#FF5A00] px-6 text-sm font-bold uppercase tracking-wide text-white transition-colors hover:bg-neutral-950 whitespace-nowrap"
              >
                {addedNotice ? (
                  <>
                    <Check className="h-4 w-4" />
                    <span>Đã thêm vị {selectedFlavor.name}</span>
                  </>
                ) : (
                  <>
                    <ShoppingBag className="h-4 w-4" />
                    <span>Thêm vào giỏ · {formatVND(activePrice * quantity)}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
