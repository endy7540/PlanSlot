package com.example.planslot.member.controller;

import com.example.planslot.member.servcie.MemberService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;

@RestController
@RequestMapping("/members")
@RequiredArgsConstructor
public class MemberController {
    private final MemberService memberService;

    @GetMapping("/checkDuplicate")
    public ResponseEntity<Boolean> checkDuplicate(@RequestParam("loginId") String loginId) {
        return ResponseEntity.ok(memberService.checkDuplicateId(loginId));
    }

    @GetMapping("/me")
    public ResponseEntity<com.example.planslot.member.dto.MemberResponseDTO.MyPage> getMyPage(org.springframework.security.core.Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) {
            return ResponseEntity.status(org.springframework.http.HttpStatus.UNAUTHORIZED).build();
        }
        return ResponseEntity.ok(memberService.getMyPage(authentication.getName()));
    }

    @org.springframework.web.bind.annotation.PutMapping("/me")
    public ResponseEntity<?> updateMyPage(org.springframework.security.core.Authentication authentication, @org.springframework.web.bind.annotation.RequestBody com.example.planslot.member.dto.MemberRequestDTO.UpdateInfo request) {
        if (authentication == null || !authentication.isAuthenticated()) {
            return ResponseEntity.status(org.springframework.http.HttpStatus.UNAUTHORIZED).build();
        }
        try {
            memberService.updateMyInfo(authentication.getName(), request);
            return ResponseEntity.ok().build();
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(java.util.Map.of("message", e.getMessage()));
        }
    }

    @org.springframework.web.bind.annotation.DeleteMapping("/me")
    public ResponseEntity<?> withdraw(org.springframework.security.core.Authentication authentication, jakarta.servlet.http.HttpServletResponse response) {
        if (authentication == null || !authentication.isAuthenticated()) {
            return ResponseEntity.status(org.springframework.http.HttpStatus.UNAUTHORIZED).build();
        }
        memberService.withdraw(authentication.getName());

        // 쿠키에 있는 jwt 토큰 삭제
        jakarta.servlet.http.Cookie cookie = new jakarta.servlet.http.Cookie("jwt", null);
        cookie.setPath("/");
        cookie.setHttpOnly(true);
        cookie.setMaxAge(0);
        response.addCookie(cookie);

        return ResponseEntity.ok().build();
    }

    @org.springframework.web.bind.annotation.PutMapping("/notifications")
    public ResponseEntity<?> updateNotification(org.springframework.security.core.Authentication authentication, @org.springframework.web.bind.annotation.RequestBody com.example.planslot.member.dto.MemberRequestDTO.UpdateNotification request) {
        if (authentication == null || !authentication.isAuthenticated()) {
            return ResponseEntity.status(org.springframework.http.HttpStatus.UNAUTHORIZED).build();
        }
        try {
            memberService.updateNotification(authentication.getName(), request);
            return ResponseEntity.ok().build();
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(java.util.Map.of("message", e.getMessage()));
        }
    }

    @org.springframework.web.bind.annotation.PostMapping("/profile-image")
    public ResponseEntity<?> uploadProfileImage(org.springframework.security.core.Authentication authentication, @org.springframework.web.bind.annotation.RequestParam("file") org.springframework.web.multipart.MultipartFile file) {
        if (authentication == null || !authentication.isAuthenticated()) {
            return ResponseEntity.status(org.springframework.http.HttpStatus.UNAUTHORIZED).build();
        }
        try {
            if (file.isEmpty()) {
                return ResponseEntity.badRequest().body(java.util.Map.of("message", "파일이 없습니다."));
            }
            
            String contentType = file.getContentType();
            if (contentType == null || !contentType.startsWith("image/")) {
                return ResponseEntity.badRequest().body(java.util.Map.of("message", "이미지 파일만 업로드 가능합니다."));
            }

            String originalFilename = file.getOriginalFilename();
            String extension = "";
            if (originalFilename != null && originalFilename.contains(".")) {
                String potentialExtension = originalFilename.substring(originalFilename.lastIndexOf(".")).toLowerCase();
                if (potentialExtension.matches("\\.(png|jpg|jpeg|gif|webp)")) {
                    extension = potentialExtension;
                } else {
                    return ResponseEntity.badRequest().body(java.util.Map.of("message", "지원하지 않는 이미지 확장자입니다. (png, jpg, jpeg, gif, webp 허용)"));
                }
            } else {
                return ResponseEntity.badRequest().body(java.util.Map.of("message", "파일 확장자를 확인할 수 없습니다."));
            }
            String newFilename = java.util.UUID.randomUUID().toString() + extension;
            
            // 절대 경로로 명확하게 지정 (Spring Boot 실행 위치 기준)
            java.nio.file.Path uploadPath = java.nio.file.Paths.get(System.getProperty("user.dir"), "uploads", "profile");
            if (!java.nio.file.Files.exists(uploadPath)) {
                java.nio.file.Files.createDirectories(uploadPath);
            }
            
            java.nio.file.Path filePath = uploadPath.resolve(newFilename);
            file.transferTo(filePath.toFile());
            
            // 기존 프로필 이미지 파일 삭제 로직
            com.example.planslot.member.dto.MemberResponseDTO.MyPage myPage = memberService.getMyPage(authentication.getName());
            String oldImageUrl = myPage.getProfileImageUrl();
            if (oldImageUrl != null && oldImageUrl.startsWith("/uploads/profile/")) {
                String oldFilename = oldImageUrl.substring("/uploads/profile/".length());
                java.nio.file.Path oldFilePath = uploadPath.resolve(oldFilename);
                try {
                    java.nio.file.Files.deleteIfExists(oldFilePath);
                } catch (Exception ignored) {
                    // 삭제 실패 시 무시 (예: 파일이 이미 없는 경우)
                }
            }
            
            String imageUrl = "/uploads/profile/" + newFilename;
            memberService.updateProfileImage(authentication.getName(), imageUrl);
            
            return ResponseEntity.ok(java.util.Map.of("imageUrl", imageUrl));
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(500).body(java.util.Map.of("message", "오류: " + e.getMessage()));
        }
    }
}
