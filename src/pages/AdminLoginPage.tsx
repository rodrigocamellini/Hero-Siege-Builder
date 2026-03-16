import { StandardPage } from '../components/StandardPage';
import { AdminLoginForm } from '../features/auth/AdminLoginForm';

export function AdminLoginPage() {
  return (
    <StandardPage title="Admin Login | Hero Siege Builder" description="Admin sign in." canonicalPath="/admin/login" noindex>
      <div className="max-w-7xl mx-auto px-4 py-8 md:py-16 flex items-center justify-center">
        <AdminLoginForm redirectTo="/admin" storageKey="hsb_admin_login" />
      </div>
    </StandardPage>
  );
}
