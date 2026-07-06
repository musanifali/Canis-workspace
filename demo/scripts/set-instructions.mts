/**
 * Sets the demo project's customInstructions (system-prompt addendum).
 * Same env contract as seed-tambo-project.mts. Pass the instructions text
 * as the first argument, or run with none to apply the default below.
 */
import {
  closeDb,
  getDb,
  operations,
} from "../../tambo/packages/db/src/index";

const PROJECT_ID = "p_tRC6ocZc.8737be";
const DEFAULT_INSTRUCTIONS =
  "This is a case-management workspace assistant. When the user asks to see, list, group, count, chart, triage, or filter cases or analysts, ALWAYS render the single most appropriate registered UI component (CasesTable, KpiCards, CaseQueue, FilterBar, GroupedBoard, or Graph) with props filled from tool results — never answer with text alone when a component fits. Fetch data with the provided tools before rendering. Keep any accompanying text to one short sentence.";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL must be set (source tambo/docker.env)");
}

const db = getDb(databaseUrl);
await operations.updateProject(db, PROJECT_ID, {
  customInstructions: process.argv[2] ?? DEFAULT_INSTRUCTIONS,
});
console.log(`customInstructions set on ${PROJECT_ID}`);
await closeDb();
