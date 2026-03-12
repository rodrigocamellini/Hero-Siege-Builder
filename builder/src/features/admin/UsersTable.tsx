'use client';

import { useEffect, useMemo, useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { Modal } from '../../components/Modal';

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
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<UserRow[]>([]);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{ email: string; nick: string; displayName: string; avatarUrl: string; role: Role } | null>(null);

  const [deleting, setDeleting] = useState<UserRow | null>(null);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const rows = useMemo(() => items, [items]);

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
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function openEdit(u: UserRow) {
    setEditError(null);
    setEditing(u);
    setEditForm({
      email: u.email,
      nick: u.nick ?? '',
      displayName: u.displayName ?? '',
      avatarUrl: u.avatarUrl ?? '',
      role: u.role,
    });
  }

  function closeEdit() {
    setEditing(null);
    setEditForm(null);
    setEditSaving(false);
    setEditError(null);
  }

  async function saveEdit() {
    if (!editing || !editForm) return;
    setEditError(null);
    setEditSaving(true);
    try {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(editing.id)}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: editForm.email,
          nick: editForm.nick,
          displayName: editForm.displayName,
          avatarUrl: editForm.avatarUrl,
          role: editForm.role,
        }),
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string; user?: UserRow } | null;
      if (!res.ok || !data?.ok || !data.user) {
        setEditError(data?.error ?? 'Falha ao salvar');
        return;
      }
      setItems((prev) => prev.map((u) => (u.id === editing.id ? data.user! : u)));
      closeEdit();
    } finally {
      setEditSaving(false);
    }
  }

  function openDelete(u: UserRow) {
    setDeleteError(null);
    setDeleting(u);
    setDeletePassword('');
  }

  function closeDelete() {
    setDeleting(null);
    setDeletePassword('');
    setDeleteLoading(false);
    setDeleteError(null);
  }

  async function confirmDelete() {
    if (!deleting) return;
    setDeleteError(null);
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(deleting.id)}`, {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password: deletePassword }),
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !data?.ok) {
        setDeleteError(data?.error ?? 'Falha ao deletar');
        return;
      }
      setItems((prev) => prev.filter((u) => u.id !== deleting.id));
      closeDelete();
    } finally {
      setDeleteLoading(false);
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
              <th className="px-6 py-3 text-[10px] uppercase tracking-widest text-brand-darker/60 text-right">Ações</th>
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
                    <td className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-brand-darker/70">{u.role.toLowerCase()}</td>
                    <td className="px-6 py-4 text-xs text-brand-darker/60">{new Date(u.createdAt).toLocaleString()}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openEdit(u)}
                          className="bg-brand-bg border border-brand-dark/10 px-3 py-2 rounded-lg font-bold text-xs uppercase tracking-widest text-brand-darker hover:border-brand-orange transition-colors inline-flex items-center gap-2"
                        >
                          <Pencil className="w-4 h-4" />
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => openDelete(u)}
                          className="bg-red-600 text-white px-3 py-2 rounded-lg font-bold text-xs uppercase tracking-widest hover:bg-red-700 transition-colors inline-flex items-center gap-2"
                        >
                          <Trash2 className="w-4 h-4" />
                          Deletar
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <Modal open={!!editing && !!editForm} title="Editar usuário" onClose={closeEdit}>
        {editForm ? (
          <div className="space-y-4">
            {editError ? <div className="text-xs font-bold text-red-600">{editError}</div> : null}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-brand-darker/60 mb-2">Email</label>
                <input
                  value={editForm.email}
                  onChange={(e) => setEditForm((p) => (p ? { ...p, email: e.target.value } : p))}
                  type="email"
                  className="w-full bg-brand-bg border border-brand-dark/10 rounded-lg py-2.5 px-3 text-sm focus:outline-none focus:border-brand-orange transition-colors"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-brand-darker/60 mb-2">Nick</label>
                <input
                  value={editForm.nick}
                  onChange={(e) => setEditForm((p) => (p ? { ...p, nick: e.target.value } : p))}
                  type="text"
                  className="w-full bg-brand-bg border border-brand-dark/10 rounded-lg py-2.5 px-3 text-sm focus:outline-none focus:border-brand-orange transition-colors"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-brand-darker/60 mb-2">Nome</label>
                <input
                  value={editForm.displayName}
                  onChange={(e) => setEditForm((p) => (p ? { ...p, displayName: e.target.value } : p))}
                  type="text"
                  className="w-full bg-brand-bg border border-brand-dark/10 rounded-lg py-2.5 px-3 text-sm focus:outline-none focus:border-brand-orange transition-colors"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-brand-darker/60 mb-2">Role</label>
                <select
                  value={editForm.role}
                  onChange={(e) => setEditForm((p) => (p ? { ...p, role: e.target.value as Role } : p))}
                  className="w-full bg-brand-bg border border-brand-dark/10 rounded-lg px-3 py-2.5 text-xs font-bold tracking-widest uppercase text-brand-darker focus:outline-none focus:border-brand-orange"
                >
                  {roles.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-[10px] font-bold uppercase tracking-widest text-brand-darker/60 mb-2">Foto (URL)</label>
                <input
                  value={editForm.avatarUrl}
                  onChange={(e) => setEditForm((p) => (p ? { ...p, avatarUrl: e.target.value } : p))}
                  type="url"
                  className="w-full bg-brand-bg border border-brand-dark/10 rounded-lg py-2.5 px-3 text-sm focus:outline-none focus:border-brand-orange transition-colors"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                className="bg-brand-bg border border-brand-dark/10 px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-widest text-brand-darker hover:border-brand-orange transition-colors"
                onClick={closeEdit}
                disabled={editSaving}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="bg-brand-orange text-white px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-widest hover:bg-brand-orange-dark transition-colors disabled:opacity-50"
                onClick={() => void saveEdit()}
                disabled={editSaving}
              >
                {editSaving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal open={!!deleting} title="Deletar usuário" onClose={closeDelete}>
        {deleting ? (
          <div className="space-y-4">
            <div className="text-sm text-brand-darker/70">
              Você está prestes a deletar <span className="font-bold text-brand-darker">{deleting.nick ?? deleting.email}</span>.
            </div>
            <div className="text-xs text-brand-darker/60">Digite a senha do DEVELOPER para confirmar.</div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-brand-darker/60 mb-2">Senha</label>
              <input
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                type="password"
                className="w-full bg-brand-bg border border-brand-dark/10 rounded-lg py-2.5 px-3 text-sm focus:outline-none focus:border-brand-orange transition-colors"
                autoComplete="current-password"
              />
            </div>
            {deleteError ? <div className="text-xs font-bold text-red-600">{deleteError}</div> : null}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                className="bg-brand-bg border border-brand-dark/10 px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-widest text-brand-darker hover:border-brand-orange transition-colors"
                onClick={closeDelete}
                disabled={deleteLoading}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="bg-red-600 text-white px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-widest hover:bg-red-700 transition-colors disabled:opacity-50"
                onClick={() => void confirmDelete()}
                disabled={deleteLoading || deletePassword.length === 0}
              >
                {deleteLoading ? 'Deletando...' : 'Deletar'}
              </button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
