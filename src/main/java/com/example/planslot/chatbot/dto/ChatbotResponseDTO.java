package com.example.planslot.chatbot.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ChatbotResponseDTO {
    private boolean success;
    private String answer;
    private String errorCode;
    private String message;

    public static ChatbotResponseDTO success(String answer) {
        return ChatbotResponseDTO.builder().success(true).answer(answer).build();
    }

    public static ChatbotResponseDTO error(String errorCode, String message) {
        return ChatbotResponseDTO.builder().success(false).errorCode(errorCode).message(message).build();
    }
}
