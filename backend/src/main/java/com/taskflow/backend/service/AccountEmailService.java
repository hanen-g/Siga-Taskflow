package com.taskflow.backend.service;

import jakarta.annotation.PostConstruct;
import jakarta.mail.internet.MimeMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.mail.MailProperties;
import org.springframework.core.io.ClassPathResource;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.nio.charset.StandardCharsets;
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
    private static final String LOGO_CONTENT_ID = "taskflowLogo";
    private static final ClassPathResource LOGO_RESOURCE =
            new ClassPathResource("email/logo-taskflow.png");

    private final JavaMailSender mailSender;
    private final MailProperties springMailProperties;
    private final EmailTemplateRenderer emailTemplateRenderer;
    private final String mailHost;
    private final String mailUsername;
    private final String mailPassword;
    private final String fromAddress;
    private final String appBaseUrl;

    public AccountEmailService(
            @Autowired(required = false) JavaMailSender mailSender,
            @Autowired(required = false) MailProperties springMailProperties,
            EmailTemplateRenderer emailTemplateRenderer,
            @Value("${spring.mail.host:}") String mailHost,
            @Value("${spring.mail.username:}") String mailUsername,
            @Value("${spring.mail.password:}") String mailPassword,
            @Value("${taskflow.mail.from:}") String fromAddress,
            @Value("${taskflow.app.base-url:http://localhost:4200}") String appBaseUrl
    ) {
        this.mailSender = mailSender;
        this.springMailProperties = springMailProperties;
        this.emailTemplateRenderer = emailTemplateRenderer;
        this.mailHost = mailHost;
        this.mailUsername = mailUsername;
        this.mailPassword = mailPassword;
        this.fromAddress = fromAddress;
        String normalizedBaseUrl = StringUtils.hasText(appBaseUrl) ? appBaseUrl.trim() : DEFAULT_APP_BASE_URL;
        this.appBaseUrl = normalizedBaseUrl.replaceAll("/+$", "");
    }

    @PostConstruct
    void logMailConfigurationOnStartup() {
        if (isMailConfigured()) {
            log.info(
                    "SMTP configured: host={}, port={}, username={}, from={}",
                    resolvedHost(),
                    springMailProperties != null ? springMailProperties.getPort() : "(default)",
                    resolvedUsername(),
                    effectiveFrom()
            );
        } else {
            log.warn(
                    "SMTP not configured (welcome emails will fail until fixed): {}. "
                            + "Copy application-local.properties.example to application-local.properties "
                            + "or set MAIL_USERNAME and MAIL_PASSWORD.",
                    describeMailConfigurationGaps()
            );
        }
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

        String plainBody = buildWelcomePlainText(
                safeFirstName, safeRoleLabel, loginUrl, safeRecipientEmail, temporaryPassword);
        String htmlBody = emailTemplateRenderer.renderWelcome(
                safeFirstName, safeRoleLabel, loginUrl, safeRecipientEmail, temporaryPassword);

        return deliverOrLog(
                safeRecipientEmail,
                "Your TaskFlow account",
                plainBody,
                htmlBody,
                "Welcome email",
                "Credentials are still logged below at INFO when mail is disabled."
        );
    }

    /**
     * Sends a password-reset email when SMTP is fully configured; otherwise skips and logs the reason.
     */
    public WelcomeEmailResult sendPasswordResetEmail(
            String recipientEmail,
            String firstName,
            String newPassword
    ) {
        if (!StringUtils.hasText(recipientEmail)) {
            log.warn("Skipping password-reset email because the recipient address is blank.");
            return WelcomeEmailResult.sendFailed();
        }

        String safeRecipientEmail = recipientEmail.trim();
        String safeFirstName = StringUtils.hasText(firstName) ? firstName.trim() : "there";
        String loginUrl = appBaseUrl + "/login";

        String plainBody = buildPasswordResetPlainText(
                safeFirstName, loginUrl, safeRecipientEmail, newPassword);
        String htmlBody = emailTemplateRenderer.renderPasswordReset(
                safeFirstName, loginUrl, safeRecipientEmail, newPassword);

        return deliverOrLog(
                safeRecipientEmail,
                "Your TaskFlow password has been reset",
                plainBody,
                htmlBody,
                "Password-reset email",
                "New password is still logged below at INFO when mail is disabled."
        );
    }

    private WelcomeEmailResult deliverOrLog(
            String recipientEmail,
            String subject,
            String plainBody,
            String htmlBody,
            String emailLabel,
            String disabledHint
    ) {
        if (!isMailConfigured()) {
            log.warn(
                    "{} not sent (mail not fully configured). Reasons: {}. "
                            + "Fix: set spring.mail.host, spring.mail.username, spring.mail.password, "
                            + "and taskflow.mail.from (or omit taskflow.mail.from to use the SMTP username as From). "
                            + "{}",
                    emailLabel,
                    describeMailConfigurationGaps(),
                    disabledHint
            );
            log.info("[Mail disabled] Would email {} (subject: {}):\n{}", recipientEmail, subject, plainBody);
            return WelcomeEmailResult.notConfigured();
        }

        try {
            MimeMessage mimeMessage = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(
                    mimeMessage,
                    MimeMessageHelper.MULTIPART_MODE_MIXED_RELATED,
                    StandardCharsets.UTF_8.name()
            );
            helper.setFrom(effectiveFrom());
            helper.setTo(recipientEmail);
            helper.setSubject(subject);
            helper.setText(plainBody, htmlBody);
            if (LOGO_RESOURCE.exists()) {
                helper.addInline(LOGO_CONTENT_ID, LOGO_RESOURCE, "image/png");
            } else {
                log.warn("Email logo not found at classpath:email/logo-taskflow.png — sending without inline logo.");
            }
            mailSender.send(mimeMessage);
            log.info("{} sent to {}", emailLabel, recipientEmail);
            return WelcomeEmailResult.delivered();
        } catch (Exception e) {
            boolean isWelcome = emailLabel.contains("Welcome");
            log.error(
                    "Failed to send {} to {}. {}{}",
                    emailLabel.toLowerCase(),
                    recipientEmail,
                    isWelcome ? gmailAuthHint(e) : "",
                    e.getMessage() != null ? " Cause: " + e.getMessage() : "",
                    e
            );
            return WelcomeEmailResult.sendFailed();
        }
    }

    private static String buildWelcomePlainText(
            String firstName,
            String roleLabel,
            String loginUrl,
            String recipientEmail,
            String temporaryPassword
    ) {
        return String.format(
                "Hello %s,\n\n"
                        + "A TaskFlow account has been created for you.\n"
                        + "Role: %s\n\n"
                        + "Sign in: %s\n"
                        + "Email (login): %s\n"
                        + "Temporary password: %s\n\n"
                        + "Please sign in and change your password from your profile when possible.\n\n"
                        + "-- TaskFlow",
                firstName,
                roleLabel,
                loginUrl,
                recipientEmail,
                temporaryPassword
        );
    }

    private static String buildPasswordResetPlainText(
            String firstName,
            String loginUrl,
            String recipientEmail,
            String newPassword
    ) {
        return String.format(
                "Hello %s,\n\n"
                        + "You requested a new password for your TaskFlow account.\n\n"
                        + "Sign in: %s\n"
                        + "Email (login): %s\n"
                        + "New password: %s\n\n"
                        + "If you did not request this change, contact your administrator immediately.\n\n"
                        + "-- TaskFlow",
                firstName,
                loginUrl,
                recipientEmail,
                newPassword
        );
    }

    private static String gmailAuthHint(Throwable e) {
        Throwable current = e;
        while (current != null) {
            String message = current.getMessage();
            if (message != null
                    && (message.contains("535") || message.contains("AuthenticationFailed"))) {
                return "Gmail rejected the password — create a new App Password at "
                        + "https://myaccount.google.com/apppasswords (16 characters, 2FA required). "
                        + "Set spring.mail.password or MAIL_PASSWORD; do not use your normal Gmail password.";
            }
            current = current.getCause();
        }
        return "For Gmail use an App Password on port 587 with STARTTLS.";
    }
}
