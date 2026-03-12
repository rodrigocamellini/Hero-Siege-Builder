'use client';

import { useEffect, useMemo, useState } from 'react';

type Role = 'USER' | 'CONTRIBUTOR' | 'MODERATOR' | 'PARTNER' | 'DEVELOPER';
type UserRow = {
  id: string;
  email: string;
  nick: string | null;
  avatarUrl: string | null;
  displayName: string | null;
  role: Role;
  createdAt: string;
};

const roles: Role[] = ['USER', 'CONTRIBUTOR', 'MODERATOR', 'PARTNER', 'DEVELOPER'];

export function UsersTable() {
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<UserRow[]>([]);
  const [draftRoleById, setDraftRoleById] = useState<Record<string, Role>>({});

  const rows = useMemo(() => {
    return items.map((u) => ({
      ...u,
      draftRole: draftRoleById[u.id] ?? u.role,
    }));
  }, [items, draftRoleById]);

  async function load() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/admin/users', { method: 'GET' });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; users?: UserRow[]; error?: string } | null;
      if (!res.ok || !data?.ok || !Array.isArray(data.users)) {
        setError(data?.error ?? 'Falha ao carregar usuários');
        return;
      }
      setItems(data.users);
      setDraftRoleById({});
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function save(userId: string) {
    setError(null);
    setSavingId(userId);
    try {
      const role = draftRoleById[userId];
      const res = await fetch(`/api/admin/users/${encodeURIComponent(userId)}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ role }),
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string; user?: UserRow } | null;
      if (!res.ok || !data?.ok || !data.user) {
        setError(data?.error ?? 'Falha ao salvar');
        return;
      }
      setItems((prev) => prev.map((u) => (u.id === userId ? data.user! : u)));
      setDraftRoleById((prev) => {
        const next = { ...prev };
        delete next[userId];
        return next;
      });
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="bg-white border border-brand-dark/10 rounded-2xl overflow-hidden">
      <div className="p-6 flex items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="font-heading font-bold text-xl uppercase tracking-tight text-brand-darker">Usuários</h2>
          <div className="text-xs text-brand-darker/60">Gerencie roles do sistema.</div>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="bg-brand-bg border border-brand-dark/10 px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-widest text-brand-darker hover:border-brand-orange transition-colors"
          disabled={loading}
        >
          {loading ? 'Carregando...' : 'Recarregar'}
        </button>
      </div>

      {error ? <div className="px-6 pb-4 text-xs font-bold text-red-600">{error}</div> : null}

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-brand-bg border-t border-b border-brand-dark/10">
            <tr>
              <th className="px-6 py-3 text-[10px] uppercase tracking-widest text-brand-darker/60">Foto</th>
              <th className="px-6 py-3 text-[10px] uppercase tracking-widest text-brand-darker/60">Nick</th>
              <th className="px-6 py-3 text-[10px] uppercase tracking-widest text-brand-darker/60">Email</th>
              <th className="px-6 py-3 text-[10px] uppercase tracking-widest text-brand-darker/60">Nome</th>
              <th className="px-6 py-3 text-[10px] uppercase tracking-widest text-brand-darker/60">Role</th>
              <th className="px-6 py-3 text-[10px] uppercase tracking-widest text-brand-darker/60">Criado</th>
              <th className="px-6 py-3 text-[10px] uppercase tracking-widest text-brand-darker/60"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-dark/10">
            {loading ? (
              <tr>
                <td className="px-6 py-6 text-sm text-brand-darker/60" colSpan={7}>
                  Carregando...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td className="px-6 py-6 text-sm text-brand-darker/60" colSpan={7}>
                  Nenhum usuário encontrado.
                </td>
              </tr>
            ) : (
              rows.map((u) => {
                const dirty = u.draftRole !== u.role;
                return (
                  <tr key={u.id} className="hover:bg-brand-bg/40 transition-colors">
                    <td className="px-6 py-4">
                      <div className="w-9 h-9 rounded-xl bg-brand-bg border border-brand-dark/10 overflow-hidden flex items-center justify-center">
                        {u.avatarUrl ? (
                          <img src={u.avatarUrl} alt={u.nick ?? u.email} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <div className="text-[10px] font-bold uppercase tracking-widest text-brand-darker/40">-</div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm font-bold text-brand-darker">{u.nick ?? '-'}</td>
                    <td className="px-6 py-4 text-sm font-bold text-brand-darker">{u.email}</td>
                    <td className="px-6 py-4 text-sm text-brand-darker/70">{u.displayName ?? '-'}</td>
                    <td className="px-6 py-4">
                      <select
                        value={u.draftRole}
                        onChange={(e) =>
                          setDraftRoleById((prev) => ({ ...prev, [u.id]: e.target.value as Role }))
                        }
                        className="bg-brand-bg border border-brand-dark/10 rounded-lg px-3 py-2 text-xs font-bold tracking-widest uppercase text-brand-darker focus:outline-none focus:border-brand-orange"
                      >
                        {roles.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-6 py-4 text-xs text-brand-darker/60">{new Date(u.createdAt).toLocaleString()}</td>
                    <td className="px-6 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => void save(u.id)}
                        disabled={!dirty || savingId === u.id}
                        className="bg-brand-orange text-white px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-widest hover:bg-brand-orange-dark transition-colors disabled:opacity-50"
                      >
                        {savingId === u.id ? 'Salvando...' : 'Salvar'}
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
