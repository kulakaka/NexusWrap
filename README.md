# API Documentation

## Overview

This API documentation provides information on the endpoints available for interacting with the wallet system. The system supports two users, each identified by a unique ID (uid) of either 0 or 1.

### Base URL

The base URL for all endpoints is `http://104.215.140.82/api/`.

## List Wallets

### GET /list-wallets

Get the list of wallets associated with a specific user.

#### Parameters

- `uid`: User ID (0 or 1)

#### Example

```http
GET /list-wallets?uid=0
```

#### Sample Response

```json
{
  "balances": [
    {
      "id": "f71b556c-126c-4e23-8cb9-bba32d78cb27",
      "name": "EUR Account",
      "userId": "cf436ffc-c559-4e0a-a593-bfc9c01df3ea",
      "assetId": "13a477e7-aea9-43bb-8713-d68dcf6a56e9",
      "assetCode": "EUR",
      "assetScale": 2,
      "balance": "9685",
      "virtualAccountId": "issuing_df597dc40c89ca47d20445a1ad1f9a39",
      "createdAt": "2024-01-15T10:26:49.879Z",
      "updatedAt": "2024-01-15T10:26:49.879Z",
      "debt": "0.00"
    },
    // ... additional wallet entries ...
  ],
  "wallets": [
    {
      "id": "d33d67c1-ea33-4340-96d1-58ff25cf8ea8",
      "url": "https://ilp.api.money/28d8fdb",
      // ... additional wallet fields ...
    },
    // ... additional wallet entries ...
  ]
}
```

## Transactions

### GET /transactions

Get a list of transactions associated with a specific user.

#### Parameters

- `uid`: User ID (0 or 1)

#### Example

```http
GET /transactions?uid=0
```

#### Sample Response

```json
{
  "success": true,
  "message": "SUCCESS",
  "data": {
    "results": [
      {
        "id": "b63bd362-bf70-4ceb-9a63-0b629e67252d",
        // ... additional transaction fields ...
      },
      // ... additional transaction entries ...
    ],
    "total": 29
  }
}
```

## Confirm Transaction

### GET /confirm

Confirm a transaction using the provided quote ID.

#### Parameters

- `quote`: Quote ID obtained from `/send`

#### Example

```http
GET /confirm?quote=a5b87705-76fa-4331-8973-c15416aa1276
```

#### Sample Response

```json
{
  "success": true,
  "message": "SUCCESS"
}
```

## Send Transaction

### POST /send

Initiate a new transaction.

#### Parameters

- `uid`: User ID (0 or 1)
- `source`: Wallet ID from `/list-wallets`
- `dest`: Destination URL
- `amt`: Amount to send
- `desc`: Transaction description

#### Example

```http
POST /send?uid=0
```

##### Request Body

```json
{
  "source": "d33d67c1-ea33-4340-96d1-58ff25cf8ea8",
  "dest": "https://ilp.api.money/usdpymtptt",
  "amt": 5,
  "desc": "whatever here"
}
```

#### Sample Response

```json
{
  "success": true,
  "message": "SUCCESS",
  "data": {
    "id": ${quoteId},
    // ... transaction details ...
  }
}
```

Please note that the currency/token will be automatically converted or swapped during the transaction.
