import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import ReactDOM from 'react-dom';
import {
    getRequestDigest,
    getEvidenciasFolderUrl,
    ensureFolder,
    uploadFileToFolder,
    listFolderFiles,
    listFolderSubfolders,
    recycleFile,
    recycleFolder,
    moveFile,
    moveFolder,
    downloadFileContent
} from '../utils/sharepointApi';
import { AC_HOST } from '../data/constants';
import Swal from 'sweetalert2';

// ---------------------------------------------------------------------------
// File Manager tipo Drive/Dropbox para los entregables de una tarea.
// La raiz del gestor es la subcarpeta por defecto de la tarea
// ("<orden>_<descripcion>") dentro de la carpeta del checklist. Desde ahi se
// pueden crear/navegar subcarpetas, subir archivos (o carpetas completas con
// drag & drop), renombrar, mover, descargar y eliminar elementos.
// ---------------------------------------------------------------------------

// Iconos Heroicons inline (mismo patron que el resto de la app).
const Icono = {
    folder: (cls = "h-5 w-5") => (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
        </svg>
    ),
    folderOpen: (cls = "h-5 w-5") => (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
        </svg>
    ),
    file: (cls = "h-5 w-5") => (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
    ),
    image: (cls = "h-5 w-5") => (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
    ),
    pdf: (cls = "h-5 w-5") => (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
    ),
    doc: (cls = "h-5 w-5") => (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
    ),
    xls: (cls = "h-5 w-5") => (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25" />
        </svg>
    ),
    search: (cls = "h-4 w-4") => (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m21 21-4.35-4.35m1.35-5.15a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0Z" />
        </svg>
    ),
    plus: (cls = "h-4 w-4") => (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
    ),
    upload: (cls = "h-4 w-4") => (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 16V4m0 0l-4 4m4-4l4 4M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
        </svg>
    ),
    download: (cls = "h-4 w-4") => (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
    ),
    trash: (cls = "h-4 w-4") => (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
    ),
    rename: (cls = "h-4 w-4") => (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
    ),
    move: (cls = "h-4 w-4") => (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
        </svg>
    ),
    open: (cls = "h-4 w-4") => (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
        </svg>
    ),
    dots: (cls = "h-4 w-4") => (
        <svg className={cls} fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 8a2 2 0 100-4 2 2 0 000 4zm0 6a2 2 0 100-4 2 2 0 000 4zm0 6a2 2 0 100-4 2 2 0 000 4z" />
        </svg>
    ),
    chevronRight: (cls = "h-4 w-4") => (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
    ),
    close: (cls = "h-5 w-5") => (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
        </svg>
    ),
    check: (cls = "h-4 w-4") => (
        <svg className={cls} fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
    ),
    warning: (cls = "h-5 w-5") => (
        <svg className={cls} fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
        </svg>
    )
};

// Clasifica un archivo por tipo para agruparlo en el grid.
const tipoArchivo = (nombre) => {
    const ext = (nombre.split('.').pop() || '').toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(ext)) return 'imagen';
    if (['pdf'].includes(ext)) return 'pdf';
    if (['doc', 'docx', 'odt', 'rtf', 'txt'].includes(ext)) return 'documento';
    if (['xls', 'xlsx', 'csv'].includes(ext)) return 'hoja';
    return 'otro';
};

// Icono y color por tipo de archivo (para el grid agrupado).
const infoTipo = (tipo) => {
    switch (tipo) {
        case 'pdf': return { icono: Icono.pdf, color: 'text-red-500', label: 'PDF' };
        case 'documento': return { icono: Icono.doc, color: 'text-blue-500', label: 'DOC' };
        case 'hoja': return { icono: Icono.xls, color: 'text-green-600', label: 'XLS' };
        case 'imagen': return { icono: Icono.image, color: 'text-purple-500', label: 'IMG' };
        default: return { icono: Icono.file, color: 'text-slate-500', label: 'FILE' };
    }
};

// Formatea una fecha ISO a dd/mm/aaaa.
const formatearFecha = (iso) => {
    if (!iso) return '';
    try {
        const d = new Date(iso);
        return d.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch {
        return '';
    }
};

// Formatea un tamaño en bytes a KB/MB.
const formatearTamano = (bytes) => {
    if (!bytes && bytes !== 0) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const FileManager = ({
    open,
    onClose,
    checklist,
    itemId,
    orden,
    nombreSubcarpetaTarea,
    currentUser,
    puedeGestionar,
    theme,
    onEvidenciasChanged
}) => {
    // Ruta actual como arreglo de segmentos relativos a la raiz de la tarea.
    // [] = raiz (la subcarpeta por defecto de la tarea).
    const [rutaActual, setRutaActual] = useState([]);
    // Nombre real de la carpeta raiz de la tarea. Puede ser el generado por el
    // sistema ("05_Establecer Dossier...") o uno creado manualmente ("05_Dossier").
    // Se resuelve al abrir buscando por prefijo "<orden>_" en la raiz del checklist.
    const [raizNombre, setRaizNombre] = useState(nombreSubcarpetaTarea);
    const [carpetas, setCarpetas] = useState([]);
    const [archivos, setArchivos] = useState([]);
    const [legacyRaiz, setLegacyRaiz] = useState([]);
    const [cargando, setCargando] = useState(false);
    const [error, setError] = useState('');

    const [busqueda, setBusqueda] = useState('');
    const [filtroTipo, setFiltroTipo] = useState('todos');
    const [filtroFecha, setFiltroFecha] = useState('todos');

    const [menuAbierto, setMenuAbierto] = useState(null); // id del elemento con menu abierto
    const [modalAccion, setModalAccion] = useState(null); // null | 'nuevaCarpeta' | 'mover'
    const [elementoSeleccionado, setElementoSeleccionado] = useState(null); // { tipo: 'carpeta'|'archivo', ... }
    const [nuevoNombre, setNuevoNombre] = useState('');
    // Carpetas destino disponibles para la accion "Mover" (subcarpetas de la raiz).
    const [carpetasDestino, setCarpetasDestino] = useState([]);
    const [carpetaDestinoMover, setCarpetaDestinoMover] = useState('');
    // Indica que el movimiento esta en curso (deshabilita el boton y muestra spinner).
    const [moviendoElemento, setMoviendoElemento] = useState(false);

    const [isUploading, setIsUploading] = useState(false);
    const [isDragOver, setIsDragOver] = useState(false);
    const [progresoSubida, setProgresoSubida] = useState('');

    // Contador de eventos dragenter/dragleave para evitar el parpadeo del
    // dropzone: los hijos disparan dragleave/dragenter en cascada, y con un
    // contador solo se apaga el banner cuando TODOS los nodos salieron.
    const dragCounter = useRef(0);

    const fileInputRef = useRef(null);
    const menuRef = useRef(null);

    const raizUrl = useMemo(() => {
        if (!checklist?.Tipo || !checklist?.Name) return '';
        return `${getEvidenciasFolderUrl(checklist.Tipo, checklist.Name)}/${raizNombre}`;
    }, [checklist, raizNombre]);

    // URL server-relative de la carpeta actual (raiz + segmentos).
    const carpetaActualUrl = useMemo(() => {
        if (!raizUrl) return '';
        return rutaActual.length ? `${raizUrl}/${rutaActual.join('/')}` : raizUrl;
    }, [raizUrl, rutaActual]);

    // Carga carpetas y archivos de la carpeta actual.
    const cargarCarpetaActual = useCallback(async () => {
        if (!raizUrl) return;
        setCargando(true);
        setError('');
        try {
            const [subs, files] = await Promise.all([
                listFolderSubfolders(carpetaActualUrl),
                listFolderFiles(carpetaActualUrl)
            ]);
            // Id unico por elemento: ServerRelativeUrl es la unica clave
            // estable que distingue carpetas y archivos (SharePoint no
            // devuelve un campo Id en estas consultas).
            setCarpetas(subs.map(s => ({ ...s, tipo: 'carpeta', Id: `carpeta_${s.ServerRelativeUrl}` })));
            setArchivos(files.map(f => ({ ...f, tipo: 'archivo', Id: `archivo_${f.ServerRelativeUrl}` })));
        } catch (err) {
            console.error('Error cargando carpeta', err);
            setError('No se pudo cargar la carpeta. Revisa la consola.');
        } finally {
            setCargando(false);
        }
    }, [raizUrl, carpetaActualUrl]);

    // Carga los archivos legacy de la raiz del checklist que pertenecen a esta tarea.
    const cargarLegacyRaiz = useCallback(async () => {
        if (!checklist?.Tipo || !checklist?.Name) return;
        try {
            const raizChecklist = getEvidenciasFolderUrl(checklist.Tipo, checklist.Name);
            const files = await listFolderFiles(raizChecklist);
            const propios = files.filter(f =>
                (orden && f.Name.startsWith(`${orden}_`)) || f.Name.startsWith(`Evidencia_${itemId}_`)
            );
            setLegacyRaiz(propios.map(f => ({ ...f, tipo: 'archivo', Id: `legacy_${f.ServerRelativeUrl}` })));
        } catch (err) {
            console.error('Error cargando legacy raiz', err);
            setLegacyRaiz([]);
        }
    }, [checklist, orden, itemId]);

    // Al abrir el gestor (o cambiar de tarea) se carga la raiz y el legacy.
    // El reset de estado al abrir el modal es intencional (sincroniza el
    // estado interno con la apertura del gestor).
    // IMPORTANTE: solo se ejecuta cuando CAMBIA la tarea abierta (itemId) o se
    // ABRE el gestor. El polling de 20s del detalle actualiza `checklist` con
    // una nueva referencia, pero eso NO debe resetear la navegacion del gestor.
    const tareaAbiertaRef = useRef(null);
    useEffect(() => {
        const clave = open ? itemId : null;
        if (clave === tareaAbiertaRef.current) return; // misma tarea abierta: no resetear
        tareaAbiertaRef.current = clave;
        if (open && checklist?.Tipo && checklist?.Name) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setRutaActual([]);
            setBusqueda('');
            setFiltroTipo('todos');
            setFiltroFecha('todos');
            setMenuAbierto(null);
            setModalAccion(null);
            // Resuelve la carpeta real de la tarea por prefijo "<orden>_" (ej.
            // "05_Dossier" creada manualmente). Si no existe, usa el nombre
            // generado por defecto (se creara al subir el primer archivo).
            // Despues de resolver, carga el contenido de la carpeta REAL.
            (async () => {
                try {
                    const raizChecklist = getEvidenciasFolderUrl(checklist.Tipo, checklist.Name);
                    const subs = await listFolderSubfolders(raizChecklist);
                    const real = subs.find(s => s.Name.startsWith(`${orden}_`));
                    const nombreFinal = real ? real.Name : nombreSubcarpetaTarea;
                    setRaizNombre(nombreFinal);
                    // Carga el contenido de la carpeta real (evita la condicion
                    // de carrera que mostraba 'Esta carpeta esta vacia').
                    const urlReal = `${raizChecklist}/${nombreFinal}`;
                    const [subsReal, filesReal] = await Promise.all([
                        listFolderSubfolders(urlReal),
                        listFolderFiles(urlReal)
                    ]);
                    setCarpetas(subsReal.map(s => ({ ...s, tipo: 'carpeta', Id: `carpeta_${s.ServerRelativeUrl}` })));
                    setArchivos(filesReal.map(f => ({ ...f, tipo: 'archivo', Id: `archivo_${f.ServerRelativeUrl}` })));
                    setCargando(false);
                } catch (err) {
                    console.error('Error resolviendo carpeta raiz de la tarea:', err);
                    setRaizNombre(nombreSubcarpetaTarea);
                }
            })();
            cargarLegacyRaiz();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, itemId]);

    // Recarga el contenido cada vez que cambia la ruta actual (navegacion
    // por carpetas o breadcrumb). Sin esto, entrar a una subcarpeta no
    // actualizaba el contenido del modal.
    useEffect(() => {
        if (open && raizUrl) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            cargarCarpetaActual();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, raizUrl, rutaActual]);

    // Cierra el menu contextual con click fuera o Escape.
    useEffect(() => {
        const handler = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) setMenuAbierto(null);
        };
        const keyHandler = (e) => {
            if (e.key === 'Escape') {
                setMenuAbierto(null);
                if (modalAccion) setModalAccion(null);
            }
        };
        document.addEventListener('mousedown', handler);
        document.addEventListener('keydown', keyHandler);
        return () => {
            document.removeEventListener('mousedown', handler);
            document.removeEventListener('keydown', keyHandler);
        };
    }, [modalAccion]);

    // Cierra con Escape tambien el modal completo.
    useEffect(() => {
        const keyHandler = (e) => {
            if (e.key === 'Escape' && open && !modalAccion) onClose();
        };
        document.addEventListener('keydown', keyHandler);
        return () => document.removeEventListener('keydown', keyHandler);
    }, [open, modalAccion, onClose]);

    // Navega a una subcarpeta (doble clic).
    const navegarA = (sub) => {
        setRutaActual(prev => [...prev, sub.Name]);
        setMenuAbierto(null);
    };

    // Navega a un segmento del breadcrumb.
    const navegarASegmento = (idx) => {
        setRutaActual(prev => prev.slice(0, idx + 1));
        setMenuAbierto(null);
    };

    // Vuelve a la raiz de la tarea.
    const navegarRaiz = () => {
        setRutaActual([]);
        setMenuAbierto(null);
    };

    // Recarga la carpeta actual y avisa al padre que las evidencias cambiaron.
    const refrescar = useCallback(async () => {
        await cargarCarpetaActual();
        await cargarLegacyRaiz();
        if (onEvidenciasChanged) onEvidenciasChanged();
    }, [cargarCarpetaActual, cargarLegacyRaiz, onEvidenciasChanged]);

    // Crea una carpeta en la carpeta actual.
    const crearCarpeta = async () => {
        const nombre = (nuevoNombre || '').trim();
        if (!nombre) return;
        try {
            const digest = await getRequestDigest();
            await ensureFolder(`${carpetaActualUrl}/${nombre}`, digest);
            setNuevoNombre('');
            setModalAccion(null);
            await cargarCarpetaActual();
        } catch (err) {
            console.error('Error creando carpeta', err);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'No se pudo crear la carpeta.'
            });
        }
    };

    // Sanitiza un nombre de archivo/carpeta (mismo patron que el resto de la app).
    const sanitizarNombre = (texto, max = 60) =>
        (texto || '')
            .replace(/[~"#%&*:<>?/\\{|}']/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, max) || 'SinNombre';

    // Sube archivos a la carpeta actual (sin limite de tamano ni compresion).
    // La carpeta se asegura automaticamente (ensureFolder idempotente) sin
    // preguntar al usuario.
    const subirArchivos = async (files) => {
        if (!files || !files.length) return;
        if (!checklist?.Tipo || !checklist?.Name) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'No se pudo determinar el checklist para guardar la evidencia.'
            });
            return;
        }

        setIsUploading(true);
        setProgresoSubida('Preparando archivos...');
        try {
            const digest = await getRequestDigest();
            // Asegura que la carpeta actual exista (idempotente, sin errores).
            await ensureFolder(carpetaActualUrl, digest);

            const usuario = (currentUser || 'usuario').split('@')[0]
                .replace(/[~"#%&*:<>?/\\{|}']/g, '')
                .trim()
                .replace(/\s+/g, '_')
                .slice(0, 30) || 'usuario';

            const existentes = await listFolderFiles(carpetaActualUrl);
            const usados = new Set(existentes.map(f => f.Name.toLowerCase()));

            let subidos = 0;
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                setProgresoSubida(`Subiendo ${file.name} (${i + 1}/${files.length})...`);
                // Binario original: sin compresion ni redimension (calidad intacta).
                const body = await file.arrayBuffer();
                const ext = (file.name.split('.').pop() || 'dat').replace(/[^a-z0-9]/gi, '') || 'dat';

                const nombreDoc = sanitizarNombre(file.name.replace(/\.[^.]+$/, ''), 60);
                const base = `${orden}_${nombreDoc}_${usuario}`;
                let fileName = `${base}.${ext}`;
                let n = 2;
                while (usados.has(fileName.toLowerCase())) {
                    fileName = `${base}_${n}.${ext}`;
                    n++;
                }
                usados.add(fileName.toLowerCase());

                await uploadFileToFolder(carpetaActualUrl, fileName, body, digest);
                subidos++;
            }

            setProgresoSubida('');
            if (subidos > 0) {
                await refrescar();
                const Toast = Swal.mixin({
                    toast: true,
                    position: 'top-end',
                    showConfirmButton: false,
                    timer: 3000,
                    timerProgressBar: true,
                    didOpen: (toast) => {
                        toast.onmouseenter = Swal.stopTimer;
                        toast.onmouseleave = Swal.resumeTimer;
                    }
                });
                Toast.fire({
                    icon: 'success',
                    title: `${subidos} archivo${subidos !== 1 ? 's' : ''} subido${subidos !== 1 ? 's' : ''} correctamente`
                });
            }
        } catch (err) {
            console.error('Error subiendo archivos', err);
            const Toast = Swal.mixin({
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 4000,
                timerProgressBar: true
            });
            Toast.fire({
                icon: 'error',
                title: 'Error al subir archivos',
                text: err.message || 'No se pudieron subir los archivos.'
            });
        } finally {
            setIsUploading(false);
            setProgresoSubida('');
        }
    };

    // Maneja la entrada de un elemento arrastrado (contador anti-parpadeo).
    const handleDragEnter = (e) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounter.current += 1;
        if (e.dataTransfer?.items && e.dataTransfer.items.length > 0) {
            setIsDragOver(true);
        }
    };

    // Maneja la salida de un elemento arrastrado (contador anti-parpadeo).
    const handleDragLeave = (e) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounter.current -= 1;
        if (dragCounter.current <= 0) {
            dragCounter.current = 0;
            setIsDragOver(false);
        }
    };

    // Necesario para permitir el drop (sin preventDefault el navegador abre el archivo).
    const handleDragOver = (e) => {
        e.preventDefault();
        e.stopPropagation();
    };

    // Maneja el drop de archivos/carpetas.
    const handleDrop = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounter.current = 0;
        setIsDragOver(false);

        // 1) Detectar si se arrastraron carpetas completas (directorios).
        const items = Array.from(e.dataTransfer?.items || []);
        let contieneDirectorios = false;
        for (const item of items) {
            const entry = item.webkitGetAsEntry ? item.webkitGetAsEntry() : null;
            if (entry && entry.isDirectory) {
                contieneDirectorios = true;
                break;
            }
        }

        // 2) Si hay carpetas: aviso de accion no soportada + boton al repositorio.
        if (contieneDirectorios) {
            const repoUrl = `${AC_HOST}${carpetaActualUrl}`;
            Swal.fire({
                icon: 'info',
                title: 'Acción no soportada por aquí',
                html: `
                    <p class="text-sm text-gray-600 mb-3">
                        Si deseas subir carpetas completas y subcarpetas, por favor dirígete directamente al repositorio en SharePoint, donde puedes arrastrarlas de golpe con total facilidad.
                    </p>
                `,
                showCancelButton: true,
                confirmButtonText: 'Ir al repositorio',
                cancelButtonText: 'Entendido',
                confirmButtonColor: '#d97706'
            }).then(async (result) => {
                if (!result.isConfirmed) return;
                // Validar si la carpeta de la tarea existe; si no, crearla
                // automaticamente con loading antes de redirigir.
                try {
                    // Verificar existencia listando las subcarpetas del padre
                    // (evita el GET directo que genera HTTP 404 en consola).
                    const nombreCarpeta = carpetaActualUrl.substring(carpetaActualUrl.lastIndexOf('/') + 1);
                    const padreUrl = carpetaActualUrl.substring(0, carpetaActualUrl.lastIndexOf('/'));
                    const subs = await listFolderSubfolders(padreUrl);
                    const existe = subs.some(s => s.Name === nombreCarpeta);
                    if (!existe) {
                        // No existe: loading + crear carpeta de entregables.
                        Swal.fire({
                            title: 'Creando carpeta de entregables...',
                            html: 'Preparando el repositorio de esta tarea...',
                            allowOutsideClick: false,
                            allowEscapeKey: false,
                            showConfirmButton: false,
                            didOpen: () => Swal.showLoading()
                        });
                        const digest = await getRequestDigest();
                        await ensureFolder(carpetaActualUrl, digest);
                        await Swal.close();
                    }
                } catch (err) {
                    console.error('Error verificando/creando carpeta:', err);
                }
                window.open(repoUrl, '_blank');
            });
            return;
        }

        // 3) Si son solo archivos individuales o multiples, subida normal.
        const files = Array.from(e.dataTransfer?.files || []);
        if (files.length === 0) return;
        await subirArchivos(files);
    };

    // Abre un archivo en pestaña nueva (previsualizar en SharePoint).
    const abrirArchivo = (archivo) => {
        window.open(`${AC_HOST}${archivo.ServerRelativeUrl}`, '_blank');
        setMenuAbierto(null);
    };

    // Descarga real: $value -> Blob -> <a download>. Fallback a ?download=1.
    const descargarArchivo = async (archivo) => {
        setMenuAbierto(null);
        try {
            const blob = await downloadFileContent(archivo.ServerRelativeUrl);
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = archivo.Name;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        } catch (err) {
            console.error('Error descargando archivo', err);
            // Fallback: forzar descarga nativa de SharePoint.
            window.open(`${AC_HOST}${archivo.ServerRelativeUrl}?download=1`, '_blank');
        }
    };

    // Abre el modal de mover y carga las carpetas destino disponibles.
    const abrirMover = async (el) => {
        setElementoSeleccionado(el);
        setCarpetaDestinoMover('');
        setModalAccion('mover');
        setMenuAbierto(null);
        try {
            // Lista las subcarpetas de la raiz de la tarea (1 nivel).
            const subs = await listFolderSubfolders(raizUrl);
            setCarpetasDestino(subs.map(s => ({ nombre: s.Name, ruta: s.Name })));
        } catch (err) {
            console.error('Error cargando carpetas destino', err);
            setCarpetasDestino([]);
        }
    };

    // Ejecuta el movimiento del elemento a la carpeta destino seleccionada.
    const ejecutarMover = async () => {
        const el = elementoSeleccionado;
        if (!el || moviendoElemento) return;
        try {
            setMoviendoElemento(true);
            const digest = await getRequestDigest();
            const destinoUrl = carpetaDestinoMover
                ? `${raizUrl}/${carpetaDestinoMover}`
                : raizUrl;

            // Validacion: el destino debe ser distinto de la carpeta actual.
            const carpetaActualEl = el.ServerRelativeUrl.substring(0, el.ServerRelativeUrl.lastIndexOf('/'));
            if (carpetaActualEl === destinoUrl) {
                Swal.fire({
                    icon: 'warning',
                    title: 'Misma carpeta',
                    text: 'El elemento ya está en esa carpeta.'
                });
                return;
            }

            if (el.tipo === 'carpeta') {
                await moveFolder(el.ServerRelativeUrl, destinoUrl, digest);
            } else {
                await moveFile(el.ServerRelativeUrl, destinoUrl, digest);
            }
            setModalAccion(null);
            await refrescar();
            const Toast = Swal.mixin({
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 3000,
                timerProgressBar: true,
                didOpen: (toast) => {
                    toast.onmouseenter = Swal.stopTimer;
                    toast.onmouseleave = Swal.resumeTimer;
                }
            });
            Toast.fire({
                icon: 'success',
                title: 'Elemento movido correctamente'
            });
        } catch (err) {
            console.error('Error moviendo', err);
            Swal.fire({
                icon: 'error',
                title: 'Error al mover',
                text: err.message || 'No se pudo mover. Revisa la consola.'
            });
        } finally {
            setMoviendoElemento(false);
        }
    };

    // Abre el modal de confirmar eliminacion (SweetAlert2).
    const abrirEliminar = async (el) => {
        setMenuAbierto(null);
        const esCarpeta = el.tipo === 'carpeta';
        // Paso 1: modal moderno de confirmacion.
        const result = await Swal.fire({
            title: esCarpeta ? '¿Eliminar carpeta?' : '¿Eliminar evidencia?',
            text: esCarpeta
                ? 'Esta acción moverá la carpeta y todo su contenido a la papelera de SharePoint. ¿Deseas continuar?'
                : 'Esta acción moverá el archivo a la papelera de SharePoint. ¿Deseas continuar?',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#dc2626',
            cancelButtonColor: '#64748b',
            confirmButtonText: 'Sí, eliminar',
            cancelButtonText: 'Cancelar',
            reverseButtons: true,
            focusCancel: true
        });
        if (!result.isConfirmed) return;

        try {
            const digest = await getRequestDigest();
            if (esCarpeta) {
                await recycleFolder(el.ServerRelativeUrl, digest);
            } else {
                await recycleFile(el.ServerRelativeUrl, digest);
            }
            await refrescar();

            // Paso 2: toast de exito.
            const Toast = Swal.mixin({
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 3000,
                timerProgressBar: true,
                didOpen: (toast) => {
                    toast.onmouseenter = Swal.stopTimer;
                    toast.onmouseleave = Swal.resumeTimer;
                }
            });
            Toast.fire({
                icon: 'success',
                title: esCarpeta ? 'Carpeta eliminada correctamente' : 'Evidencia eliminada correctamente'
            });
        } catch (err) {
            console.error('Error eliminando', err);
            Swal.fire({
                icon: 'error',
                title: 'Error al eliminar',
                text: err.message || 'No se pudo eliminar el archivo'
            });
        }
    };

    // Filtra archivos por busqueda, tipo y fecha.
    const archivosFiltrados = useMemo(() => {
        let lista = archivos;
        if (busqueda.trim()) {
            const q = busqueda.trim().toLowerCase();
            lista = lista.filter(f => f.Name.toLowerCase().includes(q));
        }
        if (filtroTipo !== 'todos') {
            lista = lista.filter(f => tipoArchivo(f.Name) === filtroTipo);
        }
        if (filtroFecha !== 'todos') {
            // El filtro por fecha depende del momento actual; es un caso
            // legitimo de valor "impuro" dentro del memo.
            // eslint-disable-next-line react-hooks/purity
            const ahora = Date.now();
            const dias = filtroFecha === 'hoy' ? 1 : filtroFecha === '7d' ? 7 : 30;
            const limite = ahora - dias * 24 * 60 * 60 * 1000;
            lista = lista.filter(f => {
                const t = f.TimeCreated ? new Date(f.TimeCreated).getTime() : 0;
                return t >= limite;
            });
        }
        return lista;
    }, [archivos, busqueda, filtroTipo, filtroFecha]);

    // Agrupa los archivos filtrados por tipo para el grid.
    const gruposArchivos = useMemo(() => {
        const grupos = [];
        const ordenTipos = ['imagen', 'pdf', 'documento', 'hoja', 'otro'];
        const labels = { imagen: 'IMÁGENES', pdf: 'PDF', documento: 'DOCUMENTOS', hoja: 'HOJAS DE CÁLCULO', otro: 'OTROS' };
        for (const tipo of ordenTipos) {
            const items = archivosFiltrados.filter(f => tipoArchivo(f.Name) === tipo);
            if (items.length) grupos.push({ tipo, label: labels[tipo], items });
        }
        return grupos;
    }, [archivosFiltrados]);

    // Carpetas filtradas por busqueda.
    const carpetasFiltradas = useMemo(() => {
        if (!busqueda.trim()) return carpetas;
        const q = busqueda.trim().toLowerCase();
        return carpetas.filter(c => c.Name.toLowerCase().includes(q));
    }, [carpetas, busqueda]);

    // Legacy filtrado por busqueda.
    const legacyFiltrado = useMemo(() => {
        if (!busqueda.trim()) return legacyRaiz;
        const q = busqueda.trim().toLowerCase();
        return legacyRaiz.filter(f => f.Name.toLowerCase().includes(q));
    }, [legacyRaiz, busqueda]);

    // Renderiza el menu contextual de un elemento.
    const renderMenu = (el) => {
        if (menuAbierto !== el.Id) return null;
        const esCarpeta = el.tipo === 'carpeta';
        return (
            <div
                ref={menuRef}
                className={`absolute right-0 top-8 z-30 w-48 rounded-lg border shadow-2xl py-1 text-xs font-semibold animate-[fadeIn_0.15s_ease-out] ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-white border-slate-200 text-slate-900'}`}
                onClick={(e) => e.stopPropagation()}
            >
                {esCarpeta ? (
                    <>
                        <button onClick={() => navegarA(el)} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-left">
                            {Icono.open()} Abrir
                        </button>
                        {puedeGestionar && (
                            <button onClick={() => abrirMover(el)} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-left">
                                {Icono.move()} Mover
                            </button>
                        )}
                        {puedeGestionar && (
                            <div className="border-t border-slate-200 dark:border-slate-700 my-1" />
                        )}
                        {puedeGestionar && (
                            <button onClick={() => abrirEliminar(el)} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-red-500/10 text-red-600 dark:text-red-400 transition-colors text-left">
                                {Icono.trash()} Eliminar
                            </button>
                        )}
                    </>
                ) : (
                    <>
                        <button onClick={() => abrirArchivo(el)} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-left">
                            {Icono.open()} Abrir
                        </button>
                        <button onClick={() => descargarArchivo(el)} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-left">
                            {Icono.download()} Descargar
                        </button>
                        {puedeGestionar && (
                            <button onClick={() => abrirMover(el)} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-left">
                                {Icono.move()} Mover
                            </button>
                        )}
                        {puedeGestionar && (
                            <div className="border-t border-slate-200 dark:border-slate-700 my-1" />
                        )}
                        {puedeGestionar && (
                            <button onClick={() => abrirEliminar(el)} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-red-500/10 text-red-600 dark:text-red-400 transition-colors text-left">
                                {Icono.trash()} Eliminar
                            </button>
                        )}
                    </>
                )}
            </div>
        );
    };

    // Renderiza un elemento del grid (carpeta o archivo).
    const renderElemento = (el) => {
        const esCarpeta = el.tipo === 'carpeta';
        const info = esCarpeta ? null : infoTipo(tipoArchivo(el.Name));
        return (
            <div
                key={el.Id}
                className={`relative group border rounded-lg p-2 transition-all duration-200 ${theme === 'dark' ? 'bg-slate-900 border-slate-800 hover:border-slate-600' : 'bg-white border-slate-200 hover:border-slate-400'} ${esCarpeta ? 'cursor-pointer' : ''}`}
                onDoubleClick={() => esCarpeta && navegarA(el)}
                title={esCarpeta ? `Doble clic para abrir ${el.Name}` : el.Name}
            >
                <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2 min-w-0">
                        {esCarpeta ? (
                            <span className="text-amber-500 shrink-0">{Icono.folder('h-8 w-8')}</span>
                        ) : (
                            // Icono generico segun extension (sin cargar el
                            // contenido real del archivo: navegacion ligera).
                            <span className={`${info.color} shrink-0`}>{info.icono('h-8 w-8')}</span>
                        )}
                        <div className="min-w-0">
                            <div className="text-xs font-bold truncate max-w-[130px]">{el.Name}</div>
                            {!esCarpeta && (
                                <div className="text-[9px] text-slate-500 dark:text-slate-400">
                                    {formatearFecha(el.TimeCreated)} {el.Length ? `· ${formatearTamano(el.Length)}` : ''}
                                </div>
                            )}
                        </div>
                    </div>
                    <button
                        onClick={(e) => { e.stopPropagation(); setMenuAbierto(menuAbierto === el.Id ? null : el.Id); }}
                        className={`p-1 rounded-full transition-colors ${theme === 'dark' ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}
                    >
                        {Icono.dots('h-4 w-4')}
                    </button>
                </div>
                {renderMenu(el)}
            </div>
        );
    };

    // Renderiza el modal interno (nueva carpeta / renombrar / mover / confirmar).
    const renderModalAccion = () => {
        if (!modalAccion) return null;
        const el = elementoSeleccionado;
        const cardClass = theme === 'dark'
            ? 'bg-slate-800 border-white/20 text-white'
            : 'bg-white border-slate-200 text-slate-900';
        return (
            <div
                className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-[fadeIn_0.15s_ease-out]"
                onClick={() => setModalAccion(null)}
            >
                <div className={`${cardClass} border p-6 rounded-2xl max-w-md w-full shadow-2xl`} onClick={(e) => e.stopPropagation()}>
                    {modalAccion === 'nuevaCarpeta' && (
                        <>
                            <h3 className="text-lg font-medium text-amber-400 mb-3">Nueva carpeta</h3>
                            <input
                                type="text"
                                autoFocus
                                placeholder="Nombre de la carpeta"
                                className={`w-full rounded border px-3 py-2 outline-none text-sm font-semibold mb-4 ${theme === 'dark' ? 'bg-slate-950/60 text-white border-slate-700 focus:border-yellow-400' : 'bg-slate-100/90 text-slate-900 border-slate-300 focus:border-yellow-500'}`}
                                value={nuevoNombre}
                                onChange={(e) => setNuevoNombre(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && crearCarpeta()}
                            />
                            <div className="flex gap-2 justify-end">
                                <button onClick={() => setModalAccion(null)} className="bg-white/10 hover:bg-white/20 text-white font-bold px-4 py-2 rounded-lg text-sm transition-colors border border-white/20">Cancelar</button>
                                <button onClick={crearCarpeta} className="bg-amber-600 hover:bg-amber-500 text-white font-bold px-4 py-2 rounded-lg text-sm transition-colors border border-amber-400/30">Crear</button>
                            </div>
                        </>
                    )}

                    {modalAccion === 'mover' && el && (
                        <>
                            <h3 className="text-lg font-medium text-amber-400 mb-3">Mover {el.tipo === 'carpeta' ? 'carpeta' : 'archivo'}</h3>
                            <p className="text-xs text-slate-400 font-semibold mb-2">Destino (relativo a la raíz de la tarea):</p>
                            <select
                                className={`w-full rounded border px-3 py-2 outline-none text-sm font-semibold mb-4 ${theme === 'dark' ? 'bg-slate-950/60 text-white border-slate-700' : 'bg-slate-100/90 text-slate-900 border-slate-300'}`}
                                value={carpetaDestinoMover}
                                onChange={(e) => setCarpetaDestinoMover(e.target.value)}
                                disabled={moviendoElemento}
                            >
                                <option value="">Raíz de la tarea</option>
                                {carpetasDestino
                                    .filter(c => c.ruta !== (el.tipo === 'carpeta' ? el.Name : null))
                                    .map(c => (
                                        <option key={c.ruta} value={c.ruta}>{c.nombre}</option>
                                    ))}
                            </select>
                            {/* Indicador de movimiento en curso */}
                            {moviendoElemento && (
                                <div className="flex items-center gap-2 text-[11px] font-bold text-amber-600 dark:text-yellow-400 mb-4">
                                    <span className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin shrink-0" />
                                    Moviendo elemento...
                                </div>
                            )}
                            <div className="flex gap-2 justify-end">
                                <button
                                    onClick={() => setModalAccion(null)}
                                    disabled={moviendoElemento}
                                    className="bg-white/10 hover:bg-white/20 text-white font-bold px-4 py-2 rounded-lg text-sm transition-colors border border-white/20 disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={ejecutarMover}
                                    disabled={moviendoElemento}
                                    className="flex items-center gap-2 bg-amber-600 hover:bg-amber-500 text-white font-bold px-4 py-2 rounded-lg text-sm transition-colors border border-amber-400/30 disabled:opacity-50 disabled:cursor-wait"
                                >
                                    {moviendoElemento && (
                                        <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    )}
                                    {moviendoElemento ? 'Moviendo...' : 'Mover'}
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        );
    };

    if (!open) return null;

    const inputCls = theme === 'dark'
        ? 'bg-slate-950/60 text-white border-slate-700 focus:border-yellow-400'
        : 'bg-slate-100/90 text-slate-900 border-slate-300 focus:border-yellow-500';

    return ReactDOM.createPortal(
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 animate-[fadeIn_0.15s_ease-out]"
            onClick={onClose}
        >
            <div
                className={`w-full max-w-6xl min-h-[500px] max-h-[90vh] overflow-y-auto rounded-3xl border shadow-2xl relative flex flex-col ${theme === 'dark' ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'}`}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className={`flex items-center justify-between px-6 py-4 border-b ${theme === 'dark' ? 'border-slate-800' : 'border-slate-200'}`}>
                    <div className="flex items-center gap-3">
                        <span className="text-amber-500">{Icono.folderOpen('h-6 w-6')}</span>
                        <div>
                            <h2 className="text-lg font-bold leading-tight">Gestor de Entregables</h2>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">
                                Tarea {orden} · {raizNombre}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className={`p-2 rounded-full transition-colors ${theme === 'dark' ? 'hover:bg-white/10 text-white' : 'hover:bg-slate-100 text-slate-900'}`}
                    >
                        {Icono.close('h-6 w-6')}
                    </button>
                </div>

                {/* Toolbar */}
                <div className={`px-6 py-3 border-b space-y-3 ${theme === 'dark' ? 'border-slate-800' : 'border-slate-200'}`}>
                    {/* Breadcrumb */}
                    <div className="flex items-center gap-1 flex-wrap text-xs font-bold">
                        <button onClick={navegarRaiz} className={`px-2 py-1 rounded transition-colors ${rutaActual.length === 0 ? (theme === 'dark' ? 'bg-yellow-500/15 text-yellow-400' : 'bg-yellow-500/15 text-amber-600') : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
                            {raizNombre}
                        </button>
                        {rutaActual.map((seg, idx) => (
                            <React.Fragment key={idx}>
                                <span className="text-slate-400">{Icono.chevronRight('h-3 w-3')}</span>
                                <button
                                    onClick={() => navegarASegmento(idx)}
                                    className={`px-2 py-1 rounded transition-colors ${idx === rutaActual.length - 1 ? (theme === 'dark' ? 'bg-yellow-500/15 text-yellow-400' : 'bg-yellow-500/15 text-amber-600') : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                                >
                                    {seg}
                                </button>
                            </React.Fragment>
                        ))}
                    </div>

                    {/* Busqueda + filtros + acciones */}
                    <div className="flex flex-wrap items-center gap-2">
                        <div className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 flex-1 min-w-[200px] ${inputCls}`}>
                            <span className="text-slate-400">{Icono.search()}</span>
                            <input
                                type="text"
                                placeholder="Buscar archivos o carpetas..."
                                className="w-full bg-transparent outline-none text-sm font-semibold"
                                value={busqueda}
                                onChange={(e) => setBusqueda(e.target.value)}
                            />
                        </div>
                        <select
                            className={`rounded-lg border px-2 py-1.5 text-xs font-bold outline-none ${inputCls}`}
                            value={filtroTipo}
                            onChange={(e) => setFiltroTipo(e.target.value)}
                        >
                            <option value="todos">Todos los tipos</option>
                            <option value="imagen">Imágenes</option>
                            <option value="pdf">PDF</option>
                            <option value="documento">Documentos</option>
                            <option value="hoja">Hojas de cálculo</option>
                            <option value="otro">Otros</option>
                        </select>
                        <select
                            className={`rounded-lg border px-2 py-1.5 text-xs font-bold outline-none ${inputCls}`}
                            value={filtroFecha}
                            onChange={(e) => setFiltroFecha(e.target.value)}
                        >
                            <option value="todos">Cualquier fecha</option>
                            <option value="hoy">Hoy</option>
                            <option value="7d">Últimos 7 días</option>
                            <option value="30d">Últimos 30 días</option>
                        </select>
                        {puedeGestionar && (
                            <>
                                <button
                                    onClick={() => { setNuevoNombre(''); setModalAccion('nuevaCarpeta'); }}
                                    className="flex items-center gap-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold px-3 py-1.5 text-xs transition-colors border border-amber-400/30"
                                >
                                    {Icono.plus()} Nueva carpeta
                                </button>
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={isUploading}
                                    className="flex items-center gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold px-3 py-1.5 text-xs transition-colors border border-blue-400/30 disabled:opacity-50 disabled:cursor-wait"
                                >
                                    {Icono.upload()} Subir
                                </button>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    multiple
                                    className="hidden"
                                    onChange={(e) => { subirArchivos(Array.from(e.target.files || [])); e.target.value = ''; }}
                                    accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
                                />
                            </>
                        )}
                    </div>
                </div>

                {/* Cuerpo */}
                <div
                    className={`flex-1 p-6 overflow-y-auto ${isDragOver ? (theme === 'dark' ? 'bg-slate-800/50' : 'bg-slate-50') : ''}`}
                    onDragEnter={handleDragEnter}
                    onDragLeave={handleDragLeave}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                >
                    {cargando ? (
                        <div className="flex items-center justify-center py-16">
                            <span className="text-yellow-500 text-sm font-semibold animate-pulse">Cargando...</span>
                        </div>
                    ) : error ? (
                        <div className="text-center py-16">
                            <p className="text-red-500 text-sm font-bold">{error}</p>
                        </div>
                    ) : (
                        <>
                            {/* Zona drag & drop */}
                            {isDragOver && (
                                <div className={`pointer-events-none border-2 border-dashed rounded-xl p-8 mb-4 text-center ${theme === 'dark' ? 'border-yellow-400/50 text-yellow-400' : 'border-amber-500/50 text-amber-600'}`}>
                                    <p className="pointer-events-none text-sm font-bold">Suelta los archivos o carpetas aquí</p>
                                </div>
                            )}

                            {isUploading && (
                                <div className="mb-4 flex items-center gap-2 text-yellow-500 text-xs font-semibold">
                                    <span className="w-4 h-4 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
                                    {progresoSubida || 'Subiendo...'}
                                </div>
                            )}

                            {/* Carpetas */}
                            {carpetasFiltradas.length > 0 && (
                                <div className="mb-6">
                                    <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2">Carpetas</h3>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                                        {carpetasFiltradas.map(renderElemento)}
                                    </div>
                                </div>
                            )}

                            {/* Archivos agrupados por tipo */}
                            {gruposArchivos.map(grupo => (
                                <div key={grupo.tipo} className="mb-6">
                                    <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2">{grupo.label}</h3>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                                        {grupo.items.map(renderElemento)}
                                    </div>
                                </div>
                            ))}

                            {/* Legacy en raiz del checklist (solo en la raiz de la tarea) */}
                            {rutaActual.length === 0 && legacyFiltrado.length > 0 && (
                                <div className="mb-6">
                                    <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2 flex items-center gap-2">
                                        Archivos anteriores (raíz del checklist)
                                        <span className="bg-amber-500/15 text-amber-600 dark:text-yellow-400 border border-amber-500/30 px-1.5 py-0.5 rounded-full text-[9px] font-black">Legacy</span>
                                    </h3>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                                        {legacyFiltrado.map(renderElemento)}
                                    </div>
                                </div>
                            )}

                            {/* Vacio */}
                            {carpetasFiltradas.length === 0 && gruposArchivos.length === 0 && legacyFiltrado.length === 0 && (
                                <div className="text-center py-16">
                                    <p className="text-slate-500 dark:text-slate-400 text-sm font-bold">
                                        {busqueda ? 'Sin resultados para la búsqueda.' : 'Esta carpeta está vacía.'}
                                    </p>
                                    {!busqueda && puedeGestionar && (
                                        <p className="text-slate-400 text-xs mt-1">Arrastra archivos aquí o usa el botón "Subir".</p>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className={`px-6 py-3 border-t flex items-center justify-between text-[10px] font-semibold ${theme === 'dark' ? 'border-slate-800 text-slate-400' : 'border-slate-200 text-slate-500'}`}>
                    <span>{carpetas.length} carpetas · {archivos.length} archivos</span>
                    <span className="flex items-center gap-1">
                        {Icono.check('h-3 w-3 text-green-500')} Guardado en SharePoint
                    </span>
                </div>
            </div>

            {renderModalAccion()}
        </div>,
        document.body
    );
};

export default FileManager;