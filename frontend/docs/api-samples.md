# MTN Bulk Data Wholesale API Samples

This catalog gives the backend team a copyable request and success-response sample for every frontend API call. Authenticated calls assume the browser already has the HTTP-only session cookie set by `POST /api/auth/login`; client JavaScript must not read or attach bearer tokens.

All examples use `/api` as the backend base path.

## Auth

### POST `/api/auth/login`

```http
POST /api/auth/login
Content-Type: application/json

{
  "method": "password",
  "identifier": "1000172796",
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
      "id": "user-customer-001",
      "name": "Sarah Namuli",
      "email": "operations@wavenet.ug",
      "role": "customer",
      "customerId": "cus-wavenet"
    },
    "session": {
      "id": "sess-20260422-001",
      "expiresAt": "2026-04-22T18:00:00+03:00"
    },
    "nextRoute": "/console/customer",
    "promptPasswordlessSetup": true,
    "passwordlessSetupPrompt": {
      "title": "Set up passwordless login",
      "message": "Add a passkey so your next sign-in can use your device PIN, fingerprint, or face unlock.",
      "setupUrl": "/console?section=security"
    }
  }
}
```

### POST `/api/auth/activation/otp`

```http
POST /api/auth/activation/otp
Content-Type: application/json

{
  "token": "act_demo"
}
```

```json
{
  "success": true,
  "message": "Activation OTP issued successfully",
  "data": {
    "activationId": "otp_demo",
    "maskedEmail": "sa***@wavenet.ug",
    "expiresAt": "2026-04-22T09:10:00+03:00",
    "retryAfterSeconds": 60
  }
}
```

### POST `/api/auth/activation/otp/verify`

```http
POST /api/auth/activation/otp/verify
Content-Type: application/json

{
  "token": "act_demo",
  "activationId": "otp_demo",
  "otp": "123456"
}
```

```json
{
  "success": true,
  "message": "Activation OTP verified successfully",
  "data": {
    "passwordSetupToken": "pwd_demo",
    "expiresAt": "2026-04-22T10:00:00+03:00"
  }
}
```

### POST `/api/auth/activation/password`

```http
POST /api/auth/activation/password
Content-Type: application/json

{
  "passwordSetupToken": "pwd_demo",
  "password": "StrongPass123",
  "confirmPassword": "StrongPass123"
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
  "message": "Account activated successfully",
  "data": {
    "user": {
      "id": "user-customer-001",
      "name": "Sarah Namuli",
      "email": "operations@wavenet.ug",
      "role": "customer",
      "customerId": "cus-wavenet"
    },
    "session": {
      "id": "sess-20260422-002",
      "expiresAt": "2026-04-22T18:00:00+03:00"
    },
    "nextRoute": "/console?section=customer",
    "promptPasswordlessSetup": true,
    "passwordlessSetupPrompt": {
      "title": "Set up passwordless login",
      "message": "Add a passkey so your next sign-in can use your device PIN, fingerprint, or face unlock.",
      "setupUrl": "/console?section=security"
    }
  }
}
```

## Provisioning

These are privileged operational APIs. They should be exposed only to admin and support roles, not customer users.

### POST `/api/provisioning/group-member`

```http
POST /api/provisioning/group-member
Content-Type: application/json

{
  "secondaryMsisdn": "256779999707",
  "primaryMsisdn": "256772222222"
}
```

```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": {
    "requestId": "ae9183e8-5974-4183-824b-85f718adbb6d",
    "operation": "add_group_member",
    "accepted": true,
    "processedAt": "2026-05-01T09:30:00.000Z",
    "providerStatusCode": 200,
    "request": {
      "secondaryMsisdn": "256779999707",
      "primaryMsisdn": "256772222222"
    },
    "providerResponse": {
      "status": "SUCCESS",
      "message": "Request accepted",
      "referenceId": "PROV-20260501-0001"
    }
  }
}
```

### POST `/api/provisioning/group-members/bulk`

```http
POST /api/provisioning/group-members/bulk
Content-Type: application/json

{
  "groupMembers": [
    {
      "secondaryMsisdn": "256779999707",
      "primaryMsisdn": "256772222222"
    },
    {
      "secondaryMsisdn": "256779999708",
      "primaryMsisdn": "256772222222"
    }
  ]
}
```

```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": {
    "requestId": "97f3ac11-9d5b-4d3e-8d63-65d8c0dc53b4",
    "operation": "add_group_members_bulk",
    "accepted": true,
    "processedAt": "2026-05-01T09:31:00.000Z",
    "providerStatusCode": 200,
    "request": {
      "groupMembers": [
        {
          "secondaryMsisdn": "256779999707",
          "primaryMsisdn": "256772222222"
        },
        {
          "secondaryMsisdn": "256779999708",
          "primaryMsisdn": "256772222222"
        }
      ]
    },
    "providerResponse": {
      "status": "SUCCESS",
      "message": "Bulk request accepted",
      "referenceId": "PROV-20260501-0002"
    }
  }
}
```

### POST `/api/provisioning/group-member/delete`

```http
POST /api/provisioning/group-member/delete
Content-Type: application/json

{
  "secondaryMsisdn": "256779999707"
}
```

```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": {
    "requestId": "8d9b89f1-5d1a-4739-b31d-b08d6a1c6d93",
    "operation": "delete_group_member",
    "accepted": true,
    "processedAt": "2026-05-01T09:32:00.000Z",
    "providerStatusCode": 200,
    "request": {
      "secondaryMsisdn": "256779999707"
    },
    "providerResponse": {
      "status": "SUCCESS",
      "message": "Delete request accepted",
      "referenceId": "PROV-20260501-0003"
    }
  }
}
```

### POST `/api/provisioning/subscriptions/update`

`topupValue` is the bundle volume converted to KB. `updateAttemptCount` is the additional repeat count after the first successful provisioning.

```http
POST /api/provisioning/subscriptions/update
Content-Type: application/json

{
  "primaryMsisdn": "256772123456",
  "serviceCode": "DATA_BUNDLE_CODE",
  "transactionId": "567123456",
  "topupValue": 1024,
  "updateAttemptCount": 4
}
```

```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": {
    "requestId": "85ea7fce-73d4-4aa8-bb98-0cb4dc71fe6c",
    "operation": "update_subscription",
    "accepted": true,
    "processedAt": "2026-05-01T09:33:00.000Z",
    "providerStatusCode": 200,
    "request": {
      "primaryMsisdn": "256772123456",
      "serviceCode": "DATA_BUNDLE_CODE",
      "transactionId": "567123456",
      "topupValue": 1024,
      "updateAttemptCount": 4
    },
    "providerResponse": {
      "status": "SUCCESS",
      "message": "Subscription update accepted",
      "referenceId": "PROV-20260501-0004"
    }
  }
}
```

### POST `/api/provisioning/subscriber`

```http
POST /api/provisioning/subscriber
Content-Type: application/json

{
  "msisdn": "256779999707",
  "transactionId": "78954566743"
}
```

```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": {
    "requestId": "9e63ef34-f248-4b8e-a293-86e8361f6f85",
    "operation": "add_subscriber",
    "accepted": true,
    "processedAt": "2026-05-01T09:34:00.000Z",
    "providerStatusCode": 200,
    "request": {
      "msisdn": "256779999707",
      "transactionId": "78954566743"
    },
    "providerResponse": {
      "status": "SUCCESS",
      "message": "Subscriber request accepted",
      "referenceId": "PROV-20260501-0005"
    }
  }
}
```

## Overview And Dashboards

### GET `/api/overview`

```http
GET /api/overview?revenuePeriod=weekly
```

```json
{
  "success": true,
  "message": "Records fetched successfully",
  "data": {
    "metrics": [
      {
        "label": "Active customers",
        "value": "42",
        "trend": "+8% this month",
        "tone": "yellow"
      }
    ],
    "integrations": [
      {
        "name": "Network Provisioning",
        "status": "operational",
        "latencyMs": 118,
        "lastCheckedAt": "2026-04-22T09:00:00+03:00"
      }
    ],
    "analytics": {
      "revenueTrend": [
        {
          "label": "Week 1",
          "date": "2026-04-01",
          "revenueUgx": 17200000,
          "purchases": 12
        }
      ],
      "customerSpend": [
        {
          "customerName": "WaveNet",
          "spendUgx": 18500000,
          "purchases": 350,
          "secondaryNumbers": 430
        }
      ],
      "paymentMix": [
        {
          "paymentMethod": "mobile_money",
          "revenueUgx": 9200000,
          "transactions": 8
        }
      ],
      "statusBreakdown": [
        {
          "status": "provisioned",
          "revenueUgx": 21400000,
          "transactions": 17
        }
      ],
      "integrationLatency": [
        {
          "name": "Payments Gateway",
          "latencyMs": 156,
          "status": "operational"
        }
      ]
    },
    "topCustomers": [],
    "recentTransactions": []
  }
}
```

### GET `/api/overview` with custom dashboard range

```http
GET /api/overview?revenuePeriod=custom&dateFrom=2026-04-01&dateTo=2026-04-22
```

```json
{
  "success": true,
  "message": "Records fetched successfully",
  "data": {
    "metrics": [],
    "integrations": [],
    "analytics": {
      "revenueTrend": [
        {
          "label": "22 Apr",
          "date": "2026-04-22",
          "revenueUgx": 4600000,
          "purchases": 2
        }
      ],
      "customerSpend": [],
      "paymentMix": [],
      "statusBreakdown": [],
      "integrationLatency": []
    },
    "topCustomers": [],
    "recentTransactions": []
  }
}
```

## Customers

### GET `/api/customers`

```http
GET /api/customers?page=1&limit=10&search=WaveNet&status=active&dateFrom=2026-04-01&dateTo=2026-04-22
```

```json
{
  "success": true,
  "message": "Records fetched successfully",
  "data": [
    {
      "id": "cus-wavenet",
      "businessName": "WaveNet",
      "registrationNumber": "UG-BR-48290",
      "businessEmail": "business@wavenet.ug",
      "businessPhone": "+256772100200",
      "contactPerson": "Sarah Namuli",
      "email": "operations@wavenet.ug",
      "phone": "+256772100201",
      "apnName": "wavenet.mtn.ug",
      "apnId": "APN-1092",
      "primaryMsisdns": ["+256772990001", "+256772990002"],
      "secondaryCount": 430,
      "bundlePurchases": 350,
      "totalSpendUgx": 18500000,
      "status": "active",
      "createdAt": "2026-04-18T09:00:00+03:00"
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

### POST `/api/customers`

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
  "apnName": "wavenet.mtn.ug",
  "apnId": "APN-1092",
  "primaryMsisdn": "+256772990001"
}
```

```json
{
  "success": true,
  "message": "Customer registered successfully",
  "data": {
    "customer": {
      "id": "cus-wavenet",
      "businessName": "WaveNet Uganda",
      "registrationNumber": "UG-BR-1029",
      "businessEmail": "accounts@wavenet.ug",
      "businessPhone": "+256772991000",
      "contactPerson": "Sarah Namuli",
      "email": "sarah.namuli@wavenet.ug",
      "phone": "+256772991001",
      "apnName": "wavenet.mtn.ug",
      "apnId": "APN-1092",
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
      "reason": "MSISDN APN validation passed",
      "apnIds": ["APN-1092"],
      "registeredApnId": "APN-1092",
      "provisioningAction": "addSubscriber"
    }
  }
}
```

### GET `/api/customers/{customerId}`

```http
GET /api/customers/cus-wavenet
```

```json
{
  "success": true,
  "message": "Records fetched successfully",
  "data": {
    "id": "cus-wavenet",
    "businessName": "WaveNet",
    "registrationNumber": "UG-BR-48290",
    "businessEmail": "business@wavenet.ug",
    "businessPhone": "+256772100200",
    "contactPerson": "Sarah Namuli",
    "email": "operations@wavenet.ug",
    "phone": "+256772100201",
    "apnName": "wavenet.mtn.ug",
    "apnId": "APN-1092",
    "primaryMsisdns": ["+256772990001", "+256772990002"],
    "secondaryCount": 430,
    "bundlePurchases": 350,
    "totalSpendUgx": 18500000,
    "status": "active",
    "createdAt": "2026-04-18T09:00:00+03:00"
  }
}
```

### PATCH `/api/customers/{customerId}`

```http
PATCH /api/customers/cus-wavenet
Content-Type: application/json

{
  "businessEmail": "billing@wavenet.ug",
  "businessPhone": "+256772991009",
  "contactPerson": "Sarah Namuli",
  "contactEmail": "sarah.namuli@wavenet.ug",
  "contactPhone": "+256772991001"
}
```

```json
{
  "success": true,
  "message": "Customer updated successfully",
  "data": {
    "id": "cus-wavenet",
    "businessName": "WaveNet",
    "registrationNumber": "UG-BR-48290",
    "businessEmail": "billing@wavenet.ug",
    "businessPhone": "+256772991009",
    "contactPerson": "Sarah Namuli",
    "email": "sarah.namuli@wavenet.ug",
    "phone": "+256772991001",
    "apnName": "wavenet.mtn.ug",
    "apnId": "APN-1092",
    "primaryMsisdns": ["+256772990001"],
    "secondaryCount": 430,
    "bundlePurchases": 350,
    "totalSpendUgx": 18500000,
    "status": "active",
    "createdAt": "2026-04-18T09:00:00+03:00"
  }
}
```

### POST `/api/customers/{customerId}/status`

```http
POST /api/customers/cus-wavenet/status
Content-Type: application/json

{
  "status": "deactivated",
  "reason": "Customer requested suspension.",
  "supportingNote": "Approved by account manager."
}
```

```json
{
  "success": true,
  "message": "Customer status updated successfully",
  "data": {
    "id": "cus-wavenet",
    "businessName": "WaveNet",
    "status": "deactivated",
    "deactivationReason": "Customer requested suspension.",
    "primaryMsisdns": ["+256772990001"],
    "secondaryCount": 430,
    "bundlePurchases": 350,
    "totalSpendUgx": 18500000,
    "createdAt": "2026-04-18T09:00:00+03:00"
  }
}
```

### POST `/api/customers/{customerId}/primary-msisdns`

```http
POST /api/customers/cus-wavenet/primary-msisdns
Content-Type: application/json

{
  "primaryMsisdn": "+256772990003"
}
```

```json
{
  "success": true,
  "message": "Primary MSISDN added successfully",
  "data": {
    "customer": {
      "id": "cus-wavenet",
      "businessName": "WaveNet",
      "primaryMsisdns": ["+256772990001", "+256772990002", "+256772990003"],
      "status": "active"
    },
    "validation": {
      "msisdn": "+256772990003",
      "accepted": true,
      "reason": "MSISDN APN validation passed",
      "apnIds": ["APN-1092"],
      "registeredApnId": "APN-1092",
      "provisioningAction": "addSubscriber"
    }
  }
}
```

### GET `/api/customers/{customerId}/primary-msisdns/{primaryMsisdn}/balance`

```http
GET /api/customers/cus-wavenet/primary-msisdns/%2B256772990001/balance
```

```json
{
  "success": true,
  "message": "Records fetched successfully",
  "data": {
    "primaryMsisdn": "+256772990001",
    "bundleName": "Wholesale 2 TB",
    "totalVolumeGb": 2048,
    "remainingVolumeGb": 1334.5,
    "expiryAt": "2026-05-21T23:59:59+03:00",
    "autoTopupRemaining": 2
  }
}
```

## Secondary Numbers

### GET `/api/customers/{customerId}/primary-msisdns/{primaryMsisdn}/secondary-numbers`

```http
GET /api/customers/cus-wavenet/primary-msisdns/%2B256772990001/secondary-numbers?page=1&limit=10&search=991001&status=active
```

```json
{
  "success": true,
  "message": "Records fetched successfully",
  "data": [
    {
      "id": "sec-1",
      "customerId": "cus-wavenet",
      "primaryMsisdn": "+256772990001",
      "msisdn": "+256772991001",
      "apnId": "APN-1092",
      "status": "active",
      "addedAt": "2026-04-20T09:00:00+03:00"
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

### POST `/api/customers/{customerId}/primary-msisdns/{primaryMsisdn}/secondary-numbers`

```http
POST /api/customers/cus-wavenet/primary-msisdns/%2B256772990001/secondary-numbers
Content-Type: application/json

{
  "msisdn": "+256772991010"
}
```

```json
{
  "success": true,
  "message": "Secondary MSISDN added successfully",
  "data": {
    "secondaryNumber": {
      "id": "sec-101",
      "customerId": "cus-wavenet",
      "primaryMsisdn": "+256772990001",
      "msisdn": "+256772991010",
      "apnId": "APN-1092",
      "status": "active",
      "addedAt": "2026-04-22T09:15:00+03:00"
    },
    "validation": {
      "msisdn": "+256772991010",
      "accepted": true,
      "reason": "MSISDN APN validation passed",
      "apnIds": ["APN-1092"],
      "registeredApnId": "APN-1092",
      "provisioningAction": "addGroupMember"
    }
  }
}
```

### POST `/api/customers/{customerId}/primary-msisdns/{primaryMsisdn}/secondary-numbers/bulk`

```http
POST /api/customers/cus-wavenet/primary-msisdns/%2B256772990001/secondary-numbers/bulk
Content-Type: application/json

{
  "msisdns": ["+256772991011", "+256772991012"]
}
```

```json
{
  "success": true,
  "message": "Bulk secondary MSISDN upload processed",
  "data": {
    "added": [
      {
        "id": "sec-102",
        "customerId": "cus-wavenet",
        "primaryMsisdn": "+256772990001",
        "msisdn": "+256772991011",
        "apnId": "APN-1092",
        "status": "active",
        "addedAt": "2026-04-22T09:16:00+03:00"
      }
    ],
    "rejected": [
      {
        "msisdn": "+256772991012",
        "accepted": false,
        "reason": "MSISDN is already linked to this primary.",
        "apnIds": ["APN-1092"],
        "registeredApnId": "APN-1092",
        "provisioningAction": "addMultipleGroupMember"
      }
    ]
  }
}
```

### DELETE `/api/customers/{customerId}/primary-msisdns/{primaryMsisdn}/secondary-numbers/{secondaryMsisdn}`

```http
DELETE /api/customers/cus-wavenet/primary-msisdns/%2B256772990001/secondary-numbers/%2B256772991010
```

```json
{
  "success": true,
  "message": "Secondary MSISDN removed successfully",
  "data": {
    "id": "sec-101",
    "customerId": "cus-wavenet",
    "primaryMsisdn": "+256772990001",
    "msisdn": "+256772991010",
    "apnId": "APN-1092",
    "status": "removed",
    "addedAt": "2026-04-22T09:15:00+03:00"
  }
}
```

### GET `/api/customers/{customerId}/primary-msisdns/{primaryMsisdn}/secondary-numbers/{secondaryMsisdn}/usage`

```http
GET /api/customers/cus-wavenet/primary-msisdns/%2B256772990001/secondary-numbers/%2B256772991010/usage
```

```json
{
  "success": true,
  "message": "Secondary MSISDN usage fetched successfully",
  "data": {
    "customerId": "cus-wavenet",
    "primaryMsisdn": "+256772990001",
    "secondaryMsisdn": "+256772991010",
    "bundleName": "Wholesale 2 TB",
    "allocatedVolumeGb": 20,
    "usedVolumeGb": 8.4,
    "remainingVolumeGb": 11.6,
    "usagePercent": 42,
    "lastUsedAt": "2026-04-22T08:30:00+03:00",
    "status": "active"
  }
}
```

## Bundles

### GET `/api/bundles`

```http
GET /api/bundles?status=active&visible=true&search=1%20TB
```

```json
{
  "success": true,
  "message": "Records fetched successfully",
  "data": [
    {
      "id": "bundle-1tb",
      "serviceCode": "BDS-1T-30D",
      "name": "Wholesale 1 TB",
      "volumeTb": 1,
      "priceUgx": 2300000,
      "validityDays": 30,
      "status": "active",
      "visible": true,
      "createdAt": "2026-04-15T09:00:00+03:00",
      "updatedAt": "2026-04-21T09:00:00+03:00"
    }
  ]
}
```

### POST `/api/bundles`

```http
POST /api/bundles
Content-Type: application/json

{
  "serviceCode": "BDS-3T-30D",
  "name": "Wholesale 3 TB",
  "volumeTb": 3,
  "priceUgx": 6200000,
  "validityDays": 30,
  "status": "active",
  "visible": true
}
```

```json
{
  "success": true,
  "message": "Bundle package created successfully",
  "data": {
    "id": "bundle-3tb",
    "serviceCode": "BDS-3T-30D",
    "name": "Wholesale 3 TB",
    "volumeTb": 3,
    "priceUgx": 6200000,
    "validityDays": 30,
    "status": "active",
    "visible": true,
    "createdAt": "2026-04-22T10:00:00+03:00",
    "updatedAt": "2026-04-22T10:00:00+03:00"
  }
}
```

### GET `/api/bundles/{bundleId}`

```http
GET /api/bundles/bundle-1tb
```

```json
{
  "success": true,
  "message": "Records fetched successfully",
  "data": {
    "id": "bundle-1tb",
    "serviceCode": "BDS-1T-30D",
    "name": "Wholesale 1 TB",
    "volumeTb": 1,
    "priceUgx": 2300000,
    "validityDays": 30,
    "status": "active",
    "visible": true,
    "createdAt": "2026-04-15T09:00:00+03:00",
    "updatedAt": "2026-04-21T09:00:00+03:00"
  }
}
```

### PATCH `/api/bundles/{bundleId}`

```http
PATCH /api/bundles/bundle-1tb
Content-Type: application/json

{
  "visible": false,
  "status": "paused"
}
```

```json
{
  "success": true,
  "message": "Bundle package updated successfully",
  "data": {
    "id": "bundle-1tb",
    "serviceCode": "BDS-1T-30D",
    "name": "Wholesale 1 TB",
    "volumeTb": 1,
    "priceUgx": 2300000,
    "validityDays": 30,
    "status": "paused",
    "visible": false,
    "createdAt": "2026-04-15T09:00:00+03:00",
    "updatedAt": "2026-04-22T10:05:00+03:00"
  }
}
```

## Purchases And Payments

### POST `/api/purchases`

```http
POST /api/purchases
Content-Type: application/json

{
  "customerId": "cus-wavenet",
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
      "id": "txn-1009",
      "customerName": "WaveNet",
      "primaryMsisdn": "+256772990001",
      "bundleName": "Wholesale 1 TB",
      "paymentMethod": "prn",
      "amountUgx": 4600000,
      "status": "pending",
      "createdAt": "2026-04-22T09:08:00+03:00"
    },
    "paymentSession": {
      "id": "pay-20260422-001",
      "transactionId": "txn-1009",
      "paymentMethod": "prn",
      "status": "awaiting_payment",
      "amountUgx": 4600000,
      "currency": "UGX",
      "prn": "PRN-20260422-0001",
      "provider": "bank",
      "socketEvent": "payment.status",
      "socketRoom": "payments:pay-20260422-001",
      "expiresAt": "2026-04-22T09:23:00+03:00",
      "createdAt": "2026-04-22T09:08:00+03:00",
      "customerId": "cus-wavenet",
      "bundleId": "bundle-1tb",
      "provisioningCount": 2
    }
  }
}
```

### POST `/api/purchases/{transactionId}/retry`

Receipts are only available for `provisioned` transactions. Failed transactions should be retried instead of receiving a receipt.

```http
POST /api/purchases/txn-1012/retry
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
      "id": "txn-1012",
      "customerName": "WaveNet",
      "primaryMsisdn": "+256772990001",
      "bundleName": "Wholesale 1 TB",
      "paymentMethod": "prn",
      "amountUgx": 2300000,
      "status": "pending",
      "createdAt": "2026-04-22T08:40:00+03:00"
    },
    "paymentSession": {
      "id": "pay-20260422-002",
      "transactionId": "txn-1012",
      "paymentMethod": "prn",
      "status": "awaiting_payment",
      "amountUgx": 2300000,
      "currency": "UGX",
      "prn": "PRN-20260422-0002",
      "provider": "bank",
      "socketEvent": "payment.status",
      "socketRoom": "payments:pay-20260422-002",
      "expiresAt": "2026-04-22T10:05:00+03:00",
      "createdAt": "2026-04-22T09:50:00+03:00",
      "customerId": "cus-wavenet",
      "bundleId": "bundle-1tb",
      "provisioningCount": 1
    }
  }
}
```

### POST `/api/purchases/{transactionId}/confirmation`

```http
POST /api/purchases/txn-1009/confirmation
Content-Type: application/json

{
  "sessionId": "pay-20260422-001",
  "status": "confirmed"
}
```

```json
{
  "success": true,
  "message": "Payment confirmed and bundle provisioned successfully",
  "data": {
    "transaction": {
      "id": "txn-1009",
      "customerName": "WaveNet",
      "primaryMsisdn": "+256772990001",
      "bundleName": "Wholesale 1 TB",
      "paymentMethod": "prn",
      "amountUgx": 4600000,
      "status": "provisioned",
      "createdAt": "2026-04-22T09:08:00+03:00"
    },
    "paymentSession": {
      "id": "pay-20260422-001",
      "transactionId": "txn-1009",
      "paymentMethod": "prn",
      "status": "confirmed",
      "amountUgx": 4600000,
      "currency": "UGX",
      "prn": "PRN-20260422-0001",
      "provider": "bank",
      "socketEvent": "payment.status",
      "socketRoom": "payments:pay-20260422-001",
      "expiresAt": "2026-04-22T09:23:00+03:00",
      "createdAt": "2026-04-22T09:08:00+03:00",
      "customerId": "cus-wavenet",
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

## Service Requests

### GET `/api/service-requests`

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

### POST `/api/service-requests`

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

### GET `/api/service-requests/{serviceRequestId}`

```http
GET /api/service-requests/srv-1001
```

```json
{
  "success": true,
  "message": "Records fetched successfully",
  "data": {
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
}
```

### PATCH `/api/service-requests/{serviceRequestId}`

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

### POST `/api/service-requests/{serviceRequestId}/convert`

```http
POST /api/service-requests/srv-1001/convert
Content-Type: application/json

{
  "businessName": "Kampala Fiber Hub",
  "registrationNumber": "UG-BR-90321",
  "tin": "1000172796",
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
      "tin": "1000172796",
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
    },
    "activation": {
      "activationToken": "act_demo",
      "activationUrl": "/auth/activate?token=act_demo",
      "expiresAt": "2026-04-23T10:00:00+03:00",
      "deliveryChannels": ["contact_email", "contact_phone"]
    }
  }
}
```

## Reports

### GET `/api/reports/admin`

```http
GET /api/reports/admin?search=WaveNet&status=active&dateFrom=2026-04-01&dateTo=2026-04-22
```

```json
{
  "success": true,
  "message": "Records fetched successfully",
  "data": {
    "transactions": [
      {
        "id": "txn-1005",
        "customerName": "WaveNet",
        "primaryMsisdn": "+256772990001",
        "bundleName": "Wholesale 2 TB",
        "paymentMethod": "mobile_money",
        "amountUgx": 4300000,
        "status": "provisioned",
        "createdAt": "2026-04-21T08:42:00+03:00"
      }
    ],
    "customerActivity": [
      {
        "customerId": "cus-wavenet",
        "customerName": "WaveNet",
        "createdAt": "2026-04-18T09:00:00+03:00",
        "totalPrimaryNumbers": 2,
        "totalSecondaryNumbers": 430,
        "bundlesPurchased": 350,
        "totalSpendUgx": 18500000,
        "status": "active"
      }
    ]
  }
}
```

### GET `/api/reports/transactions`

```http
GET /api/reports/transactions?page=1&limit=10&search=WaveNet&customerId=cus-wavenet&paymentMethod=prn&status=provisioned&dateFrom=2026-04-01&dateTo=2026-04-22
```

```json
{
  "success": true,
  "message": "Records fetched successfully",
  "data": [
    {
      "id": "txn-1005",
      "customerId": "cus-wavenet",
      "customerName": "WaveNet",
      "registrationNumber": "UG-BR-48290",
      "apnId": "APN-1092",
      "primaryMsisdn": "+256772990001",
      "bundleName": "Wholesale 2 TB",
      "paymentMethod": "mobile_money",
      "amountUgx": 4300000,
      "status": "provisioned",
      "createdAt": "2026-04-21T08:42:00+03:00"
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

### GET `/api/reports/customer`

```http
GET /api/reports/customer?customerId=cus-wavenet&search=active&status=active&dateFrom=2026-04-01&dateTo=2026-04-22
```

```json
{
  "success": true,
  "message": "Records fetched successfully",
  "data": {
    "customerId": "cus-wavenet",
    "bundlePurchaseHistory": [
      {
        "id": "txn-1005",
        "customerName": "WaveNet",
        "primaryMsisdn": "+256772990001",
        "bundleName": "Wholesale 2 TB",
        "paymentMethod": "mobile_money",
        "amountUgx": 4300000,
        "status": "provisioned",
        "createdAt": "2026-04-21T08:42:00+03:00"
      }
    ],
    "secondaryNumbers": [
      {
        "id": "sec-1",
        "customerId": "cus-wavenet",
        "primaryMsisdn": "+256772990001",
        "msisdn": "+256772991001",
        "apnId": "APN-1092",
        "status": "active",
        "addedAt": "2026-04-20T09:00:00+03:00"
      }
    ],
    "balances": [
      {
        "primaryMsisdn": "+256772990001",
        "bundleName": "Wholesale 2 TB",
        "totalVolumeGb": 2048,
        "remainingVolumeGb": 1334.5,
        "expiryAt": "2026-05-21T23:59:59+03:00",
        "autoTopupRemaining": 2
      }
    ]
  }
}
```

## Preferences

### GET `/api/preferences`

```http
GET /api/preferences
```

```json
{
  "success": true,
  "message": "Records fetched successfully",
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

### PUT `/api/preferences`

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

## Security

### GET `/api/security/mfa`

```http
GET /api/security/mfa
```

```json
{
  "success": true,
  "message": "Records fetched successfully",
  "data": {
    "services": [
      {
        "id": "totp",
        "label": "Authenticator app",
        "enabled": true,
        "requiredForAdmins": true,
        "requiredForCustomers": false,
        "lastUpdatedAt": "2026-04-22T09:00:00+03:00"
      }
    ],
    "trustedDeviceDays": 30,
    "stepUpForBundlePurchases": true,
    "stepUpForSecondaryNumberChanges": true
  }
}
```

### PUT `/api/security/mfa`

```http
PUT /api/security/mfa
Content-Type: application/json

{
  "services": [
    {
      "id": "totp",
      "label": "Authenticator app",
      "enabled": true,
      "requiredForAdmins": true,
      "requiredForCustomers": false,
      "lastUpdatedAt": "2026-04-22T09:00:00+03:00"
    }
  ],
  "trustedDeviceDays": 30,
  "stepUpForBundlePurchases": true,
  "stepUpForSecondaryNumberChanges": true
}
```

```json
{
  "success": true,
  "message": "MFA configuration updated successfully",
  "data": {
    "services": [
      {
        "id": "totp",
        "label": "Authenticator app",
        "enabled": true,
        "requiredForAdmins": true,
        "requiredForCustomers": false,
        "lastUpdatedAt": "2026-04-22T09:00:00+03:00"
      }
    ],
    "trustedDeviceDays": 30,
    "stepUpForBundlePurchases": true,
    "stepUpForSecondaryNumberChanges": true
  }
}
```

### POST `/api/security/totp/enrollment`

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
    "recoveryCodes": ["MTN-8K2D-1P9Q", "MTN-4F7H-6R2X"],
    "expiresAt": "2026-04-22T09:30:00+03:00"
  }
}
```

### POST `/api/security/totp/enrollment/verify`

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
    "recoveryCodes": ["MTN-8K2D-1P9Q", "MTN-4F7H-6R2X"],
    "verifiedAt": "2026-04-22T09:21:00+03:00"
  }
}
```

### GET `/api/security/totp/apps`

```http
GET /api/security/totp/apps
```

```json
{
  "success": true,
  "message": "Authenticator apps fetched successfully",
  "data": [
    {
      "id": "totp-app-001",
      "label": "Microsoft Authenticator",
      "issuer": "MTN Bulk Data Wholesale",
      "accountName": "operations@wavenet.ug",
      "createdAt": "2026-04-22T09:21:00+03:00",
      "lastUsedAt": "2026-04-22T09:21:00+03:00",
      "status": "active"
    }
  ]
}
```

### GET `/api/security/sessions`

```http
GET /api/security/sessions
```

```json
{
  "success": true,
  "message": "Records fetched successfully",
  "data": [
    {
      "id": "sess-20260422-001",
      "device": "MacBook Pro",
      "browser": "Chrome 125",
      "ipAddress": "196.43.183.20",
      "location": "Kampala, Uganda",
      "createdAt": "2026-04-22T08:00:00+03:00",
      "lastActiveAt": "2026-04-22T09:25:00+03:00",
      "current": true,
      "status": "active"
    }
  ]
}
```

### DELETE `/api/security/sessions/{sessionId}`

```http
DELETE /api/security/sessions/sess-20260421-003
```

```json
{
  "success": true,
  "message": "Session revoked successfully",
  "data": {
    "id": "sess-20260421-003",
    "device": "Windows laptop",
    "browser": "Edge 125",
    "ipAddress": "196.43.183.22",
    "location": "Kampala, Uganda",
    "createdAt": "2026-04-21T08:00:00+03:00",
    "lastActiveAt": "2026-04-21T17:30:00+03:00",
    "current": false,
    "status": "revoked"
  }
}
```

### POST `/api/security/webauthn/options`

```http
POST /api/security/webauthn/options
Content-Type: application/json

{}
```

```json
{
  "success": true,
  "message": "WebAuthn registration options generated",
  "data": {
    "challenge": "7f5d6b7c8a9e",
    "rp": {
      "id": "portal.example.com",
      "name": "MTN Bulk Data Wholesale"
    },
    "user": {
      "id": "user-customer-001",
      "name": "operations@wavenet.ug",
      "displayName": "Sarah Namuli"
    },
    "pubKeyCredParams": [
      {
        "type": "public-key",
        "alg": -7
      }
    ],
    "timeout": 60000,
    "authenticatorSelection": {
      "residentKey": "preferred",
      "userVerification": "preferred"
    },
    "attestation": "none"
  }
}
```

### GET `/api/security/webauthn/devices`

```http
GET /api/security/webauthn/devices
```

```json
{
  "success": true,
  "message": "Records fetched successfully",
  "data": [
    {
      "id": "webauthn-device-001",
      "label": "Sarah MacBook passkey",
      "credentialId": "webauthn-credential-001",
      "transports": ["internal"],
      "createdAt": "2026-04-22T09:30:00+03:00",
      "lastUsedAt": "2026-04-22T09:30:00+03:00",
      "status": "active"
    }
  ]
}
```

### POST `/api/security/webauthn/devices`

```http
POST /api/security/webauthn/devices
Content-Type: application/json

{
  "label": "Sarah MacBook passkey",
  "credentialId": "webauthn-credential-001",
  "transports": ["internal"]
}
```

```json
{
  "success": true,
  "message": "WebAuthn device registered successfully",
  "data": {
    "id": "webauthn-device-001",
    "label": "Sarah MacBook passkey",
    "credentialId": "webauthn-credential-001",
    "transports": ["internal"],
    "createdAt": "2026-04-22T09:30:00+03:00",
    "lastUsedAt": "2026-04-22T09:30:00+03:00",
    "status": "active"
  }
}
```

### DELETE `/api/security/webauthn/devices/{deviceId}`

```http
DELETE /api/security/webauthn/devices/webauthn-device-001
```

```json
{
  "success": true,
  "message": "WebAuthn device revoked successfully",
  "data": {
    "id": "webauthn-device-001",
    "label": "Sarah MacBook passkey",
    "credentialId": "webauthn-credential-001",
    "transports": ["internal"],
    "createdAt": "2026-04-22T09:30:00+03:00",
    "lastUsedAt": "2026-04-22T09:30:00+03:00",
    "status": "revoked"
  }
}
```

## Audit

### GET `/api/audit`

```http
GET /api/audit?page=1&limit=10&search=login&category=security&status=success&dateFrom=2026-04-01&dateTo=2026-04-22
```

```json
{
  "success": true,
  "message": "Records fetched successfully",
  "data": [
    {
      "id": "audit-001",
      "category": "security",
      "action": "Login success",
      "actor": "operations@wavenet.ug",
      "outcome": "success",
      "createdAt": "2026-04-22T09:00:00+03:00"
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

## Error Envelope

All endpoints use the same error envelope.

```json
{
  "success": false,
  "message": "Validation failed",
  "data": null
}
```
