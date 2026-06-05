import { useNavigate, useLocation, Link } from 'react-router-dom';

const NotFoundPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const isVirt = location.pathname.startsWith('/virt');
  const dashboardPath = isVirt ? '/virt/dashboard' : '/dashboard';

  return (
    <div className="wa-force-dark min-h-screen flex items-center justify-center px-4 bg-[#060d18] text-white relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[480px] h-[480px] bg-cyan-500/[0.05] rounded-full blur-[120px]" />
      <div className="relative text-center max-w-md">
        <Link to="/" className="inline-flex items-center gap-3 mb-10">
          <img src="/tail-sample-2.png" alt="" className="w-16 h-16 object-contain"
            style={{ filter: 'drop-shadow(0 0 18px rgba(91,157,255,0.4))' }} />
          <span className="whalearc-text text-3xl font-bold tracking-tighter">WHALEARC</span>
        </Link>
        <div className="text-8xl font-bold mb-4 text-white/[0.08]">404</div>
        <h1 className="text-2xl font-bold mb-2 text-white">항로를 찾을 수 없습니다</h1>
        <p className="mb-8 text-slate-500">요청하신 페이지가 존재하지 않거나 이동되었습니다.</p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={() => navigate(-1)}
            className="px-5 py-2.5 rounded-lg text-sm font-medium transition-colors border border-white/10 text-slate-400 hover:bg-white/5"
          >
            뒤로 가기
          </button>
          <button
            onClick={() => navigate(dashboardPath)}
            className="px-5 py-2.5 rounded-lg text-white text-sm font-medium transition-colors bg-cyan-500 hover:bg-cyan-600"
          >
            대시보드로 이동
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotFoundPage;
