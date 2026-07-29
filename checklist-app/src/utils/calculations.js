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

// Un historico "gestionado" es el que ya se empezo a diligenciar desde la app.
// A partir de ese momento deja de usar los % quemados que vinieron de la base de
// datos migrada y se comporta como cualquier checklist creado en la app: real y
// esperado salen de sus propias tareas.
export const esHistoricoGestionado = (chk) => chk?.HistoricoGestionado === true;

// True solo mientras el checklist siga apoyandose en los valores migrados.
export const usaValoresHistoricos = (chk) => esHistorico(chk) && !esHistoricoGestionado(chk);

// Marca un historico como gestionado. Se usa en CheckListDetalle antes de guardar
// cualquier cambio sobre las tareas, para que a partir de ahi las metricas del
// checklist (y por lo tanto las globales) se recalculen solas.
export const marcarHistoricoGestionado = (chk) => {
    if (!chk || !esHistorico(chk) || esHistoricoGestionado(chk)) return chk;
    return { ...chk, HistoricoGestionado: true, HistoricoGestionadoFecha: new Date().toISOString() };
};

// Estado del flujo de aprobacion. Los checklists antiguos (sin la llave) se tratan
// como ya aprobados para no ocultar lo que ya estaba en produccion.
export const getEstadoAprobacion = (chk) => chk?.EstadoAprobacion || 'Aprobado';
export const esAprobado = (chk) => getEstadoAprobacion(chk) === 'Aprobado';
export const esPendiente = (chk) => getEstadoAprobacion(chk) === 'Pendiente';
export const esRechazado = (chk) => getEstadoAprobacion(chk) === 'Rechazado';

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

// Ventana de diligenciamiento declarada en los metadatos del checklist. Sirve de
// respaldo cuando las tareas no traen fechas planeadas (caso tipico de los
// historicos migrados, que no tienen baseline por tarea).
const ventanaDiligenciamiento = (checklist) => {
    const ini = checklist?.Metadata?.fechaInicioDiligenciamiento;
    const fin = checklist?.Metadata?.fechaFinDiligenciamiento;
    if (esFechaValida(ini) && esFechaValida(fin)) return { ini, fin };
    return null;
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
// - Si es historico y AUN NO se ha gestionado desde la app:
//     * Si tiene la llave "Real" en la DB (formato "23.04%"), usa ese valor.
//     * Si no tiene la llave "Real", se asume 100%.
// - En cualquier otro caso (checklist normal, o historico ya gestionado desde la
//   app), se calcula como el promedio de avance de sus items activos.
export const calcularRealChecklist = (checklist) => {
    if (!checklist) return 0;
    if (usaValoresHistoricos(checklist)) {
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

    // Los historicos sin gestionar no tienen fechas planeadas por tarea: se usa la
    // ventana de diligenciamiento del checklist (Inicio -> Fin) para el % esperado.
    if (usaValoresHistoricos(checklist)) {
        const vd = ventanaDiligenciamiento(checklist);
        if (vd) return calcularCumplimiento(vd.ini, vd.fin);
        // Sin fechas de diligenciamiento: si ya esta completo, el plan tambien.
        return calcularRealChecklist(checklist) >= 100 ? 100 : 0;
    }

    const items = itemsActivos(checklist.items);
    if (items.length === 0) return 0;
    const v = ventanaFechas(items);
    // Si las tareas no traen fechas (historico ya gestionado, por ejemplo) se cae
    // a la ventana de diligenciamiento antes de rendirse con un 0%.
    if (!v) {
        const vd = ventanaDiligenciamiento(checklist);
        return vd ? calcularCumplimiento(vd.ini, vd.fin) : 0;
    }
    return calcularCumplimiento(new Date(v.inicio), new Date(v.fin));
};

// % esperado global: promedio del % esperado de TODOS los checklists, incluidos
// los finalizados y los que estan al 100% (cuentan para todo). Cada checklist
// calcula su esperado sobre su propia ventana, asi que un finalizado antiguo
// aporta su ~100% sin estirar ninguna ventana comun.
export const calcularEsperadoGlobal = (checklists) => {
    const todos = checklists || [];
    if (todos.length === 0) return 0;
    let total = 0;
    todos.forEach(chk => { total += calcularEsperadoChecklist(chk); });
    return Math.round(total / todos.length);
};

// % real global: promedio de los % reales de todos los checklists, incluidos los
// finalizados (aportan su avance y suben el promedio).
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
