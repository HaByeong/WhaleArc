package com.project.whalearc.community.controller;

import com.project.whalearc.common.dto.ApiResponse;
import com.project.whalearc.community.dto.*;
import com.project.whalearc.community.service.CommunityImageService;
import com.project.whalearc.community.service.CommunityService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.nio.file.Path;
import java.util.List;

/** 항해사 라운지 커뮤니티 — 게시글/댓글/공감/공유/이미지/인기 항로. */
@Slf4j
@RestController
@RequestMapping("/api/community")
@RequiredArgsConstructor
public class CommunityController {

    private final CommunityService communityService;
    private final CommunityImageService communityImageService;

    @GetMapping("/posts")
    public ApiResponse<List<PostResponse>> getPosts(@AuthenticationPrincipal Jwt jwt,
                                                    @RequestParam(required = false) String channel) {
        return ApiResponse.ok(communityService.getPosts(channel, jwt.getSubject()));
    }

    @PostMapping("/posts")
    public ApiResponse<PostResponse> createPost(@AuthenticationPrincipal Jwt jwt,
                                                @RequestBody CreatePostRequest req) {
        return ApiResponse.ok(communityService.createPost(jwt.getSubject(), req));
    }

    @DeleteMapping("/posts/{id}")
    public ApiResponse<Void> deletePost(@AuthenticationPrincipal Jwt jwt, @PathVariable String id) {
        communityService.deletePost(jwt.getSubject(), id);
        return ApiResponse.ok(null);
    }

    @PostMapping("/posts/{id}/like")
    public ApiResponse<PostResponse> toggleLike(@AuthenticationPrincipal Jwt jwt, @PathVariable String id) {
        return ApiResponse.ok(communityService.toggleLike(jwt.getSubject(), id));
    }

    @PostMapping("/posts/{id}/share")
    public ApiResponse<PostResponse> share(@AuthenticationPrincipal Jwt jwt, @PathVariable String id) {
        return ApiResponse.ok(communityService.incrementShare(jwt.getSubject(), id));
    }

    @PostMapping("/posts/{id}/follow")
    public ApiResponse<FollowResponse> follow(@AuthenticationPrincipal Jwt jwt, @PathVariable String id) {
        return ApiResponse.ok(communityService.followRoute(jwt.getSubject(), id));
    }

    @PostMapping("/posts/{id}/images")
    public ApiResponse<PostResponse> uploadImage(@AuthenticationPrincipal Jwt jwt, @PathVariable String id,
                                                 @RequestParam("file") MultipartFile file) {
        try {
            communityService.verifyCanAddImage(jwt.getSubject(), id); // 파일 저장 전 소유권·한도 선검증 (고아 파일 방지)
            String url = communityImageService.saveImage(file);
            return ApiResponse.ok(communityService.addImageUrl(jwt.getSubject(), id, url));
        } catch (Exception e) {
            throw new IllegalArgumentException(e.getMessage());
        }
    }

    @GetMapping("/images/{filename}")
    public ResponseEntity<Resource> serveImage(@PathVariable String filename) {
        try {
            Path path = communityImageService.getImagePath(filename);
            Resource resource = new UrlResource(path.toUri());
            if (!resource.exists()) return ResponseEntity.notFound().build();
            String contentType = "image/jpeg";
            if (filename.endsWith(".png")) contentType = "image/png";
            else if (filename.endsWith(".gif")) contentType = "image/gif";
            else if (filename.endsWith(".webp")) contentType = "image/webp";
            return ResponseEntity.ok().contentType(MediaType.parseMediaType(contentType)).body(resource);
        } catch (Exception e) {
            return ResponseEntity.notFound().build();
        }
    }

    @GetMapping("/posts/{id}/comments")
    public ApiResponse<List<CommentResponse>> getComments(@AuthenticationPrincipal Jwt jwt, @PathVariable String id) {
        return ApiResponse.ok(communityService.getComments(id, jwt.getSubject()));
    }

    @PostMapping("/posts/{id}/comments")
    public ApiResponse<CommentResponse> addComment(@AuthenticationPrincipal Jwt jwt, @PathVariable String id,
                                                   @RequestBody CreateCommentRequest req) {
        return ApiResponse.ok(communityService.addComment(jwt.getSubject(), id, req));
    }

    @DeleteMapping("/comments/{id}")
    public ApiResponse<Void> deleteComment(@AuthenticationPrincipal Jwt jwt, @PathVariable String id) {
        communityService.deleteComment(jwt.getSubject(), id);
        return ApiResponse.ok(null);
    }

    @GetMapping("/popular-routes")
    public ApiResponse<List<PopularRouteResponse>> popularRoutes() {
        return ApiResponse.ok(communityService.getPopularRoutes(5));
    }
}
