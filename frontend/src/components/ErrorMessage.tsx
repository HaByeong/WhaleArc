interface ErrorMessageProps {
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
}

const ErrorMessage = ({
  message,
  onRetry,
  retryLabel = '다시 시도'
}: ErrorMessageProps) => {
  return (
    <div className="bg-gradient-to-b from-red-50 to-white border border-red-100 rounded-2xl p-8 text-center">
      <p className="text-red-400 text-sm font-medium tracking-wide mb-1">파도가 거칠어요</p>
      <p className="text-gray-600 text-sm mb-5">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-5 py-2 bg-whale-light text-white rounded-lg hover:bg-whale-accent transition-colors text-sm font-medium"
        >
          {retryLabel}
        </button>
      )}
    </div>
  );
};

export default ErrorMessage;
