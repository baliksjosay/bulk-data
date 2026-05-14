# MTN Bulk Data Wholesale Frontend

End-to-end Next.js frontend for the MTN Bulk Data Wholesale Service operating console.

## Stack

- Next.js App Router
- React 19
- TypeScript 6
- Tailwind CSS 4
- TanStack Query
- Zustand
- Next route-handler fake API

## Local Development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## API Mode

The frontend can switch between the built-in fake API and a live backend through environment variables:

```bash
NEXT_PUBLIC_API_MODE=fake
NEXT_PUBLIC_PAYMENT_SOCKET_URL=
NEXT_PUBLIC_NOTIFICATION_SOCKET_URL=
SESSION_COOKIE_SECRET=replace-with-at-least-32-random-characters
LIVE_API_BASE_URL=https://live-backend.example.com/api
LIVE_API_TIMEOUT_MS=15000
```

Use `NEXT_PUBLIC_API_MODE=fake` for the local route-handler API. Use `NEXT_PUBLIC_API_MODE=live` to route client calls through `/api/live/*`, which proxies to `LIVE_API_BASE_URL` on the server.
Set `NEXT_PUBLIC_PAYMENT_SOCKET_URL` to the backend Socket.IO origin when live payment status events are available. Leave it empty in fake mode to use the local payment-status simulator.
Set `NEXT_PUBLIC_NOTIFICATION_SOCKET_URL` to the same backend Socket.IO origin for live notifications, request updates, customer status changes, and package updates. If omitted, the frontend falls back to `NEXT_PUBLIC_PAYMENT_SOCKET_URL`.
Set `SESSION_COOKIE_SECRET` to a high-entropy server-only secret before running outside local development. Production login responses set the signed JWT session as an HTTP-only `__Host-mtn_bds_session` cookie instead of returning a bearer token to client JavaScript.
Restart the dev server after changing `NEXT_PUBLIC_API_MODE`.

## API Contract

The backend handoff contract is maintained in `docs/openapi.yaml`, with copyable endpoint samples in `docs/api-samples.md`. Any frontend change that adds, removes, renames, or reshapes an API request/response must update those documents in the same change.

## Implemented Areas

- Operational dashboard for bulk data wholesale metrics
- Customer and bundle workspace
- Simulated bundle purchase workflow
- MFA service configuration
- User notification and workspace preferences
- WebAuthn/passkey device registration and management backed by fake API routes
- Audit event feed
