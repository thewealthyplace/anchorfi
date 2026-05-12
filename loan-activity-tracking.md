# Loan Activity Tracking

This document describes the new loan activity tracking feature added to the lending-pool contract.

## Feature Overview

Loan activity tracking stores borrower loan events when loans are opened, repaid, and liquidated. This helps external clients inspect borrower activity and understand loan lifecycle changes on-chain.

## Data Model

- `loan-event-count`: tracks number of loan events per borrower
- `loan-event`: stores event details by borrower and index

Each event contains action type, action amount, block height, and remaining debt.

## Accessors

The lending-pool contract exposes read-only accessors for loan event history:
- `get-loan-event-count`
- `get-loan-event`
- `get-last-loan-event`
- `get-loan-event-summary`

## Event Recording

Loan actions are recorded during borrow, repay, and liquidate flows. Each action is appended to borrower event history with a new index.
