package com.project.whalearc.community.repository;

import com.project.whalearc.community.domain.CommunityComment;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface CommunityCommentRepository extends MongoRepository<CommunityComment, String> {
    List<CommunityComment> findByPostIdOrderByCreatedAtAsc(String postId);
    // 댓글도 상한 100건 (게시글 피드와 동일하게 전체 반환 방지 — 확장성). 초과분은 향후 '더 보기'로.
    List<CommunityComment> findTop100ByPostIdOrderByCreatedAtAsc(String postId);
    long countByPostId(String postId);
    void deleteByPostId(String postId);
}
