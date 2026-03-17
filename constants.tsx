
/// <reference types="vite/client" />

import React from 'react';
import { 
  Home, 
  Users, 
  TrendingUp, 
  Wallet, 
  FileText, 
  Settings, 
  LogOut,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle,
  Clock,
  MapPin,
  Camera,
  Search,
  PieChart,
  UserCheck
} from 'lucide-react';

export const API_URL = "https://script.google.com/macros/s/AKfycbwRvcXUI1GVEo-Uc83Y_8eizho-LWPlsHXmcsA_tg2JAspUl9LBF5Sdak3MpiQduajt2g/exec";

export const callApi = async (action: string, payload: any) => {
  console.log(`[API Call] Action: ${action}`);
  
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action, payload }),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log(`[API Success] Action: ${action}`);
    return data;
  } catch (error: any) {
    console.error("[API Error]:", error);
    return { 
      success: false, 
      message: "Gagal terhubung ke server. Pastikan koneksi internet aktif dan server berjalan."
    };
  }
};

export const ICONS = {
  Home: <Home size={20} />,
  Users: <Users size={20} />,
  Stats: <TrendingUp size={20} />,
  Wallet: <Wallet size={20} />,
  Doc: <FileText size={20} />,
  Settings: <Settings size={20} />,
  Logout: <LogOut size={20} />,
  Plus: <Plus size={20} />,
  Income: <ArrowUpRight size={20} className="text-green-500" />,
  Expense: <ArrowDownRight size={20} className="text-red-500" />,
  Success: <CheckCircle size={20} className="text-green-500" />,
  Pending: <Clock size={20} className="text-yellow-500" />,
  Map: <MapPin size={16} />,
  Camera: <Camera size={18} />,
  Search: <Search size={18} />,
  Chart: <PieChart size={20} />,
  Verify: <UserCheck size={20} />
};

export const COLORS = {
  primary: '#7c3aed', // Purple 600
  secondary: '#2563eb', // Blue 600
  success: '#10b981', // Emerald 500
  danger: '#ef4444', // Red 500
  warning: '#f59e0b', // Amber 500
};
