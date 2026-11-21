import { PublicHeader } from "@/components/public-header";

export default function CredentialsLayout({ children }: LayoutProps<"/credentials">) {
  return (
    <div className="min-h-screen">
      <PublicHeader />
      {children}
    </div>
  );
}
