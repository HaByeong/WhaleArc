package com.project.whalearc.community.dto;

/** 게시글 작성 요청. sharedStrategy* 는 전략을 함께 공유할 때만. */
public record CreatePostRequest(
        String channel,
        String title,
        String content,
        String authorName,
        String sharedStrategyId,
        String sharedStrategyName,
        Double sharedReturnRate
) {}
