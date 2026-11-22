export function trendFailureCategory(code: string): string {
  switch (code) {
    case "PGRST205":
    case "42P01": return "trend-table-missing";
    case "PGRST202":
    case "42883": return "trend-rpc-missing-or-stale-cache";
    case "42501":
    case "PGRST301": return "permission-denied-or-expired-session";
    default: return "database-or-network-error";
  }
}
