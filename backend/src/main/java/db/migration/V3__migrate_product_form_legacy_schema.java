package db.migration;

import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;

public class V3__migrate_product_form_legacy_schema extends BaseJavaMigration {

    @Override
    public void migrate(Context context) throws Exception {
        Connection connection = context.getConnection();
        if (tableExists(connection, "product_form_template_fields")
                && !tableExists(connection, "product_form_custom_fields")) {
            execute(connection,
                    "RENAME TABLE `product_form_template_fields` TO `product_form_custom_fields`");
        }

        for (ForeignKey foreignKey : legacyForeignKeys(connection)) {
            execute(connection, "ALTER TABLE `" + safeIdentifier(foreignKey.tableName)
                    + "` DROP FOREIGN KEY `" + safeIdentifier(foreignKey.constraintName) + "`");
        }

        if (columnExists(connection, "product_form_custom_fields", "template_id")) {
            execute(connection, "ALTER TABLE `product_form_custom_fields` DROP COLUMN `template_id`");
        }
    }

    private List<ForeignKey> legacyForeignKeys(Connection connection) throws SQLException {
        String sql = """
                SELECT TABLE_NAME, CONSTRAINT_NAME
                FROM information_schema.KEY_COLUMN_USAGE
                WHERE TABLE_SCHEMA = DATABASE()
                  AND REFERENCED_TABLE_NAME IN ('product_form_template_fields', 'product_form_templates')
                """;
        List<ForeignKey> result = new ArrayList<>();
        try (PreparedStatement statement = connection.prepareStatement(sql);
             ResultSet rows = statement.executeQuery()) {
            while (rows.next()) {
                result.add(new ForeignKey(rows.getString(1), rows.getString(2)));
            }
        }
        return result;
    }

    private boolean tableExists(Connection connection, String tableName) throws SQLException {
        try (ResultSet tables = connection.getMetaData().getTables(
                connection.getCatalog(), null, tableName, new String[]{"TABLE"})) {
            return tables.next();
        }
    }

    private boolean columnExists(Connection connection, String tableName, String columnName) throws SQLException {
        try (ResultSet columns = connection.getMetaData().getColumns(
                connection.getCatalog(), null, tableName, columnName)) {
            return columns.next();
        }
    }

    private void execute(Connection connection, String sql) throws SQLException {
        try (Statement statement = connection.createStatement()) {
            statement.execute(sql);
        }
    }

    private String safeIdentifier(String value) {
        if (value == null || !value.matches("[A-Za-z0-9_]+")) {
            throw new IllegalArgumentException("Unsafe database identifier");
        }
        return value;
    }

    private record ForeignKey(String tableName, String constraintName) {
    }
}
