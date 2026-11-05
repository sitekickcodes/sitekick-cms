"Continue with Google" on the sign-in screen, next to email and password, which keep working.

```ts
import { googleSignIn, sitekickCMS } from '@sitekick/cms'

plugins: [sitekickCMS({ site }), googleSignIn()]
```

## Set up the Google client

1. In Google Cloud, create an OAuth client of type **Web application**.
2. Add the redirect URI `https://<your site>/api/users/google/callback`, and
   `http://localhost:3000/api/users/google/callback` for development.
3. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.

Until both are set, the button is hidden and the sign-in endpoints answer 404, so the recipe
can ship before the client exists.

## Who gets in

Someone whose verified Google address matches an existing account. Invites are still how
people are added.

To let a client's whole Google Workspace in without inviting each person:

```ts
googleSignIn({ domains: ['acme.com'] })            // new people become editors
googleSignIn({ domains: ['acme.com'], role: 'admin' })
```

Their account is created on first sign-in. It takes an address at that domain that Google
has verified. A personal Gmail account can't claim the domain, even one that says it belongs to
the Workspace.

If sign-in fails, the person returns to the sign-in screen with a plain reason: there's no
account for that address, they cancelled, or the attempt expired.

## How it works

The standard OpenID Connect code flow. A short-lived, signed cookie carries the state and a
nonce; the code is exchanged with Google server to server, and the ID token's issuer,
audience, expiry, nonce and verified email are all checked. The session is Payload's own:
the same cookie and session record a password sign-in creates, so sign-out, session expiry
and "last signed in" all behave the same.
