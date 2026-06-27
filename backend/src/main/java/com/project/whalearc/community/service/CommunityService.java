package com.project.whalearc.community.service;

import com.project.whalearc.community.domain.CommunityComment;
import com.project.whalearc.community.domain.CommunityPost;
import com.project.whalearc.community.dto.*;
import com.project.whalearc.community.repository.CommunityCommentRepository;
import com.project.whalearc.community.repository.CommunityPostRepository;
import com.project.whalearc.trade.service.PortfolioService;
import com.project.whalearc.strategy.domain.Strategy;
import com.project.whalearc.strategy.service.StrategyService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class CommunityService {

    private final CommunityPostRepository postRepository;
    private final CommunityCommentRepository commentRepository;
    private final PortfolioService portfolioService;
    private final StrategyService strategyService;
    private final CommunityImageService communityImageService;

    /** 수익률 → 고래등급 (ConsoleStatusPage tierOf 와 동일 임계). */
    private String tierFromReturn(double ret) {
        if (ret >= 100) return "blue";
        if (ret >= 50) return "humpback";
        if (ret >= 20) return "orca";
        return "beluga";
    }

    /** 작성자의 현재 수익률 기준 고래등급 스냅샷. 조회 실패 시 흰고래.
     *  전체 랭킹(findAll 풀스캔) 대신 본인 포트폴리오 수익률만 조회 — 등급은 수익률 버킷이라 동일 결과. */
    private String resolveTier(String userId) {
        try {
            return tierFromReturn(portfolioService.getOrCreatePortfolio(userId).getReturnRate().doubleValue());
        } catch (Exception e) {
            log.debug("tier 계산 실패(userId={}) → beluga 기본값", userId, e);
            return "beluga";
        }
    }

    private String safeAuthor(String raw) {
        String a = (raw == null || raw.isBlank()) ? "익명 항해사" : raw.trim();
        return a.length() > 20 ? a.substring(0, 20) : a;
    }

    public PostResponse createPost(String userId, CreatePostRequest req) {
        if (req.title() == null || req.title().isBlank()) throw new IllegalArgumentException("제목을 입력해주세요.");
        if (req.content() == null || req.content().isBlank()) throw new IllegalArgumentException("내용을 입력해주세요.");
        if (req.title().length() > 120) throw new IllegalArgumentException("제목은 120자 이내로 입력해주세요.");
        if (req.content().length() > 4000) throw new IllegalArgumentException("내용은 4000자 이내로 입력해주세요.");

        CommunityPost.CommunityChannel channel;
        try {
            channel = CommunityPost.CommunityChannel.valueOf(req.channel());
        } catch (Exception e) {
            channel = CommunityPost.CommunityChannel.log;
        }

        String sharedName = (req.sharedStrategyName() != null && !req.sharedStrategyName().isBlank())
                ? req.sharedStrategyName().trim() : null;

        CommunityPost post = new CommunityPost(
                userId, safeAuthor(req.authorName()), resolveTier(userId), channel,
                req.title().trim(), req.content().trim(),
                sharedName != null ? req.sharedStrategyId() : null,
                sharedName,
                sharedName != null ? req.sharedReturnRate() : null);
        postRepository.save(post);
        return PostResponse.from(post, userId);
    }

    public List<PostResponse> getPosts(String channelStr, String currentUserId) {
        CommunityPost.CommunityChannel channel = null;
        if (channelStr != null && !channelStr.isBlank() && !"all".equals(channelStr)) {
            try {
                channel = CommunityPost.CommunityChannel.valueOf(channelStr);
            } catch (Exception ignored) {
            }
        }
        List<CommunityPost> posts = channel != null
                ? postRepository.findTop200ByChannelOrderByCreatedAtDesc(channel)
                : postRepository.findTop200ByOrderByCreatedAtDesc();
        return posts.stream().map(p -> PostResponse.from(p, currentUserId)).toList();
    }

    public PostResponse toggleLike(String userId, String postId) {
        CommunityPost p = postRepository.findById(postId)
                .orElseThrow(() -> new IllegalArgumentException("게시글을 찾을 수 없습니다."));
        if (p.getLikedUserIds() == null) p.setLikedUserIds(new HashSet<>());
        if (p.getLikedUserIds().contains(userId)) p.getLikedUserIds().remove(userId);
        else p.getLikedUserIds().add(userId);
        p.setLikeCount(p.getLikedUserIds().size());
        postRepository.save(p);
        return PostResponse.from(p, userId);
    }

    /** 게시글에 이미지 URL 추가 — 본인 글만, 최대 4장. */
    /** 이미지 업로드 전 선검증 — 파일을 디스크에 쓰기 전에 존재·소유권·첨부한도를 확인해 고아 파일/디스크 DoS 방지 */
    public void verifyCanAddImage(String userId, String postId) {
        CommunityPost p = postRepository.findById(postId)
                .orElseThrow(() -> new IllegalArgumentException("게시글을 찾을 수 없습니다."));
        if (!p.getUserId().equals(userId)) throw new IllegalArgumentException("본인 글에만 이미지를 추가할 수 있습니다.");
        if (p.getImageUrls() != null && p.getImageUrls().size() >= 4)
            throw new IllegalArgumentException("이미지는 최대 4장까지 첨부할 수 있습니다.");
    }

    public PostResponse addImageUrl(String userId, String postId, String imageUrl) {
        CommunityPost p = postRepository.findById(postId)
                .orElseThrow(() -> new IllegalArgumentException("게시글을 찾을 수 없습니다."));
        if (!p.getUserId().equals(userId)) throw new IllegalArgumentException("본인 글에만 이미지를 추가할 수 있습니다.");
        if (p.getImageUrls() == null) p.setImageUrls(new java.util.ArrayList<>());
        if (p.getImageUrls().size() >= 4) throw new IllegalArgumentException("이미지는 최대 4장까지 첨부할 수 있습니다.");
        p.getImageUrls().add(imageUrl);
        postRepository.save(p);
        return PostResponse.from(p, userId);
    }

    public PostResponse incrementShare(String userId, String postId) {
        postRepository.findById(postId)
                .orElseThrow(() -> new IllegalArgumentException("게시글을 찾을 수 없습니다."));
        postRepository.incrementShareCount(postId); // 원자적 $inc (lost-update 방지)
        // $inc 후 최신 문서를 다시 읽어 응답 shareCount를 DB 실제값과 일치시킨다(동시 공유 시 어긋남 방지)
        CommunityPost p = postRepository.findById(postId)
                .orElseThrow(() -> new IllegalArgumentException("게시글을 찾을 수 없습니다."));
        return PostResponse.from(p, userId);
    }

    /** 항로 따라가기 — 게시글의 공유 항로를 현재 사용자 라이브러리로 복사. */
    public FollowResponse followRoute(String userId, String postId) {
        CommunityPost p = postRepository.findById(postId)
                .orElseThrow(() -> new IllegalArgumentException("게시글을 찾을 수 없습니다."));
        if (p.getSharedStrategyId() == null || p.getSharedStrategyId().isBlank()) {
            throw new IllegalArgumentException("이 일지에는 공유된 항로가 없습니다.");
        }
        Strategy copy = strategyService.copyStrategy(userId, p.getSharedStrategyId());
        return new FollowResponse(copy.getId(), copy.getName());
    }

    public void deletePost(String userId, String postId) {
        CommunityPost p = postRepository.findById(postId)
                .orElseThrow(() -> new IllegalArgumentException("게시글을 찾을 수 없습니다."));
        if (!p.getUserId().equals(userId)) throw new IllegalArgumentException("본인 게시글만 삭제할 수 있습니다.");
        commentRepository.deleteByPostId(postId);
        postRepository.delete(p);
        // 업로드 이미지 고아 방지 — best-effort 정리(실패해도 삭제는 이미 완료)
        if (p.getImageUrls() != null) p.getImageUrls().forEach(communityImageService::deleteImageByUrl);
    }

    public List<CommentResponse> getComments(String postId, String currentUserId) {
        return commentRepository.findTop100ByPostIdOrderByCreatedAtAsc(postId).stream()
                .map(c -> CommentResponse.from(c, currentUserId)).toList();
    }

    public CommentResponse addComment(String userId, String postId, CreateCommentRequest req) {
        if (req.content() == null || req.content().isBlank()) throw new IllegalArgumentException("댓글 내용을 입력해주세요.");
        if (req.content().length() > 1000) throw new IllegalArgumentException("댓글은 1000자 이내로 입력해주세요.");
        CommunityPost p = postRepository.findById(postId)
                .orElseThrow(() -> new IllegalArgumentException("게시글을 찾을 수 없습니다."));
        CommunityComment c = new CommunityComment(postId, userId, safeAuthor(req.authorName()), resolveTier(userId), req.content().trim());
        commentRepository.save(c);
        p.setCommentCount((int) commentRepository.countByPostId(postId));
        postRepository.save(p);
        return CommentResponse.from(c, userId);
    }

    public void deleteComment(String userId, String commentId) {
        CommunityComment c = commentRepository.findById(commentId)
                .orElseThrow(() -> new IllegalArgumentException("댓글을 찾을 수 없습니다."));
        if (!c.getUserId().equals(userId)) throw new IllegalArgumentException("본인 댓글만 삭제할 수 있습니다.");
        commentRepository.delete(c);
        postRepository.findById(c.getPostId()).ifPresent(p -> {
            p.setCommentCount((int) commentRepository.countByPostId(c.getPostId()));
            postRepository.save(p);
        });
    }

    /** 인기 항로 — 게시글에서 공유된 전략 이름 기준 집계(상위 limit). */
    public List<PopularRouteResponse> getPopularRoutes(int limit) {
        Map<String, Long> counts = new HashMap<>();
        Map<String, String> nameToId = new HashMap<>();
        // 전체 풀스캔 대신 최근 200건 기준 집계 (확장성)
        for (CommunityPost p : postRepository.findTop200ByOrderByCreatedAtDesc()) {
            String name = p.getSharedStrategyName();
            if (name == null || name.isBlank()) continue;
            counts.merge(name, 1L, Long::sum);
            if (p.getSharedStrategyId() != null) nameToId.putIfAbsent(name, p.getSharedStrategyId());
        }
        return counts.entrySet().stream()
                .sorted((a, b) -> Long.compare(b.getValue(), a.getValue()))
                .limit(limit)
                .map(e -> new PopularRouteResponse(nameToId.get(e.getKey()), e.getKey(), e.getValue()))
                .toList();
    }
}
