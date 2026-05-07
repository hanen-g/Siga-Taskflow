package com.taskflow.backend.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.Statement;

/**
 * Expands legacy MySQL {@code ENUM}/{@code VARCHAR} columns on {@code task} so all
 * {@link com.taskflow.backend.entity.TaskStatus} values persist (e.g. {@code IN_REVIEW}, {@code IN_PROGRESS}).
 * Hibernate {@code ddl-auto=update} often leaves an outdated MySQL ENUM in place.
 */
@Component
public class MysqlTaskEnumColumnsPatch {

    private static final Logger log = LoggerFactory.getLogger(MysqlTaskEnumColumnsPatch.class);

    private final DataSource dataSource;
    private final String jdbcUrl;

    public MysqlTaskEnumColumnsPatch(
            DataSource dataSource,
            @Value("${spring.datasource.url:}") String jdbcUrl
    ) {
        this.dataSource = dataSource;
        this.jdbcUrl = jdbcUrl;
    }

    @Order(Ordered.LOWEST_PRECEDENCE)
    @EventListener(ApplicationReadyEvent.class)
    public void widenTaskEnumColumns() {
        if (!isMysqlFamily(jdbcUrl)) {
            return;
        }
        runAlter("ALTER TABLE task MODIFY COLUMN status VARCHAR(32) NULL");
        runAlter("ALTER TABLE task MODIFY COLUMN priority VARCHAR(16) NULL");
    }

    private static boolean isMysqlFamily(String url) {
        if (url == null || url.isBlank()) {
            return false;
        }
        String u = url.toLowerCase();
        return u.startsWith("jdbc:mysql") || u.startsWith("jdbc:mariadb");
    }

    private void runAlter(String sql) {
        try (Connection c = dataSource.getConnection(); Statement st = c.createStatement()) {
            st.execute(sql);
            log.debug("Applied MySQL schema tweak: {}", sql);
        } catch (Exception ex) {
            log.warn(
                    "Could not apply MySQL task column tweak [{}]: {} — If saving task status fails, run the SQL from db/fix-mysql-task-status-column.sql manually.",
                    sql,
                    ex.getMessage()
            );
        }
    }
}
