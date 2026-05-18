
import React, { useState, useEffect, useCallback } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { UserRole, AuthState, Nasabah, Petugas } from './types';
import Login from './pages/Login';
import AdminDashboard from './pages/AdminDashboard';
import MobileNav from './components/MobileNav';
import Sidebar from './components/Sidebar';

const App: React.FC = () => {
  const [auth, setAuth] = useState<AuthState>(({ user: null, role: null }));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedAuth = sessionStorage.getItem('koperasi_auth');
    if (savedAuth) {
      try {
        setAuth(JSON.parse(savedAuth));
      } catch (e) {
        sessionStorage.removeItem('koperasi_auth');
      }
    }
    setLoading(false);
  }, []);

  const handleLogin = (user: Nasabah | Petugas, role: UserRole) => {
    const newAuth = { user, role };
    setAuth(newAuth);
    sessionStorage.setItem('koperasi_auth', JSON.stringify(newAuth));
  };

  const handleLogout = useCallback(() => {
    setAuth({ user: null, role: null });
    sessionStorage.removeItem('koperasi_auth');
  }, []);

  if (loading) return (
    <div className="h-screen flex flex-col items-center justify-center bg-[#0f172a]">
      <div className="w-16 h-16 bg-tokata-gradient rounded-2xl flex items-center justify-center text-white text-2xl font-black mb-4 animate-bounce">TK</div>
      <div className="w-8 h-8 border-4 border-violet-600 border-t-transparent rounded-full animate-spin"></div>
      <p className="mt-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Tokata Digital</p>
    </div>
  );

  if (!auth.user) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <div className="flex h-screen bg-[#020617] overflow-hidden">
        {/* Desktop Sidebar */}
        {auth.role === UserRole.ADMIN && <Sidebar user={auth.user as Petugas} onLogout={handleLogout} />}
        
        <div className="flex-1 flex flex-col min-w-0 relative h-full">
          <main className="flex-1 overflow-y-auto pb-32 md:pb-8 md:pt-4 transition-all duration-300 md:ml-64">
            <Routes>
              {auth.role === UserRole.ADMIN && (
                <Route path="/" element={<AdminDashboard user={auth.user as Petugas} onLogout={handleLogout} />} />
              )}
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </main>
          <MobileNav />
        </div>
      </div>
    </HashRouter>
  );
};

export default App;
