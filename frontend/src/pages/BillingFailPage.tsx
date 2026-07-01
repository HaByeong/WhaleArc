import { useNavigate, useSearchParams } from 'react-router-dom';

/** 토스 빌링 인증(requestBillingAuth) 실패/취소 리다이렉트 대상. */
const BillingFailPage = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const message = params.get('message') || '카드 등록이 취소되었거나 실패했습니다.';

  return (
    <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 14, textAlign: 'center', padding: 24 }}>
      <p>{message}</p>
      <button onClick={() => navigate('/billing', { replace: true })}>결제 · 구독으로 돌아가기</button>
    </div>
  );
};

export default BillingFailPage;
