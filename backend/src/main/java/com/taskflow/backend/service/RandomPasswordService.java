package com.taskflow.backend.service;

import org.springframework.stereotype.Service;

import java.security.SecureRandom;

/**
 * Cryptographically strong temporary passwords for admin-provisioned accounts.
 */
@Service
public class RandomPasswordService {

    private static final String ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@%^&*-_=+";
    private static final int DEFAULT_LENGTH = 8;

    private final SecureRandom random = new SecureRandom();

    public String generateTemporaryPassword() {
        return generateTemporaryPassword(DEFAULT_LENGTH);
    }

    public String generateTemporaryPassword(int length) {
        int n = length < 12 ? 12 : length;
        StringBuilder sb = new StringBuilder(n);
        for (int i = 0; i < n; i++) {
            sb.append(ALPHABET.charAt(random.nextInt(ALPHABET.length())));
        }
        return sb.toString();
    }
}
