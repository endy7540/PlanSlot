package com.example.planslot.groupchat.repository;

import com.example.planslot.groupchat.entity.ChatMessage;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ChatMessageRepository extends JpaRepository<ChatMessage, Long> {
    @EntityGraph(attributePaths = {"sender"})
    List<ChatMessage> findByGroupChatRoom_IdOrderByCreatedAtAsc(Long groupChatRoomId);
    
    ChatMessage findTopByGroupChatRoom_Group_IdOrderByCreatedAtDesc(Long groupId);
    
    void deleteByGroupChatRoom_Id(Long groupChatRoomId);
}
