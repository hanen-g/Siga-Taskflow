package com.taskflow.backend.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(name = "company")
public class Company {

    @Id
    @Column(name = "tax_registration_number", length = 128, nullable = false)
    private String taxRegistrationNumber;

    @Column(name = "company_name", nullable = false, length = 255)
    private String companyName;
}
