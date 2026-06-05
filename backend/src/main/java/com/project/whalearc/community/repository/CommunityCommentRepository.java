package com.project.whalearc.community.repository;

import com.project.whalearc.community.domain.CommunityComment;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface CommunityCommentRepository extends MongoRepository<CommunityComment, String> {
    List<CommunityComment> findByPostIdOrderByCreatedAtAsc(String postId);
    long countByPostId(String postId);
    void deleteByPostId(String postId);
}
