package db.migration;

import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;

import java.sql.Statement;

public class V4__messenger_outbound_queue extends BaseJavaMigration {

    @Override
    public void migrate(Context context) throws Exception {
        try (Statement statement = context.getConnection().createStatement()) {
            statement.execute("""
                    CREATE TABLE IF NOT EXISTS messenger_outbound_queue (
                        id BIGINT NOT NULL AUTO_INCREMENT,
                        page_id VARCHAR(100) NOT NULL,
                        recipient_id VARCHAR(100) NOT NULL,
                        payload_type VARCHAR(20) NOT NULL,
                        payload TEXT NOT NULL,
                        attempts INT NOT NULL DEFAULT 0,
                        next_attempt_at DATETIME(6) NOT NULL,
                        status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
                        last_error VARCHAR(500) NULL,
                        created_at DATETIME(6) NOT NULL,
                        updated_at DATETIME(6) NULL,
                        PRIMARY KEY (id),
                        INDEX idx_messenger_outbound_queue_due (status, next_attempt_at)
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
                    """);
        }
    }
}
