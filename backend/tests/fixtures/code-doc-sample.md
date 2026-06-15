# Authentication

Use the following token flow.

```js
const token = generateToken();
const response = await fetch("/api/me", {
    headers: { Authorization: `Bearer ${token}` },
});
```

## API

GET /api/me

| Method | Path | Description |
| --- | --- | --- |
| GET | /api/me | Returns the current user |

- Include the bearer token in the Authorization header.
