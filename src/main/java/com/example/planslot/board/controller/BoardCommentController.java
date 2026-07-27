package com.example.planslot.board.controller;

import com.example.planslot.board.dto.BoardCommentDTO;
import com.example.planslot.board.service.BoardCommentService;
import com.example.planslot.boardreport.dto.BoardReportRequestDTO;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.security.Principal;
import java.util.Map;

@RestController
@RequestMapping("/board")
@RequiredArgsConstructor
public class BoardCommentController {

    private final BoardCommentService boardCommentService;

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Map<String, String>> handleBoardCommentError(ResponseStatusException exception) {
        String message = exception.getReason();
        if (message == null || message.isBlank()) message = "요청 처리에 실패했습니다.";
        return ResponseEntity.status(exception.getStatusCode()).body(Map.of("message", message));
    }

    // 댓글 및 대댓글 등록
    @PostMapping("/{boardId}/comment")
    public ResponseEntity<Long> createComment(@PathVariable Long boardId,
                                              @RequestBody BoardCommentDTO commentDTO,
                                              Principal principal) {
        Long commentId = boardCommentService.createComment(boardId, commentDTO, getLoginEmail(principal));

        return ResponseEntity.status(HttpStatus.CREATED).body(commentId);
    }

    // 게시글 부모 댓글 페이징 조회 및 대댓글 함께 조회
    @GetMapping("/{boardId}/comments")
    public ResponseEntity<Page<BoardCommentDTO>> getCommentList(@PathVariable Long boardId,
                                                                 @PageableDefault(size = 10) Pageable pageable) {
        return ResponseEntity.ok(boardCommentService.getCommentList(boardId, pageable));
    }

    // 댓글 및 대댓글 수정
    @PutMapping("/comment/{commentId}")
    public ResponseEntity<BoardCommentDTO> updateComment(@PathVariable Long commentId,
                                                         @RequestBody BoardCommentDTO commentDTO,
                                                         Principal principal) {
        BoardCommentDTO updatedComment =
                boardCommentService.updateComment(commentId, commentDTO, getLoginEmail(principal));

        return ResponseEntity.ok(updatedComment);
    }

    // 댓글 및 대댓글 삭제
    @DeleteMapping("/comment/{commentId}")
    public ResponseEntity<Void> deleteComment(@PathVariable Long commentId, Principal principal) {
        boardCommentService.deleteComment(commentId, getLoginEmail(principal));

        return ResponseEntity.noContent().build();
    }

    // 댓글 및 대댓글 신고
    @PostMapping("/comment/{commentId}/report")
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
