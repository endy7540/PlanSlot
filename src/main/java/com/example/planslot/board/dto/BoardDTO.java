package com.example.planslot.board.dto;

import com.example.planslot.board.entity.BoardStatus;
import com.example.planslot.board.entity.BoardType;
import lombok.*;

import java.time.LocalDateTime;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BoardDTO {
    private Long boardId;
    private Long writerId;
    private String writerNickname;
    private String title;
    private String content;
    private int viewCount;
    private BoardType boardType;
    private BoardStatus boardStatus;
    private BoardImageDTO boardImage;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}