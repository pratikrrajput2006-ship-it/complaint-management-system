# Complaint Management System (CMS)

A web-based **Complaint Management System** for an educational institution. The system allows students and staff to submit complaints and provides Admin, Staff, and Higher Authority workflows for assignment, tracking, escalation, resolution, notifications, and feedback.

---

## 1. Project Objective

The main objective of the CMS is to replace an unstructured/manual complaint process with a centralized system that can:

- Accept complaints from Students and Staff
- Route complaints to the responsible Department
- Allow Admin to assign complaints to Staff
- Track every status change
- Handle escalation to Higher Authority
- Record final resolutions
- Collect user feedback
- Provide role-based access and secure authentication

---

## 2. Main Users

### Student

Regular account created through public registration.

**ID format:** `STU001`

Main functions:

- Register
- Login
- View dashboard
- Submit complaint
- View submitted complaints
- Track complaint status/history
- View resolution
- Reopen complaint
- Give feedback
- Receive notifications

### Staff

Regular account created through public registration.

**ID format:** `STF001`

A Staff member can both **submit their own complaint** and **handle complaints assigned by Admin**.

Main functions:

- Register
- Login
- View dashboard
- Submit own complaint
- View assigned complaints
- Accept complaint
- Update status
- Add remarks
- Resolve complaint
- Escalate complaint

### Admin

Privileged/controlled account.

**ID format:** `ADM001`

Admin is responsible for controlling the complaint process.

Main functions:

- Login
- Dashboard
- View all complaints
- Assign complaints to Staff
- Manage users
- Manage departments
- Manage categories
- Monitor complaints
- Handle escalations
- Reports
- Create/manage Higher Authority accounts

Admin is **not available as a public registration option**.

### Higher Authority

Privileged/controlled account.

**ID format:** `HA001`

Examples of designation:

- Principal
- Vice Principal
- Dean
- Director

Main functions:

- Login
- View escalated complaints
- Review complaint history
- Take decision
- Assign action
- Approve/reject
- Resolve escalated complaints

Higher Authority is **not available as a public registration option**.

---

## 3. Account Creation Model

### Public Registration

Only:

```text
Student → STU001
Staff   → STF001
```

The role is selected during registration and the system generates the ID automatically.

### Controlled Accounts

Admin and Higher Authority accounts are created through a controlled process.

```text
Initial system setup
        ↓
First Admin → ADM001
        ↓
Admin Dashboard
        ├── Create/manage Admin accounts
        └── Create/manage Higher Authority accounts
```

A Principal, for example, may have:

```text
Role: Higher Authority
ID: HA001
Designation: Principal
```

---

## 4. Login Workflow

One common login page is used.

```text
User ID / Email + Password
            ↓
       Authentication
            ↓
        Read user role
            ↓
 ┌──────────┼───────────┬──────────────┐
 ↓          ↓           ↓              ↓
Student    Staff       Admin      Higher Authority
 ↓          ↓           ↓              ↓
Dashboard  Dashboard   Dashboard      Dashboard
```

The user does not select a role during normal login. The backend identifies the role from the authenticated account.

---

## 5. Complete Complaint Workflow

```text
Student / Staff
       ↓
Submit Complaint
       ↓
COMPLAINT
       ↓
Category + Responsible Department
       ↓
Admin Reviews
       ↓
ASSIGNMENT
       ↓
Staff Handles Complaint
       ├── Resolve
       └── Escalate
               ↓
       Higher Authority
               ↓
       Review / Decision
               ↓
            Resolve
               ↓
      Student / Staff views resolution
               ↓
            Feedback
```

---

## 6. Department Logic

There are two different meanings of Department in the system.

### User's Department

This identifies the department to which a Student/Staff member belongs.

Example:

```text
STU001
Department = Computer Engineering
```

### Complaint Department

This identifies the department responsible for handling a specific complaint.

Example:

```text
Student Department = Computer Engineering
Complaint = Hostel fan not working
Complaint Department = Hostel
```

Therefore, a student's own department does **not** determine where every complaint goes.

---

## 7. Complaint Category and Department Logic

The Complaint stores both:

```text
category_id
department_id
```

### Non-academic examples

```text
Hostel     → Hostel Department
Library    → Library Department
Fees       → Administration
Examination→ Examination
```

These can be routed automatically.

### Academic/Educational complaints

For an academic complaint, the responsible academic department may need to be selected.

Example:

```text
Category   = Academic
Department = Computer Engineering
```

Business rule:

```text
Category
   ↓
Determine whether the responsible department is fixed
   ↓
YES → route automatically
NO  → ask for department selection
```

The backend must validate the category/department combination.

---

## 8. Final Database Entities

The recommended database contains **12 entities**:

1. `USER`
2. `STUDENT`
3. `STAFF`
4. `ADMIN`
5. `HIGHER_AUTHORITY`
6. `DEPARTMENT`
7. `CATEGORY`
8. `COMPLAINT`
9. `ASSIGNMENT`
10. `COMPLAINT_TRACKER`
11. `NOTIFICATION`
12. `FEEDBACK`

---

## 9. Entity Summary

### USER

Common account/login information.

```text
PK  user_id
    name
    email
    password_hash
    role
    phone
    status
    created_at
```

### STUDENT

```text
PK/FK student_id
    enrollment_no
    course
    year
    division
FK  department_id
```

### STAFF

```text
PK/FK staff_id
    employee_no
    designation
FK  department_id
    joining_date
```

### ADMIN

```text
PK/FK admin_id
    employee_no
    designation
```

### HIGHER_AUTHORITY

```text
PK/FK authority_id
    employee_no
    designation
FK  department_id
    authority_level
```

### DEPARTMENT

```text
PK  department_id
    department_name
    description
    status
```

### CATEGORY

```text
PK  category_id
    category_name
    description
    status
```

### COMPLAINT

```text
PK  complaint_id
FK  submitted_by
FK  category_id
FK  department_id
    subject
    description
    attachment
    status
    priority
    created_at
    updated_at
    resolved_at
    resolution
```

### ASSIGNMENT

Records Admin-to-Staff assignment history.

```text
PK  assignment_id
FK  complaint_id
FK  staff_id
FK  assigned_by
    assigned_at
    assignment_status
    remark
```

### COMPLAINT_TRACKER

Stores the complete status history.

```text
PK  tracker_id
FK  complaint_id
FK  updated_by
    status
    remark
    updated_at
```

### NOTIFICATION

```text
PK  notification_id
FK  user_id
FK  complaint_id
    title
    message
    notification_type
    is_read
    created_at
```

### FEEDBACK

```text
PK  feedback_id
FK  complaint_id
FK  user_id
    rating
    comment
    created_at
```

---

## 10. Key Relationships

```text
USER 1 : 1 STUDENT
USER 1 : 1 STAFF
USER 1 : 1 ADMIN
USER 1 : 1 HIGHER_AUTHORITY

DEPARTMENT 1 : N STUDENT
DEPARTMENT 1 : N STAFF
DEPARTMENT 1 : N HIGHER_AUTHORITY

USER 1 : N COMPLAINT
CATEGORY 1 : N COMPLAINT
DEPARTMENT 1 : N COMPLAINT

COMPLAINT 1 : N ASSIGNMENT
STAFF 1 : N ASSIGNMENT
ADMIN 1 : N ASSIGNMENT

COMPLAINT 1 : N COMPLAINT_TRACKER

USER 1 : N COMPLAINT_TRACKER

USER 1 : N NOTIFICATION
COMPLAINT 1 : N NOTIFICATION

COMPLAINT 1 : 0..1 FEEDBACK
USER 1 : N FEEDBACK
```

---

## 11. ID Convention

Readable IDs are used throughout the system.

| Entity/Role | Example |
|---|---|
| Student | `STU001` |
| Staff | `STF001` |
| Admin | `ADM001` |
| Higher Authority | `HA001` |
| Department | `DEP001` |
| Category | `CAT001` |
| Complaint | `CMP001` |
| Assignment | `ASN001` |
| Tracker | `TRK001` |
| Notification | `NOT001` |
| Feedback | `FDB001` |

Users do not manually type these IDs. They are generated by the application/database and then used in login and relationships.

---

## 12. Complaint Status

Current status is stored in `COMPLAINT.status`.

Example statuses:

```text
Pending
Assigned
In Progress
Escalated
Resolved
Rejected
Reopened
```

`COMPLAINT_TRACKER` stores the full status history.

Example:

```text
TRK001 → Pending
TRK002 → Assigned
TRK003 → In Progress
TRK004 → Escalated
TRK005 → Resolved
```

---

## 13. Reopen Complaint

A separate `REOPEN` table is not required.

Reopening is handled through complaint status and tracking history:

```text
Resolved
   ↓
Reopened
   ↓
In Progress
   ↓
Resolved
```

---

## 14. Escalation

A separate `ESCALATION` table is not required for the current scope.

Escalation can be represented using:

- `COMPLAINT.status`
- `COMPLAINT_TRACKER`
- assignment/action records

If the project later needs multi-level escalation, separate escalation records can be added.

---

## 15. Admin Security

Admin has the highest management privileges, so:

- Admin is not publicly registerable
- First Admin is created during system/database setup
- Admin operations require backend authorization
- Passwords are stored only as secure hashes
- Protected operations require authenticated sessions/tokens
- SQL queries use parameterized/prepared statements
- Important Admin actions should be auditable

Hiding an Admin button in HTML is **not** security. The backend must verify Admin permissions.

---

## 16. Password Security

Never store:

```text
password = "admin123"
```

Store:

```text
password_hash
```

The backend verifies the entered password against the stored secure hash.

Recommended production approaches include secure password hashing such as Argon2id or bcrypt.

---

## 17. Database Data Flow

Example: Student submits a Hostel complaint.

```text
STU001
  ↓
Submit complaint
  ↓
Generate CMP001
  ↓
Insert COMPLAINT
  ↓
category_id → Hostel
department_id → Hostel
  ↓
Create initial tracker record
  ↓
Notify Admin
```

Admin assigns Staff:

```text
ADM001
  ↓
Create ASN001
  ↓
Complaint CMP001
  ↓
Staff STF004
```

Staff updates the complaint:

```text
STF004
  ↓
Update COMPLAINT.status
  ↓
Create COMPLAINT_TRACKER record
  ↓
Create NOTIFICATION
```

After resolution:

```text
COMPLAINT
status = Resolved
resolution = "Fan replaced"
```

Student provides feedback:

```text
FDB001
Complaint = CMP001
Rating = 5
Comment = "Problem solved quickly"
```

---

## 18. Frontend Structure

Current project structure:

```text
frontend/
├── css/
│   ├── registration.css
│   ├── student.css
│   ├── staff.css
│   └── utilities.css
│
└── HTML/
    ├── Admin/
    ├── Staff/
    │   └── staff.html
    ├── Student/
    │   └── student.html
    └── Register.html
```

Planned expanded structure:

```text
frontend/
├── HTML/
│   ├── auth/
│   │   ├── login.html
│   │   └── register.html
│   ├── Student/
│   ├── Staff/
│   ├── Admin/
│   └── Authority/
├── css/
└── js/
```

Current UI work focuses on **HTML + CSS** before backend functionality.

---

## 19. Backend Architecture

Planned backend flow:

```text
HTML / CSS / JavaScript
           ↓
     Node.js + Express
           ↓
   Authentication / Rules
           ↓
         MySQL
```

Backend responsibilities include:

- Authentication
- Authorization
- ID generation
- User registration
- Complaint creation
- Category/department validation
- Assignment
- Status updates
- Escalation
- Notifications
- Feedback
- Reporting

---

## 20. MySQL Design Rules

- Use primary keys for every main table
- Use foreign keys for relationships
- Use readable `VARCHAR` IDs such as `STU001`
- Use `password_hash`, not plain passwords
- Use parameterized SQL
- Validate all user input
- Keep current status in `COMPLAINT`
- Keep history in `COMPLAINT_TRACKER`
- Keep assignment history in `ASSIGNMENT`

Department IDs such as `DEP001` are used internally even though the UI displays department names such as `Computer Engineering`.

---

## 21. UI Design Principle

UI represents the requirements; it does not replace the requirements.

Examples:

```text
Requirement: Submit Complaint
          ↓
UI: Complaint submission form

Requirement: Track Status
          ↓
UI: Complaint timeline/status screen

Requirement: Assign Staff
          ↓
UI: Admin assignment screen
```

---

## 22. Development Phases

### Phase 1 — Planning
- Project objective
- Scope
- Main users

### Phase 2 — Requirement Analysis
- Student requirements
- Staff requirements
- Admin requirements
- Higher Authority requirements

### Phase 3 — Database Design
- Entities
- Attributes
- PK/FK
- Relationships
- Cardinalities
- ER diagram
- Schema diagram

### Phase 4 — UI Development
- Registration
- Login
- Student UI
- Staff UI
- Admin UI
- Higher Authority UI

### Phase 5 — Backend Development
- Authentication
- Role-based authorization
- Complaint APIs
- Assignment
- Tracking
- Notifications
- Feedback

### Phase 6 — MySQL Integration
- Create database
- Create tables
- CRUD operations
- Foreign-key relationships
- Validation

### Phase 7 — Testing
- UI testing
- Authentication testing
- Authorization testing
- Complaint workflow testing
- Database testing
- Security testing

---

## 23. Suggested Project Architecture

```text
CM_System/
├── frontend/
│   ├── HTML/
│   │   ├── auth/
│   │   ├── Student/
│   │   ├── Staff/
│   │   ├── Admin/
│   │   └── Authority/
│   ├── css/
│   └── js/
│
├── backend/
│   ├── routes/
│   ├── controllers/
│   ├── middleware/
│   ├── services/
│   └── config/
│
├── database/
│   └── schema.sql
│
└── README.md
```

---

## 24. Testing Scenarios

Important test cases include:

- Student can register
- Staff can register
- Admin cannot be created through public registration
- Higher Authority cannot be created through public registration
- Login redirects to the correct dashboard
- Student can submit a complaint
- Staff can submit a complaint
- Category/department routing works
- Admin can assign Staff
- Staff can update complaint status
- Staff can resolve or escalate
- Higher Authority can handle escalated complaints
- Reopen workflow works
- Notifications are created correctly
- Feedback can be submitted after resolution
- Unauthorized users cannot access restricted operations

---

## 25. Project Workflow in One View

```text
Registration
     ↓
Login
     ↓
Role identification
     ↓
Dashboard
     ↓
Complaint submission
     ↓
Category / responsible department
     ↓
Admin review
     ↓
Staff assignment
     ↓
Complaint handling
     ↓
Tracking
     ↓
Resolve OR Escalate
     ↓
Higher Authority (if escalated)
     ↓
Final Resolution
     ↓
Notification
     ↓
Feedback
```

---

## 26. Final Design Decisions

The following decisions are considered final for the current project scope:

- Student and Staff are regular registration roles
- Admin and Higher Authority are controlled roles
- `USER` is the common account entity
- Student/Staff/Admin/Higher Authority have role-specific profile data
- Student department and complaint department are different concepts
- Complaint stores both `category_id` and `department_id`
- Academic complaints can require academic department selection
- Fixed non-academic routing can automatically determine the responsible department
- `ASSIGNMENT` stores Admin-to-Staff assignment information
- `COMPLAINT_TRACKER` stores status history
- `NOTIFICATION` stores user notifications
- `FEEDBACK` stores post-resolution feedback
- Reopen is handled by complaint status/history
- Current escalation can be handled using status/history without a separate escalation table
- Admin actions require backend authorization

---

## 27. Current Project Status

**Completed design work:**

- Requirement analysis
- User-role definition
- Workflow definition
- Entity identification
- Attribute definition
- PK/FK planning
- Relationship/cardinality planning
- ER design
- Schema design
- Account creation model
- Department/category routing logic
- Security planning
- Frontend folder planning
- Initial Registration UI
- Student Profile UI
- Staff Profile UI

**Current development stage:**

> Frontend UI development with HTML and CSS.

---

## 28. Next Steps

Recommended implementation order:

```text
1. Final ER diagram
2. Final schema diagram
3. MySQL database
4. SQL CREATE TABLE script
5. Registration UI completion
6. Login UI
7. Student UI
8. Staff UI
9. Admin UI
10. Higher Authority UI
11. Backend authentication
12. Complaint APIs
13. Assignment and tracking
14. Notifications
15. Feedback
16. Testing
17. Deployment
```

---

## Technology Stack

- **Frontend:** HTML, CSS, JavaScript
- **Backend:** Node.js, Express
- **Database:** MySQL
- **IDE:** Visual Studio Code
- **Version Control:** Git, GitHub

---

## Project Status

**Complaint Management System — Academic Project**

The system is being developed in phases, starting with database and UI design before backend integration.

