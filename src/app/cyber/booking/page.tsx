import { SurfaceView } from "@/components/cyber/surface-view";

export const metadata = { title: "Booking Security" };

export default function CyberBookingPage() {
  return (
    <SurfaceView
      view="booking"
      title="Booking Security"
      groupLabel="Endpoint"
      subtitle="Read-only monitoring of booking-related security events. This page observes the booking flow; it cannot alter, cancel or approve a booking."
    />
  );
}
