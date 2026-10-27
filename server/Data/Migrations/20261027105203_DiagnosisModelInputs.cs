using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MedTriage.Server.Data.Migrations
{
    /// <inheritdoc />
    public partial class DiagnosisModelInputs : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "abdominal_pain",
                table: "patient_records",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "avpu",
                table: "patient_records",
                type: "TEXT",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "bleeding",
                table: "patient_records",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "blood_in_sputum",
                table: "patient_records",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "chest_pain",
                table: "patient_records",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "chills",
                table: "patient_records",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "constipation",
                table: "patient_records",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "convulsions",
                table: "patient_records",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "cough",
                table: "patient_records",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "dark_urine",
                table: "patient_records",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "days_febrile",
                table: "patient_records",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "dehydration",
                table: "patient_records",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "diarrhea",
                table: "patient_records",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "difficulty_breathing",
                table: "patient_records",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "dysuria",
                table: "patient_records",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "fatigue",
                table: "patient_records",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "headache",
                table: "patient_records",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "itching",
                table: "patient_records",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "jaundice",
                table: "patient_records",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "joint_muscle_pain",
                table: "patient_records",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "loss_of_appetite",
                table: "patient_records",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "loss_of_smell",
                table: "patient_records",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "mobility",
                table: "patient_records",
                type: "TEXT",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "nausea",
                table: "patient_records",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "neck_stiffness",
                table: "patient_records",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "pain_behind_eyes",
                table: "patient_records",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "pregnant",
                table: "patient_records",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "rainy_season",
                table: "patient_records",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "rash",
                table: "patient_records",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "red_eyes",
                table: "patient_records",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "runny_nose",
                table: "patient_records",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "sore_throat",
                table: "patient_records",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "sputum",
                table: "patient_records",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "sweating",
                table: "patient_records",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "swollen_lymph_nodes",
                table: "patient_records",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "tews_score",
                table: "patient_records",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "triage_category",
                table: "patient_records",
                type: "TEXT",
                maxLength: 10,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "urinary_frequency",
                table: "patient_records",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "vomiting",
                table: "patient_records",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "weight_loss",
                table: "patient_records",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddCheckConstraint(
                name: "ck_patient_records_avpu",
                table: "patient_records",
                sql: "avpu IS NULL OR avpu IN ('alert', 'voice', 'pain', 'unresponsive')");

            migrationBuilder.AddCheckConstraint(
                name: "ck_patient_records_days_febrile",
                table: "patient_records",
                sql: "days_febrile IS NULL OR days_febrile >= 0");

            migrationBuilder.AddCheckConstraint(
                name: "ck_patient_records_mobility",
                table: "patient_records",
                sql: "mobility IS NULL OR mobility IN ('walking', 'with_help', 'immobile')");

            migrationBuilder.AddCheckConstraint(
                name: "ck_patient_records_tews_score",
                table: "patient_records",
                sql: "tews_score IS NULL OR tews_score >= 0");

            migrationBuilder.AddCheckConstraint(
                name: "ck_patient_records_triage_category",
                table: "patient_records",
                sql: "triage_category IS NULL OR triage_category IN ('red', 'orange', 'yellow', 'green')");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "ck_patient_records_avpu",
                table: "patient_records");

            migrationBuilder.DropCheckConstraint(
                name: "ck_patient_records_days_febrile",
                table: "patient_records");

            migrationBuilder.DropCheckConstraint(
                name: "ck_patient_records_mobility",
                table: "patient_records");

            migrationBuilder.DropCheckConstraint(
                name: "ck_patient_records_tews_score",
                table: "patient_records");

            migrationBuilder.DropCheckConstraint(
                name: "ck_patient_records_triage_category",
                table: "patient_records");

            migrationBuilder.DropColumn(
                name: "abdominal_pain",
                table: "patient_records");

            migrationBuilder.DropColumn(
                name: "avpu",
                table: "patient_records");

            migrationBuilder.DropColumn(
                name: "bleeding",
                table: "patient_records");

            migrationBuilder.DropColumn(
                name: "blood_in_sputum",
                table: "patient_records");

            migrationBuilder.DropColumn(
                name: "chest_pain",
                table: "patient_records");

            migrationBuilder.DropColumn(
                name: "chills",
                table: "patient_records");

            migrationBuilder.DropColumn(
                name: "constipation",
                table: "patient_records");

            migrationBuilder.DropColumn(
                name: "convulsions",
                table: "patient_records");

            migrationBuilder.DropColumn(
                name: "cough",
                table: "patient_records");

            migrationBuilder.DropColumn(
                name: "dark_urine",
                table: "patient_records");

            migrationBuilder.DropColumn(
                name: "days_febrile",
                table: "patient_records");

            migrationBuilder.DropColumn(
                name: "dehydration",
                table: "patient_records");

            migrationBuilder.DropColumn(
                name: "diarrhea",
                table: "patient_records");

            migrationBuilder.DropColumn(
                name: "difficulty_breathing",
                table: "patient_records");

            migrationBuilder.DropColumn(
                name: "dysuria",
                table: "patient_records");

            migrationBuilder.DropColumn(
                name: "fatigue",
                table: "patient_records");

            migrationBuilder.DropColumn(
                name: "headache",
                table: "patient_records");

            migrationBuilder.DropColumn(
                name: "itching",
                table: "patient_records");

            migrationBuilder.DropColumn(
                name: "jaundice",
                table: "patient_records");

            migrationBuilder.DropColumn(
                name: "joint_muscle_pain",
                table: "patient_records");

            migrationBuilder.DropColumn(
                name: "loss_of_appetite",
                table: "patient_records");

            migrationBuilder.DropColumn(
                name: "loss_of_smell",
                table: "patient_records");

            migrationBuilder.DropColumn(
                name: "mobility",
                table: "patient_records");

            migrationBuilder.DropColumn(
                name: "nausea",
                table: "patient_records");

            migrationBuilder.DropColumn(
                name: "neck_stiffness",
                table: "patient_records");

            migrationBuilder.DropColumn(
                name: "pain_behind_eyes",
                table: "patient_records");

            migrationBuilder.DropColumn(
                name: "pregnant",
                table: "patient_records");

            migrationBuilder.DropColumn(
                name: "rainy_season",
                table: "patient_records");

            migrationBuilder.DropColumn(
                name: "rash",
                table: "patient_records");

            migrationBuilder.DropColumn(
                name: "red_eyes",
                table: "patient_records");

            migrationBuilder.DropColumn(
                name: "runny_nose",
                table: "patient_records");

            migrationBuilder.DropColumn(
                name: "sore_throat",
                table: "patient_records");

            migrationBuilder.DropColumn(
                name: "sputum",
                table: "patient_records");

            migrationBuilder.DropColumn(
                name: "sweating",
                table: "patient_records");

            migrationBuilder.DropColumn(
                name: "swollen_lymph_nodes",
                table: "patient_records");

            migrationBuilder.DropColumn(
                name: "tews_score",
                table: "patient_records");

            migrationBuilder.DropColumn(
                name: "triage_category",
                table: "patient_records");

            migrationBuilder.DropColumn(
                name: "urinary_frequency",
                table: "patient_records");

            migrationBuilder.DropColumn(
                name: "vomiting",
                table: "patient_records");

            migrationBuilder.DropColumn(
                name: "weight_loss",
                table: "patient_records");
        }
    }
}
