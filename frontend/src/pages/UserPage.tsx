import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';
import {
  userService,
  type UserProfile,
  type InvestmentStyle,
  type ExperienceLevel,
} from '../services/userService';

const INVESTMENT_STYLES: { value: InvestmentStyle; label: string; whale: string; desc: string; color: string; selectedBg: string; img: string }[] = [
  { value: 'AGGRESSIVE', label: '범고래', whale: 'Orca', desc: '바다의 최상위 포식자처럼, 과감한 공격으로 높은 수익을 노립니다', color: 'border-red-400', selectedBg: 'bg-gradient-to-r from-red-50 to-orange-50', img: '/whales/orca.png' },
  { value: 'BALANCED', label: '혹등고래', whale: 'Humpback', desc: '버블넷 사냥처럼, 다양한 전략으로 균형 잡힌 수익을 추구합니다', color: 'border-whale-light', selectedBg: 'bg-gradient-to-r from-blue-50 to-cyan-50', img: '/whales/humpback.png' },
  { value: 'CONSERVATIVE', label: '대왕고래', whale: 'Blue Whale', desc: '바다에서 가장 거대한 존재처럼, 느리지만 꾸준하고 안정적입니다', color: 'border-indigo-400', selectedBg: 'bg-gradient-to-r from-indigo-50 to-blue-50', img: '/whales/blue-whale.png' },
];

const EXPERIENCE_LEVELS: { value: ExperienceLevel; label: string; whale: string; desc: string; img: string }[] = [
  { value: 'BEGINNER', label: '아기 고래', whale: 'Calf', desc: '이제 막 바다에 뛰어든 새끼 고래예요', img: '/whales/beluga.png' },
  { value: 'INTERMEDIATE', label: '청년 고래', whale: 'Juvenile', desc: '어느 정도 파도를 읽을 줄 알아요', img: '/whales/dolphin.png' },
  { value: 'EXPERT', label: '고래 대장', whale: 'Alpha', desc: '깊은 바다도 자유롭게 유영합니다', img: '/whales/sperm-whale.png' },
];

const POPULAR_ASSETS = ['BTC', 'ETH', 'XRP', 'SOL', 'DOGE', 'ADA', 'DOT', 'AVAX', 'MATIC', 'LINK'];

const UserPage = () => {
  const navigate = useNavigate();
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

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await userService.getProfile();
        if (!cancelled) {
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || saving) return;
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
      setSaveMessage({ type: 'success', text: '프로필이 바다에 새겨졌습니다!' });
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : '저장에 실패했습니다.';
      setSaveMessage({ type: 'error', text: message });
    } finally {
      setSaving(false);
    }
  };

  const addAsset = (asset: string) => {
    const normalized = asset.toUpperCase().trim();
    if (normalized && !favoriteAssets.includes(normalized) && favoriteAssets.length < 20) {
      setFavoriteAssets([...favoriteAssets, normalized]);
    }
    setCustomAsset('');
  };

  const removeAsset = (asset: string) => {
    setFavoriteAssets(favoriteAssets.filter((a) => a !== asset));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header showNav />
        <LoadingSpinner fullScreen={false} message="프로필을 불러오는 중..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header showNav />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <ErrorMessage message={error} onRetry={() => window.location.reload()} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header showNav />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 상단 헤더 */}
        <div className="mb-8 bg-gradient-to-r from-whale-dark to-whale-light rounded-2xl shadow-xl p-6 md:p-8 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full blur-3xl" />
          <div className="relative z-10 flex items-center gap-4">
            <div className="w-16 h-16 bg-white bg-opacity-20 rounded-full flex items-center justify-center text-2xl font-bold backdrop-blur-sm">
              {(profile?.name ?? 'U').charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">내 프로필</h1>
              <p className="text-blue-100 text-sm md:text-base mt-1">
                나만의 투자 프로필을 완성해보세요
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* 좌측: 계정 정보 + 자기소개 */}
            <div className="lg:col-span-2 space-y-6">
              {/* 계정 정보 */}
              <div className="card">
                <h2 className="text-lg font-bold text-whale-dark mb-5">계정 정보</h2>

                {saveMessage && (
                  <div
                    className={`mb-4 p-3 rounded-lg text-sm ${
                      saveMessage.type === 'success'
                        ? 'bg-green-50 border border-green-200 text-green-800'
                        : 'bg-red-50 border border-red-200 text-red-800'
                    }`}
                    role="alert"
                  >
                    {saveMessage.text}
                  </div>
                )}

                <div className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">아이디</label>
                    <input
                      type="text"
                      value={profile?.userId ?? ''}
                      readOnly
                      className="input-field bg-gray-100 cursor-not-allowed"
                    />
                    <p className="mt-1 text-xs text-gray-500">로그인 아이디는 변경할 수 없습니다</p>
                  </div>

                  <div>
                    <label htmlFor="edit-name" className="block text-sm font-medium text-gray-700 mb-2">
                      닉네임
                    </label>
                    <input
                      id="edit-name"
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="input-field"
                      placeholder="닉네임을 입력하세요"
                      maxLength={50}
                    />
                    <p className="mt-1 text-xs text-gray-500">랭킹 등에 표시되는 이름입니다</p>
                  </div>

                  {profile?.authProvider && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">로그인 방식</label>
                      <div className="flex items-center gap-2">
                        <span className={`px-3 py-1.5 rounded-full text-sm font-medium ${
                          profile.authProvider === 'google'
                            ? 'bg-blue-50 text-blue-700'
                            : profile.authProvider === 'kakao'
                            ? 'bg-yellow-50 text-yellow-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}>
                          {profile.authProvider === 'google' ? 'Google' :
                           profile.authProvider === 'kakao' ? 'Kakao' : '이메일'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* 자기소개 */}
              <div className="card">
                <h2 className="text-lg font-bold text-whale-dark mb-5">자기소개</h2>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className="input-field resize-none"
                  rows={4}
                  placeholder="자신의 투자 스타일이나 목표를 소개해보세요"
                  maxLength={200}
                />
                <p className="mt-1 text-xs text-gray-400 text-right">{bio.length}/200</p>
              </div>

              {/* 관심 종목 */}
              <div className="card">
                <h2 className="text-lg font-bold text-whale-dark mb-3">관심 종목</h2>
                <p className="text-sm text-gray-500 mb-4">관심 있는 코인을 선택하거나 직접 입력하세요 (최대 20개)</p>

                {/* 인기 종목 빠른 선택 */}
                <div className="flex flex-wrap gap-2 mb-4">
                  {POPULAR_ASSETS.map((asset) => (
                    <button
                      key={asset}
                      type="button"
                      onClick={() =>
                        favoriteAssets.includes(asset) ? removeAsset(asset) : addAsset(asset)
                      }
                      className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                        favoriteAssets.includes(asset)
                          ? 'bg-whale-light text-white shadow-sm'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {asset}
                    </button>
                  ))}
                </div>

                {/* 직접 입력 */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customAsset}
                    onChange={(e) => setCustomAsset(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addAsset(customAsset);
                      }
                    }}
                    className="input-field flex-1"
                    placeholder="종목 코드 입력 (예: SHIB)"
                    maxLength={20}
                  />
                  <button
                    type="button"
                    onClick={() => addAsset(customAsset)}
                    disabled={!customAsset.trim()}
                    className="btn-secondary disabled:opacity-50 !px-4"
                  >
                    추가
                  </button>
                </div>

                {/* 선택된 종목 태그 */}
                {favoriteAssets.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {favoriteAssets.map((asset) => (
                      <span
                        key={asset}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-whale-light/10 text-whale-dark rounded-full text-sm font-medium"
                      >
                        {asset}
                        <button
                          type="button"
                          onClick={() => removeAsset(asset)}
                          className="ml-0.5 text-gray-400 hover:text-red-500 transition-colors !min-h-0 !min-w-0"
                          aria-label={`${asset} 제거`}
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* 우측 사이드바 */}
            <div className="space-y-6">
              {/* 투자 성향 */}
              <div className="card">
                <h2 className="text-lg font-bold text-whale-dark mb-2">나는 어떤 고래?</h2>
                <p className="text-sm text-gray-500 mb-4">투자 성향에 맞는 고래를 선택하세요</p>
                <div className="space-y-3">
                  {INVESTMENT_STYLES.map((style) => {
                    const isSelected = investmentStyle === style.value;
                    return (
                      <button
                        key={style.value}
                        type="button"
                        onClick={() => setInvestmentStyle(style.value)}
                        className={`w-full text-left p-4 rounded-xl border-2 transition-all duration-200 ${
                          isSelected
                            ? `${style.color} ${style.selectedBg} shadow-md scale-[1.02]`
                            : 'border-gray-100 hover:border-gray-200 hover:shadow-sm'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <img src={style.img} alt={style.label} className="w-10 h-10 object-contain flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className={`font-bold text-sm ${isSelected ? 'text-whale-dark' : 'text-gray-700'}`}>{style.label}</span>
                              <span className="text-[11px] text-gray-400 italic">{style.whale}</span>
                            </div>
                            <div className="text-xs text-gray-500 mt-1">{style.desc}</div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 투자 경험 */}
              <div className="card">
                <h2 className="text-lg font-bold text-whale-dark mb-2">항해 경험</h2>
                <p className="text-sm text-gray-500 mb-4">바다에서 얼마나 헤엄쳤나요?</p>
                <div className="space-y-3">
                  {EXPERIENCE_LEVELS.map((level) => {
                    const isSelected = experienceLevel === level.value;
                    return (
                      <button
                        key={level.value}
                        type="button"
                        onClick={() => setExperienceLevel(level.value)}
                        className={`w-full text-left p-4 rounded-xl border-2 transition-all duration-200 ${
                          isSelected
                            ? 'border-whale-light bg-gradient-to-r from-sky-50 to-blue-50 shadow-md scale-[1.02]'
                            : 'border-gray-100 hover:border-gray-200 hover:shadow-sm'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <img src={level.img} alt={level.label} className="w-10 h-10 object-contain flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className={`font-bold text-sm ${isSelected ? 'text-whale-dark' : 'text-gray-700'}`}>{level.label}</span>
                              <span className="text-[11px] text-gray-400 italic">{level.whale}</span>
                            </div>
                            <div className="text-xs text-gray-500 mt-1">{level.desc}</div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 저장 버튼 */}
              <div className="card !p-5">
                <button
                  type="submit"
                  className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={saving || !editName.trim()}
                >
                  {saving ? '저장 중...' : '프로필 저장'}
                </button>
                <button
                  type="button"
                  className="w-full btn-secondary mt-3"
                  onClick={() => navigate('/dashboard')}
                >
                  대시보드로 이동
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UserPage;
