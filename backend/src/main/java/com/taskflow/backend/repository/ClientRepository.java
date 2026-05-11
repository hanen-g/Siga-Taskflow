package com.taskflow.backend.repository;

import com.taskflow.backend.entity.Client;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface ClientRepository extends JpaRepository<Client, Long> {

    Optional<Client> findByUser_Id(Long userId);

    List<Client> findAllByUser_IdIn(Collection<Long> userIds);

    void deleteByUser_Id(Long userId);
}
