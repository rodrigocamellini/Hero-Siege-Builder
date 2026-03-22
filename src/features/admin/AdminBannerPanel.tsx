'use client';

import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, setDoc } from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';
import { FirebaseError } from 'firebase/app';
import { Plus, Pencil, Trash2, Save, X } from 'lucide-react';
import { firestore } from '../../firebase';
import { Modal } from '../../components/Modal';

type BannerRow = {
  id: string;
  topText: string;
  accentText: string;
  subtitle: string;
  buttonText: string;
  buttonHref: string;
  imageUrl: string;
  order: number;
  enabled: boolean;
};

function firestoreErrorMessage(err: unknown) {
  const code = err instanceof FirebaseError ? err.code : typeof (err as any)?.code === 'string' ? String((err as any).code) : '';
  if (code === 'permission-denied') return 'Permissão negada no Firestore. Ajuste as Rules para permitir admin.';
  if (code === 'unauthenticated') return 'Você precisa estar logado.';
  if (code === 'unavailable') return 'Firestore indisponível. Tente novamente.';
  return code ? `Erro: ${code}` : 'Falha no Firestore.';
}

function safeString(v: unknown) {
  return typeof v === 'string' ? v : '';
}

function safeBoolean(v: unknown) {
  return v === true;
}

function safeNumber(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function AdminBannerPanel() {
  const [rows, setRows] = useState<BannerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [rotationSeconds, setRotationSeconds] = useState(7);
  const [rotationSaving, setRotationSaving] = useState(false);
  const [rotationSavedOk, setRotationSavedOk] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [topText, setTopText] = useState('New Class Spotlight');
  const [accentText, setAccentText] = useState('The Prophet');
  const [subtitle, setSubtitle] = useState(
    'Mastering the elements and summoning ancestral spirits, the Prophet brings a new shapeshifting mechanic to the battlefield.',
  );
  const [buttonText, setButtonText] = useState('Learn More');
  const [buttonHref, setButtonHref] = useState('/blog/new-class-the-prophet');
  const [imageUrl, setImageUrl] = useState(
    'https://i.postimg.cc/wv4z7SN7/o-HB2YGYGZMKNCdyz-Bojh6RIlqx1gan3Efg-Lizr-C5liy-TAJETkz-Y1d-Ridp-Fg-ZTMc-YDv-GBle-Owp-X1BTNNi9Qz-DT.jpg',
  );
  const [order, setOrder] = useState<number>(1);
  const [enabled, setEnabled] = useState(true);

  const [saving, setSaving] = useState(false);
  const [confirmDelId, setConfirmDelId] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    const qy = query(collection(firestore, 'banners'), orderBy('order', 'asc'));
    const unsub = onSnapshot(
      qy,
      (snap) => {
        const list: BannerRow[] = [];
        snap.forEach((d) => {
          const data = d.data() as any;
          list.push({
            id: d.id,
            topText: safeString(data?.topText),
            accentText: safeString(data?.accentText),
            subtitle: safeString(data?.subtitle),
            buttonText: safeString(data?.buttonText),
            buttonHref: safeString(data?.buttonHref),
            imageUrl: safeString(data?.imageUrl),
            order: safeNumber(data?.order) || 0,
            enabled: typeof data?.enabled === 'boolean' ? data.enabled : true,
          });
        });
        setRows(list);
        setLoading(false);
      },
      (err) => {
        setRows([]);
        setLoading(false);
        setError(firestoreErrorMessage(err));
      },
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    setError(null);
    const unsub = onSnapshot(
      doc(firestore, 'appSettings', 'banner'),
      (snap) => {
        if (!snap.exists()) {
          setRotationSeconds(7);
          return;
        }
        const d = snap.data() as any;
        const n = Number(d?.rotationSeconds);
        setRotationSeconds(Number.isFinite(n) && n >= 1 && n <= 120 ? n : 7);
      },
      (err) => setError(firestoreErrorMessage(err)),
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    if (loading) return;
    if (rows.length > 0) return;
    let stop = false;
    const seed = async () => {
      try {
        await addDoc(collection(firestore, 'banners'), {
          topText: 'New Class Spotlight',
          accentText: 'The Prophet',
          subtitle:
            'Mastering the elements and summoning ancestral spirits, the Prophet brings a new shapeshifting mechanic to the battlefield.',
          buttonText: 'Learn More',
          buttonHref: '/blog/new-class-the-prophet',
          imageUrl:
            'https://i.postimg.cc/wv4z7SN7/o-HB2YGYGZMKNCdyz-Bojh6RIlqx1gan3Efg-Lizr-C5liy-TAJETkz-Y1d-Ridp-Fg-ZTMc-YDv-GBle-Owp-X1BTNNi9Qz-DT.jpg',
          order: 1,
          enabled: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        if (!stop) setError(firestoreErrorMessage(err));
      }
    };
    void seed();
    return () => {
      stop = true;
    };
  }, [loading, rows.length]);

  const nextOrder = useMemo(() => {
    const max = rows.reduce((acc, r) => Math.max(acc, r.order || 0), 0);
    return max + 1;
  }, [rows]);

  const openNew = () => {
    setError(null);
    setEditingId(null);
    setTopText('New Class Spotlight');
    setAccentText('The Prophet');
    setSubtitle('Mastering the elements and summoning ancestral spirits, the Prophet brings a new shapeshifting mechanic to the battlefield.');
    setButtonText('Learn More');
    setButtonHref('/blog/new-class-the-prophet');
    setImageUrl('https://i.postimg.cc/wv4z7SN7/o-HB2YGYGZMKNCdyz-Bojh6RIlqx1gan3Efg-Lizr-C5liy-TAJETkz-Y1d-Ridp-Fg-ZTMc-YDv-GBle-Owp-X1BTNNi9Qz-DT.jpg');
    setOrder(nextOrder);
    setEnabled(true);
    setModalOpen(true);
  };

  const openEdit = (r: BannerRow) => {
    setError(null);
    setEditingId(r.id);
    setTopText(r.topText);
    setAccentText(r.accentText);
    setSubtitle(r.subtitle);
    setButtonText(r.buttonText);
    setButtonHref(r.buttonHref);
    setImageUrl(r.imageUrl);
    setOrder(r.order || 0);
    setEnabled(r.enabled);
    setModalOpen(true);
  };

  const save = async () => {
    setError(null);
    setSaving(true);
    try {
      const payload = {
        topText: topText.trim(),
        accentText: accentText.trim(),
        subtitle: subtitle.trim(),
        buttonText: buttonText.trim(),
        buttonHref: buttonHref.trim(),
        imageUrl: imageUrl.trim(),
        order: Number.isFinite(order) ? order : 0,
        enabled,
        updatedAt: serverTimestamp(),
      };
      if (editingId) {
        await setDoc(doc(firestore, 'banners', editingId), payload, { merge: true });
      } else {
        await addDoc(collection(firestore, 'banners'), { ...payload, createdAt: serverTimestamp() });
      }
      setModalOpen(false);
    } catch (err) {
      setError(firestoreErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const del = async (id: string) => {
    setError(null);
    setSaving(true);
    try {
      await deleteDoc(doc(firestore, 'banners', id));
      setConfirmDelId(null);
    } catch (err) {
      setError(firestoreErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const saveRotation = async () => {
    setError(null);
    setRotationSavedOk(false);
    setRotationSaving(true);
    try {
      const next = Number(rotationSeconds);
      await setDoc(
        doc(firestore, 'appSettings', 'banner'),
        { rotationSeconds: Number.isFinite(next) && next >= 1 && next <= 120 ? next : 7, updatedAt: serverTimestamp() },
        { merge: true },
      );
      setRotationSavedOk(true);
    } catch (err) {
      setError(firestoreErrorMessage(err));
    } finally {
      setRotationSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-brand-dark/10 rounded-2xl p-5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="min-w-0">
            <div className="font-heading font-bold text-xl uppercase tracking-tight text-brand-darker">Banner</div>
            <div className="text-xs text-brand-darker/60">Gerencie o banner principal (rotativo) da página inicial.</div>
          </div>
          <button
            type="button"
            onClick={openNew}
            className="inline-flex items-center gap-2 bg-brand-orange text-white px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-brand-orange/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Novo Banner
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <label className="md:col-span-2">
            <div className="text-[11px] font-bold uppercase tracking-widest text-brand-darker/60">Rotação (segundos)</div>
            <input
              type="number"
              min={1}
              max={120}
              value={rotationSeconds}
              onChange={(e) => {
                setRotationSavedOk(false);
                setRotationSeconds(Number(e.target.value));
              }}
              className="mt-2 w-full bg-brand-bg border border-brand-dark/10 rounded-xl px-3 py-2 text-sm text-brand-darker outline-none"
            />
          </label>
          <div className="md:col-span-2 flex items-center justify-end gap-2">
            {rotationSavedOk ? <div className="text-xs font-bold text-emerald-600">Configuração salva.</div> : null}
            <button
              type="button"
              onClick={() => void saveRotation()}
              disabled={rotationSaving}
              className="inline-flex items-center gap-2 bg-brand-dark text-white px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-brand-darker transition-colors disabled:opacity-60"
            >
              <Save className="w-4 h-4" />
              {rotationSaving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      </div>

      {error ? <div className="text-xs font-bold text-red-600">{error}</div> : null}

      <div className="bg-white border border-brand-dark/10 rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-brand-dark/10">
          <div className="font-heading font-bold uppercase tracking-widest text-xs text-brand-darker/70">Banners cadastrados</div>
          <div className="mt-1 text-xs text-brand-darker/60">Ordem menor aparece primeiro. Apenas banners habilitados entram no loop.</div>
        </div>

        {loading ? (
          <div className="p-5 text-sm text-brand-darker/60">Carregando...</div>
        ) : rows.length === 0 ? (
          <div className="p-5 text-sm text-brand-darker/60">Nenhum banner encontrado.</div>
        ) : (
          <div className="divide-y divide-brand-dark/10">
            {rows.map((r) => (
              <div key={r.id} className="p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="font-bold text-brand-darker truncate">
                      {r.topText} · <span className="text-brand-orange">{r.accentText}</span>
                    </div>
                    {!r.enabled ? (
                      <span className="px-2 py-0.5 rounded-full bg-brand-bg border border-brand-dark/10 text-[10px] font-bold uppercase tracking-widest text-brand-darker/60">
                        Off
                      </span>
                    ) : null}
                    <span className="px-2 py-0.5 rounded-full bg-brand-bg border border-brand-dark/10 text-[10px] font-bold uppercase tracking-widest text-brand-darker/60">
                      #{r.order || 0}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-brand-darker/60 truncate">{r.subtitle}</div>
                  <div className="mt-1 text-xs text-brand-darker/60 truncate">
                    Botão: {r.buttonText} → {r.buttonHref}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openEdit(r)}
                    className="inline-flex items-center gap-2 bg-brand-bg border border-brand-dark/10 text-brand-darker px-3 py-2 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-white transition-colors"
                  >
                    <Pencil className="w-4 h-4" />
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelId(r.id)}
                    className="inline-flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-red-100 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    Excluir
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal open={modalOpen} title={editingId ? 'Editar Banner' : 'Novo Banner'} onClose={() => setModalOpen(false)} maxWidthClassName="max-w-3xl">
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="block">
              <div className="text-[11px] font-bold uppercase tracking-widest text-brand-darker/60">Frase de cima</div>
              <input
                value={topText}
                onChange={(e) => setTopText(e.target.value)}
                className="mt-2 w-full bg-brand-bg border border-brand-dark/10 rounded-xl px-3 py-2 text-sm text-brand-darker outline-none"
              />
            </label>
            <label className="block">
              <div className="text-[11px] font-bold uppercase tracking-widest text-brand-darker/60">Frase destacada</div>
              <input
                value={accentText}
                onChange={(e) => setAccentText(e.target.value)}
                className="mt-2 w-full bg-brand-bg border border-brand-dark/10 rounded-xl px-3 py-2 text-sm text-brand-darker outline-none"
              />
            </label>
          </div>

          <label className="block">
            <div className="text-[11px] font-bold uppercase tracking-widest text-brand-darker/60">Texto</div>
            <textarea
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              rows={3}
              className="mt-2 w-full bg-brand-bg border border-brand-dark/10 rounded-xl px-3 py-2 text-sm text-brand-darker outline-none"
            />
          </label>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="block">
              <div className="text-[11px] font-bold uppercase tracking-widest text-brand-darker/60">Texto do botão</div>
              <input
                value={buttonText}
                onChange={(e) => setButtonText(e.target.value)}
                className="mt-2 w-full bg-brand-bg border border-brand-dark/10 rounded-xl px-3 py-2 text-sm text-brand-darker outline-none"
              />
            </label>
            <label className="block">
              <div className="text-[11px] font-bold uppercase tracking-widest text-brand-darker/60">Link do botão</div>
              <input
                value={buttonHref}
                onChange={(e) => setButtonHref(e.target.value)}
                className="mt-2 w-full bg-brand-bg border border-brand-dark/10 rounded-xl px-3 py-2 text-sm text-brand-darker outline-none"
              />
            </label>
          </div>

          <label className="block">
            <div className="text-[11px] font-bold uppercase tracking-widest text-brand-darker/60">Imagem (URL)</div>
            <input
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              className="mt-2 w-full bg-brand-bg border border-brand-dark/10 rounded-xl px-3 py-2 text-sm text-brand-darker outline-none"
            />
          </label>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <label className="block">
              <div className="text-[11px] font-bold uppercase tracking-widest text-brand-darker/60">Ordem</div>
              <input
                type="number"
                value={order}
                onChange={(e) => setOrder(Number(e.target.value))}
                className="mt-2 w-full bg-brand-bg border border-brand-dark/10 rounded-xl px-3 py-2 text-sm text-brand-darker outline-none"
              />
            </label>
            <label className="flex items-center gap-2 bg-white border border-brand-dark/10 px-3 py-2 rounded-xl text-xs font-bold uppercase tracking-widest text-brand-darker/70 select-none">
              <input type="checkbox" className="accent-brand-orange" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
              Ativo
            </label>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                disabled={saving}
                className="inline-flex items-center gap-2 bg-brand-bg border border-brand-dark/10 text-brand-darker px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-white transition-colors disabled:opacity-60"
              >
                <X className="w-4 h-4" />
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void save()}
                disabled={saving}
                className="inline-flex items-center gap-2 bg-brand-orange text-white px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-brand-orange/90 transition-colors disabled:opacity-60"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      </Modal>

      <Modal open={!!confirmDelId} title="Excluir Banner" onClose={() => setConfirmDelId(null)}>
        <div className="space-y-4">
          <div className="text-sm text-brand-darker/70">Tem certeza que deseja excluir este banner?</div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setConfirmDelId(null)}
              className="inline-flex items-center gap-2 bg-brand-bg border border-brand-dark/10 text-brand-darker px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-white transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => void del(confirmDelId || '')}
              disabled={saving}
              className="inline-flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-red-700 transition-colors disabled:opacity-60"
            >
              <Trash2 className="w-4 h-4" />
              Excluir
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
