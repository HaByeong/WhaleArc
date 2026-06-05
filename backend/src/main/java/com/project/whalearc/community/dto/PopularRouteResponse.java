package com.project.whalearc.community.dto;

/** 인기 항로 — 공유 항로(전략)가 게시글에서 몇 번 공유됐는지 집계. */
public record PopularRouteResponse(
        String strategyId,
        String strategyName,
        long sailorCount
) {}
