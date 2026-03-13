import { StandardPage } from '../components/StandardPage';
import { AdminLoginForm } from '../features/auth/AdminLoginForm';

export function AdminLoginPage() {
  return (
    <StandardPage>
      <div className="max-w-7xl mx-auto px-4 py-8 md:py-16 flex items-center justify-center">
        <AdminLoginForm redirectTo="/admin" storageKey="hsb_admin_login" />
      </div>
    </StandardPage>
  );
}
