import { useState, useRef, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import Header from '../components/Header';
import apiClient from '../utils/api';

type FeedbackCategory = 'bug' | 'feature' | 'ui' | 'other';

interface FeedbackItem {
  id: string;
  category: FeedbackCategory;
  title: string;
  content: string;
  createdAt: string;
  status: 'pending' | 'reviewed' | 'resolved';
  authorName: string;
  upvotes: number;
  hasUpvoted: boolean;
  isOwner: boolean;
  isAdmin: boolean;
  reviewerName: string | null;
  imageUrls: string[];
}

const categoryLabels: Record<FeedbackCategory, string> = {
  bug: '버그 신고',
  feature: '기능 제안',
  ui: 'UI/UX 개선',
  other: '기타',
};

const categoryColors: Record<FeedbackCategory, { dark: string; light: string }> = {
  bug: { dark: 'bg-red-500/15 text-red-400 border-red-500/25', light: 'bg-red-50 text-red-600 border-red-200' },
  feature: { dark: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/25', light: 'bg-blue-50 text-blue-600 border-blue-200' },
  ui: { dark: 'bg-purple-500/15 text-purple-400 border-purple-500/25', light: 'bg-purple-50 text-purple-600 border-purple-200' },
  other: { dark: 'bg-slate-500/15 text-slate-400 border-slate-500/25', light: 'bg-gray-50 text-gray-600 border-gray-200' },
};

const statusLabels: Record<string, string> = {
  pending: '검토 대기',
  reviewed: '검토 중',
  resolved: '반영 완료',
};

const statusColors: Record<string, { dark: string; light: string }> = {
  pending: { dark: 'text-yellow-400', light: 'text-yellow-600' },
  reviewed: { dark: 'text-cyan-400', light: 'text-blue-600' },
  resolved: { dark: 'text-green-400', light: 'text-green-600' },
};

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

const FeedbackPage = () => {
  const { isDark } = useTheme();
  const { profileName, user } = useAuth();

  const [isAdmin, setIsAdmin] = useState(false);
  const [adminChecking, setAdminChecking] = useState(true);

  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [category, setCategory] = useState<FeedbackCategory>('feature');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [filterCategory, setFilterCategory] = useState<FeedbackCategory | 'all'>('all');
  const [authorMode, setAuthorMode] = useState<'real' | 'custom' | 'anonymous'>('real');
  const [customName, setCustomName] = useState('');
  const [pendingImages, setPendingImages] = useState<File[]>([]);
  const [editingFeedback, setEditingFeedback] = useState<FeedbackItem | null>(null);
  const [editCategory, setEditCategory] = useState<FeedbackCategory>('feature');
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editAuthorMode, setEditAuthorMode] = useState<'real' | 'custom' | 'anonymous'>('real');
  const [editCustomName, setEditCustomName] = useState('');
  const [editPendingImages, setEditPendingImages] = useState<File[]>([]);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadedOnce, setLoadedOnce] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);

  const displayName = profileName || user?.user_metadata?.name || user?.email?.split('@')[0] || '사용자';

  const getImageFullUrl = (url: string) => {
    if (url.startsWith('http')) return url;
    return API_BASE + url;
  };

  // 피드백 목록 조회
  const loadFeedbacks = async () => {
    try {
      setLoading(true);
      setError(null);
      const params: Record<string, string> = {};
      if (filterCategory !== 'all') params.category = filterCategory;
      const response = await apiClient.get('/api/feedback', { params });
      if (response.data?.data) {
        setFeedbacks(response.data.data);
      }
    } catch {
      setFeedbacks([]);
    } finally {
      setLoading(false);
      setLoadedOnce(true);
    }
  };

  // 이미지 업로드
  const uploadImages = async (feedbackId: string, files: File[]) => {
    for (const file of files) {
      const formData = new FormData();
      formData.append('file', file);
      await apiClient.post(`/api/feedback/${feedbackId}/images`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    }
  };

  // 피드백 제출
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    if (authorMode === 'custom' && !customName.trim()) return;

    const authorName = authorMode === 'anonymous' ? '익명' : authorMode === 'custom' ? customName.trim() : displayName;

    try {
      setSubmitting(true);
      setError(null);
      const res = await apiClient.post('/api/feedback', { category, title: title.trim(), content: content.trim(), authorName });
      const feedbackId = res.data?.data?.id;
      if (feedbackId && pendingImages.length > 0) {
        await uploadImages(feedbackId, pendingImages);
      }
      setTitle('');
      setContent('');
      setCustomName('');
      setPendingImages([]);
      setShowForm(false);
      setSubmitSuccess(true);
      setTimeout(() => setSubmitSuccess(false), 3000);
      loadFeedbacks();
    } catch {
      setError('피드백 제출에 실패했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setSubmitting(false);
    }
  };

  // 수정 시작
  const startEditing = (feedback: FeedbackItem) => {
    setEditingFeedback(feedback);
    setEditCategory(feedback.category);
    setEditTitle(feedback.title);
    setEditContent(feedback.content);
    setEditPendingImages([]);
    if (feedback.authorName === '익명') {
      setEditAuthorMode('anonymous');
      setEditCustomName('');
    } else if (feedback.authorName === displayName) {
      setEditAuthorMode('real');
      setEditCustomName('');
    } else {
      setEditAuthorMode('custom');
      setEditCustomName(feedback.authorName);
    }
  };

  const cancelEditing = () => {
    setEditingFeedback(null);
    setEditPendingImages([]);
  };

  // 수정 제출
  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFeedback || !editTitle.trim() || !editContent.trim()) return;
    if (editAuthorMode === 'custom' && !editCustomName.trim()) return;

    const authorName = editAuthorMode === 'anonymous' ? '익명' : editAuthorMode === 'custom' ? editCustomName.trim() : displayName;

    try {
      setSubmitting(true);
      setError(null);
      await apiClient.put(`/api/feedback/${editingFeedback.id}`, {
        category: editCategory,
        title: editTitle.trim(),
        content: editContent.trim(),
        authorName,
      });
      if (editPendingImages.length > 0) {
        await uploadImages(editingFeedback.id, editPendingImages);
      }
      setEditingFeedback(null);
      setEditPendingImages([]);
      setSubmitSuccess(true);
      setTimeout(() => setSubmitSuccess(false), 3000);
      loadFeedbacks();
    } catch {
      setError('피드백 수정에 실패했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setSubmitting(false);
    }
  };

  // 상태 변경 (관리자)
  const handleStatusChange = async (id: string, status: string) => {
    try {
      await apiClient.put(`/api/feedback/${id}/status`, { status });
      setFeedbacks(prev => prev.map(f => f.id === id ? { ...f, status: status as FeedbackItem['status'] } : f));
    } catch {
      setError('상태 변경에 실패했습니다.');
    }
  };

  // 추천
  const handleUpvote = async (id: string) => {
    try {
      await apiClient.post(`/api/feedback/${id}/upvote`);
      setFeedbacks(prev =>
        prev.map(f =>
          f.id === id
            ? { ...f, upvotes: f.hasUpvoted ? f.upvotes - 1 : f.upvotes + 1, hasUpvoted: !f.hasUpvoted }
            : f
        )
      );
    } catch {
      // 무시
    }
  };

  // 파일 선택 핸들러
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, mode: 'create' | 'edit') => {
    const files = Array.from(e.target.files || []);
    const valid = files.filter(f => f.size <= 5 * 1024 * 1024 && f.type.startsWith('image/'));
    if (mode === 'create') {
      setPendingImages(prev => [...prev, ...valid].slice(0, 5));
    } else {
      const existingCount = editingFeedback?.imageUrls?.length || 0;
      setEditPendingImages(prev => [...prev, ...valid].slice(0, 5 - existingCount));
    }
    e.target.value = '';
  };

  const removePendingImage = (index: number, mode: 'create' | 'edit') => {
    if (mode === 'create') {
      setPendingImages(prev => prev.filter((_, i) => i !== index));
    } else {
      setEditPendingImages(prev => prev.filter((_, i) => i !== index));
    }
  };

  // 관리자 여부 확인 (최초 1회)
  useEffect(() => {
    let cancelled = false;
    apiClient
      .get('/api/feedback/me')
      .then((res) => {
        if (cancelled) return;
        setIsAdmin(!!res.data?.data?.isAdmin);
      })
      .catch(() => {
        if (cancelled) return;
        setIsAdmin(false);
      })
      .finally(() => {
        if (cancelled) return;
        setAdminChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // 관리자에게만 목록 최초 로드
  if (isAdmin && !loadedOnce && !loading) {
    loadFeedbacks();
  }

  const statusOrder: Record<string, number> = { reviewed: 0, pending: 1, resolved: 2 };

  const filteredFeedbacks = (filterCategory === 'all'
    ? feedbacks
    : feedbacks.filter(f => f.category === filterCategory)
  ).slice().sort((a, b) => (statusOrder[a.status] ?? 1) - (statusOrder[b.status] ?? 1));

  // 이미지 첨부 UI 컴포넌트
  const ImageUploadSection = ({ images, pending, onRemovePending, mode, inputRef, maxTotal = 5 }: {
    images: string[];
    pending: File[];
    onRemovePending: (i: number) => void;
    mode: 'create' | 'edit';
    inputRef: React.RefObject<HTMLInputElement>;
    maxTotal?: number;
  }) => {
    const totalCount = images.length + pending.length;
    return (
      <div className="mb-4">
        <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
          사진 첨부 <span className={`font-normal ${isDark ? 'text-slate-600' : 'text-gray-400'}`}>({totalCount}/5)</span>
        </label>
        <div className="flex flex-wrap gap-2">
          {/* 기존 이미지 (수정 모드) */}
          {images.map((url, i) => (
            <div key={`existing-${i}`} className="relative group">
              <img
                src={getImageFullUrl(url)}
                alt={`첨부 ${i + 1}`}
                className={`w-16 h-16 rounded-lg object-cover border cursor-pointer ${
                  isDark ? 'border-white/10' : 'border-gray-200'
                }`}
                onClick={() => setLightboxUrl(getImageFullUrl(url))}
              />
            </div>
          ))}
          {/* 새로 추가할 이미지 미리보기 */}
          {pending.map((file, i) => (
            <div key={`pending-${i}`} className="relative group">
              <img
                src={URL.createObjectURL(file)}
                alt={`새 첨부 ${i + 1}`}
                className={`w-16 h-16 rounded-lg object-cover border ${
                  isDark ? 'border-cyan-500/30' : 'border-whale-light/30'
                }`}
              />
              <button
                type="button"
                onClick={() => onRemovePending(i)}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                ×
              </button>
            </div>
          ))}
          {/* 추가 버튼 */}
          {totalCount < maxTotal && (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className={`w-16 h-16 rounded-lg border-2 border-dashed flex items-center justify-center transition-colors ${
                isDark
                  ? 'border-white/10 text-slate-600 hover:border-white/20 hover:text-slate-400'
                  : 'border-gray-200 text-gray-400 hover:border-gray-300 hover:text-gray-500'
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          multiple
          className="hidden"
          onChange={e => handleFileSelect(e, mode)}
        />
        <p className={`mt-1 text-xs ${isDark ? 'text-slate-600' : 'text-gray-400'}`}>
          JPG, PNG, GIF, WebP · 최대 5MB
        </p>
      </div>
    );
  };

  return (
    <div className={`min-h-screen ${isDark ? 'bg-[var(--wa-page-bg)]' : 'bg-gray-50'}`}>
      <Header showNav={true} />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 페이지 헤더 */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-whale-dark'}`}>
              {isAdmin ? '피드백 관리' : '의견 보내기'}
            </h1>
            <p className={`mt-1 text-sm ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
              {isAdmin
                ? '사용자 의견을 검토하고 응답할 수 있습니다.'
                : 'WhaleArc를 더 좋게 만들 수 있도록 의견을 들려주세요.'}
            </p>
          </div>
          {isAdmin && (
            <button
              onClick={() => setShowForm(!showForm)}
              className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                showForm
                  ? isDark ? 'bg-white/10 text-slate-300 hover:bg-white/15' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                  : 'bg-gradient-to-r from-whale-light to-whale-accent text-white shadow-lg shadow-whale-light/25 hover:shadow-whale-light/40'
              }`}
            >
              {showForm ? '취소' : '피드백 작성'}
            </button>
          )}
        </div>

        {/* 관리자 체크 로딩 */}
        {adminChecking && (
          <div className="flex justify-center py-16">
            <div className={`w-8 h-8 border-2 rounded-full animate-spin ${
              isDark ? 'border-cyan-500/30 border-t-cyan-400' : 'border-whale-light/30 border-t-whale-light'
            }`} />
          </div>
        )}

        {/* 성공 메시지 */}
        {submitSuccess && (
          <div className={`mb-6 px-4 py-3 rounded-xl text-sm font-medium ${
            isDark ? 'bg-green-500/15 text-green-400 border border-green-500/25' : 'bg-green-50 text-green-700 border border-green-200'
          }`}>
            피드백이 성공적으로 저장되었습니다. 소중한 의견 감사합니다!
          </div>
        )}

        {/* 에러 메시지 */}
        {error && (
          <div className={`mb-6 px-4 py-3 rounded-xl text-sm font-medium ${
            isDark ? 'bg-red-500/15 text-red-400 border border-red-500/25' : 'bg-red-50 text-red-700 border border-red-200'
          }`}>
            {error}
          </div>
        )}

        {/* 피드백 작성 폼 — 비관리자는 항상 노출, 관리자는 토글 */}
        {!adminChecking && (showForm || !isAdmin) && (
          <form onSubmit={handleSubmit} className={`mb-8 p-6 rounded-2xl border ${
            isDark ? 'bg-white/[0.02] border-white/[0.06]' : 'bg-white border-gray-100 shadow-sm'
          }`}>
            <h2 className={`text-lg font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-800'}`}>
              {isAdmin ? '새 피드백 작성' : '의견을 들려주세요'}
            </h2>

            {/* 카테고리 선택 */}
            <div className="mb-4">
              <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
                카테고리
              </label>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(categoryLabels) as FeedbackCategory[]).map(cat => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategory(cat)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                      category === cat
                        ? isDark ? categoryColors[cat].dark : categoryColors[cat].light
                        : isDark ? 'border-white/10 text-slate-500 hover:border-white/20' : 'border-gray-200 text-gray-400 hover:border-gray-300'
                    }`}
                  >
                    {categoryLabels[cat]}
                  </button>
                ))}
              </div>
            </div>

            {/* 제목 */}
            <div className="mb-4">
              <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
                제목
              </label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="간단히 요약해주세요"
                maxLength={100}
                className={`w-full px-4 py-2.5 rounded-xl text-sm border transition-colors focus:outline-none focus:ring-2 focus:ring-whale-light ${
                  isDark
                    ? 'bg-white/[0.04] border-white/[0.08] text-white placeholder-slate-600'
                    : 'bg-gray-50 border-gray-200 text-gray-800 placeholder-gray-400'
                }`}
              />
            </div>

            {/* 내용 */}
            <div className="mb-5">
              <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
                상세 내용
              </label>
              <textarea
                value={content}
                onChange={e => setContent(e.target.value)}
                placeholder="자세히 설명해주시면 빠르게 반영할 수 있어요"
                rows={5}
                maxLength={2000}
                className={`w-full px-4 py-2.5 rounded-xl text-sm border transition-colors focus:outline-none focus:ring-2 focus:ring-whale-light resize-none ${
                  isDark
                    ? 'bg-white/[0.04] border-white/[0.08] text-white placeholder-slate-600'
                    : 'bg-gray-50 border-gray-200 text-gray-800 placeholder-gray-400'
                }`}
              />
              <p className={`mt-1 text-xs text-right ${isDark ? 'text-slate-600' : 'text-gray-400'}`}>
                {content.length}/2000
              </p>
            </div>

            {/* 사진 첨부 */}
            <ImageUploadSection
              images={[]}
              pending={pendingImages}
              onRemovePending={(i) => removePendingImage(i, 'create')}
              mode="create"
              inputRef={fileInputRef}
            />

            {/* 작성자 설정 — 관리자만 익명/다른 닉네임 옵션 노출 */}
            {isAdmin && (
              <div className="mb-5">
                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
                  작성자
                </label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {([
                    { value: 'real' as const, label: displayName },
                    { value: 'custom' as const, label: '다른 닉네임' },
                    { value: 'anonymous' as const, label: '익명' },
                  ]).map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setAuthorMode(opt.value)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                        authorMode === opt.value
                          ? 'bg-gradient-to-r from-whale-light to-whale-accent text-white border-transparent shadow-sm'
                          : isDark ? 'border-white/10 text-slate-500 hover:border-white/20' : 'border-gray-200 text-gray-400 hover:border-gray-300'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                {authorMode === 'custom' && (
                  <input
                    type="text"
                    value={customName}
                    onChange={e => setCustomName(e.target.value)}
                    placeholder="사용할 닉네임을 입력하세요"
                    maxLength={20}
                    className={`w-full px-4 py-2.5 rounded-xl text-sm border transition-colors focus:outline-none focus:ring-2 focus:ring-whale-light ${
                      isDark
                        ? 'bg-white/[0.04] border-white/[0.08] text-white placeholder-slate-600'
                        : 'bg-gray-50 border-gray-200 text-gray-800 placeholder-gray-400'
                    }`}
                  />
                )}
              </div>
            )}

            {/* 제출 버튼 */}
            <div className="flex items-center justify-between">
              <p className={`text-xs ${isDark ? 'text-slate-600' : 'text-gray-400'}`}>
                {isAdmin
                  ? (authorMode === 'anonymous' ? '익명으로' : authorMode === 'custom' ? (customName.trim() || '닉네임') + '(으)로' : displayName + '님으로') + ' 제출됩니다'
                  : '제출하신 의견은 운영자만 확인합니다.'}
              </p>
              <button
                type="submit"
                disabled={submitting || !title.trim() || !content.trim() || (authorMode === 'custom' && !customName.trim())}
                className="px-6 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-whale-light to-whale-accent text-white shadow-lg shadow-whale-light/25 hover:shadow-whale-light/40 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
              >
                {submitting ? '제출 중...' : '제출하기'}
              </button>
            </div>
          </form>
        )}

        {/* 필터 — 관리자 전용 */}
        {!adminChecking && isAdmin && (
        <div className="mb-6 flex flex-wrap gap-2">
          {(['all', 'bug', 'feature', 'ui', 'other'] as const).map(cat => (
            <button
              key={cat}
              onClick={() => setFilterCategory(cat)}
              className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
                filterCategory === cat
                  ? 'bg-gradient-to-r from-whale-light to-whale-accent text-white shadow-sm'
                  : isDark ? 'text-slate-500 hover:text-slate-300 hover:bg-white/5' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
              }`}
            >
              {cat === 'all' ? '전체' : categoryLabels[cat]}
            </button>
          ))}
        </div>
        )}

        {/* 피드백 목록 — 관리자 전용 */}
        {!adminChecking && isAdmin && (loading ? (
          <div className="flex justify-center py-16">
            <div className={`w-8 h-8 border-2 rounded-full animate-spin ${
              isDark ? 'border-cyan-500/30 border-t-cyan-400' : 'border-whale-light/30 border-t-whale-light'
            }`} />
          </div>
        ) : filteredFeedbacks.length === 0 ? (
          <div className={`text-center py-16 rounded-2xl border ${
            isDark ? 'bg-white/[0.02] border-white/[0.06]' : 'bg-white border-gray-100'
          }`}>
            <svg className={`w-12 h-12 mx-auto mb-3 ${isDark ? 'text-slate-700' : 'text-gray-300'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <p className={`text-base font-medium ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
              아직 피드백이 없습니다
            </p>
            <p className={`text-sm mt-1 ${isDark ? 'text-slate-600' : 'text-gray-400'}`}>
              첫 번째 피드백을 남겨주세요!
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredFeedbacks.map(feedback => (
              <div
                key={feedback.id}
                className={`p-5 rounded-2xl border transition-colors ${
                  feedback.status === 'resolved'
                    ? isDark ? 'bg-green-500/[0.04] border-green-500/20' : 'bg-green-50/60 border-green-200'
                    : feedback.status === 'reviewed'
                    ? isDark ? 'bg-cyan-500/[0.04] border-cyan-500/20 hover:bg-cyan-500/[0.06]' : 'bg-blue-50/50 border-blue-200 hover:border-blue-300 shadow-sm'
                    : isDark ? 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04]' : 'bg-white border-gray-100 hover:border-gray-200 shadow-sm'
                }`}
              >
                {editingFeedback?.id === feedback.id ? (
                  /* 인라인 수정 폼 */
                  <form onSubmit={handleUpdate}>
                    <div className="mb-3">
                      <div className="flex flex-wrap gap-2 mb-3">
                        {(Object.keys(categoryLabels) as FeedbackCategory[]).map(cat => (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => setEditCategory(cat)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                              editCategory === cat
                                ? isDark ? categoryColors[cat].dark : categoryColors[cat].light
                                : isDark ? 'border-white/10 text-slate-500 hover:border-white/20' : 'border-gray-200 text-gray-400 hover:border-gray-300'
                            }`}
                          >
                            {categoryLabels[cat]}
                          </button>
                        ))}
                      </div>
                      <input
                        type="text"
                        value={editTitle}
                        onChange={e => setEditTitle(e.target.value)}
                        maxLength={100}
                        className={`w-full px-3 py-2 rounded-xl text-sm border transition-colors focus:outline-none focus:ring-2 focus:ring-whale-light mb-2 ${
                          isDark
                            ? 'bg-white/[0.04] border-white/[0.08] text-white placeholder-slate-600'
                            : 'bg-gray-50 border-gray-200 text-gray-800 placeholder-gray-400'
                        }`}
                      />
                      <textarea
                        value={editContent}
                        onChange={e => setEditContent(e.target.value)}
                        rows={3}
                        maxLength={2000}
                        className={`w-full px-3 py-2 rounded-xl text-sm border transition-colors focus:outline-none focus:ring-2 focus:ring-whale-light resize-none ${
                          isDark
                            ? 'bg-white/[0.04] border-white/[0.08] text-white placeholder-slate-600'
                            : 'bg-gray-50 border-gray-200 text-gray-800 placeholder-gray-400'
                        }`}
                      />
                    </div>
                    {/* 수정 모드 이미지 */}
                    <ImageUploadSection
                      images={feedback.imageUrls || []}
                      pending={editPendingImages}
                      onRemovePending={(i) => removePendingImage(i, 'edit')}
                      mode="edit"
                      inputRef={editFileInputRef}
                    />
                    {/* 작성자 설정 */}
                    <div className="mb-3">
                      <div className="flex flex-wrap gap-2 mb-2">
                        {([
                          { value: 'real' as const, label: displayName },
                          { value: 'custom' as const, label: '다른 닉네임' },
                          { value: 'anonymous' as const, label: '익명' },
                        ]).map(opt => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setEditAuthorMode(opt.value)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                              editAuthorMode === opt.value
                                ? 'bg-gradient-to-r from-whale-light to-whale-accent text-white border-transparent shadow-sm'
                                : isDark ? 'border-white/10 text-slate-500 hover:border-white/20' : 'border-gray-200 text-gray-400 hover:border-gray-300'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                      {editAuthorMode === 'custom' && (
                        <input
                          type="text"
                          value={editCustomName}
                          onChange={e => setEditCustomName(e.target.value)}
                          placeholder="사용할 닉네임을 입력하세요"
                          maxLength={20}
                          className={`w-full px-3 py-2 rounded-xl text-xs border transition-colors focus:outline-none focus:ring-2 focus:ring-whale-light ${
                            isDark
                              ? 'bg-white/[0.04] border-white/[0.08] text-white placeholder-slate-600'
                              : 'bg-gray-50 border-gray-200 text-gray-800 placeholder-gray-400'
                          }`}
                        />
                      )}
                    </div>
                    <div className="flex gap-2 justify-end">
                      <button
                        type="button"
                        onClick={cancelEditing}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                          isDark ? 'text-slate-400 hover:bg-white/5' : 'text-gray-500 hover:bg-gray-100'
                        }`}
                      >
                        취소
                      </button>
                      <button
                        type="submit"
                        disabled={submitting || !editTitle.trim() || !editContent.trim() || (editAuthorMode === 'custom' && !editCustomName.trim())}
                        className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-whale-light to-whale-accent text-white shadow-sm hover:shadow-md transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {submitting ? '저장 중...' : '저장'}
                      </button>
                    </div>
                  </form>
                ) : (
                  /* 일반 표시 */
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${
                          isDark ? categoryColors[feedback.category].dark : categoryColors[feedback.category].light
                        }`}>
                          {categoryLabels[feedback.category]}
                        </span>
                        {feedback.isAdmin ? (
                          <>
                            <select
                              value={feedback.status}
                              onChange={e => handleStatusChange(feedback.id, e.target.value)}
                              className={`text-xs font-medium rounded-md px-1.5 py-0.5 border cursor-pointer focus:outline-none focus:ring-1 focus:ring-whale-light ${
                                isDark
                                  ? 'bg-white/[0.04] border-white/[0.08] ' + statusColors[feedback.status].dark
                                  : 'bg-white border-gray-200 ' + statusColors[feedback.status].light
                              }`}
                            >
                              <option value="pending">검토 대기</option>
                              <option value="reviewed">검토 중</option>
                              <option value="resolved">반영 완료</option>
                            </select>
                            {feedback.status !== 'pending' && feedback.reviewerName && (
                              <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
                                by {feedback.reviewerName}
                              </span>
                            )}
                          </>
                        ) : (
                          <span className={`text-xs font-medium ${
                            isDark ? statusColors[feedback.status].dark : statusColors[feedback.status].light
                          }`}>
                            {feedback.status !== 'pending' && feedback.reviewerName
                              ? `${feedback.reviewerName} · ${statusLabels[feedback.status]}`
                              : statusLabels[feedback.status]}
                          </span>
                        )}
                      </div>
                      <h3
                        className={`text-base font-semibold ${isDark ? 'text-white' : 'text-gray-800'} ${feedback.isAdmin ? 'cursor-pointer' : ''}`}
                        onClick={() => feedback.isAdmin && setExpandedId(expandedId === feedback.id ? null : feedback.id)}
                      >
                        {feedback.title}
                      </h3>
                      <p
                        className={`text-sm mt-1.5 ${isDark ? 'text-slate-400' : 'text-gray-500'} ${
                          feedback.isAdmin && expandedId === feedback.id ? 'whitespace-pre-wrap' : 'line-clamp-3'
                        } ${feedback.isAdmin ? 'cursor-pointer' : ''}`}
                        onClick={() => feedback.isAdmin && setExpandedId(expandedId === feedback.id ? null : feedback.id)}
                      >
                        {feedback.content}
                      </p>
                      {feedback.isAdmin && feedback.content.length > 150 && (
                        <button
                          onClick={() => setExpandedId(expandedId === feedback.id ? null : feedback.id)}
                          className={`text-xs mt-1 font-medium ${isDark ? 'text-cyan-500 hover:text-cyan-400' : 'text-whale-light hover:text-whale-accent'}`}
                        >
                          {expandedId === feedback.id ? '접기' : '전문 보기'}
                        </button>
                      )}
                      {/* 첨부 이미지 썸네일 */}
                      {feedback.imageUrls && feedback.imageUrls.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-3">
                          {feedback.imageUrls.map((url, i) => (
                            <img
                              key={i}
                              src={getImageFullUrl(url)}
                              alt={`첨부 ${i + 1}`}
                              className={`w-14 h-14 rounded-lg object-cover border cursor-pointer transition-all hover:opacity-80 hover:scale-105 ${
                                isDark ? 'border-white/10' : 'border-gray-200'
                              }`}
                              onClick={() => setLightboxUrl(getImageFullUrl(url))}
                            />
                          ))}
                        </div>
                      )}
                      <div className={`flex items-center gap-3 mt-3 text-xs ${isDark ? 'text-slate-600' : 'text-gray-400'}`}>
                        <span>{feedback.authorName}</span>
                        <span>·</span>
                        <span>{new Date(feedback.createdAt).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}</span>
                        {feedback.isOwner && (
                          <>
                            <span>·</span>
                            <button
                              onClick={() => startEditing(feedback)}
                              className={`font-medium transition-colors ${
                                isDark ? 'text-cyan-500 hover:text-cyan-400' : 'text-whale-light hover:text-whale-accent'
                              }`}
                            >
                              수정
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleUpvote(feedback.id)}
                      className={`flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded-xl transition-all ${
                        feedback.hasUpvoted
                          ? isDark ? 'bg-cyan-500/15 text-cyan-400' : 'bg-whale-light/10 text-whale-light'
                          : isDark ? 'text-slate-600 hover:bg-white/5 hover:text-slate-400' : 'text-gray-400 hover:bg-gray-50 hover:text-gray-600'
                      }`}
                    >
                      <svg className="w-4 h-4" fill={feedback.hasUpvoted ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                      </svg>
                      <span className="text-xs font-semibold">{feedback.upvotes}</span>
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* 이미지 라이트박스 */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setLightboxUrl(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] w-full flex items-center justify-center">
            <img
              src={lightboxUrl}
              alt="확대 보기"
              className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl"
              onClick={e => e.stopPropagation()}
            />
            <button
              onClick={() => setLightboxUrl(null)}
              className="absolute top-2 right-2 w-10 h-10 bg-black/50 hover:bg-black/70 text-white rounded-full flex items-center justify-center transition-colors text-xl"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default FeedbackPage;
