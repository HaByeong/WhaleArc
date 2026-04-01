package com.project.whalearc.feedback.service;

import com.project.whalearc.feedback.domain.Feedback;
import com.project.whalearc.feedback.repository.FeedbackRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class FeedbackService {

    private final FeedbackRepository feedbackRepository;

    public Feedback createFeedback(String userId, String authorName, Feedback.FeedbackCategory category,
                                   String title, String content) {
        Feedback feedback = new Feedback(userId, authorName, category, title, content);
        feedback = feedbackRepository.save(feedback);
        log.info("피드백 생성: userId={}, category={}, title={}", userId, category, title);
        return feedback;
    }

    public List<Feedback> getFeedbacks(Feedback.FeedbackCategory category) {
        if (category != null) {
            return feedbackRepository.findByCategoryOrderByCreatedAtDesc(category);
        }
        return feedbackRepository.findAllByOrderByCreatedAtDesc();
    }

    public void updateStatus(String feedbackId, Feedback.FeedbackStatus status, String reviewerName) {
        Feedback feedback = feedbackRepository.findById(feedbackId)
                .orElseThrow(() -> new IllegalArgumentException("피드백을 찾을 수 없습니다."));
        feedback.setStatus(status);
        feedback.setReviewerName(status == Feedback.FeedbackStatus.pending ? null : reviewerName);
        feedbackRepository.save(feedback);
        log.info("피드백 상태 변경: feedbackId={}, status={}, reviewer={}", feedbackId, status, reviewerName);
    }

    public void addImageUrl(String feedbackId, String userId, String imageUrl) {
        Feedback feedback = feedbackRepository.findById(feedbackId)
                .orElseThrow(() -> new IllegalArgumentException("피드백을 찾을 수 없습니다."));
        if (!feedback.getUserId().equals(userId)) {
            throw new IllegalArgumentException("본인의 피드백에만 이미지를 추가할 수 있습니다.");
        }
        if (feedback.getImageUrls() == null) {
            feedback.setImageUrls(new ArrayList<>());
        }
        if (feedback.getImageUrls().size() >= 5) {
            throw new IllegalArgumentException("이미지는 최대 5장까지 첨부할 수 있습니다.");
        }
        feedback.getImageUrls().add(imageUrl);
        feedbackRepository.save(feedback);
    }

    public Feedback updateFeedback(String userId, String feedbackId, String title, String content,
                                   Feedback.FeedbackCategory category, String authorName) {
        Feedback feedback = feedbackRepository.findById(feedbackId)
                .orElseThrow(() -> new IllegalArgumentException("피드백을 찾을 수 없습니다."));
        if (!feedback.getUserId().equals(userId)) {
            throw new IllegalArgumentException("본인의 피드백만 수정할 수 있습니다.");
        }
        if (title != null && !title.isBlank()) feedback.setTitle(title);
        if (content != null && !content.isBlank()) feedback.setContent(content);
        if (category != null) feedback.setCategory(category);
        if (authorName != null && !authorName.isBlank()) feedback.setAuthorName(authorName);
        feedback = feedbackRepository.save(feedback);
        log.info("피드백 수정: userId={}, feedbackId={}", userId, feedbackId);
        return feedback;
    }

    public Feedback toggleUpvote(String userId, String feedbackId) {
        Feedback feedback = feedbackRepository.findById(feedbackId)
                .orElseThrow(() -> new IllegalArgumentException("피드백을 찾을 수 없습니다."));

        if (feedback.getUpvotedUserIds().contains(userId)) {
            feedback.getUpvotedUserIds().remove(userId);
            feedback.setUpvotes(feedback.getUpvotes() - 1);
        } else {
            feedback.getUpvotedUserIds().add(userId);
            feedback.setUpvotes(feedback.getUpvotes() + 1);
        }

        return feedbackRepository.save(feedback);
    }
}
