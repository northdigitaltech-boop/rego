import { SurfaceView } from "@/components/cyber/surface-view";

export const metadata = { title: "Owner Risk" };

export default function CyberOwnerRiskPage() {
  return (
    <SurfaceView
      view="owner"
      title="Owner Risk"
      groupLabel="Business owner"
      subtitle="Security events attributed to business-owner accounts. A high count is a prompt to look, not a verdict — investigate before acting on any account."
    />
  );
}
