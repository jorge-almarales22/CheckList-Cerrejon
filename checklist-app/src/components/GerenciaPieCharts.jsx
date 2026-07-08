import React, { useMemo } from 'react';
import { calcularResumenPorGerencia } from '../utils/calculations';

// Torta (donut) SVG que muestra el % esperado (gris) y el % real (amarillo).
// El pedazo gris representa el esperado promedio de todos los checklist de la gerencia.
// El pedazo amarillo representa el real promedio.
const GerenciaPieCharts = ({ checklists, theme }) => {
    const data = useMemo(() => calcularResumenPorGerencia(checklists), [checklists]);

    if (!data || data.length === 0) return null;

    const cardBg = theme === 'dark'
        ? 'bg-slate-900 border-slate-800 text-slate-100'
        : 'bg-white border-slate-200 text-slate-900';

    const labelColor = theme === 'dark' ? 'text-slate-400' : 'text-slate-500';
    const trackStroke = theme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)';

    const radius = 52;
    const circum = 2 * Math.PI * radius;

    const Pie = ({ esperado, real, gerencia, count }) => {
        // El esperado (gris) se dibuja como el arco completo hasta su porcentaje.
        const offsetEsp = circum - (esperado / 100) * circum;
        // El real (amarillo) se dibuja encima, hasta su porcentaje.
        const offsetReal = circum - (real / 100) * circum;

        return (
            <div className={`${cardBg} border p-5 rounded-2xl flex flex-col items-center justify-center transition-all hover:scale-[1.02]`}>
                <h3 className={`text-[11px] font-bold uppercase tracking-wider mb-1 text-center ${labelColor}`} title={gerencia}>
                    {gerencia}
                </h3>
                <span className={`text-[10px] font-semibold mb-3 ${labelColor}`}>{count} checklist{count !== 1 ? 's' : ''}</span>

                <div className="relative w-32 h-32 flex flex-col items-center justify-center">
                    <svg className="w-full h-full transform -rotate-90">
                        {/* track */}
                        <circle cx="64" cy="64" r={radius} fill="transparent" stroke={trackStroke} strokeWidth="14" />
                        {/* esperado (gris) */}
                        <circle
                            cx="64" cy="64" r={radius} fill="transparent"
                            stroke={theme === 'dark' ? '#64748b' : '#cbd5e1'}
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
                        <span className="text-xl font-black">{real}%</span>
                        <span className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-0.5">Real</span>
                    </div>
                </div>

                <div className="flex gap-3 mt-4 text-[10px] font-bold">
                    <div className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-full inline-block" style={{ background: theme === 'dark' ? '#64748b' : '#cbd5e1' }}></span>
                        <span className={labelColor}>Esp: {esperado}%</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-full bg-yellow-500 inline-block"></span>
                        <span className={labelColor}>Real: {real}%</span>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="mb-8 animate-[fadeIn_0.5s_ease-out]">
            <div className={`mb-4 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                <h2 className="text-lg font-black flex items-center gap-2">
                    <svg className={`w-5 h-5 ${theme === 'dark' ? 'text-yellow-400' : 'text-amber-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
                    </svg>
                    Avance Esperado vs Real por Gerencia
                </h2>
                <p className={`text-xs mt-1 ${labelColor}`}>
                    Gris = % esperado (según tiempo transcurrido) · Amarillo = % real (avance promedio)
                </p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {data.map((d) => (
                    <Pie key={d.gerencia} {...d} theme={theme} />
                ))}
            </div>
        </div>
    );
};

export default GerenciaPieCharts;