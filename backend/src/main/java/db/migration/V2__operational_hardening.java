package db.migration;

import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;

import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;

public class V2__operational_hardening extends BaseJavaMigration {

    @Override
    public void migrate(Context context) throws Exception {
        Connection connection = context.getConnection();
        execute(connection, """
                CREATE TABLE IF NOT EXISTS audit_events (
                    id BIGINT NOT NULL AUTO_INCREMENT,
                    actor_user_id BIGINT NULL,
                    actor_email VARCHAR(190) NULL,
                    http_method VARCHAR(10) NOT NULL,
                    request_path VARCHAR(500) NOT NULL,
                    response_status INT NOT NULL,
                    request_id VARCHAR(100) NULL,
                    remote_address VARCHAR(64) NULL,
                    occurred_at DATETIME(6) NOT NULL,
                    PRIMARY KEY (id),
                    INDEX idx_audit_event_occurred_at (occurred_at),
                    INDEX idx_audit_event_actor (actor_user_id, occurred_at)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
                """);

        createIndexIfMissing(connection, "orders", "idx_orders_shop_status_created",
                "shop_id, status, created_at");
        createIndexIfMissing(connection, "orders", "idx_orders_shop_type_created",
                "shop_id, order_type, created_at");
        createIndexIfMissing(connection, "orders", "idx_orders_created_by_created",
                "created_by_id, created_at");
        createIndexIfMissing(connection, "orders", "idx_orders_payment_timeout",
                "status, payment_status, payment_method, created_at");
        createIndexIfMissing(connection, "products", "idx_products_shop_active",
                "shop_id, is_active");
        createIndexIfMissing(connection, "products", "idx_products_shop_type",
                "shop_id, product_type");
        createIndexIfMissing(connection, "users", "idx_users_shop_role_active",
                "shop_id, role, is_active");
    }

    private void createIndexIfMissing(Connection connection, String table, String index, String columns)
            throws SQLException {
        if (indexExists(connection, table, index)) {
            return;
        }
        execute(connection, "CREATE INDEX `" + index + "` ON `" + table + "` (" + columns + ")");
    }

    private boolean indexExists(Connection connection, String table, String index) throws SQLException {
        try (ResultSet indexes = connection.getMetaData().getIndexInfo(
                connection.getCatalog(), null, table, false, false)) {
            while (indexes.next()) {
                if (index.equalsIgnoreCase(indexes.getString("INDEX_NAME"))) {
                    return true;
                }
            }
        }
        return false;
    }

    private void execute(Connection connection, String sql) throws SQLException {
        try (Statement statement = connection.createStatement()) {
            statement.execute(sql);
        }
    }
}
