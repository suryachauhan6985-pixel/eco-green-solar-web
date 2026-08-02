# Database Analysis

Database layer detected: **Yes**

## SQL Tables (from CREATE TABLE statements)

| Table | File |
| --- | --- |
| backup_log | api/routes/backup.js |
| otp_codes | api/db/schema.js |
| attachments | api/db/schema.js |
| scan_sheets | api/db/schema.js |
| scan_sheet_entries | api/db/schema.js |
| bom_challans | api/db/schema.js |


## Foreign Keys

| Columns | References | File |
| --- | --- | --- |
| sheet_id | scan_sheets | api/db/schema.js |


## Indexes

_None detected._


## Mongoose Models

_None detected._


## Sequelize Models

_None detected._


## Connection Files

- api/db/pool.js

## Migration Files

_None detected._
