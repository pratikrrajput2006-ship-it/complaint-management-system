# Department-Level HA Assignment Design

The Higher Authority (HA) is an additional authority assigned to an
existing Staff account.

## HA Assignment Flow

Existing Staff
    ↓
College recommends / nominates
    ↓
Admin makes the final decision
    ↓
Admin selects the existing Staff
    ↓
Admin selects the responsible Department
    ↓
Staff becomes Department-Level HA

## Important Rules

- HA is not a separate user account.
- No separate HA login is created.
- The existing Staff ID remains the permanent identity.
- One Staff member can have only one active HA assignment at a time.
- Previous HA assignments are preserved in HA history.
- A Staff member's own department can be different from the HA department.
- `STAFF.ha_status` represents the current HA state.
- `ha_history` stores important HA assignment history.

## Example

Staff ID: STF005
Staff Department: Mechanical Engineering

Admin assigns:

HA Department: Computer Science and Engineering

Result:

STF005 = CSE Department HA