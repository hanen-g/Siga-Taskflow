package com.taskflow.backend.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.mail.MailProperties;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.List;

@Service
public class AccountEmailService {

    public record WelcomeEmailResult(boolean sent, boolean skippedBecauseNotConfigured) {
        public static WelcomeEmailResult delivered() {
            return new WelcomeEmailResult(true, false);
        }

        public static WelcomeEmailResult notConfigured() {
            return new WelcomeEmailResult(false, true);
        }

        public static WelcomeEmailResult sendFailed() {
            return new WelcomeEmailResult(false, false);
        }
    }

    private static final Logger log = LoggerFactory.getLogger(AccountEmailService.class);
    private static final String DEFAULT_APP_BASE_URL = "http://localhost:4200";

    private final JavaMailSender mailSender;
    private final MailProperties springMailProperties;
    private final String mailHost;
    private final String mailUsername;
    private final String mailPassword;
    private final String fromAddress;
    private final String appBaseUrl;

    public AccountEmailService(
            @Autowired(required = false) JavaMailSender mailSender,
            @Autowired(required = false) MailProperties springMailProperties,
            @Value("${spring.mail.host:}") String mailHost,
            @Value("${spring.mail.username:}") String mailUsername,
            @Value("${spring.mail.password:}") String mailPassword,
            @Value("${taskflow.mail.from:}") String fromAddress,
            @Value("${taskflow.app.base-url:http://localhost:4200}") String appBaseUrl
    ) {
        this.mailSender = mailSender;
        this.springMailProperties = springMailProperties;
        this.mailHost = mailHost;
        this.mailUsername = mailUsername;
        this.mailPassword = mailPassword;
        this.fromAddress = fromAddress;
        String normalizedBaseUrl = StringUtils.hasText(appBaseUrl) ? appBaseUrl.trim() : DEFAULT_APP_BASE_URL;
        this.appBaseUrl = normalizedBaseUrl.replaceAll("/+$", "");
    }

    private String resolvedHost() {
        if (springMailProperties != null && StringUtils.hasText(springMailProperties.getHost())) {
            return springMailProperties.getHost().trim();
        }
        return StringUtils.hasText(mailHost) ? mailHost.trim() : "";
    }

    private String resolvedUsername() {
        if (springMailProperties != null && StringUtils.hasText(springMailProperties.getUsername())) {
            return springMailProperties.getUsername().trim();
        }
        return StringUtils.hasText(mailUsername) ? mailUsername.trim() : "";
    }

    private String resolvedPassword() {
        if (springMailProperties != null && StringUtils.hasText(springMailProperties.getPassword())) {
            return springMailProperties.getPassword();
        }
        return StringUtils.hasText(mailPassword) ? mailPassword : "";
    }

    /**
     * SMTP {@code From} header. Prefer {@code taskflow.mail.from}; otherwise use the authenticated
     * mailbox (Gmail and many providers reject mail when From does not match the signed-in account).
     */
    private String effectiveFrom() {
        if (StringUtils.hasText(fromAddress)) {
            return fromAddress.trim();
        }
        String user = resolvedUsername();
        return StringUtils.hasText(user) ? user : "";
    }

    private boolean isMailConfigured() {
        return mailSender != null
                && StringUtils.hasText(resolvedHost())
                && StringUtils.hasText(resolvedUsername())
                && StringUtils.hasText(resolvedPassword())
                && StringUtils.hasText(effectiveFrom());
    }

    private String describeMailConfigurationGaps() {
        List<String> gaps = new ArrayList<>();
        if (mailSender == null) {
            gaps.add("no JavaMailSender bean (set spring.mail.host so Spring Boot can auto-configure mail)");
        }
        if (!StringUtils.hasText(resolvedHost())) {
            gaps.add("spring.mail.host is blank");
        }
        if (!StringUtils.hasText(resolvedUsername())) {
            gaps.add("spring.mail.username is blank");
        }
        if (!StringUtils.hasText(resolvedPassword())) {
            gaps.add("spring.mail.password is blank (empty MAIL_PASSWORD overrides defaults)");
        }
        if (!StringUtils.hasText(effectiveFrom())) {
            gaps.add("taskflow.mail.from and spring.mail.username are both blank");
        }
        return gaps.isEmpty() ? "unknown" : String.join("; ", gaps);
    }

    /**
     * Sends the welcome email when SMTP is fully configured; otherwise skips and logs the reason.
     */
    public WelcomeEmailResult sendWelcomeWithCredentials(
            String recipientEmail,
            String firstName,
            String roleLabel,
            String temporaryPassword
    ) {
        if (!StringUtils.hasText(recipientEmail)) {
            log.warn("Skipping welcome email because the recipient address is blank.");
            return WelcomeEmailResult.sendFailed();
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
            log.warn(
                    "Welcome email not sent (mail not fully configured). Reasons: {}. "
                            + "Fix: set spring.mail.host, spring.mail.username, spring.mail.password, "
                            + "and taskflow.mail.from (or omit taskflow.mail.from to use the SMTP username as From). "
                            + "Credentials are still logged below at INFO when mail is disabled.",
                    describeMailConfigurationGaps()
            );
            log.info(
                    "[Mail disabled] Would email {}:\n{}",
                    safeRecipientEmail,
                    body
            );
            return WelcomeEmailResult.notConfigured();
        }

        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(effectiveFrom());
        message.setTo(safeRecipientEmail);
        message.setSubject("Your TaskFlow account");
        message.setText(body);

        try {
            mailSender.send(message);
            log.info("Welcome email sent to {}", safeRecipientEmail);
            return WelcomeEmailResult.delivered();
        } catch (Exception e) {
            log.error(
                    "Failed to send welcome email to {} (SMTP rejected or network error). "
                            + "For Gmail use an App Password and enable STARTTLS on port 587. Cause: {}",
                    safeRecipientEmail,
                    e.getMessage() != null ? e.getMessage() : e.getClass().getSimpleName(),
                    e
            );
            return WelcomeEmailResult.sendFailed();
        }
    }
}
