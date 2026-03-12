'use client';

export function ClassCard({ name, description, image, btnText }: { name: string; description: string; image: string; btnText: string }) {
  return (
    <div className="pixel-card bg-white p-6 flex flex-col items-center text-center group hover:border-brand-orange transition-all duration-300">
      <div className="w-20 h-20 md:w-24 md:h-24 mb-4 bg-brand-bg rounded-2xl overflow-hidden flex items-center justify-center p-4 group-hover:scale-110 transition-transform border border-brand-dark/5">
        <img src={image} alt={name} className="w-full h-full object-contain pixelated" referrerPolicy="no-referrer" />
      </div>
      <h3 className="font-heading font-bold text-lg md:text-xl mb-2 uppercase tracking-tight text-brand-darker">{name}</h3>
      <p className="text-[10px] md:text-xs text-brand-darker/50 mb-6 leading-relaxed px-2">{description}</p>
      <button className="orange-button w-full py-2.5 text-[10px] tracking-[0.2em]">{btnText}</button>
    </div>
  );
}
