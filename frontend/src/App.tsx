import { BrowserRouter as Router, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { lazy, Suspense, useEffect } from 'react';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import SplashLoading from './components/SplashLoading';
import VirtSplashLoading from './components/VirtSplashLoading';
import ProtectedRoute from './components/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';

const LandingPage = lazy(() => import('./pages/LandingPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const SignUpPage = lazy(() => import('./pages/SignUpPage'));
const AuthCallbackPage = lazy(() => import('./pages/AuthCallbackPage'));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'));
const PortfolioDetailPage = lazy(() => import('./pages/PortfolioDetailPage'));
const UserPage = lazy(() => import('./pages/UserPage'));
const ConsoleExchangePage = lazy(() => import('./pages/ConsoleExchangePage'));
const ConsoleDashboardPage = lazy(() => import('./pages/ConsoleDashboardPage'));
const ConsolePortfolioPage = lazy(() => import('./pages/ConsolePortfolioPage'));
const ConsoleMarketsPage = lazy(() => import('./pages/ConsoleMarketsPage'));
const ConsoleStrategyPage = lazy(() => import('./pages/ConsoleStrategyPage'));
const AutoTradePage = lazy(() => import('./pages/AutoTradePage'));
const ConsoleEducationPage = lazy(() => import('./pages/ConsoleEducationPage'));
const ConsoleMirrorPage = lazy(() => import('./pages/ConsoleMirrorPage'));
const ConsoleCommunityPage = lazy(() => import('./pages/ConsoleCommunityPage'));
const ConsoleStatusPage = lazy(() => import('./pages/ConsoleStatusPage'));
const ConsoleBillingPage = lazy(() => import('./pages/ConsoleBillingPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));
const TermsPage = lazy(() => import('./pages/TermsPage'));
const PrivacyPage = lazy(() => import('./pages/PrivacyPage'));
const DisclaimerPage = lazy(() => import('./pages/DisclaimerPage'));

// body에 테마 + virt/novirt 클래스 적용 (섹션은 ThemeContext 가 라우트로 판별)
const THEME_CLASSES = ['whalearc-dark', 'whalearc-virt', 'whalearc-novirt'] as const;
const DarkModeController = () => {
  const { isDark, section } = useTheme();
  useEffect(() => {
    // 기존 테마 클래스 제거
    document.body.classList.remove(...THEME_CLASSES);

    if (isDark) document.body.classList.add('whalearc-dark');
    if (section === 'virt') document.body.classList.add('whalearc-virt');
    else if (section === 'novirt') document.body.classList.add('whalearc-novirt');

    return () => { document.body.classList.remove(...THEME_CLASSES); };
  }, [isDark, section]);
  return null;
};

/** Suspense fallback — 섹션(ThemeContext) 기준으로 virt/real 로딩 화면 분기.
 *  window.location 대신 라우터 기반 section 을 써서, 네비게이션 중 직전 경로가 잡혀
 *  로딩 화면이 반대로 뜨던 문제를 방지한다. (로고·테마와 동일한 기준) */
const RouteSplashLoading = () => {
  const { section } = useTheme();
  return section === 'virt' ? <VirtSplashLoading /> : <SplashLoading />;
};

// 시세·거래 통합에 따른 하위호환 리다이렉트 — 옛 /trade 딥링크(?code=&type=…)를
// 쿼리 그대로 보존해 /market 으로 넘긴다. 외부 알림·북마크 URL도 계속 동작.
function QueryRedirect({ to }: { to: string }) {
  const { search } = useLocation();
  return <Navigate to={`${to}${search}`} replace />;
}

// 라우트별 에러 바운더리 — 경로가 바뀌면 에러 상태를 리셋해 한 페이지 장애가
// 셸·다른 메뉴까지 마비시키지 않도록 한다(다른 메뉴로 이동하면 자동 복구).
function RouteErrorBoundary({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  return <ErrorBoundary resetKeys={[location.pathname]}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <ErrorBoundary>
      <Router>
        <ThemeProvider>
        <DarkModeController />

        <AuthProvider>
        <Suspense fallback={<RouteSplashLoading />}>
        <RouteErrorBoundary>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignUpPage />} />
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/disclaimer" element={<DisclaimerPage />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <ConsoleDashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/market"
            element={
              <ProtectedRoute>
                <ConsoleMarketsPage />
              </ProtectedRoute>
            }
          />
          {/* /trade → /market 통합 리다이렉트 (쿼리 보존) */}
          <Route path="/trade" element={<QueryRedirect to="/market" />} />
          <Route
            path="/strategy"
            element={
              <ProtectedRoute>
                <ConsoleStrategyPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/auto-trade"
            element={
              <ProtectedRoute>
                <AutoTradePage />
              </ProtectedRoute>
            }
          />
          {/* /store(전략 학습) → /strategy(전략·백테스트) 통합 리다이렉트 (쿼리 보존) */}
          <Route path="/store" element={<QueryRedirect to="/strategy" />} />
          <Route
            path="/ranking"
            element={
              <ProtectedRoute>
                <ConsoleStatusPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/feedback"
            element={
              <ProtectedRoute>
                <ConsoleCommunityPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/my-portfolio"
            element={
              <ProtectedRoute>
                <ConsolePortfolioPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/user"
            element={
              <ProtectedRoute>
                <UserPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/portfolio/:portfolioId"
            element={
              <ProtectedRoute>
                <PortfolioDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/api-setting"
            element={
              <ProtectedRoute>
                <ConsoleExchangePage />
              </ProtectedRoute>
            }
          />
          <Route path="/billing" element={<ProtectedRoute><ConsoleBillingPage /></ProtectedRoute>} />
          {/* Virt 모드 라우트 — 개편 콘솔 페이지를 virt 모드(고래꼬리 로고)로 재사용 */}
          <Route path="/virt/dashboard" element={<ProtectedRoute><ConsoleDashboardPage /></ProtectedRoute>} />
          <Route path="/virt/my-portfolio" element={<ProtectedRoute><ConsolePortfolioPage /></ProtectedRoute>} />
          <Route path="/virt/market" element={<ProtectedRoute><ConsoleMarketsPage /></ProtectedRoute>} />
          <Route path="/virt/trade" element={<QueryRedirect to="/virt/market" />} />
          <Route path="/virt/strategy" element={<ProtectedRoute><ConsoleStrategyPage /></ProtectedRoute>} />
          <Route path="/virt/auto-trade" element={<ProtectedRoute><AutoTradePage /></ProtectedRoute>} />
          <Route path="/virt/store" element={<QueryRedirect to="/virt/strategy" />} />
          <Route path="/virt/learn" element={<ProtectedRoute><ConsoleEducationPage /></ProtectedRoute>} />
          <Route path="/virt/mirror" element={<ProtectedRoute><ConsoleMirrorPage /></ProtectedRoute>} />
          <Route path="/virt/ranking" element={<ProtectedRoute><ConsoleStatusPage /></ProtectedRoute>} />
          <Route path="/virt/feedback" element={<ProtectedRoute><ConsoleCommunityPage /></ProtectedRoute>} />
          <Route path="/virt/billing" element={<ProtectedRoute><ConsoleBillingPage /></ProtectedRoute>} />
          <Route path="/virt/user" element={<ProtectedRoute><UserPage /></ProtectedRoute>} />
          <Route path="/virt/portfolio/:portfolioId" element={<ProtectedRoute><PortfolioDetailPage /></ProtectedRoute>} />

          {/* dev 전용: 인증 없이 개편 디자인 미리보기 (프로덕션 빌드 제외) */}
          {import.meta.env.DEV && <Route path="/preview/console" element={<ConsoleDashboardPage />} />}
          {import.meta.env.DEV && <Route path="/preview/portfolio" element={<ConsolePortfolioPage />} />}
          {import.meta.env.DEV && <Route path="/preview/markets" element={<ConsoleMarketsPage />} />}
          {import.meta.env.DEV && <Route path="/preview/trade" element={<QueryRedirect to="/preview/markets" />} />}
          {import.meta.env.DEV && <Route path="/preview/strategy" element={<ConsoleStrategyPage />} />}
          {import.meta.env.DEV && <Route path="/preview/auto-trade" element={<AutoTradePage />} />}
          {import.meta.env.DEV && <Route path="/preview/learn" element={<QueryRedirect to="/preview/strategy" />} />}
          {import.meta.env.DEV && <Route path="/preview/edu" element={<ConsoleEducationPage />} />}
          {import.meta.env.DEV && <Route path="/preview/community" element={<ConsoleCommunityPage />} />}
          {import.meta.env.DEV && <Route path="/preview/status" element={<ConsoleStatusPage />} />}
          {import.meta.env.DEV && <Route path="/preview/billing" element={<ConsoleBillingPage />} />}
          {import.meta.env.DEV && <Route path="/preview/exchange" element={<ConsoleExchangePage />} />}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
        </RouteErrorBoundary>
        </Suspense>
        </AuthProvider>

        </ThemeProvider>
      </Router>
    </ErrorBoundary>
  );
}

export default App;
