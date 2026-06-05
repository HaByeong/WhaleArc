package com.project.whalearc.community.dto;

public record CreateCommentRequest(
        String content,
        String authorName
) {}
