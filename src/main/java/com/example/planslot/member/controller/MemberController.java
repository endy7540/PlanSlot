package com.example.planslot.member.controller;

import com.example.planslot.member.dto.MemberRequestDTO;
import com.example.planslot.member.dto.MemberResponseDTO;
import com.example.planslot.member.entity.Member;
import com.example.planslot.member.servcie.MemberService;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Map;
import java.util.UUID;

import com.example.planslot.global.security.jwt.JwtTokenProvider;
import jakarta.servlet.http.HttpServletRequest;
import java.io.IOException;

@RestController
@RequestMapping("/members")
@RequiredArgsConstructor
public class MemberController {
    private final MemberService memberService;
    private final JwtTokenProvider jwtTokenProvider;

    @GetMapping("/checkDuplicate")
    public ResponseEntity<Boolean> checkDuplicate(@RequestParam("loginId") String loginId) {
        return ResponseEntity.ok(memberService.checkDuplicateId(loginId));
    }

    @GetMapping("/me")
    public ResponseEntity<MemberResponseDTO.MyPage> getMyPage(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        return ResponseEntity.ok(memberService.getMyPage(authentication.getName()));
    }

    @PutMapping("/me")
    public ResponseEntity<?> updateMyPage(Authentication authentication, @RequestBody MemberRequestDTO.UpdateInfo request) {
        if (authentication == null || !authentication.isAuthenticated()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        try {
            memberService.updateMyInfo(authentication.getName(), request);
            return ResponseEntity.ok().build();
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @PatchMapping("/me/calendar-color")
    public ResponseEntity<?> updateCalendarColor(Authentication authentication, @RequestBody Map<String, String> body) {
        if (authentication == null || !authentication.isAuthenticated()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        memberService.updateCalendarColor(authentication.getName(), body.get("calendarColor"));
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/me")
    public ResponseEntity<?> withdraw(Authentication authentication, HttpServletResponse response) {
        if (authentication == null || !authentication.isAuthenticated()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        memberService.withdraw(authentication.getName());

        // 쿠키에 있는 jwt 토큰 삭제
        Cookie cookie = new Cookie("jwt", null);
        cookie.setPath("/");
        cookie.setHttpOnly(true);
        cookie.setMaxAge(0);
        response.addCookie(cookie);

        return ResponseEntity.ok().build();
    }

    @GetMapping("/me/google-sync")
    public ResponseEntity<?> getGoogleSyncStatus(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        Member member = memberService.getMember(authentication.getName());
        boolean isLinked = member.getGoogleAccessToken() != null;
        return ResponseEntity.ok(Map.of(
            "isLinked", isLinked,
            "isEnabled", member.isGoogleSyncEnabled()
        ));
    }

    @PostMapping("/me/google-sync")
    public ResponseEntity<?> toggleGoogleSync(Authentication authentication, @RequestBody Map<String, Boolean> request) {
        if (authentication == null || !authentication.isAuthenticated()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        Member member = memberService.getMember(authentication.getName());
        if (member.getGoogleAccessToken() == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "구글 연동이 필요합니다."));
        }
        
        Boolean enabled = request.get("enabled");
        if (enabled != null) {
            memberService.updateGoogleSyncEnabled(authentication.getName(), enabled);
        }
        return ResponseEntity.ok().build();
    }

    @GetMapping("/me/link-google")
    public void linkGoogleCalendar(@RequestParam("token") String token, HttpServletRequest request, HttpServletResponse response) throws IOException {
        String email = jwtTokenProvider.getEmailFromToken(token);
        if (email != null) {
            request.getSession().setAttribute("LINK_GOOGLE_EMAIL", email);
            response.sendRedirect("/oauth2/authorization/google");
        } else {
            response.sendError(HttpServletResponse.SC_UNAUTHORIZED, "Invalid token");
        }
    }

    @PutMapping("/notifications")
    public ResponseEntity<?> updateNotification(Authentication authentication, @RequestBody MemberRequestDTO.UpdateNotification request) {
        if (authentication == null || !authentication.isAuthenticated()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        try {
            memberService.updateNotification(authentication.getName(), request);
            return ResponseEntity.ok().build();
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @PostMapping("/profile-image")
    public ResponseEntity<?> uploadProfileImage(Authentication authentication, @RequestParam("file") MultipartFile file) {
        if (authentication == null || !authentication.isAuthenticated()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        try {
            if (file.isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("message", "파일이 없습니다."));
            }
            
            String contentType = file.getContentType();
            if (contentType == null || !contentType.startsWith("image/")) {
                return ResponseEntity.badRequest().body(Map.of("message", "이미지 파일만 업로드 가능합니다."));
            }

            String originalFilename = file.getOriginalFilename();
            String extension = "";
            if (originalFilename != null && originalFilename.contains(".")) {
                String potentialExtension = originalFilename.substring(originalFilename.lastIndexOf(".")).toLowerCase();
                if (potentialExtension.matches("\\.(png|jpg|jpeg|gif|webp)")) {
                    extension = potentialExtension;
                } else {
                    return ResponseEntity.badRequest().body(Map.of("message", "지원하지 않는 이미지 확장자입니다. (png, jpg, jpeg, gif, webp 허용)"));
                }
            } else {
                return ResponseEntity.badRequest().body(Map.of("message", "파일 확장자를 확인할 수 없습니다."));
            }
            String newFilename = UUID.randomUUID().toString() + extension;
            
            // 절대 경로로 명확하게 지정 (Spring Boot 실행 위치 기준)
            Path uploadPath = Paths.get(System.getProperty("user.dir"), "uploads", "profile");
            if (!Files.exists(uploadPath)) {
                Files.createDirectories(uploadPath);
            }
            
            Path filePath = uploadPath.resolve(newFilename);
            file.transferTo(filePath.toFile());
            
            // 기존 프로필 이미지 파일 삭제 로직
            MemberResponseDTO.MyPage myPage = memberService.getMyPage(authentication.getName());
            String oldImageUrl = myPage.getProfileImageUrl();
            if (oldImageUrl != null && oldImageUrl.startsWith("/uploads/profile/")) {
                String oldFilename = oldImageUrl.substring("/uploads/profile/".length());
                Path oldFilePath = uploadPath.resolve(oldFilename);
                try {
                    Files.deleteIfExists(oldFilePath);
                } catch (Exception ignored) {
                    // 삭제 실패 시 무시 (예: 파일이 이미 없는 경우)
                }
            }
            
            String imageUrl = "/uploads/profile/" + newFilename;
            memberService.updateProfileImage(authentication.getName(), imageUrl);
            
            return ResponseEntity.ok(Map.of("imageUrl", imageUrl));
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(500).body(Map.of("message", "오류: " + e.getMessage()));
        }
    }
}
