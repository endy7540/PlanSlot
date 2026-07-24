package com.example.planslot.groupchat.service;

import com.example.planslot.groupchat.dto.ChatMessageDTO;
import java.util.List;

public interface GroupChatService {
    // 채팅 메시지 저장
    ChatMessageDTO saveMessage(ChatMessageDTO messageDTO);
    
    // 특정 방의 과거 채팅 내역 조회
    List<ChatMessageDTO> getChatHistory(Long groupId);
}
