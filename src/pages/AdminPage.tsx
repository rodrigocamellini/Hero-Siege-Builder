import { StandardPage } from '../components/StandardPage';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Shield, SlidersHorizontal, Users } from 'lucide-react';
import { AdminSidebarLink } from '../features/admin/AdminSidebarLink';
import { AdminSettingsPanel } from '../features/admin/AdminSettingsPanel';
import { UsersTable } from '../features/admin/UsersTable';
import { useAuth } from '../features/auth/AuthProvider';

export function AdminPage() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const adminEmail = String(import.meta.env.VITE_ADMIN_EMAIL ?? '').trim().toLowerCase();

  const isAdmin = !!adminEmail && !!user?.email && user.email.trim().toLowerCase() === adminEmail;

  if (loading) {
    return (
      <StandardPage>
        <div className="max-w-7xl mx-auto px-4 py-8 md:py-16">
          <h1 className="font-heading font-bold text-3xl md:text-4xl uppercase tracking-tight text-brand-darker">Admin</h1>
          <p className="mt-2 text-sm text-brand-darker/60">Carregando...</p>
        </div>
      </StandardPage>
    );
  }

  if (!loading && !adminEmail) {
    return (
      <StandardPage>
        <div className="max-w-7xl mx-auto px-4 py-8 md:py-16">
          <h1 className="font-heading font-bold text-3xl md:text-4xl uppercase tracking-tight text-brand-darker">Admin</h1>
          <p className="mt-2 text-sm text-brand-darker/60">Admin não configurado. Defina VITE_ADMIN_EMAIL no deploy e faça rebuild.</p>
        </div>
      </StandardPage>
    );
  }

  if (!isAdmin) {
    const callbackUrl = `${location.pathname}${location.search}`;
    return <Navigate to={`/admin/login?callbackUrl=${encodeURIComponent(callbackUrl)}`} replace />;
  }

  return (
    <StandardPage>
      <div className="max-w-7xl mx-auto px-4 py-8 md:py-16">
        <div className="flex flex-col lg:flex-row gap-6">
          <aside className="w-full lg:w-72">
            <div className="bg-white border border-brand-dark/10 rounded-2xl overflow-hidden">
              <div className="p-5 border-b border-brand-dark/10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-brand-orange/10 text-brand-orange flex items-center justify-center">
                    <Shield className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-heading font-bold uppercase tracking-tight text-brand-darker">Admin Panel</div>
                    <div className="text-xs text-brand-darker/60 truncate">{user?.email ?? '-'}</div>
                  </div>
                </div>
              </div>
              <nav className="py-2">
                <AdminSidebarLink href="/admin/users" label="Users" icon={<Users className="w-5 h-5" />} />
                <AdminSidebarLink href="/admin/settings" label="Settings" icon={<SlidersHorizontal className="w-5 h-5" />} />
              </nav>
            </div>
          </aside>

          <section className="flex-1 min-w-0">
            <Routes>
              <Route index element={<Navigate to="/admin/users" replace />} />
              <Route path="users" element={<UsersTable />} />
              <Route path="settings" element={<AdminSettingsPanel />} />
              <Route path="*" element={<Navigate to="/admin/users" replace />} />
            </Routes>
          </section>
        </div>
      </div>
    </StandardPage>
  );
}
