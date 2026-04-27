package com.taskflow.backend.dto.comment;

import com.taskflow.backend.entity.Comment;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.Setter;
import java.time.LocalDateTime;

@Getter
@Setter
@AllArgsConstructor
public class CommentResponse {

    private Long id;
    private String content;
    private String userEmail;
    private String userName;
    private LocalDateTime createdAt;

    public static CommentResponse fromComment(Comment comment) {
        return new CommentResponse(
                comment.getId(),
                comment.getContent(),
                comment.getUser().getEmail(),
                comment.getUser().getFirstName() + " " + comment.getUser().getLastName(),
                comment.getCreatedAt()
        );
    }
}