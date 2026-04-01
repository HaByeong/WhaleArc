package com.project.whalearc.feedback.domain;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Getter
@Setter
@NoArgsConstructor
@Document(collection = "feedbacks")
public class Feedback {

    @Id
    private String id;

    @Indexed
    private String userId;

    private String authorName;
    private FeedbackCategory category;
    private String title;
    private String content;
    private FeedbackStatus status;
    private String reviewerName;
    private Set<String> upvotedUserIds;
    private List<String> imageUrls;
    private int upvotes;
    private Instant createdAt;

    public enum FeedbackCategory {
        bug, feature, ui, other
    }

    public enum FeedbackStatus {
        pending, reviewed, resolved
    }

    public Feedback(String userId, String authorName, FeedbackCategory category, String title, String content) {
        this.userId = userId;
        this.authorName = authorName;
        this.category = category;
        this.title = title;
        this.content = content;
        this.status = FeedbackStatus.pending;
        this.imageUrls = new ArrayList<>();
        this.upvotedUserIds = new HashSet<>();
        this.upvotes = 0;
        this.createdAt = Instant.now();
    }
}
