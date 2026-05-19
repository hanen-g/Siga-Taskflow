package com.taskflow.backend.service;

import com.taskflow.backend.entity.Company;
import com.taskflow.backend.entity.User;
import com.taskflow.backend.exception.BadRequestException;
import com.taskflow.backend.repository.CompanyRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

@Service
@RequiredArgsConstructor
public class CompanyService {

    private final CompanyRepository companyRepository;

    /**
     * Links a client user to a company row. Tax id is required; company name is required only when
     * creating a new company row.
     */
    @Transactional
    public Company client_company(String taxRegistrationNumber, String companyName) {
        String tax = trimToNull(taxRegistrationNumber);
        if (tax == null) {
            return null;
        }
        String name = trimToNull(companyName);
        Optional<Company> existing = companyRepository.findById(tax);
        if (existing.isPresent()) {
            Company c = existing.get();
            if (name != null && !name.equals(c.getCompanyName())) {
                c.setCompanyName(name);
                return companyRepository.save(c);
            }
            return c;
        }
        if (name == null) {
            throw new BadRequestException("Company name is required when using a new tax registration number.");
        }
        Company created = new Company();
        created.setTaxRegistrationNumber(tax);
        created.setCompanyName(name);
        return companyRepository.save(created);
    }

    @Transactional
    public void renameCompany(User user, String companyName) {
        if (user.getCompany() == null) {
            return;
        }
        String name = trimToNull(companyName);
        if (name == null) {
            return;
        }
        Company c = user.getCompany();
        c.setCompanyName(name);
        companyRepository.save(c);
    }

    private static String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String t = value.trim();
        return t.isEmpty() ? null : t;
    }
}
