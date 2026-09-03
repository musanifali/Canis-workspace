// YOUR components. This is the whole integration surface: a component per
// block type, receiving the block from the spec plus its resolved data state.
//
// Nothing here imports our UI package — these are your design system's
// components, so a generated workspace looks like the rest of your product.
import type { BlockComponentProps } from "@ticora/react";
import type { Issue } from "./contract";

/** Your table. `data` is the rows the block's query returned. */
export function IssueTable({ block, data, status }: BlockComponentProps) {
  const rows = (data as Issue[] | undefined) ?? [];
  const title = (block.config as { title?: string }).title ?? "Issues";

  // The renderer shows a skeleton while loading and a broken-block on error,
  // so by here you can assume real data — but the state is yours if you want it.
  if (status === "loading") return <YourSkeleton label={title} />;

  return (
    <section className="your-card">
      <h3 className="your-card__title">{title}</h3>
      <table className="your-table">
        <thead>
          <tr>
            <th>Issue</th>
            <th>Assignee</th>
            <th>Points</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((issue) => (
            <tr key={issue.id}>
              <td>
                <YourBadge state={issue.state} /> {issue.title}
              </td>
              <td>{issue.assignee}</td>
              <td>{issue.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

/** Your board. A "groups" binding gives you `{ key, rows }` buckets. */
export function IssueBoard({ block, data }: BlockComponentProps) {
  const groups = (data as { group: string; rows: Issue[] }[] | undefined) ?? [];
  const title = (block.config as { title?: string }).title ?? "Board";

  return (
    <section className="your-card">
      <h3 className="your-card__title">{title}</h3>
      <div className="your-board">
        {groups.map((group) => (
          <div className="your-board__column" key={group.group}>
            <h4>
              {group.group} <span className="your-count">{group.rows.length}</span>
            </h4>
            {group.rows.map((issue) => (
              <article className="your-board__card" key={issue.id}>
                {issue.title}
              </article>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

// Your own primitives — the point is that these are already in your app.
function YourBadge({ state }: { state: Issue["state"] }) {
  return <span className={`your-badge your-badge--${state}`}>{state}</span>;
}

function YourSkeleton({ label }: { label: string }) {
  return <div className="your-skeleton" aria-label={`Loading ${label}`} />;
}
