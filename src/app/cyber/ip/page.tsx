import { SurfaceView } from "@/components/cyber/surface-view";

export const metadata = { title: "IP Security" };

export default function CyberIpPage() {
  return (
    <SurfaceView
      view="ip"
      title="IP Security"
      groupLabel="IP address"
      subtitle="Source addresses grouped by the security events they generated. IPs are taken from the request's proxy headers, never from anything the client can set in a body."
    />
  );
}
