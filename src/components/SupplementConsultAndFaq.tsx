import { useState } from 'react';
import { CheckCircle2, ChevronDown, Dumbbell, Flame, HeartPulse } from 'lucide-react';
import { BRAND_INFO } from '../data/catalog';

const FAQ_ITEMS = [
  {
    q: 'Sản phẩm tại NhaiSupplement có đảm bảo chính hãng 100% không?',
    a: 'Tất cả sản phẩm đều là hàng chính hãng còn nguyên tem niêm phong từ nhà sản xuất, ghi rõ lô sản xuất và hạn sử dụng. Bạn được kiểm tra kỹ bao bì, hương vị trước khi thanh toán và hoàn tiền 100% nếu phát hiện hàng không đạt chuẩn.',
  },
  {
    q: 'Đơn hàng bao nhiêu tiền sẽ được tặng bình lắc miễn phí?',
    a: 'Mỗi đơn hàng từ 500.000đ trở lên sẽ tự động mở mục chọn Bình lắc thể thao 700ml (0đ) ngay trong giỏ hàng và bước thanh toán, áp dụng cho mọi dòng sản phẩm tại cửa hàng.',
  },
  {
    q: 'Ưu đãi Freeship cho đơn hàng đầu tiên áp dụng như thế nào?',
    a: 'Khách hàng đặt mua lần đầu tại nhaisupplement.com được miễn phí 100% phí vận chuyển toàn quốc. Bạn chỉ cần giữ tùy chọn "Freeship cho đơn hàng đầu tiên" được bật trong giỏ hàng để hệ thống trừ phí giao hàng về 0đ.',
  },
  {
    q: 'Thời gian giao hàng từ kho Hà Nội đi nội thành và các tỉnh mất bao lâu?',
    a: 'Nội thành Hà Nội nhận hàng hỏa tốc trong 2–4 giờ làm việc. Đơn đi TP.HCM, Đà Nẵng và các tỉnh thành khác trên toàn quốc được giao tiêu chuẩn trong 1–3 ngày.',
  },
  {
    q: 'Khi chọn hương vị khác nhau, sản phẩm nhận được có đúng mẫu mã và vị đã chọn không?',
    a: 'Đúng hoàn toàn. Từng hương vị trên mỗi sản phẩm đều hiển thị hình ảnh bao bì thực tế của đúng vị đó và lưu chính xác từ giỏ hàng đến lúc đóng gói xuất kho để tránh giao nhầm vị.',
  },
  {
    q: 'Chính sách đổi trả 7 ngày và hình thức thanh toán gồm những gì?',
    a: 'Hỗ trợ thanh toán tiền mặt khi nhận hàng (COD) hoặc chuyển khoản ngân hàng qua VietQR. NhaiSupplement đổi mới miễn phí hoặc hoàn tiền trong 7 ngày nếu sản phẩm lỗi từ nhà sản xuất, móp méo rách seal khi vận chuyển hoặc giao sai hương vị.',
  },
];

export default function SupplementConsultAndFaq() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [area, setArea] = useState('');
  const [goal, setGoal] = useState('Tăng cơ nạc – Giảm mỡ (Whey Isolate + Creatine)');
  const [note, setNote] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim() || !area.trim()) return;
    setSubmitted(true);
  };

  return (
    <>
      {/* Consultation Booking Section (#tu-van — inspired by MiuGo Pets service/consult module) */}
      <section id="tu-van" className="border-t-2 border-neutral-950 bg-neutral-50 py-14">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-4 sm:px-6 lg:grid-cols-12 lg:px-8">
          <div className="lg:col-span-6">
            <span className="text-xs font-bold uppercase tracking-wider text-[#FF5A00]">
              Tư vấn lộ trình cá nhân hóa
            </span>
            <h2 className="mt-1 font-display text-3xl font-extrabold uppercase tracking-tight text-neutral-950 sm:text-4xl">
              Lên Lộ Trình Supplement Cùng {BRAND_INFO.name}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-neutral-600">
              Để lại chiều cao, cân nặng và mục tiêu tập luyện — đội ngũ kho Hà Nội sẽ gợi ý
              combo thực phẩm bổ sung chuẩn liều lượng, tránh lãng phí.
            </p>

            <ul className="mt-6 space-y-3">
              <li className="flex items-start gap-3 border border-neutral-200 bg-white p-4">
                <Dumbbell className="mt-0.5 h-5 w-5 shrink-0 text-[#FF5A00]" />
                <div>
                  <strong className="block text-sm font-bold text-neutral-950">
                    Tăng cơ nạc · Giảm mỡ · Bổ sung sức mạnh
                  </strong>
                  <span className="text-xs text-neutral-600">
                    Gợi ý chuẩn tỷ lệ Whey Isolate / Hydrolyzed + Creatine + EAA theo lịch tập.
                  </span>
                </div>
              </li>
              <li className="flex items-start gap-3 border border-neutral-200 bg-white p-4">
                <Flame className="mt-0.5 h-5 w-5 shrink-0 text-[#FF5A00]" />
                <div>
                  <strong className="block text-sm font-bold text-neutral-950">
                    Tăng cân sạch cho người gầy khó hấp thu
                  </strong>
                  <span className="text-xs text-neutral-600">
                    Cân đối Mass Gainer + men tiêu hóa, không tích mỡ bụng hay đầy hơi.
                  </span>
                </div>
              </li>
              <li className="flex items-start gap-3 border border-neutral-200 bg-white p-4">
                <HeartPulse className="mt-0.5 h-5 w-5 shrink-0 text-[#FF5A00]" />
                <div>
                  <strong className="block text-sm font-bold text-neutral-950">
                    Phục hồi khớp, giấc ngủ &amp; sức khỏe nền tảng
                  </strong>
                  <span className="text-xs text-neutral-600">
                    Kết hợp Vitamin tổng hợp, D3+K2, Magie Glycinate &amp; Omega-3 IFOS.
                  </span>
                </div>
              </li>
            </ul>
          </div>

          <div className="border-2 border-neutral-950 bg-white p-6 lg:col-span-6">
            <h3 className="font-display text-2xl font-extrabold uppercase text-neutral-950">
              Đăng ký tư vấn miễn phí
            </h3>

            {submitted ? (
              <div className="mt-5 border border-[#FF5A00] bg-orange-50 p-5 text-sm">
                <div className="flex items-center gap-2 font-bold text-[#FF5A00]">
                  <CheckCircle2 className="h-5 w-5" />
                  <span>Đã tiếp nhận thông tin tư vấn!</span>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-neutral-700">
                  Cảm ơn <strong>{name}</strong> ({phone}) tại <strong>{area}</strong>. Chuyên viên{' '}
                  {BRAND_INFO.name} sẽ phản hồi lộ trình cho mục tiêu <strong>{goal}</strong> qua
                  Zalo {BRAND_INFO.phone}.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSubmitted(false);
                    setName('');
                    setPhone('');
                    setArea('');
                    setNote('');
                  }}
                  className="mt-4 bg-neutral-950 px-4 py-2 text-xs font-bold uppercase text-white hover:bg-[#FF5A00]"
                >
                  Gửi yêu cầu khác
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="mt-4 space-y-3.5 text-sm">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-bold text-neutral-950">Họ và tên *</label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Họ tên của bạn"
                      className="mt-1 h-10 w-full border border-neutral-300 px-3 text-sm focus:border-[#FF5A00] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-neutral-950">Số điện thoại / Zalo *</label>
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="094618430"
                      className="mt-1 h-10 w-full border border-neutral-300 px-3 text-sm focus:border-[#FF5A00] focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-950">Khu vực nhận hàng *</label>
                  <input
                    type="text"
                    required
                    value={area}
                    onChange={(e) => setArea(e.target.value)}
                    placeholder="Ví dụ: Đống Đa, Hà Nội hoặc Quận 1, TP.HCM"
                    className="mt-1 h-10 w-full border border-neutral-300 px-3 text-sm focus:border-[#FF5A00] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-950">Mục tiêu tập luyện</label>
                  <select
                    value={goal}
                    onChange={(e) => setGoal(e.target.value)}
                    className="mt-1 h-10 w-full border border-neutral-300 bg-white px-3 text-sm focus:border-[#FF5A00] focus:outline-none"
                  >
                    <option>Tăng cơ nạc – Giảm mỡ (Whey Isolate + Creatine)</option>
                    <option>Tăng cân người gầy (Mass Gainer + Vitamin)</option>
                    <option>Tăng sức mạnh &amp; Pump (Pre-Workout + EAA/BCAA)</option>
                    <option>Phục hồi khớp &amp; Giấc ngủ (Omega-3 + D3K2 + ZMA)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-950">
                    Chiều cao, cân nặng &amp; lịch tập
                  </label>
                  <textarea
                    rows={2}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Ví dụ: Cao 1m72 nặng 62kg, tập 4 buổi/tuần..."
                    className="mt-1 w-full border border-neutral-300 p-2.5 text-sm focus:border-[#FF5A00] focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  className="h-11 w-full bg-[#FF5A00] text-xs font-bold uppercase tracking-wider text-white transition-colors hover:bg-neutral-950"
                >
                  Gửi đăng ký tư vấn
                </button>
              </form>
            )}
          </div>
        </div>
      </section>

      {/* Expandable FAQ Accordion (#hoi-dap — adapted from MiuGo Pets FAQ details blocks) */}
      <section id="hoi-dap" className="border-t border-neutral-200 bg-white py-14">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <span className="text-xs font-bold uppercase tracking-wider text-[#FF5A00]">
              Giải đáp nhanh
            </span>
            <h2 className="mt-1 font-display text-3xl font-extrabold uppercase tracking-tight text-neutral-950 sm:text-4xl">
              Câu Hỏi Thường Gặp (FAQ)
            </h2>
          </div>

          <div className="mt-8 space-y-3">
            {FAQ_ITEMS.map((item) => (
              <details
                key={item.q}
                className="group border border-neutral-200 bg-neutral-50 open:border-neutral-950 open:bg-white"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-sm font-bold text-neutral-950">
                  <span>{item.q}</span>
                  <ChevronDown className="h-4 w-4 shrink-0 text-[#FF5A00] transition-transform duration-200 group-open:rotate-180" />
                </summary>
                <div className="border-t border-neutral-200 px-5 py-4 text-xs leading-relaxed text-neutral-600">
                  {item.a}
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
