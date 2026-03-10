import { useNavigate } from 'react-router-dom';

const NotFoundPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="text-8xl font-bold text-blue-200 mb-4">404</div>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">항로를 찾을 수 없습니다</h1>
        <p className="text-gray-500 mb-8">
          요청하신 페이지가 존재하지 않거나 이동되었습니다.
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={() => navigate(-1)}
            className="px-5 py-2.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm font-medium transition-colors"
          >
            뒤로 가기
          </button>
          <button
            onClick={() => navigate('/dashboard')}
            className="px-5 py-2.5 rounded-lg bg-blue-500 text-white hover:bg-blue-600 text-sm font-medium transition-colors"
          >
            대시보드로 이동
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotFoundPage;
