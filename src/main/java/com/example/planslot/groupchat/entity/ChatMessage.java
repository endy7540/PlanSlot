package com.example.planslot.groupchat.entity;

import com.example.planslot.member.entity.Member;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.LocalDateTime;

@Entity
@Table(name = "chat_message")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@EntityListeners(AuditingEntityListener.class)
public class ChatMessage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "chat_message_id")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "group_chat_room_id", nullable = false)
    private GroupChatRoom groupChatRoom;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "sender_id", nullable = false)
    private Member sender;

    @Column(name = "content", nullable = false, columnDefinition = "TEXT")
    private String content;

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "is_deleted", nullable = false)
    private boolean isDeleted = false;

    @Column(name = "is_edited", nullable = false)
    private boolean isEdited = false;

    @Enumerated(EnumType.STRING)
    @Column(name = "message_type", length = 20)
    private com.example.planslot.groupchat.dto.ChatMessageDTO.MessageType type;

    @Builder
    public ChatMessage(GroupChatRoom groupChatRoom, Member sender, String content, com.example.planslot.groupchat.dto.ChatMessageDTO.MessageType type) {
        this.groupChatRoom = groupChatRoom;
        this.sender = sender;
        this.content = content;
        this.type = type != null ? type : com.example.planslot.groupchat.dto.ChatMessageDTO.MessageType.TALK;
    }

    public void updateContent(String newContent) {
        this.content = newContent;
        this.isEdited = true;
    }

    public void markAsDeleted() {
        this.isDeleted = true;
        this.isEdited = false;
        this.content = "삭제된 메시지입니다.";
    }

    public void delete() {
        this.isDeleted = true;
        this.isEdited = false;
        this.content = "관리자에 의해 삭제된 메시지입니다.";
    }
}
