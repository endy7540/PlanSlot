package com.example.planslot.groupchat.controller;

import com.example.planslot.group.service.GroupService;
import com.example.planslot.group.dto.GroupDTO;
import org.springframework.security.core.Authentication;
import com.example.planslot.member.repository.MemberRepository;
import com.example.planslot.groupchat.service.GroupChatService;
import com.example.planslot.groupchat.dto.ChatMessageDTO;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.SimpMessageSendingOperations;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;

import java.util.List;

@Controller
@RequestMapping("/groupChat")
@RequiredArgsConstructor
public class GroupChatController {

    private final GroupService groupService;
    private final MemberRepository memberRepository;
    private final GroupChatService groupChatService;
    private final SimpMessageSendingOperations messagingTemplate;

    private Long getAuthenticatedMemberId(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) {
            throw new IllegalStateException("인증되지 않은 사용자입니다.");
        }
        return memberRepository.findByEmail(authentication.getName())
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 회원입니다."))
                .getId();
    }

    // ======== [View Rendering] ========

    // 1. 채팅방 목록 뷰
    @GetMapping("")
    public String chatList(Authentication authentication, Model model) {
        if (authentication != null && authentication.isAuthenticated()) {
            Long memberId = getAuthenticatedMemberId(authentication);
            List<GroupDTO.ListResponse> myGroups = groupService.getMyGroups(memberId);
            model.addAttribute("groups", myGroups);
        }
        return "groupChat/list";
    }

    // 2. 개별 채팅방 뷰
    @GetMapping("/{groupId}")
    public String chatRoom(@PathVariable Long groupId, Authentication authentication, Model model) {
        Long memberId = getAuthenticatedMemberId(authentication);
        // TODO: 해당 그룹의 멤버인지 검증하는 로직 필요

        List<ChatMessageDTO> chatHistory = groupChatService.getChatHistory(groupId);
        model.addAttribute("groupId", groupId);
        model.addAttribute("myMemberId", memberId);
        model.addAttribute("chatHistory", chatHistory);
        return "groupChat/chatRoom";
    }

    // ======== [WebSocket Message Endpoints] ========

    @MessageMapping("/chat/message")
    public void message(ChatMessageDTO message) {
        // 메시지 타입에 따른 처리 (입장 메시지 등)
        if (ChatMessageDTO.MessageType.ENTER.equals(message.getType())) {
            message.setContent(message.getSenderName() + "님이 입장하셨습니다.");
        } else {
            // DB 저장
            message = groupChatService.saveMessage(message);
        }
        
        // /sub/chat/room/{groupId} 구독자들에게 메시지 뿌리기
        messagingTemplate.convertAndSend("/sub/chat/room/" + message.getGroupId(), message);
    }
}
