import { Link } from 'react-router-dom';
import Header from './Header';

interface LegalPageLayoutProps {
  title: string;
  updatedDate: string;
  children: React.ReactNode;
}

const LegalPageLayout = ({ title, updatedDate, children }: LegalPageLayoutProps) => {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header showNav={false} />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="card">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-whale-dark">{title}</h1>
            <p className="text-sm text-gray-400 mt-2">최종 수정일: {updatedDate}</p>
          </div>

          <div className="prose-legal space-y-8 text-sm text-gray-700 leading-relaxed">
            {children}
          </div>

          <div className="mt-12 pt-6 border-t border-gray-200">
            <div className="flex flex-wrap gap-4 text-sm text-gray-500">
              <Link to="/terms" className="hover:text-whale-dark transition-colors">이용약관</Link>
              <span className="text-gray-300">|</span>
              <Link to="/privacy" className="hover:text-whale-dark transition-colors">개인정보처리방침</Link>
              <span className="text-gray-300">|</span>
              <Link to="/disclaimer" className="hover:text-whale-dark transition-colors">투자 면책 고지</Link>
            </div>
            <p className="text-xs text-gray-400 mt-4">&copy; 2025 WhaleArc. All rights reserved.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LegalPageLayout;
