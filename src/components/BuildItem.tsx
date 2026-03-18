'use client';

import { Star, User } from 'lucide-react';
import { type SyntheticEvent } from 'react';
import { Link } from 'react-router-dom';

export function BuildItem({
  title,
  creator,
  rating,
  items,
  classNameLabel,
  stage,
  createdByText,
  href,
}: {
  title: string;
  creator: string;
  rating: number;
  items: string[];
  classNameLabel?: string;
  stage?: string;
  createdByText: string;
  href?: string;
}) {
  const ITEM_FALLBACK_ICON = 'https://herosiege.wiki.gg/images/Item_Chest.png';

  const onItemIconError = (e: SyntheticEvent<HTMLImageElement>) => {
    const t = e.currentTarget;
    if (t.src.includes('Item_Chest.png')) return;
    t.src = ITEM_FALLBACK_ICON;
  };

  const content = (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-white border border-brand-dark/5 rounded-2xl hover:shadow-lg transition-all hover:-translate-y-0.5 group gap-4">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 md:w-14 md:h-14 bg-brand-bg rounded-xl flex items-center justify-center border border-brand-dark/5 group-hover:bg-brand-orange/5 transition-colors">
          <User className="text-brand-dark/20 w-5 h-5 md:w-6 md:h-6" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h4 className="font-bold text-brand-darker text-base md:text-lg group-hover:text-brand-orange transition-colors">{title}</h4>
            {stage && (
              <span className={`text-[8px] md:text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${
                stage.toLowerCase().includes('starter') ? 'bg-green-50 text-green-700 border-green-200' :
                stage.toLowerCase().includes('mid') ? 'bg-blue-50 text-blue-700 border-blue-200' :
                'bg-purple-50 text-purple-700 border-purple-200'
              }`}>
                {stage}
              </span>
            )}
          </div>
          <p className="text-[10px] md:text-xs text-brand-darker/40">
            {createdByText} <span className="text-brand-orange font-bold">{creator}</span>
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between w-full sm:w-auto gap-4 md:gap-12">
        <div className="flex items-center gap-1 md:gap-1.5">
          {[...Array(5)].map((_, i) => (
            <Star
              key={i}
              className={`w-3 h-3 md:w-4 md:h-4 ${i < rating ? 'text-brand-orange fill-current' : 'text-brand-dark/10'}`}
            />
          ))}
        </div>

        <div className="flex items-center gap-1.5 md:gap-2.5">
          {items.map((item, i) => (
            <div
              key={i}
              className="w-8 h-8 md:w-10 md:h-10 bg-brand-bg rounded-lg border border-brand-dark/10 flex items-center justify-center p-1 md:p-1.5 hover:border-brand-orange transition-colors cursor-help"
            >
              <img
                src={item || ITEM_FALLBACK_ICON}
                alt="item"
                className="w-full h-full object-contain pixelated"
                onError={onItemIconError}
              />
            </div>
          ))}
          {classNameLabel && (
            <span className="text-[10px] md:text-xs font-bold text-brand-darker/60 uppercase tracking-widest ml-1">
              {classNameLabel}
            </span>
          )}
        </div>
      </div>
    </div>
  );

  if (href) {
    return (
      <Link to={href} className="block">
        {content}
      </Link>
    );
  }
  return content;
}
