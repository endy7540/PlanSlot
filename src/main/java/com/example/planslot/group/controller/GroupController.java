package com.example.planslot.group.controller;

import com.example.planslot.group.dto.GroupDTO;
import com.example.planslot.group.service.GroupService;
import com.example.planslot.global.response.SuccessResponse;
import com.example.planslot.global.security.SecurityUtil;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/group")
@RequiredArgsConstructor
public class GroupController {

    private final GroupService groupService;

    @PostMapping("/register")
    public ResponseEntity<SuccessResponse<GroupDTO.Response>> registerGroup(
            @Valid @RequestBody GroupDTO.CreateRequest request
    ) {
        Long memberId = SecurityUtil.getCurrentMemberId();
        GroupDTO.Response response = groupService.createGroup(memberId, request);

        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(SuccessResponse.of(response));
    }
}
