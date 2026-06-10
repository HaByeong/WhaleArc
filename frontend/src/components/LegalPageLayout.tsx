import { Link } from 'react-router-dom';

interface LegalPageLayoutProps {
  title: string;
  updatedDate: string;
  children: React.ReactNode;
}

const LegalPageLayout = ({ title, updatedDate, children }: LegalPageLayoutProps) => {
  return (
    <div className="wa-force-dark min-h-screen bg-[#060d18] text-white">
      {/* 상단 브랜드 마크 */}
      <div className="relative overflow-hidden pt-10 pb-2 text-center">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[360px] h-[180px] bg-cyan-500/[0.05] rounded-full blur-[100px]" />
        <Link to="/" className="relative inline-flex items-center gap-2">
          <img src="/brand-whale.png" alt="" className="h-9 w-9 object-contain"
            style={{ filter: 'drop-shadow(0 0 12px rgba(91,157,255,0.35))' }} />
          <span className="whalearc-text text-lg font-bold tracking-tighter">WHALEARC</span>
        </Link>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 sm:p-8">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-white">{title}</h1>
            <p className="text-sm text-slate-500 mt-2">최종 수정일: {updatedDate}</p>
          </div>

          <div className="wa-legal prose-legal space-y-8 text-sm text-slate-300 leading-relaxed">
            {children}
          </div>

          <div className="mt-12 pt-6 border-t border-white/[0.08]">
            <div className="flex flex-wrap gap-4 text-sm text-slate-500">
              <Link to="/terms" className="hover:text-white transition-colors">이용약관</Link>
              <span className="text-slate-700">|</span>
              <Link to="/privacy" className="hover:text-white transition-colors">개인정보처리방침</Link>
              <span className="text-slate-700">|</span>
              <Link to="/disclaimer" className="hover:text-white transition-colors">투자 면책 고지</Link>
            </div>
            <p className="text-xs text-slate-600 mt-4">&copy; 2025 WhaleArc. All rights reserved.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LegalPageLayout;
