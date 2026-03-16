import { StandardPage } from '../components/StandardPage';
import { RegisterForm } from '../features/auth/RegisterForm';

export function RegisterPage() {
  return (
    <StandardPage title="Register | Hero Siege Builder" description="Create a new account." canonicalPath="/register" noindex>
      <div className="max-w-7xl mx-auto px-4 py-8 md:py-16 flex items-center justify-center">
        <RegisterForm />
      </div>
    </StandardPage>
  );
}
