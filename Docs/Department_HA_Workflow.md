# Department Design

Department is a master database entity, not a user.

## Concept

DEPARTMENT
    ↓
STUDENT
STAFF
HA
COMPLAINT

Students and Staff select an existing department during account creation.
The frontend shows the department name, while the backend stores the
corresponding department_id.

## Example

DEP001 → Computer Science and Engineering
DEP002 → Mechanical Engineering
DEP003 → Civil Engineering

STU001 → DEP001
STF005 → DEP002

The department_id is a foreign key to the DEPARTMENT table.

## Important Rule

Department names should not be repeatedly stored as free text in
Student and Staff records. The Department table is the single source
of truth for department information.