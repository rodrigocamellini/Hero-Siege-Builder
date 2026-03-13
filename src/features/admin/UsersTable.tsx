'use client';

import { useEffect, useMemo, useState } from 'react';
import { collection, doc, getDocs, limit, orderBy, query, runTransaction, serverTimestamp, Timestamp } from 'firebase/firestore';
import { Pencil, Trash2 } from 'lucide-react';
import { Modal } from '../../components/Modal';
import { FirebaseError } from 'firebase/app';
import { firestore } from '../../firebase';

type Role = 'USER' | 'CONTRIBUTOR' | 'MODERATOR' | 'PARTNER' | 'DEVELOPER';
type UserRow = {
  id: string;
  uid: string;
  email: string | null;
  nick: string | null;
  photoURL: string | null;
  displayName: string | null;
  role: Role;
  createdAt: Timestamp | null;
};

const roles: Role[] = ['USER', 'CONTRIBUTOR', 'MODERATOR', 'PARTNER', 'DEVELOPER'];

function firestoreErrorMessage(err: unknown) {
  if (err instanceof Error && err.message) return err.message;
  const code = err instanceof FirebaseError ? err.code : typeof (err as any)?.code === 'string' ? String((err as any).code) : '';
  if (code === 'permission-denied') return 'Permissão negada no Firestore. Ajuste as Rules para permitir admin.';
  if (code === 'unauthenticated') return 'Você precisa estar logado.';
  if (code === 'unavailable') return 'Firestore indisponível. Tente novamente.';
  return code ? `Erro: ${code}` : 'Falha no Firestore.';
}

function normalizeNick(nick: string) {
  return nick.trim().toLowerCase();
}

export function UsersTable() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<UserRow[]>([]);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{ nick: string; displayName: string; photoURL: string; role: Role } | null>(null);
  const [deleting, setDeleting] = useState<UserRow | null>(null);
  const [deleteText, setDeleteText] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const rows = useMemo(() => items, [items]);

  async function load() {
    setError(null);
    setLoading(true);
    try {
      const usersQuery = query(collection(firestore, 'users'), orderBy('createdAt', 'desc'), limit(200));
      const snap = await getDocs(usersQuery);
      const nextItems = snap.docs.map((d) => {
        const data = d.data() as Partial<UserRow>;
        return {
          id: d.id,
          uid: String(data.uid ?? d.id),
          email: typeof data.email === 'string' ? data.email : null,
          nick: typeof data.nick === 'string' ? data.nick : null,
          displayName: typeof data.displayName === 'string' ? data.displayName : null,
          photoURL: typeof (data as any).photoURL === 'string' ? String((data as any).photoURL) : null,
          role: (roles.includes(data.role as Role) ? (data.role as Role) : 'USER') as Role,
          createdAt: data.createdAt instanceof Timestamp ? data.createdAt : null,
        };
      });
      setItems(nextItems);
    } catch (err) {
      setError(firestoreErrorMessage(err));
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
      nick: u.nick ?? '',
      displayName: u.displayName ?? '',
      photoURL: u.photoURL ?? '',
      role: u.role,
    });
  }

  function closeEdit() {
    setEditing(null);
    setEditForm(null);
    setEditSaving(false);
    setEditError(null);
  }

  function openDelete(u: UserRow) {
    setDeleteError(null);
    setDeleting(u);
    setDeleteText('');
  }

  function closeDelete() {
    setDeleting(null);
    setDeleteText('');
    setDeleteLoading(false);
    setDeleteError(null);
  }

  async function confirmDelete() {
    if (!deleting) return;
    setDeleteError(null);
    setDeleteLoading(true);
    try {
      await runTransaction(firestore, async (tx) => {
        const userRef = doc(firestore, 'users', deleting.id);
        const userSnap = await tx.get(userRef);
        const nick = userSnap.exists() && typeof (userSnap.data() as any)?.nick === 'string' ? String((userSnap.data() as any).nick) : null;
        const nickKey = nick ? normalizeNick(nick) : null;
        if (nickKey) {
          tx.delete(doc(firestore, 'nicks', nickKey));
        }
        tx.delete(userRef);
      });
      setItems((prev) => prev.filter((u) => u.id !== deleting.id));
      closeDelete();
    } catch (err) {
      setDeleteError(firestoreErrorMessage(err));
    } finally {
      setDeleteLoading(false);
    }
  }

  async function saveEdit() {
    if (!editing || !editForm) return;
    setEditError(null);
    setEditSaving(true);
    try {
      const nextNickRaw = editForm.nick.trim();
      const nextNick = nextNickRaw.length ? nextNickRaw : null;
      const nextNickKey = nextNick ? normalizeNick(nextNick) : null;

      await runTransaction(firestore, async (tx) => {
        const userRef = doc(firestore, 'users', editing.id);
        const userSnap = await tx.get(userRef);
        const prevNick = userSnap.exists() && typeof (userSnap.data() as any)?.nick === 'string' ? String((userSnap.data() as any).nick) : null;
        const prevNickKey = prevNick ? normalizeNick(prevNick) : null;

        if (prevNickKey && prevNickKey !== nextNickKey) {
          tx.delete(doc(firestore, 'nicks', prevNickKey));
        }

        if (nextNickKey && prevNickKey !== nextNickKey) {
          const nickRef = doc(firestore, 'nicks', nextNickKey);
          const nickSnap = await tx.get(nickRef);
          const reservedUid = nickSnap.exists() ? String((nickSnap.data() as any)?.uid ?? '') : '';
          if (nickSnap.exists() && reservedUid && reservedUid !== editing.uid) {
            throw new Error('Esse nick já está em uso.');
          }
          tx.set(nickRef, { uid: editing.uid, nick: nextNickRaw, updatedAt: serverTimestamp() }, { merge: true });
        }

        if (!userSnap.exists()) {
          tx.set(
            userRef,
            {
              uid: editing.uid,
              createdAt: serverTimestamp(),
              role: 'USER',
            },
            { merge: true },
          );
        }

        tx.set(
          userRef,
          {
            nick: nextNick,
            displayName: editForm.displayName.trim() || null,
            photoURL: editForm.photoURL.trim() || null,
            role: editForm.role,
            updatedAt: serverTimestamp(),
          },
          { merge: true },
        );
      });

      setItems((prev) =>
        prev.map((u) =>
          u.id === editing.id
            ? { ...u, nick: nextNick, displayName: editForm.displayName.trim() || null, photoURL: editForm.photoURL.trim() || null, role: editForm.role }
            : u,
        ),
      );
      closeEdit();
    } catch (err) {
      setEditError(firestoreErrorMessage(err));
    } finally {
      setEditSaving(false);
    }
  }

  return (
    <div className="bg-white border border-brand-dark/10 rounded-2xl overflow-hidden">
      <div className="p-6 flex items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="font-heading font-bold text-xl uppercase tracking-tight text-brand-darker">Users</h2>
          <div className="text-xs text-brand-darker/60">Manage system roles.</div>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => void load()}
            className="bg-brand-bg border border-brand-dark/10 px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-widest text-brand-darker hover:border-brand-orange transition-colors"
            disabled={loading}
          >
            {loading ? 'Loading...' : 'Reload'}
          </button>
        </div>
      </div>

      {error ? <div className="px-6 pb-4 text-xs font-bold text-red-600">{error}</div> : null}

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-brand-bg border-t border-b border-brand-dark/10">
            <tr>
              <th className="px-6 py-3 text-[10px] uppercase tracking-widest text-brand-darker/60">Foto</th>
              <th className="px-6 py-3 text-[10px] uppercase tracking-widest text-brand-darker/60">Nick</th>
              <th className="px-6 py-3 text-[10px] uppercase tracking-widest text-brand-darker/60">Email</th>
              <th className="px-6 py-3 text-[10px] uppercase tracking-widest text-brand-darker/60">Name</th>
              <th className="px-6 py-3 text-[10px] uppercase tracking-widest text-brand-darker/60">Role</th>
              <th className="px-6 py-3 text-[10px] uppercase tracking-widest text-brand-darker/60">Created</th>
              <th className="px-6 py-3 text-[10px] uppercase tracking-widest text-brand-darker/60 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-dark/10">
            {loading ? (
              <tr>
                <td className="px-6 py-6 text-sm text-brand-darker/60" colSpan={7}>
                  Loading...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td className="px-6 py-6 text-sm text-brand-darker/60" colSpan={7}>
                  No users found.
                </td>
              </tr>
            ) : (
              rows.map((u) => {
                return (
                  <tr key={u.id} className="hover:bg-brand-bg/40 transition-colors">
                    <td className="px-6 py-4">
                      <div className="w-9 h-9 rounded-xl bg-brand-bg border border-brand-dark/10 overflow-hidden flex items-center justify-center">
                        {u.photoURL ? (
                          <img src={u.photoURL} alt={u.nick ?? u.email ?? '-'} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <div className="text-[10px] font-bold uppercase tracking-widest text-brand-darker/40">-</div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm font-bold text-brand-darker">{u.nick ?? '-'}</td>
                    <td className="px-6 py-4 text-sm font-bold text-brand-darker">{u.email ?? '-'}</td>
                    <td className="px-6 py-4 text-sm text-brand-darker/70">{u.displayName ?? '-'}</td>
                    <td className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-brand-darker/70">{u.role.toLowerCase()}</td>
                    <td className="px-6 py-4 text-xs text-brand-darker/60">{u.createdAt ? u.createdAt.toDate().toLocaleString() : '-'}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEdit(u)}
                          className="p-2 rounded-lg bg-brand-bg border border-brand-dark/10 text-brand-darker hover:border-brand-orange hover:text-brand-orange transition-colors inline-flex items-center"
                          aria-label="Edit"
                          title="Edit"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => openDelete(u)}
                          className="p-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors inline-flex items-center"
                          aria-label="Delete"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
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

      <Modal open={!!editing && !!editForm} title="Edit user" onClose={closeEdit}>
        {editForm ? (
          <div className="space-y-4">
            {editError ? <div className="text-xs font-bold text-red-600">{editError}</div> : null}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                <label className="block text-[10px] font-bold uppercase tracking-widest text-brand-darker/60 mb-2">Name</label>
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
                  value={editForm.photoURL}
                  onChange={(e) => setEditForm((p) => (p ? { ...p, photoURL: e.target.value } : p))}
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
                Cancel
              </button>
              <button
                type="button"
                className="bg-brand-orange text-white px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-widest hover:bg-brand-orange-dark transition-colors disabled:opacity-50"
                onClick={() => void saveEdit()}
                disabled={editSaving}
              >
                {editSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal open={!!deleting} title="Delete user" onClose={closeDelete}>
        {deleting ? (
          <div className="space-y-4">
            <div className="text-sm text-brand-darker/70">
              Você vai deletar <span className="font-bold text-brand-darker">{deleting.nick ?? deleting.email ?? deleting.id}</span>.
            </div>
            <div className="text-xs text-brand-darker/60">Digite DELETE para confirmar.</div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-brand-darker/60 mb-2">Confirmação</label>
              <input
                value={deleteText}
                onChange={(e) => setDeleteText(e.target.value)}
                type="text"
                className="w-full bg-brand-bg border border-brand-dark/10 rounded-lg py-2.5 px-3 text-sm focus:outline-none focus:border-brand-orange transition-colors"
                autoComplete="off"
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
                Cancel
              </button>
              <button
                type="button"
                className="bg-red-600 text-white px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-widest hover:bg-red-700 transition-colors disabled:opacity-50"
                onClick={() => void confirmDelete()}
                disabled={deleteLoading || deleteText.trim().toUpperCase() !== 'DELETE'}
              >
                {deleteLoading ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
