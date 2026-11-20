import { PublicHeader } from "@/components/public-header";

export default function PublicSpeakersLayout({ children }: LayoutProps<"/speakers">) {
  return (
    <div className="min-h-screen">
      <PublicHeader />
      {children}
    </div>
  );
}
