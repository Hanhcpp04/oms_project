package com.oms.module.productform.service;

import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class ProductFormMigrationService {

    private final JdbcTemplate jdbcTemplate;

    @PostConstruct
    public void migrate() {
        log.info("Running manual database migration for Product Form module...");
        
        // 1. Check if product_form_template_fields exists and has data
        boolean oldTableExists = false;
        try {
            jdbcTemplate.execute("SELECT 1 FROM product_form_template_fields LIMIT 1");
            oldTableExists = true;
        } catch (Exception e) {
            // Table doesn't exist or is empty
        }

        if (oldTableExists) {
            log.info("Old table product_form_template_fields exists. Checking if migration is needed.");
            // Check if new table exists
            boolean newTableExists = false;
            try {
                jdbcTemplate.execute("SELECT 1 FROM product_form_custom_fields LIMIT 1");
                newTableExists = true;
            } catch (Exception e) {}

            if (!newTableExists) {
                log.info("Renaming product_form_template_fields to product_form_custom_fields");
                try {
                    jdbcTemplate.execute("RENAME TABLE product_form_template_fields TO product_form_custom_fields");
                } catch (Exception e) {
                    log.error("Failed to rename table: {}", e.getMessage());
                }
            }
        }

        // 2. Drop any old constraints pointing to old tables across ALL tables
        String[] oldTables = {"product_form_template_fields", "product_form_templates"};
        for (String oldTable : oldTables) {
            try {
                // On MySQL, we can find all constraints referencing the old table
                List<Map<String, Object>> constraints = jdbcTemplate.queryForList(
                    "SELECT TABLE_NAME, CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE " +
                    "WHERE REFERENCED_TABLE_NAME = ? " +
                    "AND TABLE_SCHEMA = DATABASE()",
                    oldTable
                );
                
                for (Map<String, Object> row : constraints) {
                    String tableName = (String) row.get("TABLE_NAME");
                    String constraintName = (String) row.get("CONSTRAINT_NAME");
                    log.info("Dropping old constraint {} on table {} (references {})", constraintName, tableName, oldTable);
                    try {
                        jdbcTemplate.execute("ALTER TABLE " + tableName + " DROP FOREIGN KEY " + constraintName);
                    } catch (Exception e) {
                        log.error("Failed to drop constraint {} on table {}: {}", constraintName, tableName, e.getMessage());
                    }
                }
            } catch (Exception e) {
                log.debug("Error while trying to query old constraints for {}: {}", oldTable, e.getMessage());
            }
        }

        // 3. Ensure template_id is dropped if it exists in the new table (after rename or if Hibernate added it)
        try {
            jdbcTemplate.execute("ALTER TABLE product_form_custom_fields DROP COLUMN template_id");
            log.info("Dropped old column template_id from product_form_custom_fields");
        } catch (Exception e) {
            // Ignore if column doesn't exist
        }
    }
}
