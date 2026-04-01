import { useEffect, useMemo, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { StandardPage } from '../components/StandardPage';
import { firestore } from '../firebase';
import { Github, Globe, MessageCircle, Twitch, Youtube } from 'lucide-react';

type Socials = Partial<{
  discord: string;
  twitch: string;
  youtube: string;
  site: string;
  github: string;
}>;

type Member = {
  id: string;
  nick: string;
  name?: string;
  role?: string;
  order?: number;
  photo?: string;
  description?: string;
  socials?: Socials;
};

const ROLE_LABEL: Record<string, string> = {
  'legendary admin-main': 'Developer',
  angelic: 'Moderator',
  satanic: 'Contributor',
  heroic: 'Partner',
  set: 'Designer',
  mythic: 'Editor',
  common: 'Support',
  Desenvolvedor: 'Developer',
  Moderador: 'Moderator',
  Colaborador: 'Contributor',
  Parceiro: 'Partner',
  Suporte: 'Support',
};

export function TeamPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const snap = await getDocs(collection(firestore, 'team'));
        const list: Member[] = [];
        snap.forEach((d) => {
          const data = d.data() as any;
          list.push({
            id: d.id,
            nick: data?.nick ?? '',
            name: data?.name ?? '',
            role: data?.role ?? '',
            order: typeof data?.order === 'number' ? data.order : Number(data?.order) || 0,
            photo: data?.photo ?? '',
            description: data?.description ?? '',
            socials: typeof data?.socials === 'object' ? data.socials : undefined,
          });
        });
        setMembers(list);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const sections = useMemo(() => {
    const normalizeRole = (raw: string | undefined) => {
      const r = (raw || '').trim();
      if (!r) return 'common';
      if (r === 'legendary admin-main' || r === 'angelic' || r === 'satanic' || r === 'mythic' || r === 'common' || r === 'heroic' || r === 'set') return r;
      if (r === 'Desenvolvedor' || r === 'Developer') return 'legendary admin-main';
      if (r === 'Moderador' || r === 'Moderator') return 'angelic';
      if (r === 'Colaborador' || r === 'Contributor') return 'satanic';
      if (r === 'Editor') return 'mythic';
      if (r === 'Suporte' || r === 'Support') return 'common';
      if (r === 'Parceiro' || r === 'Partner') return 'heroic';
      if (r === 'Designer' || r === 'Design') return 'set';
      return 'common';
    };

    const roleOrder: Array<{ id: string; title: string; css: string }> = [
      { id: 'legendary admin-main', title: 'Developer', css: 'legendary' },
      { id: 'angelic', title: 'Moderador', css: 'angelic' },
      { id: 'satanic', title: 'Contribuidor', css: 'satanic' },
      { id: 'mythic', title: 'Editor', css: 'mythic' },
      { id: 'common', title: 'Support', css: 'common' },
      { id: 'heroic', title: 'Partner', css: 'heroic' },
      { id: 'set', title: 'Design', css: 'set' },
    ];

    const byRole = new Map<string, Member[]>();
    for (const m of members) {
      const role = normalizeRole(m.role);
      const list = byRole.get(role) || [];
      list.push({ ...m, role });
      byRole.set(role, list);
    }

    const sortMembers = (a: Member, b: Member) => {
      const oa = typeof a.order === 'number' ? a.order : 0;
      const ob = typeof b.order === 'number' ? b.order : 0;
      if (oa !== ob) return oa - ob;
      return (a.nick || '').localeCompare(b.nick || '');
    };

    return roleOrder
      .map((r) => ({ title: r.title, css: r.css, members: (byRole.get(r.id) || []).sort(sortMembers) }))
      .filter((s) => s.members.length > 0);
  }, [members]);

  const renderDivider = (title: string, cssClass: string) => {
    return (
      <div className={`team-role-divider ${cssClass}`}>
        <div className="team-role-divider-label">{title}</div>
        <div className="team-role-divider-bar" />
      </div>
    );
  };

  const renderSocials = (socials: Socials | undefined) => {
    if (!socials) return null;
    return (
      <div className="card-footer">
        {socials.discord ? (
          <a className="team-social" data-kind="discord" href={socials.discord} target="_blank" rel="noreferrer" aria-label="Discord">
            <MessageCircle size={18} />
          </a>
        ) : null}
        {socials.twitch ? (
          <a className="team-social" data-kind="twitch" href={socials.twitch} target="_blank" rel="noreferrer" aria-label="Twitch">
            <Twitch size={18} />
          </a>
        ) : null}
        {socials.youtube ? (
          <a className="team-social" data-kind="youtube" href={socials.youtube} target="_blank" rel="noreferrer" aria-label="YouTube">
            <Youtube size={18} />
          </a>
        ) : null}
        {socials.site ? (
          <a className="team-social" data-kind="site" href={socials.site} target="_blank" rel="noreferrer" aria-label="Site">
            <Globe size={18} />
          </a>
        ) : null}
        {socials.github ? (
          <a className="team-social" data-kind="github" href={socials.github} target="_blank" rel="noreferrer" aria-label="GitHub">
            <Github size={18} />
          </a>
        ) : null}
      </div>
    );
  };

  return (
    <StandardPage title="Team | Hero Siege Builder" description="Meet the Hero Siege Builder team." canonicalPath="/team">
      <div className="max-w-7xl mx-auto px-4 py-8 md:py-16">
        <h1 className="font-heading font-bold text-3xl md:text-4xl uppercase tracking-tight text-brand-darker">Team</h1>

        <div className="team-cyber mt-8">
          <div className="team-container">
            {loading ? (
              <div className="equipe-main-layout">
                <div className="cyber-card common">
                  <span className="tier-label">— Carregando</span>
                  <div className="inner-box">Carregando equipe...</div>
                </div>
              </div>
            ) : (
              <div className="equipe-main-layout">
                {sections.map((section) => (
                  <div key={section.title} className="w-full">
                    {renderDivider(section.title, section.css)}
                    <div className={section.title === 'Developer' && section.members.length === 1 ? 'mt-6 team-single-center' : 'mt-6 colaboradores-grid'}>
                      {section.members.map((m) => (
                        <div
                          key={m.id}
                          className={`cyber-card ${m.role || 'common'}`}
                        >
                          <span className="tier-label">— {ROLE_LABEL[m.role ?? ''] ?? (section.title || 'Member')}</span>
                          <div className="profile-header">
                            <div className="img-frame admin-img">
                              <img
                                src={m.photo || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(m.nick)}`}
                                alt={m.nick}
                              />
                            </div>
                            <div className="name-box admin-name">
                              <div>
                                <h2>{m.nick}</h2>
                              </div>
                              {m.name ? (
                                <div>
                                  <h3>{m.name}</h3>
                                </div>
                              ) : null}
                            </div>
                          </div>
                          <div className="inner-box">{m.description || (m.role === 'legendary admin-main' ? 'Desenvolvedor do projeto Hero Siege Builder.' : 'Colaborador do projeto Hero Siege Builder.')}</div>
                          {renderSocials(m.socials)}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </StandardPage>
  );
}
