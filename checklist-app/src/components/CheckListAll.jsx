import React, { useState, useEffect } from 'react';
import { calcularPromedioChecklist, calcularPromedioReal } from '../utils/calculations';

const CheckListAll = ({ onView, role, currentUser, theme }) => {
    const [checklists, setChecklists] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showTemplateModal, setShowTemplateModal] = useState(false);

    const [filtroNombre, setFiltroNombre] = useState('');
    const [filtroAlerta, setFiltroAlerta] = useState(false);
    const [filtroTipo, setFiltroTipo] = useState('');
    const [filtroEstado, setFiltroEstado] = useState('');

    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 50;

    const cardClass = theme === 'dark' 
        ? 'bg-slate-900 border-slate-800 text-slate-100 shadow-[0_0_20px_rgba(0,0,0,0.5)]' 
        : 'bg-white border-slate-200 text-slate-900 shadow-md shadow-slate-100';

    const inputClasses = theme === 'dark'
        ? "bg-slate-950/80 text-white border border-slate-800 focus:border-yellow-400 rounded-lg px-4 py-2 outline-none text-sm"
        : "bg-slate-100 text-slate-900 border border-slate-300 focus:border-yellow-500 rounded-lg px-4 py-2 outline-none text-sm";

    const fetchChecklists = async (isBackground = false) => {
        if (!isBackground) setLoading(true);
        try {
            const SITE_URL = "https://glencore.sharepoint.com/sites/co-lmn-sgia/checklist";
            const resChk = await fetch(`${SITE_URL}/_api/web/lists/getbytitle('DB_CHECKLIST_APP')/items?$top=5000`, {
                headers: { "Accept": "application/json;odata=verbose" }, credentials: "same-origin"
            });
            const dataChk = await resChk.json();
            const combined = [];
            for (const row of dataChk.d.results) {
                if (row.Data) {
                    try {
                        const parsedData = JSON.parse(row.Data);
                        combined.push({ ...parsedData, SharePointId: row.Id });
                    } catch (e) {
                        console.warn("No se pudo parsear el JSON de la fila", row.Id);
                    }
                }
            }
            const isResponsable = role === 'Responsable';
            const visibleChecklists = isResponsable
                ? combined.filter(chk => chk.items && chk.items.some(it => it.NombreResponsable === currentUser))
                : combined;
            setChecklists(visibleChecklists.reverse());
        } catch (error) {
            console.error("Error fetching data:", error);
        } finally {
            if (!isBackground) setLoading(false);
        }
    };

    useEffect(() => {
        fetchChecklists(false);
    }, [role, currentUser]);

    useEffect(() => {
        const interval = setInterval(() => {
            if (!document.hidden) {
                fetchChecklists(true);
            }
        }, 30000);
        return () => clearInterval(interval);
    }, [role, currentUser]);

    useEffect(() => { setCurrentPage(1); }, [filtroNombre, filtroAlerta, filtroTipo, filtroEstado]);

    if (loading) return <div className="text-center text-white mt-20 font-bold">Cargando datos desde SharePoint DB...</div>;

    let filtrados = checklists;
    if (filtroNombre.trim()) {
        filtrados = filtrados.filter(chk => chk.Name && chk.Name.toLowerCase().includes(filtroNombre.toLowerCase()));
    }
    if (filtroAlerta) {
        filtrados = filtrados.filter(chk => chk.items && chk.items.some(it => it.Alerta === "Si"));
    }
    if (filtroTipo) {
        filtrados = filtrados.filter(chk => chk.Tipo === filtroTipo);
    }
    if (filtroEstado === 'Finalizado') {
        filtrados = filtrados.filter(chk => chk.Estado === 'Finalizado');
    } else if (filtroEstado === 'En Progreso') {
        filtrados = filtrados.filter(chk => !chk.Estado || chk.Estado !== 'Finalizado');
    }

    const totalPages = Math.ceil(filtrados.length / itemsPerPage);
    const currentItems = filtrados.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    return (
        <div className="max-w-[95%] mx-auto animate-[fadeIn_0.4s_ease-out]">
            <div className={`${cardClass} border p-6 rounded-3xl flex flex-col justify-between items-start gap-4 mb-8`}>
                <div className="flex justify-between w-full items-center">
                    <div>
                        <h2 className="text-3xl font-black flex items-center gap-3">
                            <svg className={`w-8 h-8 ${theme==='dark'?'text-yellow-400':'text-amber-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
                            Listado de Checklists
                            <span className="bg-yellow-500 text-black text-sm font-bold px-3 py-1 rounded-full">{filtrados.length}</span>
                        </h2>
                    </div>
                    {(role === 'Administrador' || role === 'Desarrollador') && (
                        <button className="bg-blue-600 hover:bg-blue-500 border border-blue-400/30 text-white font-bold py-3 px-6 rounded-xl transition-all shadow shadow-slate-900/10" onClick={() => setShowTemplateModal(true)}>
                            Crear Nuevo CheckList
                        </button>
                    )}
                </div>

                <div className="flex flex-col md:flex-row gap-4 w-full mt-4 border-t border-slate-200 dark:border-slate-800 pt-4">
                    <input type="text" placeholder="Buscar por nombre..." className={`${inputClasses} flex-1`} value={filtroNombre} onChange={(e) => setFiltroNombre(e.target.value)} />
                    <select className={inputClasses} value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)}>
                        <option value="">Todos los Tipos</option>
                        <option value="PROYECTO">Incorporación por Proyectos</option>
                        <option value="COMPRA INSTALADA">Incorporación Compra Instalada</option>
                        <option value="ENSAMBLE">Incorporación por Ensamble</option>
                        <option value="GENERAL">General</option>
                    </select>
                    <select className={inputClasses} value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}>
                        <option value="">Todos los Estados</option>
                        <option value="En Progreso">En Progreso</option>
                        <option value="Finalizado">Finalizado</option>
                    </select>
                    <label className={`flex items-center gap-2 text-sm font-bold cursor-pointer border px-4 py-2 rounded-lg ${theme==='dark'?'bg-slate-950/85 border-slate-800':'bg-slate-100 border-slate-300'}`}>
                        <input type="checkbox" checked={filtroAlerta} onChange={(e) => setFiltroAlerta(e.target.checked)} className="accent-yellow-500" /> Solo con Alertas
                    </label>
                </div>
            </div>

            {filtrados.length === 0 ? (
                <div className={`text-center py-20 rounded-3xl border ${cardClass}`}>
                    <h3 className="text-2xl font-bold mb-2">No hay Checklists Disponibles</h3>
                </div>
            ) : (
                <div className={`rounded-3xl border overflow-hidden ${cardClass}`}>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className={`${theme==='dark'?'bg-slate-950/40 text-slate-400':'bg-slate-100 text-slate-600'} text-xs uppercase font-extrabold tracking-wider`}>
                                    <th className="p-4 border-b border-slate-200 dark:border-slate-800">Nombre del Checklist</th>
                                    <th className="p-4 border-b border-slate-200 dark:border-slate-800">Progreso (Plan vs Real)</th>
                                    <th className="p-4 border-b border-slate-200 dark:border-slate-800">Líder</th>
                                    <th className="p-4 border-b border-slate-200 dark:border-slate-800">Custodio</th>
                                    <th className="p-4 border-b border-slate-200 dark:border-slate-800">Operador</th>
                                    <th className="p-4 border-b border-slate-200 dark:border-slate-800">Mantenedor</th>
                                    <th className="p-4 border-b border-slate-200 dark:border-slate-800 text-center">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="text-sm">
                                {currentItems.map((chk) => {
                                    const promCalc = calcularPromedioChecklist(chk.items);
                                    const promReal = calcularPromedioReal(chk.items);
                                    const isDelayed = promReal < promCalc;
                                    const hasAlerts = chk.items?.some(it => it.Alerta === "Si");
                                    const extractName = (email) => email ? email.split('@')[0] : '-';

                                    return (
                                        <tr key={chk.ID_x002d_checklist} className="border-b border-slate-200 dark:border-slate-800/50 hover:bg-slate-500/5 transition-colors">
                                            <td className="p-4 font-bold max-w-[250px] truncate" title={chk.Name}>
                                                {chk.Estado === 'Finalizado' && <span className="bg-green-500/20 text-green-500 dark:text-green-400 px-2 py-0.5 rounded text-[10px] mr-2 font-extrabold">FINALIZADO</span>}
                                                {hasAlerts && <span className="bg-red-500/20 text-red-500 dark:text-red-400 px-2 py-0.5 rounded text-[10px] mr-2 animate-pulse">ALERTA</span>}
                                                {chk.Name || "Sin nombre"}
                                            </td>
                                            <td className="p-4">
                                                <div className="flex flex-col gap-1 text-xs">
                                                    <span>Plan: <span className="font-bold">{promCalc}%</span></span>
                                                    <span>Real: <span className={`font-bold ${isDelayed ? 'text-red-500 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>{promReal}%</span></span>
                                                </div>
                                            </td>
                                            <td className="p-4 text-xs text-slate-500 dark:text-slate-400 font-semibold">{extractName(chk.Metadata?.roles?.lider?.persona)}</td>
                                            <td className="p-4 text-xs text-slate-500 dark:text-slate-400 font-semibold">{extractName(chk.Metadata?.roles?.custodio?.persona)}</td>
                                            <td className="p-4 text-xs text-slate-500 dark:text-slate-400 font-semibold">{extractName(chk.Metadata?.roles?.operador?.persona)}</td>
                                            <td className="p-4 text-xs text-slate-500 dark:text-slate-400 font-semibold">{extractName(chk.Metadata?.roles?.mantenedor?.persona)}</td>
                                            <td className="p-4 text-center">
                                                {chk.Estado === 'Finalizado' ? (
                                                    <button onClick={() => onView('checklist_detalle', chk.ID_x002d_checklist)} className="bg-green-500/10 hover:bg-green-500/20 text-green-600 dark:text-green-300 border border-green-500/20 px-4 py-2 rounded-lg font-bold text-xs transition-colors shadow-sm">
                                                        Ver
                                                    </button>
                                                ) : (
                                                    <button onClick={() => onView('checklist_detalle', chk.ID_x002d_checklist)} className="bg-blue-600/10 hover:bg-blue-600/20 text-blue-600 dark:text-blue-300 border border-blue-500/20 px-4 py-2 rounded-lg font-bold text-xs transition-colors shadow-sm">
                                                        Ver / Gestionar
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {totalPages > 1 && (
                        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-black/5 dark:bg-black/25">
                            <span className="text-slate-500 text-sm">Mostrando pág {currentPage} de {totalPages}</span>
                            <div className="flex gap-2">
                                <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="px-4 py-2 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 disabled:opacity-30 rounded-lg font-bold transition-colors">Anterior</button>
                                <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)} className="px-4 py-2 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 disabled:opacity-30 rounded-lg font-bold transition-colors">Siguiente</button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {showTemplateModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-[fadeIn_0.2s_ease-out]">
                    <div className="bg-slate-800 border border-white/20 p-6 md:p-8 rounded-3xl shadow-2xl max-w-5xl w-full text-white">
                        <div className="flex justify-between items-center mb-6 border-b border-white/10 pb-4">
                            <h3 className="text-2xl font-bold text-yellow-400">Selecciona el Tipo de Checklist</h3>
                            <button onClick={() => setShowTemplateModal(false)} className="text-white/50 hover:text-white text-2xl font-bold transition-colors">&times;</button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
                            <div
                                className="bg-white/5 border border-white/10 p-6 rounded-2xl cursor-pointer hover:bg-white/10 hover:border-yellow-400 transition-all group flex flex-col shadow-lg"
                                onClick={() => { setShowTemplateModal(false); onView('crear_checklist', 'proyectos'); }}
                            >
                                <div className="mb-4 group-hover:scale-110 transition-transform transform origin-left">
                                    <svg className="w-10 h-10 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
                                </div>
                                <h4 className="text-base lg:text-lg font-bold text-white mb-3 leading-snug h-auto">Incorporación de activos a traves de proyectos</h4>
                                <p className="text-sm text-white/50 mt-auto pt-4 border-t border-white/5">Utiliza la plantilla con 49 items predefinidos.</p>
                            </div>
                            <div
                                className="bg-white/5 border border-white/10 p-6 rounded-2xl cursor-pointer hover:bg-white/10 hover:border-blue-400 transition-all group flex flex-col shadow-lg"
                                onClick={() => { setShowTemplateModal(false); onView('crear_checklist', 'compra_instalada'); }}
                            >
                                <div className="mb-4 group-hover:scale-110 transition-transform transform origin-left">
                                    <svg className="w-10 h-10 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                </div>
                                <h4 className="text-base lg:text-lg font-bold text-white mb-3 leading-snug h-auto">Incorporación de activos nuevos o usados por compra instalada</h4>
                                <p className="text-sm text-white/50 mt-auto pt-4 border-t border-white/5">Utiliza la plantilla con 61 items predefinidos.</p>
                            </div>
                            <div
                                className="bg-white/5 border border-white/10 p-6 rounded-2xl cursor-pointer hover:bg-white/10 hover:border-green-400 transition-all group flex flex-col shadow-lg"
                                onClick={() => { setShowTemplateModal(false); onView('crear_checklist', 'ensamble'); }}
                            >
                                <div className="mb-4 group-hover:scale-110 transition-transform transform origin-left">
                                    <svg className="w-10 h-10 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                                </div>
                                <h4 className="text-base lg:text-lg font-bold text-white mb-3 leading-snug h-auto">Incorporación de equipos mineros nuevos o usados por ensamble</h4>
                                <p className="text-sm text-white/50 mt-auto pt-4 border-t border-white/5">Utiliza la plantilla con 67 items predefinidos.</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CheckListAll;
