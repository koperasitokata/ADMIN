
import React from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ICONS } from '../constants';

interface MobileNavProps {}

const MobileNav: React.FC<MobileNavProps> = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const currentView = searchParams.get('v') || 'home';

  const handleNav = (v: string) => {
    navigate(`/?v=${v}`);
  };

  const isActive = (v: string) => currentView === v && location.pathname === '/';

  const NavButton = ({ 
    v, 
    icon, 
    label, 
    colorClass = 'text-slate-500', 
    activeClass = 'text-violet-400 font-bold scale-110' 
  }: { 
    v: string, 
    icon: React.ReactNode, 
    label: string,
    colorClass?: string,
    activeClass?: string
  }) => (
    <button 
      type="button"
      onClick={() => handleNav(v)}
      className={`flex-1 flex flex-col items-center justify-center gap-1 py-2 px-1 transition-all active:bg-white/5 rounded-2xl ${isActive(v) ? activeClass : colorClass}`}
    >
      <div className="transform transition-transform">{icon}</div>
      <span className="text-[9px] font-black uppercase tracking-tight">{label}</span>
    </button>
  );

  return (
    <div className="fixed bottom-0 left-0 right-0 glass-cosmic-heavy border-t border-white/5 px-4 py-2 flex justify-between items-stretch z-[9999] safe-area-bottom shadow-[0_-15px_40px_rgba(0,0,0,0.5)] rounded-t-[2.5rem]">
      <NavButton v="home" icon={ICONS.Home} label="Beranda" />
      <NavButton v="approvals" icon={ICONS.Pending} label="Persetujuan" />
      <NavButton v="members" icon={ICONS.Users} label="Nasabah" />
      <NavButton v="maps" icon={ICONS.Map} label="Maps" />
      <NavButton v="mutations" icon={ICONS.Stats} label="Mutasi" />
      <NavButton v="settings" icon={ICONS.Settings} label="Setting" />
    </div>
  );
};

export default MobileNav;
