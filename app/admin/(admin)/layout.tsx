import { requireAdmin } from '@/lib/admin-auth';
import { AdminSidebar } from '@/components/admin/admin-sidebar';

export const metadata = {
  title: 'RedFox Admin Portal',
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();

  return (
    <div className="flex min-h-screen bg-[#0a0a0a]">
      <AdminSidebar role={admin.role} name={admin.name} email={admin.email} />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
