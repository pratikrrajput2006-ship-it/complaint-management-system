CREATE DATABASE IF NOT EXISTS cms_demo;

USE cms_demo;

CREATE TABLE
    user (
        user_id VARCHAR(10) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(150) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(30) NOT NULL,
        phone VARCHAR(15),
        status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

CREATE TABLE
    admin (
        admin_id VARCHAR(10) PRIMARY KEY,
        employee_no VARCHAR(10) NOT NULL UNIQUE,
        designation VARCHAR(50) NOT NULL,
        FOREIGN KEY (admin_id) REFERENCES user (user_id)
    );

CREATE TABLE
    id_sequence (
        role VARCHAR(30) PRIMARY KEY,
        next_number INT NOT NULL
    );

INSERT IGNORE INTO id_sequence (role, next_number)
VALUES
    ('ADMIN', 1),
    ('CATEGORY', 1),
    ('COMPLAINT', 1),
    ('DEPARTMENT', 1),
    ('STAFF', 1),
    ('STUDENT', 1),
    ('FEEDBACK', 1),
    ('NOTIFICATION', 1);

CREATE TABLE
    department (
        department_id VARCHAR(10) PRIMARY KEY,
        department_name VARCHAR(100) NOT NULL UNIQUE,
        status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

CREATE TABLE
    staff (
        staff_id VARCHAR(10) PRIMARY KEY,
        employee_no VARCHAR(10) NOT NULL UNIQUE,
        department_id VARCHAR(10) NOT NULL,
        designation VARCHAR(50) NOT NULL,
        ha_status VARCHAR(20) NOT NULL DEFAULT 'NONE',
        FOREIGN KEY (staff_id) REFERENCES user (user_id) ON DELETE CASCADE ON UPDATE CASCADE,
        FOREIGN KEY (department_id) REFERENCES department (department_id) ON UPDATE CASCADE
    );

CREATE TABLE
    student (
        student_id VARCHAR(10) PRIMARY KEY,
        prn VARCHAR(20) NOT NULL UNIQUE,
        department_id VARCHAR(10) NOT NULL,
        course VARCHAR(100),
        year INT,
        address VARCHAR(255),
        FOREIGN KEY (student_id) REFERENCES user (user_id) ON DELETE CASCADE ON UPDATE CASCADE,
        FOREIGN KEY (department_id) REFERENCES department (department_id) ON UPDATE CASCADE
    );

CREATE TABLE
    ha_history (
        history_id INT AUTO_INCREMENT PRIMARY KEY,
        staff_id VARCHAR(10) NOT NULL,
        department_id VARCHAR(10) NOT NULL,
        assigned_by VARCHAR(10) NOT NULL,
        assigned_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        ended_at DATETIME NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
        remark VARCHAR(255),
        FOREIGN KEY (staff_id) REFERENCES staff (staff_id) ON DELETE RESTRICT ON UPDATE CASCADE,
        FOREIGN KEY (department_id) REFERENCES department (department_id) ON DELETE RESTRICT ON UPDATE CASCADE,
        FOREIGN KEY (assigned_by) REFERENCES admin (admin_id) ON DELETE RESTRICT ON UPDATE CASCADE
    );

CREATE TABLE
    category (
        category_id VARCHAR(10) PRIMARY KEY,
        category_name VARCHAR(100) NOT NULL UNIQUE,
        department_id VARCHAR(10) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (department_id) REFERENCES department (department_id) ON UPDATE CASCADE
    );

CREATE TABLE
    complaint (
        complaint_id VARCHAR(10) PRIMARY KEY,
        submitted_by VARCHAR(10) NOT NULL,
        complaint_type VARCHAR(20) NOT NULL,
        category_id VARCHAR(10) NULL,
        department_id VARCHAR(10) NOT NULL,
        subject VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        attachment VARCHAR(255) NULL,
        priority VARCHAR(20) NOT NULL DEFAULT 'MEDIUM',
        status VARCHAR(30) NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        resolved_at DATETIME NULL,
        resolution TEXT NULL,
        CONSTRAINT chk_complaint_type CHECK (complaint_type IN ('NORMAL', 'EXAMINATION')),
        CONSTRAINT chk_complaint_category CHECK (
            (
                complaint_type = 'NORMAL'
                AND category_id IS NOT NULL
            )
            OR (
                complaint_type = 'EXAMINATION'
                AND category_id IS NULL
            )
        ),
        CONSTRAINT chk_complaint_priority CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT')),
        CONSTRAINT chk_complaint_status CHECK (
            status IN (
                'PENDING_HA',
                'UNDER_HA_REVIEW',
                'RESOLVED_BY_HA',
                'PENDING_ADMIN_REVIEW',
                'ESCALATED_TO_ADMIN',
                'UNDER_ADMIN_REVIEW',
                'RESOLVED_BY_ADMIN',
                'REJECTED_BY_ADMIN'
            )
        ),
        CONSTRAINT fk_complaint_submitter FOREIGN KEY (submitted_by) REFERENCES user (user_id) ON UPDATE CASCADE ON DELETE RESTRICT,
        CONSTRAINT fk_complaint_category FOREIGN KEY (category_id) REFERENCES category (category_id),
        CONSTRAINT fk_complaint_department FOREIGN KEY (department_id) REFERENCES department (department_id) ON UPDATE CASCADE ON DELETE RESTRICT
    ) ENGINE = InnoDB;

CREATE TABLE
    complaint_tracker (
        tracker_id INT AUTO_INCREMENT PRIMARY KEY,
        complaint_id VARCHAR(10) NOT NULL,
        previous_status VARCHAR(30) NULL,
        status VARCHAR(30) NOT NULL,
        updated_by VARCHAR(10) NOT NULL,
        action_type VARCHAR(40) NOT NULL,
        reason_code VARCHAR(50) NULL,
        remark TEXT NULL,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_tracker_complaint FOREIGN KEY (complaint_id) REFERENCES complaint (complaint_id) ON UPDATE CASCADE ON DELETE RESTRICT,
        CONSTRAINT fk_tracker_user FOREIGN KEY (updated_by) REFERENCES user (user_id) ON UPDATE CASCADE ON DELETE RESTRICT,
        INDEX idx_tracker_complaint_time (complaint_id, updated_at)
    );

CREATE TABLE
    assignment (
        assignment_id INT AUTO_INCREMENT PRIMARY KEY,
        complaint_id VARCHAR(10) NOT NULL,
        staff_id VARCHAR(10) NOT NULL,
        assigned_by VARCHAR(10) NULL,
        assigned_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        ended_at DATETIME NULL,
        assignment_status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
        assignment_source VARCHAR(30) NOT NULL DEFAULT 'AUTO_ROUTING',
        remark TEXT NULL,
        CONSTRAINT chk_assignment_status CHECK (
            assignment_status IN (
                'ACTIVE',
                'COMPLETED',
                'ESCALATED',
                'REASSIGNED',
                'CANCELLED'
            )
        ),
        CONSTRAINT chk_assignment_source CHECK (
            assignment_source IN ('AUTO_ROUTING', 'ADMIN_ACTION')
        ),
        CONSTRAINT fk_assignment_complaint FOREIGN KEY (complaint_id) REFERENCES complaint (complaint_id) ON UPDATE CASCADE ON DELETE RESTRICT,
        CONSTRAINT fk_assignment_staff FOREIGN KEY (staff_id) REFERENCES staff (staff_id) ON UPDATE CASCADE ON DELETE RESTRICT,
        CONSTRAINT fk_assignment_admin FOREIGN KEY (assigned_by) REFERENCES admin (admin_id) ON UPDATE CASCADE ON DELETE RESTRICT,
        INDEX idx_assignment_complaint (complaint_id),
        INDEX idx_assignment_staff_status (staff_id, assignment_status)
    );

CREATE TABLE
    IF NOT EXISTS feedback (
        feedback_id VARCHAR(10) PRIMARY KEY,
        complaint_id VARCHAR(10) NOT NULL UNIQUE,
        user_id VARCHAR(10) NOT NULL,
        rating INT NOT NULL,
        comment VARCHAR(500) NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT chk_feedback_rating CHECK (rating BETWEEN 1 AND 5),
        CONSTRAINT fk_feedback_complaint FOREIGN KEY (complaint_id) REFERENCES complaint (complaint_id) ON UPDATE CASCADE ON DELETE RESTRICT,
        CONSTRAINT fk_feedback_user FOREIGN KEY (user_id) REFERENCES user (user_id) ON UPDATE CASCADE ON DELETE RESTRICT
    ) ENGINE = InnoDB;

CREATE TABLE
    notification (
        notification_id VARCHAR(10) PRIMARY KEY,
        user_id VARCHAR(10) NOT NULL,
        complaint_id VARCHAR(10) NULL,
        title VARCHAR(150) NOT NULL,
        message VARCHAR(500) NOT NULL,
        notification_type VARCHAR(40) NOT NULL,
        is_read TINYINT (1) NOT NULL DEFAULT 0,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_notification_user FOREIGN KEY (user_id) REFERENCES user (user_id) ON UPDATE CASCADE ON DELETE CASCADE,
        CONSTRAINT fk_notification_complaint FOREIGN KEY (complaint_id) REFERENCES complaint (complaint_id) ON UPDATE CASCADE ON DELETE RESTRICT,
        INDEX idx_notification_user (user_id, is_read, created_at)
    ) ENGINE = InnoDB;

-- new add one

CREATE TABLE
    IF NOT EXISTS audit_log (
        log_id INT AUTO_INCREMENT PRIMARY KEY,
        action_type VARCHAR(50) NOT NULL,
        performed_by VARCHAR(10) NULL,
        target VARCHAR(150) NULL,
        details VARCHAR(500) NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_audit_action (action_type, created_at)
    ) ENGINE = InnoDB;