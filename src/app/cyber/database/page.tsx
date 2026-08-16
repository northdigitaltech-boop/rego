import { SurfaceView } from "@/components/cyber/surface-view";

export const metadata = { title: "Database Security" };

export default function CyberDatabasePage() {
  return (
    <SurfaceView
      view="database"
      title="Database Security"
      groupLabel="Source"
      subtitle="Database-category security events recorded by the application. No SQL console is exposed here, by design — this portal can read evidence but never execute queries."
    />
  );
}
