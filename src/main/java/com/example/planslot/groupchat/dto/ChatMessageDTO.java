package com.example.planslot.groupchat.dto;

import com.example.planslot.groupchat.entity.ChatMessage;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ChatMessageDTO {
    
    // 메시지 종류: 입장(ENTER), 일반 메시지(TALK)
    public enum MessageType {
        ENTER, LEAVE, TALK, UPDATE, DELETE
    }

    private MessageType type; // 메시지 타입
    private Long id;          // 메시지 고유 식별자 (DB PK)
    private Long groupId;     // 채팅방 식별자 (모임 ID)
    private Long senderId;    // 보내는 사람 ID
    private String senderName;// 보내는 사람 이름
    private String content;   // 메시지 내용
    private LocalDateTime createdAt;
    private Boolean isEdited; // 수정 여부

    public static ChatMessageDTO from(ChatMessage message) {
        return from(message, message.getSender().getDisplayName());
    }

    public static ChatMessageDTO from(ChatMessage message, String senderName) {
        return ChatMessageDTO.builder()
                .id(message.getId())
                .type(message.getType() != null ? message.getType() : MessageType.TALK)
                .groupId(message.getGroupChatRoom().getGroup().getId())
                .senderId(message.getSender().getId())
                .senderName(senderName)
                .content(message.getContent())
                .createdAt(message.getCreatedAt())
                .isEdited(message.isEdited())
                .build();
    }
}
