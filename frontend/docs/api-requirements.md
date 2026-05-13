# MTN Bulk Data Wholesale API Requirements

This frontend expects the backend to expose the OpenAPI contract in [openapi.yaml](./openapi.yaml). A complete request/response sample catalog for every API call is maintained in [api-samples.md](./api-samples.md). All examples below use the live backend base path `/api`.

## Contract Rules

- Every response uses the standard envelope: `success`, `message`, `data`, and optional `meta`.
- Paginated endpoints return `meta.page`, `meta.limit`, `meta.total`, `meta.totalPages`, `meta.hasNextPage`, and `meta.hasPreviousPage`.
- Authenticated endpoints require the HTTP-only JWT session cookie set by `/api/auth/login` unless the OpenAPI operation explicitly sets `security: []`.
- Phone/MSISDN values must be E.164 Uganda MTN numbers matching `+256(77|78|79|76|39)XXXXXXX`.
- Table endpoints must support `page`, `limit`, `search`, `status`, `dateFrom`, and `dateTo` where documented because the frontend falls back to backend search when local search returns no rows.
- Purchase initiation returns a `paymentSession`; the frontend listens for payment status and then calls payment confirmation.
- Customer activation follows the solution-document flow: activation link, email OTP verification, password creation, activation notifications, and immediate portal access through an HTTP-only session cookie.
- Bundle validity is fixed at 30 days. Package creation and updates must reject any other validity period.
- After successful payment, the backend must provision the first bundle immediately, then apply repeated provisioning only when `provisioningCount > 1`; repeated top-up volume is sent in KB and the repeat count is `provisioningCount - 1`.
- Role enforcement must happen server-side. Customers can only access their own account scope; admins can access admin and customer-scoped operations.
- Support users can access privileged operational provisioning views, but package-management and audit-only administration stays restricted to admins.
- The current provisioning API base URL is `http://10.156.42.7:9040`; backend deployments should set `PROVISIONING_PCRF_BASE_URL` to this value and override the individual `PROVISIONING_PCRF_*_PATH` variables if the upstream path layout differs.
- Public endpoints are limited to login, customer activation, package showcase reads where exposed, and service requests. Administrative customer, bundle, purchase, report, preference, and security operations require authentication.
- Sensitive actions should be auditable by the backend: login, MFA changes, session revocation, account status changes, primary/secondary number changes, package changes, purchases, and payment confirmations.
- Login must set the session as a cookie, not as a JSON bearer token. In production the cookie must be `__Host-mtn_bds_session`, `HttpOnly`, `Secure`, `SameSite=Strict`, `Path=/`, `Max-Age=28800`, signed, and issued without a `Domain` attribute.

## Reviewed API Scope

- Auth: OTP, password, passkey login, and first-time customer account activation with OTP and password creation.
- Customer administration: create/update/view customers, status changes, primary MSISDN management, account-scoped detail views.
- Provisioning operations: admin/support-only endpoints for add subscriber, add/delete group member, bulk group-member upload, and subscription update. The concrete provider is abstracted behind a backend adapter.
- Customer portal: scoped balances, secondary numbers, usage checks, package purchases, receipts, and customer reports.
- Packages: list, create, update, visibility changes, and disabled/paused/active states.
- Payments: MoMo, card, PRN, and airtime initiation; PRN generation; payment confirmation callback; payment-session status tracking.
- Reports: admin report datasets, service-request management, dedicated paginated transaction report, and customer-specific reporting.
- Security: MFA service policy, multiple authenticator apps, recovery codes, sessions, and WebAuthn device management.
- Preferences: theme, language, timezone, default landing, density, quiet hours, and notification channels.

## Sample Requests And Responses

Authenticated examples assume the browser already has the HTTP-only session cookie from `/api/auth/login`; client JavaScript must not read or attach a bearer token.

### Login

```http
POST /api/auth/login
Content-Type: application/json

{
  "method": "password",
  "email": "customer@example.com",
  "password": "********"
}
```

```http
HTTP/1.1 200 OK
Set-Cookie: __Host-mtn_bds_session=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...; Max-Age=28800; Path=/; HttpOnly; Secure; SameSite=Strict
Content-Type: application/json
```

```json
{
  "success": true,
  "message": "Signed in successfully",
  "data": {
    "user": {
      "id": "user-cust-001",
      "name": "Sarah Namuli",
      "email": "customer@example.com",
      "role": "customer",
      "customerId": "cust-001"
    },
    "session": {
      "id": "sess-001",
      "expiresAt": "2026-04-22T18:00:00+03:00"
    },
    "nextRoute": "/console",
    "promptPasswordlessSetup": true,
    "passwordlessSetupPrompt": {
      "title": "Set up passwordless login",
      "message": "Add a passkey so your next sign-in can use your device PIN, fingerprint, or face unlock.",
      "setupUrl": "/console?section=security"
    }
  }
}
```

### Register Customer

```http
POST /api/customers
Content-Type: application/json

{
  "businessName": "WaveNet Uganda",
  "registrationNumber": "UG-BR-1029",
  "businessEmail": "accounts@wavenet.ug",
  "businessPhone": "+256772991000",
  "contactPerson": "Sarah Namuli",
  "contactEmail": "sarah.namuli@wavenet.ug",
  "contactPhone": "+256772991001",
  "apnName": "wavenet.mtn",
  "apnId": "APN-7781",
  "primaryMsisdn": "+256772990001"
}
```

```json
{
  "success": true,
  "message": "Customer registered successfully",
  "data": {
    "customer": {
      "id": "cust-001",
      "businessName": "WaveNet Uganda",
      "registrationNumber": "UG-BR-1029",
      "businessEmail": "accounts@wavenet.ug",
      "businessPhone": "+256772991000",
      "contactPerson": "Sarah Namuli",
      "email": "sarah.namuli@wavenet.ug",
      "phone": "+256772991001",
      "apnName": "wavenet.mtn",
      "apnId": "APN-7781",
      "primaryMsisdns": ["+256772990001"],
      "secondaryCount": 0,
      "bundlePurchases": 0,
      "totalSpendUgx": 0,
      "status": "active",
      "createdAt": "2026-04-22T09:00:00+03:00"
    },
    "validation": {
      "msisdn": "+256772990001",
      "accepted": true,
      "reason": "MSISDN is valid for this APN.",
      "apnIds": ["APN-7781"],
      "registeredApnId": "APN-7781",
      "provisioningAction": "addSubscriber"
    }
  }
}
```

### Purchase Bundle With PRN

```http
POST /api/purchases
Content-Type: application/json

{
  "customerId": "cust-001",
  "primaryMsisdn": "+256772990001",
  "bundleId": "bundle-1tb",
  "provisioningCount": 2,
  "paymentMethod": "prn",
  "prnProvider": "bank"
}
```

```json
{
  "success": true,
  "message": "Payment initiated successfully",
  "data": {
    "transaction": {
      "id": "txn-001",
      "customerName": "WaveNet Uganda",
      "primaryMsisdn": "+256772990001",
      "bundleName": "Wholesale 1 TB",
      "paymentMethod": "prn",
      "amountUgx": 4600000,
      "status": "pending",
      "createdAt": "2026-04-22T09:08:00+03:00"
    },
    "paymentSession": {
      "id": "pay-001",
      "transactionId": "txn-001",
      "paymentMethod": "prn",
      "status": "awaiting_payment",
      "amountUgx": 4600000,
      "currency": "UGX",
      "prn": "PRN-20260422-0001",
      "provider": "bank",
      "socketEvent": "payment.status",
      "socketRoom": "payments:pay-001",
      "expiresAt": "2026-04-22T09:23:00+03:00",
      "createdAt": "2026-04-22T09:08:00+03:00",
      "customerId": "cust-001",
      "bundleId": "bundle-1tb",
      "provisioningCount": 2
    }
  }
}
```

### Retry Failed Purchase

Receipts must only be generated for `provisioned` transactions. Failed transactions should expose retry instead.

```http
POST /api/purchases/txn-001/retry
Content-Type: application/json

{
  "prnProvider": "bank"
}
```

```json
{
  "success": true,
  "message": "Payment retry initiated successfully",
  "data": {
    "transaction": {
      "id": "txn-001",
      "customerName": "WaveNet Uganda",
      "primaryMsisdn": "+256772990001",
      "bundleName": "Wholesale 1 TB",
      "paymentMethod": "prn",
      "amountUgx": 2300000,
      "status": "pending",
      "createdAt": "2026-04-22T09:08:00+03:00"
    },
    "paymentSession": {
      "id": "pay-002",
      "transactionId": "txn-001",
      "paymentMethod": "prn",
      "status": "awaiting_payment",
      "amountUgx": 2300000,
      "currency": "UGX",
      "prn": "PRN-20260422-0002",
      "provider": "bank",
      "socketEvent": "payment.status",
      "socketRoom": "payments:pay-002",
      "expiresAt": "2026-04-22T09:40:00+03:00",
      "createdAt": "2026-04-22T09:25:00+03:00",
      "customerId": "cust-001",
      "bundleId": "bundle-1tb",
      "provisioningCount": 1
    }
  }
}
```

### Add Secondary Number

```http
POST /api/customers/cust-001/primary-msisdns/%2B256772990001/secondary-numbers
Content-Type: application/json

{
  "msisdn": "+256772991010"
}
```

```json
{
  "success": true,
  "message": "Secondary number added successfully",
  "data": {
    "secondaryNumber": {
      "id": "sec-001",
      "customerId": "cust-001",
      "primaryMsisdn": "+256772990001",
      "msisdn": "+256772991010",
      "apnId": "APN-7781",
      "status": "active",
      "addedAt": "2026-04-22T09:15:00+03:00"
    },
    "validation": {
      "msisdn": "+256772991010",
      "accepted": true,
      "reason": "MSISDN is valid for this APN.",
      "apnIds": ["APN-7781"],
      "registeredApnId": "APN-7781",
      "provisioningAction": "addGroupMember"
    }
  }
}
```

### Paginated Transaction Report

```http
GET /api/reports/transactions?page=1&limit=10&search=WaveNet&paymentMethod=prn&status=provisioned&dateFrom=2026-04-01&dateTo=2026-04-22
```

```json
{
  "success": true,
  "message": "Records fetched successfully",
  "data": [
    {
      "id": "txn-001",
      "customerId": "cust-001",
      "customerName": "WaveNet Uganda",
      "registrationNumber": "UG-BR-1029",
      "apnId": "APN-7781",
      "primaryMsisdn": "+256772990001",
      "bundleName": "Wholesale 1 TB",
      "paymentMethod": "prn",
      "amountUgx": 4600000,
      "status": "provisioned",
      "createdAt": "2026-04-22T09:08:00+03:00"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 1,
    "totalPages": 1,
    "hasNextPage": false,
    "hasPreviousPage": false
  }
}
```

### Confirm Payment

```http
POST /api/purchases/txn-001/confirmation
Content-Type: application/json

{
  "sessionId": "pay-001",
  "status": "confirmed"
}
```

```json
{
  "success": true,
  "message": "Payment confirmed and bundle provisioned successfully",
  "data": {
    "transaction": {
      "id": "txn-001",
      "customerName": "WaveNet Uganda",
      "primaryMsisdn": "+256772990001",
      "bundleName": "Wholesale 1 TB",
      "paymentMethod": "prn",
      "amountUgx": 4600000,
      "status": "provisioned",
      "createdAt": "2026-04-22T09:08:00+03:00"
    },
    "paymentSession": {
      "id": "pay-001",
      "transactionId": "txn-001",
      "paymentMethod": "prn",
      "status": "confirmed",
      "amountUgx": 4600000,
      "currency": "UGX",
      "prn": "PRN-20260422-0001",
      "provider": "bank",
      "socketEvent": "payment.status",
      "socketRoom": "payments:pay-001",
      "expiresAt": "2026-04-22T09:23:00+03:00",
      "createdAt": "2026-04-22T09:08:00+03:00",
      "customerId": "cust-001",
      "bundleId": "bundle-1tb",
      "provisioningCount": 2
    },
    "provisioningRequest": {
      "subscribeService": true,
      "modifySubSubscription": true,
      "srvTopupCount": 1
    }
  }
}
```

### Public Service Request

```http
POST /api/service-requests
Content-Type: application/json

{
  "businessName": "WaveNet Uganda",
  "contactPerson": "Sarah Namuli",
  "contactEmail": "operations@wavenet.ug",
  "contactPhone": "+256772991001",
  "preferredPackageId": "bundle-1tb",
  "message": "We need bulk data for managed branch devices."
}
```

```json
{
  "success": true,
  "message": "Service request submitted successfully",
  "data": {
    "id": "req-20260422-001",
    "businessName": "WaveNet Uganda",
    "contactPerson": "Sarah Namuli",
    "contactEmail": "operations@wavenet.ug",
    "contactPhone": "+256772991001",
    "preferredPackageId": "bundle-1tb",
    "preferredPackageName": "Wholesale 1 TB",
    "message": "We need bulk data for managed branch devices.",
    "status": "new",
    "createdAt": "2026-04-22T09:20:00+03:00"
  }
}
```

### Service Request Report

```http
GET /api/service-requests?page=1&limit=10&search=Kampala&status=new&dateFrom=2026-04-01&dateTo=2026-04-22
```

```json
{
  "success": true,
  "message": "Records fetched successfully",
  "data": [
    {
      "id": "srv-1001",
      "businessName": "Kampala Fiber Hub",
      "contactPerson": "Grace Nansubuga",
      "contactEmail": "operations@kampalafiber.ug",
      "contactPhone": "+256772441120",
      "preferredPackageId": "bundle-1tb",
      "preferredPackageName": "Wholesale 1 TB",
      "message": "We need data pooling for branch routers and field teams.",
      "status": "new",
      "createdAt": "2026-04-21T10:30:00+03:00"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 1,
    "totalPages": 1,
    "hasNextPage": false,
    "hasPreviousPage": false
  }
}
```

### Mark Service Request Contacted

```http
PATCH /api/service-requests/srv-1001
Content-Type: application/json

{
  "status": "contacted",
  "note": "Spoke with the contact and confirmed onboarding documents are ready."
}
```

```json
{
  "success": true,
  "message": "Service request updated successfully",
  "data": {
    "id": "srv-1001",
    "businessName": "Kampala Fiber Hub",
    "contactPerson": "Grace Nansubuga",
    "contactEmail": "operations@kampalafiber.ug",
    "contactPhone": "+256772441120",
    "preferredPackageId": "bundle-1tb",
    "preferredPackageName": "Wholesale 1 TB",
    "message": "We need data pooling for branch routers and field teams.",
    "status": "contacted",
    "createdAt": "2026-04-21T10:30:00+03:00"
  }
}
```

### Convert Service Request To Customer

```http
POST /api/service-requests/srv-1001/convert
Content-Type: application/json

{
  "businessName": "Kampala Fiber Hub",
  "registrationNumber": "UG-BR-90321",
  "businessEmail": "operations@kampalafiber.ug",
  "businessPhone": "+256772441120",
  "contactPerson": "Grace Nansubuga",
  "contactEmail": "operations@kampalafiber.ug",
  "contactPhone": "+256772441120",
  "apnName": "kampalafiber.mtn.ug",
  "apnId": "APN-2201",
  "primaryMsisdn": "+256772441130"
}
```

```json
{
  "success": true,
  "message": "Service request converted to customer successfully",
  "data": {
    "serviceRequest": {
      "id": "srv-1001",
      "businessName": "Kampala Fiber Hub",
      "contactPerson": "Grace Nansubuga",
      "contactEmail": "operations@kampalafiber.ug",
      "contactPhone": "+256772441120",
      "preferredPackageId": "bundle-1tb",
      "preferredPackageName": "Wholesale 1 TB",
      "message": "We need data pooling for branch routers and field teams.",
      "status": "converted",
      "createdAt": "2026-04-21T10:30:00+03:00"
    },
    "customer": {
      "id": "cus-kfh",
      "businessName": "Kampala Fiber Hub",
      "registrationNumber": "UG-BR-90321",
      "businessEmail": "operations@kampalafiber.ug",
      "businessPhone": "+256772441120",
      "contactPerson": "Grace Nansubuga",
      "email": "operations@kampalafiber.ug",
      "phone": "+256772441120",
      "apnName": "kampalafiber.mtn.ug",
      "apnId": "APN-2201",
      "primaryMsisdns": ["+256772441130"],
      "secondaryCount": 0,
      "bundlePurchases": 0,
      "totalSpendUgx": 0,
      "status": "pending",
      "createdAt": "2026-04-22T10:00:00+03:00"
    },
    "validation": {
      "msisdn": "+256772441130",
      "accepted": true,
      "reason": "MSISDN APN validation passed",
      "apnIds": ["APN-2201"],
      "registeredApnId": "APN-2201",
      "provisioningAction": "addSubscriber"
    }
  }
}
```

### Start Authenticator Enrollment

```http
POST /api/security/totp/enrollment
Content-Type: application/json

{
  "label": "Microsoft Authenticator"
}
```

```json
{
  "success": true,
  "message": "Authenticator enrollment started successfully",
  "data": {
    "id": "totp-enroll-001",
    "label": "Microsoft Authenticator",
    "secret": "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP",
    "otpauthUrl": "otpauth://totp/MTN%20Bulk%20Data%20Wholesale:operations%40wavenet.ug?secret=JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP&issuer=MTN%20Bulk%20Data%20Wholesale",
    "issuer": "MTN Bulk Data Wholesale",
    "accountName": "operations@wavenet.ug",
    "qrCodeDataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA",
    "recoveryCodes": [
      "MTN-8K2D-1P9Q",
      "MTN-4F7H-6R2X"
    ],
    "expiresAt": "2026-04-22T09:30:00+03:00"
  }
}
```

### Verify Authenticator Enrollment

```http
POST /api/security/totp/enrollment/verify
Content-Type: application/json

{
  "enrollmentId": "totp-enroll-001",
  "code": "123456"
}
```

```json
{
  "success": true,
  "message": "Authenticator app enrolled successfully",
  "data": {
    "enabled": true,
    "app": {
      "id": "totp-app-001",
      "label": "Microsoft Authenticator",
      "issuer": "MTN Bulk Data Wholesale",
      "accountName": "operations@wavenet.ug",
      "createdAt": "2026-04-22T09:21:00+03:00",
      "lastUsedAt": "2026-04-22T09:21:00+03:00",
      "status": "active"
    },
    "recoveryCodes": [
      "MTN-8K2D-1P9Q",
      "MTN-4F7H-6R2X"
    ],
    "verifiedAt": "2026-04-22T09:21:00+03:00"
  }
}
```

### Update Preferences

```http
PUT /api/preferences
Content-Type: application/json

{
  "theme": "system",
  "language": "en",
  "timezone": "Africa/Kampala",
  "defaultLanding": "customer",
  "dataDensity": "comfortable",
  "quietHours": {
    "enabled": true,
    "start": "20:00",
    "end": "07:00"
  },
  "notifications": {
    "email": true,
    "sms": true,
    "whatsapp": false,
    "inApp": true
  }
}
```

```json
{
  "success": true,
  "message": "Preferences updated successfully",
  "data": {
    "theme": "system",
    "language": "en",
    "timezone": "Africa/Kampala",
    "defaultLanding": "customer",
    "dataDensity": "comfortable",
    "quietHours": {
      "enabled": true,
      "start": "20:00",
      "end": "07:00"
    },
    "notifications": {
      "email": true,
      "sms": true,
      "whatsapp": false,
      "inApp": true
    }
  }
}
```

### Validation Error

```json
{
  "success": false,
  "message": "Validation failed",
  "data": null
}
```
