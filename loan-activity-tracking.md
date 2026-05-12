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

## Testing Plan

The feature includes coverage for event counts after borrow, repay, and liquidation, plus retrieval by index and summary queries.

## Developer Notes

The event history feature preserves event records even after a loan is closed, allowing auditors and interfaces to retrieve complete borrower history.

## API Reference

### Read-Only Functions

- `get-loan-event-count (borrower principal)`: Returns the total number of loan events for a borrower
- `get-loan-event (borrower principal, index uint)`: Returns the event details at the specified index
- `get-last-loan-event (borrower principal)`: Returns the most recent loan event for a borrower
- `get-loan-event-summary (borrower principal)`: Returns a summary of all loan events for a borrower

## Migration Guide

Existing contracts using the lending-pool do not require changes. The loan activity tracking feature is backward compatible and adds new read-only functions without modifying existing behavior.

## Performance Considerations

Event recording adds minimal gas cost to borrow, repay, and liquidate operations. Event retrieval functions are read-only and do not consume gas when called from off-chain clients.

## Security Considerations

Loan event data is publicly readable and cannot be modified or deleted once recorded. This ensures immutable audit trails but requires careful consideration of data privacy for sensitive borrower information.

## Future Enhancements

Potential future improvements include event filtering by date ranges, pagination for large event histories, and integration with off-chain analytics platforms.
