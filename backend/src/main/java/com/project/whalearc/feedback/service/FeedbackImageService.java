package com.project.whalearc.feedback.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.Set;
import java.util.UUID;

@Slf4j
@Service
public class FeedbackImageService {

    private static final Path UPLOAD_DIR = Paths.get(System.getProperty("user.dir"), "uploads", "feedback");
    private static final long MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
    private static final Set<String> ALLOWED_TYPES = Set.of("image/jpeg", "image/png", "image/gif", "image/webp");

    public FeedbackImageService() {
        try {
            Files.createDirectories(UPLOAD_DIR);
        } catch (IOException e) {
            log.error("피드백 이미지 업로드 디렉토리 생성 실패", e);
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
        if (contentType == null || !ALLOWED_TYPES.contains(contentType)) {
            throw new IllegalArgumentException("지원하지 않는 파일 형식입니다. (JPG, PNG, GIF, WebP만 가능)");
        }

        String ext = getExtension(file.getOriginalFilename());
        String filename = UUID.randomUUID() + ext;
        Path target = UPLOAD_DIR.resolve(filename);
        Files.copy(file.getInputStream(), target, StandardCopyOption.REPLACE_EXISTING);

        log.info("피드백 이미지 저장: {}", filename);
        return "/api/feedback/images/" + filename;
    }

    public Path getImagePath(String filename) {
        Path path = UPLOAD_DIR.resolve(filename).normalize();
        if (!path.startsWith(UPLOAD_DIR.normalize())) {
            throw new IllegalArgumentException("잘못된 파일 경로입니다.");
        }
        return path;
    }

    private String getExtension(String filename) {
        if (filename == null) return ".jpg";
        int dot = filename.lastIndexOf('.');
        return dot >= 0 ? filename.substring(dot) : ".jpg";
    }
}
