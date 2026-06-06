import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import HelmShell from '../components/HelmShell';
import VirtSplashLoading from '../components/VirtSplashLoading';
import SplashLoading from '../components/SplashLoading';
import {
  userService,
  type UserProfile,
  type InvestmentStyle,
  type ExperienceLevel,
} from '../services/userService';
import { useAuth } from '../contexts/AuthContext';
import { validateNickname } from '../utils/nicknameFilter';
import { useRoutePrefix } from '../hooks/useRoutePrefix';

/* ────────────────────────────────────────────────────────────
   UserPage — 「디자인 개편」 톤. 프로필/설정 + 온보딩. HelmShell + 목업 다크 패널.
   상태·핸들러·온보딩 로직 전부 보존.
   ──────────────────────────────────────────────────────────── */

// 라이트/다크 적응 토큰(--ci-*) 사용 — 인라인 스타일은 전역 라이트 리맵을 못 받으므로 변수로 직접 참조
const SONAR = 'var(--ci-sonar)';
const INK1 = 'var(--ci-ink1)', INK2 = 'var(--ci-ink2)', INK3 = 'var(--ci-ink3)';
const HAIR = 'var(--ci-line)';
const panel: React.CSSProperties = { background: 'var(--ci-panel)', border: `1px solid ${HAIR}`, borderRadius: 16, boxShadow: 'var(--ci-panel-shadow)' };
const DARK_INPUT = 'w-full px-4 py-3 rounded-lg bg-white/[0.04] border border-white/10 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500/40';

const INVESTMENT_STYLES: { value: InvestmentStyle; label: string; whale: string; desc: string; img: string }[] = [
  { value: 'AGGRESSIVE', label: '범고래', whale: 'Orca', desc: '바다의 최상위 포식자처럼, 과감한 공격으로 높은 수익을 노립니다', img: '/whales/orca.png' },
  { value: 'BALANCED', label: '혹등고래', whale: 'Humpback', desc: '버블넷 사냥처럼, 다양한 전략으로 균형 잡힌 수익을 추구합니다', img: '/whales/humpback.png' },
  { value: 'CONSERVATIVE', label: '대왕고래', whale: 'Blue Whale', desc: '바다에서 가장 거대한 존재처럼, 느리지만 꾸준하고 안정적입니다', img: '/whales/blue-whale.png' },
];

const EXPERIENCE_LEVELS: { value: ExperienceLevel; label: string; whale: string; desc: string; img: string }[] = [
  { value: 'BEGINNER', label: '아기 고래', whale: 'Calf', desc: '이제 막 바다에 뛰어든 새끼 고래예요', img: '/whales/beluga.png' },
  { value: 'INTERMEDIATE', label: '청년 고래', whale: 'Juvenile', desc: '어느 정도 파도를 읽을 줄 알아요', img: '/whales/dolphin.png' },
  { value: 'EXPERT', label: '고래 대장', whale: 'Alpha', desc: '깊은 바다도 자유롭게 유영합니다', img: '/whales/sperm-whale.png' },
];

const POPULAR_CRYPTO = ['BTC', 'ETH', 'XRP', 'SOL', 'DOGE', 'ADA', 'DOT', 'AVAX', 'MATIC', 'LINK'];
const POPULAR_KR_STOCKS = ['삼성전자', 'SK하이닉스', 'LG에너지솔루션', 'NAVER', '카카오', '삼성바이오로직스', '현대차', 'POSCO홀딩스', '셀트리온', 'KB금융'];
const POPULAR_US_STOCKS = ['AAPL', 'NVDA', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'META', 'AVGO', 'TSM', 'AMD'];

const SelectCard = ({ selected, img, label, whale, desc, onClick }: { selected: boolean; img: string; label: string; whale: string; desc: string; onClick: () => void }) => (
  <button type="button" onClick={onClick} className="w-full text-left p-4 rounded-xl transition-all duration-200"
    style={selected
      ? { border: `1px solid rgba(91,157,255,.5)`, background: 'rgba(91,157,255,.10)', boxShadow: '0 0 0 1px rgba(91,157,255,.2)' }
      : { border: `1px solid ${HAIR}`, background: 'var(--ci-card)' }}>
    <div className="flex items-center gap-3">
      <img src={img} alt={label} className="w-10 h-10 object-contain flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className="font-bold text-sm" style={{ color: selected ? 'var(--ci-sonar)' : INK1 }}>{label}</span>
          <span className="text-[11px] italic" style={{ color: INK3 }}>{whale}</span>
        </div>
        <div className="text-xs mt-1" style={{ color: INK2 }}>{desc}</div>
      </div>
    </div>
  </button>
);

const UserPage = () => {
  const { isVirt } = useRoutePrefix();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isOnboarding = searchParams.get('onboarding') === 'true';
  const { session, refreshProfile, markOnboardingDone } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 폼 상태
  const [editName, setEditName] = useState('');
  const [bio, setBio] = useState('');
  const [investmentStyle, setInvestmentStyle] = useState<InvestmentStyle | undefined>();
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel | undefined>();
  const [favoriteAssets, setFavoriteAssets] = useState<string[]>([]);
  const [customAsset, setCustomAsset] = useState('');

  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const favoritesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await userService.getProfile();
        if (!cancelled) {
          if (!data) {
            setError('서버에 연결할 수 없습니다. 백엔드가 실행 중인지 확인해주세요.');
            return;
          }
          setProfile(data);
          setEditName(data.name ?? '');
          setBio(data.bio ?? '');
          setInvestmentStyle(data.investmentStyle);
          setExperienceLevel(data.experienceLevel);
          setFavoriteAssets(data.favoriteAssets ?? []);
        }
      } catch (e: unknown) {
        if (!cancelled) {
          const message = e instanceof Error ? e.message : '프로필을 불러오지 못했습니다.';
          setError(message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  // 대시보드에서 "관심 종목 추가하기"로 왔을 때 해당 섹션으로 스크롤
  useEffect(() => {
    if (!loading && searchParams.get('section') === 'favorites' && favoritesRef.current) {
      setTimeout(() => {
        favoritesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }, [loading, searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || saving) return;

    // 닉네임 금칙어 검사
    const nicknameCheck = validateNickname(editName);
    if (!nicknameCheck.valid) {
      setSaveMessage({ type: 'error', text: nicknameCheck.message });
      return;
    }

    // 온보딩 모드에서는 투자 성향 필수
    if (isOnboarding && !investmentStyle) {
      setSaveMessage({ type: 'error', text: '투자 성향을 선택해주세요 (나는 어떤 고래?)' });
      return;
    }

    setSaving(true);
    setSaveMessage(null);
    try {
      // 닉네임 변경
      await userService.updateProfile({ name: editName.trim() });
      // 투자 프로필 저장
      await userService.saveUserInfo({
        bio: bio.trim(),
        investmentStyle,
        experienceLevel,
        favoriteAssets,
      });
      setProfile((prev) => prev ? {
        ...prev,
        name: editName.trim(),
        bio: bio.trim(),
        investmentStyle,
        experienceLevel,
        favoriteAssets,
      } : null);
      // Header 닉네임 + 온보딩 상태 즉시 반영
      markOnboardingDone();
      await refreshProfile();
      if (isOnboarding) {
        const returnTo = searchParams.get('from');
        navigate(returnTo ? decodeURIComponent(returnTo) : '/dashboard');
        return;
      }
      setSaveMessage({ type: 'success', text: '프로필이 바다에 새겨졌습니다!' });
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : '저장에 실패했습니다.';
      setSaveMessage({ type: 'error', text: message });
    } finally {
      setSaving(false);
    }
  };

  const saveFavorites = (next: string[]) => {
    setFavoriteAssets(next);
    userService.saveUserInfo({ favoriteAssets: next }).catch(() => {});
  };

  const addAsset = (asset: string) => {
    const normalized = asset.toUpperCase().trim();
    if (normalized && !favoriteAssets.includes(normalized) && favoriteAssets.length < 20) {
      saveFavorites([...favoriteAssets, normalized]);
    }
    setCustomAsset('');
  };

  const removeAsset = (asset: string) => {
    saveFavorites(favoriteAssets.filter((a) => a !== asset));
  };

  const userName = profile?.name || (session?.user?.email ? session.user.email.split('@')[0] : '항해사');

  if (loading) {
    if (!isVirt) return <SplashLoading message="프로필을 불러오는 중..." />;
    return <VirtSplashLoading message="프로필을 불러오는 중..." />;
  }

  if (error) {
    return (
      <HelmShell active="" virt={isVirt} userName={userName}>
        <div className="mx-auto max-w-[760px] text-center" style={{ ...panel, padding: '48px 24px' }}>
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full" style={{ background: 'rgba(239,77,77,.12)', border: '1px solid rgba(239,77,77,.28)' }}>
            <svg className="w-7 h-7" style={{ color: '#ef4d4d' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <h2 className="text-[18px] font-bold">데이터를 불러오지 못했어요</h2>
          <p className="mt-2 text-[13px]" style={{ color: INK2 }}>{error}</p>
          <button onClick={() => window.location.reload()} className="mt-5 rounded-lg px-5 py-2.5 text-[13px] font-semibold" style={{ background: 'rgba(91,157,255,.12)', border: '1px solid rgba(91,157,255,.32)', color: SONAR }}>다시 시도</button>
        </div>
      </HelmShell>
    );
  }

  return (
    <HelmShell active="" virt={isVirt} userName={userName} session={isOnboarding ? '프로필을 설정해 항해를 시작하세요' : '내 프로필'}>
      <div className="mx-auto max-w-[1100px]">
        {/* 온보딩 환영 배너 */}
        {isOnboarding && (
          <div className="mb-6 rounded-2xl p-5" style={{ background: 'linear-gradient(135deg, rgba(34,197,142,.16), rgba(14,40,56,.4))', border: '1px solid rgba(34,197,142,.3)' }}>
            <div className="flex items-center gap-3">
              <img src="/whales/risso-dolphin.png" alt="환영" className="w-12 h-12 object-contain" />
              <div>
                <h2 className="text-lg font-bold">바다에 오신 것을 환영합니다!</h2>
                <p className="text-sm mt-0.5" style={{ color: 'rgba(167,243,208,.9)' }}>투자 프로필을 설정하면 맞춤형 경험을 제공해드려요</p>
              </div>
            </div>
          </div>
        )}

        {/* 상단 헤더 */}
        <div className="mb-6 rounded-2xl p-6 md:p-7 relative overflow-hidden" style={{ background: 'linear-gradient(135deg, rgba(91,157,255,.16), rgba(91,157,255,.05))', border: '1px solid rgba(91,157,255,.28)' }}>
          <div className="absolute top-0 right-0 w-64 h-64 rounded-full blur-3xl" style={{ background: 'rgba(91,157,255,.08)' }} />
          <div className="relative z-10 flex items-center gap-4">
            <span className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold" style={{ background: 'linear-gradient(135deg,#5b9dff,#2c6fe6)', color: '#04121d' }}>
              {(profile?.name ?? 'U').charAt(0).toUpperCase()}
            </span>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">{isOnboarding ? '프로필 설정' : '내 프로필'}</h1>
              <p className="text-sm md:text-base mt-1" style={{ color: INK1 }}>
                {isOnboarding ? '나만의 투자 프로필을 만들어보세요' : '나만의 투자 프로필을 완성해보세요'}
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* 좌측: 계정 정보 + 자기소개 + 관심종목 */}
            <div className="lg:col-span-2 space-y-6">
              {/* 계정 정보 */}
              <div style={{ ...panel, padding: '22px' }}>
                <h2 className="text-lg font-bold mb-5">계정 정보</h2>

                {saveMessage && (
                  <div className="mb-4 p-3 rounded-lg text-sm" role="alert"
                    style={saveMessage.type === 'success'
                      ? { background: 'rgba(34,197,142,.1)', border: '1px solid rgba(34,197,142,.25)', color: '#5fd0a8' }
                      : { background: 'rgba(239,77,77,.1)', border: '1px solid rgba(239,77,77,.25)', color: '#fca5a5' }}>
                    {saveMessage.text}
                  </div>
                )}

                <div className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: INK2 }}>아이디</label>
                    <input type="text" aria-label="로그인 아이디" value={profile?.userId ?? ''} readOnly className={`${DARK_INPUT} cursor-not-allowed opacity-70`} />
                    <p className="mt-1 text-xs" style={{ color: INK3 }}>로그인 아이디는 변경할 수 없습니다</p>
                  </div>

                  <div>
                    <label htmlFor="edit-name" className="block text-sm font-medium mb-2" style={{ color: INK2 }}>닉네임</label>
                    <input id="edit-name" type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className={DARK_INPUT} placeholder="닉네임을 입력하세요" maxLength={50} />
                    <p className="mt-1 text-xs" style={{ color: INK3 }}>랭킹 등에 표시되는 이름입니다</p>
                  </div>

                  {profile?.authProvider && (
                    <div>
                      <label className="block text-sm font-medium mb-2" style={{ color: INK2 }}>로그인 방식</label>
                      <span className="inline-block px-3 py-1.5 rounded-full text-sm font-medium" style={{ background: 'rgba(91,157,255,.12)', color: 'var(--ci-sonar)', border: '1px solid rgba(91,157,255,.24)' }}>
                        {profile.authProvider === 'google' ? 'Google' : profile.authProvider === 'kakao' ? 'Kakao' : '이메일'}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* 자기소개 */}
              <div style={{ ...panel, padding: '22px' }}>
                <h2 className="text-lg font-bold mb-5">자기소개</h2>
                <textarea aria-label="자기소개" value={bio} onChange={(e) => setBio(e.target.value)} className={`${DARK_INPUT} resize-none`} rows={4} placeholder="자신의 투자 스타일이나 목표를 소개해보세요" maxLength={200} />
                <p className="mt-1 text-xs text-right" style={{ color: INK3 }}>{bio.length}/200</p>
              </div>

              {/* 관심 종목 */}
              <div ref={favoritesRef} style={{ ...panel, padding: '22px' }}>
                <h2 className="text-lg font-bold mb-3">관심 종목</h2>
                <p className="text-sm mb-4" style={{ color: INK2 }}>관심 있는 종목을 선택하거나 직접 입력하세요 (최대 20개)</p>

                {[
                  { label: '암호화폐', items: POPULAR_CRYPTO },
                  { label: '국내 주식', items: POPULAR_KR_STOCKS },
                  { label: '미국 주식', items: POPULAR_US_STOCKS },
                ].map((group) => (
                  <div key={group.label} className="mb-4">
                    <p className="text-xs font-semibold mb-2" style={{ color: INK3 }}>{group.label}</p>
                    <div className="flex flex-wrap gap-2">
                      {group.items.map((asset) => {
                        const on = favoriteAssets.includes(asset);
                        return (
                          <button key={asset} type="button" onClick={() => (on ? removeAsset(asset) : addAsset(asset))}
                            className="px-3 py-1.5 rounded-full text-sm font-medium transition-all"
                            style={on
                              ? { background: SONAR, color: '#04121d' }
                              : { background: 'var(--ci-card)', color: INK1, border: `1px solid ${HAIR}` }}>
                            {asset}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}

                {/* 직접 입력 */}
                <div className="flex gap-2">
                  <input type="text" aria-label="관심종목 직접 입력" value={customAsset} onChange={(e) => setCustomAsset(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addAsset(customAsset); } }}
                    className={`${DARK_INPUT} flex-1`} placeholder="종목 코드 입력 (예: SHIB, 삼성SDI, PLTR)" maxLength={20} />
                  <button type="button" onClick={() => addAsset(customAsset)} disabled={!customAsset.trim()}
                    className="px-5 rounded-lg text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{ background: 'rgba(91,157,255,.12)', border: '1px solid rgba(91,157,255,.32)', color: SONAR }}>추가</button>
                </div>

                {/* 선택된 종목 태그 */}
                {favoriteAssets.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {favoriteAssets.map((asset) => (
                      <span key={asset} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium" style={{ background: 'rgba(91,157,255,.18)', color: 'var(--ci-sonar)' }}>
                        {asset}
                        <button type="button" onClick={() => removeAsset(asset)} className="ml-0.5 text-white/50 hover:text-red-400 transition-colors" aria-label={`${asset} 제거`}>
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                {favoriteAssets.length > 0 && <p className="mt-2 text-[11px]" style={{ color: INK3 }}>* 관심 종목은 선택 즉시 자동 저장됩니다</p>}
              </div>
            </div>

            {/* 우측 사이드바 */}
            <div className="space-y-6">
              {/* 투자 성향 */}
              <div style={{ ...panel, padding: '22px' }}>
                <h2 className="text-lg font-bold mb-2">나는 어떤 고래?</h2>
                <p className="text-sm mb-4" style={{ color: INK2 }}>투자 성향에 맞는 고래를 선택하세요</p>
                <div className="space-y-3">
                  {INVESTMENT_STYLES.map((style) => (
                    <SelectCard key={style.value} selected={investmentStyle === style.value} img={style.img} label={style.label} whale={style.whale} desc={style.desc} onClick={() => setInvestmentStyle(style.value)} />
                  ))}
                </div>
              </div>

              {/* 투자 경험 */}
              <div style={{ ...panel, padding: '22px' }}>
                <h2 className="text-lg font-bold mb-2">항해 경험</h2>
                <p className="text-sm mb-4" style={{ color: INK2 }}>바다에서 얼마나 헤엄쳤나요?</p>
                <div className="space-y-3">
                  {EXPERIENCE_LEVELS.map((level) => (
                    <SelectCard key={level.value} selected={experienceLevel === level.value} img={level.img} label={level.label} whale={level.whale} desc={level.desc} onClick={() => setExperienceLevel(level.value)} />
                  ))}
                </div>
              </div>

              {/* 저장 버튼 */}
              <div style={{ ...panel, padding: '18px' }}>
                <button type="submit" disabled={saving || !editName.trim()}
                  className="w-full py-2.5 px-4 rounded-lg font-semibold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: SONAR, color: '#04121d' }}>
                  {saving ? '저장 중...' : '프로필 저장'}
                </button>
                <button type="button" onClick={() => {
                  if (isOnboarding) {
                    // 건너뛰기: 온보딩 완료로 표시(세션 + localStorage)해 ProtectedRoute가 다시 막아 무한 리다이렉트되지 않도록.
                    try { localStorage.setItem('whalearc_onboarding_skipped', '1'); } catch { /* ignore */ }
                    markOnboardingDone();
                  }
                  navigate('/dashboard');
                }}
                  className="w-full mt-3 py-2.5 px-4 rounded-lg font-semibold text-sm transition-colors"
                  style={{ border: `1px solid ${HAIR}`, color: INK1 }}>
                  {isOnboarding ? '건너뛰기' : '대시보드로 이동'}
                </button>
              </div>

              {/* 문의하기 */}
              {!isOnboarding && (
                <div style={{ ...panel, padding: '18px' }}>
                  <h3 className="text-sm font-bold mb-3">문의 · 피드백</h3>
                  <p className="text-xs mb-3" style={{ color: INK2 }}>버그 신고, 기능 제안, 또는 궁금한 점이 있으시면 편하게 연락해주세요.</p>
                  <div className="space-y-2">
                    {['khyun1109@gmail.com', 'jhschris8080@naver.com'].map((mail) => (
                      <a key={mail} href={`mailto:${mail}`} className="w-full flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors hover:bg-white/[0.06]"
                        style={{ background: 'var(--ci-card)', border: `1px solid ${HAIR}`, color: INK1 }}>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                        {mail}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </form>
      </div>
    </HelmShell>
  );
};

export default UserPage;
