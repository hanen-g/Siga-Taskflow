package com.taskflow.backend.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;


@Service
public class AccountEmailService {

    private static final Logger log = LoggerFactory.getLogger(AccountEmailService.class);
    private static final String DEFAULT_APP_BASE_URL = "http://localhost:4200";

    private final JavaMailSender mailSender;
    private final String mailHost;
    private final String mailUsername;
    private final String mailPassword;
    private final String fromAddress;
    private final String appBaseUrl;

    public AccountEmailService(
            @Autowired(required = false) JavaMailSender mailSender,
            @Value("${spring.mail.host:}") String mailHost,
            @Value("${spring.mail.username:}") String mailUsername,
            @Value("${spring.mail.password:}") String mailPassword,
            @Value("${taskflow.mail.from:noreply@taskflow.local}") String fromAddress,
            @Value("${taskflow.app.base-url:http://localhost:4200}") String appBaseUrl
    ) {
        this.mailSender = mailSender;
        this.mailHost = mailHost;
        this.mailUsername = mailUsername;
        this.mailPassword = mailPassword;
        this.fromAddress = fromAddress;
        String normalizedBaseUrl = StringUtils.hasText(appBaseUrl) ? appBaseUrl.trim() : DEFAULT_APP_BASE_URL;
        this.appBaseUrl = normalizedBaseUrl.replaceAll("/+$", "");
    }

    private boolean isMailConfigured() {
        return mailSender != null
                && StringUtils.hasText(mailHost)
                && StringUtils.hasText(mailUsername)
                && StringUtils.hasText(mailPassword)
                && StringUtils.hasText(fromAddress);
    }

    /**
     * @return true if a real SMTP message was sent, false if mail is disabled or delivery failed
     */
    public boolean sendWelcomeWithCredentials(
            String recipientEmail,
            String firstName,
            String roleLabel,
            String temporaryPassword
    ) {
        if (!StringUtils.hasText(recipientEmail)) {
            log.warn("Skipping welcome email because the recipient address is blank.");
            return false;
        }

        String safeRecipientEmail = recipientEmail.trim();
        String safeFirstName = StringUtils.hasText(firstName) ? firstName.trim() : "there";
        String safeRoleLabel = StringUtils.hasText(roleLabel) ? roleLabel.trim() : "User";
        String loginUrl = appBaseUrl + "/login";

        String body = String.format(
                "Hello %s,\n\n"
                        + "A TaskFlow account has been created for you.\n"
                        + "Role: %s\n\n"
                        + "Sign in: %s\n"
                        + "Email (login): %s\n"
                        + "Temporary password: %s\n\n"
                        + "Please sign in and change your password from your profile when possible.\n\n"
                        + "-- TaskFlow",
                safeFirstName,
                safeRoleLabel,
                loginUrl,
                safeRecipientEmail,
                temporaryPassword
        );

        if (!isMailConfigured()) {
            log.info(
                    "[Mail disabled: set MAIL_HOST, MAIL_USERNAME, MAIL_PASSWORD, and MAIL_FROM] Would email {}:\n{}",
                    safeRecipientEmail,
                    body
            );
            return false;
        }

        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(fromAddress);
        message.setTo(safeRecipientEmail);
        message.setSubject("Your TaskFlow account");
        message.setText(body);

        try {
            mailSender.send(message);
            return true;
        } catch (Exception e) {
            log.error("Failed to send welcome email to {}", safeRecipientEmail, e);
            return false;
        }
    }
}
