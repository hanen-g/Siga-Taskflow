package com.taskflow.backend.controller;

import com.taskflow.backend.dto.skill.SkillIdsRequest;
import com.taskflow.backend.dto.skill.SkillResponse;
import com.taskflow.backend.security.CustomUserDetails;
import com.taskflow.backend.service.UserSkillService;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/user/me")
@CrossOrigin
public class UserSkillController {

    private final UserSkillService userSkillService;

    public UserSkillController(UserSkillService userSkillService) {
        this.userSkillService = userSkillService;
    }

    @GetMapping("/skills")
    public List<SkillResponse> getMySkills(@org.springframework.security.core.annotation.AuthenticationPrincipal CustomUserDetails userDetails) {
        return userSkillService.getUserSkills(userDetails.getUser());
    }

    @PutMapping("/skills")
    public List<SkillResponse> putMySkills(
            @org.springframework.security.core.annotation.AuthenticationPrincipal CustomUserDetails userDetails,
            @RequestBody SkillIdsRequest request) {
        return userSkillService.updateUserSkills(userDetails.getUser(), request);
    }
}
