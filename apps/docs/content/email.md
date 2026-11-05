Account email (invites and password resets) goes through [AutoSend](https://autosend.com).

```sh
AUTOSEND_API_KEY=...
EMAIL_FROM="Acme <hello@acme.com>"
```

`EMAIL_FROM` must be on a domain verified in AutoSend. A bare address (`hello@acme.com`) is
sent under the site's name.

**Until both are set, nothing is emailed, and nothing pretends to be.** Inviting someone
shows the admin their set-password link to pass on themselves, and "Send reset email" is
hidden. The message goes to the server log instead: in full in development, and only who it
was for in production, so reset links stay out of hosted logs.

A site that wants another provider sets Payload's `email` adapter in `buildConfig`, and
Sitekick leaves it alone. `email: false` in `sitekickCMS()` keeps Payload's default.
