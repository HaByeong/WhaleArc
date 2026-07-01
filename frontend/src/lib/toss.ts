/** 토스페이먼츠 v2 SDK 브라우저 스크립트를 동적 로드해 카드 등록(빌링 인증) 창을 띄운다.
 *  npm 패키지 대신 공식 CDN 스크립트를 쓴다 — SDK가 로그인 상태에서만 필요해 항상 로드할 필요가 없고,
 *  버전 관리는 토스가 서빙하는 v2/standard 엔드포인트에 위임한다. */
declare global {
  interface Window {
    TossPayments?: (clientKey: string) => {
      payment: (params: { customerKey: string }) => {
        requestBillingAuth: (params: {
          method: string;
          successUrl: string;
          failUrl: string;
          customerEmail?: string;
          customerName?: string;
        }) => Promise<void>;
      };
    };
  }
}

const SDK_URL = 'https://js.tosspayments.com/v2/standard';
const CLIENT_KEY = import.meta.env.VITE_TOSS_CLIENT_KEY as string | undefined;

let loadPromise: Promise<void> | null = null;

function loadScript(): Promise<void> {
  if (window.TossPayments) return Promise.resolve();
  if (loadPromise) return loadPromise;
  loadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SDK_URL;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('토스페이먼츠 SDK 로드 실패'));
    document.head.appendChild(script);
  });
  return loadPromise;
}

/** 카드 등록 창을 띄운다. 성공 시 successUrl로 authKey·customerKey 쿼리파라미터가 붙어 리다이렉트된다. */
export async function requestBillingAuth(params: {
  customerKey: string;
  plan: string;
  customerEmail?: string;
  customerName?: string;
}) {
  if (!CLIENT_KEY) throw new Error('결제 설정이 완료되지 않았습니다. (VITE_TOSS_CLIENT_KEY 누락)');
  await loadScript();
  if (!window.TossPayments) throw new Error('토스페이먼츠 SDK 초기화에 실패했습니다.');

  const tossPayments = window.TossPayments(CLIENT_KEY);
  const payment = tossPayments.payment({ customerKey: params.customerKey });
  await payment.requestBillingAuth({
    method: 'CARD',
    successUrl: `${window.location.origin}/billing/success?plan=${params.plan}`,
    failUrl: `${window.location.origin}/billing/fail`,
    customerEmail: params.customerEmail,
    customerName: params.customerName,
  });
}
