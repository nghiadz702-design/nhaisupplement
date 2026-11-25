# NhaiSupplement (`nhaisupplement.com`)

Website cửa hàng thực phẩm bổ sung thể hình **NhaiSupplement** tại Hà Nội, giao hàng toàn quốc.

## Tính năng chính

- **Đầy đủ 9 danh mục sản phẩm chính hãng**: Whey & Hydrolyzed, Creatine, Bar / Cookie, Mass, Pre-Workout, EAA, BCAA, Vitamin, Dầu cá.
- **Đổi ảnh thực tế 1:1** khi chọn từng hương vị ngay trên thẻ sản phẩm.
- **Trình xem 3D xoay 360° / AR Camera / VR Stereo** trực quan bằng Three.js.
- **Giỏ hàng & Thanh toán đầy đủ**: tự động tặng bình lắc 0đ cho đơn hàng từ 500.000đ, freeship đơn hàng đầu tiên, áp mã giảm giá (`NHAI10`, `NHAI100K`, `FREESHIP`), lưu trạng thái vào `localStorage`.

---

## 1. Chạy trên máy cá nhân (Local)

Yêu cầu **Node.js >= 20**.

```bash
npm install
npm run dev
```

Mở trình duyệt tại `http://localhost:3000`.

Kiểm tra lỗi TypeScript và build bản production:

```bash
npm run lint
npm run build
npm run preview
```

---

## 2. Đưa mã nguồn lên GitHub

Tạo một repository mới trên GitHub (ví dụ: `nhaisupplement`), sau đó chạy trong thư mục dự án:

```bash
git init
git add .
git commit -m "Initial commit: NhaiSupplement store"
git branch -M main
git remote add origin https://github.com/<ten-tai-khoan>/<ten-repo>.git
git push -u origin main
```

---

## 3. Tự động deploy lên GitHub Pages

Dự án đã có sẵn file workflow `.github/workflows/deploy.yml`.

1. Vào repository trên GitHub → chọn **Settings** → **Pages**.
2. Ở mục **Build and deployment → Source**, chọn **GitHub Actions**.
3. Mỗi lần push code lên nhánh `main`, GitHub sẽ tự động chạy `npm run lint`, `npm run build` và xuất bản website lên:
   `https://<ten-tai-khoan>.github.io/<ten-repo>/`

> Toàn bộ ảnh sản phẩm, logo và đường dẫn tĩnh đã được cấu hình qua `VITE_BASE_PATH` để chạy ổn định trên cả subpath của GitHub Pages lẫn tên miền gốc.

---

## 4. Gắn tên miền riêng (`nhaisupplement.com`)

1. Tạo file `public/CNAME` với nội dung duy nhất là tên miền:
   ```text
   nhaisupplement.com
   ```
2. Trỏ DNS tên miền về GitHub Pages (`A` records: `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`).
3. Vào **Settings → Pages → Custom domain**, nhập `nhaisupplement.com` và bật **Enforce HTTPS**.
   Khi có file `public/CNAME`, workflow sẽ tự động build với `VITE_BASE_PATH=/`.
