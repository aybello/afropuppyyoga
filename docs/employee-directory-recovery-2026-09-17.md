# Employee Directory Recovery Record — September 17, 2026

## Purpose

This record documents a live, additive recovery after the Employee Directory regressed to 13 records following the account-transfer recovery. It must not be replayed as a migration. The live recovery was already performed once against the affected APY database after a pre-recovery snapshot.

## Restored records

Five verified historical staff records were restored as **inactive** on September 17, 2026: Anayah Macpherson-Haye, Chaenel Mattis, Georgia Luke, Lamha Marwaha, and Maya Mathew. Evidence came from APY invoices and direct APY email correspondence reviewed during the prior recovery. The restoration did not create APY HQ profiles, staff-session eligibility, staffing assignments, or SMS access.

## Preserved owner decisions

Angelina Campbell and Harjot Randhawa were deliberately marked departed and permanently removed from the Employee Directory by the owner on September 17, 2026. Their source applications and action history remain in the database. This recovery intentionally did not re-create either directory record.

## Status after recovery

The directory contains 18 records: one active and 17 inactive. The shortfall against the historical 22-record report is explained in part by the two deliberate removals. Other historical names must not be inferred or recreated without direct evidence and owner review.

## Operating safeguard

The Employee Directory now requires a confirmation before reactivating employment. The server rejects reactivation when the linked APY HQ profile is still active, or when an unlinked directory record matches an active APY HQ profile by email or normalized phone number. Current APY staff SMS login and operational access are both resolved from active APY HQ profiles, not Employee Directory status. Reactivating employment alone does not create or restore APY HQ access, operational staffing, or staff SMS login. APY HQ access remains a separate deliberate administrative action.

## Recovery artifacts

The pre-recovery database snapshot and the idempotent one-time restoration report are stored outside the repository in the secure local recovery-artifacts folder. Treat them as operational audit evidence, not application source code.
