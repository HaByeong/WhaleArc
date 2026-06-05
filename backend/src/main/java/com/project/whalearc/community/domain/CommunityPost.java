package com.project.whalearc.community.domain;

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

/**
 * 항해사 라운지 게시글. 채널(항해일지/전략공유/정박지질문/만선자랑) + 선택적 공유 항로(전략) + 공감/댓글/공유 카운트.
 */
@Getter
@Setter
@NoArgsConstructor
@Document(collection = "community_posts")
public class CommunityPost {

    @Id
    private String id;

    @Indexed
    private String userId;

    private String authorName;
    private String authorTier;          // blue / humpback / orca / beluga (작성 시점 수익률 기준 스냅샷)
    private CommunityChannel channel;
    private String title;
    private String content;

    // 공유 항로 (선택) — 전략을 함께 공유했을 때만 채워짐
    private String sharedStrategyId;
    private String sharedStrategyName;
    private Double sharedReturnRate;    // 공유 시점 전략 수익률(%) — null 가능

    private List<String> imageUrls = new ArrayList<>();
    private Set<String> likedUserIds = new HashSet<>();
    private int likeCount;
    private int commentCount;
    private int shareCount;
    private Instant createdAt;

    public enum CommunityChannel {
        log, strategy, question, brag
    }

    public CommunityPost(String userId, String authorName, String authorTier, CommunityChannel channel,
                         String title, String content,
                         String sharedStrategyId, String sharedStrategyName, Double sharedReturnRate) {
        this.userId = userId;
        this.authorName = authorName;
        this.authorTier = authorTier;
        this.channel = channel;
        this.title = title;
        this.content = content;
        this.sharedStrategyId = sharedStrategyId;
        this.sharedStrategyName = sharedStrategyName;
        this.sharedReturnRate = sharedReturnRate;
        this.imageUrls = new ArrayList<>();
        this.likedUserIds = new HashSet<>();
        this.likeCount = 0;
        this.commentCount = 0;
        this.shareCount = 0;
        this.createdAt = Instant.now();
    }
}
