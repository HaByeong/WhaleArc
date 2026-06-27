package com.project.whalearc.community.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Map;
import java.util.UUID;

/** 커뮤니티 게시글 이미지 저장/서빙 (FeedbackImageService 패턴 — uploads/community). */
@Slf4j
@Service
public class CommunityImageService {

    private static final Path UPLOAD_DIR = Paths.get(System.getProperty("user.dir"), "uploads", "community");
    private static final long MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
    // 확장자는 파일명(공격자 제어)이 아니라 이 화이트리스트에서 결정한다.
    private static final Map<String, String> EXT_BY_TYPE = Map.of(
            "image/jpeg", ".jpg", "image/png", ".png", "image/gif", ".gif", "image/webp", ".webp");

    public CommunityImageService() {
        try {
            Files.createDirectories(UPLOAD_DIR);
        } catch (IOException e) {
            log.error("커뮤니티 이미지 업로드 디렉토리 생성 실패", e);
        }
    }

    public String saveImage(MultipartFile file) throws IOException {
        if (file.isEmpty()) {
            throw new IllegalArgumentException("빈 파일입니다.");
        }
        if (file.getSize() > MAX_FILE_SIZE) {
            throw new IllegalArgumentException("파일 크기는 5MB 이하여야 합니다.");
        }
        String contentType = file.getContentType();
        if (contentType == null || !EXT_BY_TYPE.containsKey(contentType)) {
            throw new IllegalArgumentException("지원하지 않는 파일 형식입니다. (JPG, PNG, GIF, WebP만 가능)");
        }
        byte[] bytes = file.getBytes();
        if (!isAllowedImage(bytes)) {
            throw new IllegalArgumentException("이미지 파일이 아니거나 손상되었습니다.");
        }

        String ext = EXT_BY_TYPE.get(contentType); // 확장자는 contentType 화이트리스트에서 결정 (파일명 신뢰 안 함)
        String filename = UUID.randomUUID() + ext;
        Path target = UPLOAD_DIR.resolve(filename);
        Files.write(target, bytes);

        log.info("커뮤니티 이미지 저장: {}", filename);
        return "/api/community/images/" + filename;
    }

    public Path getImagePath(String filename) {
        Path path = UPLOAD_DIR.resolve(filename).normalize();
        if (!path.startsWith(UPLOAD_DIR.normalize())) {
            throw new IllegalArgumentException("잘못된 파일 경로입니다.");
        }
        return path;
    }

    /** 게시글 삭제 시 업로드 이미지 고아 방지 — imageUrl(/api/community/images/{filename})의 파일을 best-effort 삭제. */
    public void deleteImageByUrl(String imageUrl) {
        if (imageUrl == null || imageUrl.isBlank()) return;
        try {
            String filename = imageUrl.substring(imageUrl.lastIndexOf('/') + 1);
            if (filename.isBlank()) return;
            Path path = UPLOAD_DIR.resolve(filename).normalize();
            if (!path.startsWith(UPLOAD_DIR.normalize())) return; // 경로 이탈 방어
            Files.deleteIfExists(path);
        } catch (Exception e) {
            // 삭제 실패는 로그만 — 게시글 삭제는 계속 진행
            log.warn("커뮤니티 이미지 삭제 실패 [{}]: {}", imageUrl, e.getMessage());
        }
    }

    /** 매직바이트로 실제 이미지인지 검증 (MIME/확장자는 위조 가능) */
    static boolean isAllowedImage(byte[] b) {
        if (b == null || b.length < 12) return false;
        // JPEG: FF D8 FF
        if ((b[0] & 0xFF) == 0xFF && (b[1] & 0xFF) == 0xD8 && (b[2] & 0xFF) == 0xFF) return true;
        // PNG: 89 'P' 'N' 'G'
        if ((b[0] & 0xFF) == 0x89 && b[1] == 'P' && b[2] == 'N' && b[3] == 'G') return true;
        // GIF: 'G' 'I' 'F' '8'
        if (b[0] == 'G' && b[1] == 'I' && b[2] == 'F' && b[3] == '8') return true;
        // WebP: 'R' 'I' 'F' 'F' .... 'W' 'E' 'B' 'P'
        if (b[0] == 'R' && b[1] == 'I' && b[2] == 'F' && b[3] == 'F'
                && b[8] == 'W' && b[9] == 'E' && b[10] == 'B' && b[11] == 'P') return true;
        return false;
    }
}
