# webhook-dispatcher

Outbound webhook delivery service with automatic retries, exponential backoff, and HMAC signature verification.

## Architecture

- **Express** HTTP server with Helmet and CORS
- **Redis** for subscription storage, retry queue (sorted set), and delivery status tracking
- **undici** for fast, low-overhead HTTP delivery
- **HMAC-SHA256** signatures on every outgoing payload

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/subscriptions` | Register a webhook endpoint |
| GET | `/api/v1/subscriptions/:id` | Get subscription details |
| DELETE | `/api/v1/subscriptions/:id` | Remove a subscription |
| POST | `/api/v1/dispatch` | Dispatch an event to all subscribers |
| GET | `/health` | Liveness check |

## Setup

```bash
cp .env.example .env
npm install
npm run build
npm start
```

## Delivery flow

1. Client dispatches an event via `POST /api/v1/dispatch`
2. All active subscriptions for that event type are looked up
3. Each delivery is enqueued in a Redis sorted set keyed by next-retry timestamp
4. The retry poller picks up due entries and attempts delivery
5. Successful deliveries are recorded; failures are re-enqueued with exponential backoff + jitter
6. After `MAX_RETRIES` failures, the webhook is marked permanently failed

## Signature format

Every outgoing request includes an `X-Webhook-Signature` header:

```
t=1700000000,v1=<hex sha256 of "{timestamp}.{payload}" using HMAC_SECRET>
```

Receivers should verify the signature and check the timestamp is within a reasonable window to prevent replay attacks.

## License

MIT
