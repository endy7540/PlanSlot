package com.example.planslot.board.service;

import com.example.planslot.board.dto.BoardDTO;
import com.example.planslot.board.dto.BoardImageDTO;
import com.example.planslot.board.dto.BoardMemberDTO;
import com.example.planslot.board.entity.Board;
import com.example.planslot.board.entity.BoardCommentStatus;
import com.example.planslot.board.entity.BoardImage;
import com.example.planslot.board.entity.BoardStatus;
import com.example.planslot.board.entity.BoardType;
import com.example.planslot.board.repository.BoardCommentRepository;
import com.example.planslot.board.repository.BoardImageRepository;
import com.example.planslot.board.repository.BoardRepository;
import com.example.planslot.boardreport.dto.BoardReportRequestDTO;
import com.example.planslot.boardreport.entity.BoardReport;
import com.example.planslot.boardreport.entity.BoardReportTargetType;
import com.example.planslot.boardreport.repository.BoardReportRepository;
import com.example.planslot.member.entity.Member;
import com.example.planslot.member.repository.MemberRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class BoardServiceImpl implements BoardService {
    private static final Set<String> IMAGE_EXTENSIONS = Set.of("jpg", "jpeg", "png", "webp");
    private static final Set<String> IMAGE_CONTENT_TYPES = Set.of("image/jpeg", "image/png", "image/webp");
    private static final Set<String> SEARCH_TYPES = Set.of("TITLE_CONTENT", "TITLE", "CONTENT", "WRITER");

    private final BoardRepository boardRepository;
    private final BoardImageRepository boardImageRepository;
    private final MemberRepository memberRepository;
    private final BoardCommentRepository boardCommentRepository;
    private final BoardReportRepository boardReportRepository;

    @Value("${file.upload.board-path:./uploads/board}")
    private String boardUploadPath;

    // 게시글 등록
    @Override
    @Transactional
    public Long createBoard(BoardType boardType, BoardDTO boardDTO, String memberEmail) {
        Member writer = findMember(memberEmail);

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
    public Page<BoardDTO> getBoardList(BoardType boardType, String searchType, String keyword, Pageable pageable) {
        String searchKeyword = normalizeKeyword(keyword);
        Page<Board> boardPage;

        if (searchKeyword == null) {
            boardPage = boardRepository.findByBoardTypeAndBoardStatus(
                    boardType, BoardStatus.ACTIVE, pageable
            );
        } else {
            String normalizedSearchType = normalizeSearchType(searchType);

            boardPage = switch (normalizedSearchType) {
                case "TITLE" -> boardRepository
                        .findByBoardTypeAndBoardStatusAndTitleContainingIgnoreCase(
                                boardType, BoardStatus.ACTIVE, searchKeyword, pageable);
                case "CONTENT" -> boardRepository
                        .findByBoardTypeAndBoardStatusAndContentContainingIgnoreCase(
                                boardType, BoardStatus.ACTIVE, searchKeyword, pageable);
                case "WRITER" -> boardRepository
                        .findByBoardTypeAndBoardStatusAndWriter_NicknameContainingIgnoreCase(
                                boardType, BoardStatus.ACTIVE, searchKeyword, pageable);
                default -> boardRepository
                        .findByBoardTypeAndBoardStatusAndTitleContainingIgnoreCaseOrBoardTypeAndBoardStatusAndContentContainingIgnoreCase(
                                boardType, BoardStatus.ACTIVE, searchKeyword,
                                boardType, BoardStatus.ACTIVE, searchKeyword, pageable);
            };
        }

        Map<Long, Long> commentCountMap = getCommentCountMap(boardPage.getContent());

        return boardPage.map(board ->
                toListDTO(board, commentCountMap.getOrDefault(board.getBoardId(), 0L)
        ));
    }

    // 게시글 상세 조회 및 조회수 증가
    @Override
    @Transactional
    public BoardDTO getBoardDetail(Long boardId) {
        int updatedCount = boardRepository.increaseViewCount(boardId, BoardStatus.ACTIVE);

        if (updatedCount == 0) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "게시글을 찾을 수 없습니다.");
        }

        Board board = findBoard(boardId);

        return toDetailDTO(board);
    }

    // 로그인 회원 조회
    @Override
    public BoardMemberDTO getLoginMember(String memberEmail) {
        Member member = findMember(memberEmail);

        return BoardMemberDTO.builder()
                .memberId(member.getId())
                .nickname(member.getNickname())
                .role(member.getRole())
                .build();
    }

    // 게시글 수정
    @Override
    @Transactional
    public BoardDTO updateBoard(Long boardId, BoardDTO boardDTO, String memberEmail) {
        Board board = findBoard(boardId);
        Member member = findMember(memberEmail);

        validateWriter(board, member);
        validateBoardDTO(boardDTO);

        board.update(boardDTO.getTitle().trim(), boardDTO.getContent().trim());

        return toDetailDTO(board);
    }

    // 게시글 삭제
    @Override
    @Transactional
    public void deleteBoard(Long boardId, String memberEmail) {
        Board board = findBoard(boardId);
        Member member = findMember(memberEmail);

        validateWriter(board, member);

        board.delete();
    }

    // 게시글 신고
    @Override
    @Transactional
    public Long reportBoard(Long boardId, BoardReportRequestDTO reportRequestDTO, String reporterEmail) {
        Board board = findBoard(boardId);
        Member reporter = findMember(reporterEmail);

        if (Objects.equals(board.getWriter().getId(), reporter.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "본인이 작성한 게시글은 신고할 수 없습니다.");
        }

        validateBoardReportRequest(reportRequestDTO);

        boolean duplicated = boardReportRepository.existsByReporter_IdAndTargetTypeAndTargetId(
                reporter.getId(), BoardReportTargetType.POST, boardId
        );

        if (duplicated) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "이미 신고한 게시글입니다.");
        }

        BoardReport boardReport = BoardReport.builder()
                .reporter(reporter)
                .targetType(BoardReportTargetType.POST)
                .targetId(boardId)
                .reasonCode(reportRequestDTO.getReasonCode())
                .reasonDetail(reportRequestDTO.getReasonDetail().trim())
                .build();

        return boardReportRepository.save(boardReport).getReportId();
    }

    // 게시글 이미지 등록, 교체 및 실제 파일 삭제
    @Override
    @Transactional
    public BoardImageDTO uploadBoardImage(Long boardId, MultipartFile image, String memberEmail) {
        Board board = findBoard(boardId);
        Member member = findMember(memberEmail);

        validateWriter(board, member);
        validateImage(image);

        String fileUrl = saveImageFile(image);
        registerNewFileRollbackSynchronization(fileUrl);

        BoardImage boardImage = boardImageRepository.findByBoardBoardId(boardId)
                .map(savedImage -> {
                    String oldFileUrl = savedImage.getFileUrl();
                    savedImage.updateFileUrl(fileUrl);
                    deletePhysicalFileAfterCommit(oldFileUrl);
                    return savedImage;
                })
                .orElseGet(() -> BoardImage.builder()
                        .board(board)
                        .fileUrl(fileUrl)
                        .build());

        return toImageDTO(boardImageRepository.save(boardImage));
    }

    // 게시글 이미지 정보 및 실제 파일 삭제
    @Override
    @Transactional
    public void deleteBoardImage(Long boardId, Long imageId, String memberEmail) {
        Board board = findBoard(boardId);
        Member member = findMember(memberEmail);

        validateWriter(board, member);

        BoardImage boardImage = boardImageRepository.findByFileIdAndBoardBoardId(imageId, boardId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "게시글 이미지를 찾을 수 없습니다."
                ));

        String fileUrl = boardImage.getFileUrl();
        boardImageRepository.delete(boardImage);
        deletePhysicalFileAfterCommit(fileUrl);
    }

    // 로그인 회원 조회
    private Member findMember(String memberEmail) {
        if (memberEmail == null || memberEmail.isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "로그인이 필요합니다.");
        }

        return memberRepository.findByEmail(memberEmail)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.UNAUTHORIZED, "로그인 회원을 찾을 수 없습니다."
                ));
    }

    // 활성 상태 게시글 조회
    private Board findBoard(Long boardId) {
        if (boardId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "게시글 ID가 필요합니다.");
        }

        return boardRepository.findByBoardIdAndBoardStatus(boardId, BoardStatus.ACTIVE)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "게시글을 찾을 수 없습니다."
                ));
    }

    // 공지사항 작성 권한 확인
    private void validateNoticeWriter(BoardType boardType, Member member) {
        if (boardType == BoardType.NOTICE && member.getRole() != Member.Role.ADMIN) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "공지사항은 관리자만 작성할 수 있습니다.");
        }
    }

    // 게시글 작성자 확인
    private void validateWriter(Board board, Member member) {
        if (!Objects.equals(board.getWriter().getId(), member.getId())) {
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

    // 게시글 신고 입력값 확인
    private void validateBoardReportRequest(BoardReportRequestDTO reportRequestDTO) {
        if (reportRequestDTO == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "신고 정보를 입력해 주세요.");
        }

        if (reportRequestDTO.getReasonCode() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "신고 사유를 선택해 주세요.");
        }

        String reasonDetail = reportRequestDTO.getReasonDetail();

        if (reasonDetail == null || reasonDetail.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "신고 세부내용을 입력해 주세요.");
        }

        if (reasonDetail.trim().length() > 500) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "신고 세부내용은 500자 이하로 입력해 주세요.");
        }
    }

    // 검색 조건 확인
    private String normalizeSearchType(String searchType) {
        String normalizedSearchType = searchType == null || searchType.isBlank() ? "TITLE_CONTENT" : searchType.trim().toUpperCase(Locale.ROOT);

        if (!SEARCH_TYPES.contains(normalizedSearchType)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "지원하지 않는 검색 조건입니다.");
        }

        return normalizedSearchType;
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

        String extension = getExtension(image.getOriginalFilename());

        if (!IMAGE_EXTENSIONS.contains(extension)) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "JPG, JPEG, PNG, WEBP 이미지만 업로드할 수 있습니다."
            );
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
                Files.copy(inputStream, savedFilePath, StandardCopyOption.REPLACE_EXISTING);
            }
        } catch (IOException exception) {
            throw new ResponseStatusException(
                    HttpStatus.INTERNAL_SERVER_ERROR, "이미지 저장에 실패했습니다.", exception
            );
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

        return originalFilename.substring(dotIndex + 1).toLowerCase(Locale.ROOT);
    }

    // 게시글 목록의 댓글 수를 게시글별로 한 번에 조회
    private Map<Long, Long> getCommentCountMap(List<Board> boards) {
        if (boards.isEmpty()) {
            return Map.of();
        }

        List<Long> boardIds = boards.stream()
                .map(Board::getBoardId)
                .toList();

        Map<Long, Long> commentCountMap = new HashMap<>();

        boardCommentRepository.countByBoardIdsAndCommentStatus(boardIds, BoardCommentStatus.ACTIVE)
                .forEach(commentCount -> commentCountMap.put(
                        commentCount.getBoardId(), commentCount.getCommentCount()
                ));

        return commentCountMap;
    }

    // 게시글 목록 DTO 변환
    private BoardDTO toListDTO(Board board, long commentCount) {
        return BoardDTO.builder()
                .boardId(board.getBoardId())
                .writerId(board.getWriter().getId())
                .writerNickname(board.getWriter().getNickname())
                .title(board.getTitle())
                .viewCount(board.getViewCount())
                .boardType(board.getBoardType())
                .commentCount(commentCount)
                .createdAt(board.getCreatedAt())
                .build();
    }

    // 게시글 상세 DTO 변환
    private BoardDTO toDetailDTO(Board board) {
        BoardImageDTO boardImage = boardImageRepository.findByBoardBoardId(board.getBoardId())
                .map(this::toImageDTO)
                .orElse(null);

        long commentCount = boardCommentRepository.countByBoardIdAndCommentStatus(
                board.getBoardId(), BoardCommentStatus.ACTIVE
        );

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
                .commentCount(commentCount)
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

    // 물리 이미지 파일 삭제
    private void deletePhysicalFile(String fileUrl) {
        if (fileUrl == null || fileUrl.isBlank()) {
            return;
        }

        try {
            int lastSlashIndex = fileUrl.lastIndexOf('/');

            if (lastSlashIndex >= 0) {
                String fileName = fileUrl.substring(lastSlashIndex + 1);
                Path uploadDirectory = Path.of(boardUploadPath).toAbsolutePath().normalize();
                Path filePath = uploadDirectory.resolve(fileName).normalize();

                if (filePath.startsWith(uploadDirectory)) {
                    Files.deleteIfExists(filePath);
                }
            }
        } catch (IOException exception) {
            log.error(
                    "물리 이미지 파일 삭제 중 오류가 발생했습니다. fileUrl: {}, error: {}",
                    fileUrl, exception.getMessage()
            );
        }
    }

    // 트랜잭션 커밋 후 물리 파일 삭제 예약
    private void deletePhysicalFileAfterCommit(String fileUrl) {
        if (fileUrl == null || fileUrl.isBlank()) {
            return;
        }

        if (TransactionSynchronizationManager.isActualTransactionActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    deletePhysicalFile(fileUrl);
                }
            });
        } else {
            deletePhysicalFile(fileUrl);
        }
    }

    // 트랜잭션 롤백 시 신규 물리 파일 삭제 예약
    private void registerNewFileRollbackSynchronization(String fileUrl) {
        if (fileUrl == null || fileUrl.isBlank()) {
            return;
        }

        if (TransactionSynchronizationManager.isActualTransactionActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCompletion(int status) {
                    if (status == STATUS_ROLLED_BACK) {
                        deletePhysicalFile(fileUrl);
                    }
                }
            });
        }
    }
}