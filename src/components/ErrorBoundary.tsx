import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode | ((reset: () => void) => ReactNode);
  resetKeys?: unknown[];
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo) {
    // Prevent uncaught subtree errors from blanking the page
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    if (!this.state.hasError || !this.props.resetKeys) return;
    const prevKeys = prevProps.resetKeys ?? [];
    const nextKeys = this.props.resetKeys;
    const changed =
      prevKeys.length !== nextKeys.length ||
      nextKeys.some((val, idx) => val !== prevKeys[idx]);
    if (changed) {
      this.setState({ hasError: false });
    }
  }

  handleReset = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      if (typeof this.props.fallback === 'function') {
        return this.props.fallback(this.handleReset);
      }
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex min-h-[280px] flex-col items-center justify-center border border-neutral-200 bg-neutral-50 p-6 text-center">
          <p className="font-display text-xl font-extrabold uppercase text-neutral-950">
            Nội dung tạm thời gián đoạn
          </p>
          <p className="mt-1.5 max-w-md text-xs leading-relaxed text-neutral-600">
            Trình duyệt vừa gặp sự cố hiển thị. Bạn có thể khôi phục lại ngay mà không mất giỏ hàng.
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={this.handleReset}
              className="bg-[#FF5A00] px-4 py-2 text-xs font-bold uppercase text-white transition-colors hover:bg-neutral-950"
            >
              Thử lại ngay
            </button>
            <button
              type="button"
              onClick={() => {
                try {
                  window.location.reload();
                } catch {
                  this.handleReset();
                }
              }}
              className="border border-neutral-950 bg-white px-4 py-2 text-xs font-bold uppercase text-neutral-950 transition-colors hover:bg-neutral-100"
            >
              Tải lại trang
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
