
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Petugas, PengajuanPinjaman, PinjamanAktif, Nasabah } from '../types';
import { ICONS, callApi } from '../constants';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { Search, Loader2, Calendar, User, Users, Save, Edit, Edit3, X, Database, PlusCircle, ShieldCheck, ArrowDownRight, ArrowUpRight, Image as ImageIcon, CheckCircle2, LogOut, RefreshCcw, ChevronRight, Settings, MapPin, CreditCard, Clock, Banknote, ClipboardCheck, FileText, Download, Palette, Check } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
import { toPng } from 'html-to-image';
import { AppActions } from '../utils/actions';
import { generateLoanSchedule, toDate } from '../utils/loanLogic';
import { compressImage, fileToBase64 } from '../utils/imageUtils';
import { CARD_CONFIG } from '../cardConfig';

import { useSearchParams } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';

// Fix Leaflet default icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface AdminDashboardProps {
  user: Petugas;
  onLogout: () => void;
}

const cleanNum = (val: any) => {
  if (val === null || val === undefined || val === "") return 0;
  if (typeof val === 'number') return val;
  const cleaned = String(val).replace(/[^0-9.-]/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
};

const MONTHS_ID = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

const AdminDashboard: React.FC<AdminDashboardProps> = ({ user, onLogout }) => {
  const [searchParams] = useSearchParams();
  const activeTab = searchParams.get('v') || 'home';
  const [pengajuan, setPengajuan] = useState<PengajuanPinjaman[]>([]);
  const [nasabahList, setNasabahList] = useState<Nasabah[]>([]);
  const [petugasList, setPetugasList] = useState<Petugas[]>([]);
  const [allLoans, setAllLoans] = useState<PinjamanAktif[]>([]);
  const [mutasiList, setMutasiList] = useState<any[]>([]);
  const [selectedNasabah, setSelectedNasabah] = useState<Nasabah | null>(null);
  const [memberDetailData, setMemberDetailData] = useState<{ simpanan: any[], pinjaman: any[], angsuran: any[] } | null>(null);
  const [selectedReceipt, setSelectedReceipt] = useState<any | null>(null);
  const [fullPhotoUrl, setFullPhotoUrl] = useState<string | null>(null);
  const [activeLoanId, setActiveLoanId] = useState<string | null>(null);
  const [showReportDateModal, setShowReportDateModal] = useState(false);
  const [showMonthlyReportModal, setShowMonthlyReportModal] = useState(false);
  const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0]);
  const [reportMonth, setReportMonth] = useState(new Date().getMonth());
  const [reportYear, setReportYear] = useState(new Date().getFullYear());
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [monthlyPdfPreviewUrl, setMonthlyPdfPreviewUrl] = useState<string | null>(null);
  const [numPages, setNumPages] = useState<number | null>(null);
  const [numMonthlyPages, setNumMonthlyPages] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchPetugasTerm, setSearchPetugasTerm] = useState("");
  const [selectedTransaction, setSelectedTransaction] = useState<any | null>(null);
  const [stats, setStats] = useState({
    totalModal: 0,
    totalPinjaman: 0,
    totalPengeluaran: 0,
    totalPemasukan: 0,
    totalSimpanan: 0,
    totalAngsuran: 0,
    totalPinjamanCair: 0,
    totalHutang: 0,
    totalModalTersalur: 0,
    activeMembers: 0
  });

  const saldoKas = useMemo(() => {
    // Formula: Modal Awal + Pemasukan + Simpanan + Angsuran - Pinjaman Cair - Pengeluaran
    return stats.totalModal + stats.totalPemasukan + stats.totalSimpanan + stats.totalAngsuran - stats.totalPinjamanCair - stats.totalPengeluaran;
  }, [stats]);

  const [showExplanation, setShowExplanation] = useState(false);
  const [showSaldoExplanation, setShowSaldoExplanation] = useState(false);
  const [showValidationView, setShowValidationView] = useState(false);
  const [selectedCollectorForDetail, setSelectedCollectorForDetail] = useState<string | null>(null);
  const [viewingMonth, setViewingMonth] = useState(new Date().getMonth());
  const [viewingYear, setViewingYear] = useState(new Date().getFullYear());
  const [validationList, setValidationList] = useState<any[]>([]);
  const [chartOffset, setChartOffset] = useState(0);

  const uniqueCollectorValidations = useMemo(() => {
    const map = new Map();
    validationList
      .sort((a, b) => new Date(a.tanggal).getTime() - new Date(b.tanggal).getTime())
      .forEach(val => {
        const collectorId = val.id_petugas;
        const collectorValidations = validationList.filter(v => v.id_petugas === collectorId);
        const totalMinus = collectorValidations
          .filter(v => Number(v.selisih) < 0 && v.status_penyelesaian === 'Belum Selesai')
          .reduce((acc, cur) => acc + Math.abs(Number(cur.selisih)), 0);
        
        map.set(collectorId, {
          ...val,
          totalMinus,
          count: collectorValidations.length
        });
      });
    return Array.from(map.values()).sort((a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime());
  }, [validationList]);

  const [isAddingValidation, setIsAddingValidation] = useState(false);
  const [validationForm, setValidationForm] = useState({
    id_petugas: '',
    nama_kolektor: '',
    total_tagihan_sistem: 0,
    total_setoran_fisik: 0,
    keterangan_admin: '',
    status_penyelesaian: 'Belum Selesai',
    bukti_foto: '',
    tanggal: new Date().toISOString().split('T')[0]
  });

  const [editingMember, setEditingMember] = useState<Nasabah | null>(null);
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [editingPetugas, setEditingPetugas] = useState<Petugas | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [settingsPage, setSettingsPage] = useState<string | null>(null);
  const [adminLocation, setAdminLocation] = useState<[number, number] | null>(null);
  const [adminPhoto, setAdminPhoto] = useState<string | null>(user.foto || null);
  const adminPhotoInputRef = useRef<HTMLInputElement>(null);

  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showMemberCard, setShowMemberCard] = useState(false);
  const memberCardRef = useRef<HTMLDivElement>(null);
  const [expenseData, setExpenseData] = useState({ jenis: 'Gaji', keterangan: '', jumlah: '' });
  const [fotoExpense, setFotoExpense] = useState<string | null>(null);
  const expenseFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (activeTab === 'maps' && !adminLocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setAdminLocation([position.coords.latitude, position.coords.longitude]);
        },
        (error) => {
          console.error("Error getting location:", error);
        }
      );
    }
  }, [activeTab, adminLocation]);

  const generateDailyReportPDF = useCallback(async () => {
    setIsGeneratingReport(true);
    try {
      // Fetch latest validation data directly from API to ensure data is up to date
      const valRes = await callApi('GET_VALIDASI_SETORAN', {});
      const latestValidationList = valRes.success ? (valRes.data || []) : validationList;
      
      // Sync local state
      if (valRes.success) setValidationList(latestValidationList);

      const doc = new jsPDF();
      const selectedDateStr = reportDate;
      const formattedDate = new Date(selectedDateStr).toLocaleDateString('id-ID', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });

      // Header
      doc.setFontSize(18);
      doc.setTextColor(40);
      doc.text("LAPORAN HARIAN KOPERASI TOKATA", 105, 15, { align: 'center' });
      doc.setFontSize(12);
      doc.text(formattedDate, 105, 22, { align: 'center' });
      doc.setLineWidth(0.5);
      doc.line(20, 25, 190, 25);

      // 1. MUTASI HARIAN
      doc.setFontSize(14);
      doc.text("1. Mutasi Harian (Pemasukan & Pengeluaran)", 20, 35);
      doc.setFontSize(9);
      doc.setTextColor(100);
      doc.text("Daftar seluruh arus kas masuk (Angsuran, Simpanan, Modal) dan kas keluar (Pencairan, Pengeluaran) pada hari ini.", 20, 40);
      doc.setTextColor(40);
      
      const dailyMutations = mutasiList.filter(m => {
        const mDate = new Date(m.tanggal || m.tanggal_acc || m.tanggal_cair).toISOString().split('T')[0];
        return mDate === selectedDateStr;
      });

      const mutationData = dailyMutations.map(m => [
        new Date(m.tanggal || m.tanggal_acc || m.tanggal_cair).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        m.tipe || '-',
        m.ket || m.keterangan || '-',
        `Rp ${cleanNum(m.nominal || m.jumlah || m.jumlah_bayar).toLocaleString('id-ID')}`
      ]);

      autoTable(doc, {
        startY: 45,
        head: [['Waktu', 'Tipe', 'Keterangan', 'Nominal']],
        body: mutationData.length > 0 ? mutationData : [['-', 'Tidak ada mutasi', '-', '-']],
        theme: 'striped',
        headStyles: { fillColor: [124, 58, 237] } // Violet 600
      });

      // 2. TARGET HARIAN (Jadwal Tagihan)
      let currentY = (doc as any).lastAutoTable.finalY + 15;
      doc.setFontSize(14);
      doc.text("2. Target Tagihan Harian", 20, currentY);
      doc.setFontSize(9);
      doc.setTextColor(100);
      doc.text("Daftar nasabah yang memiliki jadwal pembayaran angsuran pada hari ini berdasarkan tenor pinjaman.", 20, currentY + 5);
      doc.setTextColor(40);
      
      const dailyTargets: any[] = [];
      allLoans.filter(l => l.status === 'Aktif').forEach(loan => {
        const schedule = generateLoanSchedule(loan.tanggal_cair || loan.tanggal_acc, loan.tenor);
        schedule.forEach((date, idx) => {
          const sDate = new Date(date).toISOString().split('T')[0];
          if (sDate === selectedDateStr) {
            dailyTargets.push([
              loan.id_pinjaman,
              loan.nama,
              `Hari ke-${idx + 1}`,
              `Rp ${cleanNum(loan.cicilan).toLocaleString('id-ID')}`
            ]);
          }
        });
      });

      autoTable(doc, {
        startY: currentY + 10,
        head: [['ID Pinjam', 'Nama Nasabah', 'Keterangan', 'Tagihan']],
        body: dailyTargets.length > 0 ? dailyTargets : [['-', 'Tidak ada target tagihan', '-', '-']],
        theme: 'grid',
        headStyles: { fillColor: [37, 99, 235] } // Blue 600
      });

      // 3. TRANSPORT HARIAN
      currentY = (doc as any).lastAutoTable.finalY + 15;
      doc.setFontSize(14);
      doc.text("3. Klaim Transport Kolektor", 20, currentY);
      doc.setFontSize(9);
      doc.setTextColor(100);
      doc.text("Catatan pengambilan uang transport harian oleh kolektor untuk operasional lapangan.", 20, currentY + 5);
      doc.setTextColor(40);
      
      const transportClaims = dailyMutations.filter(m => m.jenis === 'Uang Transport' || (m.ket && m.ket.toLowerCase().includes('transport')));
      const transportData = transportClaims.map(m => [
        m.petugas || '-',
        m.ket || '-',
        `Rp ${cleanNum(m.nominal || m.jumlah).toLocaleString('id-ID')}`
      ]);

      autoTable(doc, {
        startY: currentY + 10,
        head: [['Nama Kolektor', 'Keterangan', 'Nominal']],
        body: transportData.length > 0 ? transportData : [['-', 'Tidak ada klaim transport', '-']],
        theme: 'plain',
        headStyles: { fillColor: [16, 185, 129] } // Emerald 500
      });

      // 4. VALIDASI SETORAN
      currentY = (doc as any).lastAutoTable.finalY + 15;
      doc.setFontSize(14);
      doc.text("4. Validasi Setoran Kolektor", 20, currentY);
      doc.setFontSize(9);
      doc.setTextColor(100);
      doc.text("Hasil verifikasi antara total tagihan di sistem dengan uang tunai yang disetorkan oleh kolektor.", 20, currentY + 5);
      doc.setTextColor(40);
      
      const dailyValidations = latestValidationList.filter((v: any) => {
        const vDate = new Date(v.tanggal).toISOString().split('T')[0];
        return vDate === selectedDateStr;
      });

      const validationData = dailyValidations.map((v: any) => {
        const selisih = cleanNum(v.selisih);
        let displayStatus = v.status_penyelesaian || '-';
        
        // Logic: If selisih is 0 (Sesuai), show "Sesuai / Aman". 
        // Otherwise show the actual settlement status.
        if (selisih === 0) {
          displayStatus = "Sesuai / Aman";
        }

        return [
          v.nama_kolektor || '-',
          `Rp ${cleanNum(v.total_tagihan_sistem).toLocaleString('id-ID')}`,
          `Rp ${cleanNum(v.total_setoran_fisik).toLocaleString('id-ID')}`,
          `Rp ${selisih.toLocaleString('id-ID')}`,
          displayStatus
        ];
      });

      autoTable(doc, {
        startY: currentY + 10,
        head: [['Kolektor', 'Tagihan Sistem', 'Setoran Fisik', 'Selisih', 'Status']],
        body: validationData.length > 0 ? validationData : [['-', '-', '-', '-', 'Tidak ada data validasi']],
        theme: 'striped',
        headStyles: { fillColor: [245, 158, 11] }, // Amber 500
        didDrawCell: (data) => {
          // Selisih column is index 3
          if (data.section === 'body' && data.column.index === 3) {
            const cellText = data.cell.text[0];
            if (cellText.includes('-')) {
              doc.setTextColor(220, 38, 38); // Red
            }
          }
        }
      });

      // Summary
      currentY = (doc as any).lastAutoTable.finalY + 15;
      if (currentY > 230) {
        doc.addPage();
        currentY = 20;
      }
      
      const totalIncome = dailyMutations.filter(m => ['Angsuran', 'Simpanan', 'Setoran Modal', 'Pemasukan'].includes(m.tipe)).reduce((acc: number, cur) => acc + cleanNum(cur.nominal || cur.jumlah || cur.jumlah_bayar), 0);
      const totalPhysicalDeposit = dailyValidations.reduce((acc: number, cur: any) => acc + cleanNum(cur.total_setoran_fisik), 0);
      const selisihKas = totalPhysicalDeposit - totalIncome;
      
      doc.setDrawColor(200);
      doc.setLineWidth(0.1);
      doc.rect(20, currentY - 5, 170, 45);

      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(40, 40, 40);
      doc.text("RINGKASAN KAS HARIAN:", 25, currentY + 5);
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(`Total Pemasukan (Sistem):`, 25, currentY + 15);
      doc.text(`Rp ${totalIncome.toLocaleString('id-ID')}`, 185, currentY + 15, { align: 'right' });
      
      doc.text(`Total Setoran Fisik (Kolektor):`, 25, currentY + 22);
      doc.text(`Rp ${totalPhysicalDeposit.toLocaleString('id-ID')}`, 185, currentY + 22, { align: 'right' });
      
      doc.text(`Selisih Kas:`, 25, currentY + 29);
      if (selisihKas < 0) {
        doc.setTextColor(220, 38, 38); // Red for negative
      } else if (selisihKas > 0) {
        doc.setTextColor(16, 185, 129); // Emerald for positive
      } else {
        doc.setTextColor(40, 40, 40);
      }
      doc.text(`${selisihKas < 0 ? '-' : ''} Rp ${Math.abs(selisihKas).toLocaleString('id-ID')}`, 185, currentY + 29, { align: 'right' });
      
      doc.setTextColor(40, 40, 40); // Reset color
      doc.line(25, currentY + 32, 185, currentY + 32);
      
      doc.setFont("helvetica", "bold");
      doc.text(`Saldo Akhir (Kas Fisik):`, 25, currentY + 38);
      doc.text(`Rp ${totalPhysicalDeposit.toLocaleString('id-ID')}`, 185, currentY + 38, { align: 'right' });

      doc.setTextColor(40, 40, 40); // Final reset


      // Footer
      const pageCount = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(`Dicetak pada: ${new Date().toLocaleString('id-ID')} | Halaman ${i} dari ${pageCount}`, 105, 285, { align: 'center' });
      }

      const blob = doc.output('blob');
      const url = URL.createObjectURL(blob);
      setPdfPreviewUrl(url);
      setShowReportDateModal(false);
    } catch (err) {
      console.error("PDF Generation Error:", err);
      alert("Gagal membuat PDF. Silakan coba lagi.");
    } finally {
      setIsGeneratingReport(false);
    }
  }, [reportDate, mutasiList, allLoans, validationList]);

  const generateMonthlyReportPDF = useCallback(async () => {
    setIsGeneratingReport(true);
    try {
      const doc = new jsPDF();
      const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
      const formattedMonth = `${monthNames[reportMonth]} ${reportYear}`;

      // Header
      doc.setFontSize(18);
      doc.setTextColor(40);
      doc.text("LAPORAN BULANAN KOPERASI TOKATA", 105, 15, { align: 'center' });
      doc.setFontSize(12);
      doc.text(formattedMonth, 105, 22, { align: 'center' });
      doc.setLineWidth(0.5);
      doc.line(20, 25, 190, 25);

      // Filter data for the selected month
      const monthlyMutations = mutasiList.filter(m => {
        const date = new Date(m.tanggal || m.tanggal_acc || m.tanggal_cair);
        return date.getMonth() === reportMonth && date.getFullYear() === reportYear;
      });

      // 1. RINGKASAN TRANSAKSI BULANAN
      doc.setFontSize(14);
      doc.text("1. Ringkasan Transaksi Bulanan", 20, 35);
      
      // Modal Awal is persistent (global total)
      const modalAwalGlobal = stats.totalModal;
      const pinjamanCair = monthlyMutations.filter(m => m.tipe === 'Pencairan').reduce((acc, cur) => acc + cleanNum(cur.nominal || cur.jumlah), 0);
      const angsuranMasuk = monthlyMutations.filter(m => m.tipe === 'Angsuran').reduce((acc, cur) => acc + cleanNum(cur.nominal || cur.jumlah_bayar), 0);
      
      // Simpanan Details
      const simpananMasuk = monthlyMutations.filter(m => m.tipe === 'Simpanan').reduce((acc, cur) => acc + cleanNum(cur.nominal || cur.jumlah || cur.setor), 0);
      const simpananKeluar = monthlyMutations.filter(m => m.tipe === 'Tarik Simpanan').reduce((acc, cur) => acc + cleanNum(cur.nominal || cur.jumlah || cur.tarik), 0);
      const simpananBersih = simpananMasuk - simpananKeluar;

      // Exclude "Cair Simpanan" from pengeluaran sum to avoid double counting in the summary (since it's already in simpananKeluar)
      const pengeluaran = monthlyMutations
        .filter(m => (m.tipe === 'Pengeluaran' || m.jenis === 'Uang Transport') && !m.ket.toLowerCase().includes('cair simpanan'))
        .reduce((acc, cur) => acc + cleanNum(cur.nominal || cur.jumlah), 0);
        
      const adminFees = monthlyMutations.filter(m => m.ket && m.ket.includes('Admin')).reduce((acc, cur) => acc + cleanNum(cur.nominal || cur.jumlah), 0);

      // Detailed Expenses Breakdown (Keep "Cair Simpanan" here for transparency if desired, or exclude it)
      const expenseBreakdownMap = new Map<string, number>();
      monthlyMutations
        .filter(m => (m.tipe === 'Pengeluaran' || m.jenis === 'Uang Transport') && !m.ket.toLowerCase().includes('cair simpanan'))
        .forEach(m => {
          const category = m.jenis || (m.tipe === 'Pengeluaran' ? 'Operasional' : 'Lain-lain');
          const current = expenseBreakdownMap.get(category) || 0;
          expenseBreakdownMap.set(category, current + cleanNum(m.nominal || m.jumlah));
        });
      
      const expenseBreakdownData = Array.from(expenseBreakdownMap.entries()).map(([cat, val]) => [cat, `Rp ${val.toLocaleString('id-ID')}`]);

      const summaryData = [
        ["Modal Awal (Total Akumulasi)", `Rp ${modalAwalGlobal.toLocaleString('id-ID')}`],
        ["Total Pinjaman Dicairkan", `Rp ${pinjamanCair.toLocaleString('id-ID')}`],
        ["Total Angsuran Diterima", `Rp ${angsuranMasuk.toLocaleString('id-ID')}`],
        ["Total Simpanan Masuk", `Rp ${simpananMasuk.toLocaleString('id-ID')}`],
        ["Total Simpanan Ditarik", `Rp ${simpananKeluar.toLocaleString('id-ID')}`],
        ["Total Simpanan Bersih", `Rp ${simpananBersih.toLocaleString('id-ID')}`],
        ["Total Pengeluaran & Transport", `Rp ${pengeluaran.toLocaleString('id-ID')}`],
      ];

      autoTable(doc, {
        startY: 40,
        head: [['Kategori', 'Total Nominal']],
        body: summaryData,
        theme: 'grid',
        headStyles: { fillColor: [30, 41, 59] }
      });

      // 2. STATUS MODAL TERSALUR (MATCH DASHBOARD)
      let currentY = (doc as any).lastAutoTable.finalY + 15;
      doc.setFontSize(14);
      doc.text("2. Rincian Modal Tersalur (Total Kekayaan)", 20, currentY);
      
      const tersalurData = [
        ["(+) Modal Awal", `Rp ${stats.totalModal.toLocaleString('id-ID')}`],
        ["(-) Semua Pinjaman (Pokok)", `Rp ${stats.totalPinjamanCair.toLocaleString('id-ID')}`],
        ["(+) Total Pengembalian (Pokok+Bunga)", `Rp ${stats.totalHutang.toLocaleString('id-ID')}`],
        ["(+) Total Pemasukan (Admin)", `Rp ${stats.totalPemasukan.toLocaleString('id-ID')}`],
        ["(+) Simpanan Bersih", `Rp ${stats.totalSimpanan.toLocaleString('id-ID')}`],
        ["(-) Total Pengeluaran", `Rp ${stats.totalPengeluaran.toLocaleString('id-ID')}`],
        ["TOTAL MODAL TERSALUR", `Rp ${stats.totalModalTersalur.toLocaleString('id-ID')}`],
      ];

      autoTable(doc, {
        startY: currentY + 5,
        head: [['Deskripsi Perhitungan', 'Nilai']],
        body: tersalurData,
        theme: 'grid',
        headStyles: { fillColor: [79, 70, 229] },
        didDrawCell: (data) => {
          if (data.section === 'body' && data.row.index === 6) {
            doc.setFont("helvetica", "bold");
          }
        }
      });

      doc.setFontSize(8);
      doc.setTextColor(100);
      doc.text("*Modal Tersalur adalah gambaran seluruh kekayaan koperasi yang sedang berputar (mencakup modal, piutang, simpanan, dan laba).", 20, (doc as any).lastAutoTable.finalY + 5);
      doc.setTextColor(40);

      // 3. RINCIAN SALDO KAS (MATCH DASHBOARD)
      currentY = (doc as any).lastAutoTable.finalY + 15;
      if (currentY > 230) {
        doc.addPage();
        currentY = 20;
      }
      doc.setFontSize(14);
      doc.text("3. Rincian Saldo Kas (Uang Tunai)", 20, currentY);

      const cashBreakdown = [
        ["(+) Modal Awal", `Rp ${stats.totalModal.toLocaleString('id-ID')}`],
        ["(+) Total Pemasukan (Admin)", `Rp ${stats.totalPemasukan.toLocaleString('id-ID')}`],
        ["(+) Total Simpanan Bersih", `Rp ${stats.totalSimpanan.toLocaleString('id-ID')}`],
        ["(+) Total Angsuran Masuk", `Rp ${stats.totalAngsuran.toLocaleString('id-ID')}`],
        ["(-) Total Pinjaman Cair", `Rp ${stats.totalPinjamanCair.toLocaleString('id-ID')}`],
        ["(-) Total Pengeluaran", `Rp ${stats.totalPengeluaran.toLocaleString('id-ID')}`],
        ["SALDO KAS SAAT INI", `Rp ${saldoKas.toLocaleString('id-ID')}`],
      ];

      autoTable(doc, {
        startY: currentY + 5,
        head: [['Keterangan Arus Kas', 'Nominal']],
        body: cashBreakdown,
        theme: 'grid',
        headStyles: { fillColor: [245, 158, 11] },
        didDrawCell: (data) => {
          if (data.section === 'body' && data.row.index === 6) {
            doc.setFont("helvetica", "bold");
          }
        }
      });

      doc.setFontSize(8);
      doc.setTextColor(100);
      doc.text("*Saldo Kas adalah dana tunai yang seharusnya ada di tangan/kas koperasi saat ini.", 20, (doc as any).lastAutoTable.finalY + 5);
      doc.setTextColor(40);

      // 4. ANALISIS LABA / RUGI
      currentY = (doc as any).lastAutoTable.finalY + 15;
      if (currentY > 250) {
        doc.addPage();
        currentY = 20;
      }
      doc.setFontSize(14);
      doc.text("4. Analisis Laba / Rugi (Estimasi)", 20, currentY);
      
      const pendapatan = angsuranMasuk + adminFees;
      const beban = pengeluaran;
      const labaBersih = pendapatan - beban;

      const profitData = [
        ["Total Pendapatan (Angsuran + Admin)", `Rp ${pendapatan.toLocaleString('id-ID')}`],
        ["Total Beban (Operasional + Transport)", `Rp ${beban.toLocaleString('id-ID')}`],
        ["Laba / Rugi Bersih Bulan Ini", `Rp ${labaBersih.toLocaleString('id-ID')}`]
      ];

      autoTable(doc, {
        startY: currentY + 5,
        head: [['Deskripsi', 'Nilai']],
        body: profitData,
        theme: 'striped',
        headStyles: { fillColor: labaBersih >= 0 ? [16, 185, 129] : [220, 38, 38] },
        didDrawCell: (data) => {
          if (data.section === 'body' && data.row.index === 2 && data.column.index === 1) {
            if (labaBersih < 0) doc.setTextColor(220, 38, 38);
            else doc.setTextColor(16, 185, 129);
          }
        }
      });

      // 5. RINCIAN PENGELUARAN
      if (expenseBreakdownData.length > 0) {
        currentY = (doc as any).lastAutoTable.finalY + 15;
        if (currentY > 250) {
          doc.addPage();
          currentY = 20;
        }
        doc.setFontSize(14);
        doc.text("5. Rincian Pengeluaran Bulanan", 20, currentY);

        autoTable(doc, {
          startY: currentY + 5,
          head: [['Kategori Pengeluaran', 'Total Nominal']],
          body: expenseBreakdownData,
          theme: 'grid',
          headStyles: { fillColor: [239, 68, 68] }
        });
      }

      // Footer
      const pageCount = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(`Dicetak pada: ${new Date().toLocaleString('id-ID')} | Halaman ${i} dari ${pageCount}`, 105, 285, { align: 'center' });
      }

      const blob = doc.output('blob');
      const url = URL.createObjectURL(blob);
      setMonthlyPdfPreviewUrl(url);
      setShowMonthlyReportModal(false);
    } catch (error) {
      console.error("Monthly PDF Error:", error);
      alert("Gagal membuat laporan bulanan");
    } finally {
      setIsGeneratingReport(false);
    }
  }, [reportMonth, reportYear, mutasiList, stats, saldoKas]);

  const fetchValidationData = useCallback(async () => {
    try {
      const res = await callApi('GET_VALIDASI_SETORAN', {});
      if (res.success) {
        setValidationList(res.data || []);
      }
    } catch (err) {
      console.error("Fetch Validation Error:", err);
    }
  }, []);

  const handleSaveValidation = async (e: React.FormEvent) => {
    e.preventDefault();
    setProcessingId('save-validation');

    // Check for duplicates
    const isDuplicate = validationList.some(v => {
      const vDate = new Date(v.tanggal).toISOString().split('T')[0];
      return v.id_petugas === validationForm.id_petugas && vDate === validationForm.tanggal;
    });

    if (isDuplicate) {
      alert(`Kolektor ini sudah divalidasi untuk tanggal ${validationForm.tanggal}. Harap cek riwayat atau pilih tanggal lain.`);
      setProcessingId(null);
      return;
    }

    try {
      const selisih = Number(validationForm.total_setoran_fisik) - Number(validationForm.total_tagihan_sistem);
      const status_validasi = selisih === 0 ? 'Sesuai' : selisih < 0 ? 'Kurang' : 'Lebih';
      
      const payload = {
        tanggal: new Date(validationForm.tanggal).toISOString(),
        id_petugas: validationForm.id_petugas,
        nama_kolektor: validationForm.nama_kolektor,
        total_tagihan_sistem: validationForm.total_tagihan_sistem,
        total_setoran_fisik: validationForm.total_setoran_fisik,
        selisih,
        status_validasi,
        keterangan_admin: validationForm.keterangan_admin,
        status_penyelesaian: validationForm.status_penyelesaian,
        bukti_foto: validationForm.bukti_foto
      };

      const res = await callApi('UPDATE_VALIDASI_SETORAN', payload);
      if (res.success) {
        alert('Validasi setoran berhasil disimpan!');
        setValidationForm({
          id_petugas: '',
          nama_kolektor: '',
          total_tagihan_sistem: 0,
          total_setoran_fisik: 0,
          keterangan_admin: '',
          status_penyelesaian: 'Belum Selesai',
          bukti_foto: '',
          tanggal: new Date().toISOString().split('T')[0]
        });
        setIsAddingValidation(false);
        fetchValidationData();
      } else {
        alert('Gagal: ' + res.message);
      }
    } catch (err) {
      alert('Terjadi kesalahan saat menyimpan validasi.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleUpdateValidationStatus = async (val: any, newStatus: string) => {
    setProcessingId('update-status-' + val.id);
    try {
      const res = await callApi('UPDATE_VALIDASI_SETORAN', {
        id: val.id,
        tanggal: val.tanggal,
        id_petugas: val.id_petugas,
        nama_kolektor: val.nama_kolektor,
        total_tagihan_sistem: val.total_tagihan_sistem,
        total_setoran_fisik: val.total_setoran_fisik,
        selisih: val.selisih,
        status_validasi: val.status_validasi,
        keterangan_admin: val.keterangan_admin,
        status_penyelesaian: newStatus,
        bukti_foto: val.bukti_foto
      });
      if (res.success) {
        fetchValidationData();
      }
    } catch (err) {
      console.error("Update Status Error:", err);
    } finally {
      setProcessingId(null);
    }
  };

  const calculateTodayTagihan = useCallback((petugasId: string, targetDateStr?: string) => {
    const collector = petugasList.find(p => p.id_petugas === petugasId);
    const collectorName = collector?.nama || '';
    
    // Robust date comparison using YYYY-MM-DD strings to avoid timezone issues
    const getYYYYMMDD = (date: Date) => {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    };

    const targetDateStrNormalized = targetDateStr || getYYYYMMDD(new Date());
    
    const isTargetDate = (d: Date) => {
      if (!d || isNaN(d.getTime())) return false;
      return getYYYYMMDD(d) === targetDateStrNormalized;
    };
    
    // Filter angsuran hari ini oleh petugas tertentu
    const total = mutasiList
      .filter(m => {
        const mDate = m.tanggal instanceof Date ? m.tanggal : toDate(m.tanggal);
        
        // Case-insensitive type check and inclusion of Simpanan mislabeled as Tarik Simpanan
        const tipe = String(m.tipe || '').toLowerCase();
        const isCollection = tipe === 'angsuran' || tipe === 'simpanan' || tipe === 'pemasukan' || 
                           (tipe === 'tarik simpanan' && cleanNum(m.setor) > 0);
        
        if (!isCollection) return false;
        if (!isTargetDate(mDate)) return false;

        // Match by ID or Name to be safe
        const mPetugasId = String(m.id_petugas || '').toLowerCase();
        const mPetugasName = String(m.petugas || m.kolektor || m.admin || '').toLowerCase();
        const mPetugasDisplay = String(m.petugas_display || '').toLowerCase();
        
        const targetId = petugasId.toLowerCase();
        const targetName = collectorName.toLowerCase();

        const petugasMatch = 
          mPetugasId === targetId ||
          mPetugasName === targetId ||
          mPetugasName === targetName ||
          mPetugasDisplay.includes(targetId) ||
          mPetugasDisplay.includes(targetName);

        return petugasMatch;
      })
      .reduce((acc, cur) => acc + Number(cur.nominal || 0), 0);
    
    return total;
  }, [mutasiList, petugasList]);

  useEffect(() => {
    if (validationForm.id_petugas) {
      const tagihan = calculateTodayTagihan(validationForm.id_petugas, validationForm.tanggal);
      if (tagihan !== validationForm.total_tagihan_sistem) {
        setValidationForm(prev => ({ ...prev, total_tagihan_sistem: tagihan }));
      }
    }
  }, [calculateTodayTagihan, validationForm.id_petugas, validationForm.total_tagihan_sistem, validationForm.tanggal]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const result = await callApi('GET_DASHBOARD_DATA', { role: 'ADMIN', id_user: user.id_petugas });
      if (result.success) {
        const rawPemasukan = result.data.pemasukan_list || result.data.pemasukan || [];
        const rawMutasi = result.data.mutasi || [];
        
        setNasabahList(result.data.nasabah_list || result.data.nasabah || []);
        setPetugasList(result.data.petugas_list || result.data.petugas || []);
        setAllLoans(result.data.all_loans || result.data.jadwal_global || result.data.pinjaman || []);
        
        // Sinkronisasi foto profil jika ada perubahan di Google Sheets
        const currentPetugas = (result.data.petugas_list || result.data.petugas || []).find((p: any) => p.id_petugas === user.id_petugas);
        const newPhoto = currentPetugas?.foto || null;
        if (newPhoto !== adminPhoto) {
          setAdminPhoto(newPhoto);
          const savedAuth = localStorage.getItem('koperasi_auth');
          if (savedAuth) {
            const auth = JSON.parse(savedAuth);
            auth.user.foto = newPhoto;
            localStorage.setItem('koperasi_auth', JSON.stringify(auth));
          }
        }

        setPengajuan(result.data.pengajuan_pending || result.data.pengajuan || []);
        setAllLoans(result.data.all_loans || result.data.jadwal_global || result.data.pinjaman || []);

        const normalize = (item: any, typeOverride?: string) => {
          let tipe = typeOverride || item.tipe || 'Transaksi';
          const nominal = cleanNum(item.nominal || item.jumlah || item.jumlah_bayar || item.setor || item.tarik || item.pokok || 0);
          
          let ket = item.ket || item.keterangan || "";
          
          // Better detection to avoid duplicates and correctly show Simpanan
          if (ket.toLowerCase().includes("simp wajib cair")) {
            ket = "Simpanan Wajib (Cair)";
            tipe = "Simpanan";
          } else if (ket.toLowerCase().includes("admin cair") || tipe.toLowerCase() === 'pemasukan') {
            ket = "Admin Cair 5%";
            tipe = "Pemasukan";
          }

          if (!ket) {
            ket = tipe === 'Pemasukan' ? 'Admin Cair 5%' : 'Transaksi';
          }

          // Fix for Simpanan mislabeled as Tarik Simpanan in paten script
          if (item.setor && cleanNum(item.setor) > 0) {
            tipe = 'Simpanan';
          }
          if (item.tarik && cleanNum(item.tarik) > 0) {
            tipe = 'Tarik Simpanan';
          }
          
          const rawDate = item.tanggal || item.tanggal_acc || item.tanggal_cair || item.tgl || item.date;
          return { 
            ...item, 
            tipe, 
            nominal, 
            ket, 
            tanggal: toDate(rawDate),
            petugas_display: item.petugas || item.kolektor || item.admin || 'System'
          };
        };

        const uniqueMap = new Map();
        
        // Use a more robust key to prevent data loss
        const getUniqueKey = (n: any) => `${n.tipe}-${n.tanggal.getTime()}-${n.nominal}-${n.ket}-${Math.random()}`;

        rawMutasi.forEach((m: any) => {
          const normalized = normalize(m);
          uniqueMap.set(getUniqueKey(normalized), normalized);
        });

        rawPemasukan.forEach((p: any) => {
          const normalized = normalize(p, 'Pemasukan');
          uniqueMap.set(getUniqueKey(normalized), normalized);
        });
        
        const combined = Array.from(uniqueMap.values());
        combined.sort((a, b) => b.tanggal.getTime() - a.tanggal.getTime());
        setMutasiList(combined);

        const totalIncome = combined
          .filter(m => m.tipe === 'Pemasukan')
          .reduce((acc, curr) => acc + curr.nominal, 0);

        const totalAngsuran = combined
          .filter(m => m.tipe === 'Angsuran')
          .reduce((acc, curr) => acc + curr.nominal, 0);

        // Calculate total pengeluaran excluding "Cair Simpanan" to avoid double counting with Simpanan Bersih
        const totalPengeluaran = combined
          .filter(m => (m.tipe === 'Pengeluaran' || m.jenis === 'Uang Transport') && !m.ket.toLowerCase().includes('cair simpanan'))
          .reduce((acc, curr) => acc + curr.nominal, 0);

        const allLoansData = result.data.all_loans || [];
        const totalPinjamanCair = allLoansData.reduce((acc: number, loan: any) => acc + cleanNum(loan.pokok), 0);
        const totalHutang = allLoansData.reduce((acc: number, loan: any) => acc + cleanNum(loan.total_hutang), 0);
        
        const simpananData = result.data.simpanan || [];
        const totalSimpanan = simpananData.reduce((acc: number, s: any) => acc + (cleanNum(s.setor) - cleanNum(s.tarik)), 0);

        const modalAwal = result.data.stats?.modal || 0;
        
        const totalModalTersalur = modalAwal - totalPinjamanCair + totalHutang + totalIncome + totalSimpanan - totalPengeluaran;

        setStats({
          totalModal: modalAwal,
          totalPinjaman: result.data.stats?.pinjaman_aktif || 0,
          totalPengeluaran: totalPengeluaran,
          totalPemasukan: totalIncome,
          totalSimpanan: totalSimpanan,
          totalAngsuran: totalAngsuran,
          totalPinjamanCair: totalPinjamanCair,
          totalHutang: totalHutang,
          totalModalTersalur: totalModalTersalur,
          activeMembers: result.data.stats?.total_nasabah || 0
        });
      } else {
        setFetchError(result.message || "Gagal mengambil data dari server.");
      }
    } catch (e: any) {
      console.error("Fetch data error:", e);
      setFetchError("Terjadi kesalahan jaringan atau server.");
    } finally {
      setLoading(false);
    }
  }, [user.id_petugas, adminPhoto]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (activeTab !== 'settings') {
      setSettingsPage(null);
    }
  }, [activeTab]);

  const fetchMemberDetail = (nasabah: Nasabah, specificLoanId?: string) => {
    setSelectedNasabah(nasabah);
    
    // Instant data from local state
    // Ensure unique loans by ID to prevent "mixing" or duplicates
    const uniqueLoansMap = new Map();
    allLoans
      .filter(l => String(l.id_nasabah) === String(nasabah.id_nasabah))
      .forEach(l => uniqueLoansMap.set(String(l.id_pinjaman), l));

    let userLoans = Array.from(uniqueLoansMap.values())
      .sort((a, b) => {
        const dateA = toDate(a.tanggal_cair || a.tanggal_acc || 0).getTime();
        const dateB = toDate(b.tanggal_cair || b.tanggal_acc || 0).getTime();
        return dateB - dateA; // Newest first
      });

    // If a specific loan ID is requested, filter to ONLY that loan
    if (specificLoanId) {
      userLoans = userLoans.filter(l => String(l.id_pinjaman) === String(specificLoanId));
    }

    const userSimpanan = mutasiList.filter(m => 
      String(m.id_nasabah) === String(nasabah.id_nasabah) && 
      (m.tipe === 'Simpanan' || m.tipe === 'Tarik Simpanan')
    );
    const userAngsuran = mutasiList.filter(m => 
      String(m.id_nasabah) === String(nasabah.id_nasabah) && 
      m.tipe === 'Angsuran'
    );
    
    setMemberDetailData({
      simpanan: userSimpanan,
      pinjaman: userLoans,
      angsuran: userAngsuran
    });

    if (userLoans.length > 0) {
      setActiveLoanId(userLoans[0].id_pinjaman);
    } else {
      setActiveLoanId(null);
    }
  };

  const handleApprove = async (id: string) => {
    setProcessingId(id);
    const result = await callApi('APPROVE_PINJAMAN', { id_pengajuan: id });
    if (result.success) {
      await fetchData();
    } else {
      alert('Gagal menyetujui: ' + result.message);
    }
    setProcessingId(null);
  };

  const handleSaveModal = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const keterangan = formData.get('keterangan') as string;
    const jumlah = Number(formData.get('jumlah'));

    if (!keterangan || !jumlah) return;

    setProcessingId('modal');
    try {
      const res = await callApi('INPUT_MODAL_AWAL', {
        keterangan,
        jumlah,
        admin: user.nama
      });

      if (res.success) {
        alert('Modal awal berhasil ditambahkan!');
        (e.target as HTMLFormElement).reset();
        await fetchData();
      } else {
        alert('Gagal: ' + res.message);
      }
    } catch (err) {
      alert('Koneksi bermasalah');
    } finally {
      setProcessingId(null);
    }
  };

  const handleUpdateMember = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingMember) return;
    
    setIsUpdating(true);
    const formData = new FormData(e.currentTarget);
    const stripQuote = (str: any) => str ? String(str).replace(/^'/, '') : '';
    const formatForSheet = (val: any) => {
      const clean = stripQuote(val);
      return clean ? "'" + clean : '';
    };

    const updatedData = {
      old_id: editingMember.id_nasabah,
      id_nasabah: formData.get('id_nasabah'),
      nik: formatForSheet(formData.get('nik')),
      nama: formData.get('nama'),
      no_hp: formatForSheet(formData.get('no_hp')),
      pin: formatForSheet(formData.get('pin'))
    };

    try {
      const res = await callApi('UPDATE_NASABAH', updatedData);
      if (res.success) {
        alert('Data nasabah berhasil diperbarui!');
        setEditingMember(null);
        setSettingsPage('members'); // Ensure we stay on members page
        await fetchData();
      } else {
        alert('Gagal memperbarui: ' + res.message);
      }
    } catch (err) {
      alert('Kesalahan jaringan');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleAddMember = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsUpdating(true);
    const formData = new FormData(e.currentTarget);
    const stripQuote = (str: any) => str ? String(str).replace(/^'/, '') : '';
    const formatForSheet = (val: any) => {
      const clean = stripQuote(val);
      return clean ? "'" + clean : '';
    };

    const newMember = {
      nik: formatForSheet(formData.get('nik')),
      nama: formData.get('nama'),
      no_hp: formData.get('no_hp') ? formatForSheet(formData.get('no_hp')) : '-',
      pin: formatForSheet(formData.get('pin')),
      latitude: 0,
      longitude: 0
    };

    try {
      const res = await callApi('REGISTER_NASABAH', newMember);
      if (res.success) {
        alert('Anggota baru berhasil ditambahkan!');
        setIsAddingMember(false);
        await fetchData();
      } else {
        alert('Gagal menambahkan: ' + res.message);
      }
    } catch (err) {
      alert('Kesalahan jaringan');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleUpdatePetugas = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingPetugas) return;
    
    setIsUpdating(true);
    const formData = new FormData(e.currentTarget);
    const updatedData = {
      old_id: editingPetugas.id_petugas,
      id_petugas: formData.get('id_petugas'),
      nama: formData.get('nama'),
      password: formData.get('password')
    };

    try {
      const res = await callApi('UPDATE_PETUGAS', updatedData);
      if (res.success) {
        alert('Data petugas berhasil diperbarui!');
        setEditingPetugas(null);
        await fetchData();
      } else {
        alert('Gagal memperbarui: ' + res.message);
      }
    } catch (err) {
      alert('Kesalahan jaringan');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSubmitExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (processingId || !expenseData.keterangan || !expenseData.jumlah || !fotoExpense) {
      alert("Harap lengkapi data dan foto bukti!");
      return;
    }

    setProcessingId('expense');
    try {
      const res = await AppActions.submitAdminExpense({
        jenis: expenseData.jenis,
        keterangan: expenseData.keterangan,
        jumlah: parseFloat(expenseData.jumlah),
        petugas: user.nama,
        bukti_cair: fotoExpense
      });

      if (res.success) {
        alert('Pengeluaran berhasil dicatat!');
        setShowExpenseModal(false);
        setExpenseData({ jenis: 'Gaji', keterangan: '', jumlah: '' });
        setFotoExpense(null);
        await fetchData();
      } else {
        alert('Gagal: ' + res.message);
      }
    } catch (err) {
      alert('Koneksi bermasalah');
    } finally {
      setProcessingId(null);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const raw = await fileToBase64(file);
        const compressed = await compressImage(raw);
        setFotoExpense(compressed);
      } catch (err) {
        alert("Gagal memproses gambar");
      }
    }
  };

  const handleDownloadCard = useCallback(async () => {
    if (memberCardRef.current === null) return;
    
    try {
      setProcessingId('download-card');
      const dataUrl = await toPng(memberCardRef.current, {
        cacheBust: true,
        quality: 1,
        pixelRatio: 3,
      });
      
      const link = document.createElement('a');
      link.download = `kartu-nasabah-${selectedNasabah?.nama || 'tokata'}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Gagal mengunduh kartu:', err);
    } finally {
      setProcessingId(null);
    }
  }, [selectedNasabah]);

  const handleUpdateAdminPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setProcessingId('admin-photo');
    try {
      const rawBase64 = await fileToBase64(file);
      const compressedBase64 = await compressImage(rawBase64);
      
      // Validasi Akhir Batas Google Sheets (Sangat Ketat: 20.000 karakter)
      if (compressedBase64.length > 20000) {
        alert(`Foto profil masih terlalu besar (${compressedBase64.length} karakter). Batas maksimal adalah 20.000 karakter untuk kestabilan Google Sheets. Silakan gunakan foto yang lebih sederhana.`);
        setProcessingId(null);
        return;
      }

      const res = await callApi('UPDATE_PROFILE_PHOTO', {
        role: 'ADMIN',
        id_user: user.id_petugas,
        foto: compressedBase64
      });
      
      if (res.success) {
        setAdminPhoto(compressedBase64);
        // Update localStorage agar foto tetap ada setelah refresh
        const savedAuth = localStorage.getItem('koperasi_auth');
        if (savedAuth) {
          const auth = JSON.parse(savedAuth);
          auth.user.foto = compressedBase64;
          localStorage.setItem('koperasi_auth', JSON.stringify(auth));
        }
        alert('Foto profil berhasil diperbarui!');
      } else {
        alert('Gagal: ' + res.message);
      }
    } catch (err) {
      console.error("Photo Update Error:", err);
      alert('Gagal memproses foto. Pastikan file adalah gambar.');
    } finally {
      setProcessingId(null);
    }
  };

  const targetData = useMemo(() => {
    const today = new Date();
    const isToday = (d: Date) => {
      return d.getFullYear() === today.getFullYear() &&
             d.getMonth() === today.getMonth() &&
             d.getDate() === today.getDate();
    };
    
    let scheduledTarget = 0;

    // 1. Installments due today
    allLoans.filter(l => l.status === 'Aktif').forEach(loan => {
      try {
        const schedule = generateLoanSchedule(loan.tanggal_cair || loan.tanggal_acc, Number(loan.tenor));
        const isDueToday = schedule.some(date => isToday(new Date(date)));
        if (isDueToday) {
          scheduledTarget += Number(loan.cicilan);
        }
      } catch (e) {
        console.error("Error calculating schedule for loan:", loan.id_pinjaman, e);
      }
    });

    // 2. Savings today (Target = Actual for these)
    const savingsToday = mutasiList
      .filter(m => m.tipe === 'Simpanan' && isToday(m.tanggal))
      .reduce((acc, curr) => acc + curr.nominal, 0);
    
    // 3. Admin fees today (Target = Actual for these)
    const adminToday = mutasiList
      .filter(m => m.tipe === 'Pemasukan' && isToday(m.tanggal))
      .reduce((acc, curr) => acc + curr.nominal, 0);

    // 4. Actual installments paid today
    const paidToday = mutasiList
      .filter(m => m.tipe === 'Angsuran' && isToday(m.tanggal))
      .reduce((acc, curr) => acc + curr.nominal, 0);

    // If actual payments exceed scheduled target (e.g. unscheduled payments), 
    // include them in the target so they are "tercantum" and percentage is correct.
    const finalTarget = scheduledTarget + savingsToday + adminToday + Math.max(0, paidToday - scheduledTarget);
    const finalReal = paidToday + savingsToday + adminToday;

    return { 
      target: finalTarget, 
      real: finalReal, 
      percent: finalTarget > 0 ? Math.min(100, (finalReal / finalTarget) * 100) : 0 
    };
  }, [allLoans, mutasiList]);

  const dailyFlowData = useMemo(() => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i - chartOffset);
      d.setHours(0, 0, 0, 0);
      days.push(d);
    }

    return days.map(day => {
      const dateStr = day.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
      
      const dayMutasi = mutasiList.filter(m => {
        const mDate = new Date(m.tanggal);
        mDate.setHours(0, 0, 0, 0);
        return mDate.getTime() === day.getTime();
      });

      const pinjaman = dayMutasi.filter(m => m.tipe === 'Pencairan').reduce((acc, curr) => acc + curr.nominal, 0);
      const angsuran = dayMutasi.filter(m => m.tipe === 'Angsuran').reduce((acc, curr) => acc + curr.nominal, 0);
      const simpanan = dayMutasi.filter(m => m.tipe === 'Simpanan').reduce((acc, curr) => acc + curr.nominal, 0);
      const admin = dayMutasi.filter(m => m.tipe === 'Pemasukan').reduce((acc, curr) => acc + curr.nominal, 0);
      const pengeluaran = dayMutasi.filter(m => m.tipe === 'Pengeluaran' || m.jenis === 'Uang Transport').reduce((acc, curr) => acc + curr.nominal, 0);
      
      const pemasukan = angsuran + simpanan + admin;

      // Calculate target for this day
      let scheduledTarget = 0;
      allLoans.forEach(loan => {
        try {
          const schedule = generateLoanSchedule(toDate(loan.tanggal_cair), Number(loan.tenor));
          if (schedule.some(date => {
            const sDate = new Date(date);
            sDate.setHours(0, 0, 0, 0);
            return sDate.getTime() === day.getTime();
          })) {
            scheduledTarget += Number(loan.cicilan);
          }
        } catch (e) {
          // Ignore errors in schedule generation for individual loans
        }
      });

      const isWeekend = day.getDay() === 0 || day.getDay() === 6;
      
      return {
        name: dateStr,
        pinjaman,
        pemasukan,
        pengeluaran,
        target: isWeekend ? 0 : scheduledTarget
      };
    });
  }, [mutasiList, allLoans, chartOffset]);

  if (loading && stats.totalModal === 0 && !fetchError) return (
    <div className="h-screen flex flex-col items-center justify-center p-20">
      <div className="w-10 h-10 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin mb-4"></div>
      <p className="text-[10px] font-black text-cyan-400 uppercase tracking-widest animate-pulse">Syncing Cosmic Data...</p>
    </div>
  );

  if (fetchError) return (
    <div className="h-screen flex flex-col items-center justify-center px-8 text-center">
      <div className="w-16 h-16 bg-magenta-500/10 rounded-full flex items-center justify-center text-magenta-400 mb-6 glass-cosmic neon-border-magenta">
        <Database size={32} />
      </div>
      <h2 className="text-lg font-black text-white mb-2">Cosmic Link Failed</h2>
      <p className="text-slate-400 text-xs mb-8 max-w-xs">{fetchError}</p>
      <button 
        onClick={fetchData}
        className="px-6 py-3 bg-cosmic-gradient text-white text-sm font-black rounded-2xl shadow-xl flex items-center gap-3 active:scale-95 transition-all"
      >
        <RefreshCcw size={18} /> Reconnect
      </button>
    </div>
  );

  return (
    <div className="p-3 md:p-6 space-y-4 relative pb-24">
      <header className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="relative group">
            <img 
              src={adminPhoto || "https://picsum.photos/200"} 
              className="w-10 h-10 rounded-2xl border-2 border-cyan-500/30 shadow-2xl object-cover" 
              alt="profile" 
              referrerPolicy="no-referrer"
            />
          </div>
          <div>
            <h1 className="text-base font-black text-white tracking-tight leading-tight">Halo, {user.nama}!</h1>
            <p className="text-cyan-400 text-[8px] font-black uppercase tracking-widest">{user.jabatan} TOKATA</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchData} className="p-2.5 glass-cosmic rounded-2xl text-cyan-400 active:rotate-180 transition-all hover:bg-white/10"><RefreshCcw size={18} /></button>
        </div>
      </header>

      {activeTab === 'home' ? (
        <>
          <div className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <p className="text-[8px] font-black text-slate-500 uppercase tracking-[0.3em]">Statistik Utama</p>
              <div className="flex items-center gap-1.5">
                <div className="p-1 bg-indigo-500/10 text-indigo-400 rounded-lg"><Users size={12}/></div>
                <p className="text-[10px] font-black text-white">{stats.activeMembers} <span className="text-slate-500 text-[8px] font-bold uppercase tracking-widest ml-0.5">Nasabah</span></p>
              </div>
            </div>

            {/* Total Modal Tersalur Card */}
            <div 
              className="bg-tokata-gradient p-4 rounded-2xl border border-white/10 shadow-2xl relative overflow-hidden group cursor-pointer active:scale-[0.98] transition-all"
              onClick={() => setShowExplanation(true)}
            >
              {/* Background Image Layer */}
              <div 
                className="absolute inset-0 z-0 pointer-events-none transition-opacity duration-500"
                style={{ 
                  backgroundImage: `url(${CARD_CONFIG.totalModalBackground})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  opacity: CARD_CONFIG.totalModalOpacity
                }}
              />
              <div className="absolute right-0 top-0 w-24 h-24 bg-white/10 rounded-full -mr-8 -mt-8 blur-2xl group-hover:scale-150 transition-transform duration-700"></div>
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-1.5 bg-white/20 rounded-lg text-white">
                    <Database size={16} />
                  </div>
                  <p className="text-[9px] font-black text-white uppercase tracking-[0.2em]">Total Modal Tersalur</p>
                </div>
                <div className="flex flex-col">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <p className="text-2xl font-black text-white tracking-tighter">
                      Rp {stats.totalModalTersalur.toLocaleString('id-ID')}
                    </p>
                    <p className="text-xs font-bold text-white/60 tracking-tight">
                      / $ {(stats.totalModalTersalur / 16000).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                  <p className="text-[7px] font-black text-white/40 mt-1 uppercase tracking-[0.1em]">
                    Klik untuk lihat rincian perhitungan
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 mb-2">
              {[
                { label: 'Total Modal', val: stats.totalModal, color: 'cyan', icon: ICONS.Wallet },
                { label: 'Saldo Kas', val: saldoKas, color: 'amber', icon: <Banknote size={14} />, onClick: () => setShowSaldoExplanation(true) },
                { label: 'Out Pinjaman', val: stats.totalPinjaman, color: 'magenta', icon: ICONS.Doc },
              ].map((s, i) => (
                <div 
                  key={i} 
                  onClick={s.onClick}
                  className={`bg-${s.color}-500/10 p-3 rounded-xl border border-${s.color}-500/20 flex flex-col justify-between min-h-[60px] ${s.onClick ? 'cursor-pointer active:scale-95 transition-all' : ''}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <p className={`text-[7px] font-black text-${s.color}-400 uppercase tracking-widest`}>{s.label}</p>
                    <div className={`text-${s.color}-400 opacity-50`}>{s.icon}</div>
                  </div>
                  <div>
                    <p className={`text-[10px] font-black text-${s.color}-300`}>
                      Rp {s.val.toLocaleString('id-ID')}
                    </p>
                    {s.label === 'Saldo Kas' && (
                      <p className="text-[5px] font-bold text-amber-500/50 uppercase tracking-tighter mt-0.5">Klik rincian</p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Operasional', val: stats.totalPengeluaran, color: 'rose', icon: ICONS.Expense },
                { label: 'Pendapatan', val: stats.totalPemasukan, color: 'emerald', icon: <ArrowUpRight size={14} /> },
              ].map((s, i) => (
                <div key={i} className={`bg-${s.color}-500/10 p-3 rounded-xl border border-${s.color}-500/20 flex flex-col justify-between min-h-[60px]`}>
                  <div className="flex items-center justify-between mb-1">
                    <p className={`text-[7px] font-black text-${s.color}-400 uppercase tracking-widest`}>{s.label}</p>
                    <div className={`text-${s.color}-400 opacity-50`}>{s.icon}</div>
                  </div>
                  <p className={`text-[10px] font-black text-${s.color}-300`}>
                    Rp {s.val.toLocaleString('id-ID')}
                  </p>
                </div>
              ))}
              
              {/* Target Hari Ini Card */}
              <div className="bg-violet-500/10 p-3 rounded-xl border border-violet-500/20 flex flex-col justify-between min-h-[60px] relative overflow-hidden">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[7px] font-black text-violet-400 uppercase tracking-widest">Target Hari Ini</p>
                  <div className="text-violet-400 opacity-50"><ShieldCheck size={14} /></div>
                </div>
                <div>
                  <div className="flex flex-col">
                    <p className="text-[10px] font-black text-violet-300 leading-tight">
                      Rp {targetData.real.toLocaleString('id-ID')}
                    </p>
                    <p className="text-[6px] font-bold text-violet-500/60 uppercase tracking-tighter">
                      Target: Rp {targetData.target.toLocaleString('id-ID')}
                    </p>
                  </div>
                  <div className="mt-1.5 w-full bg-white/5 h-1 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-violet-500 transition-all duration-1000" 
                      style={{ width: `${targetData.percent}%` }}
                    />
                  </div>
                  <p className="text-[6px] font-bold text-violet-500/70 mt-0.5 text-right">
                    {targetData.percent.toFixed(1)}%
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-4">
              <div className="glass-cosmic p-4 rounded-2xl shadow-xl">
                <h3 className="text-sm font-black text-white mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-white/5 rounded-lg text-cyan-400">{ICONS.Chart}</div> Arus Kas Utama (Flow Matrix)
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex bg-white/5 rounded-lg p-0.5 border border-white/10">
                      <button 
                        onClick={() => setChartOffset(prev => prev + 7)}
                        className="p-1 hover:bg-white/10 rounded-md text-slate-400 transition-colors"
                        title="7 Hari Sebelumnya"
                      >
                        <ChevronRight className="rotate-180" size={14} />
                      </button>
                      <button 
                        onClick={() => setChartOffset(0)}
                        className="px-1.5 text-[8px] font-black text-slate-500 uppercase hover:text-cyan-400 transition-colors"
                      >
                        Hari Ini
                      </button>
                      <button 
                        onClick={() => setChartOffset(prev => Math.max(0, prev - 7))}
                        disabled={chartOffset === 0}
                        className={`p-1 rounded-md transition-colors ${chartOffset === 0 ? 'text-slate-700 cursor-not-allowed' : 'hover:bg-white/10 text-slate-400'}`}
                        title="7 Hari Berikutnya"
                      >
                        <ChevronRight size={14} />
                      </button>
                    </div>
                    <div className="flex gap-2">
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full bg-cyan-400"></div>
                      <span className="text-[6px] font-black text-slate-400 uppercase">Masuk</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full bg-rose-500"></div>
                      <span className="text-[6px] font-black text-slate-400 uppercase">Keluar</span>
                    </div>
                  </div>
                </div>
              </h3>
                <div className="h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={dailyFlowData}>
                      <defs>
                        <linearGradient id="colorMasuk" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#22d3ee" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorKeluar" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                        </linearGradient>
                        <filter id="glow">
                          <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                          <feMerge>
                            <feMergeNode in="coloredBlur"/>
                            <feMergeNode in="SourceGraphic"/>
                          </feMerge>
                        </filter>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={true} stroke="rgba(255,255,255,0.08)" strokeOpacity={0.5} />
                      <XAxis 
                        dataKey="name" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{fontSize: 7, fontWeight: 800, fill: '#64748b'}} 
                        dy={10}
                      />
                      <YAxis 
                        axisLine={false} 
                        tickLine={false} 
                        tickFormatter={(val) => val >= 1000000 ? `${(val/1000000).toFixed(1)}M` : `Rp ${val/1000}k`} 
                        tick={{fontSize: 7, fontWeight: 700, fill: '#475569'}} 
                        domain={[0, (dataMax: number) => Math.max(dataMax, 1000000)]}
                      />
                      <Tooltip 
                        contentStyle={{backgroundColor: 'rgba(15, 23, 42, 0.95)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.5)', padding: '12px'}}
                        itemStyle={{fontSize: '8px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em'}}
                        labelStyle={{fontSize: '10px', fontWeight: '900', color: '#fff', marginBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '4px'}}
                        formatter={(value: number) => `Rp ${value.toLocaleString('id-ID')}`} 
                      />
                      <Area 
                        type="monotone" 
                        dataKey="pemasukan" 
                        stroke="#22d3ee" 
                        strokeWidth={3}
                        fillOpacity={1} 
                        fill="url(#colorMasuk)" 
                        animationDuration={2000}
                        name="Pemasukan"
                        dot={{ r: 3, fill: '#22d3ee', strokeWidth: 2, stroke: '#0f172a' }}
                        activeDot={{ r: 6, fill: '#22d3ee', strokeWidth: 2, stroke: '#fff' }}
                        filter="url(#glow)"
                      />
                      <Area 
                        type="monotone" 
                        dataKey="pinjaman" 
                        stroke="#f43f5e" 
                        strokeWidth={3}
                        fillOpacity={1} 
                        fill="url(#colorKeluar)" 
                        animationDuration={2500}
                        name="Pinjaman Cair"
                        dot={{ r: 3, fill: '#f43f5e', strokeWidth: 2, stroke: '#0f172a' }}
                        activeDot={{ r: 6, fill: '#f43f5e', strokeWidth: 2, stroke: '#fff' }}
                        filter="url(#glow)"
                      />
                      <Area 
                        type="monotone" 
                        dataKey="pengeluaran" 
                        stroke="#fbbf24" 
                        strokeWidth={2}
                        fillOpacity={0} 
                        strokeDasharray="5 5"
                        animationDuration={3000}
                        name="Pengeluaran"
                        dot={{ r: 2, fill: '#fbbf24' }}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="target" 
                        stroke="#8b5cf6" 
                        strokeWidth={2}
                        fillOpacity={0} 
                        strokeDasharray="3 3"
                        animationDuration={3500}
                        name="Target Harian"
                        dot={{ r: 2, fill: '#8b5cf6' }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3">
            <button 
              onClick={() => setShowExpenseModal(true)}
              className="flex items-center justify-between p-4 bg-cosmic-gradient rounded-2xl shadow-lg active:scale-95 transition-all group relative overflow-hidden"
            >
              <div className="absolute right-0 top-0 w-16 h-16 bg-white/20 rounded-full -mr-4 -mt-4 blur-lg"></div>
              <div className="flex items-center gap-3 relative z-10">
                <div className="p-2 bg-white/20 rounded-xl text-white">
                  <ArrowDownRight size={20}/>
                </div>
                <div className="text-left text-white">
                  <h3 className="font-black text-sm tracking-tight">Input Pengeluaran</h3>
                  <p className="text-[8px] opacity-80 font-medium uppercase tracking-wider">Gaji, Perawatan, dll</p>
                </div>
              </div>
              <div className="text-white opacity-40 group-hover:opacity-100 transition-opacity">
                <PlusCircle size={20} />
              </div>
            </button>
          </div>
          <div className="grid grid-cols-1 gap-3 mt-3">
            <button 
              onClick={() => {
                setShowValidationView(true);
                fetchValidationData();
                fetchData(); // Refresh mutasiList to ensure tagihan calculation is accurate
              }}
              className="flex items-center justify-between p-4 bg-slate-800 rounded-2xl shadow-lg active:scale-95 transition-all group relative overflow-hidden border border-white/5"
            >
              <div className="absolute right-0 top-0 w-16 h-16 bg-cyan-500/10 rounded-full -mr-4 -mt-4 blur-lg"></div>
              <div className="flex items-center gap-3 relative z-10">
                <div className="p-2 bg-cyan-500/10 rounded-xl text-cyan-400">
                  <ClipboardCheck size={20}/>
                </div>
                <div className="text-left text-white">
                  <h3 className="font-black text-sm tracking-tight">Validasi Setoran</h3>
                  <p className="text-[8px] opacity-80 font-medium uppercase tracking-wider">Cek Selisih Kolektor</p>
                </div>
              </div>
              <div className="text-white opacity-40 group-hover:opacity-100 transition-opacity">
                <ChevronRight size={20} />
              </div>
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3 mt-3">
            <button 
              onClick={() => setShowReportDateModal(true)}
              className="flex items-center justify-between p-4 bg-slate-800 rounded-2xl shadow-lg active:scale-95 transition-all group relative overflow-hidden border border-white/5"
            >
              <div className="absolute right-0 top-0 w-16 h-16 bg-emerald-500/10 rounded-full -mr-4 -mt-4 blur-lg"></div>
              <div className="flex items-center gap-3 relative z-10">
                <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-400">
                  <FileText size={20}/>
                </div>
                <div className="text-left text-white">
                  <h3 className="font-black text-sm tracking-tight">Laporan Harian</h3>
                  <p className="text-[8px] opacity-80 font-medium uppercase tracking-wider">Cetak Mutasi & Target Harian</p>
                </div>
              </div>
              <div className="text-white opacity-40 group-hover:opacity-100 transition-opacity">
                <ChevronRight size={20} />
              </div>
            </button>

            <button 
              onClick={() => setShowMonthlyReportModal(true)}
              className="flex items-center justify-between p-4 bg-slate-800 rounded-2xl shadow-lg active:scale-95 transition-all group relative overflow-hidden border border-white/5"
            >
              <div className="absolute right-0 top-0 w-16 h-16 bg-cyan-500/10 rounded-full -mr-4 -mt-4 blur-lg"></div>
              <div className="flex items-center gap-3 relative z-10">
                <div className="p-2 bg-cyan-500/10 rounded-xl text-cyan-400">
                  <Calendar size={20}/>
                </div>
                <div className="text-left text-white">
                  <h3 className="font-black text-sm tracking-tight">Laporan Bulanan</h3>
                  <p className="text-[8px] opacity-80 font-medium uppercase tracking-wider">Analisis Laba/Rugi & Kas Bulanan</p>
                </div>
              </div>
              <div className="text-white opacity-40 group-hover:opacity-100 transition-opacity">
                <ChevronRight size={20} />
              </div>
            </button>
          </div>
        </>
      ) : activeTab === 'maps' ? (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <h3 className="text-base font-black text-white flex items-center gap-2 px-1">
            <div className="p-2 bg-cyan-500/10 text-cyan-400 rounded-xl"><MapPin size={20}/></div> Lokasi Nasabah
          </h3>
          <div className="map-container-solid rounded-[2.5rem] overflow-hidden shadow-2xl h-[60vh] relative">
            <MapContainer 
              center={adminLocation || [-6.2088, 106.8456]} 
              zoom={13} 
              style={{ height: '100%', width: '100%' }}
              className="z-10"
            >
              <TileLayer
                url="https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
                subdomains={['mt0', 'mt1', 'mt2', 'mt3']}
                attribution=''
                className="map-tiles-dark"
              />
              {nasabahList
                .filter(n => n.latitude && n.longitude)
                .map(nasabah => {
                  const loans = allLoans.filter(l => String(l.id_nasabah).trim().toLowerCase() === String(nasabah.id_nasabah).trim().toLowerCase());
                  const today = new Date();
                  today.setHours(0,0,0,0);

                  let isOverdue = false;
                  let isActive = false;
                  const isAllLunas = loans.length > 0 && loans.every(l => l.status === 'Lunas' || Number(l.sisa_hutang) <= 0);

                  if (!isAllLunas) {
                    loans.forEach(loan => {
                      const sisa = Number(loan.sisa_hutang || 0);
                      if (loan.status === 'Aktif' && sisa > 0) {
                        isActive = true;
                        const schedule = generateLoanSchedule(loan.tanggal_cair || loan.tanggal_acc, loan.tenor);
                        const totalHutang = Number(loan.total_hutang);
                        const cicilan = Number(loan.cicilan);
                        const installmentsPaid = Math.floor((totalHutang - sisa) / cicilan);
                        
                        if (installmentsPaid < schedule.length) {
                          const nextDueDate = new Date(schedule[installmentsPaid]);
                          nextDueDate.setHours(0,0,0,0);
                          if (nextDueDate.getTime() < today.getTime()) {
                            isOverdue = true;
                          }
                        }
                      }
                    });
                  }

                  let color = '#3b82f6'; // Default Blue
                  let opacity = 1;

                  if (isOverdue) {
                    color = '#ef4444'; // Red
                  } else if (isActive) {
                    color = '#3b82f6'; // Blue
                  } else if (isAllLunas) {
                    color = '#94a3b8'; // Gray
                    opacity = 0.5;
                  } else {
                    // No loans or other state
                    color = '#94a3b8';
                    opacity = 0.3;
                  }

                  const customIcon = L.divIcon({
                    className: 'custom-map-marker',
                    html: `<div style="background-color: ${color}; opacity: ${opacity}; width: 14px; height: 14px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 10px rgba(0,0,0,0.5);"></div>`,
                    iconSize: [14, 14],
                    iconAnchor: [7, 7]
                  });

                  return (
                    <Marker 
                      key={nasabah.id_nasabah} 
                      position={[Number(nasabah.latitude), Number(nasabah.longitude)]}
                      icon={customIcon}
                    >
                      <Popup className="custom-popup">
                        <div className="p-1">
                          <p className="font-black text-xs text-white">{nasabah.nama}</p>
                          <p className="text-[10px] text-slate-400">{nasabah.id_nasabah}</p>
                          <p className="text-[10px] mt-1 font-bold text-cyan-400">{nasabah.no_hp}</p>
                          <div className="mt-2 pt-2 border-t border-white/10">
                            <p className={`text-[8px] font-black uppercase tracking-widest ${isOverdue ? 'text-rose-400' : isActive ? 'text-blue-400' : 'text-slate-500'}`}>
                              {isOverdue ? 'MENUNGGAK' : isActive ? 'PINJAMAN AKTIF' : 'LUNAS / TIDAK ADA PINJAMAN'}
                            </p>
                          </div>
                        </div>
                      </Popup>
                    </Marker>
                  );
                })}
            </MapContainer>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="glass-cosmic p-3 rounded-2xl border border-white/5">
              <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Total Terpetakan</p>
              <p className="text-sm font-black text-white">{nasabahList.filter(n => n.latitude && n.longitude).length} Nasabah</p>
            </div>
            <div className="glass-cosmic p-3 rounded-2xl border border-white/5">
              <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Belum Terpetakan</p>
              <p className="text-sm font-black text-white">{nasabahList.filter(n => !n.latitude || !n.longitude).length} Nasabah</p>
            </div>
          </div>
        </div>
      ) : activeTab === 'approvals' ? (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <h3 className="text-base font-black text-white flex items-center gap-2 px-1">
            <div className="p-2 bg-yellow-500/10 text-yellow-500 rounded-xl">{ICONS.Pending}</div> Persetujuan Pinjaman
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {pengajuan.length === 0 ? (
              <div className="col-span-full flex flex-col items-center justify-center py-20 text-slate-500 glass-cosmic rounded-2xl">
                <div className="bg-white/5 p-6 rounded-full mb-4">{ICONS.Success}</div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Semua Pengajuan Telah Diproses</p>
              </div>
            ) : (
              pengajuan.map((p) => (
                <div key={p.id_pengajuan} className="p-4 glass-cosmic border border-white/5 rounded-2xl space-y-4 hover:border-violet-500/30 hover:bg-white/10 transition-all group shadow-xl">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-white/5 rounded-xl border border-white/5 flex items-center justify-center text-slate-500 group-hover:text-violet-400 transition-colors">
                        <User size={20} />
                      </div>
                      <div>
                        <p className="font-black text-sm text-white leading-tight">{p.nama}</p>
                        <p className="text-[8px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">{p.id_nasabah}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black text-violet-400">Rp {Number(p.jumlah || 0).toLocaleString('id-ID')}</p>
                      <p className="text-[7px] text-slate-500 font-bold uppercase">Tenor: {p.tenor} Hari</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 bg-white/5 p-2.5 rounded-xl border border-white/5">
                    <div className="p-1.5 bg-white/5 rounded-lg text-slate-500"><ShieldCheck size={14}/></div>
                    <div className="flex-1">
                      <p className="text-[7px] text-slate-500 font-black uppercase tracking-widest">Petugas Lapangan</p>
                      <p className="text-[10px] font-black text-slate-300">{p.petugas}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[7px] text-slate-500 font-black uppercase tracking-widest">Tanggal</p>
                      <p className="text-[10px] font-black text-slate-300">{new Date(p.tanggal).toLocaleDateString('id-ID')}</p>
                    </div>
                  </div>

                  <button 
                    disabled={!!processingId}
                    onClick={() => handleApprove(p.id_pengajuan)}
                    className={`w-full py-3.5 bg-tokata-gradient text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl hover:brightness-110 transition-all active:scale-95 flex items-center justify-center gap-2 ${processingId === p.id_pengajuan ? 'opacity-70' : ''}`}
                  >
                    {processingId === p.id_pengajuan ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <><CheckCircle2 size={14} /> Setujui Pengajuan</>
                    )}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      ) : activeTab === 'mutations' ? (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="flex justify-between items-center px-1">
            <h3 className="text-base font-black text-white flex items-center gap-2">
              <div className="p-2 bg-cyan-500/10 text-cyan-400 rounded-xl">{ICONS.Stats}</div> Riwayat Mutasi
            </h3>
          </div>

          <div className="relative px-1">
            <input 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cari transaksi..." 
              className="w-full pl-10 pr-4 py-3 bg-white/5 rounded-xl border border-white/10 font-bold text-white text-xs outline-none focus:ring-2 focus:ring-cyan-500 shadow-inner"
            />
            <Search className="absolute left-3.5 top-3.5 text-slate-500" size={16} />
          </div>

          <div className="space-y-3 overflow-y-auto pr-1 custom-scrollbar max-h-[650px]">
            {mutasiList.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-slate-500 glass-cosmic rounded-2xl">
                <div className="bg-white/5 p-8 rounded-full mb-6 border border-white/5"><Database size={40} className="opacity-20" /></div>
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-600">
                  Data Transaksi Kosong
                </p>
              </div>
            ) : (
              mutasiList
                .filter(m => 
                  (m.ket || "").toLowerCase().includes(searchTerm.toLowerCase()) || 
                  (m.tipe || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
                  (m.petugas_display || "").toLowerCase().includes(searchTerm.toLowerCase())
                )
                .map((m, idx) => {
                  const isPositive = ['Angsuran', 'Simpanan', 'Setoran Modal', 'Pemasukan'].includes(m.tipe);
                  return (
                    <div 
                      key={idx} 
                      onClick={() => setSelectedTransaction(m)}
                      className="group relative glass-cosmic hover:bg-white/10 p-2 rounded-xl border border-white/5 transition-all duration-300 cursor-pointer"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shadow-lg transition-transform group-hover:scale-110 ${
                            isPositive ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          }`}>
                            {isPositive ? <ArrowUpRight size={14}/> : <ArrowDownRight size={14}/>}
                          </div>
                          <div>
                            <h4 className="text-[10px] font-black text-white tracking-tight group-hover:text-cyan-300 transition-colors">{m.ket}</h4>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className={`text-[6px] font-black uppercase tracking-widest px-1 py-0.5 rounded-md ${
                                isPositive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                              }`}>{m.tipe}</span>
                              <span className="text-[6px] text-slate-500 font-black uppercase tracking-widest flex items-center gap-1">
                                <span className="w-0.5 h-0.5 bg-slate-700 rounded-full"></span>
                                {m.petugas_display}
                                <span className="w-0.5 h-0.5 bg-slate-700 rounded-full"></span>
                                {m.tanggal.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`text-[11px] font-black tracking-tighter ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {isPositive ? '+' : '-'} Rp {Number(m.nominal || 0).toLocaleString('id-ID')}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })
            )}
          </div>
        </div>
      ) : activeTab === 'members' ? (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
          {!selectedNasabah ? (
            <div className="space-y-4">
              <h3 className="text-base font-black text-white flex items-center gap-2 px-1">
                <div className="p-2 bg-cyan-500/10 text-cyan-400 rounded-xl"><Users size={20}/></div> Daftar Pinjaman Nasabah
              </h3>
              <div className="relative px-1">
                <input 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Cari Nasabah atau ID Pinjaman..." 
                  className="w-full pl-10 pr-4 py-3 bg-white/5 rounded-xl border border-white/10 font-bold text-white text-xs outline-none focus:ring-2 focus:ring-cyan-500 shadow-inner"
                />
                <Search className="absolute left-3.5 top-3.5 text-slate-500" size={16} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 overflow-y-auto pr-1 custom-scrollbar max-h-[70vh]">
                {(() => {
                  const today = new Date();
                  today.setHours(0,0,0,0);

                  const loanData = allLoans.map(loan => {
                    const nasabah = nasabahList.find(n => 
                      String(n.id_nasabah).trim().toLowerCase() === String(loan.id_nasabah).trim().toLowerCase()
                    );
                    if (!nasabah) return null;

                    const isLunas = loan.status === 'Lunas' || Number(loan.sisa_hutang) <= 0;
                    
                    let nextDueDate: Date | null = null;
                    let isOverdue = false;
                    let isDueToday = false;
                    const isPartial = Number(loan.sisa_hutang) < Number(loan.total_hutang);

                    if (!isLunas) {
                      const schedule = generateLoanSchedule(loan.tanggal_cair || loan.tanggal_acc, loan.tenor);
                      const totalHutang = Number(loan.total_hutang);
                      const sisaHutang = Number(loan.sisa_hutang);
                      const cicilan = Number(loan.cicilan);
                      
                      const installmentsPaid = Math.floor((totalHutang - sisaHutang) / cicilan);
                      const nextInstallmentIndex = installmentsPaid;
                      
                      if (nextInstallmentIndex < schedule.length) {
                        nextDueDate = new Date(schedule[nextInstallmentIndex]);
                        nextDueDate.setHours(0,0,0,0);
                        
                        if (nextDueDate.getTime() === today.getTime()) {
                          isDueToday = true;
                        } else if (nextDueDate.getTime() < today.getTime()) {
                          isOverdue = true;
                        }
                      }
                    }

                    // Assign Priority and Style
                    let priority = 0;
                    let statusLabel = "";
                    let statusClass = "";
                    const loanStatusText = isLunas ? "Lunas Total" : "Sedang dalam Pinjaman";

                    if (isLunas) {
                      priority = 4;
                      statusLabel = "Lunas";
                      statusClass = "bg-slate-800/50 text-slate-500 border-slate-700/30 opacity-50";
                    } else if (isOverdue) {
                      priority = 1;
                      statusLabel = "Menunggak";
                      statusClass = "bg-rose-600 text-white border-rose-400 shadow-[0_0_15px_rgba(225,29,72,0.4)] animate-pulse";
                    } else if (isDueToday) {
                      priority = 2;
                      statusLabel = "Jadwal Hari Ini";
                      if (isPartial) {
                        statusClass = "bg-gradient-to-r from-yellow-500 via-emerald-500 to-emerald-600 text-white border-emerald-400";
                      } else {
                        statusClass = "bg-emerald-600 text-white border-emerald-400";
                      }
                    } else if (isPartial) {
                      priority = 3;
                      statusLabel = "Bayar Setengah";
                      statusClass = "bg-yellow-500 text-slate-900 border-yellow-400";
                    } else {
                      priority = 3;
                      statusLabel = "Aman";
                      statusClass = "bg-blue-600 text-white border-blue-400";
                    }

                    return {
                      ...loan,
                      nasabah,
                      priority,
                      statusLabel,
                      statusClass,
                      loanStatusText,
                      nextDueDate
                    };
                  })
                  .filter(item => item !== null)
                  .filter(item => 
                    (item.nasabah.nama || "").toLowerCase().includes(searchTerm.toLowerCase()) || 
                    (item.id_nasabah || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
                    (item.id_pinjaman || "").toLowerCase().includes(searchTerm.toLowerCase())
                  )
                  .sort((a, b) => {
                    // Sort by Priority
                    if (a.priority !== b.priority) return a.priority - b.priority;
                    
                    // Within AMAN/PARTIAL (Priority 3), sort by nextDueDate
                    if (a.priority === 3 && a.nextDueDate && b.nextDueDate) {
                      return a.nextDueDate.getTime() - b.nextDueDate.getTime();
                    }
                    
                    return 0;
                  });

                  if (loanData.length === 0 && !loading) {
                    return (
                      <div className="col-span-full flex flex-col items-center justify-center py-20 text-slate-500 bg-white/5 border border-white/5 rounded-2xl">
                        <Database size={40} className="opacity-20 mb-4" />
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 text-center px-6">
                          Tidak ada data pinjaman ditemukan.<br/>
                          Pastikan Google Script sudah diperbarui.
                        </p>
                        <button onClick={fetchData} className="mt-4 flex items-center gap-2 px-4 py-2 bg-white/5 rounded-xl text-[10px] font-black uppercase text-cyan-400 border border-white/5">
                          <RefreshCcw size={14} /> Coba Refresh
                        </button>
                      </div>
                    );
                  }

                  return loanData.map((item) => (
                    <div 
                      key={item.id_pinjaman} 
                      onClick={() => fetchMemberDetail(item.nasabah, item.id_pinjaman)}
                      className={`flex flex-col p-3 bg-white/5 rounded-xl border border-white/5 hover:bg-white/10 hover:border-cyan-500/30 transition-all group cursor-pointer relative overflow-hidden ${item.priority === 4 ? 'opacity-50' : ''}`}
                    >
                      <div className="flex justify-between items-center gap-2">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <div className="relative">
                            <div className={`w-9 h-9 rounded-lg overflow-hidden border border-white/10 flex items-center justify-center bg-white/5 transition-transform group-hover:scale-105`}>
                              {item.nasabah.foto ? (
                                <img src={item.nasabah.foto} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                              ) : (
                                <User size={18} className="text-slate-500" />
                              )}
                            </div>
                            <div className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-[#0f172a] ${
                              item.priority === 1 ? 'bg-rose-500' : 
                              item.priority === 2 ? 'bg-emerald-500' :
                              item.priority === 3 ? (item.statusLabel === 'Bayar Setengah' ? 'bg-yellow-500' : 'bg-blue-500') :
                              'bg-slate-500'
                            }`}></div>
                          </div>
                          <div className="min-w-0">
                            <p className="text-[10px] font-black text-white leading-tight truncate">{item.nasabah.nama}</p>
                            <p className="text-[7px] text-slate-500 font-bold uppercase tracking-widest truncate">#{item.id_pinjaman}</p>
                          </div>
                        </div>
                        <div className={`text-[6px] font-black px-1.5 py-0.5 rounded-md border uppercase tracking-tighter whitespace-nowrap ${item.statusClass}`}>
                          {item.statusLabel}
                        </div>
                      </div>

                      <div className="mt-2 flex items-center justify-between px-0.5">
                        <div className="flex items-center gap-1">
                          <span className="text-[7px] font-black text-slate-500 uppercase tracking-tighter">Sisa:</span>
                          <span className="text-[8px] font-black text-cyan-400">Rp {Number(item.sisa_hutang || 0).toLocaleString('id-ID')}</span>
                        </div>
                        {item.nextDueDate && item.priority !== 4 && (
                          <div className="flex items-center gap-1">
                            <Calendar size={8} className="text-slate-600" />
                            <span className="text-[7px] font-black text-slate-500">{item.nextDueDate.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <button 
                onClick={() => { setSelectedNasabah(null); setMemberDetailData(null); }}
                className="flex items-center gap-2 text-cyan-400 font-black text-[10px] uppercase tracking-widest glass-cosmic px-4 py-2 rounded-xl border border-white/5 active:scale-95 transition-all"
              >
                <X size={14} /> Kembali ke List
              </button>

              <div className="bg-white/5 p-4 rounded-2xl border border-white/5 shadow-xl">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-14 h-14 bg-white/5 rounded-2xl overflow-hidden border border-white/10 flex items-center justify-center">
                    {selectedNasabah.foto ? (
                      <img src={selectedNasabah.foto} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <User size={28} className="text-slate-500" />
                    )}
                  </div>
                  <div className="flex-1 flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-black text-white leading-tight">{selectedNasabah.nama}</h3>
                      <p className="text-[8px] text-slate-500 font-black uppercase tracking-widest">{selectedNasabah.id_nasabah} | {selectedNasabah.no_hp}</p>
                    </div>
                    <button 
                      onClick={() => setShowMemberCard(true)}
                      className="p-2 bg-violet-500/10 text-violet-400 rounded-xl border border-violet-500/20 active:scale-95 transition-all flex items-center gap-2"
                    >
                      <CreditCard size={16} />
                      <span className="text-[8px] font-black uppercase tracking-widest">Lihat Kartu</span>
                    </button>
                  </div>
                </div>

                {memberDetailData ? (
                  <>
                    <div className="grid grid-cols-3 gap-2 mb-6">
                      <div className="bg-cyan-500/10 p-3 rounded-xl border border-cyan-500/20">
                        <p className="text-[7px] font-black text-cyan-400 uppercase tracking-widest mb-1">Pinjaman</p>
                        <p className="text-[10px] font-black text-cyan-300">
                          Rp {(memberDetailData.pinjaman || []).reduce((acc, cur) => acc + Number(cur.pokok || 0), 0).toLocaleString('id-ID')}
                        </p>
                      </div>
                      <div className="bg-emerald-500/10 p-3 rounded-xl border border-emerald-500/20">
                        <p className="text-[7px] font-black text-emerald-400 uppercase tracking-widest mb-1">Simpanan</p>
                        <p className="text-[10px] font-black text-emerald-300">
                          Rp {(memberDetailData.simpanan || []).reduce((acc, cur) => acc + Number(cur.setor || 0) - Number(cur.tarik || 0), 0).toLocaleString('id-ID')}
                        </p>
                      </div>
                      <div className="bg-magenta-500/10 p-3 rounded-xl border border-magenta-500/20">
                        <p className="text-[7px] font-black text-magenta-400 uppercase tracking-widest mb-1">Pengembalian</p>
                        <p className="text-[10px] font-black text-magenta-300">
                          Rp {(memberDetailData.pinjaman || []).reduce((acc, cur) => acc + (Number(cur.total_hutang || 0) - Number(cur.sisa_hutang || 0)), 0).toLocaleString('id-ID')}
                        </p>
                      </div>
                    </div>

                    {/* Loan Tabs Selector - Only show if more than 1 loan */}
                    {(memberDetailData.pinjaman || []).length > 1 && (
                      <>
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 px-1">Pilih Pinjaman</h4>
                        <div className="flex gap-2 mb-4 overflow-x-auto pb-2 px-1 scrollbar-hide">
                          {(memberDetailData.pinjaman || []).map((loan) => (
                            <button
                              key={loan.id_pinjaman}
                              onClick={() => setActiveLoanId(loan.id_pinjaman)}
                              className={`flex-shrink-0 px-4 py-2 rounded-xl border text-[9px] font-black uppercase tracking-widest transition-all active:scale-95 ${
                                activeLoanId === loan.id_pinjaman 
                                  ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-400' 
                                  : 'bg-white/5 border-white/10 text-slate-500'
                              }`}
                            >
                              ID #{loan.id_pinjaman}
                              {loan.status === 'Lunas' && <span className="ml-2 opacity-50">(Lunas)</span>}
                            </button>
                          ))}
                        </div>
                      </>
                    )}

                    <div className="space-y-3">
                      {(memberDetailData.pinjaman || []).length === 0 ? (
                        <p className="text-center py-4 text-[8px] font-black text-slate-500 uppercase tracking-widest italic">Tidak ada riwayat pinjaman</p>
                      ) : (
                        (memberDetailData.pinjaman || [])
                          .filter(l => l.id_pinjaman === activeLoanId)
                          .map((loan, lIdx) => {
                            const schedule = generateLoanSchedule(loan.tanggal_cair || loan.tanggal_acc, loan.tenor);
                            
                            // Get payments specifically for THIS loan, sorted by date (oldest first for matching)
                            const loanPayments = (memberDetailData.angsuran || [])
                              .filter(a => String(a.id_pinjam || a.id_pinjaman) === String(loan.id_pinjaman))
                              .sort((a, b) => toDate(a.tanggal).getTime() - toDate(b.tanggal).getTime());

                            const parseNum = (val: any) => {
                              if (!val) return 0;
                              if (typeof val === 'number') return val;
                              const cleaned = String(val).replace(/[^0-9.-]/g, '');
                              const parsed = parseFloat(cleaned);
                              return isNaN(parsed) ? 0 : parsed;
                            };

                            const totalHutang = parseNum(loan.total_hutang);
                            const sisaHutang = parseNum(loan.sisa_hutang);
                            
                            // Use the larger of: (total - sisa) OR (sum of actual payment records)
                            const sumPayments = loanPayments.reduce((sum, a) => sum + parseNum(a.nominal || a.jumlah_bayar), 0);
                            const totalPaid = Math.max(sumPayments, totalHutang - sisaHutang);
                            
                            const cicilan = parseNum(loan.cicilan);
                            const today = new Date();
                            today.setHours(0,0,0,0);

                            return (
                              <div key={lIdx} className="space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <div className="flex items-center justify-between px-1">
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-black text-white uppercase tracking-widest">Detail Pinjaman</span>
                                    {loan.status === 'Lunas' && (
                                      <span className="px-2 py-0.5 bg-emerald-500 text-white text-[7px] font-black uppercase rounded-full">Lunas</span>
                                    )}
                                  </div>
                                  <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Sisa: Rp {sisaHutang.toLocaleString('id-ID')}</span>
                                </div>
                                
                                <div className="bg-white/5 p-3 rounded-2xl border border-white/5 mb-2">
                                  <div className="grid grid-cols-2 gap-4">
                                    <div>
                                      <p className="text-[7px] font-black text-slate-500 uppercase tracking-widest">Total Pinjaman</p>
                                      <p className="text-xs font-black text-white">Rp {Number(loan.pokok || 0).toLocaleString('id-ID')}</p>
                                    </div>
                                    <div className="text-right">
                                      <p className="text-[7px] font-black text-slate-500 uppercase tracking-widest">Total Hutang</p>
                                      <p className="text-xs font-black text-cyan-400">Rp {totalHutang.toLocaleString('id-ID')}</p>
                                    </div>
                                  </div>
                                </div>

                                  <div className="grid grid-cols-2 gap-2">
                                    {schedule.map((date, sIdx) => {
                                      const dueDate = new Date(date);
                                      dueDate.setHours(0,0,0,0);
                                      
                                      const amountDueForThisStep = cicilan;
                                      const accumulatedDueUntilThisStep = (sIdx + 1) * cicilan;
                                      const accumulatedDueBeforeThisStep = sIdx * cicilan;
                                      
                                      let amountPaidForThisStep = 0;
                                      if (totalPaid >= accumulatedDueUntilThisStep) {
                                        amountPaidForThisStep = amountDueForThisStep;
                                      } else if (totalPaid > accumulatedDueBeforeThisStep) {
                                        amountPaidForThisStep = totalPaid - accumulatedDueBeforeThisStep;
                                      }

                                      const remainingForThisStep = amountDueForThisStep - amountPaidForThisStep;
                                      const isFullyPaid = remainingForThisStep <= 0;
                                      
                                      // Robust date comparison
                                      const d1 = new Date(dueDate);
                                      d1.setHours(0,0,0,0);
                                      const d2 = new Date(today);
                                      d2.setHours(0,0,0,0);
                                      
                                      const isToday = d1.getTime() === d2.getTime();
                                      const isOverdue = d1.getTime() < d2.getTime() && !isFullyPaid;
                                      
                                      let ticketColor = '';
                                      let statusText = '';
                                      let icon = null;
                                      let stripeColor = '';

                                      if (isFullyPaid) {
                                        ticketColor = 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400';
                                        statusText = 'Lunas';
                                        icon = <CheckCircle2 size={10} className="text-emerald-500" />;
                                        stripeColor = 'bg-emerald-500';
                                      } else if (isToday) {
                                        ticketColor = 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400';
                                        statusText = 'Jadwal Hari Ini';
                                        icon = <CheckCircle2 size={10} className="text-emerald-500" />;
                                        stripeColor = 'bg-emerald-500';
                                      } else if (isOverdue) {
                                        ticketColor = 'bg-rose-500/10 border-rose-500/30 text-rose-400';
                                        statusText = 'Menunggak';
                                        icon = <Clock size={10} className="text-rose-500" />;
                                        stripeColor = 'bg-rose-500';
                                      } else if (amountPaidForThisStep > 0) {
                                        ticketColor = 'bg-yellow-500/10 border-yellow-500/30 text-yellow-500';
                                        statusText = 'Terbayar Setengah';
                                        icon = <Calendar size={10} className="text-yellow-500" />;
                                        stripeColor = 'bg-yellow-500';
                                      } else {
                                        // Upcoming with no payment
                                        ticketColor = 'bg-white/5 border-white/10 text-slate-500';
                                        statusText = 'Belum Jadwal';
                                        icon = <Calendar size={10} className="text-slate-700" />;
                                        stripeColor = '';
                                      }

                                      return (
                                        <div 
                                          key={sIdx} 
                                          onClick={() => {
                                            if (amountPaidForThisStep > 0) {
                                              const record = loanPayments.find((_, pIdx) => pIdx === sIdx) || loanPayments[loanPayments.length - 1];
                                              if (record) setSelectedReceipt(record);
                                            }
                                          }}
                                          className={`p-2.5 rounded-xl border flex flex-col gap-1 relative overflow-hidden transition-all cursor-pointer active:scale-95 ${ticketColor}`}
                                        >
                                          <div className="flex justify-between items-start">
                                            <span className="text-[7px] font-black uppercase tracking-tighter opacity-70">Hari {sIdx + 1}</span>
                                            {icon}
                                          </div>
                                          <p className="text-[10px] font-black">Rp {remainingForThisStep.toLocaleString('id-ID')}</p>
                                          <div className="flex items-center justify-between mt-1">
                                            <div className="flex items-center gap-1">
                                              <Calendar size={8} className="opacity-50" />
                                              <span className="text-[7px] font-bold">{dueDate.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}</span>
                                            </div>
                                            <span className="text-[6px] font-black uppercase tracking-widest opacity-80">{statusText}</span>
                                          </div>
                                          {stripeColor && (
                                            <div className={`absolute top-0 right-0 w-1 h-full ${stripeColor}`}></div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                              </div>
                            );
                          })
                      )}
                    </div>
                  </>
                ) : (
                  <p className="text-center py-10 text-[8px] font-black text-slate-500 uppercase tracking-widest">Gagal memuat data</p>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
          {!settingsPage ? (
            <div className="space-y-2">
              <h3 className="text-base font-black text-white flex items-center gap-2 px-1 mb-4">
                <div className="p-2 bg-blue-500/10 text-blue-400 rounded-xl"><Settings size={20}/></div> Pengaturan Sistem
              </h3>
              
              <div className="space-y-2">
                {[
                  { id: 'modal', label: 'Input Modal', icon: <PlusCircle size={18} />, color: 'cyan' },
                  { id: 'members', label: 'Edit Anggota', icon: <Database size={18} />, color: 'emerald' },
                  { id: 'staff', label: 'Edit Petugas', icon: <Users size={18} />, color: 'magenta' },
                  { id: 'photo', label: 'Foto Profil', icon: <ImageIcon size={18} />, color: 'blue' },
                  { id: 'theme', label: 'Pengaturan Thema', icon: <Palette size={18} />, color: 'violet' },
                ].map((item) => (
                  <button 
                    key={item.id}
                    onClick={() => setSettingsPage(item.id as any)}
                    className="w-full flex items-center justify-between p-3 glass-cosmic rounded-xl border border-white/5 hover:bg-white/10 hover:border-white/10 transition-all group active:scale-[0.98]"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 bg-${item.color}-500/10 text-${item.color}-400 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform`}>
                        {item.icon}
                      </div>
                      <span className="text-[10px] font-black text-white uppercase tracking-widest">{item.label}</span>
                    </div>
                    <ChevronRight size={16} className="text-slate-600 group-hover:text-white transition-colors" />
                  </button>
                ))}
              </div>

              <div className="pt-6">
                <button 
                  onClick={onLogout}
                  className="w-full py-3 bg-rose-500/10 text-rose-400 font-black text-[10px] uppercase tracking-widest rounded-xl border border-rose-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  <LogOut size={14} /> Keluar Sistem
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <button 
                onClick={() => setSettingsPage(null)}
                className="flex items-center gap-2 text-[10px] font-black text-cyan-400 uppercase tracking-widest glass-cosmic px-4 py-2 rounded-xl border border-white/5 active:scale-95 transition-all mb-2"
              >
                <X size={14} /> Kembali ke Menu
              </button>

              {settingsPage === 'theme' && (
                <div className="glass-cosmic p-6 rounded-[2.5rem] shadow-xl border border-white/5">
                  <h3 className="text-base font-black text-white mb-6 flex items-center gap-2">
                    <div className="p-2 bg-violet-500/10 text-violet-400 rounded-xl"><Palette size={20}/></div> Pilih Thema Aplikasi
                  </h3>
                  <div className="grid grid-cols-1 gap-4">
                    {[
                      { id: 'cosmic', name: 'Cosmic Blue', desc: 'Thema galaksi dengan gradasi biru & ungu', colors: ['#1e1b4b', '#4c1d95', '#6366f1'] },
                      { id: 'emerald', name: 'Midnight Emerald', desc: 'Thema elegan dengan nuansa hijau zamrud', colors: ['#064e3b', '#115e59', '#10b981'] }
                    ].map((t) => (
                      <button
                        key={t.id}
                        onClick={() => {
                          localStorage.setItem('koperasi_theme', t.id);
                          document.documentElement.setAttribute('data-theme', t.id);
                          setSettingsPage(null);
                        }}
                        className={`w-full p-4 rounded-2xl border transition-all text-left flex items-center gap-4 ${
                          (localStorage.getItem('koperasi_theme') || 'cosmic') === t.id
                            ? 'bg-white/10 border-violet-500/50 ring-2 ring-violet-500/20'
                            : 'bg-white/5 border-white/10 hover:bg-white/10'
                        }`}
                      >
                        <div className="flex -space-x-2">
                          {t.colors.map((c, i) => (
                            <div key={i} className="w-6 h-6 rounded-full border border-white/20" style={{ backgroundColor: c }}></div>
                          ))}
                        </div>
                        <div className="flex-1">
                          <div className="text-[10px] font-black text-white uppercase tracking-widest">{t.name}</div>
                          <div className="text-[8px] font-bold text-slate-400">{t.desc}</div>
                        </div>
                        {(localStorage.getItem('koperasi_theme') || 'cosmic') === t.id && (
                          <div className="w-5 h-5 bg-violet-500 rounded-full flex items-center justify-center">
                            <Check size={12} className="text-white" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {settingsPage === 'modal' && (
                <div className="glass-cosmic p-6 rounded-[2.5rem] shadow-xl border border-white/5">
                  <h3 className="text-base font-black text-white mb-6 flex items-center gap-2">
                    <div className="p-2 bg-cyan-500/10 text-cyan-400 rounded-xl"><PlusCircle size={20}/></div> Input Modal Baru
                  </h3>
                  <form onSubmit={handleSaveModal} className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest px-1">Keterangan Transaksi</label>
                      <input name="keterangan" required placeholder="Keterangan setoran modal..." className="w-full px-4 py-4 rounded-2xl bg-white/5 border border-white/10 font-bold text-white text-xs outline-none focus:ring-2 focus:ring-cyan-500 shadow-inner" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest px-1">Jumlah Dana (Rp)</label>
                      <input name="jumlah" type="number" required placeholder="Contoh: 5000000" className="w-full px-4 py-4 rounded-2xl bg-white/5 border border-white/10 font-bold text-white text-xs outline-none focus:ring-2 focus:ring-cyan-500 shadow-inner" />
                    </div>
                    <button 
                      type="submit"
                      disabled={processingId === 'modal'}
                      className="w-full py-4 bg-cosmic-gradient text-white font-black text-xs rounded-2xl shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2 mt-4"
                    >
                      {processingId === 'modal' ? <Loader2 size={16} className="animate-spin"/> : <><Save size={16}/> Simpan Modal</>}
                    </button>
                  </form>
                </div>
              )}

              {settingsPage === 'members' && (
                <div className="flex flex-col min-h-[500px]">
                  {!editingMember && !isAddingMember ? (
                    <>
                      <div className="flex items-center justify-between mb-6 px-1">
                        <h3 className="text-base font-black text-white flex items-center gap-2">
                          <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl"><Database size={20}/></div> Anggota Tokata
                        </h3>
                        <button 
                          onClick={() => setIsAddingMember(true)}
                          className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30 active:scale-95 transition-all flex items-center gap-2 text-[10px] font-black uppercase tracking-widest"
                        >
                          <PlusCircle size={16} /> Tambah
                        </button>
                      </div>

                      <div className="mb-4 relative px-1">
                        <input 
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          placeholder="Cari Nasabah..." 
                          className="w-full pl-10 pr-4 py-3 bg-white/5 rounded-2xl border border-white/10 font-bold text-white text-xs outline-none focus:ring-2 focus:ring-emerald-500 shadow-inner"
                        />
                        <Search className="absolute left-4.5 top-3.5 text-slate-500" size={16} />
                      </div>

                      <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar px-1">
                        {nasabahList
                          .filter(n => (n.nama || "").toLowerCase().includes(searchTerm.toLowerCase()) || (n.id_nasabah || "").toLowerCase().includes(searchTerm.toLowerCase()))
                          .map(nasabah => (
                            <div key={nasabah.id_nasabah} className="flex items-center justify-between p-2.5 bg-white/5 rounded-xl border border-white/5 hover:bg-white/10 transition-all group">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-lg bg-white/10 border border-white/10 flex items-center justify-center text-slate-500 group-hover:text-emerald-400 transition-colors overflow-hidden">
                                  {nasabah.foto && nasabah.foto.length > 10 ? (
                                    <img src={nasabah.foto} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                  ) : (
                                    <User size={14} />
                                  )}
                                </div>
                                <div>
                                  <p className="text-[10px] font-black text-white leading-tight">{nasabah.nama}</p>
                                  <p className="text-[7px] text-slate-500 font-bold uppercase tracking-widest">{nasabah.id_nasabah} {nasabah.no_hp !== '-' ? `| ${nasabah.no_hp}` : ''}</p>
                                </div>
                              </div>
                              <button 
                                onClick={() => setEditingMember(nasabah)}
                                className="p-1.5 bg-white/5 text-slate-500 rounded-lg border border-white/10 hover:text-emerald-400 hover:border-emerald-500/30 active:scale-90 transition-all shadow-sm"
                              >
                                <Edit size={12} />
                              </button>
                            </div>
                          ))}
                      </div>
                    </>
                  ) : isAddingMember ? (
                    <div className="animate-in slide-in-from-right-4 duration-300 bg-white/5 p-6 rounded-[2.5rem] border border-white/5">
                      <div className="flex items-center gap-3 mb-6">
                        <button onClick={() => setIsAddingMember(false)} className="p-2 bg-white/5 rounded-xl text-slate-400"><X size={16}/></button>
                        <h3 className="text-base font-black text-white">Tambah Anggota Baru</h3>
                      </div>
                      <form onSubmit={handleAddMember} className="space-y-4">
                        <div className="space-y-1">
                          <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest px-1">NIK (KTP)</label>
                          <input name="nik" type="text" inputMode="numeric" required placeholder="16 Digit NIK..." className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 font-bold text-white text-xs outline-none focus:ring-2 focus:ring-emerald-500" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest px-1">Nama Lengkap</label>
                          <input name="nama" type="text" required placeholder="Nama sesuai KTP..." className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 font-bold text-white text-xs outline-none focus:ring-2 focus:ring-emerald-500" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest px-1">Nomor HP (Opsional)</label>
                          <input name="no_hp" type="text" inputMode="tel" placeholder="Kosongkan jika tidak ada..." className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 font-bold text-white text-xs outline-none focus:ring-2 focus:ring-emerald-500" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest px-1">PIN Keamanan (4 Digit)</label>
                          <input name="pin" type="text" inputMode="numeric" maxLength={4} required placeholder="1234" className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 font-bold text-center tracking-[0.5em] text-white text-xs outline-none focus:ring-2 focus:ring-emerald-500 shadow-inner" />
                        </div>
                        <button disabled={isUpdating} type="submit" className="w-full py-4 bg-cosmic-gradient text-white font-black text-xs rounded-2xl shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2 mt-4">
                          {isUpdating ? <Loader2 size={16} className="animate-spin"/> : <><Save size={16}/> Simpan Anggota</>}
                        </button>
                      </form>
                    </div>
                  ) : (
                    <div className="animate-in slide-in-from-right-4 duration-300 bg-white/5 p-6 rounded-[2.5rem] border border-white/5">
                      <div className="flex items-center gap-3 mb-6">
                        <button onClick={() => setEditingMember(null)} className="p-2 bg-white/5 rounded-xl text-slate-400"><X size={16}/></button>
                        <h3 className="text-base font-black text-white">Edit Anggota</h3>
                      </div>
                      <form onSubmit={handleUpdateMember} className="space-y-4">
                        <div className="space-y-1">
                          <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest px-1">ID Nasabah</label>
                          <input name="id_nasabah" type="text" defaultValue={editingMember?.id_nasabah} readOnly className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 font-bold text-slate-500 text-xs outline-none shadow-inner cursor-not-allowed" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest px-1">NIK (KTP)</label>
                          <input name="nik" type="text" inputMode="numeric" defaultValue={editingMember?.nik ? String(editingMember.nik).replace(/^'/, '') : ''} required className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 font-bold text-white text-xs outline-none focus:ring-2 focus:ring-emerald-500 shadow-inner" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest px-1">Nama Lengkap</label>
                          <input name="nama" type="text" defaultValue={editingMember?.nama} required className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 font-bold text-white text-xs outline-none focus:ring-2 focus:ring-emerald-500 shadow-inner" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest px-1">Nomor HP</label>
                          <input name="no_hp" type="text" inputMode="tel" defaultValue={editingMember?.no_hp ? String(editingMember.no_hp).replace(/^'/, '') : ''} required className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 font-bold text-white text-xs outline-none focus:ring-2 focus:ring-emerald-500 shadow-inner" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest px-1">PIN Keamanan (4 Digit)</label>
                          <input name="pin" type="text" inputMode="numeric" maxLength={4} defaultValue={editingMember?.pin ? String(editingMember.pin).replace(/^'/, '') : ''} required className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 font-bold text-center tracking-[0.5em] text-white text-xs outline-none focus:ring-2 focus:ring-emerald-500 shadow-inner" />
                        </div>
                        <button disabled={isUpdating} type="submit" className="w-full py-4 bg-emerald-600 text-white font-black text-xs rounded-2xl shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2 mt-4">
                          {isUpdating ? <Loader2 size={16} className="animate-spin"/> : 'Simpan Perubahan'}
                        </button>
                      </form>
                    </div>
                  )}
                </div>
              )}

              {settingsPage === 'staff' && (
                <div className="bg-white/5 p-4 rounded-[2.5rem] shadow-xl border border-white/5 flex flex-col min-h-[500px]">
                  {!editingPetugas ? (
                    <>
                      <h3 className="text-base font-black text-white mb-6 flex items-center gap-2">
                        <div className="p-2 bg-magenta-500/10 text-magenta-400 rounded-xl"><Users size={20}/></div> Daftar Petugas
                      </h3>
                      <div className="mb-4 relative">
                        <input 
                          value={searchPetugasTerm}
                          onChange={(e) => setSearchPetugasTerm(e.target.value)}
                          placeholder="Cari Petugas..." 
                          className="w-full pl-10 pr-4 py-3 bg-white/5 rounded-2xl border border-white/10 font-bold text-white text-xs outline-none focus:ring-2 focus:ring-magenta-500 shadow-inner"
                        />
                        <Search className="absolute left-3.5 top-3.5 text-slate-500" size={16} />
                      </div>

                      <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
                        {petugasList
                          .filter(p => (p.nama || "").toLowerCase().includes(searchPetugasTerm.toLowerCase()) || (p.id_petugas || "").toLowerCase().includes(searchPetugasTerm.toLowerCase()))
                          .map(staff => (
                            <div key={staff.id_petugas} className="flex items-center justify-between p-2.5 bg-white/5 rounded-xl border border-white/5 hover:bg-white/10 transition-all group">
                              <div className="flex items-center gap-2.5">
                                <div className="w-7 h-7 rounded-lg bg-white/5 border border-white/5 flex items-center justify-center text-slate-500 group-hover:text-magenta-400 transition-colors">
                                  <User size={14} />
                                </div>
                                <div>
                                  <p className="text-[10px] font-black text-white leading-tight">{staff.nama}</p>
                                  <p className="text-[7px] text-slate-500 font-bold uppercase tracking-widest">{staff.id_petugas} | {staff.jabatan}</p>
                                </div>
                              </div>
                              <button 
                                onClick={() => setEditingPetugas(staff)}
                                className="p-1.5 bg-white/5 text-slate-500 rounded-lg border border-white/10 hover:text-magenta-400 hover:border-magenta-500/30 active:scale-90 transition-all shadow-sm"
                              >
                                <Edit3 size={12} />
                              </button>
                            </div>
                          ))}
                      </div>
                    </>
                  ) : (
                    <div className="animate-in slide-in-from-right-4 duration-300">
                      <div className="flex items-center gap-3 mb-6">
                        <button onClick={() => setEditingPetugas(null)} className="p-2 bg-white/5 rounded-xl text-slate-400"><X size={16}/></button>
                        <h3 className="text-base font-black text-white">Edit Petugas</h3>
                      </div>
                      <form onSubmit={handleUpdatePetugas} className="space-y-4">
                        <div className="space-y-1">
                          <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest px-1">ID Petugas</label>
                          <input name="id_petugas" defaultValue={editingPetugas?.id_petugas} required className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 font-bold text-white text-xs outline-none focus:ring-2 focus:ring-magenta-500" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest px-1">Nama Lengkap</label>
                          <input name="nama" defaultValue={editingPetugas?.nama} required className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 font-bold text-white text-xs outline-none focus:ring-2 focus:ring-magenta-500" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest px-1">Password Baru</label>
                          <input name="password" defaultValue={editingPetugas?.password} required className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 font-bold text-white text-xs outline-none focus:ring-2 focus:ring-magenta-500 shadow-inner" />
                        </div>
                        <button disabled={isUpdating} type="submit" className="w-full py-4 bg-magenta-600 text-white font-black text-xs rounded-2xl shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2 mt-4">
                          {isUpdating ? <Loader2 size={16} className="animate-spin"/> : 'Simpan Perubahan'}
                        </button>
                      </form>
                    </div>
                  )}
                </div>
              )}

              {settingsPage === 'photo' && (
                <div className="glass-cosmic p-6 rounded-[2.5rem] shadow-xl border border-white/5">
                  <h3 className="text-base font-black text-white mb-6 flex items-center gap-2">
                    <div className="p-2 bg-blue-500/10 text-blue-400 rounded-xl"><ImageIcon size={20}/></div> Ganti Foto Profil
                  </h3>
                  
                  <div className="flex flex-col items-center gap-6 py-4">
                    <div className="relative">
                      <img 
                        src={adminPhoto || "https://picsum.photos/200"} 
                        className="w-32 h-32 rounded-[2rem] border-4 border-white/10 shadow-2xl object-cover" 
                        alt="preview" 
                        referrerPolicy="no-referrer"
                      />
                      {processingId === 'admin-photo' && (
                        <div className="absolute inset-0 bg-[#0f172a]/60 backdrop-blur-sm rounded-[2rem] flex items-center justify-center">
                          <Loader2 className="text-white animate-spin" size={32} />
                        </div>
                      )}
                    </div>

                    <div className="w-full space-y-4">
                      <input 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        ref={adminPhotoInputRef}
                        onChange={handleUpdateAdminPhoto}
                      />
                      <button 
                        onClick={() => adminPhotoInputRef.current?.click()}
                        className="w-full py-4 bg-white/5 border border-white/10 text-white font-black rounded-2xl text-[10px] uppercase tracking-widest hover:bg-white/10 transition-all flex items-center justify-center gap-2"
                      >
                        <ImageIcon size={16} /> Pilih Foto Baru
                      </button>
                      <p className="text-[8px] text-slate-500 font-bold uppercase tracking-widest text-center">Format: JPG, PNG (Maks 2MB)</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Editor Modals */}
      {editingPetugas && null}

      {/* Modal Detail Transaksi (Struk) */}
      {selectedTransaction && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="w-full max-w-xs glass-cosmic border border-white/10 rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="p-6 text-center space-y-4">
              <div className="flex justify-center">
                <div className="w-16 h-16 bg-tokata-gradient rounded-2xl flex items-center justify-center shadow-lg">
                  <ImageIcon className="text-white" size={32} />
                </div>
              </div>
              
              <div>
                <h2 className="text-lg font-black text-white tracking-tighter">TOKATA MANDIRI</h2>
                <p className="text-[8px] text-slate-500 font-bold uppercase tracking-[0.2em]">Bukti Transaksi Digital</p>
              </div>

              <div className="border-y border-dashed border-white/10 py-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-[8px] text-slate-500 font-black uppercase">Tipe Transaksi</span>
                  <span className="text-[10px] text-white font-black">{selectedTransaction.tipe}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[8px] text-slate-500 font-black uppercase">Keterangan</span>
                  <span className="text-[10px] text-white font-black text-right max-w-[150px]">{selectedTransaction.ket}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[8px] text-slate-500 font-black uppercase">Petugas</span>
                  <span className="text-[10px] text-white font-black">{selectedTransaction.petugas_display}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[8px] text-slate-500 font-black uppercase">Tanggal</span>
                  <span className="text-[10px] text-white font-black">{selectedTransaction.tanggal.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                </div>
                <div className="pt-2 flex justify-between items-center border-t border-dashed border-white/10">
                  <span className="text-[10px] text-slate-400 font-black uppercase">Total Nominal</span>
                  <span className="text-lg font-black text-cyan-400">Rp {selectedTransaction.nominal.toLocaleString('id-ID')}</span>
                </div>
              </div>

              <div className="pt-2">
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3">
                  <p className="text-[9px] text-emerald-400 font-black uppercase tracking-widest flex items-center justify-center gap-2">
                    <CheckCircle2 size={12} /> Transaksi Berhasil
                  </p>
                </div>
              </div>

              <button 
                onClick={() => setSelectedTransaction(null)}
                className="w-full py-3 bg-white/5 hover:bg-white/10 text-slate-400 font-black text-[10px] uppercase tracking-widest rounded-xl transition-all"
              >
                Tutup Struk
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Member Card Modal */}
      {showMemberCard && selectedNasabah && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="w-full max-w-sm space-y-6">
            {/* The Card */}
            <div 
              ref={memberCardRef}
              className="relative aspect-[1.586/1] w-full rounded-[1.5rem] p-6 shadow-2xl overflow-hidden border border-white/20 group"
            >
              {/* Background Image Layer */}
              <div 
                className="absolute inset-0 z-0 pointer-events-none transition-opacity duration-500"
                style={{ 
                  backgroundImage: `url(${CARD_CONFIG.tokataDigitalBackground})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  opacity: CARD_CONFIG.tokataDigitalOpacity
                }}
              />
              
              {/* Card Textures/Patterns */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-20 -mt-20 blur-3xl"></div>
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-black/20 rounded-full -ml-10 -mb-10 blur-2xl"></div>
              
              <div className="relative h-full flex flex-col justify-between">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h2 className="text-white font-black text-xs uppercase tracking-widest">{CARD_CONFIG.tokataDigitalTitle}</h2>
                    </div>
                    <p className="text-[7px] text-white/60 font-black uppercase tracking-[0.3em]">{CARD_CONFIG.tokataDigitalSubtitle}</p>
                  </div>
                </div>

                <div className="flex justify-between items-end">
                  <div className="space-y-3">
                    <div>
                      <p className="text-[6px] text-white/50 font-black uppercase tracking-widest mb-0.5">Nama Nasabah</p>
                      <p className="text-sm font-black text-white tracking-tight leading-none truncate max-w-[180px]">{selectedNasabah.nama}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-[6px] text-white/50 font-black uppercase tracking-widest mb-0.5">NIK</p>
                        <p className="text-[10px] font-black text-white tracking-widest">{selectedNasabah.nik}</p>
                      </div>
                      <div>
                        <p className="text-[6px] text-white/50 font-black uppercase tracking-widest mb-0.5">ID Nasabah</p>
                        <p className="text-[10px] font-black text-white tracking-widest">{selectedNasabah.id_nasabah}</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-[6px] text-white/50 font-black uppercase tracking-widest mb-0.5">Tanggal Cair</p>
                      <p className="text-[10px] font-black text-white">
                        {memberDetailData?.pinjaman?.[0]?.tanggal_cair 
                          ? new Date(memberDetailData.pinjaman[0].tanggal_cair).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
                          : '-'}
                      </p>
                    </div>
                  </div>

                  <div className="bg-white p-1.5 rounded-xl shadow-xl">
                    <img 
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${memberDetailData?.pinjaman?.[0]?.id_pinjaman || selectedNasabah.id_nasabah}`} 
                      alt="QR Code"
                      className="w-16 h-16"
                      referrerPolicy="no-referrer"
                      crossOrigin="anonymous"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={handleDownloadCard}
                disabled={processingId === 'download-card'}
                className="flex-1 py-4 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase tracking-widest rounded-2xl shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {processingId === 'download-card' ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                Download Kartu
              </button>
              <button 
                onClick={() => setShowMemberCard(false)} 
                className="flex-1 py-4 glass-cosmic rounded-2xl text-white text-xs font-black uppercase tracking-widest border border-white/10 active:scale-95 transition-all"
              >
                Tutup Kartu
              </button>
            </div>
          </div>
        </div>
      )}

      {showExpenseModal && (
        <div className="fixed inset-0 bg-[#0f172a]/80 backdrop-blur-sm z-[10000] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="glass-cosmic w-full max-w-xs rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-white/10">
            <div className="p-4 bg-white/5 border-b border-white/5 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-rose-500/10 text-rose-400 rounded-lg"><ArrowDownRight size={16}/></div>
                <h3 className="font-black text-white text-[10px] uppercase tracking-widest">Input Pengeluaran</h3>
              </div>
              <button onClick={() => setShowExpenseModal(false)} className="p-1.5 hover:bg-white/10 rounded-full text-slate-500 transition-colors"><X size={16}/></button>
            </div>
            
            <form onSubmit={handleSubmitExpense} className="p-5 space-y-4">
              <div className="space-y-1">
                <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest px-1">Jenis Pengeluaran</label>
                <select 
                  value={expenseData.jenis} 
                  onChange={(e) => setExpenseData({...expenseData, jenis: e.target.value})}
                  className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 font-bold text-white text-xs outline-none focus:ring-2 focus:ring-rose-500 shadow-inner"
                >
                  <option value="Gaji">Gaji / Honor</option>
                  <option value="Perawatan">Perawatan / Maintenance</option>
                  <option value="Listrik">Listrik & Internet</option>
                  <option value="ATK">ATK & Inventaris</option>
                  <option value="Lainnya">Lain-lain</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest px-1">Keterangan</label>
                <input 
                  required 
                  value={expenseData.keterangan} 
                  onChange={(e) => setExpenseData({...expenseData, keterangan: e.target.value})} 
                  placeholder="Deskripsi singkat..." 
                  className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 font-bold text-white text-xs outline-none focus:ring-2 focus:ring-rose-500 shadow-inner" 
                />
              </div>
              <div className="space-y-1">
                <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest px-1">Jumlah (Rp)</label>
                <input 
                  required 
                  type="number" 
                  value={expenseData.jumlah} 
                  onChange={(e) => setExpenseData({...expenseData, jumlah: e.target.value})} 
                  placeholder="0" 
                  className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/5 font-bold text-white text-xs outline-none focus:ring-2 focus:ring-red-500 shadow-inner" 
                />
              </div>

              <div className="space-y-1.5">
                <input type="file" accept="image/*" className="hidden" ref={expenseFileInputRef} onChange={handleFileChange} />
                <button 
                  type="button"
                  onClick={() => expenseFileInputRef.current?.click()} 
                  className={`w-full py-4 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-1 transition-all ${fotoExpense ? 'border-green-500 bg-green-500/10' : 'border-white/10 bg-white/5'}`}
                >
                  {fotoExpense ? <img src={fotoExpense} className="w-20 h-20 rounded-lg object-cover" referrerPolicy="no-referrer" /> : <ImageIcon size={24} className="text-slate-500"/>}
                  <span className="text-[8px] font-black uppercase text-slate-500 text-center">Ambil Foto Bukti</span>
                </button>
              </div>

              <button 
                disabled={!!processingId || !fotoExpense} 
                type="submit"
                className="w-full py-3.5 bg-red-600 text-white font-black text-xs rounded-xl shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2 disabled:bg-white/10 disabled:text-slate-500"
              >
                {processingId === 'expense' ? <Loader2 size={16} className="animate-spin" /> : <><CheckCircle2 size={16} /> Simpan Transaksi</>}
              </button>
            </form>
          </div>
        </div>
      )}
      {/* Modal Struk Pembayaran */}
      {selectedReceipt && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="w-full max-w-[280px] glass-cosmic rounded-[2rem] border border-white/10 overflow-hidden shadow-2xl">
            <div className="p-4 text-center border-b border-white/5">
              <div className="w-10 h-10 bg-emerald-500/10 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-2 border border-emerald-500/20">
                <CheckCircle2 size={20} />
              </div>
              <h3 className="text-sm font-black text-white uppercase tracking-widest">Struk Bayar</h3>
              <p className="text-[7px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">ID: {selectedReceipt.id_bayar || selectedReceipt.id_transaksi || 'N/A'}</p>
            </div>

            <div className="p-4 space-y-3">
              <div className="flex justify-between items-center py-1 border-b border-white/5">
                <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Tanggal</span>
                <span className="text-[8px] font-black text-white">{new Date(selectedReceipt.tanggal).toLocaleDateString('id-ID')}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-white/5">
                <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Nominal</span>
                <span className="text-xs font-black text-emerald-400">Rp {Number(selectedReceipt.nominal || 0).toLocaleString('id-ID')}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-white/5">
                <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Petugas</span>
                <span className="text-[8px] font-black text-white uppercase">{selectedReceipt.petugas_display || 'System'}</span>
              </div>

              {selectedReceipt.fotoBayar || selectedReceipt.bukti_bayar ? (
                <div className="pt-2">
                  <div 
                    onClick={() => setFullPhotoUrl(selectedReceipt.fotoBayar || selectedReceipt.bukti_bayar)}
                    className="w-16 h-16 mx-auto rounded-xl overflow-hidden border border-white/10 bg-white/5 cursor-pointer hover:scale-105 transition-transform"
                  >
                    <img 
                      src={selectedReceipt.fotoBayar || selectedReceipt.bukti_bayar} 
                      className="w-full h-full object-cover" 
                      referrerPolicy="no-referrer" 
                    />
                  </div>
                  <p className="text-[6px] text-center font-black text-slate-500 uppercase mt-1">Klik foto untuk perbesar</p>
                </div>
              ) : (
                <div className="py-4 text-center bg-white/5 rounded-xl border border-dashed border-white/10">
                  <ImageIcon size={16} className="text-slate-700 mx-auto mb-1" />
                  <p className="text-[6px] font-black text-slate-600 uppercase tracking-widest">Tanpa bukti foto</p>
                </div>
              )}
            </div>

            <div className="p-4 pt-0">
              <button 
                onClick={() => setSelectedReceipt(null)}
                className="w-full py-2.5 bg-white/5 hover:bg-white/10 text-white font-black text-[10px] rounded-xl border border-white/10 transition-all active:scale-95 uppercase tracking-widest"
              >
                Keluar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Foto Full Screen */}
      {fullPhotoUrl && (
        <div className="fixed inset-0 z-[110] flex flex-col items-center justify-center p-4 bg-black/95 animate-in zoom-in duration-300">
          <div className="w-full max-w-lg aspect-square rounded-3xl overflow-hidden border border-white/10 shadow-2xl mb-6">
            <img src={fullPhotoUrl} className="w-full h-full object-contain bg-black" referrerPolicy="no-referrer" />
          </div>
          <button 
            onClick={() => setFullPhotoUrl(null)}
            className="flex items-center gap-2 px-8 py-4 bg-white/10 hover:bg-white/20 text-white font-black text-xs rounded-2xl border border-white/10 transition-all active:scale-95 uppercase tracking-widest"
          >
            <X size={16} /> Kembali ke Struk
          </button>
        </div>
      )}
      {/* Modal Penjelasan Total Modal Tersalur */}
      {showExplanation && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="w-full max-w-sm bg-slate-900 rounded-[2.5rem] border border-white/10 shadow-2xl overflow-hidden animate-in zoom-in duration-300">
            <div className="p-6 bg-tokata-gradient relative">
              <button 
                onClick={() => setShowExplanation(false)}
                className="absolute top-4 right-4 p-2 bg-white/10 rounded-full text-white/70 hover:text-white transition-colors"
              >
                <X size={16} />
              </button>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-white/20 rounded-xl text-white">
                  <Database size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white tracking-tight">Rincian Modal</h3>
                  <p className="text-[8px] font-bold text-white/60 uppercase tracking-widest">Penjelasan Perhitungan</p>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="space-y-3">
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-slate-400 font-bold uppercase tracking-widest">Modal Awal</span>
                  <span className="text-cyan-400 font-black">Rp {stats.totalModal.toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-slate-400 font-bold uppercase tracking-widest">Semua Pinjaman (Pokok)</span>
                  <span className="text-rose-400 font-black">- Rp {stats.totalPinjamanCair.toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-slate-400 font-bold uppercase tracking-widest">Total Pengembalian</span>
                  <span className="text-indigo-400 font-black">+ Rp {stats.totalHutang.toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-slate-400 font-bold uppercase tracking-widest">Total Pemasukan</span>
                  <span className="text-emerald-400 font-black">+ Rp {stats.totalPemasukan.toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-slate-400 font-bold uppercase tracking-widest">Simpanan Bersih</span>
                  <span className="text-amber-400 font-black">+ Rp {stats.totalSimpanan.toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-slate-400 font-bold uppercase tracking-widest">Total Pengeluaran</span>
                  <span className="text-rose-400 font-black">- Rp {stats.totalPengeluaran.toLocaleString('id-ID')}</span>
                </div>
              </div>

              <div className="pt-4 border-t border-white/5">
                <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                  <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Hasil Akhir</p>
                  <p className="text-xl font-black text-white tracking-tighter">
                    Rp {stats.totalModalTersalur.toLocaleString('id-ID')}
                  </p>
                </div>
              </div>

              <p className="text-[8px] text-slate-500 font-medium leading-relaxed italic">
                *Total Modal Tersalur adalah gambaran seluruh kekayaan koperasi yang sedang berputar, mencakup modal awal, potensi pengembalian pinjaman (pokok + bunga), simpanan nasabah, dan pendapatan, dikurangi biaya operasional.
              </p>
            </div>

            <div className="p-6 pt-0">
              <button 
                onClick={() => setShowExplanation(false)}
                className="w-full py-3 bg-white/5 hover:bg-white/10 text-white font-black text-[10px] rounded-2xl border border-white/10 transition-all active:scale-95 uppercase tracking-widest"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Penjelasan Saldo Kas */}
      {showSaldoExplanation && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="w-full max-w-sm bg-slate-900 rounded-[2.5rem] border border-white/10 shadow-2xl overflow-hidden animate-in zoom-in duration-300">
            <div className="p-6 bg-tokata-gradient relative">
              <button 
                onClick={() => setShowSaldoExplanation(false)}
                className="absolute top-4 right-4 p-2 bg-white/10 rounded-full text-white/70 hover:text-white transition-colors"
              >
                <X size={16} />
              </button>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-white/20 rounded-xl text-white">
                  <Banknote size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white tracking-tight">Rincian Saldo Kas</h3>
                  <p className="text-[8px] font-bold text-white/60 uppercase tracking-widest">Dana di Tangan</p>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="space-y-3">
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-slate-400 font-bold uppercase tracking-widest">Modal Awal</span>
                  <span className="text-cyan-400 font-black">+ Rp {stats.totalModal.toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-slate-400 font-bold uppercase tracking-widest">Total Pemasukan</span>
                  <span className="text-emerald-400 font-black">+ Rp {stats.totalPemasukan.toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-slate-400 font-bold uppercase tracking-widest">Simpanan Bersih</span>
                  <span className="text-amber-400 font-black">+ Rp {stats.totalSimpanan.toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-slate-400 font-bold uppercase tracking-widest">Total Angsuran</span>
                  <span className="text-indigo-400 font-black">+ Rp {stats.totalAngsuran.toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-slate-400 font-bold uppercase tracking-widest">Pinjaman Cair</span>
                  <span className="text-rose-400 font-black">- Rp {stats.totalPinjamanCair.toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-slate-400 font-bold uppercase tracking-widest">Total Pengeluaran</span>
                  <span className="text-rose-400 font-black">- Rp {stats.totalPengeluaran.toLocaleString('id-ID')}</span>
                </div>
              </div>

              <div className="pt-4 border-t border-white/5">
                <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                  <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Saldo Kas Saat Ini</p>
                  <p className="text-xl font-black text-white tracking-tighter">
                    Rp {saldoKas.toLocaleString('id-ID')}
                  </p>
                </div>
              </div>

              <p className="text-[8px] text-slate-500 font-medium leading-relaxed italic">
                *Saldo Kas adalah dana tunai yang seharusnya ada di tangan/kas koperasi saat ini, dihitung dari seluruh uang masuk dikurangi seluruh uang keluar.
              </p>
            </div>

            <div className="p-6 pt-0">
              <button 
                onClick={() => setShowSaldoExplanation(false)}
                className="w-full py-3 bg-white/5 hover:bg-white/10 text-white font-black text-[10px] rounded-2xl border border-white/10 transition-all active:scale-95 uppercase tracking-widest"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Laporan Bulanan */}
      {showMonthlyReportModal && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-slate-900 w-full max-w-md rounded-[2.5rem] overflow-hidden shadow-2xl border border-white/10">
            <div className="p-6 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-cyan-500/10 rounded-xl text-cyan-400">
                  <Calendar size={20}/>
                </div>
                <h3 className="text-xl font-black text-white tracking-tight">Laporan Bulanan</h3>
              </div>
              <button 
                onClick={() => setShowMonthlyReportModal(false)}
                className="p-2 bg-white/5 rounded-xl text-slate-400 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div className="space-y-4">
                <label className="text-[10px] font-black text-cyan-400 uppercase tracking-widest block px-1">Pilih Bulan</label>
                <div className="flex overflow-x-auto gap-2 pb-2 no-scrollbar snap-x">
                  {["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"].map((m, i) => (
                    <button
                      key={i}
                      onClick={() => setReportMonth(i)}
                      className={`flex-shrink-0 px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all snap-center ${
                        reportMonth === i 
                          ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/30 scale-105' 
                          : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <label className="text-[10px] font-black text-cyan-400 uppercase tracking-widest block px-1">Pilih Tahun</label>
                <div className="flex overflow-x-auto gap-2 pb-2 no-scrollbar snap-x">
                  {[2024, 2025, 2026, 2027, 2028, 2029, 2030].map(y => (
                    <button
                      key={y}
                      onClick={() => setReportYear(y)}
                      className={`flex-shrink-0 px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all snap-center ${
                        reportYear === y 
                          ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 scale-105' 
                          : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                      }`}
                    >
                      {y}
                    </button>
                  ))}
                </div>
              </div>
              
              <button 
                onClick={generateMonthlyReportPDF}
                disabled={isGeneratingReport}
                className="w-full py-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white font-black uppercase tracking-widest rounded-2xl shadow-lg shadow-cyan-500/20 active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
              >
                {isGeneratingReport ? (
                  <Loader2 className="animate-spin" size={20} />
                ) : (
                  <FileText size={20} />
                )}
                {isGeneratingReport ? "Memproses..." : "Lihat Pratinjau Laporan"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Preview PDF Bulanan */}
      {monthlyPdfPreviewUrl && (
        <div className="fixed inset-0 z-[10001] flex flex-col bg-[#0f172a] animate-in slide-in-from-bottom duration-300">
          <div className="bg-slate-900 border-b border-white/5 p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => {
                  URL.revokeObjectURL(monthlyPdfPreviewUrl);
                  setMonthlyPdfPreviewUrl(null);
                  setNumMonthlyPages(null);
                }}
                className="p-2 bg-white/5 rounded-xl text-slate-400 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
              <div>
                <h3 className="text-sm font-black text-white uppercase tracking-widest">Pratinjau Laporan Bulanan</h3>
                <p className="text-[8px] text-cyan-400 font-black uppercase tracking-widest">
                  {["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"][reportMonth]} {reportYear}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => {
                  const link = document.createElement('a');
                  link.href = monthlyPdfPreviewUrl;
                  link.download = `Laporan_Bulanan_Tokata_${reportMonth + 1}_${reportYear}.pdf`;
                  link.click();
                }}
                className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg shadow-emerald-500/20 active:scale-95 transition-all"
              >
                <Download size={14} /> Unduh PDF
              </button>
              <button 
                onClick={() => {
                  if (monthlyPdfPreviewUrl) {
                    window.open(monthlyPdfPreviewUrl, '_blank');
                  }
                }}
                className="flex items-center gap-2 px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white text-[10px] font-black uppercase tracking-widest rounded-xl border border-white/10 active:scale-95 transition-all"
              >
                <FileText size={14} /> Buka PDF
              </button>
            </div>
          </div>
          <div className="flex-1 bg-slate-800 relative overflow-auto flex flex-col items-center p-4">
            <Document
              file={monthlyPdfPreviewUrl}
              onLoadSuccess={({ numPages }) => setNumMonthlyPages(numPages)}
              loading={
                <div className="flex flex-col items-center justify-center h-full text-white gap-4">
                  <Loader2 size={40} className="animate-spin text-cyan-500" />
                  <p className="text-xs font-black uppercase tracking-widest">Memuat PDF...</p>
                </div>
              }
              error={
                <div className="flex flex-col items-center justify-center h-full text-white gap-4">
                  <X size={40} className="text-rose-500" />
                  <p className="text-xs font-black uppercase tracking-widest">Gagal memuat PDF</p>
                </div>
              }
            >
              {Array.from(new Array(numMonthlyPages), (el, index) => (
                <div key={`page_${index + 1}`} className="mb-4 shadow-2xl">
                  <Page 
                    pageNumber={index + 1} 
                    width={Math.min(window.innerWidth - 32, 800)}
                    renderAnnotationLayer={false}
                    renderTextLayer={false}
                  />
                </div>
              ))}
            </Document>
          </div>
        </div>
      )}
      {showReportDateModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="w-full max-w-md glass-cosmic rounded-[2.5rem] border border-white/10 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="bg-cosmic-gradient p-6 text-center relative">
              <button 
                onClick={() => setShowReportDateModal(false)}
                className="absolute top-4 right-4 p-2 bg-white/10 rounded-full text-white/70 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
              <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center text-white mx-auto mb-4 shadow-xl">
                <FileText size={32} />
              </div>
              <h3 className="text-xl font-black text-white tracking-tight">Laporan Harian</h3>
              <p className="text-cyan-200 text-[10px] font-black uppercase tracking-widest opacity-80">Pilih Tanggal Laporan</p>
            </div>
            
            <div className="p-8 space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Tanggal Laporan</label>
                <div className="relative">
                  <input 
                    type="date" 
                    value={reportDate}
                    onChange={(e) => setReportDate(e.target.value)}
                    className="w-full px-5 py-4 rounded-2xl bg-white/5 border border-white/10 text-white font-bold outline-none focus:ring-2 focus:ring-emerald-500 shadow-inner appearance-none"
                  />
                  <Calendar className="absolute right-5 top-4 text-slate-500 pointer-events-none" size={20} />
                </div>
              </div>

              <div className="bg-emerald-500/5 border border-emerald-500/10 p-4 rounded-2xl">
                <p className="text-[9px] text-emerald-400 font-bold leading-relaxed">
                  <span className="block mb-1 font-black uppercase tracking-widest">Informasi Laporan:</span>
                  Laporan ini akan mencakup Mutasi Kas, Target Tagihan, Klaim Transport, dan Validasi Setoran untuk tanggal yang dipilih.
                </p>
              </div>

              <button 
                onClick={generateDailyReportPDF}
                disabled={isGeneratingReport}
                className="w-full py-4 bg-emerald-500 text-white font-black rounded-2xl shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
              >
                {isGeneratingReport ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    <span>Menyiapkan PDF...</span>
                  </>
                ) : (
                  <>
                    <Download size={20} />
                    <span>Lihat Pratinjau Laporan</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Preview PDF */}
      {pdfPreviewUrl && (
        <div className="fixed inset-0 z-[10001] flex flex-col bg-[#0f172a] animate-in slide-in-from-bottom duration-300">
          <div className="bg-slate-900 border-b border-white/5 p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => {
                  URL.revokeObjectURL(pdfPreviewUrl);
                  setPdfPreviewUrl(null);
                  setNumPages(null);
                }}
                className="p-2 bg-white/5 rounded-xl text-slate-400 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
              <div>
                <h3 className="text-sm font-black text-white uppercase tracking-widest">Pratinjau Laporan</h3>
                <p className="text-[8px] text-cyan-400 font-black uppercase tracking-widest">
                  {new Date(reportDate).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => {
                  const link = document.createElement('a');
                  link.href = pdfPreviewUrl;
                  link.download = `Laporan_Harian_Tokata_${reportDate}.pdf`;
                  link.click();
                }}
                className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg shadow-emerald-500/20 active:scale-95 transition-all"
              >
                <Download size={14} /> Unduh PDF
              </button>
              <button 
                onClick={() => {
                  if (pdfPreviewUrl) {
                    window.open(pdfPreviewUrl, '_blank');
                  }
                }}
                className="flex items-center gap-2 px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white text-[10px] font-black uppercase tracking-widest rounded-xl border border-white/10 active:scale-95 transition-all"
              >
                <FileText size={14} /> Buka PDF
              </button>
            </div>
          </div>
          <div className="flex-1 bg-slate-800 relative overflow-auto flex flex-col items-center p-4">
            <Document
              file={pdfPreviewUrl}
              onLoadSuccess={({ numPages }) => setNumPages(numPages)}
              loading={
                <div className="flex flex-col items-center justify-center h-full text-white gap-4">
                  <Loader2 size={40} className="animate-spin text-cyan-500" />
                  <p className="text-xs font-black uppercase tracking-widest">Memuat PDF...</p>
                </div>
              }
              error={
                <div className="flex flex-col items-center justify-center h-full text-white gap-4">
                  <X size={40} className="text-rose-500" />
                  <p className="text-xs font-black uppercase tracking-widest">Gagal memuat PDF</p>
                </div>
              }
            >
              {Array.from(new Array(numPages), (el, index) => (
                <div key={`page_${index + 1}`} className="mb-4 shadow-2xl">
                  <Page 
                    pageNumber={index + 1} 
                    width={Math.min(window.innerWidth - 32, 800)}
                    renderAnnotationLayer={false}
                    renderTextLayer={false}
                  />
                </div>
              ))}
            </Document>
          </div>
        </div>
      )}

      {/* Modal Validasi Setoran */}
      {showValidationView && (
        <div className="fixed inset-0 bg-[#0f172a] z-[10000] flex flex-col animate-in slide-in-from-bottom duration-300 overflow-hidden">
          <div className="pt-8 pb-4 px-6 border-b border-white/5 relative overflow-hidden bg-[#0f172a]">
            <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 rounded-full -mr-16 -mt-16 blur-3xl"></div>
            <div className="flex justify-between items-center relative z-10">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-cyan-500/20 rounded-xl text-cyan-400">
                  <ClipboardCheck size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-white tracking-tight">Validasi Setoran</h3>
                  <p className="text-[8px] font-bold text-slate-500 uppercase tracking-[0.3em]">Monitoring Selisih Kolektor</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => fetchData()}
                  className="p-2 bg-white/10 rounded-full text-white/70 hover:text-white transition-colors"
                  title="Refresh Data"
                >
                  <RefreshCcw size={20} className={loading ? 'animate-spin' : ''} />
                </button>
                <button 
                  onClick={() => {
                    setShowValidationView(false);
                    setSelectedCollectorForDetail(null);
                    setIsAddingValidation(false);
                  }}
                  className="p-2 bg-white/10 rounded-full text-white/70 hover:text-white transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-6 pb-24">
            {!isAddingValidation && !selectedCollectorForDetail ? (
              <>
                <div className="flex justify-between items-center">
                  <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Riwayat Validasi</h4>
                  <button 
                    onClick={() => {
                      setValidationForm({
                        id_petugas: '',
                        nama_kolektor: '',
                        total_tagihan_sistem: 0,
                        total_setoran_fisik: 0,
                        keterangan_admin: '',
                        status_penyelesaian: 'Belum Selesai',
                        bukti_foto: '',
                        tanggal: new Date().toISOString().split('T')[0]
                      });
                      setIsAddingValidation(true);
                    }}
                    className="px-4 py-2 bg-cyan-500 text-white text-[10px] font-black rounded-xl shadow-lg active:scale-95 transition-all uppercase tracking-widest flex items-center gap-2"
                  >
                    <PlusCircle size={14} /> Input Baru
                  </button>
                </div>

                <div className="space-y-2">
                  {uniqueCollectorValidations.length === 0 ? (
                    <div className="py-20 text-center glass-cosmic rounded-3xl border border-white/5">
                      <Database size={40} className="mx-auto text-slate-700 mb-4 opacity-20" />
                      <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Belum ada data validasi</p>
                    </div>
                  ) : (
                    uniqueCollectorValidations.map((val, idx) => (
                      <div 
                        key={idx} 
                        onClick={() => {
                          setSelectedCollectorForDetail(val.id_petugas);
                          const d = new Date(val.tanggal);
                          setViewingMonth(d.getMonth());
                          setViewingYear(d.getFullYear());
                        }}
                        className="glass-cosmic p-3 rounded-xl border border-white/5 hover:bg-white/5 transition-all cursor-pointer group"
                      >
                        <div className="flex justify-between items-center gap-3">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                              val.totalMinus > 0 ? 'bg-rose-500/20 text-rose-400' : 'bg-emerald-500/10 text-emerald-400'
                            }`}>
                              <User size={16} />
                            </div>
                            <div>
                              <p className="text-[10px] font-black text-white group-hover:text-cyan-400 transition-colors">{val.nama_kolektor}</p>
                              <p className="text-[7px] text-slate-500 font-bold uppercase tracking-widest">
                                {val.count} Validasi • Terakhir {new Date(val.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className={`text-[10px] font-black ${val.totalMinus > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                              {val.totalMinus > 0 ? `Minus Rp ${val.totalMinus.toLocaleString('id-ID')}` : 'Sesuai / Aman'}
                            </p>
                            <p className="text-[6px] font-black text-slate-500 uppercase tracking-widest">
                              Klik untuk Detail
                            </p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </>
            ) : selectedCollectorForDetail ? (
              <div className="animate-in fade-in slide-in-from-right duration-300 space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <button onClick={() => setSelectedCollectorForDetail(null)} className="p-2 bg-white/5 rounded-xl text-slate-400"><ChevronRight size={16} className="rotate-180" /></button>
                    <div>
                      <h4 className="text-xs font-black text-white uppercase tracking-widest">Detail Kolektor</h4>
                      <p className="text-[10px] font-black text-cyan-400 uppercase tracking-widest">
                        {petugasList.find(p => p.id_petugas === selectedCollectorForDetail)?.nama}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-2xl">
                    <p className="text-[8px] font-black text-rose-400 uppercase tracking-widest">Total Minus</p>
                    <p className="text-sm font-black text-white">
                      Rp {validationList
                        .filter(v => v.id_petugas === selectedCollectorForDetail && Number(v.selisih) < 0 && v.status_penyelesaian === 'Belum Selesai')
                        .reduce((acc, cur) => acc + Math.abs(Number(cur.selisih)), 0)
                        .toLocaleString('id-ID')}
                    </p>
                  </div>
                  <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-2xl">
                    <p className="text-[8px] font-black text-emerald-400 uppercase tracking-widest">Total Selesai</p>
                    <p className="text-sm font-black text-white">
                      Rp {validationList
                        .filter(v => v.id_petugas === selectedCollectorForDetail && v.status_penyelesaian === 'Sudah Ditutupi')
                        .reduce((acc, cur) => acc + Math.abs(Number(cur.selisih)), 0)
                        .toLocaleString('id-ID')}
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between px-1">
                    <h5 className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Riwayat Validasi Kolektor</h5>
                    <div className="flex items-center gap-2 bg-white/5 p-1 rounded-lg border border-white/10">
                      <button 
                        onClick={() => {
                          if (viewingMonth === 0) {
                            setViewingMonth(11);
                            setViewingYear(v => v - 1);
                          } else {
                            setViewingMonth(v => v - 1);
                          }
                        }}
                        className="p-1 text-cyan-400 hover:bg-cyan-500/10 rounded transition-colors"
                      >
                        <ChevronRight size={14} className="rotate-180" />
                      </button>
                      <p className="text-[8px] font-black text-white uppercase tracking-widest min-w-[80px] text-center">
                        {MONTHS_ID[viewingMonth]} {viewingYear}
                      </p>
                      <button 
                        onClick={() => {
                          if (viewingMonth === 11) {
                            setViewingMonth(0);
                            setViewingYear(v => v + 1);
                          } else {
                            setViewingMonth(v => v + 1);
                          }
                        }}
                        className="p-1 text-cyan-400 hover:bg-cyan-500/10 rounded transition-colors"
                      >
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {validationList
                      .filter(v => {
                        const d = new Date(v.tanggal);
                        return v.id_petugas === selectedCollectorForDetail && 
                               d.getMonth() === viewingMonth && 
                               d.getFullYear() === viewingYear;
                      })
                      .sort((a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime())
                      .map((val, idx) => (
                      <div key={idx} className="relative overflow-hidden bg-white/5 rounded-xl border border-white/10 flex items-stretch h-14 animate-in fade-in slide-in-from-bottom duration-300" style={{ animationDelay: `${idx * 50}ms` }}>
                        {/* Left side: Date */}
                        <div className="w-14 flex flex-col items-center justify-center bg-white/5 border-r border-dashed border-white/10">
                          <p className="text-[14px] font-black text-white leading-none">{new Date(val.tanggal).getDate()}</p>
                          <p className="text-[6px] font-bold text-slate-500 uppercase tracking-tighter">{new Date(val.tanggal).toLocaleDateString('id-ID', { month: 'short' })}</p>
                        </div>
                        
                        {/* Middle: Info */}
                        <div className="flex-1 px-3 flex flex-col justify-center">
                          <div className="flex items-center gap-2">
                            <p className={`text-[9px] font-black ${Number(val.selisih) < 0 ? 'text-rose-400' : Number(val.selisih) > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                              {Number(val.selisih) === 0 ? 'AMAN' : `${Number(val.selisih) > 0 ? '+' : ''}Rp ${Math.abs(Number(val.selisih)).toLocaleString('id-ID')}`}
                            </p>
                            <div className={`px-1.5 py-0.5 rounded text-[5px] font-black uppercase tracking-widest ${
                              (val.status_penyelesaian === 'Sudah Ditutupi' || Number(val.selisih) === 0) ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                            }`}>
                              {Number(val.selisih) === 0 ? 'PAS' : val.status_penyelesaian === 'Sudah Ditutupi' ? 'CLOSED' : 'OPEN'}
                            </div>
                          </div>
                          <p className="text-[6px] text-slate-500 font-bold uppercase tracking-tighter mt-0.5">
                            Sys: {Number(val.total_tagihan_sistem).toLocaleString('id-ID')} • Cash: {Number(val.total_setoran_fisik).toLocaleString('id-ID')}
                          </p>
                        </div>

                        {/* Right side: Action */}
                        {val.status_penyelesaian === 'Belum Selesai' && Number(val.selisih) !== 0 && (
                          <button 
                            onClick={() => handleUpdateValidationStatus(val, 'Sudah Ditutupi')}
                            className="px-3 bg-cyan-500 text-white flex items-center justify-center active:bg-cyan-600 transition-colors"
                            title="Tandai Selesai"
                          >
                            <ClipboardCheck size={14} />
                          </button>
                        )}
                        
                        {/* Photo Indicator if exists */}
                        {val.bukti_foto && (
                          <button 
                            onClick={() => setFullPhotoUrl(val.bukti_foto)}
                            className="px-2 flex items-center justify-center text-slate-500 hover:text-cyan-400 transition-colors"
                          >
                            <ImageIcon size={12} />
                          </button>
                        )}
                      </div>
                    ))}

                    {validationList.filter(v => {
                      const d = new Date(v.tanggal);
                      return v.id_petugas === selectedCollectorForDetail && 
                             d.getMonth() === viewingMonth && 
                             d.getFullYear() === viewingYear;
                    }).length === 0 && (
                      <div className="py-10 text-center">
                        <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest">Tidak ada data di bulan ini</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="animate-in fade-in slide-in-from-right duration-300">
                <div className="mb-6 flex items-center gap-2">
                  <button onClick={() => setIsAddingValidation(false)} className="p-2 bg-white/5 rounded-xl text-slate-400"><X size={16}/></button>
                  <h4 className="text-xs font-black text-white uppercase tracking-widest">Input Validasi Baru</h4>
                </div>

                <form onSubmit={handleSaveValidation} className="space-y-5">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Tanggal Validasi</label>
                    <input 
                      type="date"
                      required
                      value={validationForm.tanggal}
                      onChange={(e) => setValidationForm({...validationForm, tanggal: e.target.value})}
                      className="w-full px-5 py-4 rounded-2xl bg-white/5 border border-white/10 text-white font-black text-sm outline-none focus:ring-2 focus:ring-cyan-500 shadow-inner"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Pilih Kolektor</label>
                    <div className="grid grid-cols-1 gap-2">
                      {petugasList.filter(p => p.jabatan === 'Kolektor').map((p, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => {
                            const tagihan = calculateTodayTagihan(p.id_petugas, validationForm.tanggal);
                            setValidationForm({
                              ...validationForm,
                              id_petugas: p.id_petugas,
                              nama_kolektor: p.nama,
                              total_tagihan_sistem: tagihan
                            });
                          }}
                          className={`p-4 rounded-2xl border transition-all flex items-center justify-between ${
                            validationForm.id_petugas === p.id_petugas 
                            ? 'bg-cyan-500/20 border-cyan-500 shadow-lg shadow-cyan-500/10' 
                            : 'bg-white/5 border-white/10'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-slate-700 overflow-hidden border border-white/10">
                              {p.foto ? <img src={p.foto} className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : <User size={16} className="m-auto mt-2 text-slate-500" />}
                            </div>
                            <div className="text-left">
                              <p className="text-[10px] font-black text-white">{p.nama}</p>
                              <p className="text-[7px] text-slate-500 font-bold uppercase tracking-widest">{p.id_petugas}</p>
                            </div>
                          </div>
                          {validationForm.id_petugas === p.id_petugas && <CheckCircle2 size={16} className="text-cyan-400" />}
                        </button>
                      ))}
                    </div>
                  </div>

                  {validationForm.id_petugas && (
                    <div className="space-y-5 animate-in fade-in slide-in-from-top duration-300">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-cyan-500/10 border border-cyan-500/20 p-4 rounded-2xl">
                          <p className="text-[8px] font-black text-cyan-400 uppercase tracking-widest">Tagihan Sistem</p>
                          <p className="text-sm font-black text-white">Rp {validationForm.total_tagihan_sistem.toLocaleString('id-ID')}</p>
                        </div>
                        <div className="bg-white/5 border border-white/10 p-4 rounded-2xl relative overflow-hidden">
                          <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Selisih</p>
                          {(() => {
                            const diff = (validationForm.total_setoran_fisik || 0) - validationForm.total_tagihan_sistem;
                            const status = diff === 0 ? 'Pas' : diff < 0 ? 'Minus' : 'Lebih';
                            const color = diff === 0 ? 'text-emerald-400' : diff < 0 ? 'text-rose-400' : 'text-cyan-400';
                            return (
                              <div className="flex flex-col">
                                <p className={`text-sm font-black ${color}`}>Rp {Math.abs(diff).toLocaleString('id-ID')}</p>
                                <p className={`text-[7px] font-bold uppercase tracking-widest ${color}`}>{status}</p>
                              </div>
                            );
                          })()}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Total Setoran Fisik (Tunai)</label>
                        <div className="relative">
                          <span className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 font-black text-sm">Rp</span>
                          <input 
                            type="text"
                            required
                            value={validationForm.total_setoran_fisik === 0 ? '' : Number(validationForm.total_setoran_fisik).toLocaleString('id-ID')}
                            onChange={(e) => {
                              const val = e.target.value.replace(/\D/g, '');
                              setValidationForm({...validationForm, total_setoran_fisik: Number(val)});
                            }}
                            className="w-full pl-12 pr-5 py-4 rounded-2xl bg-white/5 border border-white/10 text-white font-black text-sm outline-none focus:ring-2 focus:ring-cyan-500 shadow-inner"
                            placeholder="0"
                          />
                        </div>
                      </div>

                      <div className="pt-4">
                        <button 
                          disabled={!!processingId}
                          type="submit"
                          className="w-full py-4 bg-tokata-gradient text-white font-black rounded-2xl shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3 uppercase tracking-widest text-xs"
                        >
                          {processingId === 'save-validation' ? <Loader2 size={18} className="animate-spin" /> : <><Save size={18} /> Simpan Validasi</>}
                        </button>
                      </div>
                    </div>
                  )}
                </form>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
