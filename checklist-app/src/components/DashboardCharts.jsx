import React from 'react';
import { calcularCumplimiento } from '../utils/calculations';

const DashboardCharts = ({ items, theme }) => {
    if (!items || items.length === 0) return null;
    const activos = items.filter(it => (it.Estado || it.estado) !== 'Inactivo');
    if (activos.length === 0) return null;

    const avanceGeneral = Math.round(activos.reduce((acc, it) => acc + (parseInt(it.Avance || it.avance) || 0), 0) / activos.length);

    let totalEsperado = 0;
    activos.forEach(it => {
        totalEsperado += calcularCumplimiento(it.FechaInicio || it.fechaInicio, it.FechaFin || it.fechaFin);
    });
    const avanceEsperado = Math.round(totalEsperado / activos.length);

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

    const radiusReal = 60;
    const circumReal = 2 * Math.PI * radiusReal;
    const offsetReal = circumReal - (avanceGeneral / 100) * circumReal;

    const radiusEsp = 42;
    const circumEsp = 2 * Math.PI * radiusEsp;
    const offsetEsp = circumEsp - (avanceEsperado / 100) * circumEsp;

    const cardBg = theme === 'dark'
        ? 'bg-black/80 border-white/20 shadow-[0_0_30px_rgba(0,0,0,0.3)]'
        : 'bg-white border-slate-200 shadow-md shadow-slate-100';

    const textColor = theme === 'dark' ? 'text-white' : 'text-slate-900';
    const labelColor = theme === 'dark' ? 'text-white/50' : 'text-slate-500';
    const trackStroke = theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)';
    const barBg = theme === 'dark' ? 'bg-white/5 border-white/5' : 'bg-slate-100 border-slate-200';

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8 animate-[fadeIn_0.5s_ease-out]">
            <div className={`${cardBg} backdrop-blur-2xl p-6 rounded-3xl border flex flex-col items-center justify-center`}>
                <h3 className={`text-xs font-bold uppercase tracking-wider mb-6 ${labelColor}`}>{"% Avances de Checklist"}</h3>
                
                <div className="relative w-40 h-40 flex flex-col items-center justify-center">
                    <svg className="w-full h-full transform -rotate-90">
                        <circle cx="80" cy="80" r={radiusReal} fill="transparent" stroke={trackStroke} strokeWidth="14" />
                        <circle cx="80" cy="80" r={radiusReal} fill="transparent" stroke="#eab308" strokeWidth="14" strokeDasharray={circumReal} strokeDashoffset={offsetReal} className="transition-all duration-1000 ease-out" strokeLinecap="round" />
                        
                        <circle cx="80" cy="80" r={radiusEsp} fill="transparent" stroke={trackStroke} strokeWidth="10" />
                        <circle cx="80" cy="80" r={radiusEsp} fill="transparent" stroke="#3b82f6" strokeWidth="10" strokeDasharray={circumEsp} strokeDashoffset={offsetEsp} className="transition-all duration-1000 ease-out" strokeLinecap="round" />
                    </svg>
                    <div className="absolute flex flex-col items-center justify-center text-center">
                        <span className={`text-2xl font-black ${textColor}`}>{avanceGeneral}%</span>
                        <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-0.5">Real</span>
                    </div>
                </div>

                <div className="flex gap-4 mt-6 text-[11px] font-bold">
                    <div className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-full bg-yellow-500 inline-block"></span>
                        <span className={textColor}>Real: {avanceGeneral}%</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-full bg-blue-500 inline-block"></span>
                        <span className={textColor}>Esperado: {avanceEsperado}%</span>
                    </div>
                </div>
            </div>

            <div className={`md:col-span-2 ${cardBg} backdrop-blur-2xl p-6 rounded-3xl border`}>
                <h3 className={`text-xs font-bold uppercase tracking-wider mb-6 ${labelColor}`}>{"Promedio por Responsable (Activos)"}</h3>
                <div className="space-y-4 max-h-[200px] overflow-y-auto pr-2">
                    {dataChart.map((d, i) => (
                        <div key={i} className="flex items-center gap-4 text-xs">
                            <div className={`w-[140px] truncate text-right font-medium ${theme === 'dark' ? 'text-white/80' : 'text-slate-700'}`} title={d.name}>{d.name}</div>
                            <div className={`flex-1 h-6 rounded-full overflow-hidden relative border ${barBg}`}>
                                <div className="h-full bg-gradient-to-r from-yellow-600 to-yellow-400 transition-all duration-1000" style={{ width: `${d.avg}%` }}></div>
                            </div>
                            <div className={`w-[40px] font-bold ${textColor}`}>{d.avg}%</div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default DashboardCharts;
