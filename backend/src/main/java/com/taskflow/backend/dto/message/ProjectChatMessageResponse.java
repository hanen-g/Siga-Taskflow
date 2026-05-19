package com.taskflow.backend.dto.message;

import com.taskflow.backend.entity.Message;
import com.taskflow.backend.entity.User;
import com.taskflow.backend.entity.UserRole;
import lombok.AllArgsConstructor;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
@AllArgsConstructor
public class ProjectChatMessageResponse {

    private Long id;
    private Long projectId;
    /** "Admin" for administrators; client full name for clients. */
    private String senderLabel;
    private boolean fromCurrentUser;
    private String content;
    private boolean read;
    private LocalDateTime createdAt;

    public static ProjectChatMessageResponse from(Message message, User viewer) {
        User sender = message.getSender();
        boolean fromViewer = sender.getId().equals(viewer.getId());
        return new ProjectChatMessageResponse(
                message.getId(),
                message.getProject().getId(),
                senderLabel(sender),
                fromViewer,
                message.getContent(),
                message.isRead(),
                message.getCreatedAt()
        );
    }

    private static String senderLabel(User sender) {
        if (sender == null) {
            return "Unknown";
        }
        if (sender.getRole() == UserRole.ADMIN) {
            return "Admin";
        }
        if (sender.getRole() == UserRole.CLIENT) {
            return formatClientFullName(sender);
        }
        return "User";
    }

    private static String formatClientFullName(User user) {
        String firstName = user.getFirstName() == null ? "" : user.getFirstName().trim();
        String lastName = user.getLastName() == null ? "" : user.getLastName().trim();
        String fullName = (firstName + " " + lastName).trim();
        return fullName.isBlank() ? (user.getEmail() != null ? user.getEmail() : "Client") : fullName;
    }
}
