import React, { useState, useEffect } from 'react';
import CheckListAll from './CheckListAll';
import CrearCheckList from './CrearCheckList';
import CheckListDetalle from './CheckListDetalle';

const Dashboard = ({ user, role, onLogout }) => {
    const [view, setView] = useState('checklist_all');
    const [selectedChecklistId, setSelectedChecklistId] = useState(null);
    const [theme, setTheme] = useState('dark');
    const [refreshKey, setRefreshKey] = useState(0);

    const handleNavigate = (newView, id = null) => {
        setView(newView);
        setSelectedChecklistId(id);
    };

    useEffect(() => {
        document.body.style.backgroundImage = 'none';
        document.body.style.backgroundColor = theme === 'dark' ? '#090d16' : '#f8fafc';
    }, [theme]);

    const navClass = theme === 'dark'
        ? 'bg-slate-900 border-b border-slate-800 text-slate-100 shadow-[0_5px_30px_rgba(0,0,0,0.5)]'
        : 'bg-white border-b border-slate-200 text-slate-900 shadow-sm shadow-slate-100';

    const activeWrapperClass = theme === 'dark' ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900';

    return (
        <div className={`h-screen flex flex-col overflow-hidden transition-all duration-300 ${activeWrapperClass}`}>
            <nav className={`${navClass} px-6 py-4 sticky top-0 z-50`}>
                <div className="max-w-[95%] w-full mx-auto flex justify-between items-center">
                    <div className="flex items-center gap-3 cursor-pointer group" onClick={() => handleNavigate('home')}>
                        <img
                            src="./img/Logo.png"
                            alt="Logo"
                            className="w-10 h-10 object-contain rounded-full shadow-lg transition-transform duration-300 group-hover:scale-105"
                            onError={(e) => { e.target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23eab308'%3E%3Cpath d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z'/%3E%3C/svg%3E"; }}
                        />
                        <span className="text-xl font-bold tracking-wide transition-colors">Incorporaci&oacute;n de Activos</span>
                    </div>
                    <div className="flex items-center gap-6">
                        <button className="text-sm font-semibold hover:text-yellow-500 transition-colors hidden md:block" onClick={() => handleNavigate('checklist_all')}>Listar Checklists</button>

                        <button
                            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                            className="text-xs font-extrabold px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent hover:bg-slate-500/10 transition-all flex items-center gap-2 shadow-sm"
                        >
                            {theme === 'dark' ? 'Modo Claro' : 'Modo Oscuro'}
                        </button>

                        <div className="hidden md:flex flex-col text-right ml-4">
                            <span className="text-slate-500 text-[10px] font-semibold uppercase tracking-wider block leading-tight">Usuario Activo</span>
                            <span className="font-bold block text-sm">{user} <span className="text-yellow-600 dark:text-yellow-400 text-xs bg-yellow-400/10 px-2 py-0.5 rounded-full ml-1 border border-yellow-400/20">{role}</span></span>
                        </div>
                        <div className="h-8 w-px bg-slate-300 dark:bg-slate-800 hidden md:block"></div>
                        <button className="text-slate-500 hover:text-red-500 font-semibold text-sm py-2 px-3 rounded-lg hover:bg-red-400/10" onClick={onLogout}>Cerrar Sesi&oacute;n</button>
                    </div>
                </div>
            </nav>

            <main className="flex-1 overflow-y-auto p-4 md:p-8">
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
            <button
                onClick={() => setRefreshKey(prev => prev + 1)}
                title="Actualizar Datos"
                className="fixed bottom-6 right-6 z-[999] bg-yellow-500 hover:bg-yellow-400 text-black p-4 rounded-full shadow-[0_4px_20px_rgba(234,179,8,0.4)] transition-all duration-300 hover:scale-110 active:scale-95 flex items-center justify-center border border-yellow-600/30"
            >
                <svg className="w-6 h-6 animate-[spin_6s_linear_infinite] hover:animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 19h-2.18" />
                </svg>
            </button>
        </div>
    );
};

export default Dashboard;
