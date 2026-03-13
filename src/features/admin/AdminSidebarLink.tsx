'use client';

import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';

type Props = {
  href: string;
  icon: ReactNode;
  label: string;
  exact?: boolean;
};

export function AdminSidebarLink({ href, icon, label, exact }: Props) {
  const location = useLocation();
  const pathname = location.pathname;
  const isActive = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      to={href}
      className={[
        'group flex items-center gap-2 px-4 py-3 rounded-xl font-bold text-sm transition-colors',
        isActive ? 'bg-brand-orange/10 text-brand-orange' : 'text-brand-darker hover:bg-brand-orange/10 hover:text-brand-orange',
      ].join(' ')}
    >
      <span className={isActive ? 'text-brand-orange' : 'text-brand-dark/40 group-hover:text-brand-orange'}>{icon}</span>
      {label}
    </Link>
  );
}
