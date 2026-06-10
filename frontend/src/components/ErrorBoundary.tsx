import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  // 이 값들이 바뀌면(예: 라우트 경로) 에러 상태를 리셋해 자식을 다시 렌더 시도한다.
  // → 한 페이지에서 에러가 나도 다른 메뉴로 이동하면 복구된다(앱 전체 마비 방지).
  resetKeys?: unknown[];
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * 에러 바운더리 컴포넌트
 * 자식 컴포넌트에서 발생한 에러를 catch하여 에러 화면을 표시
 */
class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // 최소한 콘솔에 보고 (프로덕션은 여기서 로깅 서비스로 전송)
    console.error('[ErrorBoundary]', error, errorInfo?.componentStack);
  }

  componentDidUpdate(prevProps: Props) {
    if (!this.state.hasError) return;
    const a = prevProps.resetKeys, b = this.props.resetKeys;
    if (!a || !b) return;
    const changed = a.length !== b.length || b.some((k, i) => k !== a[i]);
    if (changed) this.setState({ hasError: false, error: null });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="wa-force-dark min-h-screen bg-[#060d18] text-white flex items-center justify-center px-4">
          <div className="max-w-md w-full rounded-xl border border-white/[0.06] bg-white/[0.02] p-8 text-center">
            <div className="text-6xl mb-4">⚠️</div>
            <h1 className="text-2xl font-bold text-white mb-4">
              오류가 발생했습니다
            </h1>
            <p className="text-slate-400 mb-6">
              예상치 못한 오류가 발생했습니다. 페이지를 새로고침하거나 다시 시도해주세요.
            </p>
            {this.state.error && (
              <div className="bg-white/[0.04] border border-white/[0.06] rounded-lg p-4 mb-6 text-left">
                <p className="text-sm text-slate-400 font-mono break-all">
                  {this.state.error.message}
                </p>
              </div>
            )}
            <div className="flex gap-4 justify-center">
              <button
                onClick={() => window.location.reload()}
                className="px-5 py-2.5 rounded-lg text-sm font-semibold bg-cyan-500 hover:bg-cyan-600 text-white transition-colors"
              >
                새로고침
              </button>
              <a href="/" className="px-5 py-2.5 rounded-lg text-sm font-semibold border border-white/10 text-slate-300 hover:bg-white/5 transition-colors">
                홈으로
              </a>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

