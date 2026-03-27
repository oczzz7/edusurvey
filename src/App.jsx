import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  ChevronLeft, ChevronRight, Settings, BarChart2, LogOut, 
  FileSpreadsheet, Trash2, X, Database, Calendar, MapPin, 
  BookOpen, Plus, Search, AlertTriangle, Upload
} from 'lucide-react';

// Firebase იმპორტები
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { 
  getFirestore, collection, doc, setDoc, addDoc, 
  onSnapshot, deleteDoc 
} from 'firebase/firestore';

// --- Firebase კონფიგურაცია ---
const firebaseConfig = {
  apiKey: "AIzaSyDgkPsfb9imX4H3FjAWO4dVPq1bw6oVmek", 
  authDomain: "emis-75e8b.firebaseapp.com",
  projectId: "emis-75e8b",
  storageBucket: "emis-75e8b.firebasestorage.app",
  messagingSenderId: "471440760303",
  appId: "1:471440760303:web:9c935a925dab9608a66a1a"
};

const appId = 'school-survey-pro-v4';

// ინიციალიზაცია
let app, auth, db;
try {
  if (!getApps().length) {
    app = initializeApp(firebaseConfig);
  } else {
    app = getApps()[0];
  }
  auth = getAuth(app);
  db = getFirestore(app);
} catch (err) {
  console.error("Firebase init error:", err);
}

// --- კონსტანტები ---
const ROLES = {
  SUPER_ADMIN: 'super_admin',
  SCHOOL_VIEWER: 'school_viewer',
  RESPONDENT: 'respondent'
};

const RESPONSE_WEIGHTS = {
  "დიახ": 100, "მეტწილად": 75, "ნაწილობრივ": 50, "არა": 25, "არ ვიცი": 0
};

const scaleOptions = Object.keys(RESPONSE_WEIGHTS);

// ახალი, გენერირებული ლოგო მიმაგრებული სურათის მიხედვით
const EmisLogo = ({ className }) => (
  <div className={`flex items-center gap-3 ${className}`}>
    <div className="relative w-10 h-10 flex-shrink-0">
      <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-md">
        <path d="M50 15 A35 35 0 0 1 85 50" stroke="#fbb03b" strokeWidth="18" fill="none" strokeLinecap="round" />
        <path d="M80 65 A35 35 0 0 1 20 65" stroke="#ed1c24" strokeWidth="18" fill="none" strokeLinecap="round" />
        <path d="M15 50 A35 35 0 0 1 50 15" stroke="#2e3192" strokeWidth="18" fill="none" strokeLinecap="round" />
      </svg>
    </div>
    <div className="flex flex-col text-left">
      <span className="text-[#4b5563] font-black text-[11px] leading-tight tracking-wide">განათლების მართვის</span>
      <span className="text-[#4b5563] font-black text-[11px] leading-tight tracking-wide">საინფორმაციო სისტემა</span>
    </div>
  </div>
);

export default function App() {
  const [user, setUser] = useState(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [initError, setInitError] = useState(null);
  const [userRole, setUserRole] = useState(ROLES.RESPONDENT);
  const [currentView, setCurrentView] = useState('landing'); 
  const [selection, setSelection] = useState({ region: '', district: '', schoolId: '' });
  const [activeSurveyRole, setActiveSurveyRole] = useState(null);
  const [gradeRange, setGradeRange] = useState(null);

  const [sessions, setSessions] = useState([]);
  const [responses, setResponses] = useState([]);
  const [surveyData, setSurveyData] = useState([]);
  
  // V4 დეფოლტ კონფიგურაცია
  const [appConfig, setAppConfig] = useState({ 
    welcomeText: "სკოლების შეფასების პლატფორმა",
    surveyDetails: "კვლევის მიზანია შევისწავლოთ სასწავლო პროცესის ხარისხი და საგანმანათლებლო საჭიროებები. თქვენი პასუხები კონფიდენციალურია და გამოყენებული იქნება მხოლოდ განზოგადებული სახით.",
    roleWeights: { admin: 20, teacher: 30, student: 10, parent: 40 },
    regions: [],
    grades: ["I-IV კლასი", "V-IX კლასი", "X-XII კლასი"],
    subjectsByGrade: {
      "I-IV კლასი": ["ბუნება", "ქართული", "მათემატიკა"],
      "V-IX კლასი": ["ისტორია", "ბიოლოგია", "ფიზიკა"],
      "X-XII კლასი": ["სამოქალაქო განათლება"]
    },
    subjectSpecificIds: ["2.2", "4.1"]
  });

  // 1. ავტორიზაცია
  useEffect(() => {
    if (!auth) { 
      setIsInitializing(false); 
      return; 
    }
    const initAuth = async () => {
      try { 
        await signInAnonymously(auth); 
      } catch (err) { 
        console.error("Auth error:", err);
        setInitError(`ავტორიზაციის შეცდომა. დარწმუნდით, რომ Anonymous Sign-in ჩართულია. დეტალები: ${err.message}`);
      } finally { 
        setIsInitializing(false); 
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  // 2. მონაცემების სინქრონიზაცია
  useEffect(() => {
    if (!user || !db) return;

    const unsubSessions = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'sessions'), (snap) => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setSessions(data.length > 0 ? data : [{ id: 's_default', name: 'ძირითადი კვლევა', isActive: true, createdAt: new Date().toISOString() }]);
    }, (err) => {
      console.error("Session fetch error:", err);
      if (err.code === 'permission-denied') {
        setInitError("წვდომა შეზღუდულია. შეამოწმეთ Firestore-ის Rules.");
      } else {
        setInitError(`მონაცემების წაკითხვის შეცდომა: ${err.message}`);
      }
    });

    const unsubResponses = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'responses'), (snap) => {
      setResponses(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => console.error("Responses fetch error:", err));

    const unsubSurvey = onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'survey', 'schema'), (snap) => {
      if (snap.exists()) setSurveyData(snap.data().questions || []);
    }, (err) => console.error("Survey fetch error:", err));

    const unsubConfig = onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'config', 'main'), (snap) => {
      if (snap.exists()) setAppConfig(prev => ({ ...prev, ...snap.data() }));
    }, (err) => console.error("Config fetch error:", err));

    return () => { unsubSessions(); unsubResponses(); unsubSurvey(); unsubConfig(); };
  }, [user]);

  const saveSurvey = async (questions) => { 
    if (db) await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'survey', 'schema'), { questions }); 
  };
  
  const saveConfig = async (newConfig) => { 
    if (db) await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'config', 'main'), newConfig); 
  };
  
  const saveSessions = async (newS) => { 
    if (db) for (const s of newS) await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'sessions', s.id), s); 
  };
  
  const deleteSession = async (sid) => {
    if (!db) return;
    await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'sessions', sid));
    responses.filter(r => r.sessionId === sid).forEach(async (r) => {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'responses', r.id));
    });
  };

  const clearEntireDatabase = async () => {
    if(!db) return;
    try {
      // წაშალე ყველა პასუხი
      for (const r of responses) {
        await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'responses', r.id));
      }
      // წაშალე ყველა სესია გარდა დეფოლტისა
      for (const s of sessions) {
        if(s.id !== 's_default') {
          await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'sessions', s.id));
        }
      }
      alert("ბაზა წარმატებით გასუფთავდა!");
    } catch (err) {
      alert("შეცდომა გასუფთავებისას: " + err.message);
    }
  }
  
  const submitResponse = async (data) => {
    if (!db) return;
    const active = sessions.find(s => s.isActive) || sessions[0];
    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'responses'), { ...data, sessionId: active?.id || 'default' });
  };

  if (isInitializing) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-blue-50 space-y-4">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin shadow-lg"></div>
        <div className="font-black text-blue-800/50 animate-pulse tracking-wide">მონაცემების ჩატვირთვა...</div>
      </div>
    );
  }

  if (initError) {
    return (
      <div className="h-screen flex items-center justify-center bg-red-50 p-6">
        <div className="bg-white p-8 rounded-[2.5rem] shadow-2xl border border-red-100 text-center space-y-6 max-w-lg">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto">
             <AlertTriangle className="w-10 h-10 text-red-500" />
          </div>
          <h2 className="text-2xl font-black italic tracking-tighter text-slate-800">შეცდომა კავშირისას</h2>
          <p className="text-sm text-slate-500 font-medium break-words leading-relaxed">{initError}</p>
          <button onClick={() => window.location.reload()} className="px-8 py-3 bg-slate-800 hover:bg-slate-900 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-lg transition-all active:scale-95">თავიდან ცდა</button>
        </div>
      </div>
    );
  }

  const handleSelectionReset = () => { 
    setSelection({ region: '', district: '', schoolId: '' }); 
    setActiveSurveyRole(null); 
    setGradeRange(null); 
    setCurrentView('landing'); 
  };
  
  const activeSession = sessions.length > 0 ? (sessions.find(s => s.isActive) || sessions[0]) : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50/50 via-white to-blue-50/30 text-slate-900 font-sans selection:bg-blue-200 selection:text-blue-900">
      <header className="bg-white/80 backdrop-blur-lg border-b border-slate-200/50 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center cursor-pointer group" onClick={handleSelectionReset}>
            <EmisLogo className="group-hover:scale-105 transition-transform duration-300" />
          </div>
          <div className="flex items-center gap-4">
            {userRole === ROLES.RESPONDENT ? (
              <div className="flex gap-1 bg-slate-100/50 p-1.5 rounded-2xl border border-slate-200/50 shadow-inner">
                <button onClick={() => { setUserRole(ROLES.SCHOOL_VIEWER); setCurrentView('stats'); }} className="text-xs font-black text-slate-500 hover:text-blue-600 hover:bg-white px-4 py-2 flex items-center gap-2 rounded-xl transition-all">
                  <BarChart2 className="w-4 h-4" /> ანალიტიკა
                </button>
                <button onClick={() => { setUserRole(ROLES.SUPER_ADMIN); setCurrentView('admin'); }} className="text-xs font-black text-slate-500 hover:text-blue-600 hover:bg-white px-4 py-2 flex items-center gap-2 rounded-xl transition-all">
                  <Settings className="w-4 h-4" /> მართვა
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <span className="text-[10px] font-black uppercase bg-blue-100 text-blue-800 px-4 py-2 rounded-xl shadow-sm tracking-wide">
                  {userRole === ROLES.SUPER_ADMIN ? 'ადმინისტრატორი' : 'ანალიტიკოსი'}
                </span>
                <button onClick={() => { setUserRole(ROLES.RESPONDENT); handleSelectionReset(); }} className="text-slate-400 hover:text-red-500 hover:bg-red-50 p-2.5 rounded-xl transition-all shadow-sm bg-white border border-slate-200">
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-12">
        {userRole === ROLES.SUPER_ADMIN ? (
          <AdminPortal surveyData={surveyData} saveSurvey={saveSurvey} sessions={sessions} saveSessions={saveSessions} onDeleteSession={deleteSession} clearEntireDatabase={clearEntireDatabase} appConfig={appConfig} saveConfig={saveConfig} />
        ) : userRole === ROLES.SCHOOL_VIEWER ? (
          <AnalyticsPanel responses={responses} surveyData={surveyData} appConfig={appConfig} sessions={sessions} onBack={handleSelectionReset} />
        ) : (
          <>
            {currentView === 'landing' && (
              <div className="max-w-3xl mx-auto text-center space-y-12 py-12 animate-in fade-in slide-in-from-bottom-8 duration-700">
                <div className="bg-white/60 backdrop-blur-2xl p-14 rounded-[3.5rem] shadow-2xl border border-white space-y-8 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-96 h-96 bg-yellow-100/40 rounded-full blur-3xl -z-10 translate-x-1/2 -translate-y-1/2"></div>
                  <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-100/40 rounded-full blur-3xl -z-10 -translate-x-1/2 translate-y-1/2"></div>
                  
                  <div className="flex justify-center mb-6"><EmisLogo className="drop-shadow-sm scale-125 origin-top" /></div>
                  
                  <div className="space-y-4">
                    <h1 className="text-2xl sm:text-3xl font-black text-slate-800 leading-tight tracking-tight">{appConfig.welcomeText}</h1>
                    <p className="text-xs sm:text-sm text-slate-500 max-w-2xl mx-auto leading-relaxed font-medium">
                      {appConfig.surveyDetails}
                    </p>
                  </div>
                  
                  {activeSession && (
                    <div className="inline-flex items-center gap-3 bg-white/80 border border-slate-200/60 text-slate-600 px-6 py-3 rounded-2xl text-sm font-bold shadow-sm">
                      <div className="p-1.5 bg-blue-50 rounded-lg"><Calendar size={18} className="text-blue-600"/></div>
                      მიმდინარეობს: <span className="text-blue-700 font-black">{activeSession.name || 'კვლევა'}</span>
                    </div>
                  )}
                  
                  <div className="pt-6">
                    <button onClick={() => setCurrentView('geoSelect')} className="w-full sm:w-auto inline-flex items-center justify-center gap-4 bg-[#2e3192] text-white px-12 py-5 rounded-[2rem] font-black text-lg hover:bg-[#1a1c5e] hover:scale-105 transition-all shadow-xl hover:shadow-[#2e3192]/30">
                      დაწყება <ChevronRight className="w-6 h-6" />
                    </button>
                  </div>
                </div>
              </div>
            )}
            {currentView === 'geoSelect' && <GeoSelectionView selection={selection} setSelection={setSelection} onConfirm={() => setCurrentView('roleSelect')} appConfig={appConfig} />}
            {currentView === 'roleSelect' && <RoleVerificationView onVerified={(role) => { setActiveSurveyRole(role); setCurrentView(role === 'student' || role === 'parent' ? 'gradeSelect' : 'survey'); }} onBack={() => setCurrentView('geoSelect')} />}
            {currentView === 'gradeSelect' && <GradeSelectView onSelect={(g) => { setGradeRange(g); setCurrentView('survey'); }} appConfig={appConfig} />}
            {currentView === 'survey' && <SurveyForm role={activeSurveyRole} gradeRange={gradeRange} schoolId={selection.schoolId} surveyData={surveyData} appConfig={appConfig} onComplete={handleSelectionReset} saveResponse={submitResponse} />}
          </>
        )}
      </main>
    </div>
  );
}

// --- კომპონენტები ---

function GeoSelectionView({ selection, setSelection, onConfirm, appConfig }) {
  const regions = appConfig?.regions || [];
  const selectedRegionObj = regions.find(g => g.name === selection.region);
  const selectedDistrictObj = selectedRegionObj?.districts?.find(d => d.name === selection.district);

  return (
    <div className="max-w-md mx-auto bg-white/80 backdrop-blur-xl p-12 rounded-[3.5rem] shadow-2xl border border-white space-y-8 animate-in zoom-in-95 duration-500">
      <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-indigo-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner border border-white">
        <MapPin size={32} />
      </div>
      <h2 className="text-2xl font-black text-slate-800 text-center tracking-tight">აირჩიეთ დაწესებულება</h2>
      <div className="space-y-4">
        <select className="w-full p-4 bg-white border border-slate-200/80 rounded-2xl font-bold text-slate-700 outline-none focus:ring-4 ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer appearance-none shadow-sm" value={selection.region} onChange={e => setSelection({ region: e.target.value, district: '', schoolId: '' })}>
          <option value="" disabled>რეგიონი</option>
          {regions.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
        </select>
        <select className="w-full p-4 bg-white border border-slate-200/80 rounded-2xl font-bold text-slate-700 outline-none focus:ring-4 ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer appearance-none disabled:opacity-50 disabled:bg-slate-50 shadow-sm" disabled={!selection.region} value={selection.district} onChange={e => setSelection({ ...selection, district: e.target.value, schoolId: '' })}>
          <option value="" disabled>რაიონი / მუნიციპალიტეტი</option>
          {selectedRegionObj?.districts?.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
        </select>
        <select className="w-full p-4 bg-white border border-slate-200/80 rounded-2xl font-bold text-slate-700 outline-none focus:ring-4 ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer appearance-none disabled:opacity-50 disabled:bg-slate-50 shadow-sm" disabled={!selection.district} value={selection.schoolId} onChange={e => setSelection({ ...selection, schoolId: e.target.value })}>
          <option value="" disabled>სკოლის დასახელება</option>
          {selectedDistrictObj?.schools?.map(s => <option key={s.id} value={s.id}>{s.code ? `[${s.code}] ` : ''}{s.name}</option>)}
        </select>
      </div>
      <button disabled={!selection.schoolId} onClick={onConfirm} className="w-full py-5 bg-[#2e3192] text-white rounded-2xl font-black text-lg disabled:opacity-40 disabled:hover:scale-100 hover:bg-[#1a1c5e] shadow-xl shadow-[#2e3192]/20 transition-all active:scale-95">გაგრძელება</button>
    </div>
  );
}

function RoleVerificationView({ onVerified, onBack }) {
  const [role, setRole] = useState(null);
  const [code, setCode] = useState("");
  const codes = { admin: "1111", teacher: "2222", student: "3333", parent: "4444" };
  const roleNames = { admin: "ადმინისტრაცია", teacher: "მასწავლებელი", student: "მოსწავლე", parent: "მშობელი" };

  if (role) return (
    <div className="max-w-md mx-auto bg-white/80 backdrop-blur-xl p-12 rounded-[3.5rem] shadow-2xl border border-white text-center space-y-10 animate-in slide-in-from-right-8 duration-500">
      <div className="space-y-4">
        <h3 className="text-2xl font-black uppercase text-blue-800 tracking-widest">{roleNames[role]}</h3>
        <p className="text-sm font-bold text-slate-400">შეიყვანეთ წვდომის 4-ნიშნა კოდი</p>
      </div>
      <input type="password" maxLength={4} autoFocus placeholder="••••" className="w-full text-center text-5xl p-6 bg-white border-b-4 border-[#fbb03b] rounded-2xl font-black tracking-[1.5rem] outline-none placeholder:text-slate-200 focus:bg-orange-50/30 transition-colors shadow-inner" value={code} onChange={e => { setCode(e.target.value); if(e.target.value === codes[role]) onVerified(role); }} />
      <button onClick={() => { setRole(null); setCode(""); }} className="text-slate-400 font-bold hover:text-slate-700 flex items-center justify-center gap-2 mx-auto transition-colors"><ChevronLeft size={16}/> უკან დაბრუნება</button>
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto animate-in fade-in duration-500">
      <div className="flex items-center gap-4 mb-8">
        <button onClick={onBack} className="p-3 bg-white/80 border border-white rounded-2xl text-slate-500 hover:text-blue-600 hover:border-blue-200 transition-all shadow-sm backdrop-blur-sm"><ChevronLeft /></button>
        <h2 className="text-3xl font-black text-slate-800 tracking-tight">მიუთითეთ თქვენი როლი</h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {Object.entries(roleNames).map(([id, label]) => (
          <button key={id} onClick={() => setRole(id)} className="p-10 bg-white/80 backdrop-blur-sm border border-white rounded-[2.5rem] font-black text-xl hover:border-blue-400 hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 flex flex-col items-center gap-6 group shadow-sm">
            <div className="w-20 h-20 bg-gradient-to-br from-slate-100 to-slate-50 border border-white shadow-inner rounded-[1.5rem] flex items-center justify-center text-slate-400 group-hover:from-blue-500 group-hover:to-indigo-600 group-hover:text-white transition-all uppercase font-black text-3xl tracking-tighter">{id[0]}</div>
            <span className="text-slate-700 group-hover:text-blue-900 transition-colors">{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function GradeSelectView({ onSelect, appConfig }) {
  const grades = appConfig.grades || ["I-IV კლასი", "V-IX კლასი", "X-XII კლასი"];
  return (
    <div className="max-w-md mx-auto bg-white/80 backdrop-blur-xl p-12 rounded-[3.5rem] shadow-2xl border border-white text-center space-y-10 animate-in slide-in-from-right-8 duration-500">
      <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-indigo-50 border border-white text-blue-600 shadow-inner rounded-full flex items-center justify-center mx-auto mb-2">
        <BookOpen size={32} />
      </div>
      <h3 className="text-2xl font-black text-slate-800 tracking-tight">რომელ კლასში ხართ?</h3>
      <div className="space-y-4 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
        {grades.map(g => (
          <button key={g} onClick={() => onSelect(g)} className="w-full p-5 bg-white shadow-sm rounded-2xl border border-slate-100 font-black text-lg text-slate-600 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700 transition-all active:scale-95">{g}</button>
        ))}
      </div>
    </div>
  );
}

function SurveyForm({ role, gradeRange, schoolId, surveyData, appConfig, onComplete, saveResponse }) {
  const [answers, setAnswers] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const renderList = useMemo(() => {
    const list = [];
    let currentSection = null;
    let sectionHasQuestions = false;
    surveyData.forEach(q => {
      if(q.type === 'section') { currentSection = q; sectionHasQuestions = false; }
      else {
        const text = (q[role] || '').trim();
        if (text && text !== 'არ არის') {
           if(currentSection && !sectionHasQuestions) { list.push({ ...currentSection, isSection: true }); sectionHasQuestions = true; }
           list.push({ ...q, text, isSection: false });
        }
      }
    });
    return list;
  }, [surveyData, role]);

  const requiredCount = renderList.filter(q => !q.isSection).length;
  const answeredCount = Object.keys(answers).length;
  const progress = requiredCount ? Math.round((answeredCount / requiredCount) * 100) : 0;

  const updateAnswer = (qId, field, val) => { setAnswers(prev => ({ ...prev, [qId]: { ...(prev[qId] || {}), [field]: val } })); };
  const updateMatrixAnswer = (qId, subj, val) => { setAnswers(prev => { const current = prev[qId] || { isMatrix: true, values: {} }; return { ...prev, [qId]: { ...current, isMatrix: true, values: { ...current.values, [subj]: val } } }; }); };

  const handleSubmit = async () => {
    if (isSubmitting || answeredCount < requiredCount) return;
    setIsSubmitting(true);
    await saveResponse({ schoolId, role, gradeRange, answers, timestamp: new Date().toISOString() });
    onComplete();
  };

  if (renderList.length === 0) return <div className="max-w-md mx-auto text-center p-20 bg-white/80 backdrop-blur-xl rounded-3xl shadow-lg border border-white font-black text-slate-400">ამ როლისთვის კითხვები არ მოიძებნა.</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-40 animate-in fade-in slide-in-from-bottom-8 duration-700">
      <div className="sticky top-24 z-40 bg-white/90 backdrop-blur-xl p-6 rounded-[2rem] border border-white shadow-xl shadow-slate-200/50 flex items-center justify-between gap-6">
        <div className="flex-1 space-y-3">
          <div className="flex justify-between text-xs font-black uppercase text-slate-500 tracking-widest">
            <span>პროგრესი: {answeredCount} / {requiredCount}</span>
            <span className="text-[#2e3192]">{progress}%</span>
          </div>
          <div className="h-4 bg-slate-100 rounded-full overflow-hidden p-0.5 shadow-inner">
            <div className="h-full bg-gradient-to-r from-[#2e3192] to-[#fbb03b] rounded-full transition-all duration-700 ease-out" style={{ width: `${progress}%` }}></div>
          </div>
        </div>
      </div>
      <div className="space-y-6">
        {renderList.map((q, idx) => {
          if (q.isSection) return <div key={q.id || `sec-${idx}`} className="pt-10 pb-4 border-b-2 border-slate-200/50"><h3 className="text-2xl font-black text-slate-800 leading-tight tracking-tight">{q.title}</h3></div>;
          
          const isSubjectSpecific = (appConfig.subjectSpecificIds || []).includes(q.id) && (role === 'student' || role === 'parent');
          const availableSubjects = gradeRange ? (appConfig.subjectsByGrade?.[gradeRange] || []) : [];
          const ans = answers[q.id] || {};
          
          return (
            <div key={q.id} className="bg-white/90 backdrop-blur-sm p-8 md:p-10 rounded-[2.5rem] border border-white shadow-lg shadow-slate-200/40 hover:shadow-xl transition-all duration-300 space-y-8">
              <div className="flex gap-5">
                <span className="w-12 h-12 bg-blue-50 text-blue-700 rounded-2xl flex items-center justify-center font-black flex-shrink-0 text-lg border border-blue-100 shadow-sm">{q.id}</span>
                <p className="font-bold text-slate-700 text-lg md:text-xl leading-relaxed pt-1">{q.text}</p>
              </div>
              
              {!isSubjectSpecific ? (
                <div className="flex flex-wrap gap-3">
                  {scaleOptions.map(opt => (
                    <button key={opt} onClick={() => updateAnswer(q.id, 'value', opt)} className={`flex-1 min-w-[110px] py-4 md:py-5 rounded-2xl text-xs md:text-sm font-black border-2 transition-all active:scale-95 shadow-sm ${ans.value === opt ? 'bg-[#2e3192] text-white border-[#2e3192] shadow-md shadow-[#2e3192]/30' : 'bg-white text-slate-500 border-slate-100 hover:border-blue-300 hover:bg-blue-50/30'}`}>
                      {opt}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="mt-4 border border-slate-100 rounded-[2rem] overflow-hidden shadow-sm bg-white">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                      <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 font-black text-[10px] uppercase tracking-widest">
                        <tr>
                          <th className="p-5 bg-slate-50 sticky left-0 z-10 border-r border-slate-100">საგანი</th>
                          {scaleOptions.map(opt => <th key={opt} className="p-5 text-center">{opt}</th>)}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {availableSubjects.map(subj => (
                          <tr key={subj} className="hover:bg-blue-50/20 transition-colors">
                            <td className="p-5 font-bold text-slate-700 bg-white sticky left-0 z-10 border-r border-slate-50">{subj}</td>
                            {scaleOptions.map(opt => (
                              <td key={opt} className="p-5 text-center cursor-pointer" onClick={() => updateMatrixAnswer(q.id, subj, opt)}>
                                <div className={`w-6 h-6 mx-auto rounded-full border-2 flex items-center justify-center transition-all ${ans.values?.[subj] === opt ? 'border-[#fbb03b] bg-[#fbb03b] shadow-sm' : 'border-slate-200 bg-slate-50 hover:border-blue-400'}`}>
                                  {ans.values?.[subj] === opt && <div className="w-2.5 h-2.5 bg-white rounded-full"></div>}
                                </div>
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              
              <div className="bg-slate-50/50 p-2 rounded-2xl border border-slate-100 focus-within:border-blue-400 focus-within:ring-4 ring-blue-500/10 transition-all shadow-inner">
                <textarea placeholder="დაამატეთ კომენტარი (არასავალდებულო)..." value={ans.comment || ''} onChange={e => updateAnswer(q.id, 'comment', e.target.value)} className="w-full p-4 bg-transparent text-sm font-medium text-slate-700 resize-none min-h-[100px] outline-none placeholder:text-slate-400" />
              </div>
            </div>
          );
        })}
      </div>
      
      <div className="fixed bottom-0 left-0 w-full p-6 bg-gradient-to-t from-slate-50/90 via-slate-50/80 to-transparent z-40 flex justify-center pointer-events-none backdrop-blur-sm">
        <button disabled={answeredCount < requiredCount || isSubmitting} onClick={handleSubmit} className="w-full max-w-sm py-6 bg-slate-900 text-white rounded-[2.5rem] font-black text-lg shadow-2xl shadow-slate-900/20 disabled:opacity-30 disabled:translate-y-4 hover:-translate-y-1 transition-all duration-300 pointer-events-auto flex items-center justify-center gap-3 border border-slate-700">
          {isSubmitting ? <span className="animate-pulse">იგზავნება...</span> : <>დასრულება <Check size={20}/></>}
        </button>
      </div>
    </div>
  );
}

function AnalyticsPanel({ responses, surveyData, appConfig, sessions, onBack }) {
  const [selectedSessionId, setSelectedSessionId] = useState(sessions[0]?.id || '');
  const [selectedRegion, setSelectedRegion] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [selectedSchool, setSelectedSchool] = useState('');

  const weights = appConfig.roleWeights || { admin: 25, teacher: 25, student: 25, parent: 25 };

  const availableSchools = useMemo(() => {
    const sessionResp = responses.filter(r => r.sessionId === selectedSessionId);
    const sIds = [...new Set(sessionResp.map(r => r.schoolId))];
    
    const matchedSchools = [];
    (appConfig.regions || []).forEach(r => {
      (r.districts || []).forEach(d => {
        (d.schools || []).forEach(s => {
          if(sIds.includes(s.id)) {
            matchedSchools.push({ ...s, region: r.name, district: d.name });
          }
        });
      });
    });
    return matchedSchools;
  }, [responses, selectedSessionId, appConfig]);

  const filteredResponses = useMemo(() => { 
    let d = responses.filter(r => r.sessionId === selectedSessionId); 
    
    let validSchoolIds = availableSchools;
    if (selectedRegion) validSchoolIds = validSchoolIds.filter(s => s.region === selectedRegion);
    if (selectedDistrict) validSchoolIds = validSchoolIds.filter(s => s.district === selectedDistrict);
    if (selectedSchool) validSchoolIds = validSchoolIds.filter(s => s.id === selectedSchool);
    
    const validIds = validSchoolIds.map(s => s.id);
    
    if (selectedRegion || selectedDistrict || selectedSchool) {
      d = d.filter(r => validIds.includes(r.schoolId));
    }
    
    return d; 
  }, [responses, selectedSessionId, selectedRegion, selectedDistrict, selectedSchool, availableSchools]);
  
  const analytics = useMemo(() => { 
    if (filteredResponses.length === 0) return null; 
    
    // Score tracking per role for weighting
    const scores = {}; 
    filteredResponses.forEach(resp => { 
      const role = resp.role;
      Object.entries(resp.answers || {}).forEach(([qId, ans]) => { 
        if (!scores[qId]) scores[qId] = { roles: { admin:{s:0, c:0}, teacher:{s:0, c:0}, student:{s:0, c:0}, parent:{s:0, c:0} } }; 
        if (ans.isMatrix) { 
          Object.entries(ans.values || {}).forEach(([s, v]) => { 
            const w = RESPONSE_WEIGHTS[v]; 
            scores[qId].roles[role].s += w; 
            scores[qId].roles[role].c++; 
          }); 
        } else { 
          const w = RESPONSE_WEIGHTS[ans.value]; 
          scores[qId].roles[role].s += w; 
          scores[qId].roles[role].c++; 
        } 
      }); 
    }); 
    
    // Calculate final weighted score
    Object.keys(scores).forEach(qId => {
       let totalWeightApplied = 0;
       let weightedSum = 0;
       Object.entries(scores[qId].roles).forEach(([r, data]) => {
          if (data.c > 0) {
            const roleAvg = data.s / data.c;
            const roleWeight = weights[r] || 0;
            weightedSum += (roleAvg * roleWeight);
            totalWeightApplied += roleWeight;
          }
       });
       scores[qId].finalScore = totalWeightApplied > 0 ? Math.round(weightedSum / totalWeightApplied) : 0;
    });

    return scores; 
  }, [filteredResponses, weights]);

  const uniqueRegions = [...new Set(availableSchools.map(s => s.region))];
  const uniqueDistricts = [...new Set(availableSchools.filter(s => !selectedRegion || s.region === selectedRegion).map(s => s.district))];
  const uniqueSchoolsList = availableSchools.filter(s => (!selectedRegion || s.region === selectedRegion) && (!selectedDistrict || s.district === selectedDistrict));

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-white/80 backdrop-blur-md p-6 rounded-[2rem] border border-white shadow-sm">
        <button onClick={onBack} className="flex items-center gap-2 text-slate-500 font-bold hover:text-blue-600 transition-colors px-4 py-2 bg-white rounded-xl shadow-sm hover:shadow-md border border-slate-100"><ChevronLeft size={18} /> უკან</button>
        <div className="flex items-center gap-3 bg-blue-50 px-5 py-3 rounded-2xl border border-blue-100 shadow-inner">
          <Database size={20} className="text-blue-500" />
          <span className="text-sm font-bold text-slate-600">შევსებულია კითხვარი:</span>
          <span className="text-xl font-black text-blue-700">{filteredResponses.length}</span>
        </div>
      </div>

      <div className="bg-white/90 backdrop-blur-md p-8 rounded-[2.5rem] border border-white shadow-lg space-y-6">
        <div className="flex items-center gap-3 mb-2">
          <Search className="text-slate-400" size={20}/>
          <h3 className="text-xl font-black text-slate-800">მონაცემების ფილტრაცია</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="space-y-2">
            <label className="text-xs font-black uppercase text-slate-400 px-1">კვლევის სესია</label>
            <select className="w-full p-4 bg-slate-50/50 border border-slate-200 rounded-2xl font-bold outline-none focus:ring-2 ring-blue-500 shadow-sm" value={selectedSessionId} onChange={e => { setSelectedSessionId(e.target.value); setSelectedRegion(''); setSelectedDistrict(''); setSelectedSchool(''); }}>
              {sessions.map(s => <option key={s.id} value={s.id}>{s.name} {s.isActive ? '(აქტიური)' : ''}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-black uppercase text-slate-400 px-1">რეგიონი</label>
            <select className="w-full p-4 bg-slate-50/50 border border-slate-200 rounded-2xl font-bold outline-none focus:ring-2 ring-blue-500 disabled:opacity-50 shadow-sm" value={selectedRegion} onChange={e => { setSelectedRegion(e.target.value); setSelectedDistrict(''); setSelectedSchool(''); }}>
              <option value="">ყველა რეგიონი</option>
              {uniqueRegions.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-black uppercase text-slate-400 px-1">რაიონი</label>
            <select className="w-full p-4 bg-slate-50/50 border border-slate-200 rounded-2xl font-bold outline-none focus:ring-2 ring-blue-500 disabled:opacity-50 shadow-sm" disabled={!selectedRegion} value={selectedDistrict} onChange={e => { setSelectedDistrict(e.target.value); setSelectedSchool(''); }}>
              <option value="">ყველა რაიონი</option>
              {uniqueDistricts.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-black uppercase text-slate-400 px-1">სკოლა</label>
            <select className="w-full p-4 bg-slate-50/50 border border-slate-200 rounded-2xl font-bold outline-none focus:ring-2 ring-blue-500 disabled:opacity-50 shadow-sm" disabled={!selectedDistrict} value={selectedSchool} onChange={e => setSelectedSchool(e.target.value)}>
              <option value="">ყველა სკოლა</option>
              {uniqueSchoolsList.map(s => <option key={s.id} value={s.id}>{s.code ? `[${s.code}] ` : ''}{s.name}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white/90 backdrop-blur-md rounded-[2.5rem] border border-white shadow-lg divide-y divide-slate-100 overflow-hidden">
        {surveyData.map(q => {
          if (q.type === 'section') return <div key={q.id} className="px-8 py-6 bg-slate-50/80 font-black text-blue-900 text-lg border-b border-slate-200">{q.title}</div>;
          
          const stat = analytics?.[q.id]; 
          if (!stat) return null; 
          
          const score = stat.finalScore;
          
          return (
            <div key={q.id} className="p-8 hover:bg-slate-50/50 transition-colors flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
              <div className="flex-1 space-y-1">
                <span className="text-xs font-black px-2 py-1 bg-slate-100 rounded-lg text-slate-500 shadow-inner border border-slate-200">{q.id}</span>
                <p className="text-sm font-bold text-slate-700 leading-relaxed mt-2">{q.admin || q.teacher || q.student || q.parent || q.text}</p>
              </div>
              <div className="flex items-center gap-5 w-full md:w-64 shrink-0 bg-slate-50 p-4 rounded-2xl border border-slate-200 shadow-inner">
                <div className="h-3 bg-slate-200 rounded-full flex-1 overflow-hidden shadow-inner">
                  <div className={`h-full rounded-full transition-all duration-1000 ${score >= 75 ? 'bg-emerald-500' : score >= 50 ? 'bg-amber-400' : 'bg-[#ed1c24]'}`} style={{ width: `${score}%` }}></div>
                </div>
                <span className="font-black text-slate-800 w-12 text-right text-lg">{score}%</span>
              </div>
            </div>
          );
        })}
        {(!analytics || Object.keys(analytics).length === 0) && (
          <div className="p-20 text-center font-bold text-slate-400">არჩეული ფილტრებით მონაცემები არ მოიძებნა.</div>
        )}
      </div>
    </div>
  );
}

function AdminPortal({ surveyData, saveSurvey, sessions, saveSessions, onDeleteSession, clearEntireDatabase, appConfig, saveConfig }) {
  const [tab, setTab] = useState('sessions');
  const [uploadMsg, setUploadMsg] = useState("");
  const fileRef = useRef(null);
  const geoFileRef = useRef(null);
  
  // საგნების მართვის სტეიტები
  const [newGrade, setNewGrade] = useState('');
  const [newSubjects, setNewSubjects] = useState({}); // { gradeLevel: text }

  const handleSurveyUpload = (e) => { 
    const file = e.target.files[0]; 
    if(!file) return; 
    const reader = new FileReader(); 
    reader.onload = async (event) => { 
      const text = event.target.result; 
      const rows = text.split('\n').map(row => row.split(',')); 
      const questions = []; 
      rows.forEach(cols => { 
        if(cols.length < 2) return; 
        const id = cols[0]?.trim(); 
        if(!id || isNaN(parseFloat(id))) return; 
        if(id.endsWith('.0')) questions.push({ type: 'section', id, title: cols[1]?.trim() }); 
        else questions.push({ type: 'question', id, admin: cols[1], teacher: cols[3], student: cols[5], parent: cols[7] }); 
      }); 
      await saveSurvey(questions); 
      setUploadMsg("კითხვარი წარმატებით განახლდა!");
      setTimeout(() => setUploadMsg(""), 4000);
    }; 
    reader.readAsText(file); 
  };

  const handleGeoUpload = (e) => {
    const file = e.target.files[0]; 
    if(!file) return; 
    const reader = new FileReader(); 
    reader.onload = async (event) => { 
      const text = event.target.result; 
      // Format expected: Region, District, SchoolName, SchoolCode
      const rows = text.split('\n').map(row => row.split(','));
      
      const newRegionsObj = {};
      
      rows.forEach((cols, i) => {
        if(i === 0 || cols.length < 3) return; // skip header or empty
        const regName = cols[0]?.trim();
        const distName = cols[1]?.trim();
        const schoolName = cols[2]?.trim();
        const schoolCode = cols[3]?.trim() || '';

        if(!regName || !distName || !schoolName) return;

        if(!newRegionsObj[regName]) newRegionsObj[regName] = { id: `r_${Date.now()}_${Math.random()}`, name: regName, districtsObj: {} };
        if(!newRegionsObj[regName].districtsObj[distName]) newRegionsObj[regName].districtsObj[distName] = { id: `d_${Date.now()}_${Math.random()}`, name: distName, schools: [] };
        
        newRegionsObj[regName].districtsObj[distName].schools.push({ id: `s_${schoolCode || Math.random()}`, name: schoolName, code: schoolCode });
      });

      // Convert Objects to Arrays
      const builtRegions = Object.values(newRegionsObj).map(r => ({
         id: r.id,
         name: r.name,
         districts: Object.values(r.districtsObj)
      }));

      await saveConfig({ ...appConfig, regions: builtRegions });
      alert("გეოგრაფიული მონაცემები განახლდა!");
    };
    reader.readAsText(file);
  }

  // Subject Helpers
  const addGrade = () => {
    if(!newGrade) return;
    const currentGrades = appConfig.grades || ["I-IV კლასი", "V-IX კლასი", "X-XII კლასი"];
    if(!currentGrades.includes(newGrade)) {
      saveConfig({ ...appConfig, grades: [...currentGrades, newGrade] });
    }
    setNewGrade('');
  }

  const removeGrade = (grade) => {
    if(!window.confirm("წაიშლება კლასი და მასზე მიბმული საგნები. გსურთ გაგრძელება?")) return;
    const newGrades = (appConfig.grades || []).filter(g => g !== grade);
    const newSubjectsMap = { ...appConfig.subjectsByGrade };
    delete newSubjectsMap[grade];
    saveConfig({ ...appConfig, grades: newGrades, subjectsByGrade: newSubjectsMap });
  }

  const addSubject = (grade) => {
    const sName = newSubjects[grade];
    if(!sName) return;
    const currentSubjects = appConfig.subjectsByGrade?.[grade] || [];
    const newConfig = {
      ...appConfig,
      subjectsByGrade: { ...appConfig.subjectsByGrade, [grade]: [...currentSubjects, sName] }
    };
    saveConfig(newConfig);
    setNewSubjects(prev => ({...prev, [grade]: ''}));
  };

  const removeSubject = (grade, subject) => {
    const currentSubjects = appConfig.subjectsByGrade?.[grade] || [];
    const newConfig = {
      ...appConfig,
      subjectsByGrade: { ...appConfig.subjectsByGrade, [grade]: currentSubjects.filter(s => s !== subject) }
    };
    saveConfig(newConfig);
  };

  const tabs = [
    { id: 'sessions', label: 'სესიები' },
    { id: 'survey', label: 'კითხვარი' },
    { id: 'geo', label: 'გეოგრაფია' },
    { id: 'subjects', label: 'საგნები' },
    { id: 'config', label: 'პარამეტრები' }
  ];

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="flex bg-white/80 backdrop-blur-md p-2 rounded-[2rem] border border-white shadow-sm overflow-x-auto">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`px-6 py-3 rounded-2xl text-sm font-black transition-all whitespace-nowrap ${tab === t.id ? 'bg-[#2e3192] text-white shadow-md' : 'text-slate-500 hover:bg-white hover:text-[#2e3192]'}`}>
            {t.label}
          </button>
        ))}
      </div>
      
      {tab === 'sessions' && (
        <div className="bg-white/90 backdrop-blur-md p-8 md:p-10 rounded-[2.5rem] border border-white shadow-lg space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="font-black text-2xl text-slate-800">სესიების მართვა</h3>
            <button className="flex items-center gap-2 text-sm font-bold bg-blue-50 text-blue-600 px-4 py-2 rounded-xl border border-blue-100 opacity-50 cursor-not-allowed">
              <Plus size={16}/> დამატება
            </button>
          </div>
          <div className="space-y-3">
            {sessions.map(s => (
              <div key={s.id} className={`p-5 rounded-2xl border-2 flex justify-between items-center shadow-sm ${s.isActive ? 'border-blue-400 bg-blue-50/50' : 'border-slate-100 bg-white'}`}>
                <div>
                  <span className="font-black text-lg text-slate-800">{s.name}</span>
                  {s.isActive && <span className="ml-3 text-[10px] uppercase font-black bg-[#ed1c24] text-white px-2 py-1 rounded-md shadow-sm">აქტიური</span>}
                </div>
                <button onClick={() => onDeleteSession(s.id)} className="text-red-400 hover:bg-red-50 hover:text-red-600 p-2.5 rounded-xl transition-colors">
                  <Trash2 size={20}/>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {tab === 'survey' && (
        <div className="bg-white/90 backdrop-blur-md p-12 rounded-[2.5rem] border border-white shadow-lg flex flex-col items-center justify-center gap-6 min-h-[400px]">
          <div className="w-24 h-24 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center shadow-inner border border-white">
            <FileSpreadsheet size={40}/>
          </div>
          <div className="text-center space-y-2">
             <h3 className="text-2xl font-black text-slate-800">კითხვარის განახლება</h3>
             <p className="text-sm font-medium text-slate-500 max-w-sm">ატვირთეთ CSV ფაილი ახალი კითხვებით. ძველი სტრუქტურა წაიშლება.</p>
          </div>
          <button onClick={() => fileRef.current?.click()} className="bg-[#2e3192] hover:bg-[#1a1c5e] text-white px-10 py-5 rounded-[2rem] font-black shadow-xl hover:shadow-[#2e3192]/30 hover:-translate-y-1 transition-all mt-4">
            ფაილის არჩევა (CSV)
          </button>
          <input type="file" className="hidden" ref={fileRef} accept=".csv" onChange={handleSurveyUpload} />
          {uploadMsg && <div className="text-emerald-600 font-bold bg-emerald-50 px-6 py-3 rounded-xl border border-emerald-100">{uploadMsg}</div>}
        </div>
      )}

      {tab === 'geo' && (
        <div className="bg-white/90 backdrop-blur-md p-8 md:p-12 rounded-[2.5rem] border border-white shadow-lg flex flex-col items-center justify-center gap-6 min-h-[400px] text-center">
          <div className="w-24 h-24 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center shadow-inner border border-white">
            <Upload size={40}/>
          </div>
          <div className="text-center space-y-2 max-w-lg">
             <h3 className="text-2xl font-black text-slate-800">გეოგრაფიის იმპორტი</h3>
             <p className="text-sm font-medium text-slate-500 leading-relaxed">
               სისტემაში რეგიონების, რაიონების და სკოლების დასამატებლად ატვირთეთ მონაცემთა ბაზა CSV ფორმატში.<br/>
               <span className="font-bold text-slate-700 bg-slate-100 px-2 py-1 rounded">სვეტების თანმიმდევრობა: რეგიონი, რაიონი, სკოლა, სკოლის კოდი</span>
             </p>
          </div>
          <button onClick={() => geoFileRef.current?.click()} className="bg-[#2e3192] hover:bg-[#1a1c5e] text-white px-10 py-5 rounded-[2rem] font-black shadow-xl hover:-translate-y-1 transition-all mt-4">
            ბაზის ატვირთვა (CSV)
          </button>
          <input type="file" className="hidden" ref={geoFileRef} accept=".csv" onChange={handleGeoUpload} />
          <div className="mt-8 p-4 bg-amber-50 rounded-2xl border border-amber-100 text-amber-700 text-sm font-bold flex items-center gap-2">
            <AlertTriangle size={16}/> ყოველი ახალი ატვირთვა წაშლის ძველ სკოლების სიას.
          </div>
        </div>
      )}

      {tab === 'subjects' && (
        <div className="bg-white/90 backdrop-blur-md p-8 md:p-10 rounded-[2.5rem] border border-white shadow-lg space-y-8">
           <div className="flex items-center justify-between border-b border-slate-100 pb-4">
             <h3 className="font-black text-2xl text-slate-800">საგნების მართვა</h3>
             <div className="flex gap-2">
                <input type="text" placeholder="ახალი კლასი/საფეხური" value={newGrade} onChange={e => setNewGrade(e.target.value)} className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-blue-500 shadow-inner" />
                <button onClick={addGrade} className="bg-[#2e3192] text-white px-4 py-2 rounded-xl font-bold text-sm shadow-md hover:bg-[#1a1c5e]">დამატება</button>
             </div>
           </div>
           
           <div className="space-y-8">
             {(appConfig.grades || ["I-IV კლასი", "V-IX კლასი", "X-XII კლასი"]).map(grade => (
               <div key={grade} className="space-y-4">
                 <div className="flex items-center gap-3">
                   <h4 className="text-lg font-black text-[#2e3192]">{grade}</h4>
                   <button onClick={() => removeGrade(grade)} className="text-red-300 hover:text-red-500 hover:bg-red-50 p-1 rounded-md transition-colors"><Trash2 size={14}/></button>
                 </div>
                 <div className="flex flex-wrap gap-2 bg-slate-50/50 p-6 rounded-3xl border border-slate-200/50 shadow-inner">
                    {(appConfig.subjectsByGrade?.[grade] || []).map(subj => (
                      <div key={subj} className="flex items-center gap-2 bg-white border border-slate-200 px-4 py-2 rounded-xl font-bold text-sm text-slate-700 shadow-sm">
                        {subj}
                        <button onClick={() => removeSubject(grade, subj)} className="text-slate-400 hover:text-red-500 p-0.5 rounded-md hover:bg-red-50"><X size={14}/></button>
                      </div>
                    ))}
                    <div className="flex gap-2 ml-auto">
                      <input type="text" placeholder="ახალი საგანი" value={newSubjects[grade] || ''} onChange={e => setNewSubjects(p => ({...p, [grade]: e.target.value}))} className="px-3 py-2 bg-white border border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-blue-500 shadow-sm w-40" />
                      <button onClick={() => addSubject(grade)} className="bg-blue-100 text-blue-700 px-3 py-2 rounded-xl font-black text-sm hover:bg-blue-200 shadow-sm"><Plus size={16}/></button>
                    </div>
                 </div>
               </div>
             ))}
           </div>
        </div>
      )}

      {tab === 'config' && (
        <div className="bg-white/90 backdrop-blur-md p-8 md:p-10 rounded-[2.5rem] border border-white shadow-lg space-y-10">
          <h3 className="font-black text-2xl text-slate-800 border-b border-slate-100 pb-4">სისტემური პარამეტრები</h3>
          
          <div className="space-y-3">
            <label className="text-xs font-black uppercase tracking-widest text-slate-400">მისასალმებელი ტექსტი (სათაური)</label>
            <input 
              type="text"
              className="w-full p-5 bg-white border border-slate-200 rounded-2xl font-black text-slate-700 outline-none focus:ring-4 ring-blue-500/10 focus:border-blue-500 transition-all shadow-sm"
              value={appConfig.welcomeText || ''}
              onChange={e => saveConfig({...appConfig, welcomeText: e.target.value})}
            />
          </div>

          <div className="space-y-3">
            <label className="text-xs font-black uppercase tracking-widest text-slate-400">კვლევის დეტალები (აღწერა)</label>
            <textarea 
              className="w-full p-5 bg-white border border-slate-200 rounded-2xl font-bold text-slate-600 outline-none focus:ring-4 ring-blue-500/10 focus:border-blue-500 min-h-[100px] resize-y transition-all shadow-sm text-sm"
              value={appConfig.surveyDetails || ''}
              onChange={e => saveConfig({...appConfig, surveyDetails: e.target.value})}
            />
          </div>

          <div className="space-y-3">
            <label className="text-xs font-black uppercase tracking-widest text-slate-400">საგნობრივი კითხვების ID-ები (მძიმით გამოყოფილი)</label>
            <input 
              type="text"
              className="w-full p-5 bg-white border border-slate-200 rounded-2xl font-bold text-slate-700 outline-none focus:ring-4 ring-blue-500/10 focus:border-blue-500 transition-all shadow-sm"
              value={(appConfig.subjectSpecificIds || []).join(', ')}
              placeholder="მაგ: 2.2, 4.1"
              onChange={e => saveConfig({...appConfig, subjectSpecificIds: e.target.value.split(',').map(s => s.trim()).filter(Boolean)})}
            />
            <p className="text-xs font-bold text-slate-400 ml-2">ამ კითხვებზე მოსწავლეებს და მშობლებს გამოუჩნდებათ მატრიცა საგნების მიხედვით.</p>
          </div>

          <div className="space-y-4 pt-6 border-t border-slate-100">
            <div className="flex items-center gap-2">
              <BarChart2 className="text-slate-400"/>
              <label className="text-sm font-black uppercase tracking-widest text-slate-700">როლების პროცენტული წონა ანალიტიკაში</label>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries({ admin: "ადმინისტრაცია", teacher: "მასწავლებელი", student: "მოსწავლე", parent: "მშობელი" }).map(([rKey, rName]) => (
                <div key={rKey} className="bg-slate-50 p-4 rounded-2xl border border-slate-200 shadow-inner">
                  <label className="block text-[10px] font-black uppercase text-slate-500 mb-2">{rName}</label>
                  <div className="flex items-center gap-2">
                    <input type="number" min="0" max="100" className="w-full p-3 text-lg font-black bg-white rounded-xl border border-slate-200 outline-none focus:border-blue-500" value={appConfig.roleWeights?.[rKey] || 0} onChange={e => {
                       const newW = { ...(appConfig.roleWeights || { admin:25, teacher:25, student:25, parent:25 }), [rKey]: Number(e.target.value) };
                       saveConfig({ ...appConfig, roleWeights: newW });
                    }}/>
                    <span className="font-black text-slate-400">%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-10 border-t border-slate-100">
             <div className="bg-red-50 border border-red-100 rounded-3xl p-8 flex flex-col md:flex-row items-center justify-between gap-6">
                <div>
                  <h4 className="text-red-700 font-black text-lg flex items-center gap-2"><AlertTriangle/> მონაცემთა ბაზის გასუფთავება</h4>
                  <p className="text-sm font-medium text-red-600/80 mt-1 max-w-md">ეს მოქმედება წაშლის <b>ყველა</b> შევსებულ კითხვარს და სესიას. გამოიყენება ტესტირების შემდეგ ან Firebase-ის ლიმიტების თავიდან ასაცილებლად.</p>
                </div>
                <button onClick={() => {
                  if(window.prompt("დაადასტურეთ გასუფთავება: ჩაწერეთ 'delete'") === 'delete') clearEntireDatabase();
                }} className="bg-red-500 hover:bg-red-600 text-white px-6 py-4 rounded-2xl font-black shadow-lg shadow-red-500/30 transition-all shrink-0">
                  ბაზის სრულად წაშლა
                </button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
}