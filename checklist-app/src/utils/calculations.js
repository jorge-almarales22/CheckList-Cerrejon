export const calcularCumplimiento = (fechaInicio, fechaFin) => {
    if (!fechaFin || !fechaInicio) return 0;
    const start = new Date(fechaInicio); start.setHours(0, 0, 0, 0);
    const end = new Date(fechaFin); end.setHours(0, 0, 0, 0);
    const today = new Date(); today.setHours(0, 0, 0, 0);

    const totalDiff = end.getTime() - start.getTime();
    if (totalDiff <= 0) return 100;
    const currentDiff = today.getTime() - start.getTime();
    let percent = (currentDiff / totalDiff) * 100;
    if (percent < 0) percent = 0;
    if (percent > 100) percent = 100;
    return Math.round(percent);
};

export const calcularPromedioChecklist = (items) => {
    if (!items || items.length === 0) return 0;
    const activos = items.filter(it => (it.Estado || it.estado) !== 'Inactivo');
    if (activos.length === 0) return 0;
    let total = 0;
    activos.forEach(it => { total += calcularCumplimiento(it.FechaInicio || it.fechaInicio, it.FechaFin || it.fechaFin); });
    return Math.round(total / activos.length);
};

export const calcularPromedioReal = (items) => {
    if (!items || items.length === 0) return 0;
    const activos = items.filter(it => (it.Estado || it.estado) !== 'Inactivo');
    if (activos.length === 0) return 0;
    let total = 0;
    activos.forEach(it => { total += parseInt(it.Avance || it.avance) || 0; });
    return Math.round(total / activos.length);
};

// % esperado de un checklist basado en la fecha de inicio de diligenciamiento
// y la fecha de fin planificada (fechaFinDiligenciamiento si ya finalizo, o la
// fecha fin maxima de sus items si esta en curso). Si no hay fecha fin, usa
// la fecha de inicio + 30 dias como ventana por defecto.
export const calcularEsperadoChecklist = (checklist) => {
    if (!checklist) return 0;
    const meta = checklist.Metadata || {};
    const fechaInicio = meta.fechaInicioDiligenciamiento;
    let fechaFin = meta.fechaFinDiligenciamiento;

    // Si no esta finalizado o la fecha fin no es valida, derivar de los items
    if (!fechaFin || fechaFin === 'Se completará al finalizar' || isNaN(new Date(fechaFin).getTime())) {
        const items = checklist.items || [];
        const fechasFin = items
            .map(it => it.FechaFin || it.fechaFin)
            .filter(f => f && !isNaN(new Date(f).getTime()))
            .map(f => new Date(f).getTime());
        if (fechasFin.length > 0) {
            fechaFin = new Date(Math.max(...fechasFin)).toISOString().split('T')[0];
        } else if (fechaInicio) {
            // ventana por defecto de 30 dias
            const d = new Date(fechaInicio);
            d.setDate(d.getDate() + 30);
            fechaFin = d.toISOString().split('T')[0];
        } else {
            return 0;
        }
    }
    return calcularCumplimiento(fechaInicio, fechaFin);
};

// % real general de un checklist.
// - Si es historico (chk.historico === true):
//     * Si tiene la llave "Real" en la DB (formato "23.04%"), usa ese valor.
//     * Si no tiene la llave "Real", se asume 100%.
// - Si no es historico, se calcula como el promedio de avance de items activos.
export const calcularRealChecklist = (checklist) => {
    if (!checklist) return 0;
    if (checklist.historico === true || checklist.Historico === true) {
        const realRaw = checklist.Real ?? checklist.real;
        if (realRaw === undefined || realRaw === null || realRaw === '') return 100;
        // Formato esperado: "23.04%" o "23.04" o 23.04
        const num = parseFloat(String(realRaw).replace('%', '').replace(',', '.').trim());
        if (isNaN(num)) return 100;
        return Math.round(num);
    }
    if (!checklist.items) return 0;
    return calcularPromedioReal(checklist.items);
};

// Agrupa checklists por gerencia y calcula el promedio esperado y real de cada una.
// Devuelve un array: [{ gerencia, esperado, real, count }]
export const calcularResumenPorGerencia = (checklists) => {
    if (!checklists || checklists.length === 0) return [];
    const map = {};
    checklists.forEach(chk => {
        const gerencia = chk.Metadata?.gerencia || 'Sin gerencia';
        if (!map[gerencia]) map[gerencia] = { esperadoSum: 0, realSum: 0, count: 0 };
        map[gerencia].esperadoSum += calcularEsperadoChecklist(chk);
        map[gerencia].realSum += calcularRealChecklist(chk);
        map[gerencia].count += 1;
    });
    return Object.keys(map).map(g => ({
        gerencia: g,
        esperado: Math.round(map[g].esperadoSum / map[g].count),
        real: Math.round(map[g].realSum / map[g].count),
        count: map[g].count
    })).sort((a, b) => b.real - a.real);
};
