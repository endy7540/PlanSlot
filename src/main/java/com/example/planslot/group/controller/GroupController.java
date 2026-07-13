package com.example.planslot.group.controller;

import com.example.planslot.group.dto.GroupDTO;
import com.example.planslot.group.service.GroupService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.*;

@Controller
@RequestMapping("/group")
@RequiredArgsConstructor
public class GroupController {

    private final GroupService groupService;

    @GetMapping("/list")
    public String groupList() {
        return "group/group-list";
    }

    @GetMapping("/detail")
    public String groupDetail() {
        return "group/group-detail";
    }

    @GetMapping("/recommend")
    public String groupRecommend() {
        return "group/ai-recommend";
    }

    @PostMapping("/register")
    public ResponseEntity<GroupDTO.Response> registerGroup(
            @Valid @RequestBody GroupDTO.CreateRequest request
    ) {
        Long memberId = 1L; // 임시 하드코딩
        GroupDTO.Response response = groupService.createGroup(memberId, request);

        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(response);
    }
}
