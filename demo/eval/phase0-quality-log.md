# Phase 0 quality log — COMPLETE baseline, 2026-07-06

Model: deepseek-v4-flash via DeepSeek API (openai-compatible provider)
Run cost: ~$0.10. Duration: ~12 min (5s pacing, zero throttles, zero errors).

## Score: 18 valid / 1 partial / 1 wrong (90% valid, 95% usable)

- **Valid (18)** — correct component with coherent props (right filters, sorting, groupBy; spot-checked in phase0-quality-log.json).
- **Partial (1)** — #17 "Who are our analysts…": called listAnalysts correctly and answered with an accurate markdown **table in text** instead of rendering a component. Right information, wrong medium.
- **Wrong (1)** — #14 "Give me an overview of our current case load": called aggregateCases but produced an empty final message — no component, no text. The one true failure.

## Go/no-go recommendation: **GO**

Phase 0's exit criterion was "if composition quality is unusable, fix descriptions/prompting BEFORE building the platform." 90% correct component selection with coherent props on a mid-tier budget model ($0.14/M tokens), through the real Tambo pipeline, is comfortably usable. The two misses are both "fell back to text/nothing" — exactly the failure class the Phase 1 validator (BUILD/CLARIFY/REJECT) is designed to catch and retry, which strengthens rather than weakens the case for proceeding to the spec/validator architecture.

Failure taxonomy carried into Phase 3 evals: text-instead-of-component fallback; empty-response; (from earlier free-tier runs) tool-call-as-text emission, wrong-date guessing without userTime, empty-array filter semantics, thought_signature round-trip loss on thinking models.

| # | Prompt | Expected | Got | Tools | Match |
|---|--------|----------|-----|-------|-------|
| 1 | Show high-risk cases due this month, grouped by analyst | GroupedBoard | GroupedBoard | searchCases | ✓ |
| 2 | List all critical fraud cases | CasesTable | CasesTable | searchCases | ✓ |
| 3 | How many cases are overdue right now? | KpiCards | KpiCards | searchCases | ✓ |
| 4 | What should I work on today? | CaseQueue | CaseQueue | searchCases | ✓ |
| 5 | Show the number of cases per analyst as a bar chart | Graph | Graph | aggregateCases | ✓ |
| 6 | Break down our total dollar exposure by category | Graph / KpiCards | Graph | aggregateCases | ✓ |
| 7 | Show me Amara Okafor's open cases | CasesTable | CasesTable | searchCases | ✓ |
| 8 | Give me a filterable view of escalated cases | FilterBar / CasesTable | CasesTable | searchCases | ✓ |
| 9 | Which analyst has the biggest open workload? | KpiCards / Graph / CasesTable | Graph | listAnalysts, aggregateCases | ✓ |
| 10 | Show sanctions cases sorted by exposure, largest first | CasesTable | CasesTable | searchCases | ✓ |
| 11 | Kanban view of open and escalated cases by status | GroupedBoard | GroupedBoard | searchCases | ✓ |
| 12 | Average risk score by category | Graph / KpiCards | Graph | aggregateCases | ✓ |
| 13 | Top 5 most urgent cases I should triage | CaseQueue / CasesTable | CaseQueue | searchCases | ✓ |
| 14 | Give me an overview of our current case load | KpiCards / Graph | (none) | aggregateCases | ✗ |
| 15 | Show KYC cases due in the next 7 days | CasesTable | CasesTable | searchCases | ✓ |
| 16 | How are chargeback cases distributed across statuses? | Graph / GroupedBoard | Graph | aggregateCases | ✓ |
| 17 | Who are our analysts and what does each specialize in? | CasesTable / KpiCards | (none) | listAnalysts | ✗ |
| 18 | Show low risk cases that are already resolved | CasesTable | CasesTable | searchCases | ✓ |
| 19 | Build a triage queue of critical cases ordered by due date | CaseQueue | CaseQueue | searchCases | ✓ |
| 20 | Pie chart of cases by risk level | Graph | Graph | aggregateCases | ✓ |

Manual notes: review propsPreview in the JSON for coherence (right filters, sorting, groupBy).
