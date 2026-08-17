# GENKŌ Creator / CMS

This package is an internal development tool. **It is excluded from the public MVP deployment.** Public browser administration uses the cookie-authenticated `/admin` area in `web/`.

The standalone creator currently keeps a bearer session in browser local storage. Do not deploy it on a public origin. It remains in CI while server-backed draft, review, publish, and audit workflows are completed or the package is retired.

For local use, set `VITE_API_URL`, bind only to `127.0.0.1`, sign in with a disposable trusted administrator account, and clear site data after use. The API remains the authority for every content write.
