package com.project.whalearc.feedback.repository;

import com.project.whalearc.feedback.domain.Feedback;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface FeedbackRepository extends MongoRepository<Feedback, String> {
    List<Feedback> findAllByOrderByCreatedAtDesc();
    List<Feedback> findByCategoryOrderByCreatedAtDesc(Feedback.FeedbackCategory category);
}
