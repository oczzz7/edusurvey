import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  ChevronLeft, ChevronRight, Settings, BarChart2, LogOut, 
  FileSpreadsheet, Trash2, X, Database, Calendar, MapPin, 
  BookOpen, Plus, Search 
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

const appId = 'school-survey-pro-v3';

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

const GRADE_LEVELS = ["I-IV კლასი", "V-IX კლასი", "X-XII კლასი"];

const RESPONSE_WEIGHTS = {
  "დიახ": 100, "მეტწილად": 75, "ნაწილობრივ": 50, "არა": 25, "არ ვიცი": 0
};

const scaleOptions = Object.keys(RESPONSE_WEIGHTS);

const EmisLogo = ({ className }) => {
  const urls = [
    "https://emis.ge/wp-content/uploads/2021/04/emis-logo.svg",
    "https://eschool.emis.ge/assets/img/emis-logo.png"
  ];
  const [index, setIndex] = useState(0);
  if (index >= urls.length) return <div className="text-blue-600 font-black text-xl">EMIS</div>;
  return <img src={urls[index]} alt="EMIS Logo" className={className} onError={() => setIndex(index + 1)} />;
};

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
  
  // დეფოლტ კონფიგურაცია უფრო მდიდარი სტრუქტურით
  const [appConfig, setAppConfig] = useState({ 
    welcomeText: "კეთილი იყოს თქვენი მობრძანება სკოლების შეფასების პლატფორმაზე.",
    regions: [
      { 
        id: "r1", name: "თბილისი", 
        districts: [
          { id: "d1", name: "ვაკე", schools: [{ id: "s1", name: "55-ე საჯარო სკოლა" }] },
          { id: "d2", name: "საბურთალო", schools: [{ id: "s2", name: "161-ე საჯარო სკოლა" }] }
        ] 
      }
    ],
    subjectsByGrade: {
      "I-IV კლასი": ["ბუნება", "ქართული", "მათემატიკა", "ხელოვნება"],
      "V-IX კლასი": ["ისტორია", "ბიოლოგია", "გეოგრაფია", "ფიზიკა", "ქიმია"],
      "X-XII კლასი": ["სამოქალაქო განათლება", "ეკონომიკა", "გლობალური პოლიტიკა"]
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
  
  const submitResponse = async (data) => {
    if (!db) return;
    const active = sessions.find(s => s.isActive) || sessions[0];
    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'responses'), { ...data, sessionId: active?.id || 'default' });
  };

  if (isInitializing) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-slate-50 space-y-4">
        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin shadow-lg"></div>
        <div className="font-black text-slate-400 animate-pulse tracking-wide">მონაცემების ჩატვირთვა...</div>
      </div>
    );
  }

  if (initError) {
    return (
      <div className="h-screen flex items-center justify-center bg-red-50 p-6">
        <div className="bg-white p-8 rounded-[2.5rem] shadow-2xl border border-red-100 text-center space-y-6 max-w-lg">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto">
             <X className="w-10 h-10 text-red-500" />
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
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-indigo-100 selection:text-indigo-900">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-5 cursor-pointer group" onClick={handleSelectionReset}>
            <EmisLogo className="h-10 object-contain group-hover:scale-105 transition-transform" />
            <div className="h-8 w-px bg-slate-200 hidden sm:block"></div>
            <div className="hidden sm:flex flex-col">
              <span className="text-slate-900 font-black text-2xl tracking-tighter leading-none"><span className="text-indigo-700">EDU</span>SURVEY</span>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">კვლევის პლატფორმა</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {userRole === ROLES.RESPONDENT ? (
              <div className="flex gap-1 bg-slate-50 p-1.5 rounded-2xl border border-slate-200 shadow-inner">
                <button onClick={() => { setUserRole(ROLES.SCHOOL_VIEWER); setCurrentView('stats'); }} className="text-xs font-black text-slate-500 hover:text-indigo-600 hover:bg-white px-4 py-2 flex items-center gap-2 rounded-xl transition-all">
                  <BarChart2 className="w-4 h-4" /> ანალიტიკა
                </button>
                <button onClick={() => { setUserRole(ROLES.SUPER_ADMIN); setCurrentView('admin'); }} className="text-xs font-black text-slate-500 hover:text-indigo-600 hover:bg-white px-4 py-2 flex items-center gap-2 rounded-xl transition-all">
                  <Settings className="w-4 h-4" /> მართვა
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <span className="text-[10px] font-black uppercase bg-indigo-50 border border-indigo-100 text-indigo-700 px-4 py-2 rounded-xl shadow-sm tracking-wide">
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
          <AdminPortal surveyData={surveyData} saveSurvey={saveSurvey} sessions={sessions} saveSessions={saveSessions} onDeleteSession={deleteSession} appConfig={appConfig} saveConfig={saveConfig} />
        ) : userRole === ROLES.SCHOOL_VIEWER ? (
          <AnalyticsPanel responses={responses} surveyData={surveyData} appConfig={appConfig} sessions={sessions} onBack={handleSelectionReset} />
        ) : (
          <>
            {currentView === 'landing' && (
              <div className="max-w-3xl mx-auto text-center space-y-12 py-16 animate-in fade-in slide-in-from-bottom-8 duration-700">
                <div className="bg-white p-14 rounded-[3.5rem] shadow-2xl border border-indigo-50/50 space-y-10 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-50/50 rounded-full blur-3xl -z-10 translate-x-1/2 -translate-y-1/2"></div>
                  <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-50/50 rounded-full blur-3xl -z-10 -translate-x-1/2 translate-y-1/2"></div>
                  
                  <div className="flex justify-center mb-8"><EmisLogo className="h-24 object-contain drop-shadow-sm" /></div>
                  <h1 className="text-4xl sm:text-5xl font-black text-slate-800 leading-tight tracking-tighter">{appConfig.welcomeText}</h1>
                  
                  {activeSession && (
                    <div className="inline-flex items-center gap-3 bg-white border border-slate-100 text-slate-600 px-6 py-3 rounded-2xl text-sm font-bold shadow-md">
                      <div className="p-1.5 bg-indigo-50 rounded-lg"><Calendar size={18} className="text-indigo-600"/></div>
                      მიმდინარეობს: <span className="text-indigo-700 font-black">{activeSession.name || 'კვლევა'}</span>
                    </div>
                  )}
                  
                  <div className="pt-6">
                    <button onClick={() => setCurrentView('geoSelect')} className="w-full sm:w-auto inline-flex items-center justify-center gap-4 bg-blue-600 text-white px-14 py-6 rounded-[2rem] font-black text-lg hover:bg-blue-700 hover:scale-105 transition-all shadow-xl hover:shadow-blue-600/30">
                      გამოკითხვის დაწყება <ChevronRight className="w-6 h-6" />
                    </button>
                  </div>
                </div>
              </div>
            )}
            {currentView === 'geoSelect' && <GeoSelectionView selection={selection} setSelection={setSelection} onConfirm={() => setCurrentView('roleSelect')} appConfig={appConfig} />}
            {currentView === 'roleSelect' && <RoleVerificationView onVerified={(role) => { setActiveSurveyRole(role); setCurrentView(role === 'student' || role === 'parent' ? 'gradeSelect' : 'survey'); }} onBack={() => setCurrentView('geoSelect')} />}
            {currentView === 'gradeSelect' && <GradeSelectView onSelect={(g) => { setGradeRange(g); setCurrentView('survey'); }} />}
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
    <div className="max-w-md mx-auto bg-white p-12 rounded-[3.5rem] shadow-2xl border border-indigo-50 space-y-8 animate-in zoom-in-95 duration-500">
      <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-6">
        <MapPin size={32} />
      </div>
      <h2 className="text-3xl font-black text-slate-800 text-center tracking-tighter">სკოლის შერჩევა</h2>
      <div className="space-y-5">
        <select className="w-full p-5 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-700 outline-none focus:ring-4 ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer appearance-none" value={selection.region} onChange={e => setSelection({ region: e.target.value, district: '', schoolId: '' })}>
          <option value="" disabled>აირჩიეთ რეგიონი</option>
          {regions.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
        </select>
        <select className="w-full p-5 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-700 outline-none focus:ring-4 ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer appearance-none disabled:opacity-50 disabled:cursor-not-allowed" disabled={!selection.region} value={selection.district} onChange={e => setSelection({ ...selection, district: e.target.value, schoolId: '' })}>
          <option value="" disabled>აირჩიეთ რაიონი</option>
          {selectedRegionObj?.districts?.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
        </select>
        <select className="w-full p-5 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-700 outline-none focus:ring-4 ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer appearance-none disabled:opacity-50 disabled:cursor-not-allowed" disabled={!selection.district} value={selection.schoolId} onChange={e => setSelection({ ...selection, schoolId: e.target.value })}>
          <option value="" disabled>აირჩიეთ სკოლა</option>
          {selectedDistrictObj?.schools?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>
      <button disabled={!selection.schoolId} onClick={onConfirm} className="w-full py-6 bg-indigo-600 text-white rounded-2xl font-black text-lg disabled:opacity-40 disabled:hover:scale-100 hover:bg-indigo-700 shadow-xl shadow-indigo-200 transition-all active:scale-95">გაგრძელება</button>
    </div>
  );
}

function RoleVerificationView({ onVerified, onBack }) {
  const [role, setRole] = useState(null);
  const [code, setCode] = useState("");
  const codes = { admin: "1111", teacher: "2222", student: "3333", parent: "4444" };
  const roleNames = { admin: "ადმინისტრაცია", teacher: "მასწავლებელი", student: "მოსწავლე", parent: "მშობელი" };

  if (role) return (
    <div className="max-w-md mx-auto bg-white p-12 rounded-[3.5rem] shadow-2xl text-center space-y-10 animate-in slide-in-from-right-8 duration-500">
      <div className="space-y-4">
        <h3 className="text-2xl font-black uppercase text-indigo-600 tracking-widest">{roleNames[role]}</h3>
        <p className="text-sm font-bold text-slate-400">შეიყვანეთ წვდომის 4-ნიშნა კოდი</p>
      </div>
      <input type="password" maxLength={4} autoFocus placeholder="••••" className="w-full text-center text-5xl p-6 bg-slate-50 border-b-4 border-indigo-600 rounded-2xl font-black tracking-[1.5rem] outline-none placeholder:text-slate-300 focus:bg-indigo-50/50 transition-colors" value={code} onChange={e => { setCode(e.target.value); if(e.target.value === codes[role]) onVerified(role); }} />
      <button onClick={() => { setRole(null); setCode(""); }} className="text-slate-400 font-bold hover:text-slate-700 flex items-center justify-center gap-2 mx-auto transition-colors"><ChevronLeft size={16}/> უკან დაბრუნება</button>
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto animate-in fade-in duration-500">
      <div className="flex items-center gap-4 mb-8">
        <button onClick={onBack} className="p-3 bg-white border border-slate-200 rounded-2xl text-slate-400 hover:text-indigo-600 hover:border-indigo-200 transition-all shadow-sm"><ChevronLeft /></button>
        <h2 className="text-3xl font-black text-slate-800 tracking-tight">მიუთითეთ თქვენი როლი</h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {Object.entries(roleNames).map(([id, label]) => (
          <button key={id} onClick={() => setRole(id)} className="p-10 bg-white border-2 border-slate-100 rounded-[2.5rem] font-black text-xl hover:border-indigo-600 hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 flex flex-col items-center gap-6 group">
            <div className="w-20 h-20 bg-slate-50 rounded-[1.5rem] flex items-center justify-center text-slate-300 group-hover:bg-indigo-600 group-hover:text-white transition-all uppercase font-black text-3xl tracking-tighter">{id[0]}</div>
            <span className="text-slate-700 group-hover:text-indigo-900 transition-colors">{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function GradeSelectView({ onSelect }) {
  return (
    <div className="max-w-md mx-auto bg-white p-12 rounded-[3.5rem] shadow-2xl text-center space-y-10 animate-in slide-in-from-right-8 duration-500">
      <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-2">
        <BookOpen size={32} />
      </div>
      <h3 className="text-2xl font-black text-slate-800 tracking-tight">რომელ კლასში ხართ?</h3>
      <div className="space-y-4">
        {GRADE_LEVELS.map(g => (
          <button key={g} onClick={() => onSelect(g)} className="w-full p-6 bg-slate-50 rounded-2xl border-2 border-transparent font-black text-lg text-slate-600 hover:border-blue-500 hover:bg-blue-50 hover:text-blue-700 transition-all active:scale-95">{g}</button>
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

  if (renderList.length === 0) return <div className="max-w-md mx-auto text-center p-20 bg-white rounded-3xl shadow-sm border border-slate-100 font-black text-slate-400">ამ როლისთვის კითხვები არ მოიძებნა.</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-40 animate-in fade-in slide-in-from-bottom-8 duration-700">
      <div className="sticky top-24 z-40 bg-white/80 backdrop-blur-xl p-6 rounded-[2rem] border border-slate-200/50 shadow-lg shadow-slate-200/50 flex items-center justify-between gap-6">
        <div className="flex-1 space-y-3">
          <div className="flex justify-between text-xs font-black uppercase text-slate-500 tracking-widest">
            <span>პროგრესი: {answeredCount} / {requiredCount}</span>
            <span className="text-indigo-600">{progress}%</span>
          </div>
          <div className="h-4 bg-slate-100 rounded-full overflow-hidden p-0.5">
            <div className="h-full bg-gradient-to-r from-indigo-500 to-blue-500 rounded-full transition-all duration-700 ease-out shadow-sm" style={{ width: `${progress}%` }}></div>
          </div>
        </div>
      </div>
      <div className="space-y-6">
        {renderList.map((q, idx) => {
          if (q.isSection) return <div key={q.id || `sec-${idx}`} className="pt-10 pb-4 border-b-2 border-slate-200"><h3 className="text-2xl font-black text-slate-800 leading-tight tracking-tight">{q.title}</h3></div>;
          
          const isSubjectSpecific = (appConfig.subjectSpecificIds || []).includes(q.id) && (role === 'student' || role === 'parent');
          const availableSubjects = gradeRange ? (appConfig.subjectsByGrade?.[gradeRange] || []) : [];
          const ans = answers[q.id] || {};
          
          return (
            <div key={q.id} className="bg-white p-8 md:p-10 rounded-[2.5rem] border border-slate-200 shadow-sm hover:shadow-md transition-shadow duration-300 space-y-8">
              <div className="flex gap-5">
                <span className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center font-black flex-shrink-0 text-lg">{q.id}</span>
                <p className="font-bold text-slate-700 text-lg md:text-xl leading-relaxed pt-1">{q.text}</p>
              </div>
              
              {!isSubjectSpecific ? (
                <div className="flex flex-wrap gap-3">
                  {scaleOptions.map(opt => (
                    <button key={opt} onClick={() => updateAnswer(q.id, 'value', opt)} className={`flex-1 min-w-[110px] py-4 md:py-5 rounded-2xl text-xs md:text-sm font-black border-2 transition-all active:scale-95 ${ans.value === opt ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-200' : 'bg-slate-50 text-slate-500 border-slate-100 hover:border-indigo-300 hover:bg-white'}`}>
                      {opt}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="mt-4 border border-slate-200 rounded-[2rem] overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-black text-[10px] uppercase tracking-widest">
                        <tr>
                          <th className="p-5 bg-slate-50 sticky left-0 z-10 border-r border-slate-200">საგანი</th>
                          {scaleOptions.map(opt => <th key={opt} className="p-5 text-center">{opt}</th>)}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {availableSubjects.map(subj => (
                          <tr key={subj} className="hover:bg-indigo-50/30 transition-colors">
                            <td className="p-5 font-bold text-slate-700 bg-white sticky left-0 z-10 border-r border-slate-100">{subj}</td>
                            {scaleOptions.map(opt => (
                              <td key={opt} className="p-5 text-center cursor-pointer" onClick={() => updateMatrixAnswer(q.id, subj, opt)}>
                                <div className={`w-6 h-6 mx-auto rounded-full border-2 flex items-center justify-center transition-all ${ans.values?.[subj] === opt ? 'border-indigo-600 bg-indigo-600 shadow-sm' : 'border-slate-300 bg-white hover:border-indigo-400'}`}>
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
              
              <div className="bg-slate-50 p-2 rounded-2xl border border-slate-100 focus-within:border-indigo-400 focus-within:ring-4 ring-indigo-500/10 transition-all">
                <textarea placeholder="დაამატეთ კომენტარი (არასავალდებულო)..." value={ans.comment || ''} onChange={e => updateAnswer(q.id, 'comment', e.target.value)} className="w-full p-4 bg-transparent text-sm font-medium text-slate-700 resize-none min-h-[100px] outline-none placeholder:text-slate-400" />
              </div>
            </div>
          );
        })}
      </div>
      
      <div className="fixed bottom-0 left-0 w-full p-6 bg-gradient-to-t from-slate-50 via-slate-50 to-transparent z-40 flex justify-center pointer-events-none">
        <button disabled={answeredCount < requiredCount || isSubmitting} onClick={handleSubmit} className="w-full max-w-sm py-6 bg-slate-900 text-white rounded-[2.5rem] font-black text-lg shadow-2xl shadow-slate-900/20 disabled:opacity-30 disabled:translate-y-4 hover:-translate-y-1 transition-all duration-300 pointer-events-auto flex items-center justify-center gap-3">
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

  // ამოვიღოთ უნიკალური სკოლები, საიდანაც გვაქვს პასუხები ამ სესიაში
  const availableSchools = useMemo(() => {
    const sessionResp = responses.filter(r => r.sessionId === selectedSessionId);
    const sIds = [...new Set(sessionResp.map(r => r.schoolId))];
    
    // მოვძებნოთ ამ სკოლების სრული ობიექტები კონფიგიდან
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
    
    // თუ რაიმე ფილტრია არჩეული, ჯერ მოვძებნოთ იმ სკოლების აიდები, რომლებიც ერგება ფილტრს
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
    const scores = {}; 
    filteredResponses.forEach(resp => { 
      Object.entries(resp.answers || {}).forEach(([qId, ans]) => { 
        if (!scores[qId]) scores[qId] = { sum: 0, count: 0, subjects: {} }; 
        if (ans.isMatrix) { 
          Object.entries(ans.values || {}).forEach(([s, v]) => { 
            const w = RESPONSE_WEIGHTS[v]; 
            scores[qId].sum += w; 
            scores[qId].count++; 
            if (!scores[qId].subjects[s]) scores[qId].subjects[s] = { sum: 0, count: 0 }; 
            scores[qId].subjects[s].sum += w; 
            scores[qId].subjects[s].count++; 
          }); 
        } else { 
          const w = RESPONSE_WEIGHTS[ans.value]; 
          scores[qId].sum += w; 
          scores[qId].count++; 
        } 
      }); 
    }); 
    return scores; 
  }, [filteredResponses]);

  // უნიკალური რეგიონები და რაიონები ფილტრებისთვის (მხოლოდ იმათი, სადაც პასუხებია)
  const uniqueRegions = [...new Set(availableSchools.map(s => s.region))];
  const uniqueDistricts = [...new Set(availableSchools.filter(s => !selectedRegion || s.region === selectedRegion).map(s => s.district))];
  const uniqueSchoolsList = availableSchools.filter(s => (!selectedRegion || s.region === selectedRegion) && (!selectedDistrict || s.district === selectedDistrict));

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm">
        <button onClick={onBack} className="flex items-center gap-2 text-slate-500 font-bold hover:text-indigo-600 transition-colors px-4 py-2 bg-slate-50 rounded-xl hover:bg-indigo-50"><ChevronLeft size={18} /> უკან</button>
        <div className="flex items-center gap-3 bg-indigo-50 px-5 py-3 rounded-2xl border border-indigo-100">
          <Database size={20} className="text-indigo-500" />
          <span className="text-sm font-bold text-slate-600">შევსებულია კითხვარი:</span>
          <span className="text-xl font-black text-indigo-700">{filteredResponses.length}</span>
        </div>
      </div>

      <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-6">
        <div className="flex items-center gap-3 mb-2">
          <Search className="text-slate-400" size={20}/>
          <h3 className="text-xl font-black text-slate-800">მონაცემების ფილტრაცია</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="space-y-2">
            <label className="text-xs font-black uppercase text-slate-400 px-1">კვლევის სესია</label>
            <select className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:ring-2 ring-indigo-500" value={selectedSessionId} onChange={e => { setSelectedSessionId(e.target.value); setSelectedRegion(''); setSelectedDistrict(''); setSelectedSchool(''); }}>
              {sessions.map(s => <option key={s.id} value={s.id}>{s.name} {s.isActive ? '(აქტიური)' : ''}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-black uppercase text-slate-400 px-1">რეგიონი</label>
            <select className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:ring-2 ring-indigo-500 disabled:opacity-50" value={selectedRegion} onChange={e => { setSelectedRegion(e.target.value); setSelectedDistrict(''); setSelectedSchool(''); }}>
              <option value="">ყველა რეგიონი</option>
              {uniqueRegions.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-black uppercase text-slate-400 px-1">რაიონი</label>
            <select className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:ring-2 ring-indigo-500 disabled:opacity-50" disabled={!selectedRegion} value={selectedDistrict} onChange={e => { setSelectedDistrict(e.target.value); setSelectedSchool(''); }}>
              <option value="">ყველა რაიონი</option>
              {uniqueDistricts.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-black uppercase text-slate-400 px-1">სკოლა</label>
            <select className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:ring-2 ring-indigo-500 disabled:opacity-50" disabled={!selectedDistrict} value={selectedSchool} onChange={e => setSelectedSchool(e.target.value)}>
              <option value="">ყველა სკოლა</option>
              {uniqueSchoolsList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm divide-y overflow-hidden">
        {surveyData.map(q => {
          if (q.type === 'section') return <div key={q.id} className="px-8 py-6 bg-slate-50/80 font-black text-indigo-900 text-lg border-b border-slate-200">{q.title}</div>;
          
          const stat = analytics?.[q.id]; 
          if (!stat) return null; 
          
          const score = Math.round(stat.sum / stat.count);
          
          return (
            <div key={q.id} className="p-8 hover:bg-slate-50/50 transition-colors flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
              <div className="flex-1 space-y-1">
                <span className="text-xs font-black px-2 py-1 bg-slate-100 rounded-lg text-slate-500">{q.id}</span>
                <p className="text-sm font-bold text-slate-700 leading-relaxed mt-2">{q.admin || q.teacher || q.student || q.parent || q.text}</p>
              </div>
              <div className="flex items-center gap-5 w-full md:w-64 shrink-0 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <div className="h-3 bg-slate-200 rounded-full flex-1 overflow-hidden shadow-inner">
                  <div className={`h-full rounded-full transition-all duration-1000 ${score >= 75 ? 'bg-emerald-500' : score >= 50 ? 'bg-amber-400' : 'bg-red-500'}`} style={{ width: `${score}%` }}></div>
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

function AdminPortal({ surveyData, saveSurvey, sessions, saveSessions, onDeleteSession, appConfig, saveConfig }) {
  const [tab, setTab] = useState('sessions');
  const [uploadMsg, setUploadMsg] = useState("");
  const fileRef = useRef(null);
  
  // გეოგრაფიის მართვის ლოკალური სტეიტები
  const [newRegName, setNewRegName] = useState('');
  const [newDistricts, setNewDistricts] = useState({}); // { regionId: text }
  const [newSchools, setNewSchools] = useState({}); // { districtId: text }

  // საგნების მართვის სტეიტები
  const [newSubjects, setNewSubjects] = useState({}); // { gradeLevel: text }

  const handleUpload = (e) => { 
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

  // Geo Helpers
  const addRegion = () => {
    if(!newRegName) return;
    const newConfig = { ...appConfig, regions: [...(appConfig.regions || []), { id: Date.now().toString(), name: newRegName, districts: [] }] };
    saveConfig(newConfig);
    setNewRegName('');
  };

  const removeRegion = (rId) => {
    if(!window.confirm("ნამდვილად გსურთ რეგიონის წაშლა?")) return;
    const newConfig = { ...appConfig, regions: appConfig.regions.filter(r => r.id !== rId) };
    saveConfig(newConfig);
  };

  const addDistrict = (rId) => {
    const dName = newDistricts[rId];
    if(!dName) return;
    const newRegions = appConfig.regions.map(r => {
      if(r.id === rId) return { ...r, districts: [...(r.districts || []), { id: Date.now().toString(), name: dName, schools: [] }] };
      return r;
    });
    saveConfig({ ...appConfig, regions: newRegions });
    setNewDistricts(prev => ({...prev, [rId]: ''}));
  };

  const addSchool = (rId, dId) => {
    const sName = newSchools[dId];
    if(!sName) return;
    const newRegions = appConfig.regions.map(r => {
      if(r.id === rId) {
        return {
          ...r,
          districts: r.districts.map(d => {
            if(d.id === dId) return { ...d, schools: [...(d.schools || []), { id: Date.now().toString(), name: sName }] };
            return d;
          })
        };
      }
      return r;
    });
    saveConfig({ ...appConfig, regions: newRegions });
    setNewSchools(prev => ({...prev, [dId]: ''}));
  };

  const removeSchool = (rId, dId, sId) => {
    const newRegions = appConfig.regions.map(r => {
      if(r.id === rId) {
        return {
          ...r,
          districts: r.districts.map(d => {
            if(d.id === dId) return { ...d, schools: d.schools.filter(s => s.id !== sId) };
            return d;
          })
        };
      }
      return r;
    });
    saveConfig({ ...appConfig, regions: newRegions });
  };

  // Subject Helpers
  const addSubject = (grade) => {
    const sName = newSubjects[grade];
    if(!sName) return;
    const currentSubjects = appConfig.subjectsByGrade?.[grade] || [];
    const newConfig = {
      ...appConfig,
      subjectsByGrade: {
        ...appConfig.subjectsByGrade,
        [grade]: [...currentSubjects, sName]
      }
    };
    saveConfig(newConfig);
    setNewSubjects(prev => ({...prev, [grade]: ''}));
  };

  const removeSubject = (grade, subject) => {
    const currentSubjects = appConfig.subjectsByGrade?.[grade] || [];
    const newConfig = {
      ...appConfig,
      subjectsByGrade: {
        ...appConfig.subjectsByGrade,
        [grade]: currentSubjects.filter(s => s !== subject)
      }
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
      <div className="flex bg-white p-2 rounded-[2rem] border border-slate-200 w-fit shadow-sm overflow-x-auto">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`px-6 py-3 rounded-2xl text-sm font-black transition-all whitespace-nowrap ${tab === t.id ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50 hover:text-indigo-600'}`}>
            {t.label}
          </button>
        ))}
      </div>
      
      {tab === 'sessions' && (
        <div className="bg-white p-8 md:p-10 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="font-black text-2xl text-slate-800">სესიების მართვა</h3>
            <button className="flex items-center gap-2 text-sm font-bold bg-indigo-50 text-indigo-600 px-4 py-2 rounded-xl border border-indigo-100 opacity-50 cursor-not-allowed">
              <Plus size={16}/> დამატება
            </button>
          </div>
          <div className="space-y-3">
            {sessions.map(s => (
              <div key={s.id} className={`p-5 rounded-2xl border-2 flex justify-between items-center ${s.isActive ? 'border-indigo-500 bg-indigo-50/50' : 'border-slate-100 bg-white'}`}>
                <div>
                  <span className="font-black text-lg text-slate-800">{s.name}</span>
                  {s.isActive && <span className="ml-3 text-[10px] uppercase font-black bg-indigo-600 text-white px-2 py-1 rounded-md">აქტიური</span>}
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
        <div className="bg-white p-12 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col items-center justify-center gap-6 min-h-[400px]">
          <div className="w-24 h-24 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center">
            <FileSpreadsheet size={40}/>
          </div>
          <div className="text-center space-y-2">
             <h3 className="text-2xl font-black text-slate-800">კითხვარის განახლება</h3>
             <p className="text-sm font-medium text-slate-500 max-w-sm">ატვირთეთ CSV ფაილი ახალი კითხვებით. ძველი სტრუქტურა წაიშლება.</p>
          </div>
          <button onClick={() => fileRef.current?.click()} className="bg-indigo-600 hover:bg-indigo-700 text-white px-10 py-5 rounded-[2rem] font-black shadow-lg hover:-translate-y-1 transition-all mt-4">
            ფაილის არჩევა (CSV)
          </button>
          <input type="file" className="hidden" ref={fileRef} accept=".csv" onChange={handleUpload} />
          {uploadMsg && <div className="text-emerald-600 font-bold bg-emerald-50 px-6 py-3 rounded-xl border border-emerald-100">{uploadMsg}</div>}
        </div>
      )}

      {tab === 'geo' && (
        <div className="bg-white p-8 md:p-10 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-8">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <h3 className="font-black text-2xl text-slate-800">გეოგრაფიული ერთეულები</h3>
            <div className="flex gap-2">
              <input type="text" placeholder="ახალი რეგიონი" value={newRegName} onChange={e => setNewRegName(e.target.value)} className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-indigo-500" />
              <button onClick={addRegion} className="bg-slate-800 text-white px-4 py-2 rounded-xl font-bold text-sm hover:bg-slate-900">დამატება</button>
            </div>
          </div>
          
          <div className="space-y-6">
            {(appConfig.regions || []).map(r => (
              <div key={r.id} className="bg-slate-50 p-6 rounded-3xl border border-slate-200 space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="text-xl font-black text-indigo-900">{r.name}</h4>
                  <div className="flex gap-2">
                    <input type="text" placeholder="ახალი რაიონი" value={newDistricts[r.id] || ''} onChange={e => setNewDistricts(p => ({...p, [r.id]: e.target.value}))} className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg font-bold text-xs outline-none focus:border-indigo-500" />
                    <button onClick={() => addDistrict(r.id)} className="bg-indigo-100 text-indigo-700 px-3 py-1.5 rounded-lg font-black text-xs hover:bg-indigo-200">რაიონის დამატება</button>
                    <button onClick={() => removeRegion(r.id)} className="text-red-400 p-1.5 hover:bg-red-50 rounded-lg"><Trash2 size={16}/></button>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  {(r.districts || []).map(d => (
                    <div key={d.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                       <h5 className="font-black text-slate-700 border-b border-slate-100 pb-2">{d.name}</h5>
                       <ul className="space-y-2 max-h-48 overflow-y-auto pr-2">
                         {(d.schools || []).map(s => (
                           <li key={s.id} className="flex justify-between items-center text-sm font-medium bg-slate-50 px-3 py-2 rounded-lg">
                             <span className="truncate pr-2">{s.name}</span>
                             <button onClick={() => removeSchool(r.id, d.id, s.id)} className="text-slate-400 hover:text-red-500"><X size={14}/></button>
                           </li>
                         ))}
                       </ul>
                       <div className="flex gap-2 mt-4 pt-2 border-t border-slate-50">
                          <input type="text" placeholder="სკოლის სახელი" value={newSchools[d.id] || ''} onChange={e => setNewSchools(p => ({...p, [d.id]: e.target.value}))} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-bold text-xs outline-none focus:border-indigo-500" />
                          <button onClick={() => addSchool(r.id, d.id)} className="bg-slate-800 text-white px-3 py-2 rounded-lg font-black text-xs hover:bg-slate-900"><Plus size={14}/></button>
                       </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {!(appConfig.regions?.length > 0) && <div className="text-center p-10 font-bold text-slate-400 border-2 border-dashed rounded-3xl">რეგიონები არ არის დამატებული</div>}
          </div>
        </div>
      )}

      {tab === 'subjects' && (
        <div className="bg-white p-8 md:p-10 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-8">
           <h3 className="font-black text-2xl text-slate-800 border-b border-slate-100 pb-4">საგნების მართვა</h3>
           <div className="space-y-8">
             {GRADE_LEVELS.map(grade => (
               <div key={grade} className="space-y-4">
                 <h4 className="text-lg font-black text-indigo-900">{grade}</h4>
                 <div className="flex flex-wrap gap-2 bg-slate-50 p-6 rounded-3xl border border-slate-100">
                    {(appConfig.subjectsByGrade?.[grade] || []).map(subj => (
                      <div key={subj} className="flex items-center gap-2 bg-white border border-slate-200 px-4 py-2 rounded-xl font-bold text-sm text-slate-700 shadow-sm">
                        {subj}
                        <button onClick={() => removeSubject(grade, subj)} className="text-slate-400 hover:text-red-500 p-0.5 rounded-md hover:bg-red-50"><X size={14}/></button>
                      </div>
                    ))}
                    <div className="flex gap-2 ml-auto">
                      <input type="text" placeholder="ახალი საგანი" value={newSubjects[grade] || ''} onChange={e => setNewSubjects(p => ({...p, [grade]: e.target.value}))} className="px-3 py-2 bg-white border border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-indigo-500 w-40" />
                      <button onClick={() => addSubject(grade)} className="bg-indigo-100 text-indigo-700 px-3 py-2 rounded-xl font-black text-sm hover:bg-indigo-200"><Plus size={16}/></button>
                    </div>
                 </div>
               </div>
             ))}
           </div>
        </div>
      )}

      {tab === 'config' && (
        <div className="bg-white p-8 md:p-10 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-8">
          <h3 className="font-black text-2xl text-slate-800 border-b border-slate-100 pb-4">სისტემური პარამეტრები</h3>
          
          <div className="space-y-3">
            <label className="text-xs font-black uppercase tracking-widest text-slate-400">მისასალმებელი ტექსტი</label>
            <textarea 
              className="w-full p-5 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-700 outline-none focus:ring-4 ring-indigo-500/10 focus:border-indigo-500 min-h-[120px] resize-y transition-all"
              value={appConfig.welcomeText || ''}
              onChange={e => saveConfig({...appConfig, welcomeText: e.target.value})}
            />
          </div>

          <div className="space-y-3">
            <label className="text-xs font-black uppercase tracking-widest text-slate-400">საგნობრივი კითხვების ID-ები (მძიმით გამოყოფილი)</label>
            <input 
              type="text"
              className="w-full p-5 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-700 outline-none focus:ring-4 ring-indigo-500/10 focus:border-indigo-500 transition-all"
              value={(appConfig.subjectSpecificIds || []).join(', ')}
              placeholder="მაგ: 2.2, 4.1"
              onChange={e => saveConfig({...appConfig, subjectSpecificIds: e.target.value.split(',').map(s => s.trim()).filter(Boolean)})}
            />
            <p className="text-xs font-bold text-slate-400 ml-2">ამ კითხვებზე მოსწავლეებს და მშობლებს გამოუჩნდებათ მატრიცა საგნების მიხედვით.</p>
          </div>
        </div>
      )}
    </div>
  );
}