import { HomePage } from './features/home/HomePage';
import { Link, Navigate, Route, Routes } from 'react-router-dom';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { AdminLoginPage } from './pages/AdminLoginPage';
import { AdminPage } from './pages/AdminPage';
import { StandardPage } from './components/StandardPage';
import { AccountTierListPage } from './pages/AccountTierListPage';
import { AccountSettingsPage } from './pages/AccountSettingsPage';
import { EtherTree } from './features/tree/EtherTree';
import { TeamPage } from './pages/TeamPage';
import { BlogPage } from './pages/BlogPage';
import { BlogPostPage } from './pages/BlogPostPage';
import { BlogEditorPage } from './pages/BlogEditorPage';
import { ContactPage } from './pages/ContactPage';

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
              <p className="mt-2 text-sm text-brand-darker/60">Escolha uma opção.</p>
              <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Link
                  to="/account/settings"
                  className="bg-white rounded-2xl border border-brand-dark/10 p-6 hover:border-brand-orange/40 hover:bg-brand-orange/5 transition-colors"
                >
                  <div className="font-heading font-bold text-lg uppercase tracking-tight text-brand-darker">Configurações</div>
                  <div className="mt-2 text-sm text-brand-darker/60">Foto, nick e senha.</div>
                </Link>
                <Link
                  to="/account/tierlist"
                  className="bg-white rounded-2xl border border-brand-dark/10 p-6 hover:border-brand-orange/40 hover:bg-brand-orange/5 transition-colors"
                >
                  <div className="font-heading font-bold text-lg uppercase tracking-tight text-brand-darker">Tier List</div>
                  <div className="mt-2 text-sm text-brand-darker/60">Vote na tier list.</div>
                </Link>
              </div>
            </div>
          </StandardPage>
        }
      />
      <Route path="/account/settings" element={<AccountSettingsPage />} />
      <Route
        path="/account/tierlist"
        element={<AccountTierListPage />}
      />
      <Route path="/tierlist" element={<AccountTierListPage />} />
      <Route path="/blog" element={<BlogPage />} />
      <Route path="/blog/editor" element={<BlogEditorPage />} />
      <Route path="/blog/:slug" element={<BlogPostPage />} />
      <Route
        path="/contact"
        element={<ContactPage />}
      />
      <Route
        path="/database"
        element={
          <StandardPage>
            <div className="max-w-7xl mx-auto px-4 py-8 md:py-16">
              <h1 className="font-heading font-bold text-3xl md:text-4xl uppercase tracking-tight text-brand-darker">Database</h1>
              <p className="mt-2 text-sm text-brand-darker/60">Explore classes, itens e dados do jogo.</p>
              <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
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
                <Link to="/database/runes" className="bg-white rounded-2xl border border-brand-dark/10 p-6 hover:border-brand-orange/40 hover:bg-brand-orange/5 transition-colors">
                  <div className="font-heading font-bold text-lg uppercase tracking-tight text-brand-darker">Runas</div>
                  <div className="mt-2 text-sm text-brand-darker/60">Em breve.</div>
                </Link>
                <Link to="/database/relics" className="bg-white rounded-2xl border border-brand-dark/10 p-6 hover:border-brand-orange/40 hover:bg-brand-orange/5 transition-colors">
                  <div className="font-heading font-bold text-lg uppercase tracking-tight text-brand-darker">Relíquias</div>
                  <div className="mt-2 text-sm text-brand-darker/60">Em breve.</div>
                </Link>
                <Link to="/database/chaos-tower" className="bg-white rounded-2xl border border-brand-dark/10 p-6 hover:border-brand-orange/40 hover:bg-brand-orange/5 transition-colors">
                  <div className="font-heading font-bold text-lg uppercase tracking-tight text-brand-darker">Chaos Tower</div>
                  <div className="mt-2 text-sm text-brand-darker/60">Em breve.</div>
                </Link>
                <Link to="/database/mercenarios" className="bg-white rounded-2xl border border-brand-dark/10 p-6 hover:border-brand-orange/40 hover:bg-brand-orange/5 transition-colors">
                  <div className="font-heading font-bold text-lg uppercase tracking-tight text-brand-darker">Mercenários</div>
                  <div className="mt-2 text-sm text-brand-darker/60">Em breve.</div>
                </Link>
                <Link to="/database/chaves" className="bg-white rounded-2xl border border-brand-dark/10 p-6 hover:border-brand-orange/40 hover:bg-brand-orange/5 transition-colors">
                  <div className="font-heading font-bold text-lg uppercase tracking-tight text-brand-darker">Chaves</div>
                  <div className="mt-2 text-sm text-brand-darker/60">Em breve.</div>
                </Link>
                <Link to="/database/augments" className="bg-white rounded-2xl border border-brand-dark/10 p-6 hover:border-brand-orange/40 hover:bg-brand-orange/5 transition-colors">
                  <div className="font-heading font-bold text-lg uppercase tracking-tight text-brand-darker">Augments</div>
                  <div className="mt-2 text-sm text-brand-darker/60">Em breve.</div>
                </Link>
                <Link to="/database/quests" className="bg-white rounded-2xl border border-brand-dark/10 p-6 hover:border-brand-orange/40 hover:bg-brand-orange/5 transition-colors">
                  <div className="font-heading font-bold text-lg uppercase tracking-tight text-brand-darker">Quests</div>
                  <div className="mt-2 text-sm text-brand-darker/60">Em breve.</div>
                </Link>
                <Link to="/database/mineracao" className="bg-white rounded-2xl border border-brand-dark/10 p-6 hover:border-brand-orange/40 hover:bg-brand-orange/5 transition-colors">
                  <div className="font-heading font-bold text-lg uppercase tracking-tight text-brand-darker">Mineração</div>
                  <div className="mt-2 text-sm text-brand-darker/60">Em breve.</div>
                </Link>
                <Link to="/database/gems" className="bg-white rounded-2xl border border-brand-dark/10 p-6 hover:border-brand-orange/40 hover:bg-brand-orange/5 transition-colors">
                  <div className="font-heading font-bold text-lg uppercase tracking-tight text-brand-darker">Gemas e Jóias</div>
                  <div className="mt-2 text-sm text-brand-darker/60">Em breve.</div>
                </Link>
                <Link to="/database/charms" className="bg-white rounded-2xl border border-brand-dark/10 p-6 hover:border-brand-orange/40 hover:bg-brand-orange/5 transition-colors">
                  <div className="font-heading font-bold text-lg uppercase tracking-tight text-brand-darker">Charms</div>
                  <div className="mt-2 text-sm text-brand-darker/60">Em breve.</div>
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
            <div className="fixed inset-x-0 bottom-0 top-[64px] z-40">
              <EtherTree />
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
      <Route path="/team" element={<TeamPage />} />
      {[
        { p: '/database/runes', t: 'Runas' },
        { p: '/database/relics', t: 'Relíquias' },
        { p: '/database/chaos-tower', t: 'Chaos Tower' },
        { p: '/database/mercenarios', t: 'Mercenários' },
        { p: '/database/chaves', t: 'Chaves' },
        { p: '/database/augments', t: 'Augments' },
        { p: '/database/quests', t: 'Quests' },
        { p: '/database/mineracao', t: 'Mineração' },
        { p: '/database/gems', t: 'Gemas e Jóias' },
        { p: '/database/charms', t: 'Charms' },
      ].map(({ p, t }) => (
        <Route
          key={p}
          path={p}
          element={
            <StandardPage>
              <div className="max-w-7xl mx-auto px-4 py-8 md:py-16">
                <h1 className="font-heading font-bold text-3xl md:text-4xl uppercase tracking-tight text-brand-darker">{t}</h1>
                <p className="mt-2 text-sm text-brand-darker/60">Em breve.</p>
              </div>
            </StandardPage>
          }
        />
      ))}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
