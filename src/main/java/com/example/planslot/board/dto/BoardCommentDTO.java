package com.example.planslot.board.dto;

import com.example.planslot.board.entity.BoardCommentStatus;
import lombok.*;

import java.time.LocalDateTime;
import java.util.List;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BoardCommentDTO {
    private Long commentId;
    private Long boardId;
    private Long parentCommentId;
    private Long writerId;
    private String writerNickname;
    private String content;
    private BoardCommentStatus commentStatus;
    private List<BoardCommentDTO> replies;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
