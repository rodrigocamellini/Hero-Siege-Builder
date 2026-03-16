'use client';

import { Link } from 'react-router-dom';

export function NewsCard({
  title,
  description,
  image,
  btnText,
  href,
}: {
  title: string;
  description: string;
  image: string;
  btnText: string;
  href?: string;
}) {
  const inner = (
    <>
      <div className="w-full h-36 md:h-40 bg-brand-bg border-b border-brand-dark/10 overflow-hidden">
        <img src={image} alt={title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
      </div>
      <div className="p-6 flex flex-col flex-1 text-center">
        <h3 className="font-heading font-bold text-lg md:text-xl mb-2 uppercase tracking-tight text-brand-darker">{title}</h3>
        <p className="text-[10px] md:text-xs text-brand-darker/50 mb-6 leading-relaxed">{description}</p>
        <span className="orange-button w-full py-2.5 text-[10px] tracking-[0.2em] mt-auto">{btnText}</span>
      </div>
    </>
  );

  if (href) {
    return (
      <Link to={href} className="pixel-card bg-white flex flex-col group hover:border-brand-orange transition-all duration-300">
        {inner}
      </Link>
    );
  }

  return <div className="pixel-card bg-white flex flex-col group hover:border-brand-orange transition-all duration-300">{inner}</div>;
}
