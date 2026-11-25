import { useState } from 'react';
import {
  CheckCircle2,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  RefreshCw,
  ShieldCheck,
  Truck,
} from 'lucide-react';
import { BRAND_INFO } from '../data/catalog';

export default function InfoPoliciesContact() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);

  const handleContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim() || !message.trim()) return;
    setSent(true);
    setName('');
    setPhone('');
    setMessage('');
  };

  return (
    <div className="border-t border-neutral-200 bg-neutral-50">
      {/* Section 1: Chính sách cơ bản & Đổi trả khách hàng */}
      <section id="chinh-sach" className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          {/* Chính sách cơ bản */}
          <div className="border border-neutral-200 bg-white p-6 sm:p-8">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#FF5A00]">
              <ShieldCheck className="h-4 w-4" />
              <span>Chính sách cơ bản</span>
            </div>
            <h2 className="mt-2 font-display text-3xl font-extrabold uppercase tracking-tight text-neutral-950">
              Vận chuyển Hà Nội · Toàn quốc &amp; Ưu đãi
            </h2>

            <div className="mt-6 space-y-4 text-sm leading-relaxed text-neutral-700">
              <div className="border-b border-neutral-100 pb-3">
                <h3 className="flex items-center gap-2 font-bold text-neutral-950">
                  <Truck className="h-4 w-4 text-[#FF5A00]" />
                  <span>1. Giao hàng toàn quốc từ kho Hà Nội</span>
                </h3>
                <p className="mt-1 text-xs text-neutral-600">
                  Tất cả đơn hàng được đóng gói và xuất trực tiếp từ kho Hà Nội. Nội thành Hà Nội giao
                  hỏa tốc trong 2–4 giờ; các tỉnh thành khác trên toàn quốc nhận hàng sau 1–3 ngày
                  qua đối tác vận chuyển nhanh.
                </p>
              </div>

              <div className="border-b border-neutral-100 pb-3">
                <h3 className="font-bold text-neutral-950">
                  2. Freeship cho khách hàng đầu tiên
                </h3>
                <p className="mt-1 text-xs text-neutral-600">
                  Khách hàng đặt đơn đầu tiên tại <strong>{BRAND_INFO.domain}</strong> được miễn phí
                  100% cước vận chuyển toàn quốc (0đ ship) khi bật ưu đãi đơn đầu trong giỏ hàng.
                </p>
              </div>

              <div>
                <h3 className="font-bold text-neutral-950">
                  3. Tặng bình lắc 0đ cho đơn hàng từ 500.000đ
                </h3>
                <p className="mt-1 text-xs text-neutral-600">
                  Mọi đơn hàng có tổng giá trị sản phẩm từ 500.000đ trở lên sẽ tự động hiển thị mục
                  chọn tặng kèm 1 bình lắc thể thao 700ml (0đ) ngay trong giỏ hàng và trang thanh
                  toán.
                </p>
              </div>
            </div>
          </div>

          {/* Chính sách đổi trả khách hàng */}
          <div id="doi-tra" className="border border-neutral-950 bg-neutral-950 p-6 text-white sm:p-8">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#FF5A00]">
              <RefreshCw className="h-4 w-4" />
              <span>Khách hàng đổi trả</span>
            </div>
            <h2 className="mt-2 font-display text-3xl font-extrabold uppercase tracking-tight text-white">
              Chính sách đổi trả 7 ngày minh bạch
            </h2>

            <div className="mt-6 space-y-4 text-sm leading-relaxed text-neutral-300">
              <div className="border-b border-neutral-800 pb-3">
                <h3 className="font-bold text-white">1. Điều kiện áp dụng đổi trả</h3>
                <p className="mt-1 text-xs text-neutral-400">
                  Hỗ trợ đổi mới 1–1 hoặc hoàn tiền trong vòng 07 ngày kể từ khi nhận hàng nếu:
                  sản phẩm giao sai hương vị/trọng lượng đã đặt, bao bì móp méo rách tem niêm phong do
                  vận chuyển, hoặc có lỗi từ nhà sản xuất.
                </p>
              </div>

              <div className="border-b border-neutral-800 pb-3">
                <h3 className="font-bold text-white">2. Lưu ý khi kiểm hàng &amp; đổi vị</h3>
                <p className="mt-1 text-xs text-neutral-400">
                  Khách hàng vui lòng quay video mở hộp và giữ nguyên tem niêm phong nếu muốn đổi sang
                  hương vị khác khi chưa khui seal. Phí vận chuyển hai chiều do NhaiSupplement chi
                  trả 100% nếu lỗi phát sinh từ kho.
                </p>
              </div>

              <div>
                <h3 className="font-bold text-white">3. Kênh tiếp nhận đổi trả nhanh</h3>
                <p className="mt-1 text-xs text-neutral-400">
                  Nhắn mã đơn hàng kèm hình ảnh/video trực tiếp qua Zalo{' '}
                  <a
                    href={BRAND_INFO.zaloUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold text-[#FF5A00] underline"
                  >
                    {BRAND_INFO.phone}
                  </a>{' '}
                  hoặc email{' '}
                  <a
                    href={`mailto:${BRAND_INFO.email}`}
                    className="font-semibold text-[#FF5A00] underline"
                  >
                    {BRAND_INFO.email}
                  </a>{' '}
                  để được xử lý trong ngày.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 2: Liên hệ trực tiếp */}
      <section id="lien-he" className="border-t border-neutral-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
            {/* Direct Channels */}
            <div className="lg:col-span-5 space-y-5">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-[#FF5A00]">
                  Liên hệ trực tiếp
                </span>
                <h2 className="mt-1 font-display text-3xl font-extrabold uppercase tracking-tight text-neutral-950 sm:text-4xl">
                  Tư vấn Supplement &amp; Hỗ trợ đơn hàng
                </h2>
                <p className="mt-2 text-sm text-neutral-600">
                  Kết nối trực tiếp với NhaiSupplement qua SĐT, Zalo hoặc Gmail để được tư vấn chọn
                  Whey, Creatine, lịch dùng và kiểm tra tình trạng giao hàng toàn quốc.
                </p>
              </div>

              <div className="space-y-3">
                <a
                  href={`tel:${BRAND_INFO.phone}`}
                  className="flex items-center justify-between border border-neutral-200 p-4 transition-colors hover:border-[#FF5A00]"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center bg-neutral-950 text-[#FF5A00]">
                      <Phone className="h-5 w-5" />
                    </div>
                    <div>
                      <span className="block text-[11px] font-semibold uppercase text-neutral-500">
                        Hotline / SĐT trực tiếp
                      </span>
                      <span className="font-mono text-base font-bold text-neutral-950">
                        {BRAND_INFO.phone}
                      </span>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-[#FF5A00]">Gọi ngay</span>
                </a>

                <a
                  href={BRAND_INFO.zaloUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between border border-neutral-200 p-4 transition-colors hover:border-[#FF5A00]"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center bg-[#FF5A00] text-white">
                      <MessageCircle className="h-5 w-5" />
                    </div>
                    <div>
                      <span className="block text-[11px] font-semibold uppercase text-neutral-500">
                        Zalo Tư Vấn &amp; Đổi Trả
                      </span>
                      <span className="font-mono text-base font-bold text-neutral-950">
                        Zalo {BRAND_INFO.phone}
                      </span>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-[#FF5A00]">Chat Zalo</span>
                </a>

                <a
                  href={`mailto:${BRAND_INFO.email}`}
                  className="flex items-center justify-between border border-neutral-200 p-4 transition-colors hover:border-[#FF5A00]"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center bg-neutral-950 text-white">
                      <Mail className="h-5 w-5" />
                    </div>
                    <div>
                      <span className="block text-[11px] font-semibold uppercase text-neutral-500">
                        Email chính thức
                      </span>
                      <span className="text-sm font-bold text-neutral-950">
                        {BRAND_INFO.email}
                      </span>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-[#FF5A00]">Gửi mail</span>
                </a>

                <div className="flex items-center gap-3 border border-neutral-200 bg-neutral-50 p-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center bg-neutral-200 text-neutral-950">
                    <MapPin className="h-5 w-5" />
                  </div>
                  <div>
                    <span className="block text-[11px] font-semibold uppercase text-neutral-500">
                      Kho hàng chính
                    </span>
                    <span className="text-sm font-bold text-neutral-950">
                      {BRAND_INFO.warehouseAddress} · Ship toàn quốc
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Direct Message Form */}
            <div className="border border-neutral-950 bg-neutral-50 p-6 sm:p-8 lg:col-span-7">
              <h3 className="font-display text-2xl font-extrabold uppercase text-neutral-950">
                Gửi tin nhắn trực tiếp cho NhaiSupplement
              </h3>
              <p className="mt-1 text-xs text-neutral-600">
                Để lại thông tin sản phẩm cần tư vấn hoặc yêu cầu đổi trả, chúng tôi phản hồi qua
                SĐT/Zalo {BRAND_INFO.phone}.
              </p>

              {sent ? (
                <div className="mt-6 border border-[#FF5A00] bg-white p-5">
                  <div className="flex items-center gap-2 text-[#FF5A00]">
                    <CheckCircle2 className="h-5 w-5" />
                    <span className="font-bold text-neutral-950">
                      Đã ghi nhận yêu cầu liên hệ trực tiếp
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-neutral-600">
                    Cảm ơn bạn đã liên hệ NhaiSupplement. Để được hỗ trợ ngay lập tức, bạn cũng có
                    thể nhắn trực tiếp qua Zalo {BRAND_INFO.phone} hoặc email {BRAND_INFO.email}.
                  </p>
                  <button
                    type="button"
                    onClick={() => setSent(false)}
                    className="mt-4 bg-neutral-950 px-4 py-2 text-xs font-bold text-white hover:bg-[#FF5A00]"
                  >
                    Gửi tin nhắn khác
                  </button>
                </div>
              ) : (
                <form onSubmit={handleContactSubmit} className="mt-5 space-y-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-bold text-neutral-950">
                        Họ tên của bạn *
                      </label>
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Nhập họ tên"
                        className="mt-1 h-11 w-full border border-neutral-300 bg-white px-3 text-sm focus:border-[#FF5A00] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-neutral-950">
                        Số điện thoại / Zalo *
                      </label>
                      <input
                        type="tel"
                        required
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="Nhập SĐT hoặc Zalo"
                        className="mt-1 h-11 w-full border border-neutral-300 bg-white px-3 text-sm focus:border-[#FF5A00] focus:outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-neutral-950">
                      Nội dung cần tư vấn / đổi trả *
                    </label>
                    <textarea
                      rows={4}
                      required
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Ví dụ: Tư vấn chọn Whey ít ngọt, kiểm tra đơn hàng, hoặc yêu cầu đổi trả..."
                      className="mt-1 w-full border border-neutral-300 bg-white p-3 text-sm focus:border-[#FF5A00] focus:outline-none"
                    />
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <button
                      type="submit"
                      className="h-11 bg-[#FF5A00] px-6 text-xs font-bold uppercase tracking-wider text-white transition-colors hover:bg-neutral-950"
                    >
                      Gửi yêu cầu trực tiếp
                    </button>
                    <a
                      href={BRAND_INFO.zaloUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-bold text-neutral-950 underline hover:text-[#FF5A00]"
                    >
                      Hoặc mở Zalo {BRAND_INFO.phone} ngay
                    </a>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
