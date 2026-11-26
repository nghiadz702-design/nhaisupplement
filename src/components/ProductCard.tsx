import { useState } from 'react';
import { Camera, Eye, ShoppingBag } from 'lucide-react';
import type { Product, ProductFlavor } from '../types/product';
import { formatVND } from '../data/catalog';
import { useIsMobilePhone } from '../utils/deviceDetection';
import type { ViewerMode } from './Product3DViewer';

interface ProductCardProps {
  product: Product;
  onOpenDetail: (product: Product, flavor: ProductFlavor, initialTab?: 'image' | ViewerMode) => void;
  onAddToCart: (product: Product, flavor: ProductFlavor) => void;
}

export default function ProductCard({
  product,
  onOpenDetail,
  onAddToCart,
}: ProductCardProps) {
  const isMobilePhone = useIsMobilePhone();
  const [selectedFlavor, setSelectedFlavor] = useState<ProductFlavor>(product.flavors[0]);
  const [imgFadeKey, setImgFadeKey] = useState(0);

  const activePrice = selectedFlavor.priceOverride ?? product.price;
  const discountPercent =
    product.compareAtPrice && product.compareAtPrice > activePrice
      ? Math.round(((product.compareAtPrice - activePrice) / product.compareAtPrice) * 100)
      : 0;

  const handleSelectFlavor = (flavor: ProductFlavor) => {
    setSelectedFlavor(flavor);
    setImgFadeKey((k) => k + 1);
  };

  return (
    <article className="group flex flex-col border border-neutral-200 bg-white transition-all duration-200 hover:-translate-y-0.5 hover:border-neutral-950">
      {/* Product Image Stage */}
      <div className="relative aspect-[4/3] w-full overflow-hidden border-b border-neutral-100 bg-white">
        <button
          type="button"
          onClick={() => onOpenDetail(product, selectedFlavor, 'image')}
          className="block h-full w-full text-left focus-visible:outline-2 focus-visible:outline-[#FF5A00]"
          aria-label={`Xem chi tiết ${product.name}`}
        >
          <img
            key={`${product.id}-${selectedFlavor.id}-${imgFadeKey}`}
            src={selectedFlavor.image}
            alt={`${product.name} - Hương vị ${selectedFlavor.name}`}
            referrerPolicy="no-referrer"
            onError={(e) => {
              if (e.currentTarget.src !== selectedFlavor.fallbackImage) {
                e.currentTarget.src = selectedFlavor.fallbackImage;
              }
            }}
            className="h-full w-full object-contain p-3 transition-transform duration-300 group-hover:scale-[1.04]"
          />
        </button>

        {/* Top Single Clean Label (No Pill Spam) */}
        <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-2">
          {discountPercent > 0 && (
            <span className="bg-[#FF5A00] px-2 py-0.5 font-mono text-[11px] font-bold text-white tabular-nums">
              -{discountPercent}%
            </span>
          )}
        </div>

        {/* Live Active Flavor Tag on Image Frame */}
        <div className="pointer-events-none absolute bottom-3 left-3 flex items-center gap-1.5 border border-neutral-900 bg-white/95 px-2 py-1 text-[10px] font-bold text-neutral-950">
          <span
            className="h-2.5 w-2.5 shrink-0 border border-black/20"
            style={{ backgroundColor: selectedFlavor.colorHex }}
          />
          <span className="max-w-[130px] truncate">{selectedFlavor.name}</span>
        </div>

        {/* Quick AR / VR Trigger */}
        <button
          type="button"
          onClick={() => onOpenDetail(product, selectedFlavor, 'ar')}
          className="absolute bottom-3 right-3 flex items-center gap-1 border border-neutral-900 bg-white/95 px-2.5 py-1.5 text-[11px] font-bold text-neutral-950 transition-colors hover:bg-[#FF5A00] hover:border-[#FF5A00] hover:text-white"
          title={isMobilePhone ? 'Xem sản phẩm qua AR / VR' : 'Xem sản phẩm qua AR Camera'}
        >
          <Camera className="h-3.5 w-3.5" />
          <span>{isMobilePhone ? 'AR · VR' : 'Xem AR'}</span>
        </button>
      </div>

      {/* Card Body */}
      <div className="flex flex-1 flex-col justify-between p-4">
        <div>
          {/* Unboxed Metadata Line */}
          <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-neutral-500">
            <span className="truncate">{product.brand}</span>
            <span aria-hidden="true">·</span>
            <span className="truncate">{product.categoryName}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono whitespace-nowrap">{product.weightLabel}</span>
          </div>

          {/* Product Title */}
          <h3 className="mt-1.5 line-clamp-2 text-base font-bold leading-snug text-neutral-950">
            <button
              type="button"
              onClick={() => onOpenDetail(product, selectedFlavor, 'image')}
              className="text-left hover:text-[#FF5A00] transition-colors"
            >
              {product.name}
            </button>
          </h3>

          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-neutral-600">
            {product.shortDescription}
          </p>

          {/* Dynamic Flavor Switcher Swatches on Card */}
          <div className="mt-3 border-t border-neutral-100 pt-3">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-medium text-neutral-500">
                Vị đang chọn:{' '}
                <strong className="font-semibold text-neutral-950">{selectedFlavor.name}</strong>
              </span>
              <span className="font-mono text-neutral-400 tabular-nums">
                {product.flavors.length} vị
              </span>
            </div>

            {product.flavors.length > 1 && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {product.flavors.slice(0, 6).map((flavor) => {
                  const isActive = flavor.id === selectedFlavor.id;
                  return (
                    <button
                      key={flavor.id}
                      type="button"
                      onClick={() => handleSelectFlavor(flavor)}
                      title={`Đổi sang vị ${flavor.name}`}
                      aria-label={`Chọn hương vị ${flavor.name}`}
                      className={`flex h-6 items-center gap-1 border px-1.5 text-[10px] font-medium transition-all ${
                        isActive
                          ? 'border-[#FF5A00] bg-neutral-950 text-white'
                          : 'border-neutral-300 bg-white text-neutral-700 hover:border-neutral-950'
                      }`}
                    >
                      <span
                        className="h-2.5 w-2.5 shrink-0 border border-black/15"
                        style={{ backgroundColor: flavor.colorHex }}
                      />
                      <span className="max-w-[78px] truncate">{flavor.name.split(' ')[0]}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Price & Actions */}
        <div className="mt-4 flex items-end justify-between gap-2 border-t border-neutral-100 pt-3">
          <div>
            <div className="font-mono text-lg font-bold text-[#FF5A00] tabular-nums">
              {formatVND(activePrice)}
            </div>
            {product.compareAtPrice && product.compareAtPrice > activePrice && (
              <div className="font-mono text-xs text-neutral-400 line-through tabular-nums">
                {formatVND(product.compareAtPrice)}
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => onOpenDetail(product, selectedFlavor, 'image')}
              className="flex h-10 w-10 items-center justify-center border border-neutral-300 bg-white text-neutral-900 transition-colors hover:border-neutral-950"
              aria-label={`Xem nhanh ${product.name}`}
              title="Chi tiết & Thông số"
            >
              <Eye className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => onAddToCart(product, selectedFlavor)}
              className="flex h-10 items-center gap-1.5 bg-neutral-950 px-3.5 text-xs font-bold text-white transition-colors hover:bg-[#FF5A00] whitespace-nowrap"
            >
              <ShoppingBag className="h-3.5 w-3.5" />
              <span>Thêm giỏ</span>
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
