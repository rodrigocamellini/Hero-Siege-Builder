export type Language = 'en' | 'pt' | 'ru';

export const translations = {
  en: {
    nav: ['Home', 'Builds', 'Classes', 'Items', 'Leaderboard', 'My Account'],
    heroTitle: 'PLAN YOUR <span class="text-brand-orange">ULTIMATE</span> JOURNEY IN HERO SIEGE.',
    heroSubtitle: 'CREATE, SHARE AND DOMINATE WITH THE MOST COMPLETE COMMUNITY BUILDER.',
    createBuild: 'Create Build',
    popularClasses: 'Popular Classes',
    filter: 'Filter',
    viewBuilds: 'View Builds',
    latestBuilds: 'Latest Featured Builds',
    createdBy: 'Created by:',
    topBuilders: 'Top Builders',
    gameUpdates: 'Game Updates',
    footerLinks: ['Site Build', 'Builds', 'Classes', 'Items', 'Leaderboard', 'My Account'],
    rights: 'Hero Siege Builder {{year}} © This website is not affiliated with Panic Art Studios. All assets and data belong to their respective owners.',
    classes: {
      viking: { name: 'Viking', desc: 'Robust warrior focused on physical damage and resistance.' },
      pyro: { name: 'Pyromancer', desc: 'Master of fire capable of incinerating hordes of enemies.' },
      marksman: { name: 'Marksman', desc: 'Ranged combat specialist with deadly precision.' },
    },
    updates: [
      { title: 'New Patch 1.2.0', date: '03/07/2023', desc: 'New classes and item balancing for the new season.' },
      { title: 'Season Update', date: '03/01/2023', desc: 'Start of Season 15 with new challenges and exclusive rewards.' },
    ],
  },
  pt: {
    nav: ['Início', 'Builds', 'Classes', 'Itens', 'Ranking', 'Minha Conta'],
    heroTitle: 'PLANEJE SUA JORNADA <span class="text-brand-orange">SUPREMA</span> NO HERO SIEGE.',
    heroSubtitle: 'CRIE, COMPARTILHE E DOMINE COM O BUILDER MAIS COMPLETO DA COMUNIDADE.',
    createBuild: 'Criar Build',
    popularClasses: 'Classes Populares',
    filter: 'Filtrar',
    viewBuilds: 'Ver Builds',
    latestBuilds: 'Últimas Builds Destacadas',
    createdBy: 'Criado por:',
    topBuilders: 'Top Builders',
    gameUpdates: 'Atualizações do Jogo',
    footerLinks: ['Site Build', 'Builds', 'Classes', 'Itens', 'Ranking', 'Minha Conta'],
    rights: 'Hero Siege Builder {{year}} © Este site não é afiliado à Panic Art Studios. Todos os recursos e dados pertencem aos seus respectivos proprietários.',
    classes: {
      viking: { name: 'Viking', desc: 'Guerreiro robusto focado em dano físico e resistência.' },
      pyro: { name: 'Pyromancer', desc: 'Mestre do fogo capaz de incinerar hordas de inimigos.' },
      marksman: { name: 'Marksman', desc: 'Especialista em combate à distância com precisão mortal.' },
    },
    updates: [
      { title: 'Novo Patch 1.2.0', date: '07/03/2023', desc: 'Novas classes e balanceamento de itens para a nova temporada.' },
      { title: 'Atualização de Temporada', date: '01/03/2023', desc: 'Início da Season 15 com novos desafios e recompensas exclusivas.' },
    ],
  },
  ru: {
    nav: ['Главная', 'Билды', 'Классы', 'Предметы', 'Лидеры', 'Аккаунт'],
    heroTitle: 'ПЛАНИРУЙТЕ СВОЕ <span class="text-brand-orange">ВЕЛИКОЕ</span> ПУТЕШЕСТВИЕ В HERO SIEGE.',
    heroSubtitle: 'СОЗДАВАЙТЕ, ДЕЛИТЕСЬ И ДОМИНИРУЙТЕ С САМЫМ ПОЛНЫМ СТРОИТЕЛЕМ СООБЩЕСТВА.',
    createBuild: 'Создать билд',
    popularClasses: 'Популярные классы',
    filter: 'Фильтр',
    viewBuilds: 'Смотреть билды',
    latestBuilds: 'Последние избранные билды',
    createdBy: 'Создал:',
    topBuilders: 'Лучшие строители',
    gameUpdates: 'Обновления игры',
    footerLinks: ['О сайте', 'Билды', 'Классы', 'Предметы', 'Лидеры', 'Аккаунт'],
    rights: 'Hero Siege Builder {{year}} © Этот сайт не связан с Panic Art Studios. Все ресурсы и данные принадлежат их соответствующим владельцам.',
    classes: {
      viking: { name: 'Викинг', desc: 'Могучий воин, ориентированный на физический урон и сопротивление.' },
      pyro: { name: 'Пиромант', desc: 'Мастер огня, способный испепелять орды врагов.' },
      marksman: { name: 'Стрелок', desc: 'Специалист по дальнему бою с убийственной точностью.' },
    },
    updates: [
      { title: 'Новый патч 1.2.0', date: '07.03.2023', desc: 'Новые классы и баланс предметов для нового сезона.' },
      { title: 'Обновление сезона', date: '01.03.2023', desc: 'Начало 15-го сезона с новыми испытаниями и эксклюзивными наградами.' },
    ],
  },
} as const;

export type Translation = (typeof translations)[Language];
