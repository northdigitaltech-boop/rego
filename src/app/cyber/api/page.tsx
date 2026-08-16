import { SurfaceView } from "@/components/cyber/surface-view";

export const metadata = { title: "API Security" };

export default function CyberApiPage() {
  return (
    <SurfaceView
      view="api"
      title="API Security"
      groupLabel="Endpoint"
      subtitle="Denied and abusive requests grouped by route — rate-limit trips, authorisation refusals and API-category events. This shows blocks, not total traffic."
    />
  );
}
