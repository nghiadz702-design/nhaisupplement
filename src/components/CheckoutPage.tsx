import { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Gift,
  Loader2,
  MessageCircle,
  Tag,
  Truck,
} from 'lucide-react';
import type { CartItem, OrderConfirmation } from '../types/product';
import {
  BRAND_INFO,
  FREE_SHAKER_MIN_SUBTOTAL,
  SHAKER_OPTIONS,
  VIETNAM_PROVINCES,
  formatVND,
} from '../data/catalog';
import { VOUCHERS, evaluateVoucher } from '../data/vouchers';

interface CheckoutPageProps {
  items: CartItem[];
  isFirstOrder: boolean;
  onChangeFirstOrder: (next: boolean) => void;
  shakerId: string;
  onChangeShakerId: (next: string) => void;
  voucherCode: string;
  onChangeVoucherCode: (next: string) => void;
  onBackToShop: () => void;
  onClearCart: () => void;
}

interface FieldErrors {
  name?: string;
  phone?: string;
  address?: string;
  note?: string;
}

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateOrderCode(): string {
  const bytes = new Uint8Array(6);
  if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 6; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  let code = '';
  for (const b of bytes) code += CODE_ALPHABET[b % CODE_ALPHABET.length];
  return `NHAI-${code}`;
}

function validateOrderForm(data: {
  name: string;
  phone: string;
  address: string;
  note: string;
}): FieldErrors {
  const errors: FieldErrors = {};
  const trimmedName = data.name.trim();
  if (trimmedName.length < 2) {
    errors.name = 'Vui lòng nhập họ tên (ít nhất 2 ký tự).';
  } else if (trimmedName.length > 120) {
    errors.name = 'Họ tên ngắn hơn 120 ký tự nhé.';
  }

  const cleanPhone = data.phone.replace(/[\s.\-()]/g, '');
  if (!/^(\+84|84|0)\d{8,10}$/.test(cleanPhone)) {
    errors.phone = 'Số điện thoại không hợp lệ (ví dụ 094618430 hoặc 0901234567).';
  }

  const trimmedAddr = data.address.trim();
  if (trimmedAddr.length < 5) {
    errors.address = 'Vui lòng nhập địa chỉ giao hàng chi tiết.';
  } else if (trimmedAddr.length > 300) {
    errors.address = 'Địa chỉ ngắn hơn 300 ký tự nhé.';
  }

  if (data.note.trim().length > 500) {
    errors.note = 'Ghi chú tối đa 500 ký tự.';
  }

  return errors;
}

export default function CheckoutPage({
  items,
  isFirstOrder,
  onChangeFirstOrder,
  shakerId,
  onChangeShakerId,
  voucherCode,
  onChangeVoucherCode,
  onBackToShop,
  onClearCart,
}: CheckoutPageProps) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [province, setProvince] = useState(VIETNAM_PROVINCES[0]);
  const [address, setAddress] = useState('');
  const [note, setNote] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cod' | 'vietqr'>('cod');
  const [voucherInput, setVoucherInput] = useState(voucherCode);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState<
    (OrderConfirmation & { paymentMethod: 'cod' | 'vietqr'; voucherCode: string; voucherDiscount: number }) | null
  >(null);

  const subtotal = items.reduce(
    (sum, item) => sum + (item.selectedFlavor.priceOverride ?? item.product.price) * item.quantity,
    0,
  );
  const totalItemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const hasFreeShaker = subtotal >= FREE_SHAKER_MIN_SUBTOTAL;
  const selectedShaker = SHAKER_OPTIONS.find((s) => s.id === shakerId) ?? SHAKER_OPTIONS[0];

  const voucherEval = evaluateVoucher(voucherCode, subtotal);
  const isHanoi = province.startsWith('Hà Nội');
  const baseShippingFee = items.length === 0 ? 0 : isHanoi ? 20000 : 30000;
  const shippingDiscount = isFirstOrder ? baseShippingFee : 0;
  const finalShippingFee = baseShippingFee - shippingDiscount;
  const grandTotal = Math.max(0, subtotal - voucherEval.discount + finalShippingFee);

  const handleFieldChange = (field: keyof FieldErrors | 'province', val: string) => {
    if (field === 'name') setName(val);
    if (field === 'phone') setPhone(val);
    if (field === 'address') setAddress(val);
    if (field === 'note') setNote(val);
    if (field === 'province') setProvince(val);
    if (field in errors) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const handleApplyVoucher = () => {
    onChangeVoucherCode(voucherInput.trim().toUpperCase());
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const nextErrors = validateOrderForm({ name, phone, address, note });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0 || items.length === 0) return;

    setSubmitting(true);
    window.setTimeout(() => {
      const orderCode = generateOrderCode();
      setConfirmed({
        orderCode,
        createdAt: new Date().toLocaleString('vi-VN'),
        customer: {
          fullName: name.trim(),
          phone: phone.trim(),
          province,
          address: address.trim(),
          note: note.trim(),
          isFirstOrder,
          shakerId,
        },
        items: [...items],
        subtotal,
        shippingFee: finalShippingFee,
        shippingDiscount,
        total: grandTotal,
        hasFreeShaker,
        selectedShaker: hasFreeShaker ? selectedShaker : undefined,
        paymentMethod,
        voucherCode: voucherEval.valid ? voucherEval.code : '',
        voucherDiscount: voucherEval.discount,
      });
      setSubmitting(false);
      onClearCart();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 350);
  };

  const inputBaseClass =
    'w-full border bg-white px-4 py-3 text-sm text-neutral-950 outline-none transition-colors placeholder:text-neutral-400 focus:border-[#FF5A00]';

  // 1. Order Confirmed Screen (adapted cleanly from project-journey-migrator/thanh-toan)
  if (confirmed) {
    return (
      <section className="bg-white py-14 sm:py-20">
        <div className="mx-auto max-w-2xl px-4 text-center sm:px-6">
          <CheckCircle2 className="mx-auto h-12 w-12 text-[#FF5A00]" strokeWidth={1.6} />
          <h1 className="mt-5 font-display text-4xl font-extrabold uppercase tracking-tight text-neutral-950 sm:text-5xl">
            Đã nhận đơn của bạn
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-neutral-600">
            Cảm ơn bạn đã đặt hàng tại <strong>{BRAND_INFO.domain}</strong>. Kho Hà Nội đã tiếp
            nhận đơn và sẽ liên hệ xác nhận qua số <strong>{confirmed.customer.phone}</strong> trước
            khi xuất kho giao toàn quốc.
          </p>

          <div className="mt-8 border-2 border-[#FF5A00] bg-neutral-950 px-6 py-5 text-white">
            <span className="block text-[11px] font-bold uppercase tracking-[0.25em] text-neutral-400">
              Mã đơn của bạn
            </span>
            <span className="mt-2 block font-mono text-3xl font-extrabold tracking-wider text-[#FF5A00] tabular-nums">
              {confirmed.orderCode}
            </span>
            <span className="mt-1 block text-xs text-neutral-400">{confirmed.createdAt}</span>
          </div>

          <div className="mt-6 border border-neutral-200 bg-neutral-50 p-5 text-left text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200 pb-3">
              <span className="font-bold uppercase tracking-wide text-neutral-950">
                Chi tiết đơn hàng ({confirmed.items.reduce((s, i) => s + i.quantity, 0)} sản phẩm)
              </span>
              <span className="font-semibold text-[#FF5A00]">
                {confirmed.paymentMethod === 'cod'
                  ? 'Thanh toán khi nhận hàng (COD)'
                  : 'Chuyển khoản / VietQR'}
              </span>
            </div>

            <ul className="divide-y divide-neutral-200">
              {confirmed.items.map((item) => (
                <li key={item.cartKey} className="flex items-center justify-between gap-3 py-2.5">
                  <div>
                    <p className="font-bold text-neutral-950">{item.product.name}</p>
                    <p className="text-neutral-500">
                      Vị: {item.selectedFlavor.name} · ×{item.quantity}
                    </p>
                  </div>
                  <span className="font-mono font-bold text-neutral-950 tabular-nums">
                    {formatVND(
                      (item.selectedFlavor.priceOverride ?? item.product.price) * item.quantity,
                    )}
                  </span>
                </li>
              ))}
              {confirmed.hasFreeShaker && confirmed.selectedShaker && (
                <li className="flex items-center justify-between gap-3 py-2.5 text-[#FF5A00]">
                  <span className="font-bold">Quà tặng: {confirmed.selectedShaker.name}</span>
                  <span className="font-mono font-bold">0đ</span>
                </li>
              )}
            </ul>

            <div className="mt-3 space-y-1 border-t border-neutral-200 pt-3">
              <div className="flex justify-between text-neutral-600">
                <span>Giao tới ({confirmed.customer.province})</span>
                <span>{confirmed.customer.address}</span>
              </div>
              {confirmed.voucherDiscount > 0 && (
                <div className="flex justify-between text-[#FF5A00]">
                  <span>Voucher ({confirmed.voucherCode})</span>
                  <span className="font-mono tabular-nums">
                    -{formatVND(confirmed.voucherDiscount)}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-neutral-600">
                <span>Phí ship</span>
                <span className="font-mono font-bold text-[#FF5A00]">
                  {confirmed.shippingFee === 0 ? '0đ (Miễn phí)' : formatVND(confirmed.shippingFee)}
                </span>
              </div>
              <div className="flex justify-between pt-1.5 text-sm font-bold text-neutral-950">
                <span>Tổng thanh toán (Demo)</span>
                <span className="font-mono text-[#FF5A00] tabular-nums">
                  {formatVND(confirmed.total)}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={onBackToShop}
              className="inline-flex h-12 items-center gap-2 bg-[#FF5A00] px-6 text-xs font-bold uppercase tracking-wider text-white transition-colors hover:bg-neutral-950"
            >
              <span>Xem thêm sản phẩm</span>
              <ArrowRight className="h-4 w-4" />
            </button>
            <a
              href={BRAND_INFO.zaloUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-12 items-center gap-2 border-2 border-neutral-950 bg-white px-6 text-xs font-bold uppercase tracking-wider text-neutral-950 transition-colors hover:bg-neutral-950 hover:text-white"
            >
              <MessageCircle className="h-4 w-4 text-[#FF5A00]" />
              <span>Nhắn Zalo cho shop ({BRAND_INFO.phone})</span>
            </a>
          </div>
        </div>
      </section>
    );
  }

  // 2. Empty Cart State
  if (items.length === 0) {
    return (
      <section className="bg-white py-20">
        <div className="mx-auto max-w-xl px-4 text-center sm:px-6">
          <h1 className="font-display text-4xl font-extrabold uppercase tracking-tight text-neutral-950 sm:text-5xl">
            Giỏ hàng đang trống
          </h1>
          <p className="mt-3 text-sm text-neutral-600">
            Hãy thêm sản phẩm và hương vị yêu thích vào giỏ trước khi chuyển sang bước thanh toán nhé.
          </p>
          <button
            type="button"
            onClick={onBackToShop}
            className="mt-7 inline-flex h-12 items-center gap-2 bg-[#FF5A00] px-7 text-xs font-bold uppercase tracking-wider text-white transition-colors hover:bg-neutral-950"
          >
            <span>Xem sản phẩm</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </section>
    );
  }

  // 3. Dedicated Two-Column Checkout Form & Sticky Order Summary (/thanh-toan)
  return (
    <section className="bg-neutral-50 py-10 sm:py-14">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <button
          type="button"
          onClick={onBackToShop}
          className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-neutral-600 transition-colors hover:text-[#FF5A00]"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Quay lại cửa hàng NhaiSupplement</span>
        </button>

        <div className="mt-5">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#FF5A00]">
            Đặt hàng · {BRAND_INFO.domain}
          </p>
          <h1 className="mt-2 font-display text-4xl font-extrabold uppercase tracking-tight text-neutral-950 sm:text-5xl">
            Thông tin giao hàng
          </h1>
          <p className="mt-2 text-sm text-neutral-600">
            Xuất kho từ Hà Nội, giao hàng toàn quốc. Điền thông tin bên dưới để hoàn tất đơn hàng
            nhanh chóng.
          </p>
        </div>

        <div className="mt-8 grid gap-8 lg:grid-cols-[1.2fr_1fr]">
          {/* Left Column: Customer Delivery Form */}
          <form onSubmit={handleSubmit} noValidate className="space-y-5 border border-neutral-200 bg-white p-6">
            <div>
              <label htmlFor="checkout-name" className="block text-xs font-bold uppercase tracking-wide text-neutral-950">
                Họ và tên *
              </label>
              <input
                id="checkout-name"
                name="name"
                value={name}
                onChange={(e) => handleFieldChange('name', e.target.value)}
                aria-invalid={Boolean(errors.name)}
                placeholder="Nguyễn Văn A"
                className={`mt-1.5 ${inputBaseClass} ${errors.name ? 'border-red-600' : 'border-neutral-300'}`}
              />
              {errors.name && <p className="mt-1.5 text-xs font-semibold text-red-600">{errors.name}</p>}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="checkout-phone" className="block text-xs font-bold uppercase tracking-wide text-neutral-950">
                  Số điện thoại *
                </label>
                <input
                  id="checkout-phone"
                  name="phone"
                  type="tel"
                  inputMode="tel"
                  value={phone}
                  onChange={(e) => handleFieldChange('phone', e.target.value)}
                  aria-invalid={Boolean(errors.phone)}
                  placeholder="094618430"
                  className={`mt-1.5 ${inputBaseClass} ${errors.phone ? 'border-red-600' : 'border-neutral-300'}`}
                />
                {errors.phone && (
                  <p className="mt-1.5 text-xs font-semibold text-red-600">{errors.phone}</p>
                )}
              </div>

              <div>
                <label htmlFor="checkout-province" className="block text-xs font-bold uppercase tracking-wide text-neutral-950">
                  Tỉnh / Thành phố *
                </label>
                <select
                  id="checkout-province"
                  value={province}
                  onChange={(e) => handleFieldChange('province', e.target.value)}
                  className={`mt-1.5 ${inputBaseClass} border-neutral-300`}
                >
                  {VIETNAM_PROVINCES.map((prov) => (
                    <option key={prov} value={prov}>
                      {prov}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="checkout-address" className="block text-xs font-bold uppercase tracking-wide text-neutral-950">
                Địa chỉ giao hàng *
              </label>
              <textarea
                id="checkout-address"
                name="address"
                rows={2}
                value={address}
                onChange={(e) => handleFieldChange('address', e.target.value)}
                aria-invalid={Boolean(errors.address)}
                placeholder="Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành"
                className={`mt-1.5 resize-none ${inputBaseClass} ${errors.address ? 'border-red-600' : 'border-neutral-300'}`}
              />
              {errors.address && (
                <p className="mt-1.5 text-xs font-semibold text-red-600">{errors.address}</p>
              )}
            </div>

            <div>
              <label htmlFor="checkout-note" className="block text-xs font-bold uppercase tracking-wide text-neutral-950">
                Ghi chú <span className="font-normal text-neutral-500">(không bắt buộc)</span>
              </label>
              <textarea
                id="checkout-note"
                name="note"
                rows={2}
                maxLength={500}
                value={note}
                onChange={(e) => handleFieldChange('note', e.target.value)}
                aria-invalid={Boolean(errors.note)}
                placeholder="Giao giờ hành chính, gọi trước khi giao, chọn vị bình lắc..."
                className={`mt-1.5 resize-none ${inputBaseClass} ${errors.note ? 'border-red-600' : 'border-neutral-300'}`}
              />
              {errors.note && <p className="mt-1.5 text-xs font-semibold text-red-600">{errors.note}</p>}
            </div>

            {/* Shaker Picker when eligible */}
            {hasFreeShaker && (
              <div className="border border-[#FF5A00] bg-orange-50/70 p-4">
                <div className="flex items-center gap-2 text-xs font-bold text-neutral-950">
                  <Gift className="h-4 w-4 text-[#FF5A00]" />
                  <span>Chọn Bình Lắc Tặng Kèm 0đ (Đơn từ 500.000đ)</span>
                </div>
                <div className="mt-2.5 grid grid-cols-1 gap-2">
                  {SHAKER_OPTIONS.map((opt) => (
                    <label
                      key={opt.id}
                      className={`flex cursor-pointer items-center justify-between border p-2.5 text-xs ${
                        shakerId === opt.id
                          ? 'border-[#FF5A00] bg-white font-semibold'
                          : 'border-neutral-200 bg-white/80'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="checkoutShaker"
                          checked={shakerId === opt.id}
                          onChange={() => onChangeShakerId(opt.id)}
                          className="accent-[#FF5A00]"
                        />
                        <span
                          className="h-3 w-3 border border-black/20"
                          style={{ backgroundColor: opt.colorHex }}
                        />
                        <span>{opt.name}</span>
                      </span>
                      <span className="font-mono text-[10px] text-neutral-500">{opt.capacity}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* First-Order Freeship & Payment Options */}
            <div className="space-y-3 border-t border-neutral-200 pt-4">
              <label className="flex cursor-pointer items-start gap-2.5 border border-neutral-950 bg-neutral-50 p-3 text-xs">
                <input
                  type="checkbox"
                  checked={isFirstOrder}
                  onChange={(e) => onChangeFirstOrder(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-[#FF5A00]"
                />
                <div>
                  <span className="font-bold text-neutral-950">
                    Freeship cho đơn hàng đầu tiên (0đ ship)
                  </span>
                  <p className="mt-0.5 text-neutral-600">
                    Kho Hà Nội miễn 100% phí vận chuyển toàn quốc cho khách hàng đặt đơn đầu tiên.
                  </p>
                </div>
              </label>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('cod')}
                  className={`border p-3 text-left text-xs transition-colors ${
                    paymentMethod === 'cod'
                      ? 'border-[#FF5A00] bg-neutral-950 text-white'
                      : 'border-neutral-300 bg-white text-neutral-800 hover:border-neutral-950'
                  }`}
                >
                  <span className="block font-bold">Thanh toán khi nhận hàng (COD)</span>
                  <span className="mt-0.5 block text-[11px] opacity-75">
                    Kiểm tra nguyên seal trước khi trả tiền
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('vietqr')}
                  className={`border p-3 text-left text-xs transition-colors ${
                    paymentMethod === 'vietqr'
                      ? 'border-[#FF5A00] bg-neutral-950 text-white'
                      : 'border-neutral-300 bg-white text-neutral-800 hover:border-neutral-950'
                  }`}
                >
                  <span className="block font-bold">Chuyển khoản / VietQR</span>
                  <span className="mt-0.5 block text-[11px] opacity-75">
                    Demo không phát sinh giao dịch thật
                  </span>
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="flex h-12 w-full items-center justify-center gap-2 bg-[#FF5A00] text-xs font-bold uppercase tracking-wider text-white transition-colors hover:bg-neutral-950 disabled:opacity-60"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Đang gửi đơn…</span>
                </>
              ) : (
                <span>Gửi đơn đặt hàng · {formatVND(grandTotal)}</span>
              )}
            </button>

            <p className="text-center text-xs text-neutral-500">
              Website Portfolio Demo — không thu tiền thật. Khách hàng kiểm tra hàng thoải mái trước khi thanh toán.
            </p>
          </form>

          {/* Right Column: Sticky Order Summary Card ("Đơn của bạn") */}
          <aside className="h-fit border-2 border-neutral-950 bg-white p-6 lg:sticky lg:top-24">
            <h2 className="font-display text-2xl font-extrabold uppercase tracking-tight text-neutral-950">
              Đơn của bạn
            </h2>

            <ul className="mt-4 divide-y divide-neutral-200 border-y border-neutral-200">
              {items.map((item) => {
                const unitPrice = item.selectedFlavor.priceOverride ?? item.product.price;
                return (
                  <li key={item.cartKey} className="flex items-center gap-3 py-3">
                    <img
                      src={item.selectedFlavor.image}
                      alt={`${item.product.name} - ${item.selectedFlavor.name}`}
                      onError={(e) => {
                        if (e.currentTarget.src !== item.selectedFlavor.fallbackImage) {
                          e.currentTarget.src = item.selectedFlavor.fallbackImage;
                        }
                      }}
                      className="h-12 w-12 shrink-0 border border-neutral-200 bg-white object-contain p-0.5"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-bold text-neutral-950">
                        {item.product.name}
                      </p>
                      <p className="truncate text-[11px] text-neutral-500">
                        Vị: {item.selectedFlavor.name}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="block font-mono text-xs text-neutral-500 tabular-nums">
                        ×{item.quantity}
                      </span>
                      <span className="font-mono text-xs font-bold text-neutral-950 tabular-nums">
                        {formatVND(unitPrice * item.quantity)}
                      </span>
                    </div>
                  </li>
                );
              })}

              {hasFreeShaker && (
                <li className="flex items-center justify-between gap-2 bg-orange-50/70 px-2 py-2.5 text-xs">
                  <span className="font-bold text-neutral-950">
                    Quà tặng: {selectedShaker.name}
                  </span>
                  <span className="font-mono font-bold text-[#FF5A00]">0đ</span>
                </li>
              )}
            </ul>

            {/* Voucher Input Box */}
            <div className="mt-4">
              <label className="flex items-center gap-1.5 text-xs font-bold uppercase text-neutral-950">
                <Tag className="h-3.5 w-3.5 text-[#FF5A00]" />
                <span>Mã giảm giá NhaiSupplement</span>
              </label>
              <div className="mt-1.5 flex gap-2">
                <input
                  type="text"
                  value={voucherInput}
                  onChange={(e) => setVoucherInput(e.target.value)}
                  placeholder="Nhập NHAI10, NHAI100K..."
                  className="h-10 flex-1 border border-neutral-300 px-3 font-mono text-xs uppercase focus:border-[#FF5A00] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleApplyVoucher}
                  className="h-10 bg-neutral-950 px-4 text-xs font-bold uppercase text-white transition-colors hover:bg-[#FF5A00]"
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
                    className={`border px-2 py-1 font-mono text-[10px] font-bold transition-colors ${
                      voucherCode === v.code
                        ? 'border-[#FF5A00] bg-[#FF5A00] text-white'
                        : 'border-neutral-300 bg-neutral-50 text-neutral-700 hover:border-neutral-950'
                    }`}
                    title={v.description}
                  >
                    {v.code} · {v.title}
                  </button>
                ))}
              </div>
              {voucherEval.message && (
                <p
                  className={`mt-1.5 text-xs font-semibold ${
                    voucherEval.valid ? 'text-emerald-700' : 'text-red-600'
                  }`}
                >
                  {voucherEval.message}
                </p>
              )}
            </div>

            {/* Totals Breakdown */}
            <div className="mt-5 space-y-2 border-t border-neutral-200 pt-4 text-xs">
              <div className="flex justify-between text-neutral-600">
                <span>Tổng số sản phẩm</span>
                <span className="font-mono font-semibold text-neutral-950 tabular-nums">
                  {totalItemCount} sản phẩm
                </span>
              </div>
              <div className="flex justify-between text-neutral-600">
                <span>Tạm tính</span>
                <span className="font-mono font-semibold text-neutral-950 tabular-nums">
                  {formatVND(subtotal)}
                </span>
              </div>
              {voucherEval.discount > 0 && (
                <div className="flex justify-between font-semibold text-[#FF5A00]">
                  <span>Giảm giá ({voucherEval.code})</span>
                  <span className="font-mono tabular-nums">
                    -{formatVND(voucherEval.discount)}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-neutral-600">
                <span className="flex items-center gap-1">
                  <Truck className="h-3.5 w-3.5 text-[#FF5A00]" />
                  <span>Phí ship ({isHanoi ? 'Nội thành Hà Nội' : 'Toàn quốc'})</span>
                </span>
                <span className="font-mono font-bold text-[#FF5A00] tabular-nums">
                  {isFirstOrder ? '0đ (Freeship đơn đầu)' : formatVND(finalShippingFee)}
                </span>
              </div>
              <div className="flex items-baseline justify-between border-t border-neutral-950 pt-3">
                <span className="text-sm font-bold uppercase text-neutral-950">Tổng thanh toán</span>
                <span className="font-mono text-2xl font-extrabold text-[#FF5A00] tabular-nums">
                  {formatVND(grandTotal)}
                </span>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
