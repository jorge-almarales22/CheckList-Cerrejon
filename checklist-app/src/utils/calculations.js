// % de tiempo transcurrido dentro de una ventana (inicio -> fin).
// Si la ventana dura 10 dias, cada dia equivale a un 10%.
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

const esFechaValida = (f) => !!f && !isNaN(new Date(f).getTime());

const itemsActivos = (items) => (items || []).filter(it => (it.Estado || it.estado) !== 'Inactivo');

export const esHistorico = (chk) => chk?.historico === true || chk?.Historico === true;

// El avance ESPERADO se mide contra el plan, por eso se usan las fechas baseline.
// Si una tarea no tiene baseline, se cae a las fechas reales.
const getInicioPlan = (it) => it.FechaBaselineInicio || it.fechaBaselineInicio || it.FechaInicio || it.fechaInicio;
const getFinPlan = (it) => it.FechaBaselineFin || it.fechaBaselineFin || it.FechaFin || it.fechaFin;

// Ventana total de un conjunto de tareas: el inicio mas temprano y el fin mas lejano.
const ventanaFechas = (items) => {
    const inicios = [];
    const fines = [];
    items.forEach(it => {
        const fi = getInicioPlan(it);
        const ff = getFinPlan(it);
        if (esFechaValida(fi)) inicios.push(new Date(fi).getTime());
        if (esFechaValida(ff)) fines.push(new Date(ff).getTime());
    });
    if (inicios.length === 0 || fines.length === 0) return null;
    return { inicio: Math.min(...inicios), fin: Math.max(...fines) };
};

export const calcularPromedioChecklist = (items) => {
    if (!items || items.length === 0) return 0;
    const activos = itemsActivos(items);
    if (activos.length === 0) return 0;
    let total = 0;
    activos.forEach(it => { total += calcularCumplimiento(it.FechaInicio || it.fechaInicio, it.FechaFin || it.fechaFin); });
    return Math.round(total / activos.length);
};

// % real de un checklist: promedio simple del avance de sus tareas activas.
export const calcularPromedioReal = (items) => {
    if (!items || items.length === 0) return 0;
    const activos = itemsActivos(items);
    if (activos.length === 0) return 0;
    let total = 0;
    activos.forEach(it => { total += parseInt(it.Avance || it.avance) || 0; });
    return Math.round(total / activos.length);
};

// % real general de un checklist.
// - Si es historico (chk.historico === true):
//     * Si tiene la llave "Real" en la DB (formato "23.04%"), usa ese valor.
//     * Si no tiene la llave "Real", se asume 100%.
// - Si no es historico, se calcula como el promedio de avance de items activos.
export const calcularRealChecklist = (checklist) => {
    if (!checklist) return 0;
    if (esHistorico(checklist)) {
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

// % esperado de un checklist: se toma la ventana completa (fecha mas temprana de
// inicio -> fecha mas lejana de fin de TODAS sus tareas activas) y se mide cuanto
// tiempo ha transcurrido. NO es el promedio de los % de cada tarea.
export const calcularEsperadoChecklist = (checklist) => {
    if (!checklist) return 0;
    // Un historico ya completado al 100% se considera tambien 100% planeado.
    if (esHistorico(checklist) && calcularRealChecklist(checklist) >= 100) return 100;

    const items = itemsActivos(checklist.items);
    if (items.length === 0) return 0;
    const v = ventanaFechas(items);
    if (!v) return 0;
    return calcularCumplimiento(new Date(v.inicio), new Date(v.fin));
};

// % esperado global: misma logica que un checklist pero sobre la ventana de TODAS
// las tareas activas de TODOS los checklists, incluidos los finalizados.
export const calcularEsperadoGlobal = (checklists) => {
    const todos = checklists || [];
    if (todos.length === 0) return 0;

    const todasLasTareas = [];
    todos.forEach(chk => { todasLasTareas.push(...itemsActivos(chk.items)); });
    if (todasLasTareas.length === 0) return 0;

    const v = ventanaFechas(todasLasTareas);
    if (!v) return 0;
    return calcularCumplimiento(new Date(v.inicio), new Date(v.fin));
};

// % real global: promedio de los % reales de todos los checklists, incluidos los
// finalizados (aportan su 100% y suben el promedio).
export const calcularRealGlobal = (checklists) => {
    const todos = checklists || [];
    if (todos.length === 0) return 0;
    let total = 0;
    todos.forEach(chk => { total += calcularRealChecklist(chk); });
    return Math.round(total / todos.length);
};

// SPI = Real / Esperado, en %. Si todavia no se espera avance no puede haber atraso.
export const calcularSPI = (real, esperado) => {
    if (!esperado || esperado <= 0) return 100;
    return Math.round((real / esperado) * 100);
};

// Semaforo del SPI: <90 rojo, 90-94 amarillo, >=95 verde.
export const getSPIStatus = (spi) => {
    if (spi < 90) return { nivel: 'malo', icono: '✕', texto: 'Atrasado' };
    if (spi < 95) return { nivel: 'advertencia', icono: '!', texto: 'En riesgo' };
    return { nivel: 'ok', icono: '✓', texto: 'En tiempo' };
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
