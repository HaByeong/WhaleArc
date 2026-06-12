package com.project.whalearc.mirror.repository;

import com.project.whalearc.mirror.domain.EmotionCapture;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.time.Instant;
import java.util.List;

public interface EmotionCaptureRepository extends MongoRepository<EmotionCapture, String> {

    /** 사용자의 모든 봉인(최신순) — 대시보드/목록·즉시개봉용. */
    List<EmotionCapture> findByUserIdOrderByCapturedAtDesc(String userId);

    /** 개봉 예정이 지났는데 아직 안 열린 봉인 — 배치 개봉용. */
    List<EmotionCapture> findByRevealedFalseAndRevealAtLessThanEqual(Instant now);
}
