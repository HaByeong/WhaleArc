import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { billingService, type PaymentPlan } from '../services/billingService';
import { getErrorMessage } from '../utils/api';

/** 토스 빌링 인증(requestBillingAuth) 성공 리다이렉트 대상. authKey·customerKey를 받아 구독 등록을 완료한다. */
const BillingSuccessPage = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { refreshProfile } = useAuth();
  const [status, setStatus] = useState<'processing' | 'error'>('processing');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const authKey = params.get('authKey');
    const customerKey = params.get('customerKey');
    const plan = params.get('plan') as PaymentPlan | null;
    if (!authKey || !customerKey || !plan) {
      setStatus('error');
      setMessage('결제 인증 정보가 올바르지 않습니다.');
      return;
    }
    billingService.register(authKey, customerKey, plan)
      .then(async () => {
        await refreshProfile(); // tier가 결제 결과로 바뀌었으므로 즉시 반영
        navigate('/billing', { replace: true });
      })
      .catch((e) => {
        setStatus('error');
        setMessage(getErrorMessage(e, '구독 등록에 실패했습니다.'));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 14, textAlign: 'center', padding: 24 }}>
      {status === 'processing' ? (
        <p>구독을 등록하는 중입니다...</p>
      ) : (
        <>
          <p>{message}</p>
          <button onClick={() => navigate('/billing', { replace: true })}>결제 · 구독으로 돌아가기</button>
        </>
      )}
    </div>
  );
};

export default BillingSuccessPage;
