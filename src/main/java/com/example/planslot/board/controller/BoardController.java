package com.example.planslot.board.controller;

import com.example.planslot.board.dto.BoardDTO;
import com.example.planslot.board.dto.BoardImageDTO;
import com.example.planslot.board.dto.BoardMemberDTO;
import com.example.planslot.board.entity.BoardRecruitmentStatus;
import com.example.planslot.board.entity.BoardType;
import com.example.planslot.board.service.BoardService;
import com.example.planslot.boardreport.dto.BoardReportRequestDTO;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.ModelAndView;

import java.security.Principal;
import java.util.Locale;
import java.util.Map;

@RestController
@RequestMapping("/board")
@RequiredArgsConstructor
public class BoardController {

    private final BoardService boardService;

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Map<String, String>> handleBoardError(ResponseStatusException exception) {
        String message = exception.getReason();
        if (message == null || message.isBlank()) message = "요청 처리에 실패했습니다.";
        return ResponseEntity.status(exception.getStatusCode()).body(Map.of("message", message));
    }

    // 게시판 기본 화면
    @GetMapping
    public ModelAndView boardPage() {
        return new ModelAndView("redirect:/board/notice");
    }

    // 공지사항 화면
    @GetMapping("/notice")
    public ModelAndView noticePage() {
        return new ModelAndView("board/board-notice-list");
    }

    // 스터디 게시판 화면
    @GetMapping("/study")
    public ModelAndView studyPage() {
        return new ModelAndView("board/board-study-list");
    }

    // 소모임 게시판 화면
    @GetMapping("/group")
    public ModelAndView groupPage() {
        return new ModelAndView("board/board-group-list");
    }

    // 자유게시판 화면
    @GetMapping("/free")
    public ModelAndView freePage() {
        return new ModelAndView("board/board-free-list");
    }

    // 게시글 조회 화면
    @GetMapping("/read/{boardId}")
    public ModelAndView boardReadPage() {
        return new ModelAndView("board/board-read");
    }

    // 게시글 등록 및 수정 화면
    @GetMapping("/register/{boardType}")
    public ModelAndView boardRegisterPage() {
        return new ModelAndView("board/board-register");
    }

    // 로그인 회원 조회
    @GetMapping("/me")
    public ResponseEntity<BoardMemberDTO> getLoginMember(Principal principal) {
        return ResponseEntity.ok(boardService.getLoginMember(getLoginEmail(principal)));
    }

    // 게시글 등록
    @PostMapping("/type/{boardType}")
    public ResponseEntity<Long> createBoard(@PathVariable String boardType,
                                            @RequestBody BoardDTO boardDTO,
                                            Principal principal) {
        Long boardId = boardService.createBoard(parseBoardType(boardType), boardDTO, getLoginEmail(principal));

        return ResponseEntity.status(HttpStatus.CREATED).body(boardId);
    }

    // 게시판 종류별 목록 및 검색
    @GetMapping("/type/{boardType}")
    public ResponseEntity<Page<BoardDTO>> getBoardList(@PathVariable String boardType,
                                                       @RequestParam(defaultValue = "titleContent") String searchType,
                                                       @RequestParam(required = false) String keyword,
                                                       @PageableDefault(size = 10, sort = "createdAt",
                                                               direction = Sort.Direction.DESC) Pageable pageable) {
        Page<BoardDTO> boardList = boardService.getBoardList(
                parseBoardType(boardType), searchType, keyword, pageable
        );

        return ResponseEntity.ok(boardList);
    }

    // 게시글 조회
    @GetMapping("/{boardId}")
    public ResponseEntity<BoardDTO> readBoard(@PathVariable Long boardId,
                                             @RequestParam(defaultValue = "true") boolean increaseView,
                                             Principal principal) {
        // 비로그인 사용자도 상세 조회 가능하도록 null 허용
        String email = (principal != null && principal.getName() != null && !principal.getName().isBlank())
                ? principal.getName() : null;
        return ResponseEntity.ok(boardService.readBoard(boardId, email, increaseView));
    }

    // 게시글 수정
    @PutMapping("/{boardId}")
    public ResponseEntity<BoardDTO> updateBoard(@PathVariable Long boardId,
                                                @RequestBody BoardDTO boardDTO,
                                                Principal principal) {
        BoardDTO updatedBoard = boardService.updateBoard(boardId, boardDTO, getLoginEmail(principal));

        return ResponseEntity.ok(updatedBoard);
    }

    // 게시글 삭제
    @DeleteMapping("/{boardId}")
    public ResponseEntity<Void> deleteBoard(@PathVariable Long boardId, Principal principal) {
        boardService.deleteBoard(boardId, getLoginEmail(principal));

        return ResponseEntity.noContent().build();
    }

    // 모집 상태 수정
    @PatchMapping("/{boardId}/recruitment-status")
    public ResponseEntity<BoardDTO> updateRecruitmentStatus(@PathVariable Long boardId,
                                                            @RequestParam String status,
                                                            Principal principal) {
        BoardDTO board = boardService.updateRecruitmentStatus(
                boardId, parseRecruitmentStatus(status), getLoginEmail(principal)
        );

        return ResponseEntity.ok(board);
    }

    // 게시글 신고
    @PostMapping("/{boardId}/report")
    public ResponseEntity<Long> reportBoard(@PathVariable Long boardId,
                                            @RequestBody BoardReportRequestDTO reportRequestDTO,
                                            Principal principal) {
        Long reportId = boardService.reportBoard(boardId, reportRequestDTO, getLoginEmail(principal));

        return ResponseEntity.status(HttpStatus.CREATED).body(reportId);
    }

    // 게시글 이미지 등록 및 교체
    @PostMapping(value = "/{boardId}/image", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<BoardImageDTO> uploadBoardImage(@PathVariable Long boardId,
                                                          @RequestPart("image") MultipartFile image,
                                                          Principal principal) {
        BoardImageDTO boardImage = boardService.uploadBoardImage(boardId, image, getLoginEmail(principal));

        return ResponseEntity.status(HttpStatus.CREATED).body(boardImage);
    }

    // 게시글 이미지 정보 및 실제 파일 삭제
    @DeleteMapping("/{boardId}/image/{imageId}")
    public ResponseEntity<Void> deleteBoardImage(@PathVariable Long boardId,
                                                 @PathVariable Long imageId,
                                                 Principal principal) {
        boardService.deleteBoardImage(boardId, imageId, getLoginEmail(principal));

        return ResponseEntity.noContent().build();
    }

    // 로그인 이메일 조회
    private String getLoginEmail(Principal principal) {
        if (principal == null || principal.getName() == null || principal.getName().isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "로그인이 필요합니다.");
        }

        return principal.getName();
    }

    // 게시판 유형 변환
    private BoardType parseBoardType(String boardType) {
        try {
            return BoardType.valueOf(boardType.toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException exception) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "존재하지 않는 게시판 유형입니다.");
        }
    }

    // 모집 상태 변환
    private BoardRecruitmentStatus parseRecruitmentStatus(String status) {
        if (status == null || status.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "모집 상태를 입력해 주세요.");
        }
        try {
            return BoardRecruitmentStatus.valueOf(status.toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException exception) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "지원하지 않는 모집 상태입니다.");
        }
    }
}
