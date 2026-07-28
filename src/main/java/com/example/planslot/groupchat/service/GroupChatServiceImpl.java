package com.example.planslot.groupchat.service;

import com.example.planslot.groupchat.dto.ChatMessageDTO;
import com.example.planslot.groupchat.entity.ChatMessage;
import com.example.planslot.groupchat.entity.GroupChatRoom;
import com.example.planslot.groupchat.repository.ChatMessageRepository;
import com.example.planslot.groupchat.repository.GroupChatRoomRepository;
import com.example.planslot.member.entity.Member;
import com.example.planslot.member.repository.MemberRepository;
import com.example.planslot.groupchat.entity.GroupReport;
import com.example.planslot.groupchat.repository.GroupReportRepository;
import com.example.planslot.group.entity.ReportStatus;
import com.example.planslot.group.repository.GroupMemberRepository;
import com.example.planslot.group.entity.GroupMember;
import com.example.planslot.group.entity.GroupMemberStatus;
import com.example.planslot.notification.service.NotificationService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class GroupChatServiceImpl implements GroupChatService {

    private final ChatMessageRepository chatMessageRepository;
    private final GroupChatRoomRepository groupChatRoomRepository;
    private final MemberRepository memberRepository;
    private final com.example.planslot.group.repository.GroupRepository groupRepository;
    private final GroupReportRepository groupReportRepository;
    private final GroupMemberRepository groupMemberRepository;
    private final NotificationService notificationService;

    @Override
    @Transactional
    public ChatMessageDTO saveMessage(ChatMessageDTO messageDTO) {
        GroupChatRoom chatRoom = groupChatRoomRepository.findByGroup_Id(messageDTO.getGroupId())
                .orElseGet(() -> {
                    com.example.planslot.group.entity.Group group = groupRepository.findById(messageDTO.getGroupId())
                            .orElseThrow(() -> new IllegalArgumentException("모임을 찾을 수 없습니다."));
                    GroupChatRoom newRoom = GroupChatRoom.builder().group(group).build();
                    return groupChatRoomRepository.save(newRoom);
                });

        Member sender = memberRepository.findById(messageDTO.getSenderId())
                .orElseThrow(() -> new IllegalArgumentException("회원을 찾을 수 없습니다."));

        ChatMessage message = ChatMessage.builder()
                .groupChatRoom(chatRoom)
                .sender(sender)
                .content(messageDTO.getContent())
                .build();

        ChatMessage savedMessage = chatMessageRepository.save(message);

        // 다른 활성 모임원들의 안 읽은 메시지 수 증가 및 알림 발송
        List<GroupMember> groupMembers = groupMemberRepository.findByGroup_Id(messageDTO.getGroupId());
        for (GroupMember gm : groupMembers) {
            if (gm.getMemberStatus() == GroupMemberStatus.ACTIVE && !gm.getMember().getId().equals(messageDTO.getSenderId())) {
                gm.incrementUnreadChatCount();
                // 알림 발송
                notificationService.sendGroupMessage(
                        gm.getMember().getId(),
                        messageDTO.getGroupId(),
                        "새 채팅 메시지",
                        chatRoom.getGroup().getGroupName() + " 방에 새 메시지가 도착했습니다.",
                        "CHAT",
                        messageDTO.getGroupId()
                );
            }
        }
        
        return ChatMessageDTO.from(savedMessage);
    }

    @Override
    @Transactional
    public List<ChatMessageDTO> getChatHistory(Long groupId) {
        GroupChatRoom chatRoom = groupChatRoomRepository.findByGroup_Id(groupId)
                .orElseGet(() -> {
                    com.example.planslot.group.entity.Group group = groupRepository.findById(groupId)
                            .orElseThrow(() -> new IllegalArgumentException("모임을 찾을 수 없습니다."));
                    GroupChatRoom newRoom = GroupChatRoom.builder().group(group).build();
                    return groupChatRoomRepository.save(newRoom);
                });

        List<ChatMessage> messages = chatMessageRepository.findByGroupChatRoom_IdOrderByCreatedAtAsc(chatRoom.getId());
        
        return messages.stream()
                .map(ChatMessageDTO::from)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional
    public void reportMessage(Long memberId, com.example.planslot.groupchat.dto.GroupReportDTO.Request request) {
        ChatMessage message = chatMessageRepository.findById(request.getMessageId())
                .orElseThrow(() -> new IllegalArgumentException("메시지를 찾을 수 없습니다."));
        Member reporter = memberRepository.findById(memberId)
                .orElseThrow(() -> new IllegalArgumentException("회원을 찾을 수 없습니다."));
        
        if (groupReportRepository.existsByMember_IdAndChatMessage_Id(memberId, request.getMessageId())) {
            throw new IllegalArgumentException("이미 신고한 게시글입니다.");
        }
        
        if (request.getReasonDetail() != null && request.getReasonDetail().length() > 200) {
            throw new IllegalArgumentException("신고 세부 사유는 200자로 제한됩니다.");
        }

        GroupReport report = GroupReport.builder()
                .group(message.getGroupChatRoom().getGroup())
                .chatMessage(message)
                .member(reporter)
                .reportedMember(message.getSender())
                .reason(request.getReason())
                .reasonDetail(request.getReasonDetail())
                .status(ReportStatus.WAITING)
                .build();
                
        groupReportRepository.save(report);
    }

    @Override
    @Transactional
    public void clearUnreadChatCount(Long groupId, Long memberId) {
        groupMemberRepository.findByGroup_IdAndMember_Id(groupId, memberId)
                .ifPresent(GroupMember::clearUnreadChatCount);
        
        // 채팅방에 들어왔으므로 연관된 시스템 알림(종 모양 알림)도 모두 읽음 처리
        notificationService.readNotificationsByTarget(memberId, "CHAT", groupId);
    }
    
    @Override
    @Transactional(readOnly = true)
    public boolean checkDuplicateReport(Long memberId, Long messageId) {
        return groupReportRepository.existsByMember_IdAndChatMessage_Id(memberId, messageId);
    }
    @Override
    @Transactional
    public void updateMessage(Long memberId, Long messageId, String content) {
        ChatMessage message = chatMessageRepository.findById(messageId)
                .orElseThrow(() -> new IllegalArgumentException("메시지를 찾을 수 없습니다."));
        if (!message.getSender().getId().equals(memberId)) {
            throw new IllegalArgumentException("자신의 메시지만 수정할 수 있습니다.");
        }
        if (message.isDeleted()) {
            throw new IllegalArgumentException("삭제된 메시지는 수정할 수 없습니다.");
        }
        message.updateContent(content);
    }

    @Override
    @Transactional
    public void deleteMessage(Long memberId, Long messageId) {
        ChatMessage message = chatMessageRepository.findById(messageId)
                .orElseThrow(() -> new IllegalArgumentException("메시지를 찾을 수 없습니다."));
        if (!message.getSender().getId().equals(memberId)) {
            throw new IllegalArgumentException("자신의 메시지만 삭제할 수 있습니다.");
        }
        message.markAsDeleted();
    }
}
