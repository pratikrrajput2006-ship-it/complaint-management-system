CREATE DATABASE IF NOT EXISTS complaint_management_system;

USE complaint_management_system;

CREATE TABLE user (
    user_id VARCHAR(10) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(30) NOT NULL,
    phone VARCHAR(15),
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE admin (
    admin_id VARCHAR(10) PRIMARY KEY,
    employee_no VARCHAR(10) NOT NULL UNIQUE,
    designation VARCHAR(50) NOT NULL,
    FOREIGN KEY (admin_id) REFERENCES user(user_id)
);

CREATE TABLE id_sequence(
    role VARCHAR(30) PRIMARY KEY,
    next_number INT NOT NULL
);