import { Suspense } from "react";
import { AdminTabs } from "@/components/admin/admin-controls";
import { Skeleton } from "@/components/ui";
import { requireAdmin } from "@/lib/dal";

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <Suspense fallback={<Skeleton rows={4} />}>
      <Gate>{children}</Gate>
    </Suspense>
  );
}

async function Gate({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <>
      <header className="mb-8">
        <p className="text-sm font-medium text-brand-600">Platform admin</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">Admin</h1>
        <div className="mt-6">
          <Suspense fallback={<div className="h-8 border-b border-line" />}>
            <AdminTabs />
          </Suspense>
        </div>
      </header>
      {children}
    </>
  );
}
