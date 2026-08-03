package com.example.planslot.groupchat.controller;

import com.example.planslot.group.service.GroupService;
import com.example.planslot.group.dto.GroupDTO;
import org.springframework.security.core.Authentication;
import com.example.planslot.member.repository.MemberRepository;
import com.example.planslot.groupchat.service.GroupChatService;
import com.example.planslot.groupchat.dto.ChatMessageDTO;
import com.example.planslot.group.repository.GroupMemberRepository;
import com.example.planslot.group.entity.GroupMember;
import com.example.planslot.group.entity.GroupMemberStatus;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.SimpMessageSendingOperations;
import com.example.planslot.groupchat.service.GroupChatAiService;
import com.example.planslot.groupchat.dto.GroupChatAiDTO;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseBody;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.http.ResponseEntity;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import com.example.planslot.groupchat.repository.GroupReportRepository;
import com.example.planslot.groupchat.dto.GroupReportDTO;

@Controller
@RequestMapping("/groupChat")
@RequiredArgsConstructor
public class GroupChatController {

    private final GroupService groupService;
    private final MemberRepository memberRepository;
    private final GroupChatService groupChatService;
    private final GroupMemberRepository groupMemberRepository;
    private final SimpMessageSendingOperations messagingTemplate;
    private final GroupChatAiService groupChatAiService;
    private final GroupReportRepository groupReportRepository;

    private Long getAuthenticatedMemberId(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) {
            throw new IllegalStateException("인증되지 않은 사용자입니다.");
        }
        return memberRepository.findByEmail(authentication.getName())
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 회원입니다."))
                .getId();
    }

    // 1. 채팅방 목록 → 첫 번째 가입 모임 채팅방으로 리다이렉트
    @GetMapping("")
    public String chatList(Authentication authentication) {
        if (authentication != null && authentication.isAuthenticated()) {
            Long memberId = getAuthenticatedMemberId(authentication);
            List<GroupDTO.ListResponse> myGroups = groupService.getMyGroups(memberId).stream()
                    .filter(g -> "joined".equals(g.filter()))
                    .collect(Collectors.toList());
            if (!myGroups.isEmpty()) {
                return "redirect:/groupChat/" + myGroups.get(0).id();
            }
        }
        return "redirect:/group";
    }

    // 2. 개별 채팅방 뷰
    @GetMapping("/{groupId}")
    public String chatRoom(@PathVariable Long groupId, Authentication authentication, Model model) {
        Long memberId = getAuthenticatedMemberId(authentication);
        
        GroupMember myMembership = groupMemberRepository.findByGroup_IdAndMember_Id(groupId, memberId)
                .orElseThrow(() -> new IllegalArgumentException("모임에 가입되어 있지 않습니다."));
        if (myMembership.getMemberStatus() != GroupMemberStatus.ACTIVE) {
            throw new IllegalArgumentException("활성 모임원만 채팅방에 입장할 수 있습니다.");
        }
        
        // 채팅방 진입 시 안 읽은 메시지 수 초기화
        groupChatService.clearUnreadChatCount(groupId, memberId);
        
        GroupDTO.DetailResponse groupDetail = groupService.getGroupRead(groupId, memberId);
        List<GroupDTO.ListResponse> myGroups = groupService.getMyGroups(memberId).stream()
                .filter(g -> "joined".equals(g.filter()))
                .collect(Collectors.toList());
        List<ChatMessageDTO> chatHistory = groupChatService.getChatHistory(groupId);
        List<Long> reportedMessageIds = groupReportRepository.findReportedMessageIds(groupId, memberId);
        
        model.addAttribute("group", groupDetail);
        model.addAttribute("myGroups", myGroups);
        model.addAttribute("groupId", groupId);
        model.addAttribute("myMemberId", memberId);
        model.addAttribute("chatHistory", chatHistory);
        model.addAttribute("reportedMessageIds", reportedMessageIds);
        return "groupChat/chatRoom";
    }

    // 3. 채팅 메시지 신고 API
    @PostMapping("/{groupId}/report")
    @ResponseBody
    public ResponseEntity<String> reportMessage(
            @PathVariable Long groupId, 
            @RequestBody GroupReportDTO.Request request, 
            Authentication authentication) {
        try {
            Long memberId = getAuthenticatedMemberId(authentication);
            
            // 권한 확인 (활성 모임원인지)
            GroupMember myMembership = groupMemberRepository.findByGroup_IdAndMember_Id(groupId, memberId)
                    .orElseThrow(() -> new IllegalArgumentException("모임에 가입되어 있지 않습니다."));
            if (myMembership.getMemberStatus() != GroupMemberStatus.ACTIVE) {
                throw new IllegalArgumentException("활성 모임원만 신고할 수 있습니다.");
            }
            
            groupChatService.reportMessage(memberId, request);
            return ResponseEntity.ok("신고가 정상적으로 접수되었습니다.");
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    // 4. 중복 신고 확인 API
    @GetMapping("/{groupId}/report/check")
    @ResponseBody
    public ResponseEntity<Boolean> checkDuplicateReport(
            @PathVariable Long groupId,
            @RequestParam Long messageId,
            Authentication authentication) {
        Long memberId = getAuthenticatedMemberId(authentication);
        boolean exists = groupChatService.checkDuplicateReport(memberId, messageId);
        return ResponseEntity.ok(exists);
    }

    // 5. 비동기 AI 요약 트리거 API
    @PostMapping("/{groupId}/ai-summary/async")
    @ResponseBody
    public ResponseEntity<?> startAiSummaryAsync(
            @PathVariable Long groupId, 
            @RequestParam(defaultValue = "0") int offset,
            Authentication authentication) {
        Long memberId = getAuthenticatedMemberId(authentication);
        GroupMember myMembership = groupMemberRepository.findByGroup_IdAndMember_Id(groupId, memberId)
                .orElseThrow(() -> new IllegalArgumentException("모임에 가입되어 있지 않습니다."));
        if (myMembership.getMemberStatus() != GroupMemberStatus.ACTIVE) {
            return ResponseEntity.status(403).body("활성 모임원만 이용할 수 있습니다.");
        }

        try {
            String jobId = groupChatAiService.startSummarizeChatJob(groupId, offset);
            return ResponseEntity.ok(Map.of("jobId", jobId));
        } catch (Exception e) {
            return ResponseEntity.status(500).body("AI 요약 작업 시작 중 오류 발생: " + e.getMessage());
        }
    }

    // 5. AI 요약 상태 확인 API
    @GetMapping("/{groupId}/ai-summary/status/{jobId}")
    @ResponseBody
    public ResponseEntity<?> getAiSummaryStatus(@PathVariable Long groupId, @PathVariable String jobId, Authentication authentication) {
        Long memberId = getAuthenticatedMemberId(authentication);
        GroupMember myMembership = groupMemberRepository.findByGroup_IdAndMember_Id(groupId, memberId)
                .orElseThrow(() -> new IllegalArgumentException("모임에 가입되어 있지 않습니다."));
        if (myMembership.getMemberStatus() != GroupMemberStatus.ACTIVE) {
            return ResponseEntity.status(403).body("활성 모임원만 이용할 수 있습니다.");
        }
        
        GroupChatAiService.ChatAiJob job = groupChatAiService.getJobStatus(jobId);
        if (job == null) {
            return ResponseEntity.status(404).body(Map.of("error", "작업을 찾을 수 없습니다."));
        }
        
        if ("PROCESSING".equals(job.status)) {
            return ResponseEntity.ok(Map.of("status", "PROCESSING"));
        } else if ("COMPLETED".equals(job.status)) {
            return ResponseEntity.ok(Map.of("status", "COMPLETED", "result", job.result));
        } else {
            return ResponseEntity.ok(Map.of("status", "FAILED", "error", job.error));
        }
    }

    // 4. 채팅 읽음 처리 API (클라이언트에서 채팅방 활성화 시 호출)
    @PostMapping("/{groupId}/read")
    @ResponseBody
    public ResponseEntity<Void> markAsRead(@PathVariable Long groupId, Authentication authentication) {
        Long memberId = getAuthenticatedMemberId(authentication);
        groupChatService.clearUnreadChatCount(groupId, memberId);
        return ResponseEntity.ok().build();
    }

    // ======== [WebSocket Message Endpoints] ========

    @MessageMapping("/chat/message")
    public void message(ChatMessageDTO message, java.security.Principal principal) {
        if (principal == null) {
            throw new IllegalArgumentException("인증되지 않은 사용자입니다.");
        }
        
        // STOMP CONNECT 시점에 주입해둔 Authentication 활용
        Authentication authentication = (Authentication) principal;
        Long realMemberId = getAuthenticatedMemberId(authentication);
        // 송신자 위조 방지를 위해 서버에서 확인한 실제 회원 ID로 덮어쓰기
        message.setSenderId(realMemberId);

        // 메시지 타입에 따른 처리 (입장 메시지 등)
        if (ChatMessageDTO.MessageType.ENTER.equals(message.getType())) {
            message.setContent(message.getSenderName() + "님이 입장하셨습니다.");
        }
        
        // DB 저장
        message = groupChatService.saveMessage(message);
        
        // /sub/chat/room/{groupId} 구독자들에게 메시지 뿌리기
        messagingTemplate.convertAndSend("/sub/chat/room/" + message.getGroupId(), message);
    }

    @MessageMapping("/chat/message/update")
    public void updateMessage(ChatMessageDTO message, java.security.Principal principal) {
        if (principal == null) throw new IllegalArgumentException("인증되지 않은 사용자입니다.");
        Long realMemberId = getAuthenticatedMemberId((Authentication) principal);
        groupChatService.updateMessage(realMemberId, message.getId(), message.getContent());
        
        message.setType(ChatMessageDTO.MessageType.UPDATE);
        message.setIsEdited(true);
        messagingTemplate.convertAndSend("/sub/chat/room/" + message.getGroupId(), message);
    }

    @MessageMapping("/chat/message/delete")
    public void deleteMessage(ChatMessageDTO message, java.security.Principal principal) {
        if (principal == null) throw new IllegalArgumentException("인증되지 않은 사용자입니다.");
        Long realMemberId = getAuthenticatedMemberId((Authentication) principal);
        groupChatService.deleteMessage(realMemberId, message.getId());
        
        message.setType(ChatMessageDTO.MessageType.DELETE);
        message.setContent("삭제된 메시지입니다.");
        messagingTemplate.convertAndSend("/sub/chat/room/" + message.getGroupId(), message);
    }
}
