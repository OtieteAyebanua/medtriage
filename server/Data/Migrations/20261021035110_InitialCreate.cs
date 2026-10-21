using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MedTriage.Server.Data.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "healthcare_workers",
                columns: table => new
                {
                    user_id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    first_name = table.Column<string>(type: "TEXT", maxLength: 50, nullable: false),
                    middle_name = table.Column<string>(type: "TEXT", maxLength: 50, nullable: true),
                    last_name = table.Column<string>(type: "TEXT", maxLength: 50, nullable: false),
                    employee_id = table.Column<string>(type: "TEXT", maxLength: 30, nullable: false),
                    gender = table.Column<string>(type: "TEXT", maxLength: 10, nullable: false),
                    email = table.Column<string>(type: "TEXT", maxLength: 100, nullable: false),
                    password_hash = table.Column<string>(type: "TEXT", nullable: false),
                    position = table.Column<string>(type: "TEXT", maxLength: 20, nullable: false),
                    created_at = table.Column<DateTime>(type: "TEXT", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_healthcare_workers", x => x.user_id);
                    table.CheckConstraint("ck_healthcare_workers_position", "position IN ('doctor', 'nurse', 'lab_tech', 'pharmacist', 'admin')");
                });

            migrationBuilder.CreateTable(
                name: "patients",
                columns: table => new
                {
                    patient_id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    first_name = table.Column<string>(type: "TEXT", maxLength: 50, nullable: false),
                    middle_name = table.Column<string>(type: "TEXT", maxLength: 50, nullable: true),
                    last_name = table.Column<string>(type: "TEXT", maxLength: 50, nullable: false),
                    date_of_birth = table.Column<DateOnly>(type: "TEXT", nullable: false),
                    gender = table.Column<string>(type: "TEXT", maxLength: 10, nullable: false),
                    email = table.Column<string>(type: "TEXT", maxLength: 100, nullable: true),
                    blood_type = table.Column<string>(type: "TEXT", maxLength: 3, nullable: false),
                    allergies = table.Column<string>(type: "TEXT", maxLength: 2000, nullable: true),
                    chronic_conditions = table.Column<string>(type: "TEXT", maxLength: 2000, nullable: true),
                    photo_path = table.Column<string>(type: "TEXT", maxLength: 255, nullable: true),
                    created_at = table.Column<DateTime>(type: "TEXT", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_patients", x => x.patient_id);
                    table.CheckConstraint("ck_patients_blood_type", "blood_type IN ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')");
                });

            migrationBuilder.CreateTable(
                name: "symptoms",
                columns: table => new
                {
                    symptom_id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    symptom_name = table.Column<string>(type: "TEXT", maxLength: 100, nullable: false),
                    category = table.Column<string>(type: "TEXT", maxLength: 50, nullable: false),
                    description = table.Column<string>(type: "TEXT", maxLength: 1000, nullable: false),
                    severity_scale = table.Column<int>(type: "INTEGER", nullable: false),
                    related_conditions = table.Column<string>(type: "TEXT", nullable: true),
                    synonyms = table.Column<string>(type: "TEXT", nullable: true),
                    follow_up_questions = table.Column<string>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_symptoms", x => x.symptom_id);
                    table.CheckConstraint("ck_symptoms_severity_scale", "severity_scale BETWEEN 1 AND 5");
                });

            migrationBuilder.CreateTable(
                name: "sessions",
                columns: table => new
                {
                    id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    token = table.Column<string>(type: "TEXT", maxLength: 100, nullable: false),
                    user_id = table.Column<int>(type: "INTEGER", nullable: false),
                    expires_at = table.Column<DateTime>(type: "TEXT", nullable: false),
                    created_at = table.Column<DateTime>(type: "TEXT", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_sessions", x => x.id);
                    table.ForeignKey(
                        name: "FK_sessions_healthcare_workers_user_id",
                        column: x => x.user_id,
                        principalTable: "healthcare_workers",
                        principalColumn: "user_id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "patient_records",
                columns: table => new
                {
                    record_id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    patient_id = table.Column<int>(type: "INTEGER", nullable: false),
                    recorded_by = table.Column<int>(type: "INTEGER", nullable: false),
                    visit_type = table.Column<string>(type: "TEXT", maxLength: 20, nullable: false),
                    chief_complaint = table.Column<string>(type: "TEXT", maxLength: 1000, nullable: false),
                    vitals_temperature = table.Column<double>(type: "REAL", nullable: true),
                    vitals_blood_pressure = table.Column<string>(type: "TEXT", maxLength: 7, nullable: true),
                    vitals_heart_rate = table.Column<int>(type: "INTEGER", nullable: true),
                    vitals_oxygen_level = table.Column<double>(type: "REAL", nullable: true),
                    vitals_respiratory_rate = table.Column<int>(type: "INTEGER", nullable: true),
                    ai_urgency_score = table.Column<int>(type: "INTEGER", nullable: false),
                    ai_triage_level = table.Column<string>(type: "TEXT", maxLength: 20, nullable: false),
                    ai_confidence = table.Column<double>(type: "REAL", nullable: true),
                    ai_reasoning = table.Column<string>(type: "TEXT", nullable: false),
                    ai_suggested_tests = table.Column<string>(type: "TEXT", nullable: true),
                    ai_differential_diagnosis = table.Column<string>(type: "TEXT", nullable: true),
                    assigned_to = table.Column<int>(type: "INTEGER", nullable: true),
                    override_status = table.Column<string>(type: "TEXT", maxLength: 20, nullable: false, defaultValue: "pending"),
                    override_reason = table.Column<string>(type: "TEXT", maxLength: 2000, nullable: true),
                    final_triage_level = table.Column<string>(type: "TEXT", maxLength: 20, nullable: true),
                    diagnosis = table.Column<string>(type: "TEXT", maxLength: 1000, nullable: true),
                    treated_by = table.Column<int>(type: "INTEGER", nullable: true),
                    status = table.Column<string>(type: "TEXT", maxLength: 20, nullable: false, defaultValue: "waiting"),
                    is_current = table.Column<bool>(type: "INTEGER", nullable: false),
                    visit_date = table.Column<DateTime>(type: "TEXT", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_patient_records", x => x.record_id);
                    table.CheckConstraint("ck_patient_records_ai_confidence", "ai_confidence IS NULL OR ai_confidence BETWEEN 0 AND 1");
                    table.CheckConstraint("ck_patient_records_ai_triage_level", "ai_triage_level IN ('immediate', 'emergent', 'urgent', 'less_urgent', 'non_urgent')");
                    table.CheckConstraint("ck_patient_records_ai_urgency_score", "ai_urgency_score BETWEEN 1 AND 5");
                    table.CheckConstraint("ck_patient_records_final_triage_level", "final_triage_level IS NULL OR final_triage_level IN ('immediate', 'emergent', 'urgent', 'less_urgent', 'non_urgent')");
                    table.CheckConstraint("ck_patient_records_override_status", "override_status IN ('pending', 'accepted', 'overridden')");
                    table.CheckConstraint("ck_patient_records_status", "status IN ('waiting', 'triaged', 'in_progress', 'treated', 'discharged', 'referred')");
                    table.CheckConstraint("ck_patient_records_visit_type", "visit_type IN ('walk_in', 'emergency', 'referral', 'follow_up')");
                    table.ForeignKey(
                        name: "FK_patient_records_healthcare_workers_assigned_to",
                        column: x => x.assigned_to,
                        principalTable: "healthcare_workers",
                        principalColumn: "user_id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_patient_records_healthcare_workers_recorded_by",
                        column: x => x.recorded_by,
                        principalTable: "healthcare_workers",
                        principalColumn: "user_id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_patient_records_healthcare_workers_treated_by",
                        column: x => x.treated_by,
                        principalTable: "healthcare_workers",
                        principalColumn: "user_id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_patient_records_patients_patient_id",
                        column: x => x.patient_id,
                        principalTable: "patients",
                        principalColumn: "patient_id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "record_symptoms",
                columns: table => new
                {
                    record_symptom_id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    record_id = table.Column<int>(type: "INTEGER", nullable: false),
                    symptom_id = table.Column<int>(type: "INTEGER", nullable: false),
                    severity = table.Column<string>(type: "TEXT", maxLength: 10, nullable: false),
                    duration = table.Column<string>(type: "TEXT", maxLength: 100, nullable: false),
                    notes = table.Column<string>(type: "TEXT", maxLength: 1000, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_record_symptoms", x => x.record_symptom_id);
                    table.CheckConstraint("ck_record_symptoms_severity", "severity IN ('mild', 'moderate', 'severe')");
                    table.ForeignKey(
                        name: "FK_record_symptoms_patient_records_record_id",
                        column: x => x.record_id,
                        principalTable: "patient_records",
                        principalColumn: "record_id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_record_symptoms_symptoms_symptom_id",
                        column: x => x.symptom_id,
                        principalTable: "symptoms",
                        principalColumn: "symptom_id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_healthcare_workers_email",
                table: "healthcare_workers",
                column: "email",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_healthcare_workers_employee_id",
                table: "healthcare_workers",
                column: "employee_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_patient_records_assigned_to",
                table: "patient_records",
                column: "assigned_to");

            migrationBuilder.CreateIndex(
                name: "IX_patient_records_is_current_override_status_ai_urgency_score_visit_date",
                table: "patient_records",
                columns: new[] { "is_current", "override_status", "ai_urgency_score", "visit_date" });

            migrationBuilder.CreateIndex(
                name: "IX_patient_records_patient_id_visit_date",
                table: "patient_records",
                columns: new[] { "patient_id", "visit_date" });

            migrationBuilder.CreateIndex(
                name: "IX_patient_records_recorded_by",
                table: "patient_records",
                column: "recorded_by");

            migrationBuilder.CreateIndex(
                name: "IX_patient_records_treated_by",
                table: "patient_records",
                column: "treated_by");

            migrationBuilder.CreateIndex(
                name: "IX_patient_records_visit_date",
                table: "patient_records",
                column: "visit_date");

            migrationBuilder.CreateIndex(
                name: "IX_patients_created_at",
                table: "patients",
                column: "created_at");

            migrationBuilder.CreateIndex(
                name: "IX_patients_last_name_first_name",
                table: "patients",
                columns: new[] { "last_name", "first_name" });

            migrationBuilder.CreateIndex(
                name: "IX_record_symptoms_record_id_symptom_id",
                table: "record_symptoms",
                columns: new[] { "record_id", "symptom_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_record_symptoms_symptom_id",
                table: "record_symptoms",
                column: "symptom_id");

            migrationBuilder.CreateIndex(
                name: "IX_sessions_token",
                table: "sessions",
                column: "token",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_sessions_user_id",
                table: "sessions",
                column: "user_id");

            migrationBuilder.CreateIndex(
                name: "IX_symptoms_category",
                table: "symptoms",
                column: "category");

            migrationBuilder.CreateIndex(
                name: "IX_symptoms_symptom_name",
                table: "symptoms",
                column: "symptom_name",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "record_symptoms");

            migrationBuilder.DropTable(
                name: "sessions");

            migrationBuilder.DropTable(
                name: "patient_records");

            migrationBuilder.DropTable(
                name: "symptoms");

            migrationBuilder.DropTable(
                name: "healthcare_workers");

            migrationBuilder.DropTable(
                name: "patients");
        }
    }
}
