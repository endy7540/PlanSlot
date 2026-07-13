package com.example.planslot.board.controller;

import com.example.planslot.board.dto.BoardDTO;
import com.example.planslot.board.dto.BoardImageDTO;
import com.example.planslot.board.entity.BoardType;
import com.example.planslot.board.service.BoardService;
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

import java.util.Locale;

@RestController
@RequestMapping("/post")
@RequiredArgsConstructor
public class BoardController {

    private final BoardService boardService;

    // 게시글 등록
    @PostMapping("/{boardType:[a-zA-Z]+}")
    public ResponseEntity<Long> createBoard(
            @PathVariable String boardType,
            @RequestParam Long memberId,
            @RequestBody BoardDTO boardDTO
    ) {
        Long boardId = boardService.createBoard(
                parseBoardType(boardType),
                boardDTO,
                memberId
        );

        return ResponseEntity.status(HttpStatus.CREATED).body(boardId);
    }

    // 게시판 종류별 목록 및 검색
    @GetMapping("/{boardType:[a-zA-Z]+}")
    public ResponseEntity<Page<BoardDTO>> getBoardList(
            @PathVariable String boardType,
            @RequestParam(required = false) String keyword,
            @PageableDefault(
                    size = 10,
                    sort = "createdAt",
                    direction = Sort.Direction.DESC
            ) Pageable pageable
    ) {
        Page<BoardDTO> boardList = boardService.getBoardList(
                parseBoardType(boardType),
                keyword,
                pageable
        );

        return ResponseEntity.ok(boardList);
    }

    // 게시글 상세 조회
    @GetMapping("/{boardId:\\d+}")
    public ResponseEntity<BoardDTO> getBoardDetail(
            @PathVariable Long boardId
    ) {
        return ResponseEntity.ok(
                boardService.getBoardDetail(boardId)
        );
    }

    // 게시글 수정
    @PutMapping("/{boardId:\\d+}")
    public ResponseEntity<BoardDTO> updateBoard(
            @PathVariable Long boardId,
            @RequestParam Long memberId,
            @RequestBody BoardDTO boardDTO
    ) {
        BoardDTO updatedBoard = boardService.updateBoard(
                boardId,
                boardDTO,
                memberId
        );

        return ResponseEntity.ok(updatedBoard);
    }

    // 게시글 삭제
    @DeleteMapping("/{boardId:\\d+}")
    public ResponseEntity<Void> deleteBoard(
            @PathVariable Long boardId,
            @RequestParam Long memberId
    ) {
        boardService.deleteBoard(boardId, memberId);

        return ResponseEntity.noContent().build();
    }

    // 게시글 이미지 등록 및 교체
    @PostMapping(
            value = "/{boardId:\\d+}/image",
            consumes = MediaType.MULTIPART_FORM_DATA_VALUE
    )
    public ResponseEntity<BoardImageDTO> uploadBoardImage(
            @PathVariable Long boardId,
            @RequestParam Long memberId,
            @RequestPart("image") MultipartFile image
    ) {
        BoardImageDTO boardImage = boardService.uploadBoardImage(
                boardId,
                image,
                memberId
        );

        return ResponseEntity.status(HttpStatus.CREATED).body(boardImage);
    }

    // 게시글 이미지 DB 정보 삭제
    @DeleteMapping("/{boardId:\\d+}/image/{imageId:\\d+}")
    public ResponseEntity<Void> deleteBoardImage(
            @PathVariable Long boardId,
            @PathVariable Long imageId,
            @RequestParam Long memberId
    ) {
        boardService.deleteBoardImage(
                boardId,
                imageId,
                memberId
        );

        return ResponseEntity.noContent().build();
    }

    // 게시판 유형 변환
    private BoardType parseBoardType(String boardType) {
        try {
            return BoardType.valueOf(
                    boardType.toUpperCase(Locale.ROOT)
            );
        } catch (IllegalArgumentException exception) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "존재하지 않는 게시판 유형입니다."
            );
        }
    }
}