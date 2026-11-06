// Single import seam to stream A. Owned by stream B.
// Integrated: the engine and planning agent (CONTRACT v2) replace the stub that ran before A merged.
export { planCandidates } from "@/lib/engine";
export { runPlanningAgent } from "@/lib/engine/agent";
export { loadActivities, loadBusy, loadForecast, resolveActivity } from "@/lib/engine/data";
