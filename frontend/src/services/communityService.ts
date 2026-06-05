import apiClient from '../utils/api';

/* 항해사 라운지 커뮤니티 — 게시글/댓글/공감/공유/인기 항로 (/api/community) */

export type Channel = 'log' | 'strategy' | 'question' | 'brag';

export interface Post {
  id: string;
  authorName: string;
  authorTier: string;          // blue / humpback / orca / beluga
  channel: Channel;
  title: string;
  content: string;
  imageUrls: string[];
  sharedStrategyId: string | null;
  sharedStrategyName: string | null;
  sharedReturnRate: number | null;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  likedByMe: boolean;
  isMine: boolean;
  createdAt: string;           // ISO
}

export interface Comment {
  id: string;
  authorName: string;
  authorTier: string;
  content: string;
  isMine: boolean;
  createdAt: string;
}

export interface PopularRoute {
  strategyId: string | null;
  strategyName: string;
  sailorCount: number;
}

export interface CreatePostPayload {
  channel: Channel;
  title: string;
  content: string;
  authorName: string;
  sharedStrategyId?: string | null;
  sharedStrategyName?: string | null;
  sharedReturnRate?: number | null;
}

const getPosts = async (channel?: string): Promise<Post[]> => {
  const params = channel && channel !== 'all' ? { channel } : {};
  const res = await apiClient.get('/api/community/posts', { params });
  return res.data.data;
};

const createPost = async (payload: CreatePostPayload): Promise<Post> => {
  const res = await apiClient.post('/api/community/posts', payload);
  return res.data.data;
};

const deletePost = async (id: string): Promise<void> => {
  await apiClient.delete(`/api/community/posts/${id}`);
};

const toggleLike = async (id: string): Promise<Post> => {
  const res = await apiClient.post(`/api/community/posts/${id}/like`);
  return res.data.data;
};

const share = async (id: string): Promise<Post> => {
  const res = await apiClient.post(`/api/community/posts/${id}/share`);
  return res.data.data;
};

const uploadImage = async (id: string, file: File): Promise<Post> => {
  const form = new FormData();
  form.append('file', file);
  const res = await apiClient.post(`/api/community/posts/${id}/images`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
  return res.data.data;
};

export interface FollowResult { strategyId: string; strategyName: string; }
const followRoute = async (id: string): Promise<FollowResult> => {
  const res = await apiClient.post(`/api/community/posts/${id}/follow`);
  return res.data.data;
};

const getComments = async (id: string): Promise<Comment[]> => {
  const res = await apiClient.get(`/api/community/posts/${id}/comments`);
  return res.data.data;
};

const addComment = async (id: string, content: string, authorName: string): Promise<Comment> => {
  const res = await apiClient.post(`/api/community/posts/${id}/comments`, { content, authorName });
  return res.data.data;
};

const deleteComment = async (id: string): Promise<void> => {
  await apiClient.delete(`/api/community/comments/${id}`);
};

const getPopularRoutes = async (): Promise<PopularRoute[]> => {
  const res = await apiClient.get('/api/community/popular-routes');
  return res.data.data;
};

export const communityService = {
  getPosts, createPost, deletePost, toggleLike, share, followRoute, uploadImage,
  getComments, addComment, deleteComment, getPopularRoutes,
};
