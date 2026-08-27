import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { calcularEsperadoChecklist, calcularRealChecklist, esAprobado, esPendiente, esRechazado, esHistorico } from '../utils/calculations';
import { getRequestDigest, deleteSPListItem } from '../utils/sharepointApi';
import GerenciaPieCharts from './GerenciaPieCharts';
import SPIBadge from './SPIBadge';
import dibujoSvg from '../assets/dibujoSvg.svg';

// Descripcion institucional de la fase de Incorporación de Activos.
const DESCRIPCION_INCORPORACION = "Durante la fase de incorporación de activos, Cerrejón desarrolla las capacidades necesarias (personas, sistemas y equipos), define las estrategias de operación y mantenimiento, y asegura la disponibilidad de información clave sobre confiabilidad, repuestos, costos del ciclo de vida, capacitación y contratos. Asimismo, valida que toda la información del activo esté completa y gestionada para soportar su operación y mantenimiento durante todo el ciclo de vida.";

const USERPHOTO = (email) => `https://glencore.sharepoint.com/_layouts/15/userphoto.aspx?size=S&accountname=${encodeURIComponent(email || '')}`;
const AVATAR_FALLBACK = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='%23ccc' viewBox='0 0 24 24'%3E%3Cpath d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'/%3E%3C/svg%3E";

const COLUMN_FILTERS = [
    { key: 'nombre', label: 'NOM. CHK.' },
    { key: 'esperado', label: 'PLAN (ESP.)' },
    { key: 'real', label: 'COMPL. (REAL)' },
    { key: 'gerencia', label: 'GER.' },
    { key: 'superintendencia', label: 'SUPT.' },
    { key: 'tipo', label: 'TIPO INCORP.' },
    { key: 'creadoPor', label: 'CREAD. POR' }
];

const getColumnFilterValue = (checklist, key) => {
    if (key === 'nombre') return checklist.Name || 'Sin nombre';
    if (key === 'esperado') return `${calcularEsperadoChecklist(checklist)}%`;
    if (key === 'real') return `${calcularRealChecklist(checklist)}%`;
    if (key === 'gerencia') return checklist.Metadata?.gerencia || '-';
    if (key === 'superintendencia') return checklist.Metadata?.superintendencia || '-';
    if (key === 'tipo') return checklist.Tipo || '-';
    if (key === 'creadoPor') return checklist.CreadoPorNombre || checklist.CreadoPor || (esHistorico(checklist) ? 'Históricos' : '-');
    return '-';
};

const ColumnFilterPopover = ({ column, values, selectedValues, theme, onApply, style }) => {
    const [search, setSearch] = useState('');
    const [selected, setSelected] = useState(() => new Set(selectedValues));
    const searchRef = useRef(null);
    const visibleValues = values.filter(value => value.toLowerCase().includes(search.trim().toLowerCase()));

    useEffect(() => {
        searchRef.current?.focus();
        const applyAndClose = () => onApply(selected);
        const handleKeyDown = (event) => { if (event.key === 'Escape') applyAndClose(); };
        const handleOutsideClick = (event) => {
            if (!event.target.closest('.column-filter-popover')) applyAndClose();
        };
        document.addEventListener('keydown', handleKeyDown);
        document.addEventListener('mousedown', handleOutsideClick);
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.removeEventListener('mousedown', handleOutsideClick);
        };
    }, [onApply, selected]);

    const toggleValue = (value) => {
        setSelected(previous => {
            const next = new Set(previous);
            if (next.has(value)) next.delete(value); else next.add(value);
            return next;
        });
    };

    const selectVisible = (shouldSelect) => {
        setSelected(previous => {
            const next = new Set(previous);
            visibleValues.forEach(value => shouldSelect ? next.add(value) : next.delete(value));
            return next;
        });
    };

    return createPortal(
        <div style={style} className={`column-filter-popover ${theme === 'dark' ? 'column-filter-popover-dark' : ''}`} role="dialog" aria-label={`Filtrar ${column.label}`} onClick={event => event.stopPropagation()}>
            <div className={`column-filter-search-wrap ${theme === 'dark' ? 'column-filter-search-wrap-dark' : ''}`}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m21 21-4.35-4.35m1.35-5.15a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0Z" /></svg>
                <input ref={searchRef} value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar valor..." autoComplete="off" />
            </div>
            <div className="column-filter-quick-actions">
                <button type="button" onClick={() => selectVisible(true)}>Todos</button>
                <button type="button" onClick={() => selectVisible(false)}>Ninguno</button>
            </div>
            <div className="column-filter-list" role="listbox" aria-label={`Valores de ${column.label}`}>
                {visibleValues.length === 0 ? <p className="column-filter-empty">Sin resultados</p> : visibleValues.map(value => (
                    <label key={value} className="column-filter-option">
                        <input type="checkbox" checked={selected.has(value)} onChange={() => toggleValue(value)} />
                        <span title={value}>{value}</span>
                    </label>
                ))}
            </div>
            <div className={`column-filter-footer ${theme === 'dark' ? 'column-filter-footer-dark' : ''}`}>
                <span>{selected.size} de {values.length} seleccionados</span>
                <button type="button" className="column-filter-clear" onClick={() => onApply(new Set())}>Limpiar</button>
                <button type="button" className="column-filter-apply" onClick={() => onApply(selected)}>Aplicar</button>
            </div>
        </div>,
        document.body
    );
};

const FilterableHeader = ({ column, active, theme, onOpen, isOpen, values, selectedValues, onApply, visibilityClass = '', extraClass = '' }) => {
    const buttonRef = useRef(null);
    const [popoverStyle, setPopoverStyle] = useState({});

    useEffect(() => {
        if (!isOpen) return undefined;
        const updatePosition = () => {
            const rect = buttonRef.current?.getBoundingClientRect();
            if (!rect) return;
            const width = Math.min(336, window.innerWidth - 24);
            const gap = 6;
            const below = window.innerHeight - rect.bottom - gap;
            const above = rect.top - gap;
            const opensAbove = below < 300 && above > below;
            const availableHeight = Math.max(220, (opensAbove ? above : below) - 12);
            const left = Math.min(Math.max(12, rect.left), window.innerWidth - width - 12);
            setPopoverStyle({
                left: `${left}px`,
                width: `${width}px`,
                ...(opensAbove ? { bottom: `${window.innerHeight - rect.top + gap}px` } : { top: `${rect.bottom + gap}px` }),
                maxHeight: `${availableHeight}px`
            });
        };
        updatePosition();
        window.addEventListener('resize', updatePosition);
        window.addEventListener('scroll', updatePosition, true);
        return () => {
            window.removeEventListener('resize', updatePosition);
            window.removeEventListener('scroll', updatePosition, true);
        };
    }, [isOpen]);

    return (
        <th className={`filterable-table-header ${visibilityClass} ${extraClass} border-b border-slate-200 dark:border-slate-800 ${theme==='dark'?'bg-slate-900':'bg-white'}`}>
            <button ref={buttonRef} type="button" className={`filterable-header-button ${theme === 'dark' ? 'filterable-header-button-dark' : ''} ${active ? 'filterable-header-button-active' : ''}`} onClick={onOpen} aria-haspopup="dialog" aria-expanded={isOpen} title={`Filtrar ${column.label}`}>
                <span>{column.label}</span>
                {active > 0 && <span className="filterable-header-badge">{active}</span>}
                <svg className="filterable-header-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16l-6 7v5l-4 2v-7L4 5Z" /></svg>
            </button>
            {isOpen && <ColumnFilterPopover column={column} values={values} selectedValues={selectedValues} theme={theme} onApply={onApply} style={popoverStyle} />}
        </th>
    );
};

const CheckListAll = ({ onView, role, currentUser, theme }) => {
    const [checklists, setChecklists] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showTemplateModal, setShowTemplateModal] = useState(false);

    const [filtroAlerta, setFiltroAlerta] = useState(false);
    const [columnFilters, setColumnFilters] = useState({});
    const [openColumn, setOpenColumn] = useState(null);
    const [verSolicitudes, setVerSolicitudes] = useState(false); // ver la bandeja de aprobaciones

    // Eliminación de un checklist (solo administradores).
    const [checklistAEliminar, setChecklistAEliminar] = useState(null);
    const [confirmNombre, setConfirmNombre] = useState('');
    const [eliminando, setEliminando] = useState(false);

    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 50;

    const cardClass = theme === 'dark' 
        ? 'bg-slate-900 border-slate-800 text-slate-100 shadow-[0_0_20px_rgba(0,0,0,0.5)]' 
        : 'bg-white border-slate-200 text-slate-900 shadow-md shadow-slate-100';

    const inputClasses = theme === 'dark'
        ? "bg-slate-950/80 text-white border border-slate-800 focus:border-yellow-400 rounded-lg px-4 py-2 outline-none text-sm"
        : "bg-slate-100 text-slate-900 border border-slate-300 focus:border-yellow-500 rounded-lg px-4 py-2 outline-none text-sm";

    // Los select llevan ancho mínimo propio (según su placeholder) y espacio extra a
    // la derecha para la flecha nativa; sin esto el texto quedaba cortado.
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
            // La visibilidad ahora se resuelve al renderizar (aprobados vs solicitudes).
            setChecklists(combined.reverse());
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

    useEffect(() => { setCurrentPage(1); }, [filtroAlerta, columnFilters, verSolicitudes]);

    // Borrado definitivo del registro en SharePoint. Solo lo alcanzan los admins y
    // exige escribir el nombre exacto del checklist en el modal de confirmación.
    const handleEliminarChecklist = async () => {
        if (!checklistAEliminar || eliminando) return;
        if (confirmNombre.trim() !== (checklistAEliminar.Name || '').trim()) return;
        setEliminando(true);
        try {
            const digest = await getRequestDigest();
            await deleteSPListItem('DB_CHECKLIST_APP', checklistAEliminar.SharePointId, digest);
            setChecklists(prev => prev.filter(c => c.SharePointId !== checklistAEliminar.SharePointId));
            setChecklistAEliminar(null);
            setConfirmNombre('');
        } catch (error) {
            console.error('Error eliminando el checklist:', error);
            alert('No se pudo eliminar el checklist. Revisa la consola.');
        } finally {
            setEliminando(false);
        }
    };

    if (loading) return <div className="text-center text-white mt-20 font-bold">Cargando datos desde SharePoint DB...</div>;

    // Eliminar un checklist es exclusivo de los administradores.
    const puedeEliminar = role === 'Administrador';

    // Todas las incorporaciones aprobadas son visibles para toda la empresa: ya no
    // se filtra por responsable, rol en los metadatos ni creador. Quien puede
    // GESTIONAR cada tarea se sigue resolviendo dentro del detalle (responsable,
    // corresponsable o administrador).
    const aprobados = checklists.filter(esAprobado);
    // Todas las solicitudes pendientes/rechazadas son visibles para todos los usuarios.
    const solicitudes = checklists.filter(chk => esPendiente(chk) || esRechazado(chk));
    const numSolicitudes = solicitudes.length;

    const filtrarPorColumnas = (lista, ignorar = null) => lista.filter(chk =>
        Object.entries(columnFilters).every(([key, selected]) => {
            if (key === ignorar || !selected?.size) return true;
            return selected.has(getColumnFilterValue(chk, key));
        })
    );

    const getColumnValues = (columnKey, lista) => [...new Set(
        filtrarPorColumnas(lista, columnKey).map(chk => getColumnFilterValue(chk, columnKey))
    )].sort((a, b) => a.localeCompare(b, 'es'));

    const aplicarFiltros = (lista) => {
        let r = filtrarPorColumnas(lista);
        if (filtroAlerta) r = r.filter(chk => chk.items && chk.items.some(it => it.Alerta === "Si"));
        return r;
    };

    const listaBaseFiltros = verSolicitudes ? solicitudes : aprobados;
    const propsFiltroColumna = (column) => ({
        column,
        theme,
        active: columnFilters[column.key]?.size || 0,
        isOpen: openColumn === column.key,
        values: getColumnValues(column.key, listaBaseFiltros),
        selectedValues: columnFilters[column.key] || new Set(),
        onOpen: () => setOpenColumn(openColumn === column.key ? null : column.key),
        onClose: () => setOpenColumn(null),
        onApply: (selected) => {
            setColumnFilters(previous => ({ ...previous, [column.key]: new Set(selected) }));
            setOpenColumn(null);
        }
    });

    // Las metricas (panel amarillo) solo consideran checklists APROBADOS.
    const aprobadosFiltrados = aplicarFiltros(aprobados);
    // La tabla muestra la bandeja de solicitudes o los aprobados segun el filtro.
    const filtrados = verSolicitudes ? aplicarFiltros(solicitudes) : aprobadosFiltrados;

    const totalPages = Math.ceil(filtrados.length / itemsPerPage);
    const currentItems = filtrados.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    return (
        <div className="max-w-[95%] mx-auto animate-[fadeIn_0.4s_ease-out]">
            {/* Gráficas de torta por gerencia (solo aprobados): primero, bajo el navbar.
                Se renderiza siempre para que el panel reaccione a los filtros en vez de
                desaparecer cuando el filtro no devuelve resultados. */}
            <GerenciaPieCharts checklists={aprobadosFiltrados} theme={theme} />

            {/* Título centrado, descripción justificada a la izquierda e ilustración a la derecha */}
            <div className={`${cardClass} border p-4 md:p-6 rounded-3xl mb-5`}>
                <h2 className="text-2xl md:text-3xl font-normal leading-tight text-center">Incorporación de Activos</h2>
                <div className="mt-3 flex flex-col-reverse md:flex-row md:items-center gap-4 md:gap-8">
                    <p className="flex-1 min-w-0 text-sm md:text-base text-justify text-slate-700 dark:text-slate-300 leading-relaxed">
                        {DESCRIPCION_INCORPORACION}
                    </p>
                    <img
                        src={dibujoSvg}
                        alt="Ilustración de incorporación de activos"
                        className="w-28 sm:w-32 md:w-36 lg:w-40 shrink-0 self-center select-none pointer-events-none"
                    />
                </div>
            </div>

            {/* Filtros */}
            <div className={`${cardClass} border p-4 md:p-6 rounded-3xl mb-6`}>
                <div className="flex flex-col md:flex-row md:flex-wrap gap-2 md:gap-3 w-full items-stretch md:items-center">
                    {/* Crear nueva incorporación: cualquier usuario (queda pendiente de aprobación). */}
                    <button
                        onClick={() => setShowTemplateModal(true)}
                        className="shrink-0 whitespace-nowrap flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-extrabold bg-blue-600 hover:bg-blue-500 text-white border border-blue-400/30 shadow transition-colors"
                        title="Crear una nueva incorporación de activos"
                    >
                        <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" /></svg>
                        Crear Nueva Incorporación
                    </button>
                    {/* Bandeja de aprobaciones: visible para todos los usuarios. */}
                    <button
                        onClick={() => setVerSolicitudes(v => !v)}
                        className={`shrink-0 whitespace-nowrap flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-extrabold border transition-colors ${verSolicitudes
                            ? 'bg-amber-500 border-amber-600 text-black shadow'
                            : (theme==='dark' ? 'bg-amber-500/15 border-amber-500/40 text-amber-300 hover:bg-amber-500/25' : 'bg-amber-50 border-amber-300 text-amber-800 hover:bg-amber-100')}`}
                        title="Ver las incorporaciones creadas que están pendientes de aprobación"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                        {verSolicitudes ? 'Ver Aprobados' : 'Nuevas Solicitudes'}
                        {numSolicitudes > 0 && (
                            <span className={`ml-1 min-w-[20px] text-center px-1.5 py-0.5 rounded-full text-[10px] font-black ${verSolicitudes ? 'bg-black/80 text-amber-300' : 'bg-red-600 text-white'}`}>{numSolicitudes}</span>
                        )}
                    </button>
                    <label className={`flex items-center gap-2 text-sm font-bold cursor-pointer border px-3 py-2 rounded-lg shrink-0 whitespace-nowrap ${theme==='dark'?'bg-slate-950/85 border-slate-800':'bg-slate-100 border-slate-300'}`}>
                        <input type="checkbox" checked={filtroAlerta} onChange={(e) => setFiltroAlerta(e.target.checked)} className="accent-yellow-500" /> Solo con Alertas
                    </label>
                </div>
            </div>

            {/* Tabla o mensaje */}
            {filtrados.length === 0 ? (
                <div className={`text-center py-20 rounded-3xl border ${cardClass}`}>
                    <h3 className="text-2xl font-normal mb-2">{verSolicitudes ? 'No hay solicitudes pendientes de aprobación' : 'No hay Incorporaciones Disponibles'}</h3>
                    {verSolicitudes && <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Cuando alguien cree una nueva incorporación, aparecerá aquí para su aprobación.</p>}
                </div>
            ) : (
                <div className={`rounded-3xl border ${cardClass}`}>
                    <div className="overflow-x-clip">
                        <table className="checklist-table w-full text-left border-separate border-spacing-0">
                            <thead className={`sticky top-0 z-10 shadow-sm`}>
                                <tr className={`${theme==='dark'?'text-white':'text-slate-900'} text-xs uppercase font-extrabold tracking-wider`}>
                                    <FilterableHeader {...propsFiltroColumna(COLUMN_FILTERS[0])} extraClass="rounded-tl-3xl" />
                                    <FilterableHeader {...propsFiltroColumna(COLUMN_FILTERS[1])} />
                                    <FilterableHeader {...propsFiltroColumna(COLUMN_FILTERS[2])} />
                                    <FilterableHeader {...propsFiltroColumna(COLUMN_FILTERS[3])} visibilityClass="hidden lg:table-cell" />
                                    <FilterableHeader {...propsFiltroColumna(COLUMN_FILTERS[4])} visibilityClass="hidden xl:table-cell" />
                                    <FilterableHeader {...propsFiltroColumna(COLUMN_FILTERS[5])} visibilityClass="hidden md:table-cell" />
                                    <th className="compact-table-header p-2 md:p-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hidden lg:table-cell">EQ(S).</th>
                                    <th className="compact-table-header p-2 md:p-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hidden md:table-cell">FEC. INICIO</th>
                                    <th className="compact-table-header p-2 md:p-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hidden md:table-cell">FEC. FIN</th>
                                    <FilterableHeader {...propsFiltroColumna(COLUMN_FILTERS[6])} visibilityClass="hidden lg:table-cell" />
                                    <th className="compact-table-header rounded-tr-3xl p-2 md:p-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-center">ACC.</th>
                                </tr>
                            </thead>
                            <tbody className="text-[11px] md:text-sm">
                                {currentItems.map((chk) => {
                                    const promCalc = calcularEsperadoChecklist(chk);
                                    const promReal = calcularRealChecklist(chk);
                                    const isDelayed = promReal < promCalc;
                                    const hasAlerts = chk.items?.some(it => it.Alerta === "Si");
                                    const pendiente = esPendiente(chk);
                                    const rechazado = esRechazado(chk);
                                    // Los rechazados se resaltan en rojo para que el creador vea el problema.
                                    const rowClass = rechazado
                                        ? 'bg-red-500/10 hover:bg-red-500/15 border-b border-red-500/30'
                                        : pendiente
                                            ? 'bg-amber-500/10 hover:bg-amber-500/15 border-b border-amber-500/30'
                                            : 'border-b border-slate-200 dark:border-slate-800/50 hover:bg-slate-500/5';

                                    return (
                                        <tr key={chk.ID_x002d_checklist} className={`transition-colors ${rowClass}`}>
                                            <td className="p-2 md:p-3 font-bold break-words min-w-[130px] max-w-[260px] align-top" title={chk.Name}>
                                                <div className="flex flex-wrap gap-1 mb-1">
                                                    {rechazado && <span className="bg-red-600 text-white px-2 py-0.5 rounded text-[10px] font-black">NO APROBADO</span>}
                                                    {pendiente && <span className="bg-amber-500 text-black px-2 py-0.5 rounded text-[10px] font-black">PENDIENTE</span>}
                                                    {chk.Estado === 'Finalizado' && <span className="bg-green-500/20 text-green-500 dark:text-green-400 px-2 py-0.5 rounded text-[10px] font-extrabold">FINALIZADO</span>}
                                                    {hasAlerts && <span className="bg-red-500/20 text-red-500 dark:text-red-400 px-2 py-0.5 rounded text-[10px] animate-pulse">ALERTA</span>}
                                                </div>
                                                <span className="leading-snug">{chk.Name || "Sin nombre"}</span>
                                                {rechazado && chk.AprobacionComentario && (
                                                    <p className="mt-1 text-[10px] font-bold text-red-600 dark:text-red-400 normal-case">Motivo: {chk.AprobacionComentario}</p>
                                                )}
                                            </td>
                                            <td className="p-2 md:p-3">
                                                <div className="flex flex-col gap-1.5 text-xs text-slate-900 dark:text-slate-100 font-bold">
                                                    <span>Plan: <span className="font-black text-base">{promCalc}%</span></span>
                                                    <SPIBadge real={promReal} esperado={promCalc} />
                                                </div>
                                            </td>
                                            <td className="p-2 md:p-3">
                                                <div className="flex items-center gap-2 text-xs font-bold">
                                                    <span className={`font-black text-base ${isDelayed ? 'text-red-600 dark:text-red-400' : 'text-green-700 dark:text-green-400'}`}>{promReal}%</span>
                                                    {chk.Estado === 'Finalizado' && <span className="bg-green-500/20 text-green-700 dark:text-green-400 px-2 py-0.5 rounded text-[10px] font-extrabold">COMPLETADO</span>}
                                                </div>
                                            </td>
                                            <td className="p-2 md:p-3 text-xs text-slate-900 dark:text-slate-200 font-bold hidden lg:table-cell">{chk.Metadata?.gerencia || '-'}</td>
                                            <td className="p-2 md:p-3 text-xs text-slate-900 dark:text-slate-200 font-bold hidden xl:table-cell">{chk.Metadata?.superintendencia || '-'}</td>
                                            <td className="p-2 md:p-3 text-xs text-slate-900 dark:text-slate-200 font-bold hidden md:table-cell">{chk.Tipo || '-'}</td>
                                            <td className="p-2 md:p-3 text-xs text-slate-900 dark:text-slate-200 font-bold max-w-[150px] break-words hidden lg:table-cell" title={(chk.Metadata?.equipos || []).filter(Boolean).join(', ')}>
                                                {(chk.Metadata?.equipos || []).filter(Boolean).join(', ') || '-'}
                                            </td>
                                            <td className="p-2 md:p-3 text-xs text-slate-900 dark:text-slate-200 font-bold whitespace-nowrap hidden md:table-cell">{chk.Metadata?.fechaInicioDiligenciamiento || '-'}</td>
                                            <td className="p-2 md:p-3 text-xs text-slate-900 dark:text-slate-200 font-bold whitespace-nowrap hidden md:table-cell">
                                                {chk.Estado === 'Finalizado' ? (chk.Metadata?.fechaFinDiligenciamiento || '-') : 'En curso'}
                                            </td>
                                            <td className="p-2 md:p-3 hidden lg:table-cell">
                                                {chk.CreadoPor ? (
                                                    <div className="flex items-center gap-2 max-w-[210px]">
                                                        <img src={USERPHOTO(chk.CreadoPor)} onError={(e) => { e.target.src = AVATAR_FALLBACK; }} className="w-7 h-7 rounded-full border border-slate-300 dark:border-slate-700 object-cover bg-slate-200 shrink-0" alt="" />
                                                        <div className="min-w-0">
                                                            <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate" title={chk.CreadoPorNombre || chk.CreadoPor}>{chk.CreadoPorNombre || chk.CreadoPor}</p>
                                                            <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 truncate" title={chk.CreadoPor}>{chk.CreadoPor}</p>
                                                        </div>
                                                    </div>
                                                ) : esHistorico(chk) ? (
                                                    // Los checklists migrados no traen creador: se marcan como históricos.
                                                    <span
                                                        className={`inline-block px-2 py-1 rounded-lg text-[10px] font-bold border ${theme === 'dark' ? 'bg-slate-800 border-slate-600 text-slate-200' : 'bg-slate-100 border-slate-300 text-slate-700'}`}
                                                        title="Incorporación migrada de la base de datos anterior: no se conoce quién la creó."
                                                    >
                                                        Históricos
                                                    </span>
                                                ) : (
                                                    <span className="text-xs font-semibold text-slate-400">—</span>
                                                )}
                                            </td>
                                            <td className="p-2 md:p-3 text-center">
                                                <div className="flex items-center justify-center gap-2">
                                                    {chk.Estado === 'Finalizado' ? (
                                                        <button onClick={() => onView('checklist_detalle', chk.ID_x002d_checklist)} className="bg-green-500/10 hover:bg-green-500/20 text-green-600 dark:text-green-300 border border-green-500/20 px-3 md:px-4 py-2 rounded-lg font-bold text-xs transition-colors shadow-sm">
                                                            Ver
                                                        </button>
                                                    ) : (
                                                        <button onClick={() => onView('checklist_detalle', chk.ID_x002d_checklist)} className="bg-blue-600/10 hover:bg-blue-600/20 text-blue-600 dark:text-blue-300 border border-blue-500/20 px-3 md:px-4 py-2 rounded-lg font-bold text-xs transition-colors shadow-sm">
                                                            Ver / Gestionar
                                                        </button>
                                                    )}
                                                    {puedeEliminar && (
                                                        <button
                                                            onClick={() => { setChecklistAEliminar(chk); setConfirmNombre(''); }}
                                                            title="Eliminar este checklist"
                                                            aria-label={`Eliminar el checklist ${chk.Name || ''}`}
                                                            className="bg-red-600/10 hover:bg-red-600/20 text-red-600 dark:text-red-300 border border-red-500/25 p-2 rounded-lg transition-colors shadow-sm"
                                                        >
                                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {totalPages > 1 && (
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 md:px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-black/5 dark:bg-black/25">
                            <span className="text-slate-900 dark:text-slate-200 text-sm font-bold">Mostrando pág {currentPage} de {totalPages}</span>
                            <div className="flex gap-2">
                                <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="px-4 py-2 bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-white disabled:opacity-30 rounded-lg font-bold transition-colors">Anterior</button>
                                <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)} className="px-4 py-2 bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-white disabled:opacity-30 rounded-lg font-bold transition-colors">Siguiente</button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Confirmación de borrado: hay que escribir el nombre exacto del checklist. */}
            {checklistAEliminar && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-[fadeIn_0.2s_ease-out]">
                    <div className={`${theme === 'dark' ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'} border p-6 md:p-7 rounded-3xl shadow-2xl max-w-lg w-full`}>
                        <div className="flex items-start gap-3 mb-4">
                            <span className="shrink-0 w-10 h-10 rounded-full bg-red-600 flex items-center justify-center">
                                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>
                            </span>
                            <div className="min-w-0">
                                <h3 className="text-xl font-normal leading-tight">Eliminar checklist</h3>
                                <p className="text-sm font-semibold text-slate-600 dark:text-slate-300 mt-1">
                                    Esta acción es permanente: se borra el registro de SharePoint junto con sus tareas y comentarios. No se puede deshacer.
                                </p>
                            </div>
                        </div>

                        <div className={`rounded-xl border px-4 py-3 mb-4 ${theme === 'dark' ? 'bg-slate-950/60 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Checklist a eliminar</p>
                            <p className="text-sm font-bold break-words mt-1">{checklistAEliminar.Name || 'Sin nombre'}</p>
                        </div>

                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                            Para confirmar, escribe el nombre exacto del checklist:
                        </label>
                        <input
                            type="text"
                            autoFocus
                            value={confirmNombre}
                            onChange={(e) => setConfirmNombre(e.target.value)}
                            placeholder={checklistAEliminar.Name || 'Sin nombre'}
                            className={`${inputClasses} w-full mb-5`}
                        />

                        <div className="flex flex-col-reverse sm:flex-row justify-end gap-2">
                            <button
                                onClick={() => { setChecklistAEliminar(null); setConfirmNombre(''); }}
                                disabled={eliminando}
                                className={`px-5 py-2.5 rounded-lg text-sm font-bold border transition-colors disabled:opacity-40 ${theme === 'dark' ? 'bg-slate-800 hover:bg-slate-700 border-slate-600 text-white' : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-900'}`}
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleEliminarChecklist}
                                disabled={eliminando || confirmNombre.trim() !== (checklistAEliminar.Name || '').trim()}
                                className="px-5 py-2.5 rounded-lg text-sm font-bold bg-red-600 hover:bg-red-500 text-white border border-red-400/30 shadow transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                {eliminando ? 'Eliminando...' : 'Eliminar definitivamente'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showTemplateModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-[fadeIn_0.2s_ease-out]">
                    <div className={`${theme === 'dark' ? 'bg-slate-800 border-white/20 text-white' : 'bg-white border-slate-200 text-slate-900'} border p-6 md:p-8 rounded-3xl shadow-2xl max-w-5xl w-full`}>
                        <div className={`flex justify-between items-center mb-6 border-b pb-4 ${theme === 'dark' ? 'border-white/10' : 'border-slate-200'}`}>
                            <h3 className={`text-2xl font-normal ${theme === 'dark' ? 'text-yellow-400' : 'text-amber-600'}`}>Selecciona el Tipo de Checklist</h3>
                            <button onClick={() => setShowTemplateModal(false)} className={`${theme === 'dark' ? 'text-white hover:text-yellow-400' : 'text-slate-900 hover:text-amber-600'} text-2xl font-bold transition-colors`}>&times;</button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
                            <div
                                className={`${theme === 'dark' ? 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-yellow-400' : 'bg-slate-50 border-slate-200 hover:bg-slate-100 hover:border-amber-400'} border p-6 rounded-2xl cursor-pointer transition-all group flex flex-col shadow-lg`}
                                onClick={() => { setShowTemplateModal(false); onView('crear_checklist', 'proyectos'); }}
                            >
                                <div className="mb-4 group-hover:scale-110 transition-transform transform origin-left">
                                    <svg className={`w-10 h-10 ${theme === 'dark' ? 'text-yellow-400' : 'text-amber-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
                                </div>
                                <h4 className={`text-base lg:text-lg font-medium mb-3 leading-snug h-auto ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Incorporación de activos a traves de proyectos</h4>
                                <p className={`text-sm mt-auto pt-4 border-t font-bold ${theme === 'dark' ? 'text-white border-white/20' : 'text-slate-900 border-slate-300'}`}>Utiliza la plantilla con 49 items predefinidos.</p>
                            </div>
                            <div
                                className={`${theme === 'dark' ? 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-blue-400' : 'bg-slate-50 border-slate-200 hover:bg-slate-100 hover:border-blue-400'} border p-6 rounded-2xl cursor-pointer transition-all group flex flex-col shadow-lg`}
                                onClick={() => { setShowTemplateModal(false); onView('crear_checklist', 'compra_instalada'); }}
                            >
                                <div className="mb-4 group-hover:scale-110 transition-transform transform origin-left">
                                    <svg className={`w-10 h-10 ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                </div>
                                <h4 className={`text-base lg:text-lg font-medium mb-3 leading-snug h-auto ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Incorporación de activos nuevos o usados por compra instalada</h4>
                                <p className={`text-sm mt-auto pt-4 border-t font-bold ${theme === 'dark' ? 'text-white border-white/20' : 'text-slate-900 border-slate-300'}`}>Utiliza la plantilla con 61 items predefinidos.</p>
                            </div>
                            <div
                                className={`${theme === 'dark' ? 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-green-400' : 'bg-slate-50 border-slate-200 hover:bg-slate-100 hover:border-green-400'} border p-6 rounded-2xl cursor-pointer transition-all group flex flex-col shadow-lg`}
                                onClick={() => { setShowTemplateModal(false); onView('crear_checklist', 'ensamble'); }}
                            >
                                <div className="mb-4 group-hover:scale-110 transition-transform transform origin-left">
                                    <svg className={`w-10 h-10 ${theme === 'dark' ? 'text-green-400' : 'text-green-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                                </div>
                                <h4 className={`text-base lg:text-lg font-medium mb-3 leading-snug h-auto ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Incorporación de equipos mineros nuevos o usados por ensamble</h4>
                                <p className={`text-sm mt-auto pt-4 border-t font-bold ${theme === 'dark' ? 'text-white border-white/20' : 'text-slate-900 border-slate-300'}`}>Utiliza la plantilla con 67 items predefinidos.</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CheckListAll;
