package com.project.whalearc.community.dto;

import com.project.whalearc.community.domain.CommunityComment;

public record CommentResponse(
        String id,
        String authorName,
        String authorTier,
        String content,
        boolean isMine,
        String createdAt
) {
    public static CommentResponse from(CommunityComment c, String currentUserId) {
        boolean mine = currentUserId != null && currentUserId.equals(c.getUserId());
        return new CommentResponse(c.getId(), c.getAuthorName(), c.getAuthorTier(), c.getContent(), mine, c.getCreatedAt().toString());
    }
}
