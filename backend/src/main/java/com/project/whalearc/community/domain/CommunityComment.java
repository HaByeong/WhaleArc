package com.project.whalearc.community.domain;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

/** 게시글 댓글. */
@Getter
@Setter
@NoArgsConstructor
@Document(collection = "community_comments")
public class CommunityComment {

    @Id
    private String id;

    @Indexed
    private String postId;

    private String userId;
    private String authorName;
    private String authorTier;
    private String content;
    private Instant createdAt;

    public CommunityComment(String postId, String userId, String authorName, String authorTier, String content) {
        this.postId = postId;
        this.userId = userId;
        this.authorName = authorName;
        this.authorTier = authorTier;
        this.content = content;
        this.createdAt = Instant.now();
    }
}
