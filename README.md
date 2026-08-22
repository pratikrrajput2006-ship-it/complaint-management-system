Complaint Management System (CMS)

A web-based Complaint Management System for an educational institution. It provides separate access and workflows for Students, Staff, Admin, and Higher Authority.

Users & Features

Student

Register and login

Dashboard

Submit complaints

View and track complaints

View resolution

Reopen complaints

Give feedback

Receive notifications

Staff

Register and login

Dashboard

View assigned complaints

Accept complaints

Update status

Add remarks

Resolve complaints

Escalate complaints

Admin

Secure, controlled account

Dashboard

View all complaints

Assign Staff

Manage users, departments, and categories

Monitor complaints

Handle escalations

Reports

Create/manage Higher Authority accounts

Higher Authority

Secure, controlled account

View escalated complaints

Review complaint history

Take decisions

Assign actions

Approve/reject

Resolve escalated complaints

Account Security

Normal public registration is available only for:

Student → STU001

Staff → STF001

Admin and Higher Authority accounts are not selectable in public registration:

Admin → ADM001

Higher Authority → HA001

The initial Admin can be created during system/database setup. Authorized Admin functionality can then manage privileged accounts.

Passwords must be stored as secure hashes, never plain text.

Complaint Workflow

Student / Staff
      ↓
Submit Complaint
      ↓
Admin Reviews
      ↓
Assign Staff
      ↓
Staff Handles Complaint
      ├── Resolve
      └── Escalate
             ↓
      Higher Authority
             ↓
      Review & Decision
             ↓
          Resolve

Database Entities

USER

STUDENT

STAFF

ADMIN

HIGHER_AUTHORITY

DEPARTMENT

CATEGORY

COMPLAINT

COMPLAINT_TRACKER

NOTIFICATION

FEEDBACK

The database uses primary keys (PK), foreign keys (FK), relationships, and complaint status history.

ID Convention

Entity/Role

Format

Example

Student

STU###

STU001

Staff

STF###

STF001

Admin

ADM###

ADM001

Higher Authority

HA###

HA001

Department

DEP###

DEP001

Category

CAT###

CAT001

Complaint

CMP###

CMP001

Tracker

TRK###

TRK001

Notification

NOT###

NOT001

Feedback

FDB###

FDB001

Frontend Structure

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

The current stage focuses on HTML + CSS UI. JavaScript, backend, authentication, and MySQL integration will be added later.

Planned Project Structure

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
│
├── database/
│   └── schema.sql
│
└── README.md

Development Phases

Phase 1 — Project Planning

Define objective

Identify users

Define scope

Phase 2 — Requirement Analysis

Student requirements

Staff requirements

Admin requirements

Higher Authority requirements

Phase 3 — Database Design

Identify entities and attributes

Define PK/FK

Define relationships and cardinalities

Create ER diagram

Create schema diagram

Phase 4 — UI Development

Registration

Login

Student UI

Staff UI

Admin UI

Higher Authority UI

Phase 5 — Backend Development

Authentication

Authorization

Complaint APIs

User management

Assignment

Status tracking

Notifications

Feedback

Phase 6 — MySQL Integration

Database creation

CRUD operations

Relationships

Validation

Secure queries

Phase 7 — Testing

UI testing

Authentication and authorization

Role/permission testing

Complaint workflow testing

Database testing

Security testing

Technology Stack

Frontend: HTML, CSS, JavaScript

Backend: Node.js / Express

Database: MySQL

IDE: Visual Studio Code

Version Control: Git & GitHub

Current Status

Current stage: UI planning and development.

Completed:

Requirement analysis

Entity identification

Entity attributes

Initial ER design

Schema design

Frontend folder planning

Registration UI

Student and Staff profile UI

Next:

Complete UI screens

Finalize ER and schema diagrams

Create MySQL database

Implement authentication

Implement backend APIs

Connect frontend and backend

Test the complete complaint workflow