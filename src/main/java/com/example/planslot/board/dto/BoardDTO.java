package com.example.planslot.board.dto;

import com.example.planslot.board.entity.BoardStatus;
import com.example.planslot.board.entity.BoardType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

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
    private long commentCount;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}