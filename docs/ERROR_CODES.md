# API errors and security contract

Every failed REST request has the same envelope:

```json
{ "statusCode": 400, "code": "VALIDATION_FAILED", "message": "…", "timestamp": "…", "path": "/api/…" }
```

| HTTP | Code | Meaning | Client action |
| --- | --- | --- | --- |
| 400 | `VALIDATION_FAILED` | A request body is missing, malformed, too long, or contains an unapproved field. | Correct the input; do not retry unchanged. |
| 400 | `INSUFFICIENT_POINTS` | The account cannot pay for a hint. | Earn score before retrying. |
| 401 | `AUTH_FORBIDDEN` | Authentication is required or account access is unavailable. | Sign in again. |
| 401 | `AUTH_INVALID_CREDENTIALS` | Email/password verification failed. | Do not disclose which value failed. |
| 401 | `AUTH_TOKEN_EXPIRED` / `AUTH_TOKEN_INVALID` | Access token is unusable. | Clear local session and sign in again. |
| 404 | `CHALLENGE_NOT_FOUND` / `HINT_NOT_FOUND` / `LAB_NOT_RUNNING` | Requested resource is absent or unavailable. | Refresh visible state. |
| 409 | `AUTH_ACCOUNT_EXISTS` / `HINT_ALREADY_UNLOCKED` | Request conflicts with existing state. | Refresh visible state. |
| 429 | `RATE_LIMITED` | A login, registration, flag, or AI limit was reached. | Back off before retrying. |
| 5xx | `HTTP_5xx` | Unhandled server failure. | Do not expose diagnostics to users; record correlation context server-side. |

The gateway rejects invalid Socket.IO tokens by disconnecting before emitting
`session.ready`. Socket events never carry flags, flag hashes, tokens, password
hashes, or another user's private lab state.
