# Loan Activity Tracking

This document describes the new loan activity tracking feature added to the lending-pool contract.

## Feature Overview

Loan activity tracking stores borrower loan events when loans are opened, repaid, and liquidated. This helps external clients inspect borrower activity and understand loan lifecycle changes on-chain.

## Data Model

- `loan-event-count`: tracks number of loan events per borrower
- `loan-event`: stores event details by borrower and index

Each event contains action type, action amount, block height, and remaining debt.
