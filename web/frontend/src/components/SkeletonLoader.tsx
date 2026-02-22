/**
 * 스켈레톤 로딩 컴포넌트
 * 데이터 로딩 중에 표시되는 플레이스홀더
 */

interface SkeletonLoaderProps {
  type?: 'card' | 'list' | 'table' | 'chart';
  count?: number;
}

const SkeletonLoader = ({ type = 'card', count = 1 }: SkeletonLoaderProps) => {
  if (type === 'card') {
    return (
      <div className="space-y-4">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="card animate-pulse">
            <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
            <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-5/6"></div>
          </div>
        ))}
      </div>
    );
  }

  if (type === 'list') {
    return (
      <div className="space-y-2">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="p-3 bg-gray-50 rounded-lg animate-pulse">
            <div className="flex justify-between items-center">
              <div className="space-y-2 flex-1">
                <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                <div className="h-3 bg-gray-200 rounded w-1/6"></div>
              </div>
              <div className="space-y-2 text-right">
                <div className="h-4 bg-gray-200 rounded w-20 ml-auto"></div>
                <div className="h-3 bg-gray-200 rounded w-16 ml-auto"></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (type === 'table') {
    return (
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <div className="p-4 bg-gray-100 animate-pulse">
          <div className="grid grid-cols-12 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-4 bg-gray-300 rounded"></div>
            ))}
          </div>
        </div>
        <div className="divide-y divide-gray-200">
          {Array.from({ length: count }).map((_, i) => (
            <div key={i} className="p-4 animate-pulse">
              <div className="grid grid-cols-12 gap-4">
                {Array.from({ length: 6 }).map((_, j) => (
                  <div key={j} className="h-4 bg-gray-200 rounded"></div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (type === 'chart') {
    return (
      <div className="card animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
        <div className="h-64 bg-gray-200 rounded"></div>
      </div>
    );
  }

  return null;
};

export default SkeletonLoader;

