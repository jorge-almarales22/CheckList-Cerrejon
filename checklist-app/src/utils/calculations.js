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
