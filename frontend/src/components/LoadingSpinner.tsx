interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  fullScreen?: boolean;
  message?: string;
}

const LoadingSpinner = ({
  size = 'md',
  fullScreen = false,
  message
}: LoadingSpinnerProps) => {
  const sizeClasses = {
    sm: 'w-5 h-5',
    md: 'w-8 h-8',
    lg: 'w-10 h-10',
  };

  const spinner = (
    <div className="flex flex-col items-center justify-center gap-3">
      <div className="relative">
        <div className={`${sizeClasses[size]} border-2 border-whale-light/20 border-t-whale-light rounded-full animate-spin`} />
      </div>
      {message && (
        <p className="text-gray-400 text-sm">{message}</p>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-50">
        {spinner}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center py-12">
      {spinner}
    </div>
  );
};

export default LoadingSpinner;
