package com.taskflow.backend.controller;

import com.taskflow.backend.dto.skill.CreateSkillRequest;
import com.taskflow.backend.dto.skill.SkillResponse;
import com.taskflow.backend.dto.skill.UpdateSkillRequest;
import com.taskflow.backend.service.SkillService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/admin/skills")
@CrossOrigin
public class AdminSkillController {

    private final SkillService skillService;

    public AdminSkillController(SkillService skillService) {
        this.skillService = skillService;
    }

    /**
     * List catalog for admin UI. Mapped to {@code /list} so it never collides with
     * {@code POST /api/admin/skills} (create) in strict routing / older deployments.
     */
    @GetMapping({"/list", ""})
    @PreAuthorize("hasRole('ADMIN')")
    public List<SkillResponse> listForAdmin() {
        return skillService.listForAdminTable();
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<SkillResponse> create(@RequestBody CreateSkillRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(skillService.create(request));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public SkillResponse update(@PathVariable Long id, @RequestBody UpdateSkillRequest request) {
        return skillService.update(id, request);
    }

    @PostMapping("/{id}/archive")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> archive(@PathVariable Long id) {
        skillService.archiveById(id);
        return ResponseEntity.noContent().build();
    }
}
