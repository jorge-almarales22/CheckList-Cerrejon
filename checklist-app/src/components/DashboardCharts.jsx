import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { calcularCumplimiento, calcularRealChecklist, calcularEsperadoChecklist } from '../utils/calculations';

const DashboardCharts = ({ items, checklist, theme, layout }) => {
    const [showAllResp, setShowAllResp] = useState(false);

    if (!items || items.length === 0) return null;
    const activos = items.filter(it => (it.Estado || it.estado) !== 'Inactivo');
    if (activos.length === 0) return null;

    // Avance real: historico usa el valor de la DB (o 100%), si no promedio de activos.
    const avanceGeneral = checklist
        ? calcularRealChecklist(checklist)
        : Math.round(activos.reduce((acc, it) => acc + (parseInt(it.Avance || it.avance) || 0), 0) / activos.length);

    // Avance esperado: misma logica que el resto de la app (ventana del checklist o,
    // para historicos, la ventana de diligenciamiento). Antes se promediaban las
    // tareas y los historicos quedaban en 0%.
    const avanceEsperado = checklist
        ? calcularEsperadoChecklist(checklist)
        : (() => {
            let total = 0;
            activos.forEach(it => { total += calcularCumplimiento(it.FechaInicio || it.fechaInicio, it.FechaFin || it.fechaFin); });
            return Math.round(total / activos.length);
        })();

    const respMap = {};
    activos.forEach(it => {
        const r = it.NombreResponsable || it.nombreResponsable || 'Sin asignar';
        if (!respMap[r]) respMap[r] = { total: 0, count: 0 };
        respMap[r].total += parseInt(it.Avance || it.avance) || 0;
        respMap[r].count += 1;
    });
    const dataChart = Object.keys(respMap).map(k => ({
        name: k,
        avg: Math.round(respMap[k].total / respMap[k].count)
    })).sort((a, b) => b.avg - a.avg);

    const isDark = theme === 'dark';
    const cardBg = isDark
        ? 'bg-black/80 border-white/30 shadow-[0_0_30px_rgba(0,0,0,0.3)]'
        : 'bg-white border-slate-300 shadow-md shadow-slate-100';
    const textColor = isDark ? 'text-white font-bold' : 'text-slate-900 font-bold';
    const labelColor = isDark ? 'text-white font-bold' : 'text-slate-900 font-bold';
    const trackStroke = isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.08)';
    const barBg = isDark ? 'bg-white/10 border-white/10' : 'bg-slate-100 border-slate-300';

    const esLateral = layout === 'side';

    // --- Donut Real (amarillo) + Esperado (azul) ---
    const rReal = esLateral ? 46 : 60;
    const circReal = 2 * Math.PI * rReal;
    const offReal = circReal - (avanceGeneral / 100) * circReal;
    const rEsp = esLateral ? 30 : 42;
    const circEsp = 2 * Math.PI * rEsp;
    const offEsp = circEsp - (avanceEsperado / 100) * circEsp;
    const svgBox = esLateral ? 120 : 160;
    const cxy = svgBox / 2;

    const Barra = ({ d }) => (
        <div className="flex items-center gap-3 text-xs">
            <div className={`w-[120px] truncate text-right font-bold ${textColor}`} title={d.name}>{d.name}</div>
            <div className={`flex-1 h-5 rounded-full overflow-hidden relative border ${barBg}`}>
                <div className="h-full bg-gradient-to-r from-yellow-600 to-yellow-400 transition-all duration-1000" style={{ width: `${d.avg}%` }}></div>
            </div>
            <div className={`w-[38px] font-bold ${textColor}`}>{d.avg}%</div>
        </div>
    );

    const Donut = () => (
        <div className="relative flex flex-col items-center justify-center" style={{ width: svgBox, height: svgBox }}>
            <svg className="w-full h-full transform -rotate-90">
                <circle cx={cxy} cy={cxy} r={rReal} fill="transparent" stroke={trackStroke} strokeWidth="12" />
                <circle cx={cxy} cy={cxy} r={rReal} fill="transparent" stroke="#eab308" strokeWidth="12" strokeDasharray={circReal} strokeDashoffset={offReal} className="transition-all duration-1000 ease-out" strokeLinecap="round" />
                <circle cx={cxy} cy={cxy} r={rEsp} fill="transparent" stroke={trackStroke} strokeWidth="9" />
                <circle cx={cxy} cy={cxy} r={rEsp} fill="transparent" stroke="#3b82f6" strokeWidth="9" strokeDasharray={circEsp} strokeDashoffset={offEsp} className="transition-all duration-1000 ease-out" strokeLinecap="round" />
            </svg>
            <div className="absolute flex flex-col items-center justify-center text-center">
                <span className={`${esLateral ? 'text-xl' : 'text-2xl'} font-black ${textColor}`}>{avanceGeneral}%</span>
                <span className={`text-[9px] font-black uppercase tracking-widest mt-0.5 ${textColor}`}>Real</span>
            </div>
        </div>
    );

    const Leyenda = () => (
        <div className="flex gap-4 mt-3 text-[11px] font-bold flex-wrap justify-center">
            <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-yellow-500 inline-block"></span>
                <span className={textColor}>Real: {avanceGeneral}%</span>
            </div>
            <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-blue-500 inline-block"></span>
                <span className={textColor}>Esperado: {avanceEsperado}%</span>
            </div>
        </div>
    );

    // ===== Layout lateral: torta arriba, barras abajo (con "Ver más" en modal) =====
    if (esLateral) {
        const TOPE = 5;
        const hayMas = dataChart.length > TOPE;

        return (
            <>
                <div className={`${cardBg} border p-4 rounded-2xl flex flex-col items-center justify-center`}>
                    <h3 className={`text-[11px] font-black uppercase tracking-wider mb-3 text-center ${labelColor}`}>% Avance del Checklist</h3>
                    <Donut />
                    <Leyenda />
                </div>

                {/* flex-1 para que la tarjeta llegue hasta abajo (al nivel de los metadatos). */}
                <div className={`${cardBg} border p-4 rounded-2xl flex flex-col flex-1 min-h-0`}>
                    <div className="flex items-center justify-between mb-3 gap-2 shrink-0">
                        <h3 className={`text-[11px] font-black uppercase tracking-wider ${labelColor}`}>Promedio por Responsable</h3>
                        {hayMas && (
                            <button onClick={() => setShowAllResp(true)} className="text-[10px] font-bold bg-yellow-500/15 hover:bg-yellow-500/25 text-yellow-700 dark:text-yellow-400 px-2 py-1 rounded border border-yellow-500/30 transition-colors whitespace-nowrap">
                                Ver más ({dataChart.length})
                            </button>
                        )}
                    </div>
                    {/* Área que crece y hace scroll interno si no caben todos los responsables. */}
                    <div className="space-y-2.5 flex-1 min-h-0 overflow-y-auto pr-1">
                        {dataChart.map((d, i) => <Barra key={i} d={d} />)}
                    </div>
                </div>

                {showAllResp && ReactDOM.createPortal(
                    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-[fadeIn_0.2s_ease-out]" onClick={() => setShowAllResp(false)}>
                        <div className={`${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-300'} border rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col`} onClick={(e) => e.stopPropagation()}>
                            <div className={`flex justify-between items-center p-4 border-b ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
                                <h3 className={`text-sm font-black uppercase tracking-wider ${labelColor}`}>Promedio por Responsable ({dataChart.length})</h3>
                                <button onClick={() => setShowAllResp(false)} className="flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white font-bold px-4 py-2 rounded-xl border border-red-400/40 shadow transition-colors">
                                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                                    Cerrar
                                </button>
                            </div>
                            <div className="p-5 space-y-3 overflow-y-auto">
                                {dataChart.map((d, i) => <Barra key={i} d={d} />)}
                            </div>
                        </div>
                    </div>,
                    document.body
                )}
            </>
        );
    }

    // ===== Layout original (grid de 3 columnas) =====
    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8 animate-[fadeIn_0.5s_ease-out]">
            <div className={`${cardBg} backdrop-blur-2xl p-6 rounded-3xl border flex flex-col items-center justify-center`}>
                <h3 className={`text-xs font-bold uppercase tracking-wider mb-6 ${labelColor}`}>{"% Avances de Checklist"}</h3>
                <Donut />
                <Leyenda />
            </div>
            <div className={`md:col-span-2 ${cardBg} backdrop-blur-2xl p-6 rounded-3xl border`}>
                <h3 className={`text-xs font-bold uppercase tracking-wider mb-6 ${labelColor}`}>{"Promedio por Responsable (Activos)"}</h3>
                <div className="space-y-4 max-h-[200px] overflow-y-auto pr-2">
                    {dataChart.map((d, i) => <Barra key={i} d={d} />)}
                </div>
            </div>
        </div>
    );
};

export default DashboardCharts;
