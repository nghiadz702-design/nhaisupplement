import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import ErrorBoundary from './components/ErrorBoundary.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary
    fallback={(reset) => (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50 p-6 text-neutral-950">
        <div className="w-full max-w-md border-2 border-neutral-950 bg-white p-6 text-center">
          <span className="font-mono text-xs font-bold uppercase tracking-wider text-[#FF5A00]">
            NhaiSupplement
          </span>
          <h1 className="mt-1 font-display text-2xl font-extrabold uppercase">
            Đã xảy ra lỗi hiển thị
          </h1>
          <p className="mt-2 text-xs leading-relaxed text-neutral-600">
            Trình duyệt hoặc chế độ 3D/AR vừa gặp sự cố tạm thời. Vui lòng thử khôi phục lại trang.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={reset}
              className="bg-[#FF5A00] px-4 py-2 text-xs font-bold uppercase text-white hover:bg-neutral-950"
            >
              Khôi phục ngay
            </button>
            <button
              type="button"
              onClick={() => {
                try {
                  window.localStorage.removeItem('nhaisupplement_cart_v1');
                  window.localStorage.removeItem('nhaisupplement_prefs_v1');
                } catch {
                  // Ignore storage access errors
                }
                window.location.reload();
              }}
              className="border border-neutral-950 bg-white px-4 py-2 text-xs font-bold uppercase text-neutral-950 hover:bg-neutral-100"
            >
              Đặt lại dữ liệu &amp; Tải lại
            </button>
          </div>
        </div>
      </div>
    )}
  >
    <App />
  </ErrorBoundary>,
);
