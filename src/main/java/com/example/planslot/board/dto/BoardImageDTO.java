package com.example.planslot.board.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BoardImageDTO {
    private Long fileId;
    private Long boardId;
    private String fileUrl;
    private LocalDateTime createdAt;
}
