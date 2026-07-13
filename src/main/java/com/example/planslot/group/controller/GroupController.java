package com.example.planslot.group.controller;

import com.example.planslot.group.dto.GroupDTO;
import com.example.planslot.group.service.GroupService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Map;

@Controller
@RequestMapping("/group")
@RequiredArgsConstructor
public class GroupController {

    private final GroupService groupService;

    // 목록 조회 화면 반환
    @GetMapping("/list")
    public String groupList() {
        return "group/group-list";
    }

    // 모임 상세 화면 반환
    @GetMapping("/detail")
    public String groupDetail() {
        return "group/group-detail";
    }

    // AI 추천 화면 반환
    @GetMapping("/recommend")
    public String groupRecommend() {
        return "group/ai-recommend";
    }

    // 모임 생성 화면 반환
    @GetMapping("/register")
    public String groupRegister() {
        return "group/group-register";
    }

    // 모임 생성 요청 처리
    @PostMapping("/register")
    public ResponseEntity<GroupDTO.Response> registerGroup(
            @Valid @RequestBody GroupDTO.CreateRequest request
    ) {
        Long memberId = 1L; // 임시 하드코딩
        GroupDTO.Response response = groupService.createGroup(memberId, request);

        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(response);
    }

    // 내 모임 목록 조회 API
    @GetMapping("/api/my")
    @ResponseBody
    public ResponseEntity<List<GroupDTO.ListResponse>> getMyGroups() {
        Long memberId = 1L; // TODO: Security/Session 정보로 교체
        List<GroupDTO.ListResponse> responses = groupService.getMyGroups(memberId);
        return ResponseEntity.ok(responses);
    }

    // 모임 상세 정보 조회 API
    @GetMapping("/api/detail/{id}")
    @ResponseBody
    public ResponseEntity<GroupDTO.DetailResponse> getGroupDetail(@PathVariable("id") Long groupId) {
        Long memberId = 1L; // TODO: Security/Session 정보로 교체
        GroupDTO.DetailResponse response = groupService.getGroupDetail(groupId, memberId);
        return ResponseEntity.ok(response);
    }

    // 모임 이름 수정 API
    @PatchMapping("/api/detail/{id}/name")
    @ResponseBody
    public ResponseEntity<Void> updateGroupName(@PathVariable("id") Long groupId, @RequestBody Map<String, String> body) {
        Long memberId = 1L; // TODO
        groupService.updateGroupName(groupId, body.get("name"), memberId);
        return ResponseEntity.ok().build();
    }

    // 모임 삭제 API
    @DeleteMapping("/api/detail/{id}")
    @ResponseBody
    public ResponseEntity<Void> deleteGroup(@PathVariable("id") Long groupId) {
        Long memberId = 1L;
        groupService.deleteGroup(groupId, memberId);
        return ResponseEntity.ok().build();
    }

    // 모임 탈퇴 API
    @DeleteMapping("/api/detail/{id}/leave")
    @ResponseBody
    public ResponseEntity<Void> leaveGroup(@PathVariable("id") Long groupId) {
        Long memberId = 1L;
        groupService.leaveGroup(groupId, memberId);
        return ResponseEntity.ok().build();
    }

    // 모임원 추방 API
    @DeleteMapping("/api/detail/{id}/kick/{targetId}")
    @ResponseBody
    public ResponseEntity<Void> kickMember(@PathVariable("id") Long groupId, @PathVariable("targetId") Long targetId) {
        Long memberId = 1L;
        groupService.kickMember(groupId, targetId, memberId);
        return ResponseEntity.ok().build();
    }

    // 모임 초대 API
    @PostMapping("/api/detail/{id}/invite")
    @ResponseBody
    public ResponseEntity<Void> inviteMember(@PathVariable("id") Long groupId, @RequestBody Map<String, String> body) {
        Long memberId = 1L;
        groupService.inviteMember(groupId, body.get("email"), memberId);
        return ResponseEntity.ok().build();
    }

    // 초대 수락 API
    @PostMapping("/api/detail/{id}/accept")
    @ResponseBody
    public ResponseEntity<Void> acceptInvite(@PathVariable("id") Long groupId) {
        Long memberId = 1L;
        groupService.acceptInvite(groupId, memberId);
        return ResponseEntity.ok().build();
    }

    // 초대 거절 API
    @PostMapping("/api/detail/{id}/reject")
    @ResponseBody
    public ResponseEntity<Void> rejectInvite(@PathVariable("id") Long groupId) {
        Long memberId = 1L;
        groupService.rejectInvite(groupId, memberId);
        return ResponseEntity.ok().build();
    }
}
