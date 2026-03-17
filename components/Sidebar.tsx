import React from 'react';
import { UserRole, Petugas, Nasabah } from '../types';
import { ICONS } from '../constants';

interface SidebarProps {
  role: UserRole;
  user: Petugas | Nasabah;
  onLogout: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ role, user, onLogout }) => {
  const menuItems = [
    { label: 'Dashboard', icon: ICONS.Home, path: '/' },
    ...(role === UserRole.ADMIN ? [
      { label: 'Petugas', icon: ICONS.Users, path: '/staff' },
      { label: 'Modal Awal', icon: ICONS.Wallet, path: '/capital' },
      { label: 'Pengeluaran', icon: ICONS.Expense, path: '/expenses' },
    ] : []),
    ...(role === UserRole.KOLEKTOR ? [
      { label: 'Data Nasabah', icon: ICONS.Users, path: '/members' },
      { label: 'Setoran', icon: ICONS.Income, path: '/collections' },
      { label: 'Cairkan Pinjaman', icon: ICONS.Verify, path: '/disbursement' },
    ] : []),
    { label: 'Laporan', icon: ICONS.Doc, path: '/reports' },
    { label: 'Pengaturan', icon: ICONS.Settings, path: '/settings' },
  ];

  return (
    <div className="w-64 h-full bg-white border-r border-slate-200 flex flex-col">
      <div className="p-6 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold">
            KM
          </div>
          <span className="font-bold text-slate-800 text-lg">Koperasi Mandiri</span>
        </div>
      </div>

      <div className="p-4 flex flex-col gap-2 flex-1">
        {menuItems.map((item, idx) => (
          <button 
            key={idx}
            className="flex items-center gap-3 px-4 py-3 text-slate-600 hover:bg-slate-50 hover:text-blue-600 rounded-xl transition-all font-medium"
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </div>

      <div className="p-4 border-t border-slate-200">
        <div className="flex items-center gap-3 px-4 py-3 mb-4">
          <img src={user.foto} alt="profile" className="w-10 h-10 rounded-full border border-slate-200 object-cover" referrerPolicy="no-referrer" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-800 truncate">{user.nama}</p>
            <p className="text-xs text-slate-500 capitalize">{role.toLowerCase()}</p>
          </div>
        </div>
        <button 
          onClick={onLogout}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-50 text-red-600 hover:bg-red-100 rounded-xl transition-all font-semibold"
        >
          {ICONS.Logout}
          Keluar
        </button>
      </div>
    </div>
  );
};

export default Sidebar;