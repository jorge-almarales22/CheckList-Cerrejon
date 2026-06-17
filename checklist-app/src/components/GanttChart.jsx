import React from 'react';

const GanttChart = ({ items }) => {
    if (!items || items.length === 0) return null;
    const activos = items.filter(it => (it.Estado || it.estado) !== 'Inactivo');
    if (activos.length === 0) return null;

    const getValidDate = (d) => d ? new Date(d) : null;
    let minDate = new Date('2999-12-31');
    let maxDate = new Date('1970-01-01');
    let hasAnyDate = false;

    activos.forEach(it => {
        const d1 = getValidDate(it.FechaBaselineInicio || it.fechaBaselineInicio);
        const d2 = getValidDate(it.FechaBaselineFin || it.fechaBaselineFin);
        const d3 = getValidDate(it.FechaInicio || it.fechaInicio);
        const d4 = getValidDate(it.FechaFin || it.fechaFin);

        if (d1 && d1 < minDate) { minDate = d1; hasAnyDate = true; }
        if (d3 && d3 < minDate) { minDate = d3; hasAnyDate = true; }
        if (d2 && d2 > maxDate) { maxDate = d2; hasAnyDate = true; }
        if (d4 && d4 > maxDate) { maxDate = d4; hasAnyDate = true; }
    });

    if (!hasAnyDate) return (
        <div className="bg-gray-900/80 p-6 rounded-2xl border border-white/20 shadow-2xl mt-8 text-center text-white/50">
            {"No hay tareas activas con Fechas v\u00e1lidas para generar el Diagrama de Gantt."}
        </div>
    );

    let totalDays = (maxDate - minDate) / (1000 * 60 * 60 * 24);
    if (totalDays <= 0) totalDays = 1;

    return (
        <div className="bg-black/80 backdrop-blur-2xl p-6 rounded-3xl border border-white/20 shadow-[0_0_30px_rgba(0,0,0,0.3)] mt-8 overflow-x-auto animate-[fadeIn_0.5s_ease-out]">
            <h3 className="text-xl font-bold text-yellow-400 mb-6 flex items-center gap-2">
                <svg className="w-6 h-6 inline-block" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 13v-1m4 1v-3m4 3V8M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" /></svg> {"Diagrama de Gantt del Checklist (Tareas Activas)"}
            </h3>

            <div className="min-w-[800px] pb-4">
                <div className="flex justify-between text-xs font-bold text-white/50 mb-3 px-[220px] border-b border-white/10 pb-2">
                    <span>{"Inicio Proyecto: "}{minDate.toISOString().split('T')[0]}</span>
                    <span>{"Fin Proyecto: "}{maxDate.toISOString().split('T')[0]}</span>
                </div>

                <div className="space-y-4 relative">
                    {activos.map((it, idx) => {
                        const baseStart = getValidDate(it.FechaBaselineInicio || it.fechaBaselineInicio);
                        const baseEnd = getValidDate(it.FechaBaselineFin || it.fechaBaselineFin);
                        const actStart = getValidDate(it.FechaInicio || it.fechaInicio);
                        const actEnd = getValidDate(it.FechaFin || it.fechaFin);
                        const avance = parseInt(it.Avance || it.avance) || 0;

                        let baseLeftPercent = 0, baseWidthPercent = 0;
                        if (baseStart && baseEnd) {
                            const leftDays = (baseStart - minDate) / (1000 * 60 * 60 * 24);
                            let durDays = (baseEnd - baseStart) / (1000 * 60 * 60 * 24);
                            if (durDays < 1) durDays = 1;
                            baseLeftPercent = (leftDays / totalDays) * 100;
                            baseWidthPercent = (durDays / totalDays) * 100;
                        }

                        let actLeftPercent = 0, actWidthPercent = 0;
                        if (actStart && actEnd) {
                            const leftDays = (actStart - minDate) / (1000 * 60 * 60 * 24);
                            let durDays = (actEnd - actStart) / (1000 * 60 * 60 * 24);
                            if (durDays < 1) durDays = 1;
                            actLeftPercent = (leftDays / totalDays) * 100;
                            actWidthPercent = (durDays / totalDays) * 100;
                        }

                        return (
                            <div key={it.Id || idx} className="flex items-center gap-4 text-sm group">
                                <div className="w-[200px] flex-shrink-0 text-white/80 whitespace-normal break-words font-medium text-xs leading-tight" title={it.Descripcion || it.actividades}>
                                    <span className="text-white/40 mr-1 font-bold">{idx + 1}.</span> {it.Descripcion || it.actividades}
                                </div>

                                <div className="flex-1 bg-white/5 h-12 rounded-lg relative overflow-hidden flex flex-col justify-center gap-1 border border-white/5">

                                    {baseStart && baseEnd && (
                                        <div
                                            className="absolute h-2 top-1.5 bg-[repeating-linear-gradient(45deg,transparent,transparent_2px,rgba(96,165,250,0.5)_2px,rgba(96,165,250,0.5)_4px)] bg-blue-900/30 border border-blue-400/50 rounded-sm"
                                            style={{ left: `${baseLeftPercent}%`, width: `${baseWidthPercent}%` }}
                                            title={`Planificado (Baseline): ${(it.FechaBaselineInicio || it.fechaBaselineInicio)} a ${(it.FechaBaselineFin || it.fechaBaselineFin)}`}
                                        ></div>
                                    )}

                                    {actStart && actEnd && (
                                        <div
                                            className="absolute h-5 bottom-1.5 bg-yellow-600/40 border border-yellow-500/50 rounded flex flex-col justify-center overflow-hidden transition-all duration-300 shadow-inner"
                                            style={{ left: `${actLeftPercent}%`, width: `${actWidthPercent}%` }}
                                            title={`Real: ${(it.FechaInicio || it.fechaInicio)} a ${(it.FechaFin || it.fechaFin)} \nAvance: ${avance}%`}
                                        >
                                            <div
                                                className="absolute top-0 left-0 h-full bg-gradient-to-r from-yellow-400 to-yellow-500 transition-all duration-500"
                                                style={{ width: `${avance}%` }}
                                            ></div>
                                            <span className="relative z-10 text-[10px] font-extrabold text-black px-2 drop-shadow-md truncate">
                                                {avance}%
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default GanttChart;
