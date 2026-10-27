using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MedTriage.Server.Data.Migrations
{
    /// <inheritdoc />
    public partial class AdminConsole : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "department",
                table: "healthcare_workers",
                type: "TEXT",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "is_active",
                table: "healthcare_workers",
                type: "INTEGER",
                nullable: false,
                // Existing staff stay able to sign in
                defaultValue: true);

            migrationBuilder.AddColumn<DateOnly>(
                name: "license_expiry",
                table: "healthcare_workers",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "license_number",
                table: "healthcare_workers",
                type: "TEXT",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "phone",
                table: "healthcare_workers",
                type: "TEXT",
                maxLength: 30,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "verified_at",
                table: "healthcare_workers",
                type: "TEXT",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "admin_sessions",
                columns: table => new
                {
                    id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    token = table.Column<string>(type: "TEXT", maxLength: 100, nullable: false),
                    expires_at = table.Column<DateTime>(type: "TEXT", nullable: false),
                    created_at = table.Column<DateTime>(type: "TEXT", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_admin_sessions", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_admin_sessions_token",
                table: "admin_sessions",
                column: "token",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "admin_sessions");

            migrationBuilder.DropColumn(
                name: "department",
                table: "healthcare_workers");

            migrationBuilder.DropColumn(
                name: "is_active",
                table: "healthcare_workers");

            migrationBuilder.DropColumn(
                name: "license_expiry",
                table: "healthcare_workers");

            migrationBuilder.DropColumn(
                name: "license_number",
                table: "healthcare_workers");

            migrationBuilder.DropColumn(
                name: "phone",
                table: "healthcare_workers");

            migrationBuilder.DropColumn(
                name: "verified_at",
                table: "healthcare_workers");
        }
    }
}
