import { PublicHeader } from "@/components/public-header";

export default function PublicEventsLayout({ children }: LayoutProps<"/events">) {
  return (
    <div className="min-h-screen">
      <PublicHeader />
      {children}
    </div>
  );
}
