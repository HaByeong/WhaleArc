package com.project.whalearc.feedback.controller;

import com.project.whalearc.common.dto.ApiResponse;
import com.project.whalearc.feedback.domain.Feedback;
import com.project.whalearc.feedback.service.FeedbackImageService;
import com.project.whalearc.feedback.service.FeedbackService;
import com.project.whalearc.user.repository.UserRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.nio.file.Path;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Slf4j
@RestController
@RequestMapping("/api/feedback")
public class FeedbackController {

    private final FeedbackService feedbackService;
    private final FeedbackImageService feedbackImageService;
    private final UserRepository userRepository;
    private final Set<String> adminUserIds;

    public FeedbackController(FeedbackService feedbackService,
                              FeedbackImageService feedbackImageService,
                              UserRepository userRepository,
                              @Value("${feedback.admin-user-ids:}") String adminIds) {
        this.feedbackService = feedbackService;
        this.feedbackImageService = feedbackImageService;
        this.userRepository = userRepository;
        this.adminUserIds = adminIds.isBlank()
                ? Set.of()
                : Set.of(adminIds.split(","));
    }

    private boolean isAdmin(String userId) {
        return adminUserIds.contains(userId);
    }

    @GetMapping
    public ApiResponse<List<Map<String, Object>>> getFeedbacks(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam(required = false) String category) {

        String userId = jwt.getSubject();
        Feedback.FeedbackCategory cat = null;
        if (category != null && !category.isBlank()) {
            try {
                cat = Feedback.FeedbackCategory.valueOf(category);
            } catch (IllegalArgumentException e) {
                // 잘못된 카테고리는 무시하고 전체 조회
            }
        }

        List<Feedback> feedbacks = feedbackService.getFeedbacks(cat);
        boolean admin = isAdmin(userId);

        List<Map<String, Object>> result = feedbacks.stream().map(f -> {
            Map<String, Object> map = new HashMap<>();
            map.put("id", f.getId());
            map.put("category", f.getCategory().name());
            map.put("title", f.getTitle());
            map.put("content", f.getContent());
            map.put("createdAt", f.getCreatedAt().toString());
            map.put("status", f.getStatus().name());
            map.put("authorName", f.getAuthorName());
            map.put("upvotes", f.getUpvotes());
            map.put("hasUpvoted", f.getUpvotedUserIds().contains(userId));
            map.put("isOwner", f.getUserId().equals(userId));
            map.put("imageUrls", f.getImageUrls() != null ? f.getImageUrls() : List.of());
            map.put("reviewerName", f.getReviewerName());
            map.put("isAdmin", admin);
            return map;
        }).toList();

        return ApiResponse.ok(result);
    }

    @PostMapping
    public ApiResponse<Feedback> createFeedback(@AuthenticationPrincipal Jwt jwt,
                                                @RequestBody Map<String, String> body) {
        String userId = jwt.getSubject();
        String title = body.get("title");
        String content = body.get("content");
        String categoryStr = body.get("category");
        String authorName = body.getOrDefault("authorName", "익명");

        if (title == null || title.isBlank()) {
            throw new IllegalArgumentException("제목을 입력해주세요.");
        }
        if (content == null || content.isBlank()) {
            throw new IllegalArgumentException("내용을 입력해주세요.");
        }
        if (title.length() > 100) {
            throw new IllegalArgumentException("제목은 100자 이내로 입력해주세요.");
        }
        if (content.length() > 2000) {
            throw new IllegalArgumentException("내용은 2000자 이내로 입력해주세요.");
        }
        if (authorName.length() > 20) {
            authorName = authorName.substring(0, 20);
        }

        Feedback.FeedbackCategory category;
        try {
            category = Feedback.FeedbackCategory.valueOf(categoryStr);
        } catch (Exception e) {
            category = Feedback.FeedbackCategory.other;
        }

        Feedback feedback = feedbackService.createFeedback(userId, authorName, category, title, content);
        return ApiResponse.ok(feedback);
    }

    @PutMapping("/{id}")
    public ApiResponse<Feedback> updateFeedback(@AuthenticationPrincipal Jwt jwt,
                                                @PathVariable String id,
                                                @RequestBody Map<String, String> body) {
        String userId = jwt.getSubject();
        String title = body.get("title");
        String content = body.get("content");
        String categoryStr = body.get("category");
        String authorName = body.get("authorName");

        if (title != null && title.length() > 100) {
            throw new IllegalArgumentException("제목은 100자 이내로 입력해주세요.");
        }
        if (content != null && content.length() > 2000) {
            throw new IllegalArgumentException("내용은 2000자 이내로 입력해주세요.");
        }
        if (authorName != null && authorName.length() > 20) {
            authorName = authorName.substring(0, 20);
        }

        Feedback.FeedbackCategory category = null;
        if (categoryStr != null) {
            try {
                category = Feedback.FeedbackCategory.valueOf(categoryStr);
            } catch (Exception e) {
                // 무시
            }
        }

        Feedback feedback = feedbackService.updateFeedback(userId, id, title, content, category, authorName);
        return ApiResponse.ok(feedback);
    }

    @PutMapping("/{id}/status")
    public ApiResponse<Void> updateStatus(@AuthenticationPrincipal Jwt jwt,
                                          @PathVariable String id,
                                          @RequestBody Map<String, String> body) {
        String userId = jwt.getSubject();
        if (!isAdmin(userId)) {
            throw new IllegalArgumentException("관리자만 상태를 변경할 수 있습니다.");
        }
        String statusStr = body.get("status");
        Feedback.FeedbackStatus status;
        try {
            status = Feedback.FeedbackStatus.valueOf(statusStr);
        } catch (Exception e) {
            throw new IllegalArgumentException("유효하지 않은 상태입니다. (pending, reviewed, resolved)");
        }
        String reviewerName = userRepository.findBySupabaseId(userId)
                .map(u -> u.getName())
                .orElse("관리자");
        feedbackService.updateStatus(id, status, reviewerName);
        return ApiResponse.ok(null);
    }

    @PostMapping("/{id}/upvote")
    public ApiResponse<Void> toggleUpvote(@AuthenticationPrincipal Jwt jwt,
                                          @PathVariable String id) {
        String userId = jwt.getSubject();
        feedbackService.toggleUpvote(userId, id);
        return ApiResponse.ok(null);
    }

    @PostMapping("/{id}/images")
    public ApiResponse<Map<String, String>> uploadImage(@AuthenticationPrincipal Jwt jwt,
                                                        @PathVariable String id,
                                                        @RequestParam("file") MultipartFile file) {
        String userId = jwt.getSubject();
        try {
            String imageUrl = feedbackImageService.saveImage(file);
            feedbackService.addImageUrl(id, userId, imageUrl);
            return ApiResponse.ok(Map.of("url", imageUrl));
        } catch (Exception e) {
            throw new IllegalArgumentException(e.getMessage());
        }
    }

    @GetMapping("/images/{filename}")
    public ResponseEntity<Resource> serveImage(@PathVariable String filename) {
        try {
            Path path = feedbackImageService.getImagePath(filename);
            Resource resource = new UrlResource(path.toUri());
            if (!resource.exists()) {
                return ResponseEntity.notFound().build();
            }
            String contentType = "image/jpeg";
            if (filename.endsWith(".png")) contentType = "image/png";
            else if (filename.endsWith(".gif")) contentType = "image/gif";
            else if (filename.endsWith(".webp")) contentType = "image/webp";
            return ResponseEntity.ok()
                    .contentType(MediaType.parseMediaType(contentType))
                    .body(resource);
        } catch (Exception e) {
            return ResponseEntity.notFound().build();
        }
    }
}
