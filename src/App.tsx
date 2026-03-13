import { HomePage } from './features/home/HomePage';
import { Link, Navigate, Route, Routes } from 'react-router-dom';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { AdminLoginPage } from './pages/AdminLoginPage';
import { AdminPage } from './pages/AdminPage';
import { StandardPage } from './components/StandardPage';
import { AccountTierListPage } from './pages/AccountTierListPage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/admin/login" element={<AdminLoginPage />} />
      <Route path="/admin/*" element={<AdminPage />} />
      <Route
        path="/account"
        element={
          <StandardPage>
            <div className="max-w-7xl mx-auto px-4 py-8 md:py-16">
              <h1 className="font-heading font-bold text-3xl md:text-4xl uppercase tracking-tight text-brand-darker">Account</h1>
              <p className="mt-2 text-sm text-brand-darker/60">Em breve.</p>
            </div>
          </StandardPage>
        }
      />
      <Route
        path="/account/tierlist"
        element={<AccountTierListPage />}
      />
      <Route path="/tierlist" element={<AccountTierListPage />} />
      <Route
        path="/blog"
        element={
          <StandardPage>
            <div className="max-w-7xl mx-auto px-4 py-8 md:py-16">
              <h1 className="font-heading font-bold text-3xl md:text-4xl uppercase tracking-tight text-brand-darker">Blog</h1>
              <p className="mt-2 text-sm text-brand-darker/60">Em breve.</p>
            </div>
          </StandardPage>
        }
      />
      <Route
        path="/contact"
        element={
          <StandardPage>
            <div className="max-w-7xl mx-auto px-4 py-8 md:py-16">
              <h1 className="font-heading font-bold text-3xl md:text-4xl uppercase tracking-tight text-brand-darker">Contact</h1>
              <p className="mt-2 text-sm text-brand-darker/60">Em breve.</p>
            </div>
          </StandardPage>
        }
      />
      <Route
        path="/database"
        element={
          <StandardPage>
            <div className="max-w-7xl mx-auto px-4 py-8 md:py-16">
              <h1 className="font-heading font-bold text-3xl md:text-4xl uppercase tracking-tight text-brand-darker">Database</h1>
              <p className="mt-2 text-sm text-brand-darker/60">Explore classes, itens e dados do jogo.</p>
              <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
                <Link
                  to="/database/classes"
                  className="bg-white rounded-2xl border border-brand-dark/10 p-6 hover:border-brand-orange/40 hover:bg-brand-orange/5 transition-colors"
                >
                  <div className="font-heading font-bold text-lg uppercase tracking-tight text-brand-darker">Classes</div>
                  <div className="mt-2 text-sm text-brand-darker/60">Lista de classes e informações.</div>
                </Link>
                <Link
                  to="/database/items"
                  className="bg-white rounded-2xl border border-brand-dark/10 p-6 hover:border-brand-orange/40 hover:bg-brand-orange/5 transition-colors"
                >
                  <div className="font-heading font-bold text-lg uppercase tracking-tight text-brand-darker">Items</div>
                  <div className="mt-2 text-sm text-brand-darker/60">Base de itens do jogo.</div>
                </Link>
              </div>
            </div>
          </StandardPage>
        }
      />
      <Route
        path="/database/classes"
        element={
          <StandardPage>
            <div className="max-w-7xl mx-auto px-4 py-8 md:py-16">
              <h1 className="font-heading font-bold text-3xl md:text-4xl uppercase tracking-tight text-brand-darker">Classes</h1>
              <p className="mt-2 text-sm text-brand-darker/60">Em breve.</p>
            </div>
          </StandardPage>
        }
      />
      <Route
        path="/database/items"
        element={
          <StandardPage>
            <div className="max-w-7xl mx-auto px-4 py-8 md:py-16">
              <h1 className="font-heading font-bold text-3xl md:text-4xl uppercase tracking-tight text-brand-darker">Items</h1>
              <p className="mt-2 text-sm text-brand-darker/60">Em breve.</p>
            </div>
          </StandardPage>
        }
      />
      <Route
        path="/tree"
        element={
          <StandardPage>
            <div className="max-w-7xl mx-auto px-4 py-8 md:py-16">
              <h1 className="font-heading font-bold text-3xl md:text-4xl uppercase tracking-tight text-brand-darker">Tree</h1>
              <p className="mt-2 text-sm text-brand-darker/60">Escolha uma seção.</p>
              <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
                <Link
                  to="/tree/ether"
                  className="bg-white rounded-2xl border border-brand-dark/10 p-6 hover:border-brand-orange/40 hover:bg-brand-orange/5 transition-colors"
                >
                  <div className="font-heading font-bold text-lg uppercase tracking-tight text-brand-darker">Ether</div>
                  <div className="mt-2 text-sm text-brand-darker/60">Em breve.</div>
                </Link>
                <Link
                  to="/tree/incarnation"
                  className="bg-white rounded-2xl border border-brand-dark/10 p-6 hover:border-brand-orange/40 hover:bg-brand-orange/5 transition-colors"
                >
                  <div className="font-heading font-bold text-lg uppercase tracking-tight text-brand-darker">Incarnation</div>
                  <div className="mt-2 text-sm text-brand-darker/60">Em breve.</div>
                </Link>
              </div>
            </div>
          </StandardPage>
        }
      />
      <Route
        path="/tree/ether"
        element={
          <StandardPage>
            <div className="max-w-7xl mx-auto px-4 py-8 md:py-16">
              <h1 className="font-heading font-bold text-3xl md:text-4xl uppercase tracking-tight text-brand-darker">Ether</h1>
              <p className="mt-2 text-sm text-brand-darker/60">Em breve.</p>
            </div>
          </StandardPage>
        }
      />
      <Route
        path="/tree/incarnation"
        element={
          <StandardPage>
            <div className="max-w-7xl mx-auto px-4 py-8 md:py-16">
              <h1 className="font-heading font-bold text-3xl md:text-4xl uppercase tracking-tight text-brand-darker">Incarnation</h1>
              <p className="mt-2 text-sm text-brand-darker/60">Em breve.</p>
            </div>
          </StandardPage>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
