# Plans & limits

Every tenant is on a plan. The plan sets the caps below; the hosted service
enforces the **generations / month** cap through its usage ledger and returns a
machine-readable `429 budget_exceeded` when you hit it (your dashboard shows
how close you are). Reads are always free — opening a saved workspace never
costs a generation.

<!-- plans:table:start -->
| Plan | Generations / month | Workspaces | Telemetry retention |
|---|---|---|---|
| Free | 25 | 3 | 7 days |
| Pro | 2000 | 100 | 90 days |
| Internal | Unlimited | Unlimited | Unlimited |
<!-- plans:table:end -->

New sign-ups start on **Free**. **Pro** is granted manually to design partners
during launch — there's no self-serve payment yet. To upgrade, get in touch and
we'll move you over; the change takes effect immediately, no redeploy.

> These numbers are generated from the same config the service enforces
> (`PLAN_CAPS` in `@workspace-engine/core`) and checked in CI, so this page can
> never drift from the real caps.
