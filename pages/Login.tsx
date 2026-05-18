
import React, { useState } from 'react';
import { UserRole } from '../types';
import { callApi } from '../constants';
import { CARD_CONFIG } from '../cardConfig';

interface LoginProps {
  onLogin: (user: any, role: UserRole) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    identifier: '',
    password: ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const result = await callApi('LOGIN', { 
        role: UserRole.ADMIN, 
        identifier: formData.identifier, 
        password: formData.password 
      });

      if (result.success) {
        onLogin(result.user, UserRole.ADMIN);
      } else {
        setError(result.message || 'Data login tidak sesuai.');
      }
    } catch (err) {
      setError('Gagal terhubung ke server. Periksa koneksi internet Anda.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#020617]">
      {/* Branding Section */}
      <div className="md:flex-1 bg-cosmic-gradient pt-16 pb-12 md:py-0 px-8 rounded-b-[3.5rem] md:rounded-none shadow-2xl relative overflow-hidden flex items-center justify-center">
        {CARD_CONFIG.loginBackground && (
          <img 
            src={CARD_CONFIG.loginBackground} 
            alt="Background" 
            className="absolute inset-0 w-full h-full object-cover opacity-60"
            referrerPolicy="no-referrer"
          />
        )}
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32 blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/10 rounded-full -ml-24 -mb-24 blur-3xl"></div>
        <div className="relative z-10 flex flex-col items-center max-w-md text-center">
          <div className="mb-6 flex items-center justify-center overflow-hidden" style={{ width: CARD_CONFIG.loginLogoSize, height: CARD_CONFIG.loginLogoSize }}>
            {CARD_CONFIG.loginLogo ? (
              <img 
                src={CARD_CONFIG.loginLogo} 
                alt="Logo" 
                className="w-full h-full object-contain"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-16 h-16 md:w-24 md:h-24 bg-white/10 rounded-3xl flex items-center justify-center border border-white/20">
                <span className="text-4xl md:text-6xl font-black tracking-tighter text-white">TK</span>
              </div>
            )}
          </div>
          <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight leading-tight">
            {CARD_CONFIG.loginTitle || 'TOKATA DIGITAL'}
          </h1>
          <p className="mt-4 text-cyan-200 text-xs md:text-sm font-black uppercase tracking-[0.4em] opacity-80">
            {CARD_CONFIG.loginSubtitle || 'SISTEM MANAJEMEN KOPERASI'}
          </p>
          <div className="hidden md:block mt-12 p-6 glass-cosmic border border-white/10 rounded-3xl backdrop-blur-xl">
             <p className="text-white/60 text-sm font-medium leading-relaxed italic">
               "Membangun ekonomi kerakyatan melalui digitalisasi keuangan yang berkelanjutan dan inklusif."
             </p>
          </div>
        </div>
      </div>

      {/* Login Form Section */}
      <div className="flex-1 flex flex-col justify-center items-center px-8 -mt-6 md:mt-0 relative z-20">
        <div className="w-full max-w-[420px] glass-cosmic rounded-[2.5rem] md:rounded-[3.5rem] shadow-2xl p-8 md:p-12 border border-white/10 bg-[#0f172a]/40 backdrop-blur-2xl">
          <div className="mb-10 text-center">
            <h2 className="text-xl md:text-2xl font-black text-white uppercase tracking-widest">Akses Admin</h2>
            <div className="w-12 h-1 bg-cyan-500 mx-auto mt-3 rounded-full"></div>
            <p className="text-[10px] md:text-xs text-slate-500 font-bold uppercase tracking-widest mt-4">Masukkan kredensial khusus petugas</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                ID Petugas / No. HP
              </label>
              <input 
                name="identifier" 
                required 
                type="text"
                value={formData.identifier} 
                onChange={handleChange} 
                className="w-full px-5 py-3.5 rounded-2xl bg-white/5 border border-white/10 text-white focus:ring-2 focus:ring-cyan-500 font-bold outline-none shadow-inner" 
                placeholder="Masukkan ID..." 
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                Password
              </label>
              <input 
                name="password" 
                type="password" 
                required 
                value={formData.password} 
                onChange={handleChange} 
                className="w-full px-5 py-3.5 rounded-2xl bg-white/5 border border-white/10 text-white focus:ring-2 focus:ring-cyan-500 font-bold outline-none shadow-inner" 
                placeholder="••••••••" 
              />
            </div>

            {error && <p className="text-xs text-red-400 font-bold bg-red-900/20 border border-red-900/30 p-3 rounded-xl text-center">{error}</p>}

            <button 
              disabled={isSubmitting}
              className="w-full py-4 bg-cosmic-gradient text-white font-black rounded-2xl shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3 mt-6"
            >
              {isSubmitting ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                'Masuk Sistem'
              )}
            </button>
          </form>

          <p className="mt-10 text-center text-[8px] font-bold text-slate-500 uppercase tracking-[0.3em]">
            {CARD_CONFIG.copyrightText || '© 2026 TOKATA DIGITAL KOPERASI'}
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
