package com.example.planslot.board.controller;

import com.example.planslot.board.dto.BoardCommentDTO;
import com.example.planslot.board.service.BoardCommentService;
import com.example.planslot.boardreport.dto.BoardReportRequestDTO;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.security.Principal;
import java.util.List;

@RestController
@RequiredArgsConstructor
public class BoardCommentController {

    private final BoardCommentService boardCommentService;

    // 댓글 및 대댓글 등록
    @PostMapping("/board/{boardId}/comment")
    public ResponseEntity<Long> createComment(@PathVariable Long boardId,
                                              @RequestBody BoardCommentDTO commentDTO,
                                              Principal principal) {
        Long commentId = boardCommentService.createComment(boardId, commentDTO, getLoginEmail(principal));

        return ResponseEntity.status(HttpStatus.CREATED).body(commentId);
    }

    // 게시글 댓글 목록 조회
    @GetMapping("/board/{boardId}/comments")
    public ResponseEntity<List<BoardCommentDTO>> getCommentList(@PathVariable Long boardId) {
        return ResponseEntity.ok(boardCommentService.getCommentList(boardId));
    }

    // 댓글 및 대댓글 수정
    @PutMapping("/board/comment/{commentId}")
    public ResponseEntity<BoardCommentDTO> updateComment(@PathVariable Long commentId,
                                                         @RequestBody BoardCommentDTO commentDTO,
                                                         Principal principal) {
        BoardCommentDTO updatedComment =
                boardCommentService.updateComment(commentId, commentDTO, getLoginEmail(principal));

        return ResponseEntity.ok(updatedComment);
    }

    // 댓글 및 대댓글 삭제
    @DeleteMapping("/board/comment/{commentId}")
    public ResponseEntity<Void> deleteComment(@PathVariable Long commentId, Principal principal) {
        boardCommentService.deleteComment(commentId, getLoginEmail(principal));

        return ResponseEntity.noContent().build();
    }

    // 댓글 및 대댓글 신고
    @PostMapping("/board/comment/{commentId}/report")
    public ResponseEntity<Long> reportComment(@PathVariable Long commentId,
                                              @RequestBody BoardReportRequestDTO reportRequestDTO,
                                              Principal principal) {
        Long reportId = boardCommentService.reportComment(commentId, reportRequestDTO, getLoginEmail(principal));

        return ResponseEntity.status(HttpStatus.CREATED).body(reportId);
    }

    // 로그인 이메일 조회
    private String getLoginEmail(Principal principal) {
        if (principal == null || principal.getName() == null || principal.getName().isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "로그인이 필요합니다.");
        }

        return principal.getName();
    }
}
