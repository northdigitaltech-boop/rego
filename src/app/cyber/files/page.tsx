import { SurfaceView } from "@/components/cyber/surface-view";

export const metadata = { title: "File Security" };

export default function CyberFilesPage() {
  return (
    <SurfaceView
      view="files"
      title="File Security"
      groupLabel="Upload route"
      subtitle="Rejected and suspicious uploads. Media itself is stored on Cloudinary; this page tracks what the application refused, not what it accepted."
    />
  );
}
