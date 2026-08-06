package com.example.planslot.board.controller;

import com.example.planslot.board.dto.BoardGroupDTO;
import com.example.planslot.board.service.BoardGroupService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.security.Principal;

@RestController
@RequestMapping("/board/{boardId}/group")
@RequiredArgsConstructor
public class BoardGroupController {

    private final BoardGroupService boardGroupService;

    @PostMapping("/applications")
    public ResponseEntity<Long> apply(@PathVariable Long boardId, Principal principal) {
        Long applicationId = boardGroupService.apply(boardId, getLoginEmail(principal));
        return ResponseEntity.status(HttpStatus.CREATED).body(applicationId);
    }

    @DeleteMapping("/applications/me")
    public ResponseEntity<Void> cancelApplication(@PathVariable Long boardId, Principal principal) {
        boardGroupService.cancelApplication(boardId, getLoginEmail(principal));
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/candidates")
    public ResponseEntity<BoardGroupDTO.CandidatesResponse> getCandidates(@PathVariable Long boardId, Principal principal) {
        return ResponseEntity.ok(boardGroupService.getCandidates(boardId, getLoginEmail(principal)));
    }

    @PostMapping("/create")
    public ResponseEntity<BoardGroupDTO.CreateResponse> createGroup(@PathVariable Long boardId, @RequestBody BoardGroupDTO.CreateRequest request, Principal principal) {
        Long groupId = boardGroupService.createGroup(boardId, request, getLoginEmail(principal));
        return ResponseEntity.status(HttpStatus.CREATED).body(new BoardGroupDTO.CreateResponse(groupId));
    }

    private String getLoginEmail(Principal principal) {
        if (principal == null || principal.getName() == null || principal.getName().isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "로그인이 필요합니다.");
        }

        return principal.getName();
    }
}
