package com.taskflow.backend.service;

import com.taskflow.backend.dto.message.ProjectChatMessageResponse;
import com.taskflow.backend.dto.message.ProjectChatUnreadResponse;
import com.taskflow.backend.dto.message.SendProjectMessageRequest;
import com.taskflow.backend.dto.websocket.Notification;
import com.taskflow.backend.entity.Message;
import com.taskflow.backend.entity.Project;
import com.taskflow.backend.entity.User;
import com.taskflow.backend.entity.UserRole;
import com.taskflow.backend.exception.BadRequestException;
import com.taskflow.backend.exception.ResourceNotFoundException;
import com.taskflow.backend.exception.UnauthorizedException;
import com.taskflow.backend.repository.MessageRepository;
import com.taskflow.backend.repository.ProjectRepository;
import com.taskflow.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class ProjectChatService {

    private final MessageRepository messageRepository;
    private final ProjectRepository projectRepository;
    private final ProjectService projectService;
    private final NotificationService notificationService;
    private final UserRepository userRepository;
    private final SimpMessagingTemplate messagingTemplate;

    @Transactional(readOnly = true)
    public List<ProjectChatMessageResponse> getMessages(Long projectId, User user) {
        Project project = loadProjectForChat(projectId, user);
        return messageRepository.findByProjectIdOrderByCreatedAtAsc(project.getId()).stream()
                .map(message -> ProjectChatMessageResponse.from(message, user))
                .toList();
    }

    @Transactional(readOnly = true)
    public ProjectChatUnreadResponse getUnreadCount(Long projectId, User user) {
        assertChatParticipant(user);
        projectService.assertUserCanViewProject(projectId, user);
        long count = messageRepository.countUnreadForRecipient(projectId, user.getId());
        return new ProjectChatUnreadResponse(count);
    }

    @Transactional
    public ProjectChatMessageResponse sendMessage(Long projectId, SendProjectMessageRequest request, User sender) {
        assertChatParticipant(sender);
        if (request == null || request.getContent() == null || request.getContent().isBlank()) {
            throw new BadRequestException("Message content cannot be empty");
        }

        Project project = loadProjectForChat(projectId, sender);
        Message message = new Message();
        message.setProject(project);
        message.setSender(sender);
        message.setContent(request.getContent().trim());
        message.setRead(false);

        Message saved = messageRepository.save(message);
        ProjectChatMessageResponse response = ProjectChatMessageResponse.from(saved, sender);

        messagingTemplate.convertAndSend("/topic/projects/chat/" + projectId, response);
        notifyRecipients(project, sender, saved);

        return response;
    }

    @Transactional
    public void markMessagesAsRead(Long projectId, User recipient) {
        assertChatParticipant(recipient);
        projectService.assertUserCanViewProject(projectId, recipient);
        messageRepository.markAllAsReadForRecipient(projectId, recipient.getId());
        notificationService.markProjectChatNotificationsAsRead(recipient, projectId);
    }

    private Project loadProjectForChat(Long projectId, User user) {
        assertChatParticipant(user);
        projectService.assertUserCanViewProject(projectId, user);
        return projectRepository.findById(projectId)
                .orElseThrow(() -> new ResourceNotFoundException("Project", projectId));
    }

    private void assertChatParticipant(User user) {
        if (user.getRole() != UserRole.ADMIN && user.getRole() != UserRole.CLIENT) {
            throw new UnauthorizedException("Only administrators and clients can use project chat");
        }
    }

    private void notifyRecipients(Project project, User sender, Message message) {
        if (sender.getRole() == UserRole.CLIENT) {
            userRepository.findByRoleAndActiveIncludingNull(UserRole.ADMIN).forEach(admin -> {
                if (admin.getId().equals(sender.getId())) {
                    return;
                }
                Notification dto = notificationService.createProjectMessageNotification(admin, sender, project, message);
                messagingTemplate.convertAndSend("/topic/notifications/user/" + admin.getId(), dto);
            });
            return;
        }

        if (sender.getRole() == UserRole.ADMIN && project.getMembers() != null) {
            project.getMembers().stream()
                    .filter(member -> member.getRole() == UserRole.CLIENT)
                    .filter(member -> !member.getId().equals(sender.getId()))
                    .forEach(client -> {
                        Notification dto = notificationService.createProjectMessageNotification(
                                client, sender, project, message);
                        messagingTemplate.convertAndSend("/topic/notifications/user/" + client.getId(), dto);
                    });
        }
    }
}
