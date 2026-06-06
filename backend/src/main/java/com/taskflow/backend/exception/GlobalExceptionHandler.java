package com.taskflow.backend.exception;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.ResponseStatus;

import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

/**
 * Central place to convert exceptions into JSON error responses.  The
 * {@code @ResponseStatus} annotations on the custom exceptions handle most
 * cases automatically, but this advice also ensures a consistent payload and
 * can map other built-in exceptions.
 */
@ControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<Map<String, String>> handleMaxUploadSize(MaxUploadSizeExceededException ex) {
        Map<String, String> body = new HashMap<>();
        body.put("error", "Uploaded file is too large");
        return new ResponseEntity<>(body, HttpStatus.PAYLOAD_TOO_LARGE);
    }

    /**
     * E.g. duplicate email, FK violations, or MySQL ENUM / column width rejecting role values like PROJECT_MANAGER.
     */
    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<Map<String, String>> handleDataIntegrity(DataIntegrityViolationException ex) {
        Throwable cause = ex.getMostSpecificCause();
        String raw = cause != null ? cause.getMessage() : ex.getMessage();
        String msg = "Unable to save this user. Check that the email is unique and the role is accepted by the database.";
        if (raw != null) {
            String low = raw.toLowerCase(Locale.ROOT);
            if (low.contains("duplicate") || low.contains("unique")) {
                msg = "Email already exists";
            } else if (low.contains("data truncated") || low.contains("truncated")) {
                msg = "The database refused the stored role (often a too-narrow MySQL ENUM or column). "
                        + "Run: ALTER TABLE users MODIFY COLUMN role VARCHAR(64); then restart the app.";
            }
        }
        Map<String, String> body = new HashMap<>();
        body.put("message", msg);
        return new ResponseEntity<>(body, HttpStatus.BAD_REQUEST);
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<Map<String, String>> handleAccessDenied(AccessDeniedException ex) {
        Map<String, String> body = new HashMap<>();
        body.put("error", ex.getMessage() != null ? ex.getMessage() : "Access Denied");
        return new ResponseEntity<>(body, HttpStatus.FORBIDDEN);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, String>> handleAny(Exception ex) {
        HttpStatus status = HttpStatus.INTERNAL_SERVER_ERROR;

        // if the exception already has a @ResponseStatus use that value
        ResponseStatus rs = ex.getClass().getAnnotation(ResponseStatus.class);
        if (rs != null) {
            status = rs.value();
        }

        Map<String, String> body = new HashMap<>();
        body.put("error", ex.getMessage());
        return new ResponseEntity<>(body, status);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public Map<String, String> handleValidation(MethodArgumentNotValidException ex) {
        Map<String, String> errors = new HashMap<>();
        ex.getBindingResult().getFieldErrors()
                .forEach(error -> errors.put(error.getField(), error.getDefaultMessage()));
        return errors;
    }
}
