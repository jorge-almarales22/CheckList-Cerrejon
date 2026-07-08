import React, { useState, useEffect, useRef } from 'react';
import CheckListAll from './CheckListAll';
import CrearCheckList from './CrearCheckList';
import CheckListDetalle from './CheckListDetalle';

const Dashboard = ({ user, role, onLogout }) => {
    const [view, setView] = useState('checklist_all');
    const [selectedChecklistId, setSelectedChecklistId] = useState(null);
    const [theme, setTheme] = useState('light');
    const [refreshKey, setRefreshKey] = useState(0);
    const [atBottom, setAtBottom] = useState(false);
    const mainRef = useRef(null);

    const handleNavigate = (newView, id = null) => {
        setView(newView);
        setSelectedChecklistId(id);
    };

    useEffect(() => {
        document.body.style.backgroundImage = 'none';
        document.body.style.backgroundColor = theme === 'dark' ? '#090d16' : '#f8fafc';
    }, [theme]);

    const handleScrollJump = () => {
        const el = mainRef.current;
        if (!el) return;
        if (atBottom) {
            el.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
            el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
        }
    };

    const handleScroll = () => {
        const el = mainRef.current;
        if (!el) return;
        const threshold = 80;
        const isBottom = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
        setAtBottom(isBottom);
    };

    const activeWrapperClass = theme === 'dark' ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900';

    return (
        <div className={`h-screen flex flex-col overflow-hidden transition-all duration-300 ${activeWrapperClass}`}>
            <main
                ref={mainRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto p-4 md:p-8"
            >
                {view === 'home' && (
                    <div className="max-w-[95%] mx-auto flex flex-col items-center justify-center mt-8 md:mt-16 animate-[fadeIn_0.5s_ease-out]">
                        <div className={`${theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'} border p-10 rounded-3xl shadow text-center max-w-2xl w-full`}>
                            <h1 className="text-4xl font-extrabold mb-4 tracking-tight">&iexcl;Bienvenido al portal!</h1>
                            <button onClick={() => handleNavigate('checklist_all')} className="bg-yellow-500 hover:bg-yellow-400 text-black font-extrabold py-3.5 px-8 rounded-xl transition-all shadow shadow-yellow-500/20">
                                Ir al Panel de Checklists &rarr;
                            </button>
                        </div>
                    </div>
                )}
                {view === 'checklist_all' && <CheckListAll key={refreshKey} onView={handleNavigate} role={role} currentUser={user} theme={theme} />}
                {view === 'crear_checklist' && <CrearCheckList key={refreshKey} currentUser={user} currentRole={role} templateType={selectedChecklistId} onAtras={() => handleNavigate('checklist_all')} theme={theme} />}
                {view === 'checklist_detalle' && <CheckListDetalle key={refreshKey} checklistId={selectedChecklistId} role={role} currentUser={user} onAtras={() => handleNavigate('checklist_all')} theme={theme} />}
            </main>

            {/* Botón dinámico de scroll arriba/abajo */}
            <button
                onClick={handleScrollJump}
                title={atBottom ? 'Ir arriba' : 'Ir al final'}
                className={`fixed bottom-24 right-6 z-[999] p-4 rounded-full shadow-lg transition-all duration-300 hover:scale-110 active:scale-95 flex items-center justify-center border ${
                    theme === 'dark'
                        ? 'bg-slate-800 hover:bg-slate-700 text-yellow-400 border-slate-600'
                        : 'bg-white hover:bg-slate-100 text-amber-600 border-slate-300 shadow-slate-200'
                }`}
            >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    {atBottom ? (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 15l7-7 7 7" />
                    ) : (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
                    )}
                </svg>
            </button>

            {/* Botón de cambio de modo (claro/oscuro) */}
            <button
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                title={theme === 'dark' ? 'Cambiar a Modo Claro' : 'Cambiar a Modo Oscuro'}
                className="fixed bottom-6 right-6 z-[999] bg-yellow-500 hover:bg-yellow-400 text-black p-4 rounded-full shadow-[0_4px_20px_rgba(234,179,8,0.4)] transition-all duration-300 hover:scale-110 active:scale-95 flex items-center justify-center border border-yellow-600/30"
            >
                {theme === 'dark' ? (
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                ) : (
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                    </svg>
                )}
            </button>
        </div>
    );
};

export default Dashboard;
