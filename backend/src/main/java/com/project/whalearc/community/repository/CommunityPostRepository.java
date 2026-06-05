package com.project.whalearc.community.repository;

import com.project.whalearc.community.domain.CommunityPost;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.data.mongodb.repository.Update;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface CommunityPostRepository extends MongoRepository<CommunityPost, String> {

    // 원자적 $inc — read-modify-write의 lost-update(동시 공유) 방지
    @Query("{ '_id': ?0 }")
    @Update("{ '$inc': { 'shareCount': 1 } }")
    void incrementShareCount(String id);
    List<CommunityPost> findAllByOrderByCreatedAtDesc();
    List<CommunityPost> findByChannelOrderByCreatedAtDesc(CommunityPost.CommunityChannel channel);

    // 피드는 최근 200건으로 상한 (전체 컬렉션 반환 방지 — 확장성). 200건 초과 시 채널 필터/검색으로 좁힘.
    List<CommunityPost> findTop200ByOrderByCreatedAtDesc();
    List<CommunityPost> findTop200ByChannelOrderByCreatedAtDesc(CommunityPost.CommunityChannel channel);
}
