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

  const { developers, others } = useMemo(() => {
    const dev = members.filter((m) => m.role === 'legendary admin-main');
    const oth = members.filter((m) => m.role !== 'legendary admin-main');
    return { developers: dev, others: oth };
  }, [members]);

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
    <StandardPage>
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
                {developers.map((dev) => (
                  <div key={dev.id} className={`cyber-card ${dev.role || 'legendary admin-main'}`}>
                    <span className="tier-label">— {ROLE_LABEL[dev.role ?? ''] ?? 'Developer'}</span>
                    <div className="profile-header">
                      <div className="img-frame admin-img">
                        <img
                          src={dev.photo || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(dev.nick)}`}
                          alt={dev.nick}
                        />
                      </div>
                      <div className="name-box admin-name">
                        <div>
                          <h2>{dev.nick}</h2>
                        </div>
                        {dev.name ? (
                          <div>
                            <h3>{dev.name}</h3>
                          </div>
                        ) : null}
                      </div>
                    </div>
                    <div className="inner-box">{dev.description || 'Desenvolvedor do projeto Hero Siege Builder.'}</div>
                    {renderSocials(dev.socials)}
                  </div>
                ))}

                <div className="colaboradores-grid">
                  {others.map((m) => (
                    <div key={m.id} className={`cyber-card ${m.role || 'common'}`}>
                      <span className="tier-label">— {ROLE_LABEL[m.role ?? ''] ?? 'Member'}</span>
                      <div className="profile-header">
                        <div className="img-frame">
                          <img
                            src={m.photo || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(m.nick)}`}
                            alt={m.nick}
                          />
                        </div>
                        <div className="name-box">
                          <h3>{m.nick}</h3>
                        </div>
                      </div>
                      <div className="inner-box">{m.description || 'Colaborador do projeto Hero Siege Builder.'}</div>
                      {renderSocials(m.socials)}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </StandardPage>
  );
}
