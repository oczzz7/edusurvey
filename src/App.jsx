import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  ChevronLeft, Globe, ChevronRight, Settings, BarChart2, LogOut, 
  Info, LayoutDashboard, MapPin, Building, ShieldCheck, 
  BookOpen, GraduationCap, Users, Lock, TrendingUp, Plus, Upload, 
  MessageSquare, FileSpreadsheet, Trash2, Save, Book, X, MessageCircle,
  Search, ChevronDown, ChevronUp, FileText, Database, Download, Calendar, Check
} from 'lucide-react';

// Firebase იმპორტები
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { 
  getFirestore, collection, doc, setDoc, addDoc, getDoc, 
  getDocs, onSnapshot, query, updateDoc, deleteDoc 
} from 'firebase/firestore';

// --- Firebase კონფიგურაცია და ინიციალიზაცია ---
// გარემო ცვლადები (ავტომატურად მოწოდებული პლატფორმის მიერ)
const firebaseConfig = typeof __firebase_config !== 'undefined' 
  ? JSON.parse(__firebase_config) 
  : { apiKey: "", authDomain: "", projectId: "", storageBucket: "", messagingSenderId: "", appId: "" };

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'school-survey-pro-default';

// --- კონსტანტები ---
const ROLES = {
  SUPER_ADMIN: 'super_admin',
  SCHOOL_VIEWER: 'school_viewer',
  RESPONDENT: 'respondent'
};

const GRADE_LEVELS = ["I-IV კლასი", "V-IX კლასი", "X-XII კლასი"];

const RESPONSE_WEIGHTS = {
  "დიახ": 100,
  "მეტწილად": 75,
  "ნაწილობრივ": 50,
  "არა": 25,
  "არ ვიცი": 0
};

const scaleOptions = Object.keys(RESPONSE_WEIGHTS);

// --- EMIS ლოგო ---
const EmisLogo = ({ className }) => {
  const urls = [
    "https://emis.ge/wp-content/uploads/2021/04/emis-logo.svg",
    "https://emis.ge/wp-content/themes/emis/assets/images/logo.svg",
    "https://eschool.emis.ge/assets/img/emis-logo.png"
  ];
  const [index, setIndex] = useState(0);
  if (index >= urls.length) return <div className="text-blue-600 font-black text-xl">EMIS</div>;
  return <img src={urls[index]} alt="EMIS Logo" className={className} onError={() => setIndex(index + 1)} />;
};

export default function App() {
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState(ROLES.RESPONDENT);
  const [currentView, setCurrentView] = useState('landing'); 
  const [selection, setSelection] = useState({ region: '', district: '', schoolId: '' });
  const [activeSurveyRole, setActiveSurveyRole] = useState(null);
  const [gradeRange, setGradeRange] = useState(null);

  // მონაცემთა მდგომარეობა
  const [sessions, setSessions] = useState([]);
  const [responses, setResponses] = useState([]);
  const [surveyData, setSurveyData] = useState([]);
  const [appConfig, setAppConfig] = useState({ 
    welcomeText: "კეთილი იყოს თქვენი მობრძანება სკოლების შეფასების პლატფორმაზე.",
    subjectsByGrade: {
      "I-IV კლასი": ["ბუნება", "ქართული", "მათემატიკა", "ხელოვნება"],
      "V-IX კლასი": ["ისტორია", "ბიოლოგია", "გეოგრაფია", "ფიზიკა", "ქიმია"],
      "X-XII კლასი": ["სამოქალაქო განათლება", "ეკონომიკა", "გლობალური პოლიტიკა"]
    },
    subjectSpecificIds: ["2.2", "2.4"]
  });

  // 1. ავტორიზაციის ინიციალიზაცია
  useEffect(() => {
    const initAuth = async () => {
      if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        await signInWithCustomToken(auth, __initial_auth_token);
      } else {
        await signInAnonymously(auth);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  // 2. მონაცემების რეალურ დროში წაკითხვა (Firestore)
  useEffect(() => {
    if (!user) return;

    // სესიების წაკითხვა
    const sessionsCol = collection(db, 'artifacts', appId, 'public', 'data', 'sessions');
    const unsubSessions = onSnapshot(sessionsCol, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setSessions(data.length > 0 ? data : [{ id: 's_default', name: 'ძირითადი კვლევა', isActive: true, createdAt: new Date().toISOString() }]);
    }, (err) => console.error("Session fetch error:", err));

    // პასუხების წაკითხვა
    const responsesCol = collection(db, 'artifacts', appId, 'public', 'data', 'responses');
    const unsubResponses = onSnapshot(responsesCol, (snapshot) => {
      setResponses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => console.error("Response fetch error:", err));

    // კითხვარის სტრუქტურის წაკითხვა
    const surveyDoc = doc(db, 'artifacts', appId, 'public', 'data', 'survey_schema');
    const unsubSurvey = onSnapshot(surveyDoc, (docSnap) => {
      if (docSnap.exists()) setSurveyData(docSnap.data().questions || []);
    });

    // კონფიგურაციის წაკითხვა
    const configDoc = doc(db, 'artifacts', appId, 'public', 'data', 'app_config');
    const unsubConfig = onSnapshot(configDoc, (docSnap) => {
      if (docSnap.exists()) setAppConfig(prev => ({ ...prev, ...docSnap.data() }));
    });

    return () => {
      unsubSessions();
      unsubResponses();
      unsubSurvey();
      unsubConfig();
    };
  }, [user]);

  // ფუნქციები Firestore-თან სამუშაოდ
  const saveSurvey = async (questions) => {
    const surveyDoc = doc(db, 'artifacts', appId, 'public', 'data', 'survey_schema');
    await setDoc(surveyDoc, { questions });
  };

  const saveConfig = async (newConfig) => {
    const configDoc = doc(db, 'artifacts', appId, 'public', 'data', 'app_config');
    await setDoc(configDoc, newConfig);
  };

  const saveSessions = async (newSessions) => {
    // Firestore-ში სესიებს ვინახავთ ინდივიდუალურ დოკუმენტებად
    for (const s of newSessions) {
      const sDoc = doc(db, 'artifacts', appId, 'public', 'data', 'sessions', s.id);
      await setDoc(sDoc, s);
    }
  };

  const deleteSession = async (sessionId) => {
    // 1. წავშალოთ სესიის დოკუმენტი
    await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'sessions', sessionId));
    // 2. წავშალოთ ამ სესიაზე მიბმული პასუხები
    const sessionResponses = responses.filter(r => r.sessionId === sessionId);
    for (const r of sessionResponses) {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'responses', r.id));
    }
  };

  const submitResponse = async (data) => {
    const activeSession = sessions.find(s => s.isActive) || sessions[0];
    const enrichedData = { ...data, sessionId: activeSession.id };
    const responsesCol = collection(db, 'artifacts', appId, 'public', 'data', 'responses');
    await addDoc(responsesCol, enrichedData);
  };

  const handleSelectionReset = () => {
    setSelection({ region: '', district: '', schoolId: '' });
    setActiveSurveyRole(null);
    setGradeRange(null);
    setCurrentView('landing');
  };

  const activeSession = sessions.find(s => s.isActive) || sessions[0];

  if (!user) return <div className="h-screen flex items-center justify-center font-bold text-slate-400 animate-pulse">კავშირი მონაცემთა ბაზასთან...</div>;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4 cursor-pointer" onClick={handleSelectionReset}>
            <EmisLogo className="h-10 object-contain" />
            <div className="h-8 w-px bg-slate-200 hidden sm:block"></div>
            <div className="hidden sm:flex flex-col">
              <span className="text-slate-900 font-black text-xl tracking-tighter leading-none">
                <span className="text-indigo-700">EDU</span>SURVEY
              </span>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">კვლევის პლატფორმა</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {userRole === ROLES.RESPONDENT ? (
              <div className="flex gap-2">
                <button onClick={() => { setUserRole(ROLES.SCHOOL_VIEWER); setCurrentView('stats'); }} className="text-xs font-bold text-slate-500 hover:text-indigo-600 px-3 py-1 flex items-center gap-1">
                  <BarChart2 className="w-4 h-4" /> ანალიტიკა
                </button>
                <button onClick={() => { setUserRole(ROLES.SUPER_ADMIN); setCurrentView('admin'); }} className="text-xs font-bold text-slate-500 hover:text-indigo-600 px-3 py-1 flex items-center gap-1 border-l pl-3 border-slate-200">
                  <Settings className="w-4 h-4" /> მართვა
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-black uppercase bg-indigo-50 border border-indigo-100 text-indigo-700 px-3 py-1.5 rounded-lg shadow-sm">
                  {userRole === ROLES.SUPER_ADMIN ? 'ადმინისტრატორი' : 'ანალიტიკოსი'}
                </span>
                <button onClick={() => { setUserRole(ROLES.RESPONDENT); handleSelectionReset(); }} className="text-slate-400 hover:text-red-500 transition-colors bg-slate-50 p-2 rounded-lg hover:bg-red-50">
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10">
        {userRole === ROLES.SUPER_ADMIN ? (
          <AdminPortal surveyData={surveyData} saveSurvey={saveSurvey} sessions={sessions} saveSessions={saveSessions} onDeleteSession={deleteSession} appConfig={appConfig} saveConfig={saveConfig} />
        ) : userRole === ROLES.SCHOOL_VIEWER ? (
          <AnalyticsPanel responses={responses} surveyData={surveyData} appConfig={appConfig} sessions={sessions} onBack={handleSelectionReset} />
        ) : (
          <>
            {currentView === 'landing' && (
              <div className="max-w-2xl mx-auto text-center space-y-12 py-12 animate-in fade-in slide-in-from-bottom-4">
                <div className="bg-white p-12 rounded-[3.5rem] shadow-xl border border-indigo-50/50 space-y-8 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50/50 rounded-full blur-3xl -z-10 translate-x-1/2 -translate-y-1/2"></div>
                  <div className="flex justify-center mb-8">
                    <EmisLogo className="h-20 object-contain drop-shadow-sm" />
                  </div>
                  <h1 className="text-4xl font-black text-slate-900 leading-tight">{appConfig.welcomeText}</h1>
                  {activeSession && (
                    <div className="inline-flex items-center gap-2 bg-slate-50 border border-slate-100 text-slate-500 px-5 py-2.5 rounded-xl text-sm font-bold shadow-sm">
                      <Calendar size={16} className="text-indigo-500"/> მიმდინარეობს: <span className="text-indigo-700">{activeSession.name}</span>
                    </div>
                  )}
                  <div className="pt-4">
                    <button onClick={() => setCurrentView('geoSelect')} className="w-full sm:w-auto inline-flex items-center justify-center gap-3 bg-blue-600 text-white px-12 py-5 rounded-2xl font-black hover:bg-blue-700 transition-all shadow-lg hover:shadow-blue-200/50">
                      გამოკითხვის დაწყება <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            )}
            {currentView === 'geoSelect' && <GeoSelectionView selection={selection} setSelection={setSelection} onConfirm={() => setCurrentView('roleSelect')} />}
            {currentView === 'roleSelect' && <RoleVerificationView onVerified={(role) => { setActiveSurveyRole(role); setCurrentView(role === 'student' || role === 'parent' ? 'gradeSelect' : 'survey'); }} onBack={() => setCurrentView('geoSelect')} />}
            {currentView === 'gradeSelect' && <GradeSelectView onSelect={(g) => { setGradeRange(g); setCurrentView('survey'); }} />}
            {currentView === 'survey' && <SurveyForm role={activeSurveyRole} gradeRange={gradeRange} schoolId={selection.schoolId} surveyData={surveyData} appConfig={appConfig} onComplete={handleSelectionReset} saveResponse={submitResponse} />}
          </>
        )}
      </main>
    </div>
  );
}

// --- კომპონენტების რეალიზაცია (Firestore ლოგიკით) ---

function GeoSelectionView({ selection, setSelection, onConfirm }) {
  // იმიტირებული გეო მონაცემები
  const geoData = [{ id: "t", name: "თბილისი", districts: [{ name: "ვაკე", schools: [{ id: "1001", name: "55-ე საჯარო სკოლა" }] }] }];
  const reg = geoData.find(g => g.name === selection.region);
  const dist = reg?.districts?.find(d => d.name === selection.district);

  return (
    <div className="max-w-md mx-auto bg-white p-10 rounded-[3rem] shadow-2xl border border-indigo-50 space-y-6">
      <div className="text-center space-y-2 mb-4">
        <h2 className="text-3xl font-black text-slate-900">სკოლის შერჩევა</h2>
      </div>
      <div className="space-y-4">
        <select className="w-full p-5 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none" value={selection.region} onChange={e => setSelection({ region: e.target.value, district: '', schoolId: '' })}>
          <option value="">რეგიონი</option>
          {geoData.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
        </select>
        <select className="w-full p-5 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none disabled:opacity-50" disabled={!selection.region} value={selection.district} onChange={e => setSelection({ ...selection, district: e.target.value, schoolId: '' })}>
          <option value="">რაიონი</option>
          {reg?.districts?.map(d => <option key={d.name} value={d.name}>{d.name}</option>)}
        </select>
        <select className="w-full p-5 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none disabled:opacity-50" disabled={!selection.district} value={selection.schoolId} onChange={e => setSelection({ ...selection, schoolId: e.target.value })}>
          <option value="">სკოლა</option>
          {dist?.schools?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>
      <button disabled={!selection.schoolId} onClick={onConfirm} className="w-full py-5 bg-blue-600 text-white rounded-2xl font-black disabled:opacity-30 shadow-xl">გაგრძელება</button>
    </div>
  );
}

function RoleVerificationView({ onVerified, onBack }) {
  const [role, setRole] = useState(null);
  const [code, setCode] = useState("");
  const codes = { admin: "1111", teacher: "2222", student: "3333", parent: "4444" };
  
  if (role) return (
    <div className="max-w-md mx-auto bg-white p-12 rounded-[3.5rem] shadow-2xl text-center space-y-8 animate-in zoom-in-95">
      <h3 className="text-2xl font-black uppercase text-indigo-600 tracking-widest">{role}</h3>
      <input type="password" maxLength={4} autoFocus className="w-full text-center text-5xl p-6 bg-slate-50 border-b-4 border-indigo-600 rounded-2xl font-black tracking-[1.5rem] outline-none" value={code} onChange={e => { setCode(e.target.value); if(e.target.value === codes[role]) onVerified(role); }} />
      <button onClick={() => { setRole(null); setCode(""); }} className="text-slate-400 font-bold hover:text-red-500">უკან</button>
    </div>
  );

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-2xl mx-auto">
      {['admin', 'teacher', 'student', 'parent'].map(r => (
        <button key={r} onClick={() => setRole(r)} className="p-10 bg-white border border-slate-100 rounded-[2.5rem] font-black text-xl hover:border-indigo-500 hover:shadow-2xl transition-all flex flex-col items-center gap-4 group">
          <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 group-hover:text-indigo-600 transition-colors uppercase">{r[0]}</div>
          <span className="text-slate-700 capitalize">{r}</span>
        </button>
      ))}
    </div>
  );
}

function GradeSelectView({ onSelect }) {
  return (
    <div className="max-w-md mx-auto space-y-6 text-center">
      <h3 className="text-2xl font-black text-slate-800 mb-6">მიუთითეთ საფეხური</h3>
      {GRADE_LEVELS.map(g => (
        <button key={g} onClick={() => onSelect(g)} className="w-full p-8 bg-white rounded-[2rem] border-2 border-slate-50 font-black text-xl hover:border-indigo-500 hover:bg-indigo-50 transition-all shadow-sm">{g}</button>
      ))}
    </div>
  );
}

// --- კითხვარის ფორმა (განახლებული) ---
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

  const updateAnswer = (qId, field, val) => {
    setAnswers(prev => ({ ...prev, [qId]: { ...(prev[qId] || {}), [field]: val } }));
  };

  const updateMatrixAnswer = (qId, subj, val) => {
    setAnswers(prev => {
      const current = prev[qId] || { isMatrix: true, values: {} };
      return { ...prev, [qId]: { ...current, isMatrix: true, values: { ...current.values, [subj]: val } } };
    });
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    await saveResponse({ schoolId, role, gradeRange, answers, timestamp: new Date().toISOString() });
    onComplete();
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-32 animate-in fade-in slide-in-from-bottom-4">
      <div className="sticky top-20 z-40 bg-white/90 backdrop-blur-md p-6 rounded-3xl border border-slate-200 shadow-lg flex items-center justify-between gap-6">
        <div className="flex-1 space-y-2">
          <div className="flex justify-between text-xs font-black uppercase text-slate-500">
            <span>პროგრესი: {answeredCount} / {requiredCount}</span>
            <span>{progress}%</span>
          </div>
          <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-blue-600 transition-all duration-500" style={{ width: `${progress}%` }}></div>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {renderList.map((q, idx) => {
          if (q.isSection) return <div key={idx} className="pt-8 pb-2 border-b-2 border-blue-100"><h3 className="text-xl font-black text-blue-900 leading-tight">{q.title}</h3></div>;
          
          const isSubjectSpecific = (appConfig.subjectSpecificIds || []).includes(q.id) && (role === 'student' || role === 'parent');
          const availableSubjects = gradeRange ? (appConfig.subjectsByGrade?.[gradeRange] || []) : [];
          const ans = answers[q.id] || {};

          return (
            <div key={q.id} className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm space-y-6">
              <div className="flex gap-4">
                <span className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center font-black flex-shrink-0 text-sm">{q.id}</span>
                <p className="font-bold text-slate-800 text-lg pt-2 leading-relaxed">{q.text}</p>
              </div>
              
              {!isSubjectSpecific ? (
                <div className="flex flex-wrap gap-2 pt-2">
                  {scaleOptions.map(opt => (
                    <button key={opt} onClick={() => updateAnswer(q.id, 'value', opt)} className={`flex-1 min-w-[100px] py-4 rounded-xl text-xs font-black border-2 transition-all ${ans.value === opt ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 'bg-slate-50 text-slate-500 border-transparent hover:border-slate-200'}`}>{opt}</button>
                  ))}
                </div>
              ) : (
                <div className="mt-4 border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                   <div className="overflow-x-auto">
                     <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-black text-[10px] uppercase">
                           <tr>
                             <th className="p-4 bg-white sticky left-0 z-10 border-r border-slate-100">საგანი</th>
                             {scaleOptions.map(opt => <th key={opt} className="p-4 text-center">{opt}</th>)}
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                           {availableSubjects.map(subj => (
                              <tr key={subj} className="hover:bg-blue-50/50 transition-colors">
                                 <td className="p-4 font-bold text-slate-700 bg-white sticky left-0 z-10 border-r border-slate-100">{subj}</td>
                                 {scaleOptions.map(opt => (
                                    <td key={opt} className="p-4 text-center cursor-pointer" onClick={() => updateMatrixAnswer(q.id, subj, opt)}>
                                       <div className={`w-5 h-5 mx-auto rounded-full border-2 flex items-center justify-center ${ans.values?.[subj] === opt ? 'border-blue-600 bg-blue-600' : 'border-slate-300 bg-white'}`}>
                                          {ans.values?.[subj] === opt && <div className="w-2 h-2 bg-white rounded-full"></div>}
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
              <textarea placeholder="კომენტარი..." value={ans.comment || ''} onChange={e => updateAnswer(q.id, 'comment', e.target.value)} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium resize-none min-h-[80px]" />
            </div>
          );
        })}
      </div>
      <button disabled={answeredCount < requiredCount || isSubmitting} onClick={handleSubmit} className="fixed bottom-10 left-1/2 -translate-x-1/2 w-full max-w-sm py-6 bg-blue-600 text-white rounded-[2rem] font-black shadow-2xl disabled:opacity-30">{isSubmitting ? 'იგზავნება...' : 'კითხვარის დასრულება'}</button>
    </div>
  );
}

// --- ანალიტიკური პანელი ---
function AnalyticsPanel({ responses, surveyData, appConfig, sessions, onBack }) {
  const [selectedSchoolId, setSelectedSchoolId] = useState('');
  const [selectedSessionId, setSelectedSessionId] = useState(sessions[0]?.id || '');

  const filteredResponses = useMemo(() => {
    let data = responses.filter(r => r.sessionId === selectedSessionId);
    if (selectedSchoolId) data = data.filter(r => r.schoolId === selectedSchoolId);
    return data;
  }, [responses, selectedSessionId, selectedSchoolId]);

  const analytics = useMemo(() => {
    if (filteredResponses.length === 0) return null;
    const scores = {};
    filteredResponses.forEach(resp => {
      Object.entries(resp.answers || {}).forEach(([qId, ans]) => {
        if (!scores[qId]) scores[qId] = { sum: 0, count: 0, subjects: {} };
        if (ans.isMatrix) {
          Object.entries(ans.values || {}).forEach(([s, v]) => {
            const w = RESPONSE_WEIGHTS[v];
            scores[qId].sum += w; scores[qId].count++;
            if (!scores[qId].subjects[s]) scores[qId].subjects[s] = { sum: 0, count: 0 };
            scores[qId].subjects[s].sum += w; scores[qId].subjects[s].count++;
          });
        } else {
          const w = RESPONSE_WEIGHTS[ans.value];
          scores[qId].sum += w; scores[qId].count++;
        }
      });
    });
    return scores;
  }, [filteredResponses]);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="flex items-center gap-2 text-slate-500 font-bold hover:text-blue-600 transition-colors"><ChevronLeft /> უკან</button>
        <div className="bg-white px-4 py-2 rounded-xl text-sm font-bold shadow-sm border text-slate-600">შევსებულია: <span className="text-blue-600">{filteredResponses.length}</span></div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-2">
          <label className="text-xs font-black uppercase text-slate-400">კვლევის სესია</label>
          <select className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold" value={selectedSessionId} onChange={e => setSelectedSessionId(e.target.value)}>
            {sessions.map(s => <option key={s.id} value={s.id}>{s.name} {s.isActive ? '(აქტიური)' : ''}</option>)}
          </select>
        </div>
      </div>
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm divide-y">
        {surveyData.map(q => {
          if (q.type === 'section') return <div key={q.id} className="p-6 bg-slate-50 font-black text-blue-900">{q.title}</div>;
          const stat = analytics?.[q.id];
          if (!stat) return null;
          const score = Math.round(stat.sum / stat.count);
          return (
            <div key={q.id} className="p-6 space-y-4">
              <div className="flex justify-between items-center gap-6">
                <span className="text-sm font-bold text-slate-700 flex-1">{q.admin || q.teacher || q.student || q.parent}</span>
                <div className="flex items-center gap-4 w-48">
                  <div className="h-2 bg-slate-100 rounded-full flex-1 overflow-hidden"><div className="h-full bg-blue-600" style={{ width: `${score}%` }}></div></div>
                  <span className="font-black text-slate-700 w-10 text-right">{score}%</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --- ადმინ პანელი (Firestore) ---
function AdminPortal({ surveyData, saveSurvey, sessions, saveSessions, onDeleteSession, appConfig, saveConfig }) {
  const [tab, setTab] = useState('sessions');
  const fileRef = useRef(null);

  const handleUpload = (e) => {
    const file = e.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      const rows = parseCSV(event.target.result);
      const questions = [];
      rows.forEach(cols => {
        if(cols.length < 2) return;
        const id = cols[0]?.trim();
        if(!id || isNaN(parseFloat(id))) return;
        if(id.endsWith('.0')) questions.push({ type: 'section', id, title: cols[1]?.trim() });
        else questions.push({ type: 'question', id, admin: cols[1], teacher: cols[3], student: cols[5], parent: cols[7] });
      });
      await saveSurvey(questions);
      alert("კითხვარი განახლდა!");
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6">
      <div className="flex gap-2 bg-white p-1.5 rounded-2xl border border-slate-200 w-fit shadow-sm">
        {['sessions', 'survey', 'config'].map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-6 py-2.5 rounded-xl text-xs font-black transition-all ${tab === t ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-50'}`}>{t}</button>
        ))}
      </div>
      {tab === 'sessions' && (
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-4">
          <h3 className="font-black text-xl">სესიების მართვა</h3>
          {sessions.map(s => (
            <div key={s.id} className={`p-4 rounded-xl border flex justify-between items-center ${s.isActive ? 'border-blue-500 bg-blue-50' : 'border-slate-100'}`}>
              <span className="font-bold">{s.name}</span>
              <button onClick={() => onDeleteSession(s.id)} className="text-red-500 hover:bg-red-50 p-2 rounded-lg"><Trash2 size={18}/></button>
            </div>
          ))}
        </div>
      )}
      {tab === 'survey' && (
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm flex flex-col items-center gap-6">
          <div className="p-4 bg-blue-50 text-blue-600 rounded-full"><FileSpreadsheet size={32}/></div>
          <button onClick={() => fileRef.current?.click()} className="bg-blue-600 text-white px-8 py-4 rounded-2xl font-black shadow-lg">კითხვარის ატვირთვა (CSV)</button>
          <input type="file" className="hidden" ref={fileRef} accept=".csv" onChange={handleUpload} />
        </div>
      )}
    </div>
  );
}