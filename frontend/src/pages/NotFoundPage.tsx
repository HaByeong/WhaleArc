import { useNavigate, useLocation } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';

const NotFoundPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const isVirt = location.pathname.startsWith('/virt');
  const { isDark } = useTheme();
  const dashboardPath = isVirt ? '/virt/dashboard' : '/dashboard';

  return (
    <div className={`min-h-screen flex items-center justify-center px-4 bg-[var(--wa-page-bg)]`}>
      <div className="text-center max-w-md">
        <div className={`text-8xl font-bold mb-4 ${isDark ? 'text-slate-800' : 'text-blue-200'}`}>404</div>
        <h1 className={`text-2xl font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-800'}`}>항로를 찾을 수 없습니다</h1>
        <p className={`mb-8 ${isDark ? 'text-slate-500' : 'text-gray-500'}`}>
          요청하신 페이지가 존재하지 않거나 이동되었습니다.
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={() => navigate(-1)}
            className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-colors ${isDark ? 'border border-white/10 text-slate-400 hover:bg-white/5' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
          >
            뒤로 가기
          </button>
          <button
            onClick={() => navigate(dashboardPath)}
            className={`px-5 py-2.5 rounded-lg text-white text-sm font-medium transition-colors ${isDark ? 'bg-cyan-500 hover:bg-cyan-600' : 'bg-blue-500 hover:bg-blue-600'}`}
          >
            대시보드로 이동
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotFoundPage;
