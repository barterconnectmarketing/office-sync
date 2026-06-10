import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Car,
  Calendar as CalendarIcon,
  CheckCircle2,
  AlertCircle,
  MapPin,
  LayoutGrid,
  Trash2,
  XCircle,
  Lock,
  Unlock,
  Users,
  Presentation,
  Info,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

// --- Constants ---
const ADMIN_PASSWORD = '8001';

const ZONE_A_TOP        = ['A1','A2','A3','A4','A5','A6','A7','A8'];
const ZONE_A_MID_UP     = ['A9','A10','A11'];
const ZONE_A_MID_DOWN   = ['A12','A13','A14'];
const ZONE_A_BOTTOM     = ['A15','A16','A17','A18','A19','A20','A21','A22'];
const ZONE_B_TOP        = ['B1','B2','B3','B4','B5','B6'];
const ZONE_B_MID_ISLAND = ['B7','B8','B9'];

const MEETING_ROOMS = [
  { id: 'MR1', name: 'Meeting Room 1', capacity: '10-12 ท่าน', color: 'bg-indigo-500', lightColor: 'bg-indigo-500/60', textColor: 'text-indigo-300' },
  { id: 'MR2', name: 'Meeting Room 2', capacity: '6-8 ท่าน',   color: 'bg-emerald-500', lightColor: 'bg-emerald-500/60', textColor: 'text-emerald-300' },
  { id: 'MR3', name: 'Meeting Room 3', capacity: '4 ท่าน',     color: 'bg-amber-500',   lightColor: 'bg-amber-500/60',   textColor: 'text-amber-300' },
];

const DEFAULT_PARKING_LOCKS = [
  { itemId: 'B1',  userName: 'K.Fon_SL' },
  { itemId: 'B2',  userName: 'K.Lak_TL' },
  { itemId: 'B3',  userName: 'K.Dew_HO' },
  { itemId: 'B4',  userName: 'K.Nok_HO' },
  { itemId: 'B5',  userName: 'K.Nui_HO' },
  { itemId: 'B6',  userName: 'K.Pop_HO' },
  { itemId: 'A15', userName: 'K.Nok_SL' },
];

const WEEKLY_ROOM_LOCKS = [
  { day: 1, itemId: 'MR1', userName: 'TC Meeting',          startTime: '09:00', endTime: '12:00', purpose: 'Weekly TC Sync' },
  { day: 2, itemId: 'MR1', userName: 'Management Meeting',  startTime: '09:00', endTime: '12:00', purpose: 'Management Review' },
];

// --- Booking type ---
interface Booking {
  id: string;
  itemId: string;
  type: string;
  userId?: string;
  userName: string;
  date: string;
  startTime: string;
  endTime: string;
  purpose?: string;
  isRelease?: boolean;
  releaseKey?: string;
  timestamp?: number;
  isDefault?: boolean;
}

// --- Monthly Calendar Component ---
interface MonthlyCalendarProps {
  calYear: number; calMonth: number;
  setCalYear: React.Dispatch<React.SetStateAction<number>>;
  setCalMonth: React.Dispatch<React.SetStateAction<number>>;
  monthBookings: Booking[];
  viewDate: string;
  setViewDate: React.Dispatch<React.SetStateAction<string>>;
}

const THAI_MONTHS = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];

function MonthlyCalendar({ calYear, calMonth, setCalYear, setCalMonth, monthBookings, viewDate, setViewDate }: MonthlyCalendarProps) {
  const today = new Date().toLocaleDateString('sv-SE');

  const prevMonth = () => {
    if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11); }
    else setCalMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0); }
    else setCalMonth(m => m + 1);
  };

  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  let startDow      = new Date(calYear, calMonth, 1).getDay();
  startDow          = startDow === 0 ? 6 : startDow - 1;

  const cells: (number | null)[] = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const getDayRooms = (day: number) => {
    const dateStr    = new Date(calYear, calMonth, day).toLocaleDateString('sv-SE');
    const dow        = new Date(calYear, calMonth, day).getDay();
    const dbBooks    = monthBookings.filter(b => b.date === dateStr && !b.isRelease && b.type === 'meeting');
    const releases   = monthBookings.filter(b => b.date === dateStr && b.isRelease).map(b => b.releaseKey ?? '');
    const weeklyIds  = WEEKLY_ROOM_LOCKS
      .filter(l => l.day === dow && !releases.includes(`room-${l.itemId}-${l.startTime}-${dateStr}`))
      .map(l => l.itemId);
    const booked = new Set([...dbBooks.map(b => b.itemId), ...weeklyIds]);
    return MEETING_ROOMS.map(r => ({ room: r, booked: booked.has(r.id) }));
  };

  return (
    <div className="mt-8 pt-8 border-t border-white/10">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h3 className="font-black italic uppercase text-sm tracking-wider flex items-center gap-2">
          <CalendarIcon size={16} className="text-indigo-400" /> ตารางรายเดือน
        </h3>
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-all">
            <ChevronLeft size={16} />
          </button>
          <span className="font-black text-sm w-40 text-center">{THAI_MONTHS[calMonth]} {calYear}</span>
          <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-all">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {['จ','อ','พ','พฤ','ศ','ส','อา'].map(d => (
          <div key={d} className="text-center text-[9px] font-black text-slate-500 uppercase py-1">{d}</div>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (!day) return <div key={`e-${i}`} className="aspect-square" />;
          const dateStr    = new Date(calYear, calMonth, day).toLocaleDateString('sv-SE');
          const isToday    = dateStr === today;
          const isSelected = dateStr === viewDate;
          const rooms      = getDayRooms(day);
          const anyBooked  = rooms.some(r => r.booked);
          return (
            <button
              key={dateStr}
              onClick={() => setViewDate(dateStr)}
              className={`aspect-square rounded-xl p-1 flex flex-col items-center justify-center gap-0.5 transition-all ${
                isSelected ? 'bg-indigo-500 ring-2 ring-indigo-300 ring-offset-1 ring-offset-slate-900'
                : isToday  ? 'bg-white/15 ring-1 ring-white/40'
                : anyBooked ? 'bg-white/5 hover:bg-white/10'
                : 'hover:bg-white/5'
              }`}
            >
              <span className={`text-[10px] font-black leading-none ${isSelected || isToday ? 'text-white' : 'text-slate-300'}`}>
                {day}
              </span>
              <div className="flex gap-[2px]">
                {rooms.map(({ room, booked }) => (
                  <div key={room.id} className={`w-1 h-1 rounded-full ${
                    booked ? (room.id === 'MR1' ? 'bg-indigo-400' : room.id === 'MR2' ? 'bg-emerald-400' : 'bg-amber-400')
                    : isSelected ? 'bg-white/30' : 'bg-white/15'
                  }`} />
                ))}
              </div>
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-4 pt-4 border-t border-white/10">
        {MEETING_ROOMS.map(r => (
          <div key={r.id} className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${r.id === 'MR1' ? 'bg-indigo-400' : r.id === 'MR2' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">{r.name}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-white/15" />
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">ว่าง</span>
        </div>
      </div>
    </div>
  );
}

// --- Session ID (ใช้แทน Firebase anonymous auth) ---
function getSessionId(): string {
  let id = localStorage.getItem('office_session_id');
  if (!id) {
    id = `user_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    localStorage.setItem('office_session_id', id);
  }
  return id;
}

export default function App() {
  const [activeTab, setActiveTab]           = useState<'parking' | 'meeting'>('parking');
  const [sessionId]                         = useState<string>(getSessionId);
  const [isAdmin, setIsAdmin]               = useState(false);
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminPassInput, setAdminPassInput] = useState('');
  const [allBookings, setAllBookings]       = useState<Booking[]>([]);
  const [viewDate, setViewDate]             = useState(() => new Date().toLocaleDateString('sv-SE'));
  const [currentTime, setCurrentTime]       = useState(() =>
    new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  );
  const [selectedItem, setSelectedItem]     = useState<string | null>(null);
  const [bookingDetails, setBookingDetails] = useState({ name: '', startTime: '08:00', endTime: '18:00', purpose: '' });
  const [loading, setLoading]               = useState(true);
  const [message, setMessage]               = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [calYear, setCalYear]               = useState(() => new Date().getFullYear());
  const [calMonth, setCalMonth]             = useState(() => new Date().getMonth()); // 0-indexed
  const [monthBookings, setMonthBookings]   = useState<Booking[]>([]);

  // นาฬิกา
  useEffect(() => {
    const t = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }));
    }, 60000);
    return () => clearInterval(t);
  }, []);

  // Fetch bookings จาก API
  const fetchBookings = useCallback(async () => {
    try {
      const res  = await fetch(`/api/bookings?date=${viewDate}`);
      const data = await res.json();
      setAllBookings(data);
    } catch {
      // network error — ใช้ข้อมูลเดิมต่อไป
    } finally {
      setLoading(false);
    }
  }, [viewDate]);

  // Fetch ครั้งแรก + polling ทุก 8 วิ
  useEffect(() => {
    setLoading(true);
    fetchBookings();
    const interval = setInterval(fetchBookings, 8000);
    return () => clearInterval(interval);
  }, [fetchBookings]);

  // Fetch monthly bookings เมื่อเปลี่ยนเดือน
  useEffect(() => {
    const start = new Date(calYear, calMonth, 1).toLocaleDateString('sv-SE');
    const end   = new Date(calYear, calMonth + 1, 0).toLocaleDateString('sv-SE');
    fetch(`/api/bookings/range?start=${start}&end=${end}`)
      .then(r => r.json())
      .then(setMonthBookings)
      .catch(() => {});
  }, [calYear, calMonth]);

  // รวม real bookings + default locks
  const currentDayBookings = useMemo<Booking[]>(() => {
    const actual       = allBookings.filter(b => b.date === viewDate);
    const releasedKeys = actual.filter(b => b.isRelease).map(b => b.releaseKey ?? b.itemId);

    const parkingLocks: Booking[] = DEFAULT_PARKING_LOCKS
      .filter(lock => !releasedKeys.includes(`parking-${lock.itemId}-${viewDate}`))
      .filter(lock => !actual.some(b => b.itemId === lock.itemId && !b.isRelease))
      .map(lock => ({
        id: `default-p-${lock.itemId}-${viewDate}`,
        itemId: lock.itemId, userName: lock.userName,
        startTime: '00:00', endTime: '23:59',
        type: 'parking', isDefault: true, date: viewDate,
      }));

    const dayOfWeek = new Date(viewDate).getDay();
    const roomLocks: Booking[] = WEEKLY_ROOM_LOCKS
      .filter(lock => lock.day === dayOfWeek)
      .filter(lock => !releasedKeys.includes(`room-${lock.itemId}-${lock.startTime}-${viewDate}`))
      .map(lock => ({
        id: `default-r-${lock.itemId}-${lock.startTime}-${viewDate}`,
        itemId: lock.itemId, userName: lock.userName,
        startTime: lock.startTime, endTime: lock.endTime,
        type: 'meeting', purpose: lock.purpose,
        isDefault: true, date: viewDate,
      }));

    return [...actual.filter(b => !b.isRelease), ...parkingLocks, ...roomLocks];
  }, [allBookings, viewDate]);

  const getRoomStatus = (roomId: string) => {
    const isToday = viewDate === new Date().toLocaleDateString('sv-SE');
    if (!isToday) return { status: 'idle', label: 'View Mode', user: '' };
    const cur = currentDayBookings.find(
      b => b.itemId === roomId && currentTime >= b.startTime && currentTime < b.endTime
    );
    if (cur) return { status: 'occupied', label: 'ไม่ว่าง', user: cur.userName };
    return { status: 'available', label: 'ว่าง', user: '' };
  };

  const showMsg = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;

    if (bookingDetails.startTime >= bookingDetails.endTime) {
      showMsg('error', 'เวลาเริ่มต้องมาก่อนเวลาสิ้นสุด');
      return;
    }
    const isOverlap = currentDayBookings.some(
      b => b.itemId === selectedItem &&
           bookingDetails.startTime < b.endTime &&
           bookingDetails.endTime   > b.startTime
    );
    if (isOverlap) {
      showMsg('error', 'ไม่สามารถจองได้: ช่วงเวลานี้มีคนจองไว้แล้ว');
      return;
    }

    const newBooking: Booking = {
      id:        `${selectedItem}_${viewDate}_${Date.now()}`,
      itemId:    selectedItem,
      type:      activeTab,
      userId:    sessionId,
      userName:  bookingDetails.name || 'ผู้ใช้งานทั่วไป',
      date:      viewDate,
      startTime: bookingDetails.startTime,
      endTime:   bookingDetails.endTime,
      purpose:   bookingDetails.purpose,
      timestamp: Date.now(),
    };

    try {
      const res = await fetch('/api/bookings', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(newBooking),
      });
      if (!res.ok) throw new Error();
      showMsg('success', `จอง ${selectedItem} เรียบร้อยแล้ว`);
      setSelectedItem(null);
      setBookingDetails(d => ({ ...d, name: '', purpose: '' }));
      fetchBookings();
    } catch {
      showMsg('error', 'เกิดข้อผิดพลาดในการจอง');
    }
  };

  const handleDelete = async (booking: Booking) => {
    try {
      if (booking.isDefault) {
        const kind       = booking.type === 'parking' ? 'parking' : 'room';
        const timePrefix = booking.type === 'meeting' ? `${booking.startTime}-` : '';
        const releaseKey = `${kind}-${booking.itemId}-${timePrefix}${viewDate}`;
        await fetch('/api/bookings', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            id: `release-${releaseKey}`, itemId: booking.itemId,
            date: viewDate, isRelease: true, releaseKey,
            userId: sessionId, timestamp: Date.now(),
            type: booking.type, startTime: booking.startTime, endTime: booking.endTime,
          }),
        });
      } else {
        await fetch(`/api/bookings/${encodeURIComponent(booking.id)}`, { method: 'DELETE' });
      }
      showMsg('success', 'ยกเลิกรายการเรียบร้อยแล้ว');
      fetchBookings();
    } catch {
      showMsg('error', 'ไม่สามารถยกเลิกรายการได้');
    }
  };

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminPassInput === ADMIN_PASSWORD) {
      setIsAdmin(true);
      setShowAdminLogin(false);
      setAdminPassInput('');
      showMsg('success', 'เข้าสู่โหมดผู้ดูแลระบบแล้ว');
    } else {
      showMsg('error', 'รหัสผ่านไม่ถูกต้อง');
    }
  };

  // --- Sub-component: ParkingSpot ---
  const ParkingSpot = ({ id, className = '', isHorizontal = false }: { id: string; className?: string; isHorizontal?: boolean }) => {
    const spotBookings = currentDayBookings.filter(b => b.itemId === id && b.type === 'parking');
    const occupied  = spotBookings.length > 0;
    const isDefault = spotBookings.some(b => b.isDefault);
    const selected  = selectedItem === id;

    return (
      <button
        type="button"
        onClick={() => setSelectedItem(id)}
        className={`relative group flex ${isHorizontal ? 'flex-row gap-2 px-3 py-1' : 'flex-col py-2'} items-center justify-center border transition-all duration-200 ${className} ${
          selected
            ? 'bg-blue-600 border-blue-700 text-white shadow-lg z-20 scale-105 ring-4 ring-blue-100'
            : occupied
              ? isDefault ? 'bg-amber-50 border-amber-200' : 'bg-rose-50 border-rose-200'
              : 'bg-white border-slate-300 hover:border-blue-500 hover:bg-blue-50'
        }`}
      >
        <span className={`font-black ${selected ? 'text-white' : occupied ? (isDefault ? 'text-amber-700' : 'text-rose-600') : 'text-slate-800'} ${isHorizontal ? 'text-[9px]' : 'text-[11px]'}`}>
          {id}
        </span>
        {occupied ? (
          <div className="flex flex-col items-center">
            <Car size={isHorizontal ? 12 : 16} className={`${selected ? 'text-white' : isDefault ? 'text-amber-500' : 'text-rose-500'}`} />
            {!isHorizontal && (
              <span className="text-[7px] font-bold truncate max-w-[45px] mt-0.5 uppercase opacity-70">
                {spotBookings[0].userName.split(' ')[0]}
              </span>
            )}
          </div>
        ) : (
          <div className={`rounded-full ${selected ? 'bg-white' : 'bg-emerald-500'} w-1.5 h-1.5`} />
        )}
        {isDefault && !selected && (
          <div className="absolute top-0 right-0 p-0.5">
            <Lock size={8} className="text-amber-400" />
          </div>
        )}
      </button>
    );
  };

  // --- Loading ---
  if (loading) return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
        <p className="font-black text-slate-500 tracking-widest uppercase">กำลังเชื่อมต่อ...</p>
      </div>
    </div>
  );

  // --- Main UI ---
  return (
    <div className="min-h-screen bg-slate-50 p-4 lg:p-8 font-sans text-slate-900">

      {/* Admin Login Modal */}
      {showAdminLogin && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-sm p-8 rounded-[2.5rem] shadow-2xl">
            <h2 className="text-2xl font-black text-center mb-6 tracking-tighter uppercase">Admin Access</h2>
            <form onSubmit={handleAdminLogin} className="space-y-4">
              <input
                autoFocus
                type="password"
                placeholder="Password"
                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-center font-black tracking-[0.5em] outline-none focus:border-blue-500 shadow-inner"
                value={adminPassInput}
                onChange={e => setAdminPassInput(e.target.value)}
              />
              <div className="grid grid-cols-2 gap-3">
                <button type="button" onClick={() => setShowAdminLogin(false)} className="py-4 font-black text-slate-400">Cancel</button>
                <button type="submit" className="bg-blue-600 text-white py-4 rounded-2xl font-black">Login</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="max-w-[1400px] mx-auto">

        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
          <div className="flex flex-col">
            <div className="flex items-center gap-3 mb-1">
              <div className="bg-blue-600 p-2 rounded-xl text-white shadow-lg">
                <LayoutGrid size={24} />
              </div>
              <h1 className="text-3xl font-black tracking-tighter uppercase italic">
                Office <span className="text-blue-600">Sync</span>
              </h1>
            </div>
            <p className="text-blue-600 font-black text-[10px] uppercase tracking-widest ml-11">
              เวลาปัจจุบัน: {currentTime}
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="bg-slate-200 p-1 rounded-2xl flex gap-1 shadow-inner">
              <button
                onClick={() => { setActiveTab('parking'); setSelectedItem(null); }}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${activeTab === 'parking' ? 'bg-white shadow-md text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <Car size={16} /> ที่จอดรถ
              </button>
              <button
                onClick={() => { setActiveTab('meeting'); setSelectedItem(null); }}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${activeTab === 'meeting' ? 'bg-white shadow-md text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <Presentation size={16} /> ห้องประชุม
              </button>
            </div>
            <div className="flex items-center gap-3 bg-white px-4 py-2.5 rounded-2xl border border-slate-200 shadow-sm">
              <CalendarIcon size={18} className="text-blue-600" />
              <input
                type="date"
                value={viewDate}
                onChange={e => setViewDate(e.target.value)}
                className="font-black text-slate-800 outline-none bg-transparent text-sm"
              />
            </div>
            <button
              onClick={() => { if (isAdmin) setIsAdmin(false); else setShowAdminLogin(true); }}
              className={`p-2.5 rounded-xl border transition-all ${isAdmin ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-white border-slate-200 text-slate-400 hover:text-blue-600'}`}
            >
              {isAdmin ? <Unlock size={20} /> : <Lock size={20} />}
            </button>
          </div>
        </div>

        {/* Message Banner */}
        {message && (
          <div className={`mb-6 p-4 rounded-2xl flex items-center gap-3 border-l-4 shadow-sm ${
            message.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-500' : 'bg-rose-50 text-rose-800 border-rose-500'
          }`}>
            {message.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
            <span className="font-bold text-sm tracking-tight">{message.text}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8 space-y-8">

            {/* Meeting Dashboard */}
            {activeTab === 'meeting' && (
              <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-2xl">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                  <div>
                    <h2 className="text-2xl font-black italic uppercase tracking-tighter flex items-center gap-3">
                      <LayoutGrid className="text-indigo-400" /> Meeting Dashboard
                    </h2>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                      สรุปสถานะการใช้ห้องประชุมแบบ Real-time
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {MEETING_ROOMS.map(room => {
                    const { status, label, user } = getRoomStatus(room.id);
                    return (
                      <div key={room.id} className="bg-white/5 border border-white/10 rounded-3xl p-5">
                        <div className="flex justify-between items-start mb-4">
                          <h3 className={`font-black italic text-lg ${room.textColor}`}>{room.name}</h3>
                          <div className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                            status === 'available' ? 'bg-emerald-500/20 text-emerald-400' :
                            status === 'occupied'  ? 'bg-rose-500/20 text-rose-400 animate-pulse' :
                                                     'bg-slate-700 text-slate-400'
                          }`}>{label}</div>
                        </div>
                        {status === 'occupied' ? (
                          <div className="space-y-1">
                            <p className="text-[10px] text-slate-400 uppercase font-black italic">กำลังใช้งานโดย</p>
                            <p className="font-black truncate">{user}</p>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-emerald-400/40">
                            <CheckCircle2 size={14} />
                            <span className="text-[10px] font-black uppercase italic">พร้อมใช้งาน</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Monthly Calendar */}
                <MonthlyCalendar
                  calYear={calYear}
                  calMonth={calMonth}
                  setCalYear={setCalYear}
                  setCalMonth={setCalMonth}
                  monthBookings={monthBookings}
                  viewDate={viewDate}
                  setViewDate={setViewDate}
                />

                {/* Timeline */}
                <div className="mt-8 pt-8 border-t border-white/10 overflow-x-auto">
                  <div className="min-w-[700px] space-y-6">
                    <div className="flex items-center gap-4">
                      <div className="w-32 shrink-0 text-[10px] font-black text-slate-500 uppercase italic">รายการ / เวลา</div>
                      <div className="flex-1 flex justify-between px-2 text-[10px] font-black text-slate-600 italic">
                        {['08:00','10:00','12:00','14:00','16:00','18:00'].map(t => <span key={t}>{t}</span>)}
                      </div>
                    </div>
                    {MEETING_ROOMS.map(room => {
                      const roomBookings = currentDayBookings.filter(b => b.itemId === room.id && b.type === 'meeting');
                      return (
                        <div key={room.id} className="flex items-center gap-4">
                          <div className={`w-32 shrink-0 font-black text-xs uppercase italic tracking-tighter ${room.textColor}`}>
                            {room.name}
                          </div>
                          <div className="flex-1 h-4 bg-white/5 rounded-full relative overflow-hidden">
                            {roomBookings.map(b => {
                              const [sh, sm] = b.startTime.split(':').map(Number);
                              const [eh, em] = b.endTime.split(':').map(Number);
                              const dayStart = 8 * 60, dayEnd = 18 * 60;
                              const startMin = sh * 60 + sm - dayStart;
                              const endMin   = eh * 60 + em - dayStart;
                              const total    = dayEnd - dayStart;
                              const left  = Math.max(0, (startMin / total) * 100);
                              const width = Math.min(100 - left, ((endMin - startMin) / total) * 100);
                              if (width <= 0) return null;
                              return (
                                <div
                                  key={b.id}
                                  style={{ left: `${left}%`, width: `${width}%` }}
                                  className={`absolute top-0 h-full ${b.isDefault ? 'bg-amber-500/60' : room.lightColor} border-x border-white/20`}
                                />
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Parking Map / Room Cards */}
            <div className="bg-white p-6 md:p-10 rounded-[3rem] border border-slate-200 shadow-xl overflow-x-auto min-h-[500px]">
              {activeTab === 'parking' ? (
                <div className="min-w-[800px] flex flex-col gap-6">
                  <div className="flex justify-between items-end border-b pb-4">
                    <h2 className="text-xl font-black flex items-center gap-2 uppercase italic tracking-tighter">
                      <MapPin size={22} className="text-blue-600" /> แผนผังที่จอดรถ
                    </h2>
                    <div className="flex gap-4">
                      <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 bg-amber-400 rounded-full" /><span className="text-[9px] font-black uppercase text-slate-400">Fixed</span></div>
                      <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 bg-rose-500 rounded-full" /><span className="text-[9px] font-black uppercase text-slate-400">Booked</span></div>
                      <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 bg-emerald-500 rounded-full" /><span className="text-[9px] font-black uppercase text-slate-400">Available</span></div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-12">
                    <div className="space-y-4">
                      <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest text-center">ZONE A (OUTDOOR)</p>
                      <div className="grid grid-cols-8 gap-0.5 bg-slate-200 p-0.5 rounded-lg">
                        {ZONE_A_TOP.map(id => <ParkingSpot key={id} id={id} className="aspect-[3/5]" />)}
                      </div>
                      <div className="grid grid-cols-3 gap-2 py-4 px-2 bg-slate-50 border border-dashed border-slate-200 rounded-2xl">
                        {ZONE_A_MID_UP.map(id => <ParkingSpot key={id} id={id} isHorizontal className="h-12 rounded-lg" />)}
                        {ZONE_A_MID_DOWN.map(id => <ParkingSpot key={id} id={id} isHorizontal className="h-12 rounded-lg" />)}
                      </div>
                      <div className="grid grid-cols-8 gap-0.5 bg-slate-200 p-0.5 rounded-lg">
                        {ZONE_A_BOTTOM.map(id => <ParkingSpot key={id} id={id} className="aspect-[3/5]" />)}
                      </div>
                    </div>
                    <div className="space-y-4">
                      <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest text-center">ZONE B (INDOOR)</p>
                      <div className="grid grid-cols-6 gap-0.5 bg-slate-200 p-0.5 rounded-lg">
                        {ZONE_B_TOP.map(id => <ParkingSpot key={id} id={id} className="aspect-[3/5]" />)}
                      </div>
                      <div className="grid grid-cols-3 gap-2 py-4 px-2 bg-slate-50 border border-dashed border-slate-200 rounded-2xl">
                        {ZONE_B_MID_ISLAND.map(id => <ParkingSpot key={id} id={id} isHorizontal className="h-12 rounded-lg" />)}
                      </div>
                      <div className="h-28 flex items-center justify-center border-2 border-dashed border-slate-100 rounded-2xl">
                        <p className="text-[10px] font-black text-slate-300 italic">ทางเข้าอาคาร</p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {MEETING_ROOMS.map(room => {
                    const isSelected    = selectedItem === room.id;
                    const roomBookings  = currentDayBookings.filter(b => b.itemId === room.id && b.type === 'meeting');
                    return (
                      <button
                        key={room.id}
                        onClick={() => setSelectedItem(room.id)}
                        className={`text-left p-6 rounded-[2.5rem] border-2 transition-all ${
                          isSelected ? `ring-4 ring-offset-2 ring-slate-200 ${room.color} text-white` : 'bg-white border-slate-100 hover:border-slate-300'
                        }`}
                      >
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-6 ${isSelected ? 'bg-white/20' : 'bg-slate-50 text-slate-600'}`}>
                          <Users size={24} />
                        </div>
                        <h3 className="text-lg font-black tracking-tight mb-1 italic">{room.name}</h3>
                        <p className="text-[10px] font-bold uppercase tracking-widest mb-4 opacity-70">{room.capacity}</p>
                        <div className="space-y-2">
                          <p className="text-[9px] font-black uppercase opacity-50">ตารางวันนี้:</p>
                          {roomBookings.length > 0 ? (
                            roomBookings.slice(0, 3).map(b => (
                              <div key={b.id} className="text-[10px] font-bold flex justify-between gap-2">
                                <span className="shrink-0">{b.startTime}-{b.endTime}</span>
                                <span className="opacity-70 truncate flex items-center gap-1">
                                  {b.isDefault && <Lock size={8} />} {b.userName}
                                </span>
                              </div>
                            ))
                          ) : <p className="text-[10px] italic opacity-50">ว่างตลอดวัน</p>}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-4">
            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-xl sticky top-8">
              {selectedItem ? (
                <form onSubmit={handleBooking} className="space-y-5">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-black italic tracking-tighter uppercase">จองรายการ</h3>
                    <button type="button" onClick={() => setSelectedItem(null)} className="text-slate-400 hover:text-rose-500">
                      <XCircle size={24} />
                    </button>
                  </div>

                  <div className={`p-6 rounded-3xl text-white shadow-xl ${
                    activeTab === 'parking'
                      ? 'bg-blue-600'
                      : MEETING_ROOMS.find(r => r.id === selectedItem)?.color ?? 'bg-indigo-600'
                  }`}>
                    <p className="text-[10px] font-black opacity-60 uppercase tracking-widest mb-1">SELECTED</p>
                    <div className="text-4xl font-black italic tracking-tighter">
                      {activeTab === 'parking' ? selectedItem : MEETING_ROOMS.find(r => r.id === selectedItem)?.name}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase ml-1">เริ่ม</label>
                      <input type="time" required className="w-full p-3 bg-slate-50 border rounded-xl font-black"
                        value={bookingDetails.startTime} onChange={e => setBookingDetails(d => ({ ...d, startTime: e.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase ml-1">ถึง</label>
                      <input type="time" required className="w-full p-3 bg-slate-50 border rounded-xl font-black"
                        value={bookingDetails.endTime} onChange={e => setBookingDetails(d => ({ ...d, endTime: e.target.value }))} />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1">ชื่อผู้จอง / แผนก</label>
                    <input type="text" required placeholder="ระบุชื่อของคุณ"
                      className="w-full p-4 bg-slate-50 border rounded-xl font-black"
                      value={bookingDetails.name} onChange={e => setBookingDetails(d => ({ ...d, name: e.target.value }))} />
                  </div>

                  {activeTab === 'meeting' && (
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase ml-1">หัวข้อประชุม</label>
                      <input type="text" placeholder="ระบุหัวข้อ (ถ้ามี)"
                        className="w-full p-4 bg-slate-50 border rounded-xl font-black"
                        value={bookingDetails.purpose} onChange={e => setBookingDetails(d => ({ ...d, purpose: e.target.value }))} />
                    </div>
                  )}

                  <button className={`w-full py-4 rounded-2xl text-white font-black shadow-lg transition-all active:scale-95 ${activeTab === 'parking' ? 'bg-blue-600' : 'bg-slate-900'}`}>
                    ยืนยันการจอง
                  </button>
                </form>
              ) : (
                <div className="text-center py-12">
                  <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
                    <Info size={32} />
                  </div>
                  <p className="text-slate-400 font-black text-xs uppercase tracking-widest italic">
                    กรุณาเลือก{activeTab === 'parking' ? 'ที่จอดรถ' : 'ห้องประชุม'}<br />เพื่อเริ่มต้นการจอง
                  </p>
                </div>
              )}

              {/* Booking List */}
              <div className="mt-8 pt-6 border-t">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 italic text-center">รายการจองวันนี้</p>
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
                  {currentDayBookings.filter(b => b.type === activeTab).length > 0 ? (
                    currentDayBookings.filter(b => b.type === activeTab).map(b => (
                      <div key={b.id} className={`p-3 rounded-xl flex justify-between items-center ${b.isDefault ? 'bg-amber-50 border border-amber-100' : 'bg-slate-50'}`}>
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-[10px] italic shrink-0 ${b.isDefault ? 'bg-amber-500 text-white' : 'bg-slate-900 text-white'}`}>
                            {b.itemId.replace('MR', '')}
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-black italic flex items-center gap-1.5 truncate">
                              {b.userName}
                              {b.isDefault && <Lock size={10} className="text-amber-500 shrink-0" />}
                            </div>
                            <div className="text-[9px] font-bold text-slate-400">{b.startTime}-{b.endTime}</div>
                          </div>
                        </div>
                        {(isAdmin || b.userId === sessionId) && (
                          <button onClick={() => handleDelete(b)} className="text-slate-300 hover:text-rose-500 ml-2 shrink-0">
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="text-center py-4 text-[10px] text-slate-300 italic">ไม่มีรายการจอง</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
