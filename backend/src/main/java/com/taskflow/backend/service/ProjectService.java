package com.taskflow.backend.service;

    import com.taskflow.backend.dto.project.ProjectRequest;
    import com.taskflow.backend.entity.Project;
    import com.taskflow.backend.entity.ProjectMember;
    import com.taskflow.backend.entity.User;
    import com.taskflow.backend.repository.ProjectMemberRepository;
    import com.taskflow.backend.repository.ProjectRepository;
    import lombok.RequiredArgsConstructor;
    import org.springframework.stereotype.Service;

    import java.time.LocalDate;

    @Service
    @RequiredArgsConstructor
    public class ProjectService {

        private final ProjectRepository projectRepository;
        private final ProjectMemberRepository memberRepository;

        public Project createProject(ProjectRequest request, User manager) {
            if (request == null || manager == null) {
                throw new IllegalArgumentException("Request or Manager cannot be null");
            }

            Project project = new Project();
            project.setName(request.getName());
            project.setDescription(request.getDescription());
            project.setManager(manager);

            Project saved = projectRepository.save(project);

            ProjectMember pm = new ProjectMember();
            pm.setProject(saved);
            pm.setUser(manager);
            pm.setrole("MANAGER");
            memberRepository.save(pm);

            return saved;
        }
    }