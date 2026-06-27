import type { ReactNode } from 'react';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useRoutePrefix } from '../hooks/useRoutePrefix';
import HelmShell from '../components/HelmShell';
import EmptyState from '../components/EmptyState';
import { communityService, type Post as PostT, type Comment as CommentT, type PopularRoute, type Channel } from '../services/communityService';
import { API_BASE_URL, getErrorMessage } from '../utils/api';
import { rankingService, type RankingEntry } from '../services/rankingService';
import { strategyService, type Strategy } from '../services/strategyService';
import { feedbackService, FEEDBACK_CATEGORIES, type FeedbackCategory } from '../services/feedbackService';

/* ────────────────────────────────────────────────────────────
   ConsoleCommunityPage — 항해사 라운지 (커뮤니티) · 실데이터 배선
   communityService(게시글/댓글/공감/공유/인기항로) + rankingService(이주의 항해사).
   ──────────────────────────────────────────────────────────── */

const UP = '#ef4d4d', DOWN = '#4d8aff', SONAR = 'var(--ci-sonar)';
const INK1 = 'var(--ci-ink1)', INK2 = 'var(--ci-ink2)', INK3 = 'var(--ci-ink3)';
const HAIR = 'var(--ci-line)', HAIR_S = 'var(--ci-line-strong)';
const AVATAR_INK = '#060b1f', CARD = 'var(--ci-card)', SONAR_DIM = 'var(--ci-sonar-dim)';
const panel: React.CSSProperties = { background: 'var(--ci-panel)', border: `1px solid ${HAIR}`, borderRadius: 16, boxShadow: 'var(--ci-panel-shadow)' };
const fieldStyle: React.CSSProperties = { border: `1px solid ${HAIR}`, background: CARD, color: 'var(--ci-ink0)' };
const Panel = ({ children, style }: { children: ReactNode; style?: React.CSSProperties }) => <div style={{ ...panel, ...style }}>{children}</div>;
const PanelHead = ({ kicker, title }: { kicker: string; title: string }) => (
  <div className="wa-force-dark px-[22px] py-[15px] text-white" style={{ background: 'linear-gradient(105deg,#142647 0%,#1d3c7a 52%,#2c6fe6 100%)', borderTopLeftRadius: 16, borderTopRightRadius: 16 }}>
    <div className="text-[11.5px] font-bold tracking-[.22em] text-white/70">{kicker}</div><div className="text-[17.5px] font-bold">{title}</div>
  </div>
);
const Tri = ({ up }: { up: boolean }) => <svg width="9" height="9" viewBox="0 0 10 10" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: 2 }}><path d={up ? 'M5 1l4 7H1z' : 'M5 9L1 2h8z'} fill={up ? UP : DOWN} /></svg>;
const RouteIcon = () => <svg width="18" height="18" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="5" cy="17" r="2.5" /><circle cx="17" cy="5" r="2.5" /><path strokeDasharray="2 2" d="M6.5 15C12 10 9 8 15.5 6.5" /></svg>;

const TIERS: Record<string, { l: string; c: string }> = { blue: { l: '대왕고래', c: '#5b9dff' }, humpback: { l: '혹등고래', c: '#ef4d4d' }, orca: { l: '범고래', c: '#cfa14b' }, beluga: { l: '흰고래', c: '#9aa7c7' } };
const tierMeta = (t: string) => TIERS[t] || TIERS.beluga;
const tierOf = (ret: number) => (ret >= 100 ? 'blue' : ret >= 50 ? 'humpback' : ret >= 20 ? 'orca' : 'beluga');
const Avatar = ({ name, c, size = 40 }: { name: string; c: string; size?: number }) => (
  <span className="flex shrink-0 items-center justify-center font-bold" style={{ width: size, height: size, borderRadius: 12, background: `linear-gradient(135deg, ${c}, ${c}77)`, color: AVATAR_INK, fontSize: size * 0.42 }}>{(name || '?').slice(0, 1)}</span>
);
const relTime = (iso: string) => {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return '';
  const m = Math.floor((Date.now() - t) / 60000);
  if (m < 1) return '방금';
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  const d = Math.floor(h / 24);
  return d < 7 ? `${d}일 전` : new Date(iso).toLocaleDateString('ko-KR');
};

const CHANNELS: [string, string, string][] = [['all', '전체 항로', '🌊'], ['log', '항해 일지', '⚓'], ['strategy', '전략 공유', '🧭'], ['question', '정박지 질문', '❓'], ['brag', '만선 자랑', '🐟']];
const CH_LABEL: Record<string, string> = { log: '항해 일지', strategy: '전략 공유', question: '정박지 질문', brag: '만선 자랑' };
const COMPOSE_CHANNELS = CHANNELS.filter(([k]) => k !== 'all') as [Channel, string, string][];

/* ── 댓글 스레드 ── */
const CommentThread = ({ post, userName, onDelta, showToast }: { post: PostT; userName: string; onDelta: (d: number) => void; showToast: (m: string, t?: 'success' | 'error') => void }) => {
  const [comments, setComments] = useState<CommentT[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  useEffect(() => { communityService.getComments(post.id).then(c => { setComments(c); setLoading(false); }).catch(() => setLoading(false)); }, [post.id]);
  const add = async () => {
    const t = text.trim(); if (!t || busy) return;
    setBusy(true);
    try { const c = await communityService.addComment(post.id, t, userName); setComments(p => [...p, c]); setText(''); onDelta(1); }
    catch (e) { showToast(getErrorMessage(e, '댓글 등록에 실패했습니다.'), 'error'); }
    finally { setBusy(false); }
  };
  const del = async (id: string) => {
    if (!window.confirm('댓글을 삭제하시겠습니까?')) return;
    try { await communityService.deleteComment(id); setComments(p => p.filter(c => c.id !== id)); onDelta(-1); }
    catch { showToast('댓글 삭제에 실패했습니다.', 'error'); }
  };
  return (
    <div className="mt-3 flex flex-col gap-2.5 pt-3" style={{ borderTop: `1px solid ${HAIR}` }}>
      {loading ? <div className="py-2 text-[13px]" style={{ color: INK3 }}>댓글 불러오는 중…</div> : comments.length === 0 ? <div className="py-1 text-[13px]" style={{ color: INK3 }}>첫 댓글을 남겨보세요.</div> : comments.map(c => {
        const t = tierMeta(c.authorTier);
        return (
          <div key={c.id} className="flex items-start gap-2.5">
            <Avatar name={c.authorName} c={t.c} size={28} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2"><span className="text-[13.5px] font-bold">{c.authorName}</span><span className="text-[11px] font-semibold" style={{ color: t.c }}>{t.l}</span><span className="text-[11.5px]" style={{ color: INK3 }}>{relTime(c.createdAt)}</span>{c.isMine && <button onClick={() => del(c.id)} className="text-[11.5px]" style={{ color: INK3 }}>삭제</button>}</div>
              <p className="m-0 text-[13.5px] leading-relaxed" style={{ color: INK1 }}>{c.content}</p>
            </div>
          </div>
        );
      })}
      <div className="mt-1 flex items-center gap-2">
        <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) add(); }} placeholder="댓글 달기…" className="flex-1 rounded-lg px-3 py-2 text-[13.5px] outline-none" style={fieldStyle} />
        <button onClick={add} disabled={!text.trim() || busy} className="rounded-lg px-3.5 py-2 text-[13.5px] font-semibold text-white disabled:opacity-50" style={{ background: `linear-gradient(180deg, ${SONAR}, #2c6fe6)` }}>등록</button>
      </div>
    </div>
  );
};

const Post = ({ p, userName, onRoute, onChange, onCommentDelta, onDelete, showToast }: { p: PostT; userName: string; onRoute: (id?: string) => void; onChange: (p: PostT) => void; onCommentDelta: (d: number) => void; onDelete: (id: string) => void; showToast: (m: string, t?: 'success' | 'error') => void }) => {
  const t = tierMeta(p.authorTier);
  const [openComments, setOpenComments] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const up = (p.sharedReturnRate ?? 0) >= 0;
  const like = async () => { try { onChange(await communityService.toggleLike(p.id)); } catch { showToast('처리에 실패했습니다.', 'error'); } };
  const share = async () => {
    try {
      const updated = await communityService.share(p.id); onChange(updated);
      try { await navigator.clipboard?.writeText(window.location.href); showToast('링크를 복사했습니다.'); } catch { showToast('공유했습니다.'); }
    } catch { showToast('공유에 실패했습니다.', 'error'); }
  };
  const del = async () => { if (!window.confirm('이 일지를 삭제하시겠습니까?')) return; try { await communityService.deletePost(p.id); onDelete(p.id); showToast('일지가 삭제되었습니다.'); } catch { showToast('삭제에 실패했습니다.', 'error'); } };
  return (
    <Panel style={{ padding: '20px 22px' }}>
      <div className="mb-3.5 flex items-center gap-3">
        <Avatar name={p.authorName} c={t.c} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2"><span className="text-[15px] font-bold">{p.authorName}</span><span className="rounded-[5px] px-[7px] py-0.5 text-[11.5px] font-bold" style={{ background: `${t.c}1f`, color: t.c, border: `1px solid ${t.c}44` }}>{t.l}</span></div>
          <div className="mt-0.5 text-[12.5px]" style={{ color: INK3 }}>{CH_LABEL[p.channel]} · {relTime(p.createdAt)}</div>
        </div>
        {p.isMine && <button onClick={del} title="삭제" className="h-[30px] rounded-lg px-2.5 text-[12.5px]" style={{ border: `1px solid ${HAIR}`, background: CARD, color: INK2 }}>삭제</button>}
      </div>
      <h3 className="mb-2 text-[18px] font-bold tracking-tight">{p.title}</h3>
      <p className="m-0 whitespace-pre-wrap text-[14.5px] leading-relaxed" style={{ color: INK1 }}>{p.content}</p>
      {p.imageUrls && p.imageUrls.length > 0 && (
        p.imageUrls.length === 1 ? (
          <div className="mt-3">
            <img src={API_BASE_URL + p.imageUrls[0]} alt="" loading="lazy" onClick={() => setLightbox(API_BASE_URL + p.imageUrls[0])} className="cursor-zoom-in rounded-xl object-contain" style={{ maxHeight: 340, maxWidth: 480, width: 'auto', border: `1px solid ${HAIR}` }} />
          </div>
        ) : (
          <div className="mt-3 grid gap-1.5" style={{ gridTemplateColumns: 'repeat(2, 1fr)', maxWidth: 520 }}>
            {p.imageUrls.map((u, i) => <img key={i} src={API_BASE_URL + u} alt="" loading="lazy" onClick={() => setLightbox(API_BASE_URL + u)} className="w-full cursor-zoom-in rounded-xl object-cover" style={{ height: 180, border: `1px solid ${HAIR}` }} />)}
          </div>
        )
      )}
      {p.sharedStrategyName && (
        <div className="mt-3.5 flex flex-wrap items-center justify-between gap-3.5 rounded-xl px-4 py-3.5" style={{ background: CARD, border: `1px solid ${HAIR}` }}>
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-[9px]" style={{ background: SONAR_DIM, color: SONAR, border: '1px solid rgba(91,157,255,.24)' }}><RouteIcon /></span>
            <div><div className="text-[14px] font-semibold">{p.sharedStrategyName}</div><div className="text-[12px]" style={{ color: INK3 }}>공유된 항로</div></div>
          </div>
          <div className="flex items-center gap-3.5">
            {p.sharedReturnRate != null && (
              <span className="font-mono text-[19.5px] font-bold" style={{ color: up ? UP : DOWN }}><Tri up={up} />{up ? '+' : ''}{p.sharedReturnRate.toFixed(1)}%</span>
            )}
            <button onClick={() => onRoute()} className="rounded-lg px-3 py-1.5 text-[13px] font-semibold" style={{ border: '1px solid rgba(91,157,255,.3)', background: SONAR_DIM, color: SONAR }}>항로 따라가기</button>
          </div>
        </div>
      )}
      <div className="mt-3.5 flex items-center gap-1.5 pt-3.5" style={{ borderTop: `1px solid ${HAIR}` }}>
        <button onClick={like} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13.5px]" style={{ color: p.likedByMe ? UP : INK2 }}><span className="text-[14px]">{p.likedByMe ? '♥' : '♡'}</span>공감{p.likeCount > 0 && <span className="font-mono" style={{ color: INK1 }}>{p.likeCount}</span>}</button>
        <button onClick={() => setOpenComments(o => !o)} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13.5px]" style={{ color: openComments ? SONAR : INK2 }}><span className="text-[14px]">💬</span>댓글{p.commentCount > 0 && <span className="font-mono" style={{ color: INK1 }}>{p.commentCount}</span>}</button>
        <button onClick={share} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13.5px]" style={{ color: INK2 }}><span className="text-[14px]">↗</span>공유{p.shareCount > 0 && <span className="font-mono" style={{ color: INK1 }}>{p.shareCount}</span>}</button>
      </div>
      {openComments && <CommentThread post={p} userName={userName} onDelta={onCommentDelta} showToast={showToast} />}
      {lightbox && <div onClick={() => setLightbox(null)} className="fixed inset-0 z-[130] flex items-center justify-center p-6" style={{ background: 'rgba(6,11,31,.88)', backdropFilter: 'blur(4px)' }}><img src={lightbox} alt="" className="max-h-[90vh] max-w-[92vw] rounded-xl" style={{ boxShadow: '0 20px 60px -20px rgba(0,0,0,.8)' }} /></div>}
    </Panel>
  );
};

/* ── 글쓰기 모달 ── */
const ComposeModal = ({ userName, myStrats, myReturn, onClose, onCreated, showToast }: { userName: string; myStrats: Strategy[]; myReturn: number | null; onClose: () => void; onCreated: (p: PostT) => void; showToast: (m: string, t?: 'success' | 'error') => void }) => {
  const [channel, setChannel] = useState<Channel>('log');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [stratId, setStratId] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const pickFiles = (list: FileList | null) => {
    const picked = Array.from(list || []).filter(f => {
      if (!f.type.startsWith('image/')) return false;
      if (f.size > 5 * 1024 * 1024) { showToast(`${f.name}: 5MB 이하만 가능합니다.`, 'error'); return false; }
      return true;
    });
    setFiles(fs => [...fs, ...picked].slice(0, 4));
  };
  const submit = async () => {
    if (!title.trim() || !content.trim() || saving) return;
    setSaving(true);
    const st = myStrats.find(s => s.id === stratId);
    try {
      let post = await communityService.createPost({
        channel, title: title.trim(), content: content.trim(), authorName: userName,
        sharedStrategyId: st ? st.id : null, sharedStrategyName: st ? st.name : null,
        sharedReturnRate: st && myReturn != null ? myReturn : null,
      });
      for (const f of files) { post = await communityService.uploadImage(post.id, f); }
      onCreated(post); showToast('일지를 등록했습니다.'); onClose();
    } catch (e) { showToast(getErrorMessage(e, '등록에 실패했습니다.'), 'error'); setSaving(false); }
  };
  return (
    <div onClick={onClose} className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto px-6 py-12" style={{ background: 'rgba(6,11,31,.72)', backdropFilter: 'blur(6px)', animation: 'backdrop-in .2s ease' }}>
      <div onClick={e => e.stopPropagation()} className="relative w-full max-w-[560px] rounded-[18px]" style={{ background: 'var(--ci-overlay)', border: `1px solid ${HAIR_S}`, boxShadow: 'var(--ci-panel-shadow)', animation: 'modal-in .25s cubic-bezier(.2,.8,.2,1)' }}>
        <div className="wa-force-dark flex items-center justify-between rounded-t-[18px] px-6 py-4 text-white" style={{ background: 'linear-gradient(105deg,#142647 0%,#1d3c7a 52%,#2c6fe6 100%)' }}>
          <h3 className="text-[16px] font-bold">새 항해 일지</h3>
          <button onClick={onClose} aria-label="닫기" className="flex h-8 w-8 items-center justify-center rounded-lg text-[16px]" style={{ border: '1px solid rgba(255,255,255,.2)', background: 'rgba(255,255,255,.08)' }}><span aria-hidden>✕</span></button>
        </div>
        <div className="flex flex-col gap-3.5 p-6">
          <div>
            <div className="mb-1.5 text-[12.5px] font-semibold" style={{ color: INK2 }}>채널</div>
            <div className="flex flex-wrap gap-1.5">{COMPOSE_CHANNELS.map(([k, l, ic]) => <button key={k} onClick={() => setChannel(k)} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-semibold" style={{ border: channel === k ? '1px solid rgba(91,157,255,.35)' : `1px solid ${HAIR}`, background: channel === k ? SONAR_DIM : CARD, color: channel === k ? SONAR : INK1 }}><span>{ic}</span>{l}</button>)}</div>
          </div>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="제목" maxLength={120} className="rounded-lg px-3.5 py-2.5 text-[15px] font-semibold outline-none" style={fieldStyle} />
          <textarea value={content} onChange={e => setContent(e.target.value)} placeholder="이번 항해는 어땠나요? 항로와 일지를 나눠보세요…" rows={5} maxLength={4000} className="resize-none rounded-lg px-3.5 py-2.5 text-[14.5px] leading-relaxed outline-none" style={fieldStyle} />
          <div>
            <div className="mb-1.5 text-[12.5px] font-semibold" style={{ color: INK2 }}>사진 <span className="font-normal" style={{ color: INK3 }}>(최대 4장 · 5MB)</span></div>
            <div className="flex flex-wrap gap-2">
              {files.map((f, i) => (
                <div key={i} className="relative">
                  <img src={URL.createObjectURL(f)} alt="" className="h-16 w-16 rounded-lg object-cover" style={{ border: `1px solid ${HAIR}` }} />
                  <button onClick={() => setFiles(fs => fs.filter((_, j) => j !== i))} aria-label="사진 삭제" className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full text-[11px] text-white" style={{ background: '#c23b38' }}><span aria-hidden>✕</span></button>
                </div>
              ))}
              {files.length < 4 && (
                <label className="flex h-16 w-16 cursor-pointer items-center justify-center rounded-lg text-[24px]" style={{ border: `1px dashed ${HAIR_S}`, background: CARD, color: INK3 }}>+
                  <input type="file" accept="image/*" multiple hidden onChange={e => { pickFiles(e.target.files); e.target.value = ''; }} />
                </label>
              )}
            </div>
          </div>
          {myStrats.length > 0 && (
            <div>
              <div className="mb-1.5 text-[12.5px] font-semibold" style={{ color: INK2 }}>항로 공유 (선택){stratId && myReturn != null && <span className="ml-1 font-normal" style={{ color: INK3 }}>· 내 수익률 {myReturn >= 0 ? '+' : ''}{myReturn.toFixed(1)}% 함께 표시</span>}</div>
              <select value={stratId} onChange={e => setStratId(e.target.value)} className="w-full rounded-lg px-3 py-2.5 text-[14px] outline-none" style={fieldStyle}>
                <option value="">공유 안 함</option>
                {myStrats.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 px-6 py-4" style={{ borderTop: `1px solid ${HAIR}` }}>
          <button onClick={onClose} className="rounded-lg px-4 py-2.5 text-[14px] font-semibold" style={{ border: `1px solid ${HAIR}`, color: INK1 }}>취소</button>
          <button onClick={submit} disabled={!title.trim() || !content.trim() || saving} className="rounded-lg px-5 py-2.5 text-[14.5px] font-bold text-white disabled:opacity-50" style={{ background: `linear-gradient(180deg, ${SONAR}, #2c6fe6)` }}>{saving ? '등록 중…' : '일지 쓰기'}</button>
        </div>
      </div>
    </div>
  );
};

/* ── 의견 보내기(운영팀 피드백) 모달 ── */
const FeedbackModal = ({ userName, onClose, showToast }: { userName: string; onClose: () => void; showToast: (m: string, t?: 'success' | 'error') => void }) => {
  const [category, setCategory] = useState<FeedbackCategory>('feature');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    if (!title.trim() || !content.trim() || saving) return;
    setSaving(true);
    try {
      await feedbackService.createFeedback({ category, title, content, authorName: userName });
      showToast('소중한 의견 감사합니다. 운영팀이 확인하겠습니다.'); onClose();
    } catch (e) { showToast(getErrorMessage(e, '의견 전송에 실패했습니다.'), 'error'); setSaving(false); }
  };
  return (
    <div onClick={onClose} className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto px-6 py-12" style={{ background: 'rgba(6,11,31,.72)', backdropFilter: 'blur(6px)', animation: 'backdrop-in .2s ease' }}>
      <div onClick={e => e.stopPropagation()} className="relative w-full max-w-[480px] rounded-[18px]" style={{ background: 'var(--ci-overlay)', border: `1px solid ${HAIR_S}`, boxShadow: 'var(--ci-panel-shadow)', animation: 'modal-in .25s cubic-bezier(.2,.8,.2,1)' }}>
        <div className="wa-force-dark flex items-center justify-between rounded-t-[18px] px-6 py-4 text-white" style={{ background: 'linear-gradient(105deg,#142647 0%,#1d3c7a 52%,#2c6fe6 100%)' }}>
          <h3 className="text-[16px] font-bold">✉ 운영팀에 의견 보내기</h3>
          <button onClick={onClose} aria-label="닫기" className="flex h-8 w-8 items-center justify-center rounded-lg text-[16px]" style={{ border: '1px solid rgba(255,255,255,.2)', background: 'rgba(255,255,255,.08)' }}><span aria-hidden>✕</span></button>
        </div>
        <div className="flex flex-col gap-3.5 p-6">
          <p className="m-0 text-[13.5px] leading-relaxed" style={{ color: INK2 }}>버그·기능 제안·개선 아이디어를 보내주세요. 라운지 게시물과 달리 다른 사용자에게 공개되지 않고 운영팀만 확인합니다.</p>
          <div>
            <div className="mb-1.5 text-[12.5px] font-semibold" style={{ color: INK2 }}>분류</div>
            <div className="flex flex-wrap gap-1.5">{FEEDBACK_CATEGORIES.map(c => <button key={c.key} onClick={() => setCategory(c.key)} className="rounded-full px-3 py-1.5 text-[13px] font-semibold" style={{ border: category === c.key ? '1px solid rgba(91,157,255,.35)' : `1px solid ${HAIR}`, background: category === c.key ? SONAR_DIM : CARD, color: category === c.key ? SONAR : INK1 }}>{c.label}</button>)}</div>
          </div>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="제목 (100자 이내)" maxLength={100} className="rounded-lg px-3.5 py-2.5 text-[15px] font-semibold outline-none" style={fieldStyle} />
          <textarea value={content} onChange={e => setContent(e.target.value)} placeholder="자세한 내용을 적어주세요. (2000자 이내)" rows={5} maxLength={2000} className="resize-none rounded-lg px-3.5 py-2.5 text-[14.5px] leading-relaxed outline-none" style={fieldStyle} />
        </div>
        <div className="flex justify-end gap-2 px-6 py-4" style={{ borderTop: `1px solid ${HAIR}` }}>
          <button onClick={onClose} className="rounded-lg px-4 py-2.5 text-[14px] font-semibold" style={{ border: `1px solid ${HAIR}`, color: INK1 }}>취소</button>
          <button onClick={submit} disabled={!title.trim() || !content.trim() || saving} className="rounded-lg px-5 py-2.5 text-[14.5px] font-bold text-white disabled:opacity-50" style={{ background: `linear-gradient(180deg, ${SONAR}, #2c6fe6)` }}>{saving ? '전송 중…' : '의견 보내기'}</button>
        </div>
      </div>
    </div>
  );
};

const Toast = ({ msg, type }: { msg: string; type: 'success' | 'error' }) => (
  <div className="fixed bottom-6 left-1/2 z-[120] -translate-x-1/2 rounded-xl px-5 py-3 text-[14px] font-semibold text-white" style={{ background: type === 'error' ? 'linear-gradient(180deg,#e0524f,#c23b38)' : 'linear-gradient(180deg,#2f9e6e,#1f7d57)', boxShadow: '0 14px 32px -10px rgba(0,0,0,.55)', animation: 'message-in .25s ease' }}>{msg}</div>
);

const ConsoleCommunityPage = () => {
  const navigate = useNavigate();
  const { session } = useAuth();
  const { isVirt } = useRoutePrefix();
  const prefix = isVirt ? '/virt' : '';
  const userName = session?.user?.email ? session.user.email.split('@')[0] : '항해사';
  const isPreview = import.meta.env.DEV && window.location.pathname.startsWith('/preview');

  const [ch, setCh] = useState('all');
  const [posts, setPosts] = useState<PostT[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toppers, setToppers] = useState<RankingEntry[]>([]);
  const [routes, setRoutes] = useState<PopularRoute[]>([]);
  const [myStrats, setMyStrats] = useState<Strategy[]>([]);
  const [myReturn, setMyReturn] = useState<number | null>(null);
  const [compose, setCompose] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const toastTimer = useRef<number | null>(null);
  const showToast = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2600);
  }, []);

  const loadPosts = useCallback(() => {
    if (isPreview) { setLoading(false); return; }
    communityService.getPosts(ch).then(p => { setPosts(p); setError(null); }).catch(() => setError('라운지를 불러오지 못했습니다.')).finally(() => setLoading(false));
  }, [ch, isPreview]);
  useEffect(() => { setLoading(true); loadPosts(); }, [loadPosts]);
  useEffect(() => {
    if (isPreview) return;
    rankingService.getRankings().then(r => setToppers(r.rankings.slice(0, 3))).catch(() => {});
    communityService.getPopularRoutes().then(setRoutes).catch(() => {});
    strategyService.getStrategies().then(setMyStrats).catch(() => {});
    rankingService.getMyRanking().then(m => setMyReturn(m.totalReturn)).catch(() => {});
  }, [isPreview]);

  const upsert = (p: PostT) => setPosts(list => list.map(x => x.id === p.id ? p : x));
  const patchPost = (id: string, fn: (p: PostT) => PostT) => setPosts(list => list.map(x => x.id === id ? fn(x) : x));
  const removePost = (id: string) => setPosts(list => list.filter(x => x.id !== id));
  const follow = async (post: PostT) => {
    if (!window.confirm(`'${post.sharedStrategyName}' 항로를 내 항로 목록으로 가져올까요?`)) return;
    try {
      const res = await communityService.followRoute(post.id);
      showToast(`'${res.strategyName}' 항로를 내 목록에 추가했어요.`);
      navigate(`${prefix}/strategy?strategy=${res.strategyId}`);
    } catch (e) {
      showToast(getErrorMessage(e, '항로 가져오기에 실패했습니다.'), 'error');
    }
  };
  const todayCount = posts.filter(p => { const d = new Date(p.createdAt); const n = new Date(); return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate(); }).length;

  // 게시글에서 해시태그 추출 (빈도 상위 8개)
  const popularTags = useMemo(() => {
    const tagCount: Record<string, number> = {};
    for (const p of posts) {
      const matches = (p.title + ' ' + p.content).match(/#[\w가-힣]+/g) ?? [];
      for (const tag of matches) tagCount[tag] = (tagCount[tag] || 0) + 1;
    }
    return Object.entries(tagCount).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([tag]) => tag);
  }, [posts]);

  // 검색어 + 해시태그 클라이언트 필터
  const filteredPosts = useMemo(() => {
    let list = posts;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter(p => p.title.toLowerCase().includes(q) || p.content.toLowerCase().includes(q));
    }
    if (activeTag) {
      list = list.filter(p => (p.title + ' ' + p.content).includes(activeTag));
    }
    return list;
  }, [posts, searchTerm, activeTag]);

  return (
    <HelmShell active="community" virt={isVirt} userName={userName} session="항해사 라운지">
      <div className="mx-auto max-w-[1560px]">
        <div className="mb-[18px] flex flex-wrap items-end justify-between gap-3">
          <div><h1 className="text-[28px] font-bold">항해사 라운지</h1><p className="mt-2 text-[14.5px]" style={{ color: INK1 }}>다른 항해사들의 항로와 일지를 나누고, 마음에 드는 전략은 따라가 보세요.</p></div>
          <div className="flex items-center gap-[18px] text-[13.5px]" style={{ color: INK2 }}>
            <span>오늘의 일지 <span className="font-mono font-semibold" style={{ color: 'var(--ci-ink0)' }}>{todayCount}</span></span>
            <span>전체 <span className="font-mono font-semibold" style={{ color: 'var(--ci-ink0)' }}>{posts.length}</span></span>
          </div>
        </div>
        <div className="mb-[18px] flex flex-wrap gap-2">
          {CHANNELS.map(([k, l, ic]) => { const on = ch === k; return <button key={k} onClick={() => { setCh(k); setSearchTerm(''); setActiveTag(null); }} className="inline-flex items-center gap-1.5 rounded-full px-4 py-2.5 text-[14px] font-semibold" style={{ border: on ? '1px solid rgba(91,157,255,.35)' : `1px solid ${HAIR}`, background: on ? SONAR_DIM : CARD, color: on ? SONAR : INK1 }}><span>{ic}</span>{l}</button>; })}
        </div>
        <div className="grid items-start gap-5 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(280px,320px)]">
          <div className="flex min-w-0 flex-col gap-[18px]">
            {/* 검색바 */}
            <Panel style={{ padding: '12px 16px' }}>
              <div className="flex items-center gap-2.5">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ color: INK3, flexShrink: 0 }}>
                  <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                </svg>
                <input
                  value={searchTerm}
                  onChange={e => { setSearchTerm(e.target.value); setActiveTag(null); }}
                  placeholder="제목·내용으로 검색…"
                  className="flex-1 bg-transparent text-[14.5px] outline-none"
                  style={{ color: 'var(--ci-ink0)' }}
                />
                {(searchTerm || activeTag) && (
                  <button onClick={() => { setSearchTerm(''); setActiveTag(null); }} className="text-[12px] rounded px-2 py-0.5" style={{ color: INK2, border: `1px solid ${HAIR}` }}>초기화</button>
                )}
              </div>
              {popularTags.length > 0 && (
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {popularTags.map(tag => (
                    <button
                      key={tag}
                      onClick={() => { setActiveTag(activeTag === tag ? null : tag); setSearchTerm(''); }}
                      className="rounded-full px-2.5 py-1 text-[12.5px] font-semibold"
                      style={{
                        border: activeTag === tag ? '1px solid rgba(91,157,255,.35)' : `1px solid ${HAIR}`,
                        background: activeTag === tag ? SONAR_DIM : CARD,
                        color: activeTag === tag ? SONAR : INK2,
                      }}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              )}
            </Panel>
            <Panel style={{ padding: '16px 18px' }}>
              <div className="flex items-center gap-3">
                <Avatar name={userName} c="#5b9dff" size={38} />
                <button onClick={() => setCompose(true)} className="flex-1 rounded-[10px] px-3.5 py-2.5 text-left text-[14.5px] outline-none" style={{ border: `1px solid ${HAIR}`, background: CARD, color: INK3 }}>이번 항해는 어땠나요? 항로를 공유해보세요…</button>
                <button onClick={() => setCompose(true)} className="whitespace-nowrap rounded-[10px] px-[18px] py-2.5 text-[14.5px] font-semibold text-white" style={{ border: '1px solid rgba(140,190,255,.5)', background: 'linear-gradient(180deg, #4d8aff, #2c6fe6 62%, #2257c8)', boxShadow: '0 10px 22px -12px rgba(44,111,230,.7), inset 0 1px 0 rgba(255,255,255,.35)' }}>일지 쓰기</button>
              </div>
            </Panel>
            {loading ? <Panel style={{ padding: '40px', textAlign: 'center' }}><span className="text-[14px]" style={{ color: INK3 }}>라운지를 불러오는 중…</span></Panel>
              : error ? <Panel style={{ padding: '32px', textAlign: 'center' }}><div className="text-[14px]" style={{ color: INK2 }}>{error}</div><button onClick={loadPosts} className="mt-3 rounded-lg px-4 py-2 text-[13.5px] font-semibold" style={{ border: `1px solid ${HAIR_S}`, color: SONAR }}>다시 시도</button></Panel>
                : posts.length === 0 ? (isPreview
                  ? <Panel style={{ padding: '48px 24px', textAlign: 'center' }}><div className="text-[30px]">🌊</div><div className="mt-2 text-[15px] font-semibold">로그인 후 라운지를 이용할 수 있습니다.</div></Panel>
                  : <EmptyState
                      kicker="FIRST LOG"
                      title="아직 남긴 항해 일지가 없어요"
                      desc="첫 일지를 남기면 다른 항해사들과 항로를 나눌 수 있어요. 만선 자랑도, 막막한 질문도 좋아요 — 고래들은 서로의 항로를 응원해요."
                      ctaLabel="첫 일지 쓰기" onCta={() => setCompose(true)}
                      secondaryLabel="다른 항로 구경하기" onSecondary={() => navigate(`${prefix}/strategy`)}
                      preview={[
                        { icon: 'route', label: '전략 공유', sub: '내 항로와 수익률을 카드로 나눠요' },
                        { icon: 'chat', label: '정박지 질문', sub: '막히는 부분을 물어보세요' },
                        { icon: 'sonar', label: '만선 자랑', sub: 'VIRT·실계좌 수익을 인증해요' },
                      ]}
                      note="투자 권유·종목 리딩은 금지예요. 서로의 항로를 존중해주세요."
                    />)
                  : filteredPosts.length === 0 ? <Panel style={{ padding: '40px 24px', textAlign: 'center' }}><div className="text-[14px]" style={{ color: INK3 }}>검색 결과가 없습니다. 다른 검색어나 태그를 시도해보세요.</div><button onClick={() => { setSearchTerm(''); setActiveTag(null); }} className="mt-3 rounded-lg px-4 py-2 text-[13.5px] font-semibold" style={{ border: `1px solid ${HAIR}`, color: INK1 }}>검색 초기화</button></Panel>
                    : filteredPosts.map(p => <Post key={p.id} p={p} userName={userName} onRoute={() => follow(p)} onChange={upsert} onCommentDelta={d => patchPost(p.id, x => ({ ...x, commentCount: Math.max(0, x.commentCount + d) }))} onDelete={removePost} showToast={showToast} />)}
          </div>
          <div className="flex flex-col gap-[18px] lg:sticky lg:top-[88px]">
            <Panel>
              <PanelHead kicker="THIS WEEK" title="이주의 항해사" />
              <div className="py-1.5">
                {toppers.length === 0 ? <div className="px-5 py-6 text-center text-[13px]" style={{ color: INK3 }}>랭킹 집계 중…</div> : toppers.map((e, i) => { const tr = tierOf(e.totalReturn), tm = tierMeta(tr), up = e.totalReturn >= 0; return (
                  <div key={e.portfolioId} className="grid grid-cols-[20px_auto_1fr_auto] items-center gap-3 px-5 py-3" style={{ borderTop: i ? `1px solid ${HAIR}` : undefined }}>
                    <span className="font-mono text-[15px] font-bold" style={{ color: i === 0 ? SONAR : INK2 }}>{i + 1}</span>
                    <Avatar name={e.nickname || '항해사'} c={tm.c} size={32} />
                    <div className="min-w-0"><div className="truncate text-[14px] font-semibold">{e.nickname || '익명 항해사'}</div><div className="text-[12px] font-semibold" style={{ color: tm.c }}>{tm.l}</div></div>
                    <span className="font-mono text-[14px] font-bold" style={{ color: up ? UP : DOWN }}>{up ? '+' : ''}{e.totalReturn.toFixed(1)}%</span>
                  </div>
                ); })}
              </div>
              <div className="px-5 py-3" style={{ borderTop: `1px solid ${HAIR}` }}><button onClick={() => navigate(`${prefix}/ranking`)} className="text-[13.5px]" style={{ color: SONAR }}>전체 랭킹 보기 →</button></div>
            </Panel>
            <Panel>
              <PanelHead kicker="POPULAR ROUTES" title="인기 항로" />
              <div className="py-1.5">
                {routes.length === 0 ? <div className="px-5 py-6 text-center text-[13px]" style={{ color: INK3 }}>아직 공유된 항로가 없어요.</div> : routes.map((r, i) => (
                  <button key={r.strategyName} onClick={() => navigate(`${prefix}/strategy`)} className="flex w-full items-center gap-3 px-5 py-3 text-left" style={{ borderTop: i ? `1px solid ${HAIR}` : undefined }}>
                    <span className="flex h-[30px] w-[30px] items-center justify-center rounded-[9px]" style={{ background: SONAR_DIM, color: SONAR, border: '1px solid rgba(91,157,255,.24)' }}><RouteIcon /></span>
                    <div className="min-w-0 flex-1"><div className="text-[14.5px] font-semibold">{r.strategyName}</div><div className="text-[12px]" style={{ color: INK3 }}>{r.sailorCount}회 공유됨</div></div>
                    <span style={{ color: INK3 }}>→</span>
                  </button>
                ))}
              </div>
            </Panel>
            <Panel style={{ padding: '18px 20px', background: 'linear-gradient(135deg, rgba(91,157,255,.12), rgba(91,157,255,.02) 60%, transparent)', border: '1px solid rgba(91,157,255,.28)' }}>
              <div className="mb-2 flex items-center gap-2.5"><img src="/brand-whale.png" alt="" width={26} style={{ height: 'auto', animation: 'whale-float 6s ease-in-out infinite' }} /><span className="text-[14.5px] font-bold">라운지 항해 수칙</span></div>
              <p className="m-0 text-[13.5px] leading-relaxed" style={{ color: INK1 }}>서로의 항로를 존중하고, 수익 인증은 VIRT/실계좌를 명시해주세요. 투자 권유·종목 리딩은 금지입니다.</p>
            </Panel>
            <Panel style={{ padding: '18px 20px' }}>
              <div className="text-[14.5px] font-bold">운영팀에 의견 보내기</div>
              <p className="mt-1.5 text-[13.5px] leading-relaxed" style={{ color: INK2 }}>버그·기능 제안·개선 아이디어가 있으신가요? 운영팀에게만 비공개로 전달됩니다.</p>
              <button onClick={() => setFeedbackOpen(true)} className="mt-3 w-full rounded-[10px] py-2.5 text-[14px] font-semibold" style={{ border: '1px solid rgba(91,157,255,.32)', background: SONAR_DIM, color: SONAR }}>✉ 의견 보내기</button>
            </Panel>
          </div>
        </div>
        <footer className="mt-6 flex flex-wrap justify-between gap-3 pt-5" style={{ borderTop: `1px solid ${HAIR}` }}>
          <span className="font-mono text-[12.5px]" style={{ color: INK3 }}>© 2026 WHALEARC · 모든 게시물은 작성자의 의견이며 투자 권유가 아닙니다.</span>
          <button onClick={() => setFeedbackOpen(true)} className="text-[12.5px]" style={{ color: INK2 }}>의견 보내기</button>
        </footer>
      </div>
      {compose && <ComposeModal userName={userName} myStrats={myStrats} myReturn={myReturn} onClose={() => setCompose(false)} onCreated={p => setPosts(list => [p, ...list])} showToast={showToast} />}
      {feedbackOpen && <FeedbackModal userName={userName} onClose={() => setFeedbackOpen(false)} showToast={showToast} />}
      {toast && <Toast msg={toast.msg} type={toast.type} />}
    </HelmShell>
  );
};

export default ConsoleCommunityPage;
