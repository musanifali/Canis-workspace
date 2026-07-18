/**
 * Render one saved analytics view. The whole read path is the public SDK:
 * store.get() loads the validated spec from the Phase 4 service, and
 * WorkspaceRenderer + defaultBlocks turn it into the live screen (#31/#53).
 */
import { WorkspaceView } from "@/components/workspace-view";

export default async function ViewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.ReactElement> {
  const { id } = await params;
  return <WorkspaceView id={id} />;
}
