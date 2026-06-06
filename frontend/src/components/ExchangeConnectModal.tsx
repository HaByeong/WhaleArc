import { useState, useEffect } from 'react';
import { exchangeService, type ExchangeType, type ExchangeAccount } from '../services/exchangeService';

/* 거래소 실계좌 연결/수정 모달 — 대시보드·포트폴리오 공용 (exchangeService) */
const SONAR = 'var(--ci-sonar)';
const UP = '#ef4d4d';
const EX_LABEL: Record<ExchangeType, string> = { KIS: 'KIS', UPBIT: '업비트', BITGET: '비트겟' };

const Field = ({ label, value, onChange, type = 'password', placeholder }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder: string }) => (
  <label className="flex flex-col gap-1.5">
    <span className="text-[12px] font-semibold" style={{ color: 'var(--ci-ink2)' }}>{label}</span>
    <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="rounded-lg px-3 py-2.5 text-[13px] outline-none" style={{ border: '1px solid var(--ci-line)', background: 'var(--ci-card)', color: 'var(--ci-ink0)' }} />
  </label>
);

const ExchangeConnectModal = ({ exchangeType, account, onClose, onSaved }: {
  exchangeType: ExchangeType;
  account?: ExchangeAccount;
  onClose: () => void;
  onSaved: (msg: string, type?: 'success' | 'error') => void;
}) => {
  // 키 필드는 절대 프리필 금지 — 서버가 마스킹(****)해서 내려주므로 그대로 저장하면 실키가 깨짐. 계좌번호(평문)만 프리필.
  const [form, setForm] = useState({ apiKey: '', secretKey: '', appSecret: '', accountNumber: account?.accountNumber || '' });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const connected = !!account?.connected;
  const isKis = exchangeType === 'KIS';
  const isBitget = exchangeType === 'BITGET'; // Bitget은 Passphrase 필수 (appSecret 필드로 전달)
  // 거래소별 키 라벨: KIS=앱키/앱시크릿(한투는 이 둘뿐), 업비트=Access/Secret, 비트겟=API/Secret(+Passphrase)
  const keyLabels = isKis
    ? { key: '앱키 (App Key)', secret: '앱시크릿 (App Secret)' }
    : exchangeType === 'UPBIT'
      ? { key: 'Access Key', secret: 'Secret Key' }
      : { key: 'API Key', secret: 'Secret Key' };

  const save = async () => {
    setSaving(true); setErr(null);
    try {
      await exchangeService.saveAccount({ exchangeType, apiKey: form.apiKey, secretKey: form.secretKey, ...(isKis ? { accountNumber: form.accountNumber } : isBitget ? { appSecret: form.appSecret } : {}) });
      onSaved('실계좌가 연결되었습니다.'); onClose();
    } catch (e: any) { setErr(e?.response?.data?.message || '연결에 실패했습니다. API 키를 확인해주세요.'); }
    finally { setSaving(false); }
  };
  // Esc 키로 닫기(접근성)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const disconnect = async () => {
    if (!window.confirm(`${EX_LABEL[exchangeType]} 연결을 해제하시겠습니까?`)) return;
    try { await exchangeService.deleteAccount(exchangeType); onSaved('연결이 해제되었습니다.'); onClose(); }
    catch { onSaved('연결 해제에 실패했습니다.', 'error'); }
  };

  return (
    <div onClick={onClose} className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto px-6 py-12" style={{ background: 'rgba(6,11,31,.72)', backdropFilter: 'blur(6px)', animation: 'backdrop-in .2s ease' }}>
      <div role="dialog" aria-modal="true" aria-labelledby="exchange-modal-title" onClick={e => e.stopPropagation()} className="relative w-full max-w-[460px] rounded-[18px]" style={{ background: 'var(--ci-overlay)', border: '1px solid var(--ci-line-strong)', boxShadow: 'var(--ci-panel-shadow)', animation: 'modal-in .25s cubic-bezier(.2,.8,.2,1)' }}>
        <div className="wa-force-dark flex items-center justify-between rounded-t-[18px] px-6 py-4 text-white" style={{ background: 'linear-gradient(105deg,#142647 0%,#1d3c7a 52%,#2c6fe6 100%)' }}>
          <h3 id="exchange-modal-title" className="text-[15px] font-bold">{EX_LABEL[exchangeType]} API 연결</h3>
          <button type="button" onClick={onClose} aria-label="닫기" className="flex h-8 w-8 items-center justify-center rounded-lg text-[15px]" style={{ border: '1px solid rgba(255,255,255,.2)', background: 'rgba(255,255,255,.08)' }}><span aria-hidden="true">✕</span></button>
        </div>
        <div className="flex flex-col gap-3 p-6">
          <Field label={keyLabels.key} value={form.apiKey} onChange={v => setForm(f => ({ ...f, apiKey: v }))} placeholder={`${keyLabels.key} 입력`} />
          <Field label={keyLabels.secret} value={form.secretKey} onChange={v => setForm(f => ({ ...f, secretKey: v }))} placeholder={`${keyLabels.secret} 입력`} />
          {isKis && <>
            <Field label="계좌번호" value={form.accountNumber} onChange={v => setForm(f => ({ ...f, accountNumber: v }))} type="text" placeholder="예: 50123456-01" />
            <p className="text-[11px]" style={{ color: 'var(--ci-ink3)' }}>한국투자증권 개발자센터(apiportal)에서 발급한 <b>앱키·앱시크릿</b>을 입력하세요(별도 시크릿키 없음). 잔고 조회는 <b>실계좌(실전투자) 키</b> 기준이며 국내주식·미국주식(달러)을 함께 불러옵니다.</p>
          </>}
          {isBitget && <Field label="Passphrase" value={form.appSecret} onChange={v => setForm(f => ({ ...f, appSecret: v }))} placeholder="API 생성 시 설정한 Passphrase" />}
          {connected && <div className="rounded-lg px-3 py-2 text-[11.5px]" style={{ background: 'rgba(255,205,120,.08)', border: '1px solid rgba(255,205,120,.18)', color: '#ffcd78' }}>보안상 기존 키는 표시되지 않습니다. 변경하려면 키를 다시 입력하세요.</div>}
          {err && <div className="rounded-lg px-3 py-2 text-[12.5px]" style={{ background: 'rgba(239,77,77,.1)', border: '1px solid rgba(239,77,77,.25)', color: '#fca5a5' }}>{err}</div>}
          <p className="text-[11px]" style={{ color: 'var(--ci-ink3)' }}>🔒 API 키는 AES 암호화로 저장되며 읽기 전용 권한만 사용합니다.</p>
        </div>
        <div className="flex gap-2 px-6 py-4" style={{ borderTop: '1px solid var(--ci-line)' }}>
          {connected && <button type="button" onClick={disconnect} className="rounded-lg px-4 py-2.5 text-[13px] font-semibold" style={{ border: '1px solid rgba(239,77,77,.3)', color: UP }}>연결 해제</button>}
          <button type="button" onClick={save} disabled={saving || !form.apiKey || !form.secretKey} className="flex-1 rounded-lg py-2.5 text-[14px] font-bold text-white disabled:opacity-50" style={{ background: `linear-gradient(180deg, ${SONAR}, #2c6fe6)` }}>{saving ? '연결 중…' : connected ? '수정하기' : '연결하기'}</button>
        </div>
      </div>
    </div>
  );
};

export default ExchangeConnectModal;
