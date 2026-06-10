import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  doc, 
  onSnapshot, 
  setDoc,
  deleteDoc,
} from 'firebase/firestore';
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged,
  signInWithCustomToken 
} from 'firebase/auth';
import { 
  Car, 
  Clock, 
  Calendar as CalendarIcon, 
  CheckCircle2, 
  AlertCircle,
  MapPin,
  LayoutGrid,
  Trash2,
  ShieldCheck,
  XCircle,
  Lock,
  Unlock,
  Users,
  Presentation,
  Info
} from 'lucide-react';

// --- Firebase Configuration ---
const firebaseConfig = JSON.parse(__firebase_config);
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'parking-app-001';

const ADMIN_PASSWORD = "8001"; 

// --- Constants ---
const ZONE_A_TOP = ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8'];
const ZONE_A_MID_UP = ['A9', 'A10', 'A11'];
const ZONE_A_MID_DOWN = ['A12', 'A13', 'A14'];
const ZONE_A_BOTTOM = ['A15', 'A16', 'A17', 'A18', 'A19', 'A20', 'A21', 'A22'];
const ZONE_B_TOP = ['B1', 'B2', 'B3', 'B4', 'B5', 'B6'];
const ZONE_B_MID_ISLAND = ['B7', 'B8', 'B9'];

const MEETING_ROOMS = [
  { id: 'MR1', name: 'Meeting Room 1', capacity: '10-12 ท่าน', color: 'bg-indigo-500', lightColor: 'bg-indigo-500/60', textColor: 'text-indigo-300' },
  { id: 'MR2', name: 'Meeting Room 2', capacity: '6-8 ท่าน', color: 'bg-emerald-500', lightColor: 'bg-emerald-500/60', textColor: 'text-emerald-300' },
  { id: 'MR3', name: 'Meeting Room 3', capacity: '4 ท่าน', color: 'bg-amber-500', lightColor: 'bg-amber-500/60', textColor: 'text-amber-300' },
];

// รายการ Lock ที่จอดรถพื้นฐาน (Fixed Positions)
const DEFAULT_PARKING_LOCKS = [
  { itemId: 'B1', userName: 'K.Fon_SL' },
  { itemId: 'B2', userName: 'K.Lak_TL' },
  { itemId: 'B3', userName: 'K.Dew_HO' },
  { itemId: 'B4', userName: 'K.Nok_HO' },
  { itemId: 'B5', userName: 'K.Nui_HO' },
  { itemId: 'B6', userName: 'K.Pop_HO' },
  { itemId: 'A15', userName: 'K.Nok_SL' },
];

// รายการ Lock ห้องประชุมรายสัปดาห์
const WEEKLY_ROOM_LOCKS = [
  { 
    day: 1, // Monday
    itemId: 'MR1', 
    userName: 'TC Meeting', 
    startTime: '09:00', 
    endTime: '12:00',
    purpose: 'Weekly TC Sync'
  },
  { 
    day: 2, // Tuesday
    itemId: 'MR1', 
    userName: 'Management Meeting', 
    startTime: '09:00', 
    endTime: '12:00',
    purpose: 'Management Review'
  }
];

export default function App() {
  const [activeTab, setActiveTab] = useState('parking');
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminPassInput, setAdminPassInput] = useState("");
  const [allBookings, setAllBookings] = useState([]);
  const [viewDate, setViewDate] = useState(new Date().toLocaleDateString('sv-SE'));
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }));
  const [selectedItem, setSelectedItem] = useState(null); 
  const [bookingDetails, setBookingDetails] = useState({
    name: '',
    startTime: '08:00',
    endTime: '18:00',
    purpose: ''
  });
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }));
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) { console.error("Auth error:", err); }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    const q = collection(db, 'artifacts', appId, 'public', 'data', 'bookings');
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = [];
      snapshot.forEach((doc) => {
        data.push({ id: doc.id, ...doc.data() });
      });
      setAllBookings(data);
      setLoading(false);
    }, (error) => {
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user]);

  // รวมรายการจองจริงกับรายการ Lock อัตโนมัติ
  const currentDayBookings = useMemo(() => {
    const actualBookings = allBookings.filter(b => b.date === viewDate);
    const releasedItems = actualBookings.filter(b => b.isRelease).map(b => b.releaseKey || b.itemId);
    
    // 1. ที่จอดรถ Default
    const parkingLocks = DEFAULT_PARKING_LOCKS
      .filter(lock => !releasedItems.includes(`parking-${lock.itemId}-${viewDate}`))
      .filter(lock => !actualBookings.some(b => b.itemId === lock.itemId && !b.isRelease))
      .map(lock => ({
        id: `default-p-${lock.itemId}-${viewDate}`,
        itemId: lock.itemId,
        userName: lock.userName,
        startTime: '00:00',
        endTime: '23:59',
        type: 'parking',
        isDefault: true,
        date: viewDate
      }));

    // 2. ห้องประชุม Weekly
    const dayOfWeek = new Date(viewDate).getDay();
    const roomLocks = WEEKLY_ROOM_LOCKS
      .filter(lock => lock.day === dayOfWeek)
      .filter(lock => !releasedItems.includes(`room-${lock.itemId}-${lock.startTime}-${viewDate}`))
      .map(lock => ({
        id: `default-r-${lock.itemId}-${lock.startTime}-${viewDate}`,
        itemId: lock.itemId,
        userName: lock.userName,
        startTime: lock.startTime,
        endTime: lock.endTime,
        type: 'meeting',
        purpose: lock.purpose,
        isDefault: true,
        date: viewDate
      }));

    return [...actualBookings.filter(b => !b.isRelease), ...parkingLocks, ...roomLocks];
  }, [allBookings, viewDate]);

  const getRoomStatus = (roomId) => {
    const isToday = viewDate === new Date().toLocaleDateString('sv-SE');
    if (!isToday) return { status: 'idle', label: 'View Mode' };

    const currentBooking = currentDayBookings.find(b => 
      b.itemId === roomId && currentTime >= b.startTime && currentTime < b.endTime
    );

    if (currentBooking) return { status: 'occupied', label: 'ไม่ว่าง', user: currentBooking.userName };
    return { status: 'available', label: 'ว่าง' };
  };

  const handleBooking = async (e) => {
    e.preventDefault();
    if (!selectedItem || !user) return;

    if (bookingDetails.startTime >= bookingDetails.endTime) {
      setMessage({ type: 'error', text: 'เวลาเริ่มต้องมาก่อนเวลาสิ้นสุด' });
      return;
    }

    const isOverlap = currentDayBookings.some(existing => {
      return (
        existing.itemId === selectedItem &&
        bookingDetails.startTime < existing.endTime &&
        bookingDetails.endTime > existing.startTime
      );
    });

    if (isOverlap) {
      setMessage({ type: 'error', text: 'ไม่สามารถจองได้: ช่วงเวลานี้มีคนจองไว้แล้ว' });
      return;
    }

    const bookingDocId = `${selectedItem}_${viewDate}_${Date.now()}`;
    const newBooking = {
      itemId: selectedItem,
      type: activeTab,
      userId: user.uid,
      userName: bookingDetails.name || 'ผู้ใช้งานทั่วไป',
      date: viewDate,
      startTime: bookingDetails.startTime,
      endTime: bookingDetails.endTime,
      purpose: bookingDetails.purpose || '',
      timestamp: Date.now()
    };

    try {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'bookings', bookingDocId), newBooking);
      setMessage({ type: 'success', text: `จอง ${selectedItem} เรียบร้อยแล้ว` });
      setSelectedItem(null);
      setBookingDetails({ ...bookingDetails, name: '', purpose: '' });
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      setMessage({ type: 'error', text: 'เกิดข้อผิดพลาดในการจอง' });
    }
  };

  const handleDelete = async (booking) => {
    try {
      if (booking.isDefault) {
        // สร้าง record release โดยระบุ key ที่เจาะจงประเภท
        const type = booking.type === 'parking' ? 'parking' : 'room';
        const releaseKey = `${type}-${booking.itemId}-${booking.type === 'meeting' ? booking.startTime + '-' : ''}${viewDate}`;
        const releaseId = `release-${releaseKey}`;
        
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'bookings', releaseId), {
          releaseKey: releaseKey,
          itemId: booking.itemId,
          date: viewDate,
          isRelease: true,
          userId: user.uid,
          timestamp: Date.now()
        });
      } else {
        await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'bookings', booking.id));
      }
      setMessage({ type: 'success', text: 'ยกเลิกรายการเรียบร้อยแล้ว' });
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      setMessage({ type: 'error', text: 'ไม่สามารถยกเลิกรายการได้' });
    }
  };

  const handleAdminLogin = (e) => {
    e.preventDefault();
    if (adminPassInput === ADMIN_PASSWORD) {
      setIsAdmin(true);
      setShowAdminLogin(false);
      setAdminPassInput("");
      setMessage({ type: 'success', text: 'เข้าสู่โหมดผู้ดูแลระบบแล้ว' });
      setTimeout(() => setMessage(null), 2000);
    } else {
      setMessage({ type: 'error', text: 'รหัสผ่านไม่ถูกต้อง' });
      setTimeout(() => setMessage(null), 2000);
    }
  };

  const ParkingSpot = ({ id, className = "", isHorizontal = false }) => {
    const spotBookings = currentDayBookings.filter(b => b.itemId === id && b.type === 'parking');
    const occupied = spotBookings.length > 0;
    const isDefault = spotBookings.some(b => b.isDefault);
    const selected = selectedItem === id;

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
             {!isHorizontal && <span className="text-[7px] font-bold truncate max-w-[45px] mt-0.5 uppercase opacity-70">{spotBookings[0].userName.split(' ')[0]}</span>}
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

  if (loading) return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="font-black text-slate-500 tracking-widest uppercase">กำลังเชื่อมต่อ...</p>
      </div>
    </div>
  );

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
                onChange={(e) => setAdminPassInput(e.target.value)}
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
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
          <div className="flex flex-col">
            <div className="flex items-center gap-3 mb-1">
              <div className="bg-blue-600 p-2 rounded-xl text-white shadow-lg">
                <LayoutGrid size={24} />
              </div>
              <h1 className="text-3xl font-black tracking-tighter uppercase italic">Office <span className="text-blue-600">Sync</span></h1>
            </div>
            <div className="flex items-center gap-2 ml-11">
              <p className="text-blue-600 font-black text-[10px] uppercase tracking-widest">
                เวลาปัจจุบัน: {currentTime}
              </p>
            </div>
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
              <input type="date" value={viewDate} onChange={(e) => setViewDate(e.target.value)} className="font-black text-slate-800 outline-none bg-transparent text-sm"/>
            </div>
            <button onClick={() => { if(isAdmin) setIsAdmin(false); else setShowAdminLogin(true); }} className={`p-2.5 rounded-xl border transition-all ${isAdmin ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-white border-slate-200 text-slate-400 hover:text-blue-600'}`}>
              {isAdmin ? <Unlock size={20} /> : <Lock size={20} />}
            </button>
          </div>
        </div>

        {message && (
          <div className={`mb-6 p-4 rounded-2xl flex items-center gap-3 border-l-4 shadow-sm animate-in fade-in slide-in-from-top-2 ${
            message.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-500' : 'bg-rose-50 text-rose-800 border-rose-500'
          }`}>
            {message.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
            <span className="font-bold text-sm tracking-tight">{message.text}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8 space-y-8">
            {activeTab === 'meeting' && (
              <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-2xl animate-in fade-in duration-500">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                  <div>
                    <h2 className="text-2xl font-black italic uppercase tracking-tighter flex items-center gap-3">
                      <LayoutGrid className="text-indigo-400" /> Meeting Dashboard
                    </h2>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">สรุปสถานะการใช้ห้องประชุมแบบ Real-time</p>
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
                            status === 'occupied' ? 'bg-rose-500/20 text-rose-400 animate-pulse' : 'bg-slate-700 text-slate-400'
                          }`}>
                            {label}
                          </div>
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

                <div className="mt-8 pt-8 border-t border-white/10 overflow-x-auto">
                   <div className="min-w-[700px] space-y-6">
                      <div className="flex items-center gap-4">
                        <div className="w-32 shrink-0 text-[10px] font-black text-slate-500 uppercase italic">รายการ / เวลา</div>
                        <div className="flex-1 flex justify-between px-2 text-[10px] font-black text-slate-600 italic">
                          <span>08:00</span>
                          <span>10:00</span>
                          <span>12:00</span>
                          <span>14:00</span>
                          <span>16:00</span>
                          <span>18:00</span>
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
                                const startH = parseInt(b.startTime.split(':')[0]);
                                const startM = parseInt(b.startTime.split(':')[1]);
                                const endH = parseInt(b.endTime.split(':')[0]);
                                const endM = parseInt(b.endTime.split(':')[1]);
                                
                                const dayStart = 8 * 60; 
                                const dayEnd = 18 * 60; 
                                const startMin = (startH * 60 + startM) - dayStart;
                                const endMin = (endH * 60 + endM) - dayStart;
                                const totalMin = dayEnd - dayStart;

                                const left = Math.max(0, (startMin / totalMin) * 100);
                                const width = Math.min(100 - left, ((endMin - startMin) / totalMin) * 100);

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

            <div className="bg-white p-6 md:p-10 rounded-[3rem] border border-slate-200 shadow-xl overflow-x-auto min-h-[500px]">
              {activeTab === 'parking' ? (
                <div className="min-w-[800px] flex flex-col gap-6">
                  <div className="flex justify-between items-end border-b pb-4">
                    <h2 className="text-xl font-black flex items-center gap-2 uppercase italic tracking-tighter"><MapPin size={22} className="text-blue-600" /> แผนผังที่จอดรถ</h2>
                    <div className="flex gap-4">
                      <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 bg-amber-400 rounded-full"></div><span className="text-[9px] font-black uppercase text-slate-400">Fixed</span></div>
                      <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 bg-rose-500 rounded-full"></div><span className="text-[9px] font-black uppercase text-slate-400">Booked</span></div>
                      <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 bg-emerald-500 rounded-full"></div><span className="text-[9px] font-black uppercase text-slate-400">Available</span></div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-12">
                    <div className="space-y-4">
                      <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest text-center">ZONE A (OUTDOOR)</p>
                      <div className="grid grid-cols-8 gap-0.5 bg-slate-200 p-0.5 rounded-lg">
                        {ZONE_A_TOP.map(id => <ParkingSpot key={id} id={id} className="aspect-[3/5]" />)}
                      </div>
                      <div className="grid grid-cols-3 gap-2 py-4 px-2 bg-slate-50 border border-dashed border-slate-200 rounded-2xl">
                        {ZONE_A_MID_UP.map(id => <ParkingSpot key={id} id={id} isHorizontal={true} className="h-12 rounded-lg" />)}
                        {ZONE_A_MID_DOWN.map(id => <ParkingSpot key={id} id={id} isHorizontal={true} className="h-12 rounded-lg" />)}
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
                        {ZONE_B_MID_ISLAND.map(id => <ParkingSpot key={id} id={id} isHorizontal={true} className="h-12 rounded-lg" />)}
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
                    const isSelected = selectedItem === room.id;
                    const roomBookings = currentDayBookings.filter(b => b.itemId === room.id && b.type === 'meeting');
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
                        <p className={`text-[10px] font-bold uppercase tracking-widest mb-4 opacity-70`}>{room.capacity}</p>
                        <div className="space-y-2">
                           <p className="text-[9px] font-black uppercase opacity-50">ตารางวันนี้:</p>
                           {roomBookings.length > 0 ? (
                             roomBookings.slice(0, 3).map(b => (
                               <div key={b.id} className="text-[10px] font-bold flex justify-between gap-2">
                                 <span className="shrink-0">{b.startTime}-{b.endTime}</span>
                                 <span className="opacity-70 truncate flex items-center gap-1">
                                    {b.isDefault && <Lock size={8}/>} {b.userName}
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

          <div className="lg:col-span-4">
            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-xl sticky top-8">
              {selectedItem ? (
                <form onSubmit={handleBooking} className="space-y-5 animate-in slide-in-from-right-4 duration-300">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-black italic tracking-tighter uppercase">จองรายการ</h3>
                    <button type="button" onClick={() => setSelectedItem(null)} className="text-slate-400 hover:text-rose-500"><XCircle size={24}/></button>
                  </div>
                  
                  <div className={`p-6 rounded-3xl text-white shadow-xl ${activeTab === 'parking' ? 'bg-blue-600' : MEETING_ROOMS.find(r => r.id === selectedItem)?.color || 'bg-indigo-600'}`}>
                    <p className="text-[10px] font-black opacity-60 uppercase tracking-widest mb-1">SELECTED</p>
                    <div className="text-4xl font-black italic tracking-tighter">
                      {activeTab === 'parking' ? selectedItem : MEETING_ROOMS.find(r => r.id === selectedItem)?.name}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase ml-1">เริ่ม</label>
                      <input type="time" required className="w-full p-3 bg-slate-50 border rounded-xl font-black" value={bookingDetails.startTime} onChange={e => setBookingDetails({...bookingDetails, startTime: e.target.value})} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase ml-1">ถึง</label>
                      <input type="time" required className="w-full p-3 bg-slate-50 border rounded-xl font-black" value={bookingDetails.endTime} onChange={e => setBookingDetails({...bookingDetails, endTime: e.target.value})} />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1">ชื่อผู้จอง / แผนก</label>
                    <input type="text" required placeholder="ระบุชื่อของคุณ" className="w-full p-4 bg-slate-50 border rounded-xl font-black" value={bookingDetails.name} onChange={e => setBookingDetails({...bookingDetails, name: e.target.value})} />
                  </div>

                  {activeTab === 'meeting' && (
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase ml-1">หัวข้อประชุม</label>
                      <input type="text" placeholder="ระบุหัวข้อ (ถ้ามี)" className="w-full p-4 bg-slate-50 border rounded-xl font-black" value={bookingDetails.purpose} onChange={e => setBookingDetails({...bookingDetails, purpose: e.target.value})} />
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
                  <p className="text-slate-400 font-black text-xs uppercase tracking-widest italic">กรุณาเลือก{activeTab === 'parking' ? 'ที่จอดรถ' : 'ห้องประชุม'}<br/>เพื่อเริ่มต้นการจอง</p>
                </div>
              )}

              <div className="mt-8 pt-6 border-t">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 italic text-center">รายการจองวันนี้</p>
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
                  {currentDayBookings.filter(b => b.type === activeTab).length > 0 ? (
                    currentDayBookings.filter(b => b.type === activeTab).map(b => (
                      <div key={b.id} className={`p-3 rounded-xl flex justify-between items-center ${b.isDefault ? 'bg-amber-50 border border-amber-100' : 'bg-slate-50'}`}>
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-[10px] italic shrink-0 ${b.isDefault ? 'bg-amber-500 text-white' : 'bg-slate-900 text-white'}`}>
                            {b.itemId.replace('MR','')}
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-black italic flex items-center gap-1.5 truncate">
                              {b.userName}
                              {b.isDefault && <Lock size={10} className="text-amber-500 shrink-0" />}
                            </div>
                            <div className="text-[9px] font-bold text-slate-400">{b.startTime}-{b.endTime}</div>
                          </div>
                        </div>
                        {(isAdmin || b.userId === user?.uid) && (
                          <button onClick={() => handleDelete(b)} className="text-slate-300 hover:text-rose-500 ml-2 shrink-0"><Trash2 size={14}/></button>
                        )}
                      </div>
                    ))
                  ) : <p className="text-center py-4 text-[10px] text-slate-300 italic">ไม่มีรายการจอง</p>}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}