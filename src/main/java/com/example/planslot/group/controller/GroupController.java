package com.example.planslot.group.controller;

import com.example.planslot.group.dto.GroupDTO;
import com.example.planslot.group.service.GroupService;
import com.example.planslot.member.repository.MemberRepository;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Controller
@RequestMapping("/group")
@RequiredArgsConstructor
public class GroupController {

    private final GroupService groupService;
    private final com.example.planslot.group.service.GroupRecommendationService groupRecommendationService;
    private final MemberRepository memberRepository;

    private Long getAuthenticatedMemberId(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) {
            throw new IllegalStateException("인증되지 않은 사용자입니다.");
        }
        return memberRepository.findByEmail(authentication.getName())
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 회원입니다."))
                .getId();
    }

    // 목록 조회 화면 반환
    @GetMapping(value = {"", "/list"})
    public String groupList() {
        return "group/group-list";
    }

    // 모임 상세 화면 반환
    @GetMapping("/read")
    public String groupDetail() {
        return "group/group-read";
    }

    // AI 추천 화면 반환
    @GetMapping("/recommend")
    public String groupRecommend() {
        return "group/ai-recommend";
    }


    // AI 추천 데이터 API
    @GetMapping("/{groupId}/ai-recommendations")
    @ResponseBody
    public ResponseEntity<GroupDTO.AiResponse> getAiRecommendations(
            @PathVariable Long groupId,
            @RequestParam(defaultValue = "SHORT_MEETING") String type,
            @RequestParam(required = false) String startDate,
            @RequestParam(required = false) String endDate,
            Authentication authentication) {
        Long memberId = getAuthenticatedMemberId(authentication);
        return ResponseEntity.ok(groupRecommendationService.getRecommendations(groupId, memberId, type, startDate, endDate));
    }

    // 모임 생성 요청 처리
    @PostMapping(value = "/register", consumes = "multipart/form-data")
    public ResponseEntity<GroupDTO.Response> registerGroup(
            @RequestParam("groupName") String groupName,
            @RequestParam(value = "file", required = false) org.springframework.web.multipart.MultipartFile file,
            Authentication authentication
    ) {
        if (groupName == null || groupName.trim().isEmpty() || groupName.length() > 30) {
            return ResponseEntity.badRequest().build();
        }

        Long memberId = getAuthenticatedMemberId(authentication);
        GroupDTO.CreateRequest request = new GroupDTO.CreateRequest(groupName.trim());
        GroupDTO.Response response = groupService.createGroup(memberId, request);

        if (file != null && !file.isEmpty()) {
            try {
                String originalFilename = file.getOriginalFilename();
                String extension = ".jpg";
                if (originalFilename != null && originalFilename.contains(".")) {
                    extension = originalFilename.substring(originalFilename.lastIndexOf(".")).toLowerCase();
                }
                String newFilename = java.util.UUID.randomUUID().toString() + extension;
                
                java.nio.file.Path uploadPath = java.nio.file.Paths.get(System.getProperty("user.dir"), "uploads", "group");
                if (!java.nio.file.Files.exists(uploadPath)) {
                    java.nio.file.Files.createDirectories(uploadPath);
                }
                
                java.nio.file.Path filePath = uploadPath.resolve(newFilename);
                file.transferTo(filePath.toFile());
                String imageUrl = "/uploads/group/" + newFilename;
                
                groupService.updateGroupProfileImage(response.groupId(), imageUrl, memberId);
            } catch (Exception e) {
                e.printStackTrace();
            }
        }

        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(response);
    }

    // 내 모임 목록 조회
    @GetMapping("/mygroup")
    @ResponseBody
    public ResponseEntity<List<GroupDTO.ListResponse>> getMyGroups(Authentication authentication) {
        Long memberId = getAuthenticatedMemberId(authentication);
        List<GroupDTO.ListResponse> responses = groupService.getMyGroups(memberId);
        return ResponseEntity.ok(responses);
    }

    // 모임 상세 정보 조회
    @GetMapping("/read/{groupId}")
    @ResponseBody
    public ResponseEntity<GroupDTO.DetailResponse> getGroupDetail(@PathVariable("groupId") Long groupId, Authentication authentication) {
        Long memberId = getAuthenticatedMemberId(authentication);
        GroupDTO.DetailResponse response = groupService.getGroupRead(groupId, memberId);
        return ResponseEntity.ok(response);
    }

    // 모임 이름 수정
    @PutMapping("/{groupId}")
    @ResponseBody
    public ResponseEntity<Void> updateGroupName(@PathVariable("groupId") Long groupId, @RequestBody Map<String, String> body, Authentication authentication) {
        Long memberId = getAuthenticatedMemberId(authentication);
        groupService.updateGroupName(groupId, body.get("name"), memberId);
        return ResponseEntity.ok().build();
    }

    // 모임 삭제
    @DeleteMapping("/{groupId}")
    @ResponseBody
    public ResponseEntity<Void> deleteGroup(@PathVariable("groupId") Long groupId, Authentication authentication) {
        Long memberId = getAuthenticatedMemberId(authentication);
        groupService.deleteGroup(groupId, memberId);
        return ResponseEntity.ok().build();
    }

    // 모임 탈퇴
    @DeleteMapping("/{groupId}/leave")
    @ResponseBody
    public ResponseEntity<Void> leaveGroup(
            @PathVariable("groupId") Long groupId, 
            @RequestParam(value = "newOwnerId", required = false) Long newOwnerId,
            Authentication authentication) {
        Long memberId = getAuthenticatedMemberId(authentication);
        groupService.leaveGroup(groupId, memberId, newOwnerId);
        return ResponseEntity.ok().build();
    }

    // 모임원 추방
    @DeleteMapping("/{groupId}/member/{targetMemberId}")
    @ResponseBody
    public ResponseEntity<Void> kickMember(
            @PathVariable("groupId") Long groupId, 
            @PathVariable("targetMemberId") Long targetMemberId,
            Authentication authentication) {
        Long memberId = getAuthenticatedMemberId(authentication);
        groupService.kickMember(groupId, targetMemberId, memberId);
        return ResponseEntity.ok().build();
    }

    // 모임 초대
    @PostMapping("/{groupId}/invitation")
    @ResponseBody
    public ResponseEntity<Void> inviteMember(@PathVariable("groupId") Long groupId, @RequestBody Map<String, String> body, Authentication authentication) {
        Long memberId = getAuthenticatedMemberId(authentication);
        groupService.inviteMember(groupId, body.get("nickname"), memberId);
        return ResponseEntity.ok().build();
    }

    // 초대 수락/거절
    @PatchMapping("/{groupId}/invitation/{invitationId}")
    @ResponseBody
    public ResponseEntity<Void> handleInvitation(
            @PathVariable("groupId") Long groupId,
            @PathVariable("invitationId") Long invitationId,
            @RequestBody Map<String, String> body,
            Authentication authentication) {
        Long memberId = getAuthenticatedMemberId(authentication);
        String action = body.get("action"); // "ACCEPT" 또는 "REJECT" 로 전송
        if ("ACCEPT".equalsIgnoreCase(action)) {
            groupService.acceptInvite(groupId, memberId); // TODO: 추후 invitationId 검증 로직 추가 필요
        } else if ("REJECT".equalsIgnoreCase(action)) {
            groupService.rejectInvite(groupId, memberId);
        }
        return ResponseEntity.ok().build();
    }

    // 자신 닉네임 수정
    @PatchMapping("/{groupId}/nickname")
    @ResponseBody
    public ResponseEntity<Void> updateMyNickname(
            @PathVariable("groupId") Long groupId, 
            @RequestBody Map<String, String> body,
            Authentication authentication) {
        Long memberId = getAuthenticatedMemberId(authentication);
        // groupService.updateMyNickname(groupId, memberId, body.get("nickname"));
        return ResponseEntity.ok().build(); // TODO: Service 계층에 메서드 구현 필요
    }

    // 타인 닉네임 수정
    @PatchMapping("/{groupId}/member/{targetMemberId}/displayName")
    @ResponseBody
    public ResponseEntity<Void> updateMemberDisplayName(
            @PathVariable("groupId") Long groupId,
            @PathVariable("targetMemberId") Long targetMemberId,
            @RequestBody Map<String, String> body,
            Authentication authentication) {
        Long memberId = getAuthenticatedMemberId(authentication);
        return ResponseEntity.ok().build(); // TODO: Service 계층에 메서드 구현 필요
    }

    // 닉네임 검색 (초대 시 자동완성 용도)
    @GetMapping("/search-nickname")
    @ResponseBody
    public ResponseEntity<List<String>> searchNickname(@RequestParam("prefix") String prefix) {
        List<String> nicknames = memberRepository.findAll().stream()
                .map(member -> member.getNickname())
                .filter(nickname -> nickname != null && nickname.toLowerCase().startsWith(prefix.toLowerCase()))
                .limit(5)
                .toList();
        return ResponseEntity.ok(nicknames);
    }

    // 모임 캘린더에 일정 추가 및 공유
    @PostMapping("/{groupId}/schedules")
    @ResponseBody
    public ResponseEntity<Void> addGroupSchedule(
            @PathVariable("groupId") Long groupId,
            @RequestBody Map<String, String> body,
            Authentication authentication) {
        Long memberId = getAuthenticatedMemberId(authentication);
        groupService.addGroupSchedule(groupId, memberId, body.get("title"), body.get("date"), body.get("time"), body.get("visibility"), body.get("endDate"), body.get("endTime"));
        return ResponseEntity.ok().build();
    }

    // 모임 캘린더용 일정 전체 조회
    @GetMapping("/{groupId}/schedules")
    @ResponseBody
    public ResponseEntity<List<GroupDTO.CalendarScheduleInfo>> getGroupSchedules(
            @PathVariable("groupId") Long groupId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime start,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime end,
            Authentication authentication) {
        Long memberId = getAuthenticatedMemberId(authentication);
        List<GroupDTO.CalendarScheduleInfo> schedules = groupService.getGroupSchedules(groupId, memberId, start, end);
        return ResponseEntity.ok(schedules);
    }
    // 타인에게 내 일정 공유하기
    @PostMapping("/{groupId}/peer-schedules")
    @ResponseBody
    public ResponseEntity<Void> shareSchedulesWithPeers(
            @PathVariable("groupId") Long groupId,
            @RequestBody Map<String, Object> body,
            Authentication authentication) {
        Long memberId = getAuthenticatedMemberId(authentication);
        List<Integer> scheduleIdsInt = (List<Integer>) body.get("scheduleIds");
        List<Integer> targetMemberIdsInt = (List<Integer>) body.get("targetMemberIds");
        
        List<Long> scheduleIds = scheduleIdsInt.stream().map(Integer::longValue).toList();
        List<Long> targetMemberIds = targetMemberIdsInt.stream().map(Integer::longValue).toList();
        
        groupService.shareSchedulesWithPeers(groupId, memberId, scheduleIds, targetMemberIds);
        return ResponseEntity.ok().build();
    }

    // 나에게 공유된 타인의 일정 조회
    @GetMapping("/{groupId}/peer-schedules")
    @ResponseBody
    public ResponseEntity<List<GroupDTO.SharedPeerSchedule>> getSharedPeerSchedules(
            @PathVariable("groupId") Long groupId,
            Authentication authentication) {
        Long memberId = getAuthenticatedMemberId(authentication);
        List<GroupDTO.SharedPeerSchedule> schedules = groupService.getSharedPeerSchedules(groupId, memberId);
        return ResponseEntity.ok(schedules);
    }

    // 내가 타인에게 공유한 일정 조회
    @GetMapping("/{groupId}/my-shared-schedules")
    @ResponseBody
    public ResponseEntity<List<GroupDTO.SharedPeerSchedule>> getSchedulesSharedByMe(
            @PathVariable("groupId") Long groupId,
            Authentication authentication) {
        Long memberId = getAuthenticatedMemberId(authentication);
        List<GroupDTO.SharedPeerSchedule> schedules = groupService.getSchedulesSharedByMe(groupId, memberId);
        return ResponseEntity.ok(schedules);
    }

    // 내가 공유한 일정 공유 중지(삭제)
    @DeleteMapping("/{groupId}/peer-schedules/{shareId}")
    @ResponseBody
    public ResponseEntity<Void> deleteSharedPeerSchedule(
            @PathVariable("groupId") Long groupId,
            @PathVariable("shareId") Long shareId,
            Authentication authentication) {
        Long memberId = getAuthenticatedMemberId(authentication);
        groupService.deleteSharedPeerSchedule(shareId, memberId);
        return ResponseEntity.ok().build();
    }

    // 공유된 타인의 일정 내 캘린더로 가져오기
    @PostMapping("/{groupId}/peer-schedules/{shareId}/import")
    @ResponseBody
    public ResponseEntity<GroupDTO.ImportResult> importSharedPeerSchedule(
            @PathVariable("groupId") Long groupId,
            @PathVariable("shareId") Long shareId,
            @RequestParam(value = "overwrite", defaultValue = "false") boolean overwrite,
            @RequestParam(value = "isPublic", defaultValue = "N") String isPublic,
            Authentication authentication) {
        Long memberId = getAuthenticatedMemberId(authentication);
        GroupDTO.ImportResult result = groupService.importSharedPeerSchedule(shareId, memberId, overwrite, isPublic);
        return ResponseEntity.ok(result);
    }
}
