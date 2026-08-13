# LangApp Admin

A standalone web service for the LangApp administrator console.

## Run locally

```bash
npm install
npm run dev -- --host 0.0.0.0
```

## Boundary

This console is a frontend service only. Before enabling a control against live data, implement its corresponding authenticated admin API endpoint, role/permission check, audit event, validation, pagination, and moderation safeguards in `../api`.
