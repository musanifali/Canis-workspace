/**
 * Contract registry UI (#31): what each entity exposes, straight from
 * GET /v1/contracts. Server component — reads with the server-held key.
 */
import { createWorkspaceServiceClient } from "@workspace-engine/client";

export const dynamic = "force-dynamic";

interface Capabilities {
  filterable?: string[];
  sortable?: string[];
  groupable?: string[];
  aggregations?: Record<string, string[]>;
}

export default async function ContractsPage(): Promise<React.ReactElement> {
  const apiKey = process.env.WORKSPACE_API_KEY;
  if (!apiKey) {
    return (
      <div className="notice error">
        <p>
          <code>WORKSPACE_API_KEY</code> is not set. Provision the internal
          tenant with <code>node scripts/seed-dashboard-tenant.mjs</code> and
          fill <code>.env.local</code>.
        </p>
      </div>
    );
  }
  const client = createWorkspaceServiceClient({
    baseUrl: process.env.WORKSPACE_API_URL ?? "http://localhost:8270",
    apiKey,
    userId: process.env.WORKSPACE_DASHBOARD_USER ?? "canis_ops",
  });

  let contracts;
  try {
    contracts = await client.listContracts();
  } catch (error) {
    return (
      <div className="notice error">
        <p>
          Could not reach the Workspace Service:{" "}
          {error instanceof Error ? error.message : String(error)}
        </p>
      </div>
    );
  }

  if (contracts.length === 0) {
    return (
      <div className="notice">
        <p>
          No contracts registered yet — run{" "}
          <code>npm run seed -w @workspace-engine/dashboard</code>.
        </p>
      </div>
    );
  }

  return (
    <table className="contracts-table">
      <thead>
        <tr>
          <th>Entity</th>
          <th>Fields</th>
          <th>Capabilities</th>
          <th>Updated</th>
        </tr>
      </thead>
      <tbody>
        {contracts.map((contract) => {
          const definition = contract.definition as {
            fields?: Record<string, unknown>;
            capabilities?: Capabilities;
          };
          const fields = Object.entries(definition.fields ?? {});
          const caps = definition.capabilities ?? {};
          return (
            <tr key={contract.entityName}>
              <td>
                <strong>{contract.entityName}</strong>
                <details className="def">
                  <summary>definition</summary>
                  <pre>{JSON.stringify(contract.definition, null, 2)}</pre>
                </details>
              </td>
              <td>
                {fields.map(([name, kind]) => (
                  <span className="pill" key={name}>
                    {name}: {String(kind)}
                  </span>
                ))}
              </td>
              <td>
                <span className="pill">
                  filter: {(caps.filterable ?? []).length}
                </span>
                <span className="pill">sort: {(caps.sortable ?? []).length}</span>
                <span className="pill">
                  group: {(caps.groupable ?? []).length}
                </span>
                <span className="pill">
                  agg: {Object.keys(caps.aggregations ?? {}).length}
                </span>
              </td>
              <td>{new Date(contract.updatedAt).toLocaleString()}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
