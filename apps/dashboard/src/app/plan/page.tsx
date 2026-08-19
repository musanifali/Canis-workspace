/**
 * Plan & usage (#94): the tenant's current plan and generations used vs cap,
 * with an upgrade CTA (a contact link at launch — no self-serve payment yet).
 */
import { redirect } from "next/navigation";
import type { ReactElement } from "react";
import { getSession } from "@/lib/session";
import { getAllowance } from "@/lib/plan";

export const dynamic = "force-dynamic";
export const metadata = { title: "Plan & usage — Canis" };

const PLAN_LABEL = { free: "Free", pro: "Pro", internal: "Internal" } as const;
const UPGRADE_EMAIL = "hello@canis.dev"; // contact-to-upgrade at launch

export default async function PlanPage(): Promise<ReactElement> {
  const session = await getSession();
  if (!session) redirect("/login");

  const allowance = await getAllowance();
  if (!allowance) {
    return (
      <div className="notice error">
        <p>Couldn’t load plan/usage — is the service reachable?</p>
      </div>
    );
  }

  const { plan, monthlyCap, usedThisMonth } = allowance;
  const unlimited = monthlyCap === null;
  const pct = unlimited ? 0 : Math.min(100, Math.round((usedThisMonth / monthlyCap) * 100));

  return (
    <section className="plan">
      <h1>Plan &amp; usage</h1>

      <div className="plan-card">
        <div className="plan-badge">{PLAN_LABEL[plan]}</div>
        <div className="plan-usage">
          <p>
            <strong>{usedThisMonth}</strong>{" "}
            {unlimited ? "generations this month" : `of ${monthlyCap} generations this month`}
          </p>
          {unlimited ? (
            <p className="plan-unlimited">Unlimited on this plan.</p>
          ) : (
            <div className="plan-meter" aria-label={`${pct}% of monthly cap used`}>
              <div className="plan-meter-fill" style={{ width: `${pct}%` }} />
            </div>
          )}
          {!unlimited && !allowance.allowed ? (
            <p className="signup-error">
              You’ve hit this month’s cap — generations return a 429 until it
              resets or you upgrade.
            </p>
          ) : null}
        </div>
      </div>

      {plan !== "internal" ? (
        <p className="plan-upgrade">
          Need more headroom?{" "}
          <a href={`mailto:${UPGRADE_EMAIL}?subject=Upgrade%20to%20Pro`}>
            Contact us to upgrade
          </a>{" "}
          — see the <a href="https://docs.canis.dev/reference/plans">plans &amp; limits</a>.
        </p>
      ) : null}
    </section>
  );
}
