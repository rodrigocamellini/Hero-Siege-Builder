import { StandardPage } from '../components/StandardPage';
import { LoginForm } from '../features/auth/LoginForm';

export function LoginPage() {
  return (
    <StandardPage title="Login | Hero Siege Builder" description="Sign in to your account." canonicalPath="/login" noindex>
      <div className="max-w-7xl mx-auto px-4 py-8 md:py-16 flex items-center justify-center">
        <LoginForm />
      </div>
    </StandardPage>
  );
}
