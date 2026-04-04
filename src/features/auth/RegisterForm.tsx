'use client';

import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { FirebaseError } from 'firebase/app';
import { createUserWithEmailAndPassword, setPersistence, browserLocalPersistence, browserSessionPersistence, updateProfile } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { firebaseAuth, firestore } from '../../firebase';
import { useLanguage } from '../../i18n/LanguageProvider';

const DEFAULT_AVATAR_URL = '/images/avatar.webp';

function isValidEmail(v: string) {
  const s = v.trim().toLowerCase();
  if (!s) return false;
  if (s.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function authErrorMessage(err: unknown, lang: 'en' | 'pt' | 'ru') {
  const code = err instanceof FirebaseError ? err.code : typeof (err as any)?.code === 'string' ? String((err as any).code) : '';
  const isEn = lang === 'en';
  const isRu = lang === 'ru';
  if (code === 'auth/email-already-in-use') return isEn ? 'This email is already in use.' : isRu ? 'Этот email уже используется.' : 'Esse email já está em uso.';
  if (code === 'auth/invalid-email') return isEn ? 'Invalid email.' : isRu ? 'Неверный email.' : 'Email inválido.';
  if (code === 'auth/weak-password') return isEn ? 'Weak password. Use at least 8 characters.' : isRu ? 'Слабый пароль. Используйте минимум 8 символов.' : 'Senha fraca. Use pelo menos 8 caracteres.';
  if (code === 'auth/operation-not-allowed') return isEn ? 'Email/password sign-in is disabled in Firebase.' : isRu ? 'Вход по email/паролю отключен в Firebase.' : 'Login por email/senha está desativado no Firebase.';
  if (code === 'auth/unauthorized-domain') return isEn ? 'Unauthorized domain in Firebase Auth.' : isRu ? 'Домен не авторизован в Firebase Auth.' : 'Domínio não autorizado no Firebase Auth.';
  if (code === 'auth/network-request-failed') return isEn ? 'Network error. Please try again.' : isRu ? 'Ошибка сети. Попробуйте снова.' : 'Falha de conexão. Tente novamente.';
  if (code === 'auth/invalid-api-key' || code === 'auth/api-key-not-valid') return isEn ? 'Invalid or blocked Firebase API key.' : isRu ? 'Неверный или заблокированный API key Firebase.' : 'API key do Firebase inválida ou bloqueada.';
  return code ? (isEn ? `Error: ${code}` : isRu ? `Ошибка: ${code}` : `Erro: ${code}`) : isEn ? 'Failed to create account. Please try again.' : isRu ? 'Не удалось создать аккаунт. Попробуйте снова.' : 'Erro ao criar conta. Tente novamente.';
}

export function RegisterForm() {
  const { lang } = useLanguage();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState('');
  const [realName, setRealName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [registrationEnabled, setRegistrationEnabled] = useState(true);
  const [registrationLoading, setRegistrationLoading] = useState(true);

  const callbackUrl = useMemo(() => {
    const raw = searchParams.get('callbackUrl');
    return raw && raw.startsWith('/') ? raw : '/';
  }, [searchParams]);

  useEffect(() => {
    const load = async () => {
      setRegistrationLoading(true);
      try {
        const snap = await getDoc(doc(firestore, 'appSettings', 'public'));
        const data = snap.exists() ? (snap.data() as { registrationEnabled?: unknown }) : null;
        setRegistrationEnabled(data?.registrationEnabled !== false);
      } finally {
        setRegistrationLoading(false);
      }
    };
    void load();
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!registrationEnabled) {
      setError(lang === 'en' ? 'Registration is currently disabled.' : lang === 'ru' ? 'Регистрация сейчас отключена.' : 'Cadastro está desativado no momento.');
      return;
    }

    const emailNorm = email.trim().toLowerCase();
    const displayName = realName.trim();
    if (!isValidEmail(emailNorm)) {
      setError(lang === 'en' ? 'Invalid email.' : lang === 'ru' ? 'Неверный email.' : 'Email inválido.');
      return;
    }
    if (!displayName) {
      setError(lang === 'en' ? 'Real name is required.' : lang === 'ru' ? 'Настоящее имя обязательно.' : 'Nome é obrigatório.');
      return;
    }
    if (!password) {
      setError(lang === 'en' ? 'Password is required.' : lang === 'ru' ? 'Пароль обязателен.' : 'Senha é obrigatória.');
      return;
    }
    if (password.length < 8) {
      setError(lang === 'en' ? 'Password must be at least 8 characters.' : lang === 'ru' ? 'Пароль должен быть минимум 8 символов.' : 'Senha deve ter pelo menos 8 caracteres.');
      return;
    }

    setLoading(true);
    try {
      await setPersistence(firebaseAuth, remember ? browserLocalPersistence : browserSessionPersistence);
      const cred = await createUserWithEmailAndPassword(firebaseAuth, emailNorm, password);
      await updateProfile(cred.user, { displayName, photoURL: DEFAULT_AVATAR_URL });
      navigate(callbackUrl, { replace: true });
    } catch (err) {
      setError(authErrorMessage(err, lang));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="w-full max-w-md bg-white border border-brand-dark/10 rounded-2xl p-6 space-y-4">
      {!registrationLoading && !registrationEnabled ? (
        <div className="bg-red-600/10 border border-red-600/20 rounded-xl p-3 text-xs font-bold text-red-700">
          {lang === 'en' ? 'Account creation is currently disabled.' : lang === 'ru' ? 'Создание аккаунта сейчас отключено.' : 'Criação de conta está desativada no momento.'}
        </div>
      ) : null}
      <div>
        <label className="block text-xs font-bold uppercase tracking-widest text-brand-darker/60 mb-2">Email</label>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          className="w-full bg-brand-bg border border-brand-dark/10 rounded-lg py-2.5 px-3 text-sm focus:outline-none focus:border-brand-orange transition-colors"
          autoComplete="email"
          required
          disabled={!registrationEnabled || registrationLoading}
        />
      </div>

      <div>
        <label className="block text-xs font-bold uppercase tracking-widest text-brand-darker/60 mb-2">
          {lang === 'en' ? 'Real name' : lang === 'ru' ? 'Настоящее имя' : 'Nome real'}
        </label>
        <input
          value={realName}
          onChange={(e) => setRealName(e.target.value)}
          type="text"
          className="w-full bg-brand-bg border border-brand-dark/10 rounded-lg py-2.5 px-3 text-sm focus:outline-none focus:border-brand-orange transition-colors"
          autoComplete="name"
          required
          disabled={!registrationEnabled || registrationLoading}
        />
      </div>

      <div>
        <label className="block text-xs font-bold uppercase tracking-widest text-brand-darker/60 mb-2">Password</label>
        <div className="relative">
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type={showPassword ? 'text' : 'password'}
            className="w-full bg-brand-bg border border-brand-dark/10 rounded-lg py-2.5 pl-3 pr-10 text-sm focus:outline-none focus:border-brand-orange transition-colors"
            autoComplete="new-password"
            minLength={8}
            required
            disabled={!registrationEnabled || registrationLoading}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg hover:bg-white/60 transition-colors text-brand-dark/50 hover:text-brand-darker"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            title={showPassword ? 'Hide password' : 'Show password'}
            disabled={!registrationEnabled || registrationLoading}
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <label className="flex items-center gap-2 text-xs text-brand-darker/70 select-none">
        <input
          type="checkbox"
          checked={remember}
          onChange={(e) => setRemember(e.target.checked)}
          className="accent-brand-orange"
          disabled={!registrationEnabled || registrationLoading}
        />
        Remember me on this device
      </label>

      {error ? <div className="text-xs font-bold text-red-600">{error}</div> : null}

      <button
        type="submit"
        disabled={loading || !registrationEnabled || registrationLoading}
        className="orange-button w-full py-3 text-[10px] tracking-[0.2em] disabled:opacity-60"
      >
        {loading ? 'Creating...' : 'Create account'}
      </button>
    </form>
  );
}
