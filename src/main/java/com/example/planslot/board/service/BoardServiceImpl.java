package com.example.planslot.board.service;

import com.example.planslot.board.dto.BoardDTO;
import com.example.planslot.board.dto.BoardImageDTO;
import com.example.planslot.board.entity.Board;
import com.example.planslot.board.entity.BoardImage;
import com.example.planslot.board.entity.BoardStatus;
import com.example.planslot.board.entity.BoardType;
import com.example.planslot.board.repository.BoardImageRepository;
import com.example.planslot.board.repository.BoardRepository;
import com.example.planslot.member.entity.Member;
import com.example.planslot.member.repository.MemberRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.Locale;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class BoardServiceImpl implements BoardService {
    private static final long MAX_IMAGE_SIZE = 10L * 1024L * 1024L;
    private static final Set<String> IMAGE_EXTENSIONS = Set.of("jpg", "jpeg", "png", "webp");
    private static final Set<String> IMAGE_CONTENT_TYPES = Set.of("image/jpeg", "image/png", "image/webp");

    private final BoardRepository boardRepository;
    private final BoardImageRepository boardImageRepository;
    private final MemberRepository memberRepository;

    @Value("${file.upload.board-path:./uploads/board}")
    private String boardUploadPath;

    // 게시글 등록
    @Override
    @Transactional
    public Long createBoard(BoardType boardType, BoardDTO boardDTO, Long memberId) {
        Member writer = findMember(memberId);

        validateBoardDTO(boardDTO);
        validateNoticeWriter(boardType, writer);

        Board board = Board.builder()
                .writer(writer)
                .title(boardDTO.getTitle().trim())
                .content(boardDTO.getContent().trim())
                .boardType(boardType)
                .build();

        return boardRepository.save(board).getBoardId();
    }

    // 게시판 종류별 목록 및 검색
    @Override
    public Page<BoardDTO> getBoardList(BoardType boardType, String keyword, Pageable pageable) {
        String searchKeyword = normalizeKeyword(keyword);

        if (searchKeyword == null) {
            return boardRepository
                    .findByBoardTypeAndBoardStatus(boardType, BoardStatus.ACTIVE, pageable)
                    .map(this::toListDTO);
        }

        return boardRepository
                .searchBoards(
                        boardType,
                        BoardStatus.ACTIVE,
                        searchKeyword,
                        pageable
                )
                .map(this::toListDTO);
    }

    // 게시글 상세 조회 및 조회수 증가
    @Override
    @Transactional
    public BoardDTO getBoardDetail(Long boardId) {
        Board board = findBoard(boardId);

        board.increaseViewCount();

        return toDetailDTO(board);
    }

    // 게시글 수정
    @Override
    @Transactional
    public BoardDTO updateBoard(Long boardId, BoardDTO boardDTO, Long memberId) {
        Board board = findBoard(boardId);

        validateWriter(board, memberId);
        validateBoardDTO(boardDTO);

        board.update(
                boardDTO.getTitle().trim(),
                boardDTO.getContent().trim()
        );

        return toDetailDTO(board);
    }

    // 게시글 삭제
    @Override
    @Transactional
    public void deleteBoard(Long boardId, Long memberId) {
        Board board = findBoard(boardId);

        validateWriter(board, memberId);

        board.delete();
    }

    // 게시글 이미지 등록 및 교체
    @Override
    @Transactional
    public BoardImageDTO uploadBoardImage(Long boardId, MultipartFile image, Long memberId) {
        Board board = findBoard(boardId);

        validateWriter(board, memberId);
        validateImage(image);

        String fileUrl = saveImageFile(image);

        BoardImage boardImage = boardImageRepository.findByBoardBoardId(boardId)
                .map(savedImage -> {
                    savedImage.updateFileUrl(fileUrl);
                    return savedImage;
                })
                .orElseGet(() -> BoardImage.builder()
                        .board(board)
                        .fileUrl(fileUrl)
                        .build());

        return toImageDTO(boardImageRepository.save(boardImage));
    }

    // 게시글 이미지 DB 정보 삭제
    @Override
    @Transactional
    public void deleteBoardImage(Long boardId, Long imageId, Long memberId) {
        Board board = findBoard(boardId);

        validateWriter(board, memberId);

        BoardImage boardImage = boardImageRepository
                .findByFileIdAndBoardBoardId(imageId, boardId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "게시글 이미지를 찾을 수 없습니다."));

        boardImageRepository.delete(boardImage);
    }

    // 회원 조회
    private Member findMember(Long memberId) {
        if (memberId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "회원 ID가 필요합니다.");
        }

        return memberRepository.findById(memberId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "회원을 찾을 수 없습니다."));
    }

    // 활성 상태 게시글 조회
    private Board findBoard(Long boardId) {
        if (boardId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "게시글 ID가 필요합니다.");
        }

        return boardRepository
                .findByBoardIdAndBoardStatus(boardId, BoardStatus.ACTIVE)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "게시글을 찾을 수 없습니다."));
    }

    // 공지사항 작성 권한 확인
    private void validateNoticeWriter(BoardType boardType, Member member) {
        if (boardType == BoardType.NOTICE && member.getRole() != Member.Role.ADMIN) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "공지사항은 관리자만 작성할 수 있습니다.");
        }
    }

    // 게시글 작성자 확인
    private void validateWriter(Board board, Long memberId) {
        if (memberId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "회원 ID가 필요합니다.");
        }

        if (!Objects.equals(board.getWriter().getId(), memberId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "게시글 작성자만 수정하거나 삭제할 수 있습니다.");
        }
    }

    // 게시글 입력값 확인
    private void validateBoardDTO(BoardDTO boardDTO) {
        if (boardDTO == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "게시글 정보를 입력해 주세요.");
        }

        if (boardDTO.getTitle() == null || boardDTO.getTitle().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "제목을 입력해 주세요.");
        }

        if (boardDTO.getTitle().trim().length() > 100) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "제목은 100자 이하로 입력해 주세요.");
        }

        if (boardDTO.getContent() == null || boardDTO.getContent().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "내용을 입력해 주세요.");
        }

        if (boardDTO.getContent().trim().length() > 1000) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "내용은 1000자 이하로 입력해 주세요.");
        }
    }

    // 검색어 확인 및 공백 제거
    private String normalizeKeyword(String keyword) {
        if (keyword == null || keyword.isBlank()) {
            return null;
        }

        String searchKeyword = keyword.trim();

        if (searchKeyword.length() > 100) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "검색어는 100자 이하로 입력해 주세요.");
        }

        return searchKeyword;
    }

    // 이미지 파일 확인
    private void validateImage(MultipartFile image) {
        if (image == null || image.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "업로드할 이미지를 선택해 주세요.");
        }

        if (image.getSize() > MAX_IMAGE_SIZE) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "이미지는 10MB 이하만 업로드할 수 있습니다.");
        }

        String extension = getExtension(image.getOriginalFilename());

        if (!IMAGE_EXTENSIONS.contains(extension)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "JPG, JPEG, PNG, WEBP 이미지만 업로드할 수 있습니다.");
        }

        String contentType = image.getContentType();

        if (contentType == null || !IMAGE_CONTENT_TYPES.contains(contentType.toLowerCase(Locale.ROOT))) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "지원하지 않는 이미지 형식입니다.");
        }
    }

    // 실제 이미지 파일 저장
    private String saveImageFile(MultipartFile image) {
        String extension = getExtension(image.getOriginalFilename());
        String savedFileName = UUID.randomUUID() + "." + extension;
        Path uploadDirectory = Path.of(boardUploadPath).toAbsolutePath().normalize();
        Path savedFilePath = uploadDirectory.resolve(savedFileName).normalize();

        if (!savedFilePath.startsWith(uploadDirectory)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "올바르지 않은 이미지 저장 경로입니다.");
        }

        try {
            Files.createDirectories(uploadDirectory);

            try (InputStream inputStream = image.getInputStream()) {
                Files.copy(
                        inputStream,
                        savedFilePath,
                        StandardCopyOption.REPLACE_EXISTING
                );
            }
        } catch (IOException exception) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "이미지 저장에 실패했습니다.", exception);
        }

        return "/uploads/board/" + savedFileName;
    }

    // 이미지 확장자 조회
    private String getExtension(String originalFilename) {
        if (originalFilename == null || originalFilename.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "이미지 파일명이 올바르지 않습니다.");
        }

        int dotIndex = originalFilename.lastIndexOf('.');

        if (dotIndex < 0 || dotIndex == originalFilename.length() - 1) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "이미지 파일 확장자가 필요합니다.");
        }

        return originalFilename
                .substring(dotIndex + 1)
                .toLowerCase(Locale.ROOT);
    }

    // 게시글 목록 DTO 변환
    private BoardDTO toListDTO(Board board) {
        return BoardDTO.builder()
                .boardId(board.getBoardId())
                .writerId(board.getWriter().getId())
                .writerNickname(board.getWriter().getNickname())
                .title(board.getTitle())
                .viewCount(board.getViewCount())
                .boardType(board.getBoardType())
                .createdAt(board.getCreatedAt())
                .build();
    }

    // 게시글 상세 DTO 변환
    private BoardDTO toDetailDTO(Board board) {
        BoardImageDTO boardImage = boardImageRepository.findByBoardBoardId(board.getBoardId())
                .map(this::toImageDTO)
                .orElse(null);

        return BoardDTO.builder()
                .boardId(board.getBoardId())
                .writerId(board.getWriter().getId())
                .writerNickname(board.getWriter().getNickname())
                .title(board.getTitle())
                .content(board.getContent())
                .viewCount(board.getViewCount())
                .boardType(board.getBoardType())
                .boardStatus(board.getBoardStatus())
                .boardImage(boardImage)
                .createdAt(board.getCreatedAt())
                .updatedAt(board.getUpdatedAt())
                .build();
    }

    // 게시글 이미지 DTO 변환
    private BoardImageDTO toImageDTO(BoardImage boardImage) {
        return BoardImageDTO.builder()
                .fileId(boardImage.getFileId())
                .boardId(boardImage.getBoard().getBoardId())
                .fileUrl(boardImage.getFileUrl())
                .createdAt(boardImage.getCreatedAt())
                .build();
    }
}