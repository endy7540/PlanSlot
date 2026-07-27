package com.example.planslot.chatbot.service;

import com.example.planslot.chatbot.dto.ChatbotRequestDTO;
import com.example.planslot.chatbot.dto.ChatbotResponseDTO;

public interface ChatbotService {
    ChatbotResponseDTO ask(String memberKey, ChatbotRequestDTO request);
}
