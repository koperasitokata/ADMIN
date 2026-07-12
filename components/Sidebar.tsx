
import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ICONS } from '../constants';
import { LogOut } from 'lucide-react';
import { Petugas } from '../types';

interface SidebarProps {
  user: Petugas;
  onLogout: () => void;
}

const getSecurePhotoUrl = (url: string | null | undefined): string => {
  if (!url) return "https://picsum.photos/200";
  if (url.startsWith('data:image')) return url;
  if (url.includes('action=GET_PHOTO')) {
    const queryIdx = url.indexOf('?');
    if (queryIdx >= 0) {
      return `/api/photo${url.substring(queryIdx)}`;
    }
  }
  return url;
};

const Sidebar: React.FC<SidebarProps> = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const currentView = searchParams.get('v') || 'home';

  const handleNav = (v: string) => {
    navigate(`/?v=${v}`);
  };

  const isActive = (v: string) => currentView === v;

  const NavItem = ({ 
    v, 
    icon, 
    label 
  }: { 
    v: string, 
    icon: React.ReactNode, 
    label: string 
  }) => (
    <button 
      type="button"
      onClick={() => handleNav(v)}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
        isActive(v) 
          ? 'bg-violet-600/20 text-violet-400 border border-violet-600/30' 
          : 'text-slate-400 hover:bg-white/5 hover:text-white'
      }`}
    >
      <div className={`${isActive(v) ? 'scale-110' : ''} transition-transform`}>{icon}</div>
      <span className="text-sm font-bold tracking-tight">{label}</span>
    </button>
  );

  return (
    <aside className="hidden md:flex flex-col w-64 h-screen glass-cosmic-heavy border-r border-white/5 p-6 fixed left-0 top-0 z-[100]">
      <div className="flex items-center gap-3 mb-10 px-2">
        <div className="w-10 h-10 bg-tokata-gradient rounded-xl flex items-center justify-center text-white text-xl font-black">TK</div>
        <div>
          <h2 className="text-white font-black leading-tight">Tokata</h2>
          <p className="text-[10px] font-black text-violet-400 uppercase tracking-widest">Digital App</p>
        </div>
      </div>

      <nav className="flex-1 space-y-2">
        <NavItem v="home" icon={ICONS.Home} label="Beranda" />
        <NavItem v="approvals" icon={ICONS.Pending} label="Persetujuan" />
        <NavItem v="members" icon={ICONS.Users} label="Nasabah" />
        <NavItem v="maps" icon={ICONS.Map} label="Geospatial" />
        <NavItem v="mutations" icon={ICONS.Stats} label="Mutasi Kas" />
        <NavItem v="settings" icon={ICONS.Settings} label="Pengaturan" />
      </nav>

      <div className="pt-6 border-t border-white/5 space-y-4">
        <div className="flex items-center gap-3 px-2">
          <img 
            src={getSecurePhotoUrl(user.foto)} 
            className="w-10 h-10 rounded-xl border border-white/10 object-cover" 
            alt="profile" 
          />
          <div className="overflow-hidden">
            <p className="text-white text-xs font-bold truncate">{user.nama}</p>
            <p className="text-slate-500 text-[10px] truncate">{user.jabatan}</p>
          </div>
        </div>
        <button 
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-rose-400 hover:bg-rose-400/10 transition-all border border-transparent hover:border-rose-400/20"
        >
          <LogOut size={18} />
          <span className="text-sm font-bold">Keluar</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
