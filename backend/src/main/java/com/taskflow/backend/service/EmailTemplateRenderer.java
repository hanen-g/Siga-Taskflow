package com.taskflow.backend.service;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Component;
import org.thymeleaf.context.Context;
import org.thymeleaf.spring6.SpringTemplateEngine;

@Component
public class EmailTemplateRenderer {

    private final SpringTemplateEngine emailTemplateEngine;

    public EmailTemplateRenderer(@Qualifier("emailTemplateEngine") SpringTemplateEngine emailTemplateEngine) {
        this.emailTemplateEngine = emailTemplateEngine;
    }

    public String renderWelcome(
            String firstName,
            String roleLabel,
            String loginUrl,
            String recipientEmail,
            String temporaryPassword
    ) {
        Context context = new Context();
        context.setVariable("firstName", firstName);
        context.setVariable("roleLabel", roleLabel);
        context.setVariable("loginUrl", loginUrl);
        context.setVariable("recipientEmail", recipientEmail);
        context.setVariable("temporaryPassword", temporaryPassword);
        return emailTemplateEngine.process("email/welcome", context);
    }

    public String renderPasswordReset(
            String firstName,
            String loginUrl,
            String recipientEmail,
            String newPassword
    ) {
        Context context = new Context();
        context.setVariable("firstName", firstName);
        context.setVariable("loginUrl", loginUrl);
        context.setVariable("recipientEmail", recipientEmail);
        context.setVariable("newPassword", newPassword);
        return emailTemplateEngine.process("email/password-reset", context);
    }
}
