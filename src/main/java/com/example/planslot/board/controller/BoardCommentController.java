package com.example.planslot.board.controller;

import com.example.planslot.board.dto.BoardCommentDTO;
import com.example.planslot.board.service.BoardCommentService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequiredArgsConstructor
public class BoardCommentController {

    private final BoardCommentService boardCommentService;

    // 댓글 및 대댓글 등록
    @PostMapping("/board/{postId}/comment")
    public ResponseEntity<Long> createComment(@PathVariable Long postId,
                                              @RequestParam Long memberId,
                                              @RequestBody BoardCommentDTO commentDTO) {
        Long commentId = boardCommentService.createComment(postId, commentDTO, memberId);

        return ResponseEntity.status(HttpStatus.CREATED).body(commentId);
    }

    // 게시글 댓글 목록 조회
    @GetMapping("/board/{postId}/comments")
    public ResponseEntity<List<BoardCommentDTO>> getCommentList(@PathVariable Long postId) {
        return ResponseEntity.ok(
                boardCommentService.getCommentList(postId)
        );
    }

    // 댓글 및 대댓글 수정
    @PutMapping("/comment/{commentId}")
    public ResponseEntity<BoardCommentDTO> updateComment(@PathVariable Long commentId,
                                                         @RequestParam Long memberId,
                                                         @RequestBody BoardCommentDTO commentDTO) {
        BoardCommentDTO updatedComment = boardCommentService.updateComment(commentId, commentDTO, memberId);

        return ResponseEntity.ok(updatedComment);
    }

    // 댓글 및 대댓글 삭제
    @DeleteMapping("/comment/{commentId}")
    public ResponseEntity<Void> deleteComment(@PathVariable Long commentId, @RequestParam Long memberId) {
        boardCommentService.deleteComment(commentId, memberId);

        return ResponseEntity.noContent().build();
    }
}
