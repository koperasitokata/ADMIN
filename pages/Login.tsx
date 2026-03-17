
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
    <div className="min-h-screen flex flex-col">
      <div className="bg-cosmic-gradient pt-16 pb-12 px-8 rounded-b-[3.5rem] shadow-2xl relative overflow-hidden">
        {CARD_CONFIG.loginBackground && (
          <img 
            src={CARD_CONFIG.loginBackground} 
            alt="Background" 
            className="absolute inset-0 w-full h-full object-cover opacity-60"
            referrerPolicy="no-referrer"
          />
        )}
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl"></div>
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full -ml-8 -mb-8 blur-2xl"></div>
        <div className="relative z-10 flex flex-col items-center">
          <div className="mb-4 flex items-center justify-center overflow-hidden" style={{ width: CARD_CONFIG.loginLogoSize, height: CARD_CONFIG.loginLogoSize }}>
            {CARD_CONFIG.loginLogo ? (
              <img 
                src={CARD_CONFIG.loginLogo} 
                alt="Logo" 
                className="w-full h-full object-contain"
                referrerPolicy="no-referrer"
              />
            ) : (
              <span className="text-3xl font-black tracking-tighter text-white">TK</span>
            )}
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">{CARD_CONFIG.loginTitle || 'TOKATA DIGITAL'}</h1>
          <p className="text-cyan-200 text-[10px] font-black uppercase tracking-[0.3em] opacity-80">{CARD_CONFIG.loginSubtitle || 'KOPERASI MODERN'}</p>
        </div>
      </div>

      <div className="px-8 -mt-6 flex-1">
        <div className="glass-cosmic rounded-[2.5rem] shadow-2xl p-6 border border-white/10">
          <div className="mb-6 text-center">
            <h2 className="text-lg font-black text-white uppercase tracking-widest">Login Admin</h2>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Silahkan masuk ke akun Anda</p>
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
        </div>
      </div>

      <p className="py-8 text-center text-[10px] font-bold text-slate-500 uppercase tracking-[0.3em]">
        {CARD_CONFIG.copyrightText || '© 2026 TOKATA DIGITAL KOPERASI'}
      </p>
    </div>
  );
};

export default Login;
