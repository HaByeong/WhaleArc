/**
 * 유저(프로필) 페이지
 *
 * 현업에서 자주 쓰는 패턴:
 * - 마운트 시 1회 프로필 조회 (useEffect + async load)
 * - 로딩/에러/성공 상태 분리해서 UI 분기 (로딩 스피너, 에러 메시지, 폼)
 * - 수정 폼은 controlled component + 로컬 state로 관리 후 submit 시에만 API 호출
 * - 성공 시 프로필 state 갱신 또는 토스트 메시지로 피드백
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';
import { userService, type UserProfile, type UserUpdateRequest } from '../services/userService';

const UserPage = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** 수정 폼용 로컬 state (프로필과 분리해 두면 "저장" 전까지 서버에 반영 안 됨) */
  const [editName, setEditName] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  /** 마운트 시 프로필 1회 로드 */
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

  /** 프로필 수정 제출 */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || saving) return;
    setSaving(true);
    setSaveMessage(null);
    try {
      const body: UserUpdateRequest = { name: editName.trim() };
      await userService.updateProfile(body);
      setProfile((prev) => (prev ? { ...prev, name: body.name } : null));
      setSaveMessage('저장되었습니다.');
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : '저장에 실패했습니다.';
      setSaveMessage(message);
    } finally {
      setSaving(false);
    }
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
          <ErrorMessage
            message={error}
            onRetry={() => window.location.reload()}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header showNav />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 상단 헤더 영역 */}
        <div className="mb-8 bg-gradient-to-r from-whale-dark to-whale-light rounded-2xl shadow-xl p-6 md:p-8 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full blur-3xl" />
          <div className="relative z-10 flex items-center gap-4">
            <div className="w-16 h-16 bg-white bg-opacity-20 rounded-full flex items-center justify-center text-2xl font-bold backdrop-blur-sm">
              {profile?.userId?.charAt(0).toUpperCase() ?? 'U'}
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">내 프로필</h1>
              <p className="text-blue-100 text-sm md:text-base mt-1">
                계정 정보를 확인하고 수정할 수 있습니다
              </p>
            </div>
          </div>
        </div>

        <div className="max-w-xl">
          <div className="card">
            <h2 className="text-xl font-bold text-whale-dark mb-6">계정 정보</h2>

            {saveMessage && (
              <div
                className="mb-4 p-3 rounded-lg bg-green-50 border border-green-200 text-green-800 text-sm"
                role="alert"
              >
                {saveMessage}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* 읽기 전용: 아이디 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  아이디
                </label>
                <input
                  type="text"
                  value={profile?.userId ?? ''}
                  readOnly
                  className="input-field bg-gray-100 cursor-not-allowed"
                  aria-readonly="true"
                />
                <p className="mt-1 text-xs text-gray-500">
                  로그인 아이디는 변경할 수 없습니다
                </p>
              </div>

              {/* 수정 가능: 닉네임(이름) */}
              <div>
                <label htmlFor="edit-name" className="block text-sm font-medium text-gray-700 mb-2">
                  닉네임 (표시 이름)
                </label>
                <input
                  id="edit-name"
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="input-field"
                  placeholder="닉네임을 입력하세요"
                  maxLength={50}
                  aria-describedby="edit-name-hint"
                />
                <p id="edit-name-hint" className="mt-1 text-xs text-gray-500">
                  랭킹 등에 표시되는 이름입니다
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={saving || !editName.trim()}
                >
                  {saving ? '저장 중...' : '저장'}
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => navigate('/dashboard')}
                >
                  대시보드로
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserPage;
