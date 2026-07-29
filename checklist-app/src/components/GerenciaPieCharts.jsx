import React, { useMemo } from 'react';
import { calcularResumenPorGerencia, calcularEsperadoGlobal, calcularRealGlobal } from '../utils/calculations';
import SPIBadge from './SPIBadge';

// Torta (donut) SVG que muestra el % esperado (gris) y el % real (amarillo).
// El pedazo gris representa el esperado promedio de todos los checklist de la gerencia.
// El pedazo amarillo representa el real promedio.
const GerenciaPieCharts = ({ checklists, theme }) => {
    const data = useMemo(() => calcularResumenPorGerencia(checklists), [checklists]);
    const esperadoGlobal = useMemo(() => calcularEsperadoGlobal(checklists), [checklists]);
    const realGlobal = useMemo(() => calcularRealGlobal(checklists), [checklists]);

    const isDark = theme === 'dark';
    // Sin datos (p.ej. los filtros no devolvieron nada) la banda se conserva con un
    // mensaje: asi se ve que las metricas responden al filtro en vez de desaparecer.
    const sinDatos = !data || data.length === 0;
    const cardBg = isDark
        ? 'bg-slate-900 border-slate-700 text-white'
        : 'bg-white border-slate-300 text-slate-900';

    // Colores fuertes y legibles (no tenues).
    const labelColor = isDark ? 'text-white font-bold' : 'text-slate-900 font-bold';
    const subLabelColor = isDark ? 'text-slate-200 font-semibold' : 'text-slate-900 font-semibold';
    const trackStroke = isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.08)';

    const radius = 52;
    const circum = 2 * Math.PI * radius;

    const Pie = ({ esperado, real, gerencia, count }) => {
        // El esperado (gris) se dibuja como el arco completo hasta su porcentaje.
        const offsetEsp = circum - (esperado / 100) * circum;
        // El real (amarillo) se dibuja encima, hasta su porcentaje.
        const offsetReal = circum - (real / 100) * circum;

        return (
            <div className={`${cardBg} border p-3 md:p-4 rounded-2xl flex flex-col items-center justify-center transition-all hover:scale-[1.02]`}>
                <h3 className={`text-[11px] font-extrabold uppercase tracking-wider mb-1 text-center ${subLabelColor} line-clamp-2 leading-tight`} title={gerencia}>
                    {gerencia}
                </h3>
                <span className={`text-[10px] font-bold mb-2 ${subLabelColor}`}>{count} proceso{count !== 1 ? 's' : ''}</span>

                <div className="relative w-[90px] h-[90px] flex flex-col items-center justify-center">
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 128 128">
                        {/* track */}
                        <circle cx="64" cy="64" r={radius} fill="transparent" stroke={trackStroke} strokeWidth="14" />
                        {/* esperado (gris) */}
                        <circle
                            cx="64" cy="64" r={radius} fill="transparent"
                            stroke={isDark ? '#94a3b8' : '#64748b'}
                            strokeWidth="14"
                            strokeDasharray={circum}
                            strokeDashoffset={offsetEsp}
                            className="transition-all duration-1000 ease-out"
                            strokeLinecap="round"
                        />
                        {/* real (amarillo) - dibujado encima */}
                        <circle
                            cx="64" cy="64" r={radius} fill="transparent"
                            stroke="#eab308"
                            strokeWidth="14"
                            strokeDasharray={circum}
                            strokeDashoffset={offsetReal}
                            className="transition-all duration-1000 ease-out"
                            strokeLinecap="round"
                        />
                    </svg>
                    <div className="absolute flex flex-col items-center justify-center text-center">
                        <span className={`text-base font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>{real}%</span>
                        <span className={`text-[8px] font-black uppercase tracking-widest mt-0.5 ${isDark ? 'text-slate-200' : 'text-slate-900'}`}>Real</span>
                    </div>
                </div>

                <div className="flex gap-2 mt-3 text-[10px] font-bold">
                    <div className="flex items-center gap-1">
                        <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: isDark ? '#94a3b8' : '#64748b' }}></span>
                        <span className={labelColor}>Esp: {esperado}%</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <span className="w-2.5 h-2.5 rounded-full bg-yellow-500 inline-block"></span>
                        <span className={labelColor}>Real: {real}%</span>
                    </div>
                </div>
            </div>
        );
    };

    // Contenedor a todo el ancho: amarillo Cerrejon en claro, azul oscuro elegante
    // en oscuro (el amarillo se ve mal en tema dark). Acento dorado arriba en dark.
    const fullBleed = {
        width: '100vw',
        marginLeft: 'calc(50% - 50vw)',
        background: isDark ? '#141d33' : '#ffc000',
        borderTop: isDark ? '4px solid #eab308' : 'none'
    };
    const headText = isDark ? 'text-white' : 'text-slate-900';
    const subText = isDark ? 'text-slate-300' : 'text-slate-800';

    return (
        <div style={fullBleed} className="-mt-4 md:-mt-8 mb-6 py-6 animate-[fadeIn_0.5s_ease-out] shadow-inner">
            <div className="max-w-[95%] mx-auto">
                <h1 className={`text-2xl md:text-3xl font-normal mb-4 tracking-tight text-center ${headText}`}>
                    Panel de Incorporación
                </h1>
                <div className={`mb-3 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 ${headText}`}>
                    <h2 className={`text-base md:text-lg font-medium flex items-center gap-2 ${headText}`}>
                        <svg className={`w-5 h-5 ${headText}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
                        </svg>
                        Avance Esperado vs Real por Gerencia
                    </h2>
                    <div className={`flex items-center flex-wrap gap-2 md:gap-3 text-xs md:text-sm font-extrabold rounded-xl px-3 py-2 shadow-sm border ${isDark ? 'bg-slate-900/70 border-white/10' : 'bg-white/90 border-black/10'}`}>
                        <div className="flex items-center gap-1.5">
                            <span className="w-3 h-3 rounded-full inline-block" style={{ background: isDark ? '#94a3b8' : '#64748b' }}></span>
                            <span className={headText}>Esperado Global: {esperadoGlobal}%</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="w-3 h-3 rounded-full bg-yellow-500 border border-black/20 inline-block"></span>
                            <span className={headText}>Real Global: {realGlobal}%</span>
                        </div>
                        <SPIBadge real={realGlobal} esperado={esperadoGlobal} />
                        <span className={`px-2.5 py-1 rounded-lg text-[11px] font-black tracking-wide whitespace-nowrap ${isDark ? 'bg-yellow-500 text-black' : 'bg-slate-900 text-white'}`}>
                            {checklists.length} proceso{checklists.length !== 1 ? 's' : ''}
                        </span>
                    </div>
                </div>
                <p className={`text-xs mt-1 mb-3 font-bold ${subText}`}>
                    Gris = % esperado · Amarillo = % real
                </p>
                {sinDatos ? (
                    <div className={`rounded-2xl border border-dashed py-8 text-center text-sm font-semibold ${isDark ? 'border-white/25 text-slate-300' : 'border-black/25 text-slate-800'}`}>
                        Ningún proceso coincide con los filtros aplicados.
                    </div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                        {data.map((d) => (
                            <Pie key={d.gerencia} {...d} theme={theme} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default GerenciaPieCharts;