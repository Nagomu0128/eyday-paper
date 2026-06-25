# Google "Sign in with Google" — one-time manual bootstrap

The OAuth client + consent screen cannot be created by Terraform (no provider
resource exists; design doc §インフラ管理). Create them once by hand, then store
the credentials as Worker secrets. Better Auth only **consumes** this client.

## Steps

1. Google Auth Platform console → **APIs & Services → Credentials**.
2. Configure the **OAuth consent screen** (External; app name `eyday-paper`;
   scopes `openid`, `email`, `profile`; add yourself as a test user).
3. **Create OAuth client ID** → type **Web application**.
4. **Authorized redirect URI** (exactly):
   ```
   https://eyday-paper.yoshidakazuya.com/api/auth/callback/google
   ```
   For local dev also add: `http://localhost:5173/api/auth/callback/google`.
5. Copy the issued **Client ID** and **Client secret**.
6. Store them as Worker secrets (never commit):
   ```sh
   wrangler secret put GOOGLE_CLIENT_ID
   wrangler secret put GOOGLE_CLIENT_SECRET
   wrangler secret put BETTER_AUTH_SECRET   # openssl rand -base64 32
   wrangler secret put BETTER_AUTH_URL      # https://eyday-paper.yoshidakazuya.com
   ```

## Local development

Use `.dev.vars` (gitignored; copy from `.dev.vars.example`). The committed values
are **mocks** — sign-in will redirect to Google and fail until a real client is
configured with the localhost redirect URI above.
