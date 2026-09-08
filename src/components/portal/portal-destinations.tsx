"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";

import { DestinationsAdmin } from "@/components/dashboard/admin-dashboard";
import { getDestinationRows, type DestinationRow } from "@/lib/destinations";

/* ============================================================
 * Destination pages, in the portal.
 *
 * WHY THIS FILE EXISTS AT ALL
 *   phase110 created manage_destinations_pages and a policy on the
 *   destinations table, and the Roles screen offered it — but
 *   PORTAL_MODULES had no entry for it, so ticking it granted a
 *   permission that opened nothing. A permission with no screen is
 *   worse than a missing permission: it looks like access has been
 *   given.
 *
 * WHY A WRAPPER AND NOT A COPY
 *   DestinationsAdmin holds the whole screen already. It takes its
 *   rows as a prop because the admin dashboard loads them once for
 *   several tabs; here nothing else needs them, so this loads them
 *   and hands them over. Same component, same table, same policy —
 *   a second implementation would be a second set of bugs.
 * ============================================================ */

export function PortalDestinations() {
  const [rows, setRows] = React.useState<DestinationRow[] | null>(null);

  const load = React.useCallback(async () => {
    setRows(await getDestinationRows());
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  if (rows === null) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return <DestinationsAdmin rows={rows} onChange={load} />;
}
