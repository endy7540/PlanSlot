package com.example.planslot.group.service;

import com.example.planslot.group.dto.GroupDTO;

public interface GroupService {

    GroupDTO.Response createGroup(Long memberId, GroupDTO.CreateRequest request);
}
