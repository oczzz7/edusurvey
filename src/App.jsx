import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  ChevronLeft, Globe, ChevronRight, Settings, BarChart2, LogOut, 
  Info, LayoutDashboard, MapPin, Building, ShieldCheck, 
  BookOpen, GraduationCap, Users, Lock, TrendingUp, Plus, Upload, 
  MessageSquare, FileSpreadsheet, Trash2, Save, Book, X, MessageCircle,
  Search, ChevronDown, ChevronUp, FileText, Database, Download, Calendar, Check
} from 'lucide-react';

// --- კონსტანტები და წონები ---
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

// --- EMIS ლოგოს უსაფრთხო ჩამტვირთავი ---
const EmisLogo = ({ className }) => {
  // EMIS-ის ლოგოს შესაძლო ბმულები (fallback ლოგიკით)
  const urls = [
    "https://emis.ge/wp-content/uploads/2021/04/emis-logo.svg",
    "https://emis.ge/wp-content/uploads/2023/11/emis-logo-geo.svg",
    "https://emis.ge/wp-content/themes/emis/assets/images/logo.svg",
    "https://emis.ge/wp-content/uploads/2021/05/emis-logo-geo.png",
    "https://eschool.emis.ge/assets/img/emis-logo.png"
  ];
  const [index, setIndex] = useState(0);

  if (index >= urls.length) {
    // თუ ვერცერთი ბმული ვერ ჩაიტვირთა, გამოვაჩენთ ლამაზ ტექსტს
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <div className="bg-blue-600 text-white font-black px-2 py-1 rounded text-xl">EMIS</div>
      </div>
    );
  }

  return (
    <img 
      src={urls[index]} 
      alt="EMIS Logo" 
      className={className} 
      onError={() => setIndex(index + 1)}
    />
  );
};

// --- საწყისი სატესტო მონაცემები ---
const defaultGeoData = [
  {
    id: "tbilisi", name: "თბილისი",
    districts: [
      { name: "ვაკე", schools: [{ id: "1001", name: "55-ე საჯარო სკოლა" }] },
      { name: "საბურთალო", schools: [{ id: "1002", name: "პირველი ექსპერიმენტული" }] }
    ]
  }
];

const defaultSurveySchema = [
  { type: 'section', id: '1.0', title: 'სასწავლო გეგმის შემუშავების პროცესი' },
  { type: 'question', id: '1.1', 
    admin: 'შემუშავებული გვაქვს მექანიზმი, რომელიც აღწერს მშობლების, მოსწავლეებისა და პერსონალის ჩართულობის გზებს.', 
    teacher: 'სკოლა იყენებს სხვადასხვა გზებს ჩემი და ჩემი კოლეგების აზრის მისაღებად.', 
    student: 'მასწავლებელი გვეკითხება აზრს იმაზე, თუ რისი სწავლა გვსურს და როგორ.', 
    parent: 'სკოლა სასწავლო პროცესის დაგეგმვისას აგროვებს მშობლების მოსაზრებებს.' },
  { type: 'question', id: '1.2', 
    admin: 'სკოლა აწვდის ინფორმაციას საზოგადოებას, თუ როგორ იქნა გათვალისწინებული მათი მოსაზრებები.', 
    teacher: 'ვიცი, რომ ჩემი გამოთქმული მოსაზრებები აღირიცხება და განიხილება ხელმძღვანელობის მიერ.', 
    student: 'მოსწავლეების მოსაზრებებსა და სურვილებს ითვალისწინებენ გაკვეთილების დაგეგმვისას.', 
    parent: 'სკოლა მაწვდის ინფორმაციას იმის შესახებ, თუ როგორ გაითვალისწინეს ჩემი აზრი.' },
  { type: 'question', id: '1.3', 
    admin: '', 
    teacher: '', 
    student: 'მოსწავლეთა თვითმმართველობისა თუ სასკოლო კლუბების მეშვეობით ვერთვები სკოლის მართვაში.', 
    parent: '' },
  { type: 'section', id: '2.0', title: 'სასწავლო პროცესი და მეთოდიკა' },
  { type: 'question', id: '2.1', 
    admin: 'სკოლას აქვს რესურსების ბაზა, რომელიც ხელმისაწვდომია ყველა მასწავლებლისთვის.', 
    teacher: 'ვიყენებ მრავალფეროვან რესურსებს მოსწავლეთა ინტერესების გასაღვივებლად.', 
    student: 'გაკვეთილები საინტერესოა და ვიყენებთ სხვადასხვა სასწავლო მასალას.', 
    parent: 'ჩემი შვილი ხალისით დადის სკოლაში და მოსწონს სასწავლო პროცესი.' },
  { type: 'question', id: '2.2', 
    admin: '', 
    teacher: '', 
    student: 'ამ საგანში მასწავლებელი ხშირად იყენებს პრაქტიკულ და ცხოვრებისეულ მაგალითებს.', 
    parent: 'ამ საგანში ჩემს შვილს აქვს სათანადო მხარდაჭერა და პროგრესი.' },
];

function parseCSV(str) {
  const arr = [];
  let quote = false;
  let row = [], col = "";
  for (let c = 0; c < str.length; c++) {
      let cc = str[c], nc = str[c+1];
      if (cc === '"' && quote && nc === '"') { col += cc; ++c; continue; }
      if (cc === '"') { quote = !quote; continue; }
      if (cc === ',' && !quote) { row.push(col); col = ""; continue; }
      if (cc === '\n' && !quote) { row.push(col); arr.push(row); col = ""; row = []; continue; }
      if (cc === '\r' && !quote) continue;
      col += cc;
  }
  if (col) row.push(col);
  if (row.length) arr.push(row);
  return arr;
}

export default function App() {
  const [userRole, setUserRole] = useState(ROLES.RESPONDENT);
  const [currentView, setCurrentView] = useState('landing'); 
  const [selection, setSelection] = useState({ region: '', district: '', schoolId: '' });
  const [activeSurveyRole, setActiveSurveyRole] = useState(null);
  const [gradeRange, setGradeRange] = useState(null);

  const [geoData, setGeoData] = useState([]);
  const [appConfig, setAppConfig] = useState({ 
    welcomeText: "კეთილი იყოს თქვენი მობრძანება სკოლების შეფასების პლატფორმაზე.", 
    subjectsByGrade: {
      "I-IV კლასი": ["ბუნება", "ქართული", "მათემატიკა", "ხელოვნება"],
      "V-IX კლასი": ["ისტორია", "ბიოლოგია", "გეოგრაფია", "ფიზიკა", "ქიმია"],
      "X-XII კლასი": ["სამოქალაქო განათლება", "ეკონომიკა", "გლობალური პოლიტიკა"]
    },
    subjectSpecificIds: ["2.2", "2.4"]
  });
  const [surveyData, setSurveyData] = useState([]);
  const [responses, setResponses] = useState([]);
  const [sessions, setSessions] = useState([]);

  useEffect(() => {
    const loadData = () => {
      const savedGeo = localStorage.getItem('ssp_geo');
      const savedConfig = localStorage.getItem('ssp_config');
      const savedSurvey = localStorage.getItem('ssp_survey');
      const savedResp = localStorage.getItem('ssp_responses');
      const savedSessions = localStorage.getItem('ssp_sessions');

      setGeoData(savedGeo ? JSON.parse(savedGeo) : defaultGeoData);
      if (savedConfig) setAppConfig(JSON.parse(savedConfig));
      setSurveyData(savedSurvey ? JSON.parse(savedSurvey) : defaultSurveySchema);
      if (savedResp) setResponses(JSON.parse(savedResp));
      
      if (savedSessions) {
        setSessions(JSON.parse(savedSessions));
      } else {
        const initialSession = [{ id: 's_default', name: 'ძირითადი კვლევა (ნაგულისხმევი)', isActive: true, createdAt: new Date().toISOString() }];
        setSessions(initialSession);
        localStorage.setItem('ssp_sessions', JSON.stringify(initialSession));
      }
    };
    loadData();
  }, []);

  const saveGeo = (data) => { setGeoData(data); localStorage.setItem('ssp_geo', JSON.stringify(data)); };
  const saveConfig = (data) => { setAppConfig(data); localStorage.setItem('ssp_config', JSON.stringify(data)); };
  const saveSurvey = (data) => { setSurveyData(data); localStorage.setItem('ssp_survey', JSON.stringify(data)); };
  
  const saveResponse = (data) => { 
    const activeSession = sessions.find(s => s.isActive) || sessions[0];
    const enrichedData = { ...data, sessionId: activeSession.id };
    const newResponses = [...responses, enrichedData];
    setResponses(newResponses); 
    localStorage.setItem('ssp_responses', JSON.stringify(newResponses)); 
  };

  const saveSessions = (data) => { setSessions(data); localStorage.setItem('ssp_sessions', JSON.stringify(data)); };
  
  const handleSessionDelete = (sessionId) => {
    const newSessions = sessions.filter(s => s.id !== sessionId);
    if (sessions.find(s => s.id === sessionId)?.isActive && newSessions.length > 0) {
        newSessions[0].isActive = true;
    }
    const newResponses = responses.filter(r => r.sessionId !== sessionId && r.sessionId !== undefined);
    saveSessions(newSessions);
    setResponses(newResponses);
    localStorage.setItem('ssp_responses', JSON.stringify(newResponses));
  };

  const handleSelectionReset = () => {
    setSelection({ region: '', district: '', schoolId: '' });
    setActiveSurveyRole(null);
    setGradeRange(null);
    setCurrentView('landing');
  };

  const activeSession = sessions.find(s => s.isActive) || sessions[0];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          
          {/* განახლებული ჰედერის ბრენდინგი */}
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
          <AdminPortal geoData={geoData} saveGeo={saveGeo} appConfig={appConfig} saveConfig={saveConfig} surveyData={surveyData} saveSurvey={saveSurvey} sessions={sessions} saveSessions={saveSessions} onDeleteSession={handleSessionDelete} />
        ) : userRole === ROLES.SCHOOL_VIEWER ? (
          <AnalyticsPanel responses={responses} geoData={geoData} surveyData={surveyData} appConfig={appConfig} sessions={sessions} onBack={() => { setUserRole(ROLES.RESPONDENT); handleSelectionReset(); }} />
        ) : (
          <>
            {currentView === 'landing' && (
              <div className="max-w-2xl mx-auto text-center space-y-12 py-12 animate-in fade-in slide-in-from-bottom-4">
                <div className="bg-white p-12 rounded-[3.5rem] shadow-xl border border-indigo-50/50 space-y-8 relative overflow-hidden">
                  
                  {/* ფონური დიზაინის ელემენტი */}
                  <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50/50 rounded-full blur-3xl -z-10 translate-x-1/2 -translate-y-1/2"></div>
                  
                  {/* EMIS ლოგო საწყის გვერდზე */}
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
            {currentView === 'geoSelect' && <GeoSelectionView geoData={geoData} selection={selection} setSelection={setSelection} onConfirm={() => setCurrentView('roleSelect')} />}
            {currentView === 'roleSelect' && <RoleVerificationView onVerified={(role) => { setActiveSurveyRole(role); setCurrentView(role === 'student' || role === 'parent' ? 'gradeSelect' : 'survey'); }} onBack={() => setCurrentView('geoSelect')} />}
            {currentView === 'gradeSelect' && <GradeSelectView onSelect={(g) => { setGradeRange(g); setCurrentView('survey'); }} />}
            {currentView === 'survey' && <SurveyForm role={activeSurveyRole} gradeRange={gradeRange} schoolId={selection.schoolId} surveyData={surveyData} appConfig={appConfig} onComplete={handleSelectionReset} saveResponse={saveResponse} />}
          </>
        )}
      </main>
    </div>
  );
}

// --- კითხვარის ფორმა ---
function SurveyForm({ role, gradeRange, schoolId, surveyData, appConfig, onComplete, saveResponse }) {
  const [answers, setAnswers] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const renderList = useMemo(() => {
    const list = [];
    let currentSection = null;
    let sectionHasQuestions = false;

    surveyData.forEach(q => {
      if(q.type === 'section') {
        currentSection = q;
        sectionHasQuestions = false;
      } else {
        const text = (q[role] || '').trim();
        const invalidTexts = ['არ არის', 'არარის', '-', '□', ''];
        if (!invalidTexts.includes(text.toLowerCase())) {
           if(currentSection && !sectionHasQuestions) {
             list.push({ ...currentSection, isSection: true });
             sectionHasQuestions = true;
           }
           list.push({ ...q, text, isSection: false });
        }
      }
    });
    return list;
  }, [surveyData, role]);

  const requiredCount = renderList.filter(q => !q.isSection).length;
  
  const answeredCount = renderList.filter(q => !q.isSection).reduce((count, q) => {
      const ans = answers[q.id];
      if (!ans) return count;
      const isSubjectSpecific = (appConfig.subjectSpecificIds || []).includes(q.id) && (role === 'student' || role === 'parent');
      
      if (isSubjectSpecific) {
          const availableSubjects = gradeRange ? (appConfig.subjectsByGrade?.[gradeRange] || []) : [];
          if (ans.isMatrix && ans.values && Object.keys(ans.values).length === availableSubjects.length) {
              return count + 1;
          }
      } else if (ans.value) {
          return count + 1;
      }
      return count;
  }, 0);

  const progress = requiredCount ? Math.round((answeredCount / requiredCount) * 100) : 0;

  const updateAnswer = (qId, field, val) => {
     setAnswers(prev => ({
        ...prev,
        [qId]: { ...(prev[qId] || {}), [field]: val }
     }));
  };

  const updateMatrixAnswer = (qId, subj, val) => {
      setAnswers(prev => {
          const currentAns = prev[qId] || { isMatrix: true, values: {} };
          return {
              ...prev,
              [qId]: {
                  ...currentAns,
                  isMatrix: true,
                  values: { ...currentAns.values, [subj]: val }
              }
          };
      });
  };

  const handleSubmit = () => {
    if (answeredCount < requiredCount) return;
    setIsSubmitting(true);
    setTimeout(() => {
      saveResponse({
        id: Date.now().toString(),
        schoolId, role, gradeRange, answers, timestamp: new Date().toISOString() 
      });
      onComplete();
    }, 600);
  };

  if (renderList.length === 0) {
     return <div className="text-center p-20 text-slate-500 font-bold bg-white rounded-3xl border shadow-sm italic">ამ როლისთვის კითხვები ვერ მოიძებნა.</div>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-32 animate-in fade-in slide-in-from-bottom-4">
      <div className="sticky top-20 z-40 bg-white/90 backdrop-blur-md p-6 rounded-3xl border border-slate-200 shadow-lg flex items-center justify-between gap-6">
        <div className="flex-1 space-y-2">
          <div className="flex justify-between text-xs font-black uppercase tracking-tighter text-slate-500">
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
          const itemKey = `${q.isSection ? 'sec' : 'q'}-${q.id}-${idx}`;

          if (q.isSection) {
            return (
              <div key={itemKey} className="pt-8 pb-2 border-b-2 border-blue-100">
                <h3 className="text-xl font-black text-blue-900 leading-tight">{q.id} {q.title}</h3>
              </div>
            );
          }

          const isSubjectSpecific = (appConfig.subjectSpecificIds || []).includes(q.id) && (role === 'student' || role === 'parent');
          const availableSubjects = gradeRange ? (appConfig.subjectsByGrade?.[gradeRange] || []) : [];
          const ans = answers[q.id] || {};

          return (
            <div key={itemKey} className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm space-y-6">
              <div className="flex gap-4">
                <span className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center font-black flex-shrink-0 text-sm">{q.id}</span>
                <p className="font-bold text-slate-800 text-lg pt-2 leading-relaxed">{q.text}</p>
              </div>
              
              {!isSubjectSpecific ? (
                <div className="flex flex-wrap gap-2 pt-2">
                  {scaleOptions.map(opt => (
                    <button 
                      key={opt} 
                      onClick={() => updateAnswer(q.id, 'value', opt)} 
                      className={`flex-1 min-w-[100px] py-4 rounded-xl text-xs font-black transition-all border-2 ${
                        ans.value === opt ? 'bg-blue-600 text-white border-blue-600 shadow-md transform scale-[1.02]' : 'bg-slate-50 text-slate-500 border-transparent hover:border-slate-200'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="mt-4 border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                   <div className="overflow-x-auto">
                     <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-black text-[10px] uppercase">
                           <tr>
                             <th className="p-4 bg-white sticky left-0 z-10 border-r border-slate-100 shadow-[1px_0_0_0_#f1f5f9]">საგანი</th>
                             {scaleOptions.map(opt => <th key={opt} className="p-4 text-center tracking-wider">{opt}</th>)}
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                           {availableSubjects.map(subj => (
                              <tr key={subj} className="hover:bg-blue-50/50 transition-colors">
                                 <td className="p-4 font-bold text-slate-700 bg-white sticky left-0 z-10 border-r border-slate-100 shadow-[1px_0_0_0_#f1f5f9]">{subj}</td>
                                 {scaleOptions.map(opt => (
                                    <td key={opt} className="p-4 text-center cursor-pointer" onClick={() => updateMatrixAnswer(q.id, subj, opt)}>
                                       <div className="flex justify-center items-center h-full w-full">
                                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${ans.values?.[subj] === opt ? 'border-blue-600 bg-blue-600' : 'border-slate-300 bg-white'}`}>
                                            {ans.values?.[subj] === opt && <div className="w-2 h-2 bg-white rounded-full"></div>}
                                          </div>
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

              <div className="mt-4 relative">
                <MessageSquare className="absolute top-4 left-4 w-5 h-5 text-slate-300" />
                <textarea 
                  placeholder="მიუთითეთ კომენტარი (სურვილისამებრ)..."
                  value={ans.comment || ''}
                  onChange={e => updateAnswer(q.id, 'comment', e.target.value)}
                  className="w-full pl-12 p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 outline-none focus:ring-2 ring-blue-500 transition-all min-h-[80px] resize-none"
                />
              </div>
            </div>
          );
        })}
      </div>

      <button 
        disabled={answeredCount < requiredCount || isSubmitting} 
        onClick={handleSubmit} 
        className="fixed bottom-10 left-1/2 -translate-x-1/2 w-full max-w-sm py-6 bg-blue-600 text-white rounded-[2rem] font-black shadow-2xl disabled:opacity-30 active:scale-95 transition-all"
      >
        {isSubmitting ? 'იგზავნება...' : 'კითხვარის დასრულება'}
      </button>
    </div>
  );
}

// --- კომენტარების მოდალი ---
function CommentsModal({ isOpen, onClose, questionId, comments, selectedSchoolId, roleNames }) {
  const [page, setPage] = useState(1);
  const itemsPerPage = 10;
  
  useEffect(() => {
    if (isOpen) setPage(1);
  }, [isOpen]);

  if (!isOpen) return null;

  const totalPages = Math.ceil(comments.length / itemsPerPage);
  const displayedComments = comments.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-[2.5rem] w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl animate-in zoom-in-95">
        <div className="p-6 border-b flex items-center justify-between bg-slate-50 rounded-t-[2.5rem]">
          <div>
            <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
              <MessageCircle className="text-indigo-500" />
              კომენტარები
            </h3>
            <p className="text-xs font-bold text-slate-500 mt-1">კითხვა #{questionId} | სულ: {comments.length}</p>
          </div>
          <button onClick={onClose} className="p-2 bg-slate-200 text-slate-600 rounded-full hover:bg-slate-300 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 bg-slate-50/50">
          {displayedComments.length > 0 ? (
            <div className="space-y-4">
              {displayedComments.map((c, i) => (
                <div key={i} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider">
                      {roleNames[c.role] || c.role}
                    </span>
                    {c.subject && (
                      <span className="bg-amber-50 text-amber-700 px-2 py-1 rounded text-[10px] font-bold">
                        {c.subject}
                      </span>
                    )}
                    {!selectedSchoolId && (
                      <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded">
                        სკოლა: {c.schoolId}
                      </span>
                    )}
                  </div>
                  <p className="text-slate-700 leading-relaxed font-medium">"{c.text}"</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-10 text-slate-400 font-bold">ამ გვერდზე მონაცემები არ არის.</div>
          )}
        </div>

        {totalPages > 1 && (
          <div className="p-4 border-t bg-white flex items-center justify-between rounded-b-[2.5rem]">
            <button 
              disabled={page === 1} 
              onClick={() => setPage(p => Math.max(1, p - 1))}
              className="px-6 py-3 rounded-xl font-bold bg-slate-100 text-slate-600 disabled:opacity-30 hover:bg-slate-200 transition-colors"
            >
              წინა
            </button>
            <span className="text-sm font-black text-slate-500">
              {page} / {totalPages}
            </span>
            <button 
              disabled={page === totalPages} 
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              className="px-6 py-3 rounded-xl font-bold bg-indigo-50 text-indigo-600 disabled:opacity-30 hover:bg-indigo-100 transition-colors"
            >
              შემდეგი
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// --- ანალიტიკური პანელი (სესიების მხარდაჭერით) ---
function AnalyticsPanel({ responses, geoData, surveyData, appConfig, sessions, onBack }) {
  const [selectedSchoolId, setSelectedSchoolId] = useState('');
  const [selectedSessionId, setSelectedSessionId] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [modalState, setModalState] = useState({ isOpen: false, questionId: null, comments: [] });

  useEffect(() => {
    if (sessions.length > 0 && !selectedSessionId) {
       setSelectedSessionId(sessions.find(s => s.isActive)?.id || sessions[0].id);
    }
  }, [sessions, selectedSessionId]);

  const schoolMap = useMemo(() => {
    const map = {};
    geoData.forEach(r => r.districts?.forEach(d => d.schools?.forEach(s => {
       map[s.id] = { name: s.name, region: r.name, district: d.name };
    })));
    return map;
  }, [geoData]);

  const allSchoolsList = useMemo(() => geoData.flatMap(r => r.districts?.flatMap(d => d.schools?.map(s => ({ ...s, district: d.name, region: r.name })) || []) || []), [geoData]);

  const sessionResponses = useMemo(() => {
      if (!selectedSessionId) return [];
      return responses.filter(r => r.sessionId === selectedSessionId || (!r.sessionId && selectedSessionId === sessions[0]?.id));
  }, [responses, selectedSessionId, sessions]);

  const filteredResponses = useMemo(() => selectedSchoolId ? sessionResponses.filter(r => r.schoolId === selectedSchoolId) : sessionResponses, [selectedSchoolId, sessionResponses]);

  const analytics = useMemo(() => {
    if (filteredResponses.length === 0) return null;
    const results = { total: filteredResponses.length, byRole: { admin: 0, teacher: 0, student: 0, parent: 0 }, scores: {} };
    
    filteredResponses.forEach(resp => {
      results.byRole[resp.role]++;
      Object.entries(resp.answers || {}).forEach(([qId, ansObj]) => {
        if (!results.scores[qId]) results.scores[qId] = { sum: 0, count: 0, subjects: {} };
        
        if (ansObj.isMatrix) {
            Object.entries(ansObj.values || {}).forEach(([subj, val]) => {
               const weight = RESPONSE_WEIGHTS[val];
               if (weight !== undefined && weight !== null) {
                 results.scores[qId].sum += weight;
                 results.scores[qId].count++;
                 if (!results.scores[qId].subjects[subj]) results.scores[qId].subjects[subj] = { sum: 0, count: 0 };
                 results.scores[qId].subjects[subj].sum += weight;
                 results.scores[qId].subjects[subj].count++;
               }
            });
        } else {
            const weight = RESPONSE_WEIGHTS[ansObj.value];
            if (weight !== undefined && weight !== null) {
              results.scores[qId].sum += weight;
              results.scores[qId].count++;
            }
        }
      });
    });
    return results;
  }, [filteredResponses]);

  const roleNames = { admin: "ადმინისტრაცია", teacher: "მასწავლებელი", student: "მოსწავლე", parent: "მშობელი" };

  const openComments = (qId) => {
    const comments = [];
    filteredResponses.forEach(r => {
       const ans = r.answers[qId];
       if (ans && ans.comment && ans.comment.trim() !== '') {
          comments.push({ role: r.role, text: ans.comment, schoolId: r.schoolId, subject: ans.subject });
       }
    });
    setModalState({ isOpen: true, questionId: qId, comments });
  };

  const exportToCSV = () => {
    setIsExporting(true);
    setTimeout(() => {
      const activeSessionName = sessions.find(s => s.id === selectedSessionId)?.name || 'Unknown';
      let csv = 'Session,Submission ID,Date,School ID,School Name,Region,Role,Grade,Question ID,Question Text,Subject,Answer,Score,Comment\n';
      filteredResponses.forEach(r => {
         const sInfo = schoolMap[r.schoolId] || { name: 'უცნობი', region: 'უცნობი' };
         Object.entries(r.answers).forEach(([qId, ans]) => {
            const qObj = surveyData.find(q => q.id === qId);
            const qText = (qObj?.[r.role] || '').replace(/"/g, '""');
            const comment = (ans.comment || '').replace(/"/g, '""');

            if (ans.isMatrix && ans.values) {
               Object.entries(ans.values).forEach(([subj, val]) => {
                  const score = RESPONSE_WEIGHTS[val];
                  csv += `"${activeSessionName}","${r.id}","${r.timestamp}","${r.schoolId}","${sInfo.name}","${sInfo.region}","${roleNames[r.role]}","${r.gradeRange}","${qId}","${qText}","${subj}","${val}","${score}","${comment}"\n`;
               });
            } else if (ans.value) {
               const score = RESPONSE_WEIGHTS[ans.value];
               csv += `"${activeSessionName}","${r.id}","${r.timestamp}","${r.schoolId}","${sInfo.name}","${sInfo.region}","${roleNames[r.role]}","${r.gradeRange}","${qId}","${qText}","","${ans.value}","${score}","${comment}"\n`;
            }
         });
      });
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `survey_${activeSessionName}_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setIsExporting(false);
    }, 100);
  };

  return (
    <div className="space-y-8 animate-in fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <button onClick={onBack} className="flex items-center gap-2 text-slate-500 font-bold hover:text-indigo-600 transition-colors w-fit"><ChevronLeft /> მთავარი</button>
        <div className="flex gap-2">
          {analytics && (
            <button 
              onClick={exportToCSV}
              disabled={isExporting}
              className="bg-emerald-50 text-emerald-700 px-4 py-2 rounded-xl text-sm font-bold shadow-sm border border-emerald-100 hover:bg-emerald-100 transition-colors flex items-center gap-2"
            >
              <Download size={16}/> {isExporting ? 'მზადდება...' : 'ექსპორტი (CSV)'}
            </button>
          )}
          <div className="bg-white px-4 py-2 rounded-xl text-sm font-bold shadow-sm border text-slate-600 flex items-center gap-2">
            <Database size={16} className="text-indigo-500"/>
            შევსებულია: <span className="text-indigo-600">{filteredResponses.length}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-2">
          <label className="text-xs font-black uppercase text-slate-400 flex items-center gap-1"><Calendar size={14}/> კვლევის სესია</label>
          <select 
            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:ring-2 ring-indigo-500 transition-all cursor-pointer" 
            value={selectedSessionId} 
            onChange={(e) => setSelectedSessionId(e.target.value)}
          >
            {sessions.map(s => <option key={s.id} value={s.id}>{s.name} {s.isActive ? '(აქტიური)' : ''}</option>)}
          </select>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-2">
          <label className="text-xs font-black uppercase text-slate-400 flex items-center gap-1"><Building size={14}/> სკოლის ფილტრი</label>
          <select 
            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:ring-2 ring-indigo-500 transition-all cursor-pointer" 
            value={selectedSchoolId} 
            onChange={(e) => setSelectedSchoolId(e.target.value)}
          >
            <option value="">ყველა სკოლა (გლობალური)</option>
            {allSchoolsList.map(s => <option key={s.id} value={s.id}>{s.name} ({s.id})</option>)}
          </select>
        </div>
      </div>

      {analytics ? (
        <div className="space-y-8 animate-in fade-in slide-in-from-top-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(analytics.byRole).map(([role, count]) => (
              <div key={role} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm text-center">
                <p className="text-[10px] font-black uppercase text-slate-400 mb-1 tracking-widest">{roleNames[role] || role}</p>
                <p className="text-3xl font-black text-indigo-600">{count}</p>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 bg-slate-50 border-b font-black flex items-center gap-2 text-slate-700">
              <TrendingUp className="text-indigo-500" /> კითხვების სტატისტიკა და უკუკავშირი
            </div>
            <div className="divide-y divide-slate-100">
              {surveyData.map((q, idx) => {
                const itemKey = `stat-${q.id}-${idx}`;
                if (q.type === 'section') {
                   return <div key={itemKey} className="p-6 bg-indigo-50/50"><h3 className="text-indigo-900 font-black tracking-tight">{q.id} {q.title}</h3></div>;
                }
                
                const stat = analytics.scores[q.id];
                if (!stat) return null;

                const isSubjectSpecific = (appConfig?.subjectSpecificIds || []).includes(q.id);

                let commentCount = 0;
                filteredResponses.forEach(r => {
                   if (r.answers[q.id]?.comment?.trim()) commentCount++;
                });

                const score = Math.round(stat.sum / stat.count);
                const desc = q.admin || q.teacher || q.student || q.parent || '';

                return (
                  <div key={itemKey} className="p-6 hover:bg-slate-50 transition-colors flex flex-col gap-4">
                    <div className="flex flex-col md:flex-row justify-between gap-6">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                           <span className="text-xs font-black text-slate-400">#{q.id}</span>
                           {isSubjectSpecific && (
                             <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-600 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border border-amber-200">
                               <Book size={10}/> საგნობრივი მატრიცა
                             </span>
                           )}
                        </div>
                        <span className="text-sm font-bold text-slate-700 line-clamp-3 leading-relaxed">{desc}</span>
                      </div>
                      
                      <div className="flex items-center gap-4 w-full md:w-1/3 shrink-0 self-center">
                        <div className="h-2 bg-slate-200 rounded-full flex-1 overflow-hidden">
                          <div 
                            className={`h-full transition-all duration-1000 ${score > 75 ? 'bg-emerald-500' : score > 50 ? 'bg-amber-500' : 'bg-red-500'}`} 
                            style={{ width: `${score}%` }}
                          ></div>
                        </div>
                        <span className="font-black text-slate-700 w-12 text-right">{score}%</span>
                      </div>
                    </div>

                    {isSubjectSpecific && stat.subjects && Object.keys(stat.subjects).length > 0 && (
                      <div className="mt-2 pt-4 border-t border-slate-100 grid grid-cols-2 md:grid-cols-4 gap-3">
                        {Object.entries(stat.subjects).map(([subj, subjStat]) => {
                           const subjScore = Math.round(subjStat.sum / subjStat.count);
                           return (
                             <div key={subj} className="bg-white p-3 rounded-xl border border-slate-200 flex justify-between items-center shadow-sm">
                               <span className="text-xs font-bold text-slate-600 truncate mr-2" title={subj}>{subj}</span>
                               <span className={`text-[10px] font-black px-2 py-1 rounded-md ${subjScore > 75 ? 'bg-emerald-100 text-emerald-700' : subjScore > 50 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                                 {subjScore}%
                               </span>
                             </div>
                           )
                        })}
                      </div>
                    )}

                    {commentCount > 0 && (
                      <div className="flex justify-start mt-2">
                        <button 
                          onClick={() => openComments(q.id)}
                          className="flex items-center gap-2 text-xs font-black text-indigo-600 bg-indigo-50 px-4 py-2 rounded-xl hover:bg-indigo-100 transition-colors"
                        >
                          <MessageCircle size={14} />
                          ნახე კომენტარები ({commentCount})
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <div className="p-20 text-center bg-white rounded-3xl border-2 border-dashed border-slate-200 text-slate-400 font-bold italic">ამ სესიაზე მონაცემები ჯერ არ მოიძებნა</div>
      )}

      <CommentsModal 
        isOpen={modalState.isOpen} 
        onClose={() => setModalState({ isOpen: false, questionId: null, comments: [] })} 
        questionId={modalState.questionId}
        comments={modalState.comments}
        selectedSchoolId={selectedSchoolId}
        roleNames={roleNames}
      />
    </div>
  );
}

// --- ადმინ პანელი (განახლებული სესიების მხარდაჭერით) ---
function AdminPortal({ geoData, saveGeo, appConfig, saveConfig, surveyData, saveSurvey, sessions, saveSessions, onDeleteSession }) {
  const [tab, setTab] = useState('sessions');
  const [activeGradeForSubjects, setActiveGradeForSubjects] = useState(GRADE_LEVELS[0]);
  const [newSubject, setNewSubject] = useState("");
  const [newSessionName, setNewSessionName] = useState("");
  const fileRef = useRef(null);

  const handleSurveyUpload = (e) => {
    const file = e.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const rows = parseCSV(event.target.result);
      const questions = [];
      rows.forEach(cols => {
        if(cols.length < 2) return;
        const id = cols[0]?.trim();
        if(!id || id === '#' || isNaN(parseFloat(id))) return;
        if(id.endsWith('.0')) {
          questions.push({ type: 'section', id, title: cols[1]?.trim() });
        } else {
          const parseText = (t) => {
             const val = (t || '').trim();
             if(['არ არის', 'არარის', '-', '□', ''].includes(val.toLowerCase())) return '';
             return val;
          };
          questions.push({
            type: 'question', id,
            admin: parseText(cols[1]),
            teacher: parseText(cols[3]),
            student: parseText(cols[5]),
            parent: parseText(cols[7])
          });
        }
      });
      saveSurvey(questions);
      alert("კითხვარი წარმატებით განახლდა!");
    };
    reader.readAsText(file);
  };

  const downloadTemplate = () => {
    const template = `#,ადმინისტრაცია,,მასწავლებელი,,მოსწავლე,,მშობელი\n1.0,სასწავლო გეგმის შემუშავების პროცესი,,,,,,\n1.1,ადმინისტრაციის კითხვა 1.1,,მასწავლებლის კითხვა 1.1,,მოსწავლის კითხვა 1.1,,მშობლის კითხვა 1.1\n1.2,ადმინისტრაციის კითხვა 1.2,,მასწავლებლის კითხვა 1.2,,მოსწავლის კითხვა 1.2,,მშობლის კითხვა 1.2\n2.0,სასწავლო პროცესი და მეთოდიკა,,,,,,\n2.1,ადმინისტრაციის კითხვა 2.1,,მასწავლებლის კითხვა 2.1,,მოსწავლის კითხვა 2.1,,მშობლის კითხვა 2.1`;
    const blob = new Blob(['\uFEFF' + template], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'survey_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const addSubject = () => {
    if(!newSubject) return;
    const currentSubjects = appConfig.subjectsByGrade?.[activeGradeForSubjects] || [];
    if(currentSubjects.includes(newSubject)) return;
    const updated = {
      ...appConfig.subjectsByGrade,
      [activeGradeForSubjects]: [...currentSubjects, newSubject]
    };
    saveConfig({ ...appConfig, subjectsByGrade: updated });
    setNewSubject("");
  };

  const removeSubject = (subj) => {
    const updated = {
      ...appConfig.subjectsByGrade,
      [activeGradeForSubjects]: (appConfig.subjectsByGrade[activeGradeForSubjects] || []).filter(s => s !== subj)
    };
    saveConfig({ ...appConfig, subjectsByGrade: updated });
  };

  const addSession = () => {
    if(!newSessionName.trim()) return;
    const newSession = {
       id: `s_${Date.now()}`,
       name: newSessionName.trim(),
       isActive: sessions.length === 0,
       createdAt: new Date().toISOString()
    };
    saveSessions([...sessions, newSession]);
    setNewSessionName("");
  };

  const setActiveSession = (id) => {
    const updated = sessions.map(s => ({ ...s, isActive: s.id === id }));
    saveSessions(updated);
  };

  const confirmDeleteSession = (id, name) => {
    if(sessions.length === 1) {
       alert("სისტემაში უნდა არსებობდეს მინიმუმ ერთი სესია. წაშლა შეუძლებელია.");
       return;
    }
    if(window.confirm(`ნამდვილად გსურთ სესიის "${name}" წაშლა?\nგაფრთხილება: ამ სესიაზე მიბმული ყველა მონაცემი სამუდამოდ წაიშლება!`)) {
       onDeleteSession(id);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="flex gap-2 bg-white p-1.5 rounded-2xl border border-slate-200 w-fit shadow-sm overflow-x-auto">
        <button onClick={() => setTab('sessions')} className={`px-6 py-2.5 rounded-xl text-xs font-black transition-all whitespace-nowrap ${tab === 'sessions' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-50'}`}>სესიები (კამპანიები)</button>
        <button onClick={() => setTab('survey')} className={`px-6 py-2.5 rounded-xl text-xs font-black transition-all whitespace-nowrap ${tab === 'survey' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-50'}`}>კითხვარი</button>
        <button onClick={() => setTab('subjects')} className={`px-6 py-2.5 rounded-xl text-xs font-black transition-all whitespace-nowrap ${tab === 'subjects' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-50'}`}>საგნები</button>
        <button onClick={() => setTab('config')} className={`px-6 py-2.5 rounded-xl text-xs font-black transition-all whitespace-nowrap ${tab === 'config' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-50'}`}>პარამეტრები</button>
      </div>

      {tab === 'sessions' && (
        <div className="space-y-6 animate-in slide-in-from-left-4">
          <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
            <div>
              <h3 className="font-black text-xl text-slate-800">კვლევის სესიები</h3>
              <p className="text-xs text-slate-500 mt-1 font-medium">მართეთ სხვადასხვა პერიოდის გამოკითხვები. მომხმარებლები შეავსებენ იმ კვლევას, რომელიც "აქტიურია".</p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-2">
              <input 
                className="flex-1 p-4 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:ring-2 ring-indigo-500"
                placeholder="ახალი სესიის დასახელება (მაგ: საგაზაფხულო კვლევა 2024)..."
                value={newSessionName}
                onChange={e => setNewSessionName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addSession()}
              />
              <button onClick={addSession} className="bg-indigo-600 text-white px-8 py-4 rounded-xl font-black hover:bg-indigo-700 transition-colors whitespace-nowrap"><Plus className="inline mr-1" size={18}/> დამატება</button>
            </div>

            <div className="space-y-3 mt-4">
              {sessions.map(s => (
                <div key={s.id} className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all ${s.isActive ? 'border-indigo-500 bg-indigo-50/30 shadow-md' : 'border-slate-200 bg-white hover:border-indigo-300'}`}>
                   <div>
                     <h4 className="font-black text-slate-800">{s.name}</h4>
                     <p className="text-[10px] font-bold text-slate-400 mt-1">შეიქმნა: {new Date(s.createdAt).toLocaleDateString('ka-GE')}</p>
                   </div>
                   <div className="flex items-center gap-2">
                     {s.isActive ? (
                        <span className="flex items-center gap-1 bg-indigo-100 text-indigo-700 px-3 py-2 rounded-lg text-xs font-black">
                          <Check size={14}/> აქტიურია
                        </span>
                     ) : (
                        <button onClick={() => setActiveSession(s.id)} className="text-xs font-bold text-slate-500 hover:text-indigo-600 px-3 py-2 bg-slate-100 hover:bg-indigo-50 rounded-lg transition-colors">
                          გახადე აქტიური
                        </button>
                     )}
                     <button onClick={() => confirmDeleteSession(s.id, s.name)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors ml-2" title="წაშლა">
                        <Trash2 size={18}/>
                     </button>
                   </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'survey' && (
        <div className="space-y-6 animate-in slide-in-from-right-4">
          <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="p-4 bg-indigo-50 text-indigo-600 rounded-2xl"><FileSpreadsheet size={28}/></div>
              <div>
                <h3 className="font-black text-xl text-slate-800">CSV იმპორტი</h3>
                <p className="text-xs text-slate-500 mt-1 font-medium">ატვირთეთ Excel-დან შენახული CSV ფაილი.</p>
                <button onClick={downloadTemplate} className="text-xs text-indigo-600 font-bold hover:underline mt-2 flex items-center gap-1">
                  <Download size={14}/> შაბლონის გადმოწერა
                </button>
              </div>
            </div>
            <button onClick={() => fileRef.current?.click()} className="bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black flex items-center justify-center gap-2 shadow-lg hover:bg-indigo-700 transition-colors w-full md:w-auto"><Upload size={18}/> ატვირთვა</button>
            <input type="file" className="hidden" ref={fileRef} accept=".csv" onChange={handleSurveyUpload} />
          </div>

          <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="font-black text-slate-800">საგნობრივი კითხვების ID-ები</h3>
            <p className="text-xs text-slate-500 font-medium italic">მძიმით გამოყოფილი (მაგ: 2.2, 2.4). საგნის არჩევა გამოჩნდება მხოლოდ მოსწავლესთან და მშობელთან.</p>
            <input 
              className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-700 focus:ring-2 ring-indigo-500 outline-none"
              value={(appConfig.subjectSpecificIds || []).join(', ')}
              onChange={e => saveConfig({...appConfig, subjectSpecificIds: e.target.value.split(',').map(s=>s.trim()).filter(s=>s)})}
            />
          </div>
        </div>
      )}

      {tab === 'subjects' && (
        <div className="space-y-6 animate-in slide-in-from-right-4">
          <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
            <div className="flex gap-2 p-1 bg-slate-100 rounded-xl">
              {GRADE_LEVELS.map(g => (
                <button key={g} onClick={() => setActiveGradeForSubjects(g)} className={`flex-1 py-3 rounded-lg text-xs font-black transition-all ${activeGradeForSubjects === g ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>{g}</button>
              ))}
            </div>

            <div className="flex gap-2">
              <input 
                className="flex-1 p-4 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:ring-2 ring-indigo-500"
                placeholder="ახალი საგნის დასახელება..."
                value={newSubject}
                onChange={e => setNewSubject(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addSubject()}
              />
              <button onClick={addSubject} className="bg-indigo-600 text-white px-6 rounded-xl font-black hover:bg-indigo-700 transition-colors"><Plus/></button>
            </div>

            <div className="flex flex-wrap gap-2">
              {(appConfig.subjectsByGrade?.[activeGradeForSubjects] || []).map(s => (
                <div key={s} className="bg-indigo-50 text-indigo-700 px-4 py-2 rounded-xl font-bold flex items-center gap-2 group animate-in zoom-in-95">
                  {s}
                  <button onClick={() => removeSubject(s)} className="text-indigo-300 hover:text-red-500"><X size={14}/></button>
                </div>
              ))}
              {(appConfig.subjectsByGrade?.[activeGradeForSubjects] || []).length === 0 && <p className="text-slate-400 italic text-sm">საგნები ჯერ არ არის დამატებული {activeGradeForSubjects}-სთვის.</p>}
            </div>
          </div>
        </div>
      )}

      {tab === 'config' && (
        <div className="bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-sm">
          <label className="text-xs font-black uppercase text-slate-400 ml-1">მისასალმებელი ტექსტი</label>
          <textarea 
            className="w-full p-6 bg-slate-50 border border-slate-200 rounded-[2rem] font-bold text-slate-800 min-h-[150px] outline-none focus:ring-2 ring-indigo-500 transition-all text-xl"
            value={appConfig.welcomeText || ''}
            onChange={(e) => saveConfig({...appConfig, welcomeText: e.target.value})}
          />
        </div>
      )}
    </div>
  );
}

// --- დამხმარე კომპონენტები (კითხვარის დაწყება) ---
function GeoSelectionView({ geoData, selection, setSelection, onConfirm }) {
  const reg = geoData.find(g => g.name === selection.region);
  const dist = reg?.districts?.find(d => d.name === selection.district);
  return (
    <div className="max-w-md mx-auto bg-white p-10 rounded-[3rem] shadow-2xl border border-indigo-50 space-y-6">
      <div className="text-center space-y-2 mb-4">
        <h2 className="text-3xl font-black text-slate-900">სკოლის შერჩევა</h2>
        <p className="text-slate-400 text-sm font-medium">მიუთითეთ ლოკაცია</p>
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
      <button disabled={!selection.schoolId} onClick={onConfirm} className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black disabled:opacity-30 shadow-xl active:scale-95 transition-all">გაგრძელება</button>
    </div>
  );
}

function RoleVerificationView({ onVerified, onBack }) {
  const [role, setRole] = useState(null);
  const [code, setCode] = useState("");
  const codes = { admin: "1111", teacher: "2222", student: "3333", parent: "4444" };
  
  if (role) return (
    <div className="max-w-md mx-auto bg-white p-12 rounded-[3.5rem] shadow-2xl text-center space-y-8 animate-in zoom-in-95">
      <h3 className="text-2xl font-black uppercase text-indigo-600 tracking-widest">{role === 'admin' ? 'ადმინისტრაცია' : role === 'teacher' ? 'მასწავლებელი' : role === 'student' ? 'მოსწავლე' : 'მშობელი'}</h3>
      <div className="relative">
        <input 
          type="password" maxLength={4} autoFocus 
          className="w-full text-center text-5xl p-6 bg-slate-50 border-b-4 border-indigo-600 rounded-2xl font-black tracking-[1.5rem] outline-none pl-[1.5rem]" 
          value={code} 
          onChange={e => { setCode(e.target.value); if(e.target.value === codes[role]) onVerified(role); }} 
        />
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-white px-2 text-indigo-100"><Lock size={20}/></div>
      </div>
      <button onClick={() => { setRole(null); setCode(""); }} className="text-slate-400 font-bold hover:text-red-500">უკან დაბრუნება</button>
    </div>
  );

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-2xl mx-auto">
      {[
        { id: 'admin', l: 'ადმინისტრაცია', icon: <ShieldCheck size={28}/> },
        { id: 'teacher', l: 'მასწავლებელი', icon: <BookOpen size={28}/> },
        { id: 'student', l: 'მოსწავლე', icon: <GraduationCap size={28}/> },
        { id: 'parent', l: 'მშობელი', icon: <Users size={28}/> }
      ].map(r => (
        <button key={r.id} onClick={() => setRole(r.id)} className="p-10 bg-white border border-slate-100 rounded-[2.5rem] font-black text-xl hover:border-indigo-500 hover:shadow-2xl transition-all flex flex-col items-center gap-4 group">
          <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 group-hover:text-indigo-600 transition-colors">{r.icon}</div>
          <span className="text-slate-700">{r.l}</span>
        </button>
      ))}
    </div>
  );
}

function GradeSelectView({ onSelect }) {
  return (
    <div className="max-w-md mx-auto space-y-6 text-center">
      <h3 className="text-2xl font-black text-slate-800 mb-6 italic">მიუთითეთ საფეხური</h3>
      {GRADE_LEVELS.map(g => (
        <button 
          key={g} 
          onClick={() => onSelect(g)} 
          className="w-full p-8 bg-white rounded-[2rem] border-2 border-slate-50 font-black text-xl hover:border-indigo-500 hover:bg-indigo-50 transition-all shadow-sm active:scale-95"
        >
          {g}
        </button>
      ))}
    </div>
  );
}