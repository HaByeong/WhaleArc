package com.project.whalearc.community.dto;

import com.project.whalearc.community.domain.CommunityPost;

import java.util.List;

/** 게시글 응답 (현재 사용자 기준 likedByMe / isMine 계산 포함). */
public record PostResponse(
        String id,
        String authorName,
        String authorTier,
        String channel,
        String title,
        String content,
        List<String> imageUrls,
        String sharedStrategyId,
        String sharedStrategyName,
        Double sharedReturnRate,
        int likeCount,
        int commentCount,
        int shareCount,
        boolean likedByMe,
        boolean isMine,
        String createdAt
) {
    public static PostResponse from(CommunityPost p, String currentUserId) {
        boolean liked = currentUserId != null && p.getLikedUserIds() != null && p.getLikedUserIds().contains(currentUserId);
        boolean mine = currentUserId != null && currentUserId.equals(p.getUserId());
        return new PostResponse(
                p.getId(), p.getAuthorName(), p.getAuthorTier(),
                p.getChannel().name(), p.getTitle(), p.getContent(),
                p.getImageUrls() != null ? p.getImageUrls() : List.of(),
                p.getSharedStrategyId(), p.getSharedStrategyName(), p.getSharedReturnRate(),
                p.getLikeCount(), p.getCommentCount(), p.getShareCount(),
                liked, mine, p.getCreatedAt().toString()
        );
    }
}
