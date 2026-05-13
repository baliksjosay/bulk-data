# API Business Rules Validation

Validated on: 2026-05-01  
Source: `MTN Wholesale Bulk Data Service Solution Document V2 1.docx`, dated 10/04/2026.

This report validates the current API contract and implementation against the solution-document business rules. It separates:

- Frontend/OpenAPI contract in `frontend/docs/openapi.yaml`
- Frontend fake API routes in `frontend/src/app/api`
- Real NestJS backend modules in `api/src/modules`

## Executive Status

The frontend API contract covers the required business journeys from the solution document, including the customer activation flow: activation link, email OTP verification, password creation, and immediate portal access. The real NestJS backend has a first-pass business API layer for customers, packages, purchases, service requests, balances, secondary numbers, dashboards, reports, and audit. These routes are implemented under `api/src/modules/bulk-data` and follow the paths in `frontend/docs/openapi.yaml`.

The provisioning integration remains correctly abstracted behind a backend adapter. Product-facing API names use "Provisioning" instead of exposing the concrete provider. The remaining work is to replace local business-rule simulation with external APN, payment, balance, and provisioning provider calls where the solution document requires them.

## High Priority Gaps

1. APN validation through VasApps/UDM is still simulated locally in the business API layer. A real APN validation adapter is required.
2. Purchase confirmation updates transaction and balance state, but does not yet call a real payment provider, subscribe-service operation, or subscription update provider workflow.
3. Bundle balance and secondary usage are served from the local backend read model. The provisioning adapter still needs a check-balance operation for live provider data.
4. The frontend OpenAPI contract expects an HTTP-only session cookie, but the current NestJS auth Swagger/DTOs still document access and refresh tokens in the response body.
5. The real NestJS Swagger document is not yet the same source of truth as `frontend/docs/openapi.yaml`; these need to be reconciled before backend handoff.
6. Security/preference routes already exist in backend modules, but their public paths do not fully match the frontend OpenAPI path names yet.
7. Business-operation audit events are now written by the business API layer, but they should be connected to the enterprise audit/security pipeline before production.
8. Integration tests are still needed for activation OTP/password setup, APN rejection, duplicate secondary rejection, customer ownership isolation, deactivated account restrictions, failed-payment retry, and repeated provisioning count.

## API Layer Coverage Added

Implemented in `api/src/modules/bulk-data`:

- `/api/overview`
- `/api/customers`
- `/api/customers/{customerId}`
- `/api/customers/{customerId}/status`
- `/api/customers/{customerId}/primary-msisdns`
- `/api/customers/{customerId}/primary-msisdns/{primaryMsisdn}/balance`
- `/api/customers/{customerId}/primary-msisdns/{primaryMsisdn}/secondary-numbers`
- `/api/customers/{customerId}/primary-msisdns/{primaryMsisdn}/secondary-numbers/bulk`
- `/api/customers/{customerId}/primary-msisdns/{primaryMsisdn}/secondary-numbers/{secondaryMsisdn}`
- `/api/customers/{customerId}/primary-msisdns/{primaryMsisdn}/secondary-numbers/{secondaryMsisdn}/usage`
- `/api/bundles`
- `/api/bundles/{bundleId}`
- `/api/purchases`
- `/api/purchases/{transactionId}/retry`
- `/api/purchases/{transactionId}/confirmation`
- `/api/service-requests`
- `/api/service-requests/{serviceRequestId}`
- `/api/service-requests/{serviceRequestId}/convert`
- `/api/reports/admin`
- `/api/reports/transactions`
- `/api/reports/customer`
- `/api/audit`

## Business Rule Matrix

| Requirement | Contract status | Fake API status | Real backend status | Validation result |
| --- | --- | --- | --- | --- |
| Configure bundles with volume, price, 30-day validity, and unique service code up to 4 TB | `/bundles` contract fixes `validityDays` at 30 | Fake package API rejects non-30-day validity | BulkDataModule DTO now validates 30-day package validity, max 4 TB, and unique service codes | Partial. Production still needs migrations, seed policy, and package-management tests. |
| Admin registers customers with business details, contact person, APN name/ID, and primary MSISDN | `/customers` contract exists | Implemented by fake DB | BulkDataModule implements registration use case and audit event | Partial. APN and provisioning provider calls are still simulated. |
| Primary MSISDN registration performs APN check through VasApps/UDM | Contract describes APN validation | Fake suffix-based APN simulation exists | BulkDataModule simulates APN validation locally | Gap. Implement APN validation adapter and normalize outcomes into a backend domain result. |
| Reject primary MSISDN if multiple APNs are returned | Contract examples include rejection reason | Simulated when MSISDN ends with `999` | BulkDataModule rejects the same condition locally | Partial. Replace simulation with real VasApps/UDM response handling. |
| Reject primary MSISDN if APN differs from registered APN | Contract examples include rejection reason | Simulated when MSISDN ends with `888` | BulkDataModule rejects the same condition locally | Partial. Replace simulation with real VasApps/UDM response handling. |
| Add primary subscriber only after APN validation passes, with provider-specific `usrStation = 3` enrichment | `/provisioning/subscriber` exists and hides provider-specific fields | Fake customer registration returns `provisioningAction: addSubscriber` | Provisioning adapter adds `usrStation: 3`; BulkDataModule records successful validation but does not yet call the adapter | Partial. Adapter is correct; customer workflow must call it when provider config is live. |
| Notify customer after successful customer/primary registration | Contract mentions activation notifications | Fake audit event only | Notification module exists, but no customer-registration notification workflow | Gap. Wire customer workflow to notification events/templates. |
| Customer activation uses OTP, then password creation | `/auth/activation/otp`, `/auth/activation/otp/verify`, and `/auth/activation/password` document the full journey | Fake API issues activation OTPs, verifies OTP, creates password, activates the customer, and starts a session cookie | Auth activation/password endpoints exist; OTP-before-password path still needs reconciliation with the production auth module | Partial. Contract and fake route coverage now match the solution flow; real backend should align its activation endpoints to the same path and OTP order. |
| Admin can view customer accounts, primary MSISDNs, secondary numbers, purchase history, bundle status, and activity logs | `/customers` detail/list contract exists | Implemented from fake data | BulkDataModule implements account list/detail and audit list | Partial. Read models are available; optimize query paths before production scale. |
| Admin can deactivate and reactivate accounts with reason and activity log | `/customers/{id}/status` contract exists | Fake status update blocks inactive customer login and purchase | BulkDataModule implements status changes and blocks purchases for inactive customers | Partial. Production auth must enforce the same deactivated-login block at identity/session level. |
| Customer can buy bundle from available package list | `/purchases` and `/bundles` contracts exist | Fake purchase sessions exist | BulkDataModule implements purchase/session creation | Partial. Real payment provider abstraction is still required. |
| Payment methods include MoMo, card, PRN, and airtime | Contract and fake data include these methods | Implemented in fake checkout/session data | BulkDataModule accepts all four methods and creates sessions | Partial. Provider-specific payment calls are still required. |
| After payment succeeds, provision first bundle via subscribe-service operation | `/purchases/{transactionId}/confirmation` contract exists | Fake route marks provisioned and returns flags | BulkDataModule confirms payment and updates transaction/balance state | Partial. Add purchase confirmation use case integration with subscribe-service provider operation. |
| If provisioning count is greater than 1, convert bundle volume to KB and send repeat count as `provisioningCount - 1` | Contract now documents KB and corrected repeat count examples | Fake route calculates `srvTopupCount = provisioningCount - 1` | BulkDataModule returns `srvTopupCount = provisioningCount - 1` | Partial. Actual update-subscription provider call still needs wiring. |
| Check bundle balance for a primary MSISDN | `/customers/{id}/primary-msisdns/{primary}/balance` contract exists | Fake balance lookup exists | BulkDataModule serves balances from local read model | Partial. Add provisioning check-balance operation for live provider data. |
| Add one secondary number | Contract exists | Fake API checks duplicates and APN simulation | BulkDataModule validates duplicate/APN rules and persists the secondary number | Partial. Add APN adapter and provisioning add-group-member call. |
| Add multiple secondary numbers through bulk upload with validation report | Contract exists | Fake API returns added/rejected result | BulkDataModule validates each row and returns added/rejected lists | Partial. Add provider bulk request after validation approval. |
| Reject secondary number already in a family | Contract/fake behavior exists | Implemented in fake DB | BulkDataModule rejects active duplicate secondary numbers | Pass for API-layer rule; add integration test. |
| Remove secondary number and notify primary/secondary | Contract exists | Fake route marks removed | BulkDataModule marks secondary number removed and audits it | Partial. Add provider delete-group-member call and notifications. |
| View secondary numbers linked to primary MSISDN | Contract exists | Fake paginated list exists | BulkDataModule implements paginated list | Pass for API-layer rule; optimize with indexed query paths. |
| Admin dashboards: active customers, purchases, revenue, primary/secondary counts, transactions, customer activity | `/overview`, `/reports/admin`, `/reports/transactions` contracts exist | Implemented from fake data | BulkDataModule implements overview and reports | Partial. Analytics should move to optimized read models for large datasets. |
| Customer dashboards: purchase history, data volumes, associated secondary numbers, spend | `/reports/customer` contract exists | Implemented from fake data | BulkDataModule implements customer report | Partial. Tie customer ownership to persisted customer/user relationship. |
| Public service request and admin conversion to customer profile | Contract exists | Fake service-request routes exist | BulkDataModule implements public submission, management, and conversion | Partial. Add notification and document upload support if required. |
| Customers only see and act on their own accounts; admins can access customer scope; support is isolated | Contract states role rules | Frontend route/sidebar gating exists | BulkDataModule applies role checks and customer ownership checks by contact email | Partial. Replace email matching with explicit user/customer relationship. |
| Product-facing APIs should not expose concrete provider details | OpenAPI uses Provisioning naming | UI mostly uses neutral naming | Internal adapter remains provider-specific | Pass. Keep provider names limited to config/adapter internals and backend-only docs. |
| Standard response envelope | Frontend OpenAPI uses `success`, `message`, `data`, `meta` | Fake API follows envelope | BulkDataModule follows the envelope; legacy auth/user controllers do not consistently return it | Partial. Add global response envelope pattern or DTO wrappers in backend. |
| Secure JWT session cookie instead of plain JSON token handling | Frontend docs require `__Host-mtn_bds_session` cookie | Fake login response documents cookie | NestJS Swagger/auth DTOs still expose `accessToken` and `refreshToken` in body | Gap. Update auth implementation and docs to issue signed HTTP-only session cookie and stop exposing tokens to client JavaScript. |
| Table search/filtering for large datasets and infinite-scroll support | List endpoints document `page`, `limit`, `search`, `status`, `dateFrom`, `dateTo` | Fake routes support page/limit filters | Real business repositories missing | Partial. For production infinite scroll, prefer cursor pagination or add cursor fields alongside page/limit. |

## OpenAPI Contract Corrections Made

- Clarified `ProvisioningUpdateSubscriptionRequest.topupValue` as KB.
- Added a contract rule that repeated provisioning applies only after the first successful provisioning and uses `provisioningCount - 1`.
- Corrected confirmation examples where `provisioningCount: 2` should return `srvTopupCount: 1`.

## Backend Implementation Backlog

Recommended order:

1. Reconcile backend-generated Swagger with `frontend/docs/openapi.yaml` and make one source of truth.
2. Implement APN validation adapter for VasApps/UDM with timeout, safe error handling, and normalized validation results.
3. Implement payment provider abstraction for MoMo, card, PRN, and airtime.
4. Extend provisioning abstraction with subscribe-service and check-balance operations if the provider contract exposes them separately.
5. Wire customer registration, primary MSISDN additions, secondary add/remove, and purchase confirmation to the provisioning adapter after validation succeeds.
6. Align backend auth responses with the HTTP-only session cookie contract and remove token exposure to client JavaScript.
7. Add `/api/preferences` and `/api/security/*` path aliases or update the frontend contract to match the existing backend auth/user modules.
8. Replace email-based customer ownership checks with an explicit user-to-customer relationship.
9. Add optimized query repositories/read models for dashboard and report endpoints.
10. Add integration/unit tests for APN rejection, duplicate secondary rejection, deactivated customer restrictions, purchase provisioning repeat count, failed payment retry, and customer ownership isolation.

## Current Validation Verdict

The API contract is now backed by a real NestJS business API layer for the core product workflows. It is still not production-complete against the solution document because external APN, payment, balance, notification, and provisioning workflows must be wired to real adapters and covered with tests.
