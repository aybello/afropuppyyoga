# AfroPuppyYoga Historical Database Recovery — September 19, 2026

## Purpose

This record documents the additive recovery of APY operational history from the uploaded backup `afropuppyyoga-database-20260919T083348Z.sql.gz`. The archive came from the prior Manus account and was imported into the active database without replacing current live records.

## Archive verification

The uploaded archive was a MySQL-compatible TiDB logical export captured at **2026-09-19 08:33:53 UTC**. `gzip -t` passed, the uncompressed archive size matched the manifest at 516,187 bytes, and its SHA-256 digest matched the manifest:

`82832f31e75023beea5b6b3301d49f49f5f414fd917c511640173b8ca8ed5fcc`

The archive contained 42 tables. Before any recovery operation, a new live-database logical backup was created and validated. That backup is kept outside the repository in the protected recovery-artifacts directory.

## Recovery method

The source archive was restored only into 42 temporary `recovery0919_` staging tables within the active database because the application database account cannot create a separate database. The staging tables were used only for comparison and recovery. Every candidate row was checked by primary-key ID and unique-key conflicts before import.

The import ran as one database transaction. Existing active-database rows were never updated or deleted. Only source rows whose primary-key IDs were absent from the active database were inserted. The first transaction halted and rolled back completely when the archive contained the legacy `interview_requested` applicant status, which was missing from the transferred database enum. A forward-only migration restored that status as a permitted value without changing an existing applicant record. The recovery then completed successfully.

Historical job applications were restored with `isTeamMember = false`, and historical employee records were restored with `employmentStatus = inactive`. This preserves employment history while preventing an automatic APY HQ or portal-access grant.

## Restored operational history

| Data area | Missing records restored | Final active-database total |
|---|---:|---:|
| Employees | 13 | 31 |
| Invoices | 35 | 83 |
| Job applications | 106 | 146 |
| Job-application actions | 36 | 46 |
| Breeders | 10 | 68 |
| Breeder confirmations | 26 | 29 |
| Private-event inquiries | 17 | 30 |
| Private-event classes | 3 | 3 |
| Private-event actions | 29 | 29 |
| Puppy schedule slots | 27 | 31 |
| Class staff assignments | 13 | 13 |
| Staff schedule notifications | 17 | 17 |
| Inbound SMS history | 21 | 21 |
| Call logs | 59 | 59 |
| Cancellation credits | 2 | 2 |
| Breeder lead records and activities | 3 | 3 |
| Other communication and coverage history | 3 | 3 |

A total of **420 records** were restored across 19 operational tables.

## Deliberately excluded records

The recovery did not import the current migration ledger, cross-account user identities, staff invite tokens, staff SMS access codes, signing tokens, QuickBooks OAuth states, encrypted QuickBooks connections, QuickBooks sync runs, or QuickBooks transactions. These records are either environment-bound, expired, access-sensitive, or depend on credentials that must be configured in the current account.

## Validation

All expected count totals matched after recovery. Link checks passed for invoices, breeder confirmations, scheduling, staff assignments, private-event records, employee source applications, and applicant action history. No restored historical applicant received APY HQ access and no restored historical employee was activated.

One breeder-lead activity in the source archive already referenced an absent lead. The orphan was preserved as historical audit data. It is not returned by the lead-detail interface, because that interface starts from an existing lead. No lead was invented and no source history was deleted.

Focused staff and operations regression tests, TypeScript checks, the full 258-test suite with one documented skip, and the production build passed after the recovery. The public homepage, Careers, Private Event Quote, Employee Directory, Applications, Invoices, and Run APY routes each returned HTTP 200. The 42 temporary recovery staging tables were removed after validation; both the uploaded source archive and the fresh pre-import backup remain in protected local recovery storage.

## Follow-up

The deployment migration `0052_restore_interview_requested_status` restores the `interview_requested` application state already supported by the current API and dashboard. It expands the accepted enum values only and does not change any existing application status.
