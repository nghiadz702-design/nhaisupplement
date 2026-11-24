import { useState } from 'react';
import {
  ArrowRight,
  Gift,
  Minus,
  Plus,
  ShoppingBag,
  Tag,
  Trash2,
  X,
} from 'lucide-react';
import type { CartItem } from '../types/product';
import { SHAKER_OPTIONS, formatVND } from '../data/catalog';
import { VOUCHERS, evaluateVoucher } from '../data/vouchers';

interface CartDrawerProps {
  isOpen: boolean;
  items: CartItem[];
  isFirstOrder: boolean;
  onChangeFirstOrder: (next: boolean) => void;
  shakerId: string;
  onChangeShakerId: (next: string) => void;
  voucherCode: string;
  onChangeVoucherCode: (next: string) => void;
  onClose: () => void;
  onUpdateQty: (cartKey: string, nextQty: number) => void;
  onRemoveItem: (cartKey: string) => void;
  onGoToCheckout: () => void;
}

export default function CartDrawer({
  isOpen,
  items,
  isFirstOrder,
  onChangeFirstOrder,
  shakerId,
  onChangeShakerId,
  voucherCode,
  onChangeVoucherCode,
  onClose,
  onUpdateQty,
  onRemoveItem,
  onGoToCheckout,
}: CartDrawerProps) {
  const [voucherInput, setVoucherInput] = useState(voucherCode);

  if (!isOpen) return null;

  const subtotal = items.reduce((sum, item) => {
    const unitPrice = item.selectedFlavor.priceOverride ?? item.product.price;
    return sum + unitPrice * item.quantity;
  }, 0);

  const hasFreeShaker = items.some((item) => item.product.isWaterMixPowder);
  const voucherEval = evaluateVoucher(voucherCode, subtotal);
  const baseShippingFee = items.length === 0 ? 0 : 25000;
  const finalShippingFee = isFirstOrder ? 0 : baseShippingFee;
  const grandTotal = Math.max(0, subtotal - voucherEval.discount + finalShippingFee);

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/70"
      role="dialog"
      aria-modal="true"
      aria-label="Giỏ hàng NhaiSupplement"
    >
      <div className="flex h-full w-full max-w-lg flex-col border-l-2 border-neutral-950 bg-white">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-200 bg-neutral-950 px-5 py-4 text-white">
          <div className="flex items-center gap-2.5">
            <ShoppingBag className="h-5 w-5 text-[#FF5A00]" />
            <h2 className="font-display text-xl font-extrabold uppercase tracking-wide">
              Giỏ hàng của bạn ({items.reduce((s, i) => s + i.quantity, 0)})
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng giỏ hàng"
            className="flex h-9 w-9 items-center justify-center border border-neutral-700 text-white transition-colors hover:border-[#FF5A00] hover:bg-[#FF5A00]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {items.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center py-16 text-center">
              <ShoppingBag className="h-12 w-12 text-neutral-300" />
              <h3 className="mt-4 font-display text-2xl font-bold uppercase text-neutral-950">
                Giỏ hàng đang trống
              </h3>
              <p className="mt-2 max-w-xs text-xs leading-relaxed text-neutral-600">
                Chọn hương vị yêu thích trên từng sản phẩm để xem ảnh thực tế đổi ngay lập tức và
                thêm vào giỏ. Đơn đầu tiên được Freeship từ kho Hà Nội toàn quốc.
              </p>
              <button
                type="button"
                onClick={onClose}
                className="mt-6 bg-[#FF5A00] px-6 py-3 text-xs font-bold uppercase tracking-wide text-white transition-colors hover:bg-neutral-950"
              >
                Khám phá 62 sản phẩm
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Cart Items List */}
              <div className="divide-y divide-neutral-200 border border-neutral-200">
                {items.map((item) => {
                  const unitPrice = item.selectedFlavor.priceOverride ?? item.product.price;
                  return (
                    <div key={item.cartKey} className="flex gap-3 p-3">
                      <img
                        src={item.selectedFlavor.image}
                        alt={`${item.product.name} - ${item.selectedFlavor.name}`}
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          if (e.currentTarget.src !== item.selectedFlavor.fallbackImage) {
                            e.currentTarget.src = item.selectedFlavor.fallbackImage;
                          }
                        }}
                        className="h-20 w-20 shrink-0 border border-neutral-200 bg-white object-contain p-1"
                      />
                      <div className="flex flex-1 flex-col justify-between">
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="text-xs font-bold leading-snug text-neutral-950">
                              {item.product.name}
                            </h4>
                            <button
                              type="button"
                              onClick={() => onRemoveItem(item.cartKey)}
                              aria-label={`Xóa ${item.product.name}`}
                              className="text-neutral-400 hover:text-red-600"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                          <div className="mt-1 flex items-center gap-1.5 text-[11px] text-neutral-600">
                            <span
                              className="inline-block h-2.5 w-2.5 border border-black/20"
                              style={{ backgroundColor: item.selectedFlavor.colorHex }}
                            />
                            <span>Vị: {item.selectedFlavor.name}</span>
                          </div>
                          {item.product.isWaterMixPowder && (
                            <span className="mt-1 inline-block text-[10px] font-semibold text-[#FF5A00]">
                              Bột pha nước · Hợp lệ tặng Bình Lắc
                            </span>
                          )}
                        </div>

                        <div className="mt-2 flex items-center justify-between">
                          <div className="flex items-center border border-neutral-300">
                            <button
                              type="button"
                              onClick={() => onUpdateQty(item.cartKey, item.quantity - 1)}
                              className="flex h-7 w-7 items-center justify-center hover:bg-neutral-100"
                              aria-label="Giảm số lượng"
                            >
                              <Minus className="h-3 w-3" />
                            </button>
                            <span className="w-7 text-center font-mono text-xs font-bold tabular-nums">
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => onUpdateQty(item.cartKey, item.quantity + 1)}
                              className="flex h-7 w-7 items-center justify-center hover:bg-neutral-100"
                              aria-label="Tăng số lượng"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>
                          <span className="font-mono text-sm font-bold text-neutral-950 tabular-nums">
                            {formatVND(unitPrice * item.quantity)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Complementary Shaker Gift Module (ONLY for water-mix powder products) */}
              <div
                className={`border p-3.5 ${
                  hasFreeShaker
                    ? 'border-[#FF5A00] bg-orange-50/70'
                    : 'border-neutral-200 bg-neutral-100'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Gift
                      className={`h-4 w-4 shrink-0 ${
                        hasFreeShaker ? 'text-[#FF5A00]' : 'text-neutral-500'
                      }`}
                    />
                    <span className="text-xs font-bold text-neutral-950">
                      {hasFreeShaker
                        ? 'Quà tặng tự động: Bình Lắc 0đ'
                        : 'Chưa đủ điều kiện tặng Bình Lắc'}
                    </span>
                  </div>
                  {hasFreeShaker && (
                    <span className="font-mono text-xs font-bold text-[#FF5A00]">MIỄN PHÍ</span>
                  )}
                </div>

                {hasFreeShaker ? (
                  <div className="mt-2.5 space-y-2">
                    <p className="text-[11px] text-neutral-700">
                      Đơn hàng có sản phẩm dạng bột pha với nước. Chọn mẫu bình lắc tặng kèm:
                    </p>
                    <div className="space-y-1.5">
                      {SHAKER_OPTIONS.map((opt) => (
                        <label
                          key={opt.id}
                          className={`flex cursor-pointer items-center justify-between border p-2 text-xs transition-colors ${
                            shakerId === opt.id
                              ? 'border-[#FF5A00] bg-white'
                              : 'border-neutral-200 bg-white/70 hover:border-neutral-400'
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            <input
                              type="radio"
                              name="shakerOption"
                              checked={shakerId === opt.id}
                              onChange={() => onChangeShakerId(opt.id)}
                              className="accent-[#FF5A00]"
                            />
                            <span
                              className="h-3 w-3 border border-black/20"
                              style={{ backgroundColor: opt.colorHex }}
                            />
                            <span className="font-semibold text-neutral-950">{opt.name}</span>
                          </span>
                          <span className="font-mono text-[10px] text-neutral-500">{opt.capacity}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="mt-1.5 text-[11px] leading-relaxed text-neutral-600">
                    Bình lắc 0đ chỉ áp dụng khi đơn hàng có ít nhất 1 sản phẩm dạng bột pha với nước
                    (Whey, Creatine, Mass, Pre-Workout, EAA, BCAA). Bánh Bar, Vitamin &amp; Dầu cá
                    không áp dụng quà bình lắc.
                  </p>
                )}
              </div>

              {/* Voucher Input Box */}
              <div className="border border-neutral-200 bg-white p-3.5">
                <label className="flex items-center gap-1.5 text-xs font-bold text-neutral-950">
                  <Tag className="h-3.5 w-3.5 text-[#FF5A00]" />
                  <span>Mã giảm giá</span>
                </label>
                <div className="mt-2 flex gap-2">
                  <input
                    type="text"
                    value={voucherInput}
                    onChange={(e) => setVoucherInput(e.target.value)}
                    placeholder="NHAI10, NHAI100K, NHAI50K"
                    className="h-9 flex-1 border border-neutral-300 px-3 font-mono text-xs uppercase focus:border-[#FF5A00] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => onChangeVoucherCode(voucherInput.trim().toUpperCase())}
                    className="h-9 bg-neutral-950 px-3.5 text-xs font-bold uppercase text-white hover:bg-[#FF5A00]"
                  >
                    Áp dụng
                  </button>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {VOUCHERS.map((v) => (
                    <button
                      key={v.code}
                      type="button"
                      onClick={() => {
                        setVoucherInput(v.code);
                        onChangeVoucherCode(v.code);
                      }}
                      className={`border px-2 py-0.5 font-mono text-[10px] font-bold ${
                        voucherCode === v.code
                          ? 'border-[#FF5A00] bg-[#FF5A00] text-white'
                          : 'border-neutral-300 bg-neutral-50 text-neutral-700 hover:border-neutral-950'
                      }`}
                    >
                      {v.code} ({v.title})
                    </button>
                  ))}
                </div>
                {voucherEval.message && (
                  <p
                    className={`mt-1.5 text-[11px] font-semibold ${
                      voucherEval.valid ? 'text-emerald-700' : 'text-red-600'
                    }`}
                  >
                    {voucherEval.message}
                  </p>
                )}
              </div>

              {/* First Order Freeship Toggle */}
              <div className="border border-neutral-950 bg-neutral-50 p-3.5">
                <label className="flex cursor-pointer items-start gap-2.5">
                  <input
                    type="checkbox"
                    checked={isFirstOrder}
                    onChange={(e) => onChangeFirstOrder(e.target.checked)}
                    className="mt-0.5 h-4 w-4 accent-[#FF5A00]"
                  />
                  <div className="text-xs">
                    <span className="font-bold text-neutral-950">
                      Áp dụng Freeship cho người đầu tiên (Đơn đầu = 0đ ship)
                    </span>
                    <p className="mt-0.5 text-[11px] text-neutral-600">
                      Kho hàng Hà Nội giao nhanh toàn quốc. Giảm 100% phí vận chuyển cho khách hàng
                      mua lần đầu tại nhaisupplement.com.
                    </p>
                  </div>
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Footer Totals & Redirect CTA to /thanh-toan */}
        {items.length > 0 && (
          <div className="space-y-3 border-t border-neutral-200 bg-neutral-50 p-5">
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between text-neutral-600">
                <span>Tạm tính ({items.reduce((s, i) => s + i.quantity, 0)} sản phẩm)</span>
                <span className="font-mono font-semibold text-neutral-950 tabular-nums">
                  {formatVND(subtotal)}
                </span>
              </div>
              {voucherEval.discount > 0 && (
                <div className="flex justify-between font-semibold text-[#FF5A00]">
                  <span>Voucher {voucherEval.code}</span>
                  <span className="font-mono tabular-nums">
                    -{formatVND(voucherEval.discount)}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-neutral-600">
                <span>Phí ship toàn quốc</span>
                <span className="font-mono tabular-nums">
                  {isFirstOrder ? (
                    <strong className="text-[#FF5A00]">0đ (Freeship đơn đầu)</strong>
                  ) : (
                    formatVND(finalShippingFee)
                  )}
                </span>
              </div>
              {hasFreeShaker && (
                <div className="flex justify-between font-semibold text-[#FF5A00]">
                  <span>Bình lắc tặng kèm (Đơn bột pha nước)</span>
                  <span className="font-mono">0đ</span>
                </div>
              )}
              <div className="flex justify-between border-t border-neutral-200 pt-2 text-base font-bold text-neutral-950">
                <span>Tổng tạm tính</span>
                <span className="font-mono text-[#FF5A00] tabular-nums">
                  {formatVND(grandTotal)}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={onGoToCheckout}
              className="flex h-12 w-full items-center justify-center gap-2 bg-[#FF5A00] text-xs font-bold uppercase tracking-wider text-white transition-colors hover:bg-neutral-950"
            >
              <span>Đến trang thanh toán</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
