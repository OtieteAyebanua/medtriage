-- ==========================================================
-- MedTriage AI Database Design
-- Chapter Three - Table 3.3.3.1: Healthcare Workers
-- ==========================================================

-- Table definition for Healthcare Workers
CREATE TABLE IF NOT EXISTS healthcare_workers (
    user_id INTEGER PRIMARY KEY AUTOINCREMENT,         -- INT, Unique identifier for each healthcare worker
    first_name VARCHAR(50) NOT NULL,                   -- VARCHAR(50), Worker's first name
    middle_name VARCHAR(50) NULL,                      -- VARCHAR(50), Worker's middle name
    last_name VARCHAR(50) NOT NULL,                    -- VARCHAR(50), Worker's last name
    employee_id VARCHAR(30) NOT NULL UNIQUE,           -- VARCHAR(30), Employee badge/ID number
    gender VARCHAR(10) NOT NULL,                       -- VARCHAR(10), Worker's gender
    email VARCHAR(100) NOT NULL UNIQUE,                -- VARCHAR(100), Worker's email address
    password_hash VARCHAR(255) NOT NULL,               -- VARCHAR(255), Hashed password for authentication
    position VARCHAR(30) NOT NULL CHECK (              -- VARCHAR(30), Role type
        position IN ('doctor', 'nurse', 'lab_tech', 'pharmacist', 'admin')
    ),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Performance & Unique Indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_healthcare_workers_employee_id 
ON healthcare_workers(employee_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_healthcare_workers_email 
ON healthcare_workers(email);

CREATE INDEX IF NOT EXISTS idx_healthcare_workers_position 
ON healthcare_workers(position);

-- Sample Initial Data (Seed Verification)
INSERT OR IGNORE INTO healthcare_workers 
(employee_id, first_name, middle_name, last_name, gender, email, password_hash, position)
VALUES 
('HW-DOC-001', 'Amina', 'Fatima', 'Bello', 'Female', 'amina.bello@hospital.lan', '$2a$10$wU0MsmG4Q/5zT/8F7E4f6edHwz7oV25Nq0PshH0nN1K8B1wz4gT4m', 'doctor'),
('HW-NUR-002', 'Grace', 'Chioma', 'Okafor', 'Female', 'grace.okafor@hospital.lan', '$2a$10$wU0MsmG4Q/5zT/8F7E4f6edHwz7oV25Nq0PshH0nN1K8B1wz4gT4m', 'nurse'),
('HW-NUR-003', 'Ibrahim', 'Musa', 'Danladi', 'Male', 'ibrahim.danladi@hospital.lan', '$2a$10$wU0MsmG4Q/5zT/8F7E4f6edHwz7oV25Nq0PshH0nN1K8B1wz4gT4m', 'nurse'),
('HW-LAB-004', 'Samuel', 'Olu', 'Adeyemi', 'Male', 'samuel.adeyemi@hospital.lan', '$2a$10$wU0MsmG4Q/5zT/8F7E4f6edHwz7oV25Nq0PshH0nN1K8B1wz4gT4m', 'lab_tech'),
('HW-ADM-005', 'Khadija', 'Zainab', 'Umar', 'Female', 'admin@hospital.lan', '$2a$10$wU0MsmG4Q/5zT/8F7E4f6edHwz7oV25Nq0PshH0nN1K8B1wz4gT4m', 'admin');
