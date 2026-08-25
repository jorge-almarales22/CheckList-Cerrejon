import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { esPendiente, esRechazado, esHistorico, esHistoricoGestionado, marcarHistoricoGestionado, getEstadoTarea, getCorresponsable, puedeGestionarTarea, puedeAsignarCorresponsable, mismoUsuario } from '../utils/calculations';
import { notificarTeams } from '../utils/notifications';
import { getRequestDigest, updateSPListItem, deleteSPListItem, getEvidenciasFolderUrl, ensureFolder, uploadFileToFolder, listFolderFiles, recycleFile, dataUrlToUint8Array, fetchJerarquiaOpciones, conValorActual, etiquetaGerencia, JERARQUIA_VACIA } from '../utils/sharepointApi';
import { comprimirImagen } from '../utils/imageCompression';
import { AC_HOST, TIPOS_CHECKLIST, getTipoChecklist } from '../data/constants';
import PeoplePicker from './PeoplePicker';
import DashboardCharts from './DashboardCharts';
import GanttChart from './GanttChart';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

// Valor centinela del filtro de responsable: no es un correo, asi que no choca
// con ningun responsable real de la lista.
const MIS_TAREAS = '__mis_tareas__';

const CheckListDetalle = ({ checklistId, onAtras, role, currentUser, theme }) => {
    const SITE_URL = "https://glencore.sharepoint.com/sites/co-lmn-sgia/checklist";

    const inputClasses = theme === 'dark'
        ? "w-full bg-slate-950/80 text-white border border-slate-800 focus:border-yellow-400 rounded px-3 py-2 outline-none transition-all duration-300"
        : "w-full bg-slate-100/90 text-slate-900 border border-slate-300 focus:border-yellow-500 rounded px-3 py-2 outline-none transition-all duration-300";

    const cardClass = theme === 'dark' 
        ? 'bg-slate-900 border-slate-800 text-slate-100 shadow-[0_0_20px_rgba(0,0,0,0.5)]' 
        : 'bg-white border-slate-200 text-slate-900 shadow-md shadow-slate-100';

    const [checklist, setChecklist] = useState(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState('');
    const [editingId, setEditingId] = useState(null);
    const [editForm, setEditForm] = useState({});
    const [backupItem, setBackupItem] = useState(null);
    const [generalComment, setGeneralComment] = useState('');
    const [nuevosComentarios, setNuevosComentarios] = useState({});
    const [evidenciasItem, setEvidenciasItem] = useState({});
    const [cargandoEvidencias, setCargandoEvidencias] = useState({});
    const [isUploading, setIsUploading] = useState(false);

    const [inactivatingItemId, setInactivatingItemId] = useState(null);
    const [inactivateReasonText, setInactivateReasonText] = useState('');
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [rejectComment, setRejectComment] = useState('');

    const [filterResponsable, setFilterResponsable] = useState('');
    const [filterAlertaOnly, setFilterAlertaOnly] = useState(false);
    const [filterEstadoTarea, setFilterEstadoTarea] = useState(''); // '', 'terminadas', 'faltantes'
    const [fotoActivaIdx, setFotoActivaIdx] = useState(0); // carrusel de fotos del equipo
    // Visor de fotos a pantalla completa: { fotos: [...], idx } o null si esta cerrado.
    // Guarda la lista y no solo el indice porque tambien se abre desde el modo
    // edicion, donde las fotos son las del formulario y no las ya guardadas.
    const [fotoModal, setFotoModal] = useState(null);
    const abrirVisorFotos = (fotos, idx) => setFotoModal({ fotos, idx });

    const [showAddTaskForm, setShowAddTaskForm] = useState(false);
    const [newTaskData, setNewTaskData] = useState({
        actividades: '',
        entregable: '',
        nombreResponsable: '',
        corresponsable: '',
        fechaBaselineInicio: new Date().toISOString().split('T')[0],
        fechaBaselineFin: ''
    });

    // Id de la tarea donde el usuario intentó pasar del 90% sin evidencias. Sirve
    // para explicarle en pantalla por qué el número se le devuelve a 90: antes el
    // tope se aplicaba en silencio y nadie entendía qué estaba pasando.
    const [avisoTope, setAvisoTope] = useState(null);

    const [modalEvidences, setModalEvidences] = useState(null);
    const [activeEvidenciaIndex, setActiveEvidenciaIndex] = useState(0);

    const [showGanttModal, setShowGanttModal] = useState(false);
    const [evidenciasPresence, setEvidenciasPresence] = useState({});

    // Unidades de proceso: siguen saliendo de la lista EquiposAC.
    const [acData, setAcData] = useState({ unidades: [] });
    const [acLoading, setAcLoading] = useState(true);
    // Area (por rol), Gerencia y Superintendencia salen de la lista JerarquiaL.
    const [jerarquia, setJerarquia] = useState(JERARQUIA_VACIA);
    const [jerarquiaLoading, setJerarquiaLoading] = useState(true);

    const isAdmin = role === 'Administrador';

    // Correccion del tipo de checklist (solo admin). Ver handleConfirmCambioTipo.
    const [tipoObjetivo, setTipoObjetivo] = useState(null);
    const [cambiandoTipo, setCambiandoTipo] = useState(false);

    const [isEditingMetadata, setIsEditingMetadata] = useState(false);
    const [editMetadataForm, setEditMetadataForm] = useState(null);

    // Indica qué tareas tienen evidencias, combinando registros legacy (base64 en la
    // lista) con los archivos nuevos guardados en la carpeta del checklist.
    const fetchEvidencePresence = async (checklistData) => {
        const presenceMap = {};
        // Legacy: registros base64 aún presentes en la lista.
        try {
            const res = await fetch(`${SITE_URL}/_api/web/lists/getbytitle('EvidenciasChecklist')/items?$select=ID_Registro&$top=5000`, {
                headers: { "Accept": "application/json;odata=verbose" }, credentials: "same-origin"
            });
            const json = await res.json();
            (json.d?.results || []).forEach(r => {
                if (r.ID_Registro) presenceMap[r.ID_Registro] = true;
            });
        } catch (err) {
            console.error("Error consultando presencia de evidencias (lista):", err);
        }
        // Nuevo: archivos en la carpeta de evidencias del checklist.
        try {
            if (checklistData?.Tipo && checklistData?.Name) {
                const folderUrl = getEvidenciasFolderUrl(checklistData.Tipo, checklistData.Name);
                const files = await listFolderFiles(folderUrl);
                const items = checklistData.items || [];
                files.forEach(f => {
                    // Formato anterior: "Evidencia_<idTarea>_..."
                    const viejo = f.Name.match(/^Evidencia_([^_]+)_/);
                    if (viejo) {
                        presenceMap[viejo[1]] = true;
                        return;
                    }
                    // Formato actual: "<orden>_<responsable>_<AAAAMMDD>"
                    const nuevo = f.Name.match(/^(\d+)_/);
                    if (nuevo) {
                        const tarea = items[parseInt(nuevo[1], 10) - 1];
                        if (tarea) presenceMap[tarea.Id] = true;
                    }
                });
            }
        } catch (err) {
            console.error("Error consultando presencia de evidencias (carpeta):", err);
        }
        setEvidenciasPresence(presenceMap);
    };

    const editingIdRef = useRef(editingId);
    useEffect(() => {
        editingIdRef.current = editingId;
    }, [editingId]);

    // El visualizador de evidencias tambien se cierra con Esc.
    useEffect(() => {
        if (!modalEvidences) return;
        const onKeyDown = (e) => {
            if (e.key === 'Escape') setModalEvidences(null);
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [modalEvidences]);

    // Fotos de los equipos que se estan incorporando. Se admite el formato viejo
    // (una sola foto en "imagenEquipo") para no perder los checklist antiguos.
    const fotosEquipo = (checklist?.Metadata?.imagenesEquipo?.length > 0)
        ? checklist.Metadata.imagenesEquipo
        : (checklist?.Metadata?.imagenEquipo ? [checklist.Metadata.imagenEquipo] : []);

    // Visor de fotos del equipo: Esc cierra y las flechas navegan.
    useEffect(() => {
        if (!fotoModal) return;
        const total = fotoModal.fotos.length;
        const onKeyDown = (e) => {
            if (e.key === 'Escape') setFotoModal(null);
            if (total > 1 && e.key === 'ArrowRight') setFotoModal(p => ({ ...p, idx: (p.idx + 1) % total }));
            if (total > 1 && e.key === 'ArrowLeft') setFotoModal(p => ({ ...p, idx: (p.idx - 1 + total) % total }));
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [fotoModal]);

    useEffect(() => {
        const fetchDetails = async (isBackgroundPoll = false) => {
            if (!/^[A-Za-z0-9._-]{1,100}$/.test(String(checklistId || ''))) {
                setLoadError('El enlace de la incorporación no es válido.');
                setLoading(false);
                return;
            }
            try {
                const safeChecklistId = String(checklistId).replace(/'/g, "''");
                const listRes = await fetch(`${SITE_URL}/_api/web/lists/getbytitle('DB_CHECKLIST_APP')/items?$filter=Title eq '${safeChecklistId}'`, {
                    headers: { "Accept": "application/json;odata=verbose" }, credentials: "same-origin"
                });
                if (!listRes.ok) throw new Error(`HTTP ${listRes.status} cargando el checklist`);
                const listJson = await listRes.json();

                if (listJson.d.results.length > 0) {
                    const row = listJson.d.results[0];
                    const parsedData = JSON.parse(row.Data);
                    
                    if (isBackgroundPoll) {
                        setChecklist(prevChecklist => {
                            if (!prevChecklist) return { ...parsedData, SharePointId: row.Id };
                            const mergedItems = parsedData.items.map(newItem => {
                                if (editingIdRef.current === newItem.Id) {
                                    const currentEditingItem = prevChecklist.items.find(it => it.Id === newItem.Id);
                                    return currentEditingItem || newItem;
                                }
                                return newItem;
                            });
                            return {
                                ...parsedData,
                                items: mergedItems,
                                SharePointId: row.Id
                            };
                        });
                        fetchEvidencePresence(parsedData);
                    } else {
                        setChecklist({ ...parsedData, SharePointId: row.Id });
                        setGeneralComment(parsedData.ComentarioGeneral || '');
                        fetchEvidencePresence(parsedData);
                    }
                } else if (!isBackgroundPoll) {
                    setLoadError('No se encontró la incorporación solicitada o no está disponible.');
                }
            } catch (error) {
                console.error("Error loading details:", error);
                if (!isBackgroundPoll) setLoadError('No fue posible cargar la incorporación. Verifica el enlace o tu acceso a SharePoint.');
            } finally {
                if (!isBackgroundPoll) {
                    setLoading(false);
                }
            }
        };

        fetchDetails(false);

        const intervalId = setInterval(() => {
            if (document.hidden) {
                return;
            }
            fetchDetails(true);
        }, 20000);

        return () => {
            clearInterval(intervalId);
        };
    }, [checklistId]);

    useEffect(() => {
        const fetchAcList = async () => {
            try {
                const AC_SITE_URL = "https://glencore.sharepoint.com/sites/co-lmn-sgia/ac";
                const res = await fetch(`${AC_SITE_URL}/_api/web/lists/getbytitle('EquiposAC')/items?$select=UnidadProceso&$top=5000`, {
                    headers: { "Accept": "application/json;odata=verbose" },
                    credentials: 'same-origin'
                });
                const json = await res.json();
                const results = json.d?.results || [];
                const uniqueUnidades = [...new Set(results.map(r => r.UnidadProceso).filter(Boolean))].sort();
                setAcData({ unidades: uniqueUnidades });
            } catch (err) {
                console.error("Error fetching AC list:", err);
            } finally {
                setAcLoading(false);
            }
        };
        fetchAcList();
    }, []);

    useEffect(() => {
        const cargarJerarquia = async () => {
            try {
                setJerarquia(await fetchJerarquiaOpciones());
            } catch (err) {
                console.error("Error cargando JerarquiaL:", err);
            } finally {
                setJerarquiaLoading(false);
            }
        };
        cargarJerarquia();
    }, []);

    // Numero de orden de la tarea dentro del checklist (posicion estable en el
    // arreglo items). Es la primera parte del nombre de archivo de sus evidencias.
    const getOrdenTarea = (itemId, items) => {
        const lista = items || checklist?.items || [];
        const idx = lista.findIndex(i => i.Id === itemId);
        return idx >= 0 ? String(idx + 1).padStart(2, '0') : null;
    };

    // Un archivo pertenece a la tarea si empieza por su numero de orden ("06_...")
    // o por el formato anterior basado en el Id ("Evidencia_<id>_...").
    const archivoEsDeTarea = (nombre, itemId, orden) =>
        (!!orden && nombre.startsWith(`${orden}_`)) || nombre.startsWith(`Evidencia_${itemId}_`);

    const cargarEvidencias = async (itemId) => {
        setCargandoEvidencias(prev => ({ ...prev, [itemId]: true }));
        try {
            const combined = [];
            // Legacy: evidencias en base64 dentro de la lista.
            try {
                const res = await fetch(`${SITE_URL}/_api/web/lists/getbytitle('EvidenciasChecklist')/items?$filter=ID_Registro eq '${itemId}'&$select=Id,Data,Title`, {
                    headers: { "Accept": "application/json;odata=verbose" }, credentials: "same-origin"
                });
                const json = await res.json();
                (json.d?.results || []).forEach(it => combined.push({
                    Id: `list_${it.Id}`,
                    source: 'list',
                    listId: it.Id,
                    Name: it.Title,
                    Data: it.Data,
                    isImage: !!(it.Data && it.Data.startsWith('data:image'))
                }));
            } catch (error) {
                console.error("Error cargando evidencias legacy", error);
            }
            // Nuevo: archivos en la carpeta del checklist.
            try {
                if (checklist?.Tipo && checklist?.Name) {
                    const folderUrl = getEvidenciasFolderUrl(checklist.Tipo, checklist.Name);
                    const files = await listFolderFiles(folderUrl);
                    const orden = getOrdenTarea(itemId);
                    files
                        .filter(f => archivoEsDeTarea(f.Name, itemId, orden))
                        .forEach(f => combined.push({
                            Id: `file_${f.ServerRelativeUrl}`,
                            source: 'file',
                            fileRef: f.ServerRelativeUrl,
                            Name: f.Name,
                            Data: `${AC_HOST}${f.ServerRelativeUrl}`,
                            isImage: /\.(jpe?g|png|gif|webp|bmp|svg)$/i.test(f.Name)
                        }));
                }
            } catch (error) {
                console.error("Error cargando evidencias (carpeta)", error);
            }
            setEvidenciasItem(prev => ({ ...prev, [itemId]: combined }));
            setEvidenciasPresence(prev => ({ ...prev, [itemId]: combined.length > 0 }));
        } finally {
            setCargandoEvidencias(prev => ({ ...prev, [itemId]: false }));
        }
    };

    // Carga automatica de TODAS las evidencias del checklist de forma eficiente:
    // una sola lectura de la carpeta (archivos) + una lectura ligera de la lista
    // legacy, cargando el base64 solo de las tareas que realmente lo tienen.
    const cargarTodasEvidencias = async (checklistData) => {
        if (!checklistData?.Tipo || !checklistData?.Name) return;
        const items = (checklistData.items || []).filter(it => (it.Estado || it.estado) !== 'Inactivo');
        if (items.length === 0) return;
        const map = {};
        const ordenDe = (id) => {
            const idx = (checklistData.items || []).findIndex(i => i.Id === id);
            return idx >= 0 ? String(idx + 1).padStart(2, '0') : null;
        };

        // 1. Archivos de la carpeta (una sola llamada) agrupados por tarea.
        try {
            const folderUrl = getEvidenciasFolderUrl(checklistData.Tipo, checklistData.Name);
            const files = await listFolderFiles(folderUrl);
            items.forEach(it => {
                const orden = ordenDe(it.Id);
                const evs = files
                    .filter(f => archivoEsDeTarea(f.Name, it.Id, orden))
                    .map(f => ({
                        Id: `file_${f.ServerRelativeUrl}`,
                        source: 'file',
                        fileRef: f.ServerRelativeUrl,
                        Name: f.Name,
                        Data: `${AC_HOST}${f.ServerRelativeUrl}`,
                        isImage: /\.(jpe?g|png|gif|webp|bmp|svg)$/i.test(f.Name)
                    }));
                if (evs.length) map[it.Id] = evs;
            });
        } catch (err) {
            console.error("Error cargando evidencias de carpeta (todas):", err);
        }

        // 2. Presencia legacy (ligera, sin base64) para saber que tareas tienen.
        let legacyIds = new Set();
        try {
            const res = await fetch(`${SITE_URL}/_api/web/lists/getbytitle('EvidenciasChecklist')/items?$select=ID_Registro&$top=5000`, {
                headers: { "Accept": "application/json;odata=verbose" }, credentials: "same-origin"
            });
            const json = await res.json();
            (json.d?.results || []).forEach(r => { if (r.ID_Registro) legacyIds.add(String(r.ID_Registro)); });
        } catch (err) {
            console.error("Error consultando presencia legacy:", err);
        }

        // 3. Solo para las tareas de ESTE checklist que tienen legacy, traer el base64.
        for (const it of items) {
            if (!legacyIds.has(String(it.Id))) continue;
            try {
                const res = await fetch(`${SITE_URL}/_api/web/lists/getbytitle('EvidenciasChecklist')/items?$filter=ID_Registro eq '${it.Id}'&$select=Id,Data,Title`, {
                    headers: { "Accept": "application/json;odata=verbose" }, credentials: "same-origin"
                });
                const json = await res.json();
                (json.d?.results || []).forEach(l => {
                    (map[it.Id] = map[it.Id] || []).push({
                        Id: `list_${l.Id}`, source: 'list', listId: l.Id, Name: l.Title,
                        Data: l.Data, isImage: !!(l.Data && l.Data.startsWith('data:image'))
                    });
                });
            } catch (err) {
                console.error("Error cargando evidencia legacy de tarea:", err);
            }
        }

        setEvidenciasItem(prev => ({ ...prev, ...map }));
        const presence = {};
        items.forEach(it => { if (map[it.Id]?.length) presence[it.Id] = true; });
        legacyIds.forEach(id => { presence[id] = true; });
        setEvidenciasPresence(prev => ({ ...prev, ...presence }));
    };

    // Al abrir el checklist se cargan automaticamente todas sus evidencias (una vez).
    const evidenciasCargadasRef = useRef(null);
    useEffect(() => {
        if (checklist?.items && evidenciasCargadasRef.current !== checklistId) {
            evidenciasCargadasRef.current = checklistId;
            cargarTodasEvidencias(checklist);
        }
    }, [checklist, checklistId]);

    const handleFileUpload = async (itemId, e) => {
        const files = Array.from(e.target.files);
        if (!files.length) return;
        if (!checklist?.Tipo || !checklist?.Name) {
            alert('No se pudo determinar el checklist para guardar la evidencia.');
            return;
        }
        setIsUploading(true);
        try {
            const digest = await getRequestDigest();
            // Carpeta destino: /Evidencias/{Checklist Tipo}/{Nombre del Checklist}/
            const folderUrl = getEvidenciasFolderUrl(checklist.Tipo, checklist.Name);
            await ensureFolder(folderUrl, digest);

            // Nombre = "<orden>_<responsable>_<AAAAMMDD>". El orden identifica la tarea.
            const item = (checklist.items || []).find(i => i.Id === itemId);
            const orden = getOrdenTarea(itemId) || '00';
            const responsable = (item?.NombreResponsable || 'SinResponsable')
                .replace(/[~"#%&*:<>?/\\{|}']/g, '')
                .trim()
                .replace(/\s+/g, '_')
                .slice(0, 40) || 'SinResponsable';
            const fecha = new Date().toISOString().split('T')[0].replace(/-/g, '');

            // Se listan los existentes para no sobrescribir cargas del mismo dia.
            const existentes = await listFolderFiles(folderUrl);
            const usados = new Set(existentes.map(f => f.Name.toLowerCase()));

            for (let file of files) {
                let body;
                let ext;

                if (file.type.startsWith('image/')) {
                    // Se comprime la imagen y se convierte a binario para subirla como archivo.
                    const dataUrl = await comprimirImagen(file, 1024, 0.6);
                    body = dataUrlToUint8Array(dataUrl);
                    ext = 'jpg';
                } else {
                    const maxSize = 25 * 1024 * 1024;
                    if (file.size > maxSize) {
                        alert(`El archivo "${file.name}" supera el límite de 25MB.`);
                        continue;
                    }
                    body = await file.arrayBuffer();
                    ext = (file.name.split('.').pop() || 'dat').replace(/[^a-z0-9]/gi, '') || 'dat';
                }

                const base = `${orden}_${responsable}_${fecha}`;
                let fileName = `${base}.${ext}`;
                let n = 2;
                while (usados.has(fileName.toLowerCase())) {
                    fileName = `${base}_${n}.${ext}`;
                    n++;
                }
                usados.add(fileName.toLowerCase());

                await uploadFileToFolder(folderUrl, fileName, body, digest);
            }

            alert('Proceso de carga finalizado.');
            setEvidenciasPresence(prev => ({ ...prev, [itemId]: true }));
            await cargarEvidencias(itemId);
        } catch (error) {
            alert('Error subiendo evidencia. Revisa la consola.');
            console.error(error);
        } finally {
            setIsUploading(false);
        }
    };

    const eliminarEvidencia = async (itemId, ev) => {
        if (!window.confirm("¿Seguro que deseas eliminar esta evidencia?")) return;
        try {
            const digest = await getRequestDigest();
            if (ev.source === 'file') {
                await recycleFile(ev.fileRef, digest);
            } else {
                await deleteSPListItem('EvidenciasChecklist', ev.listId, digest);
            }
            await cargarEvidencias(itemId);
        } catch (error) {
            console.error("Error eliminando evidencia", error);
            alert("Fallo al eliminar.");
        }
    };

    // Una tarea puede llegar al 100% solo si ya tiene evidencias, vengan de la carga
    // de esta sesión (evidenciasItem) o de una anterior (evidenciasPresence).
    const tieneEvidencias = (itemId) =>
        (evidenciasItem[itemId] && evidenciasItem[itemId].length > 0) || !!evidenciasPresence[itemId];

    const handleStartEdit = (item) => {
        setEditingId(item.Id);
        setEditForm({ ...item });
        setAvisoTope(null);
    };

    const handleCancelEdit = () => {
        setEditingId(null);
        setEditForm({});
        setAvisoTope(null);
    };

    // ---- Flujo de aprobacion (solo admins) ----
    const cambiarAprobacion = async (nuevoEstado, comentario = '') => {
        try {
            const digest = await getRequestDigest();
            const actualizado = { ...checklist, EstadoAprobacion: nuevoEstado, AprobacionComentario: comentario };
            await updateSPListItem('DB_CHECKLIST_APP', checklist.SharePointId, { Data: JSON.stringify(actualizado) }, digest);
            setChecklist(actualizado);
            return true;
        } catch (error) {
            console.error('Error cambiando aprobacion:', error);
            alert('No se pudo actualizar el estado de aprobación.');
            return false;
        }
    };

    const handleAprobar = async () => {
        if (!window.confirm('¿Aprobar esta incorporación? Aparecerá junto con las demás y contará para las métricas.')) return;
        if (await cambiarAprobacion('Aprobado', '')) alert('Incorporación aprobada.');
    };

    const handleRechazar = async () => {
        const comentario = (rejectComment || '').trim();
        if (!comentario) { alert('Escribe el motivo del rechazo.'); return; }
        if (await cambiarAprobacion('Rechazado', comentario)) {
            setShowRejectModal(false);
            setRejectComment('');
            alert('Incorporación marcada como NO aprobada. El creador verá el motivo.');
        }
    };

    // Ruta SharePoint donde se guarda el PDF como registro documental al finalizar.
    const PDF_FOLDER_RELATIVE = '/sites/co-lmn-sgia/ac/SiteAssets/Incorporaciones/PDFs';
    const AC_SITE_URL = "https://glencore.sharepoint.com/sites/co-lmn-sgia/ac";

    // Construye el PDF del checklist a partir de un snapshot (puede ser el checklist actual
    // o uno ya finalizado). Devuelve { pdf, nombreArchivo }.
    const construirPDF = async (data) => {
        const container = document.createElement('div');
        container.style.cssText = 'position:absolute;left:-9999px;top:0;width:750px;padding:30px;font-family:sans-serif;color:#1f2937;background:#fff;';

        const titulo = document.createElement('h1');
        titulo.textContent = `Checklist: ${data.Name}`;
        titulo.style.cssText = 'font-size:24px;font-weight:800;margin-bottom:6px;color:#1e3a5f;border-bottom:3px solid #eab308;padding-bottom:10px;';
        container.appendChild(titulo);

        const meta = document.createElement('p');
        meta.style.cssText = 'font-size:11px;color:#64748b;margin-bottom:20px;';
        const tipo = data.Tipo || '';
        const fechaFin = data.Metadata?.fechaFinDiligenciamiento || new Date().toISOString().split('T')[0];
        const activas = data.items.filter(it => (it.Estado || it.estado) !== 'Inactivo');
        meta.textContent = `Tipo: ${tipo} | Finalizado: ${fechaFin} | Tareas: ${activas.length}`;
        container.appendChild(meta);

        // El numero impreso es la posicion original de la tarea en el checklist,
        // para que coincida con la pantalla y con las evidencias.
        activas.forEach((it) => {
            const card = document.createElement('div');
            card.style.cssText = 'border:2px solid #e2e8f0;border-radius:10px;padding:16px;margin-bottom:14px;background:#f8fafc;';

            const header = document.createElement('div');
            header.style.cssText = 'display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;';
            const num = document.createElement('span');
            num.style.cssText = 'background:#eab308;color:#fff;font-weight:800;font-size:11px;padding:3px 10px;border-radius:6px;flex-shrink:0;';
            num.textContent = `#${data.items.findIndex(x => x.Id === it.Id) + 1}`;
            const desc = document.createElement('span');
            desc.style.cssText = 'font-size:14px;font-weight:700;color:#1e293b;margin-left:10px;flex:1;line-height:1.4;';
            desc.textContent = it.Descripcion || '';
            header.appendChild(num);
            header.appendChild(desc);
            card.appendChild(header);

            const grid = document.createElement('div');
            grid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:11px;margin-bottom:8px;';
            const campos = [
                { label: 'Fechas Plan', val: `I: ${it.FechaBaselineInicio || '-'}  F: ${it.FechaBaselineFin || '-'}` },
                { label: 'Fechas Reales', val: `I: ${it.FechaInicio || '-'}  F: ${it.FechaFin || '-'}` },
                { label: 'Avance', val: `${it.Avance || it.avance || 0}%` },
                { label: 'Entregable', val: it.Entregable || '-' }
            ];
            campos.forEach(c => {
                const field = document.createElement('div');
                const lbl = document.createElement('span');
                lbl.style.cssText = 'font-weight:700;color:#64748b;display:block;font-size:10px;text-transform:uppercase;';
                lbl.textContent = c.label;
                const val = document.createElement('span');
                val.style.cssText = 'font-weight:600;color:#1e293b;';
                val.textContent = c.val;
                field.appendChild(lbl);
                field.appendChild(val);
                grid.appendChild(field);
            });
            card.appendChild(grid);

            if (it.HistorialComentarios && it.HistorialComentarios.length > 0) {
                const commDiv = document.createElement('div');
                commDiv.style.cssText = 'border-top:1px dashed #cbd5e1;padding-top:8px;margin-top:4px;';
                const commTitle = document.createElement('span');
                commTitle.style.cssText = 'font-weight:700;color:#64748b;font-size:10px;text-transform:uppercase;display:block;margin-bottom:4px;';
                commTitle.textContent = 'Comentarios';
                commDiv.appendChild(commTitle);
                it.HistorialComentarios.forEach(c => {
                    const cLine = document.createElement('p');
                    cLine.style.cssText = 'font-size:10px;color:#475569;margin:3px 0;padding:3px 6px;background:#fff;border-radius:4px;border:1px solid #f1f5f9;';
                    cLine.textContent = `[${c.fecha || ''}] ${c.autor || ''}: ${c.texto || ''}`;
                    commDiv.appendChild(cLine);
                });
                card.appendChild(commDiv);
            }

            container.appendChild(card);
        });

        document.body.appendChild(container);
        await new Promise(r => setTimeout(r, 300));

        const canvas = await html2canvas(container, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
        document.body.removeChild(container);

        const pdf = new jsPDF('p', 'mm', 'a4');
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const imgWidth = pageWidth - 16;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;

        let heightLeft = imgHeight;
        let position = 8;
        const imgData = canvas.toDataURL('image/png');

        pdf.addImage(imgData, 'PNG', 8, position, imgWidth, imgHeight);
        heightLeft -= (pageHeight - 16);

        while (heightLeft > 0) {
            position = -(pageHeight - 16) + 8;
            pdf.addPage();
            pdf.addImage(imgData, 'PNG', 8, position, imgWidth, imgHeight);
            heightLeft -= (pageHeight - 16);
        }

        const nombreArchivo = `${(data.Name || 'checklist').replace(/[^a-z0-9]/gi, '_')}.pdf`;
        return { pdf, nombreArchivo };
    };

    const handleFinalizar = async () => {
        if (!window.confirm('¿Estás seguro de finalizar este checklist? Una vez finalizado no podrá ser editado y se guardará un PDF como registro documental.')) return;
        try {
            const digest = await getRequestDigest();
            const hoy = new Date().toISOString().split('T')[0];
            const updatedChecklist = marcarHistoricoGestionado({
                ...checklist,
                Estado: 'Finalizado',
                Metadata: { ...checklist.Metadata, fechaFinDiligenciamiento: hoy }
            });
            await updateSPListItem('DB_CHECKLIST_APP', checklist.SharePointId, {
                Data: JSON.stringify(updatedChecklist)
            }, digest);
            setChecklist(updatedChecklist);

            // Generar y subir el PDF como registro documental a la nueva ruta SharePoint.
            try {
                const { pdf, nombreArchivo } = await construirPDF(updatedChecklist);
                const arrayBuffer = pdf.output('arraybuffer');
                const uploadUrl = `${AC_SITE_URL}/_api/web/GetFolderByServerRelativeUrl('${PDF_FOLDER_RELATIVE}')/Files/add(url='${encodeURIComponent(nombreArchivo)}',overwrite=true)`;
                await fetch(uploadUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/octet-stream',
                        'X-RequestDigest': digest,
                        'Accept': 'application/json;odata=verbose'
                    },
                    body: arrayBuffer,
                    credentials: 'same-origin'
                });
            } catch (uploadErr) {
                console.error('Error subiendo PDF a SharePoint:', uploadErr);
                alert('El checklist se finalizó, pero hubo un error al guardar el PDF en SharePoint. Revisa la consola.');
            }
        } catch (error) {
            alert('Error finalizando el checklist.');
            console.error(error);
        }
    };

    const handleDescargarPDF = async () => {
        try {
            const { pdf, nombreArchivo } = await construirPDF(checklist);
            // Descarga local al PC del usuario (no se sube a SharePoint).
            pdf.save(nombreArchivo);
        } catch (error) {
            alert('Error generando el PDF.');
            console.error(error);
        }
    };

    const handleSaveEdit = async () => {
        if (isFinalizado) {
            alert("No se puede editar un checklist finalizado.");
            return;
        }
        if (parseInt(editForm.Avance) > 90 && !tieneEvidencias(editForm.Id)) {
            setAvisoTope(editForm.Id);
            alert("No puedes dejar esta tarea por encima del 90% todavía.\n\nPara marcarla al 100% primero debes cargar al menos una evidencia en la sección \"Evidencias Cargadas\" de esta misma tarea. Cuando la subas, el avance se desbloquea.");
            return;
        }

        try {
            const digest = await getRequestDigest();
            const updatedItems = checklist.items.map(it => it.Id === editForm.Id ? {
                ...it,
                Descripcion: editForm.Descripcion,
                NombreResponsable: editForm.NombreResponsable,
                Corresponsable: editForm.Corresponsable || '',
                Entregable: editForm.Entregable,
                FechaBaselineInicio: editForm.FechaBaselineInicio,
                FechaBaselineFin: editForm.FechaBaselineFin,
                FechaInicio: editForm.FechaInicio,
                FechaFin: editForm.FechaFin,
                Avance: editForm.Avance ? editForm.Avance.toString() : "0",
                Alerta: editForm.Alerta || "No"
            } : it);
            // Si era historico, desde este guardado sus % dejan de ser los migrados.
            const updatedChecklist = marcarHistoricoGestionado({ ...checklist, items: updatedItems });

            await updateSPListItem('DB_CHECKLIST_APP', checklist.SharePointId, {
                Data: JSON.stringify(updatedChecklist)
            }, digest);
            setChecklist(updatedChecklist);
            setEditingId(null);
            setAvisoTope(null);
        } catch (error) {
            alert("Error guardando cambios. Revisa la consola.");
            console.error(error);
        }
    };

    const openInactivateModal = (itemId) => {
        setInactivatingItemId(itemId);
        setInactivateReasonText('');
    };

    const handleConfirmInactivate = async () => {
        if (!inactivateReasonText.trim()) {
            alert('Por favor ingrese la razón de la inactivación.');
            return;
        }
        try {
            const digest = await getRequestDigest();
            const updatedItems = checklist.items.map(it => it.Id === inactivatingItemId ? {
                ...it,
                Estado: 'Inactivo',
                InactivadoPor: currentUser,
                InactivadoRazon: inactivateReasonText.trim(),
                InactivadoFecha: new Date().toISOString()
            } : it);
            const updatedChecklist = marcarHistoricoGestionado({ ...checklist, items: updatedItems });

            await updateSPListItem('DB_CHECKLIST_APP', checklist.SharePointId, {
                Data: JSON.stringify(updatedChecklist)
            }, digest);
            setChecklist(updatedChecklist);
            setInactivatingItemId(null);
            setInactivateReasonText('');
        } catch (error) {
            alert("Error inactivando el item en SharePoint.");
            console.error(error);
        }
    };

    const handleReactivarItem = async (itemId) => {
        try {
            const digest = await getRequestDigest();
            const updatedItems = checklist.items.map(it => it.Id === itemId ? {
                ...it,
                Estado: 'Activo',
                InactivadoPor: '',
                InactivadoRazon: '',
                InactivadoFecha: ''
            } : it);
            const updatedChecklist = marcarHistoricoGestionado({ ...checklist, items: updatedItems });

            await updateSPListItem('DB_CHECKLIST_APP', checklist.SharePointId, {
                Data: JSON.stringify(updatedChecklist)
            }, digest);
            setChecklist(updatedChecklist);
        } catch (error) {
            alert("Error reactivando el item.");
            console.error(error);
        }
    };

    // Avisa por Teams a quienes gestionan la tarea (responsable y corresponsable),
    // saltando al propio autor de la acción para que nadie se notifique a sí mismo.
    const notificarInvolucrados = (tipoAlerta, item, mensaje) => {
        const destinatarios = [item?.NombreResponsable, getCorresponsable(item)]
            .filter(Boolean)
            .filter(email => !mismoUsuario(email, currentUser));
        [...new Set(destinatarios.map(e => e.trim()))].forEach(email => {
            notificarTeams(tipoAlerta, email, mensaje, checklist.Name);
        });
    };

    const handleAgregarComentario = async (itemId) => {
        const text = nuevosComentarios[itemId];
        if (!text || !text.trim()) return;

        const comentarioObj = {
            texto: text.trim(),
            autor: currentUser,
            fecha: new Date().toISOString(),
        };
        try {
            const digest = await getRequestDigest();
            let targetItem = null;
            const updatedItems = checklist.items.map(it => {
                if (it.Id === itemId) {
                    targetItem = it;
                    const history = it.HistorialComentarios || [];
                    return { ...it, HistorialComentarios: [...history, comentarioObj] };
                }
                return it;
            });

            const updatedChecklist = { ...checklist, items: updatedItems };
            await updateSPListItem('DB_CHECKLIST_APP', checklist.SharePointId, {
                Data: JSON.stringify(updatedChecklist)
            }, digest);

            setChecklist(updatedChecklist);
            setNuevosComentarios({ ...nuevosComentarios, [itemId]: '' });

            if (targetItem) {
                notificarInvolucrados(
                    "Nuevo Comentario",
                    targetItem,
                    `El usuario ${currentUser} ha comentado en tu tarea "${targetItem.Descripcion}": ${text}`
                );
            }

        } catch (error) {
            console.error(error);
            alert("Error guardando el comentario.");
        }
    };

    const handleSaveGeneralComment = async () => {
        try {
            const digest = await getRequestDigest();
            const updatedChecklist = { ...checklist, ComentarioGeneral: generalComment };

            await updateSPListItem('DB_CHECKLIST_APP', checklist.SharePointId, {
                Data: JSON.stringify(updatedChecklist)
            }, digest);
            setChecklist(updatedChecklist);
            alert("Comentario general guardado exitosamente.");
        } catch (error) {
            console.error(error);
            alert("Error guardando el comentario general.");
        }
    };

    const handleStartEditMetadata = () => {
        setEditMetadataForm(JSON.parse(JSON.stringify(checklist.Metadata)));
        setIsEditingMetadata(true);
    };

    const handleSaveMetadata = async () => {
        try {
            const digest = await getRequestDigest();
            const updatedChecklist = { ...checklist, Metadata: editMetadataForm };
            await updateSPListItem('DB_CHECKLIST_APP', checklist.SharePointId, {
                Data: JSON.stringify(updatedChecklist)
            }, digest);
            setChecklist(updatedChecklist);
            setIsEditingMetadata(false);
            setEditMetadataForm(null);
        } catch (error) {
            alert("Error guardando metadatos.");
            console.error(error);
        }
    };

    const toggleAlert = async (item) => {
        const newAlerta = item.Alerta === "Si" ? "No" : "Si";
        try {
            const digest = await getRequestDigest();
            const updatedItems = checklist.items.map(it => it.Id === item.Id ? { ...it, Alerta: newAlerta } : it);
            const updatedChecklist = { ...checklist, items: updatedItems };

            await updateSPListItem('DB_CHECKLIST_APP', checklist.SharePointId, {
                Data: JSON.stringify(updatedChecklist)
            }, digest);
            setChecklist(updatedChecklist);

            if (newAlerta === "Si") {
                notificarInvolucrados(
                    "Alerta Activada",
                    item,
                    `El usuario ${currentUser} ha marcado una alerta en tu tarea: "${item.Descripcion}".`
                );
            }
        } catch (error) { console.error(error); }
    };

    // ---------------------------------------------------------------------
    // Correccion del tipo de checklist (solo Administrador).
    // Varios historicos se migraron con el Tipo equivocado, asi que arrastran las
    // actividades de otra plantilla. Cambiar el tipo desde aqui reemplaza TODA la
    // lista de tareas por la plantilla correcta. Los avances anteriores se pierden
    // a proposito: no eran los reales de este checklist.
    // ---------------------------------------------------------------------

    const esFechaTexto = (f) => !!f && !isNaN(new Date(f).getTime());

    // Construye las tareas de la nueva plantilla con el mismo shape que usan la
    // creacion y el resto de handlers, para que todas las metricas (real, esperado,
    // SPI, Gantt) sigan calculando igual que en cualquier otro checklist.
    const construirItemsDesdePlantilla = (plantilla) => {
        const hoy = new Date().toISOString().split('T')[0];
        const iniMeta = checklist.Metadata?.fechaInicioDiligenciamiento;
        const finMeta = checklist.Metadata?.fechaFinDiligenciamiento;
        // La fecha fin puede venir como el texto "Se completará al finalizar".
        const inicio = esFechaTexto(iniMeta) ? iniMeta : hoy;
        const fin = esFechaTexto(finMeta) ? finMeta : '';

        return plantilla.map((act, idx) => ({
            Id: `TASK-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 5)}`,
            Descripcion: act.tarea || act,
            NombreResponsable: '',
            Corresponsable: '',
            Entregable: act.entregable || '',
            Avance: "0",
            FechaBaselineInicio: inicio,
            FechaBaselineFin: fin,
            FechaInicio: inicio,
            FechaFin: fin,
            Alerta: "No",
            HistorialComentarios: [],
            Estado: "Activo",
            InactivadoPor: '',
            InactivadoRazon: '',
            InactivadoFecha: ''
        }));
    };

    const handleConfirmCambioTipo = async () => {
        const destino = getTipoChecklist(tipoObjetivo);
        if (!destino) return;

        setCambiandoTipo(true);
        try {
            const digest = await getRequestDigest();
            const nuevosItems = construirItemsDesdePlantilla(destino.items);

            // NO se marca como historico gestionado: los % migrados de los historicos
            // se mantienen tal cual, asi las metricas globales no se mueven por una
            // correccion de tipo. Empiezan a recalcularse cuando alguien diligencie
            // una tarea, igual que hoy.
            const updatedChecklist = {
                ...checklist,
                Tipo: destino.tipo,
                items: nuevosItems,
                TipoCorregido: {
                    anterior: checklist.Tipo || '',
                    nuevo: destino.tipo,
                    por: currentUser || '',
                    fecha: new Date().toISOString()
                }
            };

            await updateSPListItem('DB_CHECKLIST_APP', checklist.SharePointId, {
                Data: JSON.stringify(updatedChecklist)
            }, digest);

            // Las tareas viejas ya no existen: se limpia todo lo que apunta a sus Ids.
            setChecklist(updatedChecklist);
            setEditingId(null);
            setEditForm({});
            setEvidenciasItem({});
            setNuevosComentarios({});
            setFilterResponsable('');
            setEvidenciasPresence({});
            fetchEvidencePresence(updatedChecklist);

            setTipoObjetivo(null);
            alert(`Listo. Este checklist ahora es "${destino.label}" y se cargaron sus ${nuevosItems.length} actividades.`);
        } catch (error) {
            console.error("Error cambiando el tipo de checklist:", error);
            alert("Error cambiando el tipo de checklist. Revisa la consola.");
        } finally {
            setCambiandoTipo(false);
        }
    };

    const handleSaveNewTask = async (e) => {
        e.preventDefault();
        if (!newTaskData.actividades.trim()) {
            alert("Por favor configure la descripción de la tarea.");
            return;
        }
        try {
            const digest = await getRequestDigest();
            const nuevaTareaId = "TASK-" + Date.now() + Math.random().toString(36).substr(2, 5);
            const hoy = new Date().toISOString().split('T')[0];

            const nuevaTareaObj = {
                Id: nuevaTareaId,
                Descripcion: newTaskData.actividades,
                NombreResponsable: newTaskData.nombreResponsable,
                Corresponsable: newTaskData.corresponsable || '',
                Entregable: newTaskData.entregable,
                Avance: "0",
                FechaBaselineInicio: newTaskData.fechaBaselineInicio,
                FechaBaselineFin: newTaskData.fechaBaselineFin || newTaskData.fechaBaselineInicio,
                FechaInicio: hoy,
                FechaFin: '',
                Alerta: "No",
                HistorialComentarios: [],
                Estado: "Activo",
                InactivadoPor: '',
                InactivadoRazon: '',
                InactivadoFecha: ''
            };

            const updatedItems = [...checklist.items, nuevaTareaObj];
            const updatedChecklist = marcarHistoricoGestionado({ ...checklist, items: updatedItems });

            await updateSPListItem('DB_CHECKLIST_APP', checklist.SharePointId, {
                Data: JSON.stringify(updatedChecklist)
            }, digest);

            setChecklist(updatedChecklist);
            setShowAddTaskForm(false);
            setNewTaskData({
                actividades: '',
                entregable: '',
                nombreResponsable: '',
                corresponsable: '',
                fechaBaselineInicio: new Date().toISOString().split('T')[0],
                fechaBaselineFin: ''
            });
            alert("Nueva tarea agregada correctamente.");
        } catch (error) {
            console.error("Error adding task:", error);
            alert("Error agregando la tarea.");
        }
    };

    if (loading) return <div className="text-center text-white mt-20">Cargando detalles desde SharePoint...</div>;
    if (loadError) return (
        <div className={`${cardClass} border p-8 rounded-3xl mt-8 mx-auto max-w-3xl text-center`}>
            <h2 className="text-2xl font-normal mb-3">Incorporación no disponible</h2>
            <p className="text-sm font-semibold text-slate-600 dark:text-slate-300 mb-6">{loadError}</p>
            <button onClick={onAtras} className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-5 py-2.5 rounded-lg transition-colors">Volver al listado</button>
        </div>
    );
    if (!checklist) return <div className="text-center text-white mt-20">Checklist no encontrado.</div>;

    const checklistEstado = checklist.Estado || '';
    const isFinalizado = checklistEstado === 'Finalizado';
    const activas = checklist.items.filter(it => (it.Estado || it.estado) !== 'Inactivo');
    const inactivas = checklist.items.filter(it => (it.Estado || it.estado) === 'Inactivo');
    const listadoOrdenado = [...activas, ...inactivas];

    // El numero de la tarea es su posicion en el checklist (la misma que usa
    // getOrdenTarea para nombrar las evidencias), no su posicion en pantalla:
    // al inactivar o filtrar tareas los numeros no se recalculan.
    const numeroTarea = (it) => checklist.items.findIndex(i => i.Id === it.Id) + 1;
    const allTasksComplete = activas.length > 0 && activas.every(it => parseInt(it.Avance || it.avance || 0) === 100);

    const listadoResponsablesUnicos = [...new Set(checklist.items.map(it => it.NombreResponsable).filter(Boolean))].sort();

    let itemsFiltrados = listadoOrdenado;
    if (filterResponsable === MIS_TAREAS) {
        // Atajo para quien gestiona: sus tareas como responsable y las que le
        // delegaron como corresponsable. Se pasa esAdmin=false a proposito, si no
        // un administrador veria todas.
        itemsFiltrados = itemsFiltrados.filter(it => puedeGestionarTarea(it, currentUser, false));
    } else if (filterResponsable) {
        itemsFiltrados = itemsFiltrados.filter(it => it.NombreResponsable === filterResponsable);
    }
    if (filterAlertaOnly) {
        itemsFiltrados = itemsFiltrados.filter(it => it.Alerta === 'Si');
    }
    // Una tarea esta "terminada" si esta al 100% y tiene evidencias cargadas.
    const tareaTerminada = (it) => parseInt(it.Avance || it.avance || 0) === 100 && !!evidenciasPresence[it.Id];
    if (filterEstadoTarea === 'terminadas') {
        itemsFiltrados = itemsFiltrados.filter(tareaTerminada);
    } else if (filterEstadoTarea === 'faltantes') {
        itemsFiltrados = itemsFiltrados.filter(it => !tareaTerminada(it));
    } else if (filterEstadoTarea === 'en_rojo') {
        // Mismo criterio que el semaforo de la tarjeta: atrasadas respecto al plan
        // o sin plan (esperado y real en 0 por falta de fechas de entrega).
        itemsFiltrados = itemsFiltrados.filter(it => getEstadoTarea(it).enRojo);
    }

    const totalEnRojo = activas.filter(it => getEstadoTarea(it).enRojo).length;

    return (
        <div className="max-w-[95%] mx-auto animate-[fadeIn_0.3s_ease-out]">
            <div className={`${cardClass} border p-4 md:p-6 rounded-3xl mb-6 flex justify-between items-start gap-3`}>
                <div className="flex items-center gap-3 min-w-0 flex-1">
                    <h2 className="text-xl md:text-3xl font-normal mb-1 break-words min-w-0"><span className={theme==='dark' ? 'text-yellow-400' : 'text-amber-600'}>{"Checklist:"}</span> {checklist.Name}</h2>
                    {isFinalizado && <span className="bg-green-500/20 text-green-500 dark:text-green-400 px-3 py-1 rounded-full text-xs font-extrabold border border-green-500/30 whitespace-nowrap">FINALIZADO</span>}
                </div>
                <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                    {allTasksComplete && !isFinalizado && (
                        <button onClick={handleFinalizar} className="bg-green-600 hover:bg-green-500 text-white font-bold py-2 px-6 rounded-lg text-sm transition-colors shadow-lg border border-green-400/30 flex items-center gap-2 whitespace-nowrap">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" /></svg>
                            Finalizar Checklist
                        </button>
                    )}
                    {isFinalizado && (
                        <button onClick={handleDescargarPDF} className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-6 rounded-lg text-sm transition-colors shadow-lg border border-blue-400/30 flex items-center gap-2 whitespace-nowrap">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                            Descargar PDF
                        </button>
                    )}
                    <button className={`${theme === 'dark' ? 'bg-white/10 hover:bg-white/20 border-white/30 text-white' : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-900'} border py-2 px-4 rounded-lg flex items-center gap-2 font-semibold transition-colors`} onClick={onAtras}>
                        &larr; {"Volver"}
                    </button>
                </div>
            </div>

            {/* Banner del flujo de aprobación (pendiente / rechazado). */}
            {(esPendiente(checklist) || esRechazado(checklist)) && (
                <div className={`mb-6 rounded-2xl border p-4 md:p-5 shadow-lg ${esRechazado(checklist)
                    ? (theme === 'dark' ? 'bg-red-950/40 border-red-500/50' : 'bg-red-50 border-red-300')
                    : (theme === 'dark' ? 'bg-amber-950/40 border-amber-500/50' : 'bg-amber-50 border-amber-300')}`}>
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-start gap-3 min-w-0">
                            <span className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${esRechazado(checklist) ? 'bg-red-600' : 'bg-amber-500'}`}>
                                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d={esRechazado(checklist) ? "M6 18L18 6M6 6l12 12" : "M12 8v4m0 4h.01M12 3a9 9 0 100 18 9 9 0 000-18z"} /></svg>
                            </span>
                            <div className="min-w-0">
                                <h3 className={`font-medium text-base md:text-lg ${esRechazado(checklist) ? 'text-red-700 dark:text-red-300' : 'text-amber-800 dark:text-amber-300'}`}>
                                    {esRechazado(checklist) ? 'Incorporación NO aprobada' : 'Pendiente de aprobación'}
                                </h3>
                                <p className="text-xs md:text-sm font-semibold text-slate-700 dark:text-slate-300">
                                    {esRechazado(checklist)
                                        ? 'Un administrador marcó esta incorporación con observaciones. Corrígelas para que pueda ser aprobada.'
                                        : 'Esta incorporación no aparece en el panel ni cuenta para las métricas hasta que un administrador la apruebe.'}
                                </p>
                                {esRechazado(checklist) && checklist.AprobacionComentario && (
                                    <p className="mt-2 text-sm font-bold text-red-700 dark:text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
                                        Motivo: {checklist.AprobacionComentario}
                                    </p>
                                )}
                                {checklist.CreadoPorNombre && (
                                    <div className="mt-3 flex items-center gap-2">
                                        <img src={`https://glencore.sharepoint.com/_layouts/15/userphoto.aspx?size=S&accountname=${encodeURIComponent(checklist.CreadoPor || '')}`} onError={(e) => { e.target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='%23ccc' viewBox='0 0 24 24'%3E%3Cpath d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'/%3E%3C/svg%3E"; }} className="w-7 h-7 rounded-full border border-slate-300 dark:border-slate-700 object-cover bg-slate-200" alt="" />
                                        <div className="text-xs">
                                            <p className="font-bold text-slate-900 dark:text-slate-100">Solicitado por {checklist.CreadoPorNombre}</p>
                                            <p className="font-semibold text-slate-500 dark:text-slate-400">{checklist.CreadoPor} {checklist.CreadoFecha ? `· ${checklist.CreadoFecha}` : ''}</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                        {isAdmin && (
                            <div className="flex gap-2 shrink-0">
                                <button onClick={handleAprobar} className="bg-green-600 hover:bg-green-500 text-white font-bold py-2 px-5 rounded-lg text-sm transition-colors shadow border border-green-400/30 flex items-center gap-2 whitespace-nowrap">
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" /></svg>
                                    Aprobar
                                </button>
                                {!esRechazado(checklist) && (
                                    <button onClick={() => setShowRejectModal(true)} className="bg-red-600 hover:bg-red-500 text-white font-bold py-2 px-5 rounded-lg text-sm transition-colors shadow border border-red-400/30 flex items-center gap-2 whitespace-nowrap">
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
                                        No aprobar
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Aviso para historicos migrados: mientras nadie los diligencie desde la app
                muestran los % que vinieron de la base de datos anterior. */}
            {esHistorico(checklist) && (
                <div className={`mb-6 rounded-2xl border p-4 flex items-start gap-3 ${theme === 'dark' ? 'bg-slate-900/60 border-slate-700' : 'bg-slate-50 border-slate-300'}`}>
                    <span className="shrink-0 w-9 h-9 rounded-full bg-slate-500 flex items-center justify-center">
                        <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </span>
                    <div className="min-w-0">
                        <h3 className="text-base font-medium">Incorporación histórica</h3>
                        <p className="text-xs md:text-sm font-semibold text-slate-700 dark:text-slate-300">
                            {esHistoricoGestionado(checklist)
                                ? 'Ya se está gestionando desde la app: los % real y esperado se calculan con las tareas de este checklist, igual que cualquier incorporación creada aquí.'
                                : 'Los % real y esperado que ves provienen de la base de datos migrada. En cuanto guardes el primer avance desde la app, pasarán a calcularse con las tareas de este checklist y las métricas generales se actualizarán con ese nuevo valor.'}
                        </p>
                    </div>
                </div>
            )}

            {/* Correccion del tipo de checklist: solo Administrador. Sirve para los
                historicos que se migraron con el tipo (y por lo tanto las actividades)
                equivocados. */}
            {isAdmin && (
                <div className={`mb-6 rounded-2xl border p-4 md:p-5 shadow-lg ${theme === 'dark' ? 'bg-slate-900/60 border-slate-700' : 'bg-white border-slate-200'}`}>
                    <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                        <div className="flex items-start gap-3 min-w-0 flex-1">
                            <span className="shrink-0 w-9 h-9 rounded-full bg-amber-500 flex items-center justify-center">
                                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            </span>
                            <div className="min-w-0">
                                <h3 className="text-base font-medium">¿Te equivocaste de tipo de checklist?</h3>
                                <p className="text-xs md:text-sm font-semibold text-slate-700 dark:text-slate-300">
                                    Elige el tipo correcto y se reemplazarán TODAS las actividades por las de esa plantilla.
                                    Los avances, responsables y comentarios actuales se pierden.
                                </p>
                                <p className="mt-1 text-xs font-bold text-slate-500 dark:text-slate-400">
                                    Tipo actual: <span className="text-amber-600 dark:text-amber-400">{checklist.Tipo || 'Sin tipo'}</span>
                                    {' · '}{activas.length} {activas.length === 1 ? 'actividad activa' : 'actividades activas'}
                                    {checklist.TipoCorregido && (
                                        <> {' · '}corregido desde &quot;{checklist.TipoCorregido.anterior || 'Sin tipo'}&quot; el {new Date(checklist.TipoCorregido.fecha).toLocaleDateString()}</>
                                    )}
                                </p>
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-2 shrink-0 lg:justify-end">
                            {TIPOS_CHECKLIST.map(t => {
                                const esActual = (checklist.Tipo || '').trim().toUpperCase() === t.tipo;
                                return (
                                    <button
                                        key={t.tipo}
                                        onClick={() => setTipoObjetivo(t.tipo)}
                                        disabled={esActual || cambiandoTipo}
                                        title={esActual ? 'Este ya es el tipo actual del checklist' : `Cambiar a ${t.label} (${t.items.length} actividades)`}
                                        className={`px-4 py-2 rounded-lg text-xs font-extrabold border transition-colors whitespace-nowrap ${esActual
                                            ? 'bg-amber-500 border-amber-600 text-black cursor-default'
                                            : (theme === 'dark'
                                                ? 'bg-amber-500/15 border-amber-500/40 text-amber-300 hover:bg-amber-500/25'
                                                : 'bg-amber-50 border-amber-300 text-amber-800 hover:bg-amber-100')} ${cambiandoTipo && !esActual ? 'opacity-50 cursor-wait' : ''}`}
                                    >
                                        {t.label}
                                        <span className="block font-bold opacity-70">{esActual ? 'tipo actual' : `${t.items.length} actividades`}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {checklist.Metadata && (
                <div className="flex flex-col xl:flex-row gap-5 mb-8 items-stretch">
                <div className={`flex-1 min-w-0 border rounded-2xl overflow-hidden text-sm shadow-lg ${theme === 'dark' ? 'border-slate-800 bg-slate-900/60' : 'border-slate-200 bg-white'}`}>
                    {isAdmin && !isFinalizado && (
                        <div className={`px-5 py-2 border-b flex justify-between items-center ${theme === 'dark' ? 'border-slate-800 bg-slate-950/40' : 'border-slate-200 bg-amber-50'}`}>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600">Metadatos del Checklist</span>
                            {!isEditingMetadata ? (
                                <button onClick={handleStartEditMetadata} className="bg-amber-500/15 hover:bg-amber-500/25 text-amber-600 dark:text-amber-400 text-xs font-bold px-3 py-1 rounded border border-amber-500/30 transition-colors">
                                    Editar Metadatos
                                </button>
                            ) : (
                                <div className="flex gap-2">
                                    <button onClick={handleSaveMetadata} className="bg-green-500/20 hover:bg-green-500/40 text-green-600 dark:text-green-300 text-xs font-bold px-3 py-1 rounded border border-green-500/30 transition-colors">
                                        Guardar Cambios
                                    </button>
                                    <button onClick={() => { setIsEditingMetadata(false); setEditMetadataForm(null); }} className="bg-gray-500/20 hover:bg-gray-500/40 text-gray-600 dark:text-gray-300 text-xs font-bold px-3 py-1 rounded border border-gray-500/30 transition-colors">
                                        Cancelar
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                    <div className={`flex flex-col md:flex-row border-b ${theme === 'dark' ? 'border-slate-800' : 'border-slate-200'}`}>
                        <div className={`w-full md:w-1/3 p-5 border-r flex flex-col gap-2 ${theme === 'dark' ? 'border-slate-800' : 'border-slate-200'}`}>
                            <span className="font-extrabold text-[10px] uppercase tracking-widest text-slate-900 dark:text-slate-200 mb-2">DESCRIPCIÓN DE EQUIPO(S) A INCORPORAR</span>
                            {isEditingMetadata ? (
                                <>
                                    {(editMetadataForm?.equipos || ['']).map((eq, idx) => (
                                        <div key={idx} className="relative group w-full flex items-center">
                                            <textarea
                                                className={`${inputClasses} text-xs pr-14`}
                                                placeholder={"Describe aquí un equipo a incorporar..."}
                                                rows="2"
                                                value={eq}
                                                onChange={(e) => {
                                                    const newEquipos = [...(editMetadataForm.equipos || [''])];
                                                    newEquipos[idx] = e.target.value;
                                                    setEditMetadataForm({ ...editMetadataForm, equipos: newEquipos });
                                                }}
                                            />
                                            {idx > 0 && (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const newEquipos = editMetadataForm.equipos.filter((_, i) => i !== idx);
                                                        setEditMetadataForm({ ...editMetadataForm, equipos: newEquipos });
                                                    }}
                                                    className="absolute right-2 px-2 py-1 text-red-500 hover:text-red-400 font-bold text-xs bg-slate-950/20 rounded border border-red-500/20"
                                                >
                                                    Eliminar
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                    <button onClick={() => setEditMetadataForm({ ...editMetadataForm, equipos: [...(editMetadataForm.equipos || []), ''] })} className="bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold py-1.5 px-3 rounded self-start transition-colors border border-amber-500/20 shadow">Añadir otro activo</button>
                                </>
                            ) : (
                                checklist.Metadata.equipos.map((eq, idx) => (
                                    <div key={idx} className={`p-3 rounded-lg border text-xs whitespace-pre-wrap font-bold ${theme === 'dark' ? 'bg-slate-950/40 border-slate-800 text-slate-200' : 'bg-slate-50 border-slate-200 text-slate-900'}`}>{eq || '-'}</div>
                                ))
                            )}
                            <div className={`mt-3 pt-3 border-t ${theme === 'dark' ? 'border-slate-800' : 'border-slate-200'}`}>
                                <span className="font-bold text-[10px] uppercase tracking-wider text-slate-900 dark:text-slate-200 block mb-2">FOTOS DEL EQUIPO</span>
                                {isEditingMetadata ? (
                                    <div className="flex flex-wrap gap-2">
                                        {(editMetadataForm?.imagenesEquipo || checklist.Metadata.imagenesEquipo || []).map((img, idx) => (
                                            <div key={idx} className="relative inline-block">
                                                <img
                                                    src={img}
                                                    alt="Equipo"
                                                    title="Clic para ampliar"
                                                    onClick={() => abrirVisorFotos(editMetadataForm?.imagenesEquipo || checklist.Metadata.imagenesEquipo || [], idx)}
                                                    className="max-h-24 rounded-lg border border-slate-300 dark:border-slate-700 object-cover shadow-lg cursor-zoom-in"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const newImgs = [...(editMetadataForm.imagenesEquipo || checklist.Metadata.imagenesEquipo)].filter((_, i) => i !== idx);
                                                        setEditMetadataForm({ ...editMetadataForm, imagenesEquipo: newImgs });
                                                    }}
                                                    className="absolute -top-1.5 -right-1.5 bg-red-600 hover:bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold shadow-lg"
                                                >
                                                    &times;
                                                </button>
                                            </div>
                                        ))}
                                        {((editMetadataForm?.imagenesEquipo || checklist.Metadata.imagenesEquipo || []).length < 3) && (
                                            <input type="file" accept="image/*" onChange={async (e) => {
                                                const files = Array.from(e.target.files);
                                                const currentImages = editMetadataForm?.imagenesEquipo || checklist.Metadata.imagenesEquipo || [];
                                                if (currentImages.length >= 3) { alert("Máximo 3 fotos."); return; }
                                                const spacesLeft = 3 - currentImages.length;
                                                const filesToProcess = files.slice(0, spacesLeft);
                                                const processed = [];
                                                for (let file of filesToProcess) {
                                                    try {
                                                        const base64 = await comprimirImagen(file, 600, 0.4);
                                                        processed.push(base64);
                                                    } catch (err) { console.error("Error compressing image:", err); }
                                                }
                                                setEditMetadataForm({ ...editMetadataForm, imagenesEquipo: [...currentImages, ...processed] });
                                            }} className="text-[10px] text-slate-900 dark:text-slate-200 font-bold w-full file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-[10px] file:font-semibold file:bg-amber-600 file:text-white hover:file:bg-amber-500 transition-all cursor-pointer" />
                                        )}
                                    </div>
                                ) : (() => {
                                    // Carrusel: muestra una foto a la vez para que el contenedor no se alargue.
                                    const fotos = fotosEquipo;
                                    if (fotos.length === 0) {
                                        return <span className="text-slate-500 dark:text-slate-400 text-xs italic font-semibold">Sin fotos cargadas.</span>;
                                    }
                                    const idx = ((fotoActivaIdx % fotos.length) + fotos.length) % fotos.length;
                                    return (
                                        <div className="relative w-full group">
                                            {/* La miniatura esta recortada (object-cover): al hacer clic se abre el
                                                visor a pantalla completa con la foto completa. */}
                                            <img
                                                src={fotos[idx]}
                                                alt={`Equipo ${idx + 1}`}
                                                onClick={() => abrirVisorFotos(fotos, idx)}
                                                title="Clic para ampliar"
                                                className="w-full h-44 rounded-lg border border-slate-300 dark:border-slate-700 object-cover shadow-lg cursor-zoom-in"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => abrirVisorFotos(fotos, idx)}
                                                className="absolute top-2 left-2 flex items-center gap-1 bg-black/60 hover:bg-black/85 text-white text-[10px] font-bold px-2 py-1 rounded-full transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                                            >
                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-4.35-4.35M11 8v6M8 11h6M19 11a8 8 0 11-16 0 8 8 0 0116 0z" /></svg>
                                                Ampliar
                                            </button>
                                            {fotos.length > 1 && (
                                                <>
                                                    <button onClick={() => setFotoActivaIdx(idx - 1)} className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/55 hover:bg-black/80 text-white rounded-full w-8 h-8 flex items-center justify-center shadow-md transition-colors">
                                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
                                                    </button>
                                                    <button onClick={() => setFotoActivaIdx(idx + 1)} className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/55 hover:bg-black/80 text-white rounded-full w-8 h-8 flex items-center justify-center shadow-md transition-colors">
                                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
                                                    </button>
                                                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
                                                        {fotos.map((_, i) => (
                                                            <button key={i} onClick={() => setFotoActivaIdx(i)} className={`w-2 h-2 rounded-full transition-colors ${i === idx ? 'bg-yellow-400' : 'bg-white/60 hover:bg-white'}`} />
                                                        ))}
                                                    </div>
                                                    <span className="absolute top-2 right-2 bg-black/60 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">{idx + 1}/{fotos.length}</span>
                                                </>
                                            )}
                                        </div>
                                    );
                                })()}
                            </div>
                        </div>
                        <div className="w-full md:w-2/3 flex flex-col">
                            <div className={`grid grid-cols-12 border-b font-bold text-[10px] uppercase tracking-wider text-slate-900 dark:text-slate-200 ${theme === 'dark' ? 'border-slate-800 bg-slate-950/40' : 'border-slate-200 bg-slate-100'}`}>
                                <div className={`col-span-3 p-3 border-r ${theme === 'dark' ? 'border-slate-800' : 'border-slate-200'} flex items-center`}>ROL</div>
                                <div className={`col-span-4 p-3 border-r ${theme === 'dark' ? 'border-slate-800' : 'border-slate-200'} flex items-center`}>Área</div>
                                <div className="col-span-5 p-3 flex items-center">Nombre representante</div>
                            </div>
                            {['lider', 'custodio', 'operador', 'mantenedor'].map((roleKey) => (
                                <div
                                    key={roleKey}
                                    className={`grid grid-cols-12 border-b items-stretch ${theme === 'dark' ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-white'}`}
                                >
                                    <div className={`col-span-3 p-2 border-r font-bold text-[10px] uppercase flex items-center ${theme === 'dark' ? 'border-slate-800 bg-slate-950/20 text-yellow-100' : 'border-slate-200 bg-slate-100/50 text-slate-900'}`}>
                                        {roleKey === 'lider' ? 'LÍDER DE PROYECTO' : roleKey}
                                    </div>
                                    <div className={`col-span-4 p-2 border-r ${theme === 'dark' ? 'border-slate-800 text-slate-200 font-bold' : 'border-slate-200 text-slate-900 font-bold'} flex items-center text-xs`}>
                                        {isEditingMetadata ? (
                                            <select className="bg-transparent border-b border-slate-300 focus:border-yellow-500 text-xs w-full outline-none" value={editMetadataForm?.roles?.[roleKey]?.area || ''} onChange={e => setEditMetadataForm({ ...editMetadataForm, roles: { ...editMetadataForm.roles, [roleKey]: { ...editMetadataForm.roles[roleKey], area: e.target.value } } })}>
                                                <option value="">{jerarquiaLoading ? "Cargando..." : "Seleccionar..."}</option>
                                                {conValorActual(jerarquia.gerencias, editMetadataForm?.roles?.[roleKey]?.area).map(a => <option key={a} value={a}>{a}</option>)}
                                            </select>
                                        ) : (
                                            checklist.Metadata.roles[roleKey].area || '-'
                                        )}
                                    </div>
                                    <div className={`col-span-5 p-2 flex items-center gap-2 ${theme === 'dark' ? 'text-slate-200 font-bold' : 'text-slate-900 font-bold'}`}>
                                        {isEditingMetadata ? (
                                            <PeoplePicker
                                                className="bg-transparent border-b border-slate-300 focus:border-yellow-500 text-xs w-full outline-none"
                                                value={editMetadataForm?.roles?.[roleKey]?.persona || ''}
                                                onChange={val => setEditMetadataForm({ ...editMetadataForm, roles: { ...editMetadataForm.roles, [roleKey]: { ...editMetadataForm.roles[roleKey], persona: val } } })}
                                            />
                                        ) : checklist.Metadata.roles[roleKey].persona ? (
                                            <React.Fragment>
                                                <img
                                                    src={`https://glencore.sharepoint.com/_layouts/15/userphoto.aspx?size=S&accountname=${checklist.Metadata.roles[roleKey].persona}`}
                                                    className="w-6 h-6 rounded-full border border-slate-300 dark:border-slate-700 object-cover bg-gray-700"
                                                    onError={(e) => { e.target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='%23ccc' viewBox='0 0 24 24'%3E%3Cpath d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'/%3E%3C/svg%3E"; }}
                                                />
                                                <span className="text-xs font-semibold truncate" title={checklist.Metadata.roles[roleKey].persona}>
                                                    {checklist.Metadata.roles[roleKey].persona}
                                                </span>
                                            </React.Fragment>
                                        ) : <span className="text-slate-900 dark:text-slate-200 font-bold text-xs italic">-</span>}
                                    </div>
                                </div>
                            ))}

                            <div className={`grid grid-cols-12 border-b items-stretch ${theme === 'dark' ? 'border-slate-800 bg-slate-950/20' : 'border-slate-200 bg-slate-50'}`}>
                                <div className={`col-span-3 p-3 border-r font-bold text-[10px] uppercase flex items-center ${theme === 'dark' ? 'border-slate-800 text-yellow-100' : 'border-slate-200 text-slate-900'}`}>GERENCIA</div>
                                <div className="col-span-9 p-3 flex items-center text-xs font-semibold">
                                    {isEditingMetadata ? (
                                        <select className="bg-transparent border-b border-slate-300 focus:border-yellow-500 text-xs w-full outline-none" value={editMetadataForm?.gerencia || ''} onChange={e => setEditMetadataForm({ ...editMetadataForm, gerencia: e.target.value })}>
                                            <option value="">{jerarquiaLoading ? "Cargando..." : "Seleccione Gerencia"}</option>
                                            {conValorActual(jerarquia.gerenciasAbreviadas, editMetadataForm?.gerencia).map(g => <option key={g} value={g}>{etiquetaGerencia(g, jerarquia.nombrePorAbreviada)}</option>)}
                                        </select>
                                    ) : (checklist.Metadata?.gerencia || '-')}
                                </div>
                            </div>
                            <div className={`grid grid-cols-12 border-b items-stretch ${theme === 'dark' ? 'border-slate-800 bg-slate-950/20' : 'border-slate-200 bg-slate-50'}`}>
                                <div className={`col-span-3 p-3 border-r font-bold text-[10px] uppercase flex items-center ${theme === 'dark' ? 'border-slate-800 text-yellow-100' : 'border-slate-200 text-slate-900'}`}>SUPERINTENDENCIA</div>
                                <div className="col-span-9 p-3 flex items-center text-xs font-semibold">
                                    {isEditingMetadata ? (
                                        <select className="bg-transparent border-b border-slate-300 focus:border-yellow-500 text-xs w-full outline-none" value={editMetadataForm?.superintendencia || ''} onChange={e => setEditMetadataForm({ ...editMetadataForm, superintendencia: e.target.value })}>
                                            <option value="">{jerarquiaLoading ? "Cargando..." : "Seleccione Superintendencia"}</option>
                                            {conValorActual(jerarquia.superintendencias, editMetadataForm?.superintendencia).map(s => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                    ) : (checklist.Metadata?.superintendencia || '-')}
                                </div>
                            </div>
                            <div className={`grid grid-cols-12 items-stretch ${theme === 'dark' ? 'border-slate-800 bg-slate-950/20' : 'border-slate-200 bg-slate-50'}`}>
                                <div className={`col-span-3 p-3 border-r font-bold text-[10px] uppercase flex items-center ${theme === 'dark' ? 'border-slate-800 text-yellow-100' : 'border-slate-200 text-slate-900'}`}>UNIDAD DE PROCESO</div>
                                <div className="col-span-9 p-3 flex items-center text-xs font-semibold">
                                    {isEditingMetadata ? (
                                        <select className="bg-transparent border-b border-slate-300 focus:border-yellow-500 text-xs w-full outline-none" value={editMetadataForm?.unidadProceso || ''} onChange={e => setEditMetadataForm({ ...editMetadataForm, unidadProceso: e.target.value })}>
                                            <option value="">{acLoading ? "Cargando..." : "Seleccione Unidad"}</option>
                                            {conValorActual(acData.unidades, editMetadataForm?.unidadProceso).map(u => <option key={u} value={u}>{u}</option>)}
                                        </select>
                                    ) : (checklist.Metadata?.unidadProceso || '-')}
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className={`flex flex-col md:flex-row border border-b-0 ${theme === 'dark' ? 'bg-slate-950/20 border-slate-800' : 'bg-slate-100/50 border-slate-200'}`}>
                        <div className={`w-full md:w-1/3 flex border-b md:border-b-0 ${theme === 'dark' ? 'border-slate-800' : 'border-slate-200'}`}>
                            <div className={`w-1/2 p-3 font-bold text-[10px] uppercase flex flex-col justify-center border-r text-slate-900 dark:text-slate-200 ${theme === 'dark' ? 'border-slate-800' : 'border-slate-200'}`}>
                                Inicio Diligenciamiento
                                {isEditingMetadata ? (
                                    <input type="date" className="bg-transparent border-b border-slate-300 focus:border-yellow-500 text-xs mt-1 w-full outline-none" value={editMetadataForm?.fechaInicioDiligenciamiento || ''} onChange={e => setEditMetadataForm({ ...editMetadataForm, fechaInicioDiligenciamiento: e.target.value })} />
                                ) : (
                                    <span className="text-slate-900 dark:text-slate-200 font-bold text-xs mt-1">
                                        {checklist.Metadata.fechaInicioDiligenciamiento || '-'}
                                    </span>
                                )}
                            </div>
                            <div className={`w-1/2 p-3 font-bold text-[10px] uppercase flex flex-col justify-center border-r text-slate-900 dark:text-slate-200 ${theme === 'dark' ? 'border-slate-800' : 'border-slate-200'}`}>
                                Fin Diligenciamiento
                                {isEditingMetadata ? (
                                    <input type="date" className="bg-transparent border-b border-slate-300 focus:border-yellow-500 text-xs mt-1 w-full outline-none" value={editMetadataForm?.fechaFinDiligenciamiento || ''} onChange={e => setEditMetadataForm({ ...editMetadataForm, fechaFinDiligenciamiento: e.target.value })} />
                                ) : (
                                    <span className="text-slate-900 dark:text-slate-200 font-bold text-xs mt-1">
                                        {checklist.Metadata.fechaFinDiligenciamiento || '-'}
                                    </span>
                                )}
                            </div>
                        </div>
                        <div className="w-full md:w-2/3 flex">
                            <div className="w-full p-4 text-xs">
                                <span className="font-bold text-[10px] uppercase text-slate-900 dark:text-slate-200 block mb-1">
                                    Comentarios Generales Metadatos:
                                </span>
                                {isEditingMetadata ? (
                                    <textarea className={`${inputClasses} text-xs`} rows="2" placeholder="Escribe aquí cualquier observación..." value={editMetadataForm?.comentarios || ''} onChange={e => setEditMetadataForm({ ...editMetadataForm, comentarios: e.target.value })} />
                                ) : (
                                    <span className="text-slate-900 dark:text-slate-200 font-bold whitespace-pre-wrap">
                                        {checklist.Metadata.comentarios || '-'}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
                {/* Graficas al lado de los metadatos: torta arriba, barras abajo (Ver mas en modal). */}
                <div className="w-full xl:w-[380px] shrink-0 flex flex-col gap-4">
                    <DashboardCharts items={checklist.items} checklist={checklist} theme={theme} layout="side" />
                </div>
                </div>
            )}

            <div className={`${cardClass} border p-5 rounded-2xl mb-6 flex flex-col md:flex-row gap-4 items-center justify-between`}>
                <div className="flex flex-col md:flex-row gap-4 flex-1 w-full">
                    <div className="flex flex-col w-full md:w-1/3">
                        <span className="text-[10px] uppercase font-bold text-slate-900 dark:text-slate-200 mb-1">{"Filtrar por Responsable"}</span>
                        <select className={`${inputClasses} text-xs font-semibold`} value={filterResponsable} onChange={(e) => setFilterResponsable(e.target.value)}>
                            <option value="">{"Todos los Responsables"}</option>
                            <option value={MIS_TAREAS}>Mis tareas (responsable o corresponsable)</option>
                            {listadoResponsablesUnicos.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                    </div>
                    <div className="flex flex-col w-full md:w-1/3">
                        <span className="text-[10px] uppercase font-bold text-slate-900 dark:text-slate-200 mb-1">{"Filtrar por Estado"}</span>
                        <select className={`${inputClasses} text-xs font-semibold`} value={filterEstadoTarea} onChange={(e) => setFilterEstadoTarea(e.target.value)}>
                            <option value="">Todas las tareas</option>
                            <option value="terminadas">Terminadas (100% + evidencias)</option>
                            <option value="faltantes">Faltantes (por terminar)</option>
                            <option value="en_rojo">En rojo: atrasadas o sin fecha de entrega ({totalEnRojo})</option>
                        </select>
                        {filterEstadoTarea === 'en_rojo' && (
                            <span className="text-[10px] font-bold text-red-600 dark:text-red-400 mt-1">
                                Mostrando las tareas por debajo del avance esperado y las que están en 0% sin fechas de entrega.
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-2 mt-4 md:mt-0">
                        <input type="checkbox" id="detAlertCheckbox" checked={filterAlertaOnly} onChange={(e) => setFilterAlertaOnly(e.target.checked)} className="accent-yellow-500 cursor-pointer h-4 w-4" />
                        <label htmlFor="detAlertCheckbox" className="text-xs font-bold text-slate-900 dark:text-slate-200 cursor-pointer">{"Solo en Alerta"}</label>
                    </div>
                </div>
                {!isFinalizado && isAdmin && (
                    <button onClick={() => setShowAddTaskForm(!showAddTaskForm)} className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-4 py-2.5 rounded-lg border border-blue-400/40 transition-colors shadow">
                        {showAddTaskForm ? "Cancelar Nueva" : "Agregar Nueva Tarea"}
                    </button>
                )}
            </div>

            {showAddTaskForm && (
                <div className={`${theme === 'dark' ? 'bg-slate-900 border-blue-500/30' : 'bg-white border-blue-200 shadow-slate-200'} p-6 rounded-2xl border mb-6 animate-[fadeIn_0.2s_ease-out] shadow`}>
                    <form onSubmit={handleSaveNewTask} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                            <div className="md:col-span-12">
                                <label className={`block text-xs font-bold mb-1 ${theme === 'dark' ? 'text-slate-200' : 'text-slate-900'}`}>{"Descripción de la Tarea"}</label>
                                <textarea className={inputClasses + " text-xs"} value={newTaskData.actividades} onChange={(e) => setNewTaskData({ ...newTaskData, actividades: e.target.value })} rows="2" required></textarea>
                            </div>
                            <div className="md:col-span-4">
                                <label className={`block text-xs font-bold mb-1 ${theme === 'dark' ? 'text-slate-200' : 'text-slate-900'}`}>Responsable</label>
                                <PeoplePicker className={inputClasses + " text-xs"} value={newTaskData.nombreResponsable} onChange={(val) => setNewTaskData(prev => ({ ...prev, nombreResponsable: val }))} />
                            </div>
                            <div className="md:col-span-4">
                                <label className={`block text-xs font-bold mb-1 ${theme === 'dark' ? 'text-slate-200' : 'text-slate-900'}`}>
                                    Corresponsable <span className="font-semibold text-slate-500 dark:text-slate-400">(opcional)</span>
                                </label>
                                <PeoplePicker className={inputClasses + " text-xs"} placeholder="Quién gestiona por el responsable..." required={false} value={newTaskData.corresponsable} onChange={(val) => setNewTaskData(prev => ({ ...prev, corresponsable: val }))} />
                            </div>
                            <div className="md:col-span-4">
                                <label className={`block text-xs font-bold mb-1 ${theme === 'dark' ? 'text-slate-200' : 'text-slate-900'}`}>Entregable</label>
                                <input type="text" className={inputClasses + " text-xs"} value={newTaskData.entregable} onChange={(e) => setNewTaskData({ ...newTaskData, entregable: e.target.value })} required></input>
                            </div>
                            <div className="md:col-span-3">
                                <label className="block text-xs font-bold text-blue-500 dark:text-blue-300 mb-1">Plan Inicio (Baseline)</label>
                                <input type="date" className={inputClasses + " text-xs"} value={newTaskData.fechaBaselineInicio} onChange={(e) => setNewTaskData({ ...newTaskData, fechaBaselineInicio: e.target.value })} required></input>
                            </div>
                            <div className="md:col-span-3">
                                <label className="block text-xs font-bold text-blue-500 dark:text-blue-300 mb-1">Plan Fin (Baseline)</label>
                                <input type="date" className={inputClasses + " text-xs"} value={newTaskData.fechaBaselineFin} onChange={(e) => setNewTaskData({ ...newTaskData, fechaBaselineFin: e.target.value })} required></input>
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                            <button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-6 rounded shadow-lg text-xs transition-colors">Guardar Tarea</button>
                        </div>
                    </form>
                </div>
            )}

            <div className="space-y-4 mb-8">
                {itemsFiltrados.map((it) => {
                    const isEditing = editingId === it.Id;
                    const currentItem = isEditing ? editForm : it;
                    // Responsable y corresponsable diligencian la tarea por igual; nombrar
                    // al corresponsable queda reservado al responsable y al administrador.
                    const puedeGestionar = puedeGestionarTarea(it, currentUser, isAdmin);
                    const puedeCambiarCorresponsable = puedeAsignarCorresponsable(it, currentUser, isAdmin);
                    const corresponsable = getCorresponsable(it);
                    const isInactive = (it.Estado || it.estado) === 'Inactivo';
                    const showAlert = it.Alerta === "Si";
                    const estadoTarea = getEstadoTarea(it);
                    const evidenciasOk = tieneEvidencias(it.Id);

                    return (
                        <div 
                            key={it.Id} 
                            className={`p-5 rounded-2xl border transition-all ${
                                isInactive 
                                    ? (theme === 'dark' ? 'border-dashed border-slate-700 bg-slate-950/70 shadow-sm' : 'border-dashed border-slate-300 bg-slate-100/95 shadow-sm') 
                                    : showAlert ? 'bg-red-900/60 backdrop-blur-2xl border-red-500/80 shadow-[0_0_20px_rgba(239,68,68,0.4)]' 
                                    : theme === 'dark' ? 'bg-slate-900/80 border-slate-800' : 'bg-slate-50/50 border-slate-200'
                            }`}
                        >
                            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-stretch gap-4">
                                
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-start gap-3 mb-2 border-b border-slate-200 dark:border-slate-800 pb-3">
                                        <span className={`text-xs font-bold px-2.5 py-1 rounded-md mt-0.5 shadow-inner ${
                                            isInactive 
                                                ? (theme === 'dark' ? 'bg-slate-800 text-slate-200 font-bold' : 'bg-slate-200 text-slate-900 font-bold') 
                                                : showAlert ? 'bg-red-500 text-white' 
                                                : 'bg-amber-600 text-white shadow'
                                        }`}>
                                            #{numeroTarea(it)}
                                        </span>
                                        {isEditing && isAdmin ? (
                                            <textarea className={`${inputClasses} text-sm font-semibold`} rows="2" value={currentItem.Descripcion} onChange={e => setEditForm({ ...editForm, Descripcion: e.target.value })} />
                                        ) : (
                                            <div className="flex flex-col flex-1">
                                                <h4 className={`text-lg font-bold leading-snug break-words text-[15px] ${
                                                    isInactive 
                                                        ? (theme === 'dark' ? 'text-slate-400 line-through decoration-slate-500/80' : 'text-slate-700 line-through decoration-slate-500') 
                                                        : showAlert ? 'text-red-200' 
                                                        : theme==='dark'?'text-yellow-400':'text-slate-900'
                                                }`}>
                                                    {it.Descripcion}
                                                </h4>
                                                {isInactive && (
                                                    <div className={`text-xs font-bold mt-2 flex flex-wrap items-center gap-1 ${
                                                        theme === 'dark' ? 'text-red-400' : 'text-red-650'
                                                    }`} style={{ color: theme === 'light' ? '#b91c1c' : undefined }}>
                                                        <span>&#9888;</span>
                                                        <span>{"Inactivado por: "}</span>
                                                        <span className="underline font-semibold">{it.InactivadoPor || it.inactivadoPor}</span>
                                                        <span>{" - Causa: \""}{it.InactivadoRazon || it.inactivadoRazon}{"\""}</span>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    <div className={`grid grid-cols-2 lg:grid-cols-6 gap-6 mt-4 text-sm ${isInactive ? 'opacity-70' : ''}`}>
                                        <div className="col-span-1">
                                            <span className={`block text-[10px] font-bold uppercase tracking-wider mb-1 ${isInactive ? 'text-slate-900 dark:text-slate-200' : 'text-slate-900 dark:text-slate-200'}`}>{"Responsable"}</span>
                                            {isEditing && isAdmin ? (
                                                <PeoplePicker
                                                    className="bg-transparent border-b border-slate-300 focus:border-yellow-500 text-xs w-full outline-none"
                                                    value={currentItem.NombreResponsable || ''}
                                                    onChange={val => setEditForm({ ...editForm, NombreResponsable: val })}
                                                />
                                            ) : (
                                                <div className="flex items-center gap-2">
                                                    <img
                                                        src={`https://glencore.sharepoint.com/_layouts/15/userphoto.aspx?size=S&accountname=${it.NombreResponsable}`}
                                                        className="w-7 h-7 rounded-full border border-slate-300 dark:border-slate-700 object-cover bg-gray-700"
                                                        onError={(e) => { e.target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='%23ccc' viewBox='0 0 24 24'%3E%3Cpath d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'/%3E%3C/svg%3E"; }}
                                                    />
                                                    <span className={`font-semibold text-xs break-all ${isInactive ? (theme === 'dark' ? 'text-slate-300' : 'text-slate-700') : ''}`}>{it.NombreResponsable}</span>
                                                </div>
                                            )}

                                            {/* Corresponsable: apoya al responsable diligenciando la tarea. No
                                                sustituye al responsable en las gráficas ni en los reportes. */}
                                            <div className="mt-3 pt-2 border-t border-dashed border-slate-300 dark:border-slate-700">
                                                <span className="block text-[10px] font-bold uppercase tracking-wider mb-1 text-slate-900 dark:text-slate-200">
                                                    Corresponsable
                                                </span>
                                                {isEditing && puedeCambiarCorresponsable ? (
                                                    <>
                                                        <PeoplePicker
                                                            className="bg-transparent border-b border-slate-300 focus:border-yellow-500 text-xs w-full outline-none"
                                                            placeholder="Sin corresponsable"
                                                            required={false}
                                                            value={currentItem.Corresponsable || ''}
                                                            onChange={val => setEditForm({ ...editForm, Corresponsable: val })}
                                                        />
                                                        <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 mt-1">
                                                            Podrá diligenciar esta tarea igual que tú. El avance se sigue contando al responsable.
                                                        </p>
                                                        {currentItem.Corresponsable && (
                                                            <button
                                                                type="button"
                                                                onClick={() => setEditForm({ ...editForm, Corresponsable: '' })}
                                                                className="mt-1 text-[10px] font-bold text-red-600 dark:text-red-400 hover:underline"
                                                            >
                                                                Quitar corresponsable
                                                            </button>
                                                        )}
                                                    </>
                                                ) : corresponsable ? (
                                                    <div className="flex items-center gap-2">
                                                        <img
                                                            src={`https://glencore.sharepoint.com/_layouts/15/userphoto.aspx?size=S&accountname=${corresponsable}`}
                                                            className="w-6 h-6 rounded-full border border-slate-300 dark:border-slate-700 object-cover bg-gray-700"
                                                            onError={(e) => { e.target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='%23ccc' viewBox='0 0 24 24'%3E%3Cpath d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'/%3E%3C/svg%3E"; }}
                                                        />
                                                        <span className="font-semibold text-xs break-all text-slate-600 dark:text-slate-300" title={`${corresponsable} gestiona esta tarea en apoyo al responsable`}>
                                                            {corresponsable}
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <span className="text-xs font-semibold italic text-slate-500 dark:text-slate-400">
                                                        Sin asignar
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="col-span-1">
                                            <span className={`block text-[10px] font-bold uppercase tracking-wider mb-1 ${isInactive ? 'text-slate-900 dark:text-slate-200' : 'text-slate-900 dark:text-slate-200'}`}>{"Entregable"}</span>
                                            {isEditing && isAdmin ? (
                                                <input type="text" className="bg-transparent border-b border-slate-300 focus:border-yellow-500 text-xs w-full outline-none" value={currentItem.Entregable || ''} onChange={e => setEditForm({ ...editForm, Entregable: e.target.value })} />
                                            ) : (
                                                <span className={`font-semibold text-xs break-words ${isInactive ? (theme === 'dark' ? 'text-slate-300' : 'text-slate-700') : ''}`}>{it.Entregable || '-'}</span>
                                            )}
                                        </div>

                                        <div className="col-span-1 md:col-span-2 lg:col-span-1">
                                            <span className={`block text-[10px] font-bold uppercase tracking-wider mb-1 ${isInactive ? 'text-slate-900 dark:text-slate-200' : 'text-slate-900 dark:text-slate-200'}`}>Fechas Plan</span>
                                            {isEditing && isAdmin ? (
                                                <div className="flex flex-col gap-1.5 mt-1">
                                                    <div className="flex items-center gap-1.5 text-xs"><span className="w-4 font-bold text-blue-500">I:</span><input type="date" className="bg-transparent border-none text-xs w-full" value={currentItem.FechaBaselineInicio ? currentItem.FechaBaselineInicio.substring(0, 10) : ''} onChange={e => setEditForm({ ...editForm, FechaBaselineInicio: e.target.value })} /></div>
                                                    <div className="flex items-center gap-1.5 text-xs"><span className="w-4 font-bold text-blue-500">F:</span><input type="date" className="bg-transparent border-none text-xs w-full" value={currentItem.FechaBaselineFin ? currentItem.FechaBaselineFin.substring(0, 10) : ''} onChange={e => setEditForm({ ...editForm, FechaBaselineFin: e.target.value })} /></div>
                                                </div>
                                            ) : (
                                                <div className={`p-2 rounded border shadow-inner ${theme==='dark'?'bg-slate-950 border-slate-800':'bg-slate-100 border-slate-200 text-slate-900'}`}>
                                                    <span className="font-semibold block text-[11px]"><span className="text-blue-500 dark:text-blue-300 font-bold w-4 inline-block">I:</span> {it.FechaBaselineInicio || '-'}</span>
                                                    <span className="font-semibold block text-[11px] mt-1"><span className="text-blue-500 dark:text-blue-300 font-bold w-4 inline-block">F:</span> {it.FechaBaselineFin || '-'}</span>
                                                </div>
                                            )}
                                        </div>

                                        <div className="col-span-1 md:col-span-2 lg:col-span-1">
                                            <span className={`block text-[10px] font-bold uppercase tracking-wider mb-1 ${isInactive ? 'text-slate-900 dark:text-slate-200' : 'text-slate-900 dark:text-slate-200'}`}>Fechas Reales</span>
                                            {isEditing ? (
                                                <div className="flex flex-col gap-1.5 mt-1">
                                                    <div className="flex items-center gap-1.5 text-xs"><span className="w-4 font-bold text-yellow-500">I:</span><input type="date" className="bg-transparent border-none text-xs w-full" value={currentItem.FechaInicio ? currentItem.FechaInicio.substring(0, 10) : ''} onChange={e => setEditForm({ ...editForm, FechaInicio: e.target.value })} /></div>
                                                    <div className="flex items-center gap-1.5 text-xs"><span className="w-4 font-bold text-yellow-500">F:</span><input type="date" className="bg-transparent border-none text-xs w-full" value={currentItem.FechaFin ? currentItem.FechaFin.substring(0, 10) : ''} onChange={e => setEditForm({ ...editForm, FechaFin: e.target.value })} /></div>
                                                </div>
                                            ) : (
                                                <div className={`p-2 rounded border shadow-inner ${theme==='dark'?'bg-slate-950 border-slate-800':'bg-slate-105 border-slate-200 text-slate-900 bg-slate-100'}`}>
                                                    <span className="font-semibold block text-[11px]"><span className="text-yellow-600 dark:text-yellow-400 font-bold w-4 inline-block">I:</span> {it.FechaInicio ? it.FechaInicio.substring(0, 10) : '-'}</span>
                                                    <span className="font-semibold block text-[11px] mt-1"><span className="text-yellow-600 dark:text-yellow-400 font-bold w-4 inline-block">F:</span> {it.FechaFin ? it.FechaFin.substring(0, 10) : '-'}</span>
                                                </div>
                                            )}
                                        </div>

                                        {(() => {
                                            // Semaforo compartido con el filtro "En rojo": atrasada respecto al
                                            // plan, o sin plan (0% esperado y 0% real por falta de fechas).
                                            const { esperado: espTarea, real: realTarea, atrasada, sinPlan, sinFechaEntrega } = estadoTarea;
                                            const tituloAlerta = atrasada
                                                ? `Atrasado: real ${realTarea}% por debajo del esperado ${espTarea}%`
                                                : sinFechaEntrega
                                                    ? 'Esta tarea no tiene fecha de entrega, por eso su avance esperado es 0%.'
                                                    : 'Sin avance esperado ni real: el plan de esta tarea todavía no arranca.';
                                            return (
                                                <div className="col-span-1">
                                                    <span className="block text-[10px] font-bold uppercase tracking-wider mb-1 text-slate-900 dark:text-slate-200 flex items-center gap-1">
                                                        Avance Esperado
                                                        {(atrasada || sinPlan) && (
                                                            <span title={tituloAlerta} className="inline-flex items-center text-red-600 dark:text-red-400">
                                                                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.492-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                                                            </span>
                                                        )}
                                                    </span>
                                                    <span className={`font-black text-2xl drop-shadow ${(atrasada || sinPlan) ? 'text-red-600 dark:text-red-400' : 'text-green-500'}`}>{espTarea}%</span>
                                                    {sinPlan && (
                                                        <span className="block text-[10px] font-bold text-red-600 dark:text-red-400 mt-1 leading-tight">
                                                            {sinFechaEntrega ? 'Sin fecha de entrega' : 'Plan sin iniciar'}
                                                        </span>
                                                    )}
                                                </div>
                                            );
                                        })()}

                                        <div className="col-span-1">
                                            <span className={`block text-[10px] font-bold uppercase tracking-wider mb-1 text-slate-900 dark:text-slate-200 flex items-center gap-1`}>
                                                Avance Real
                                                {estadoTarea.sinPlan && (
                                                    <span title={estadoTarea.sinFechaEntrega
                                                        ? 'Avance real en 0% y sin fecha de entrega definida.'
                                                        : 'Avance real en 0% y plan todavía sin iniciar.'} className="inline-flex items-center text-red-600 dark:text-red-400">
                                                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.492-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                                                    </span>
                                                )}
                                            </span>
                                            {isEditing ? (
                                                <>
                                                    <div className="flex items-center gap-1">
                                                        <input type="number" min="0" max="100" className="w-20 bg-transparent border-b border-slate-300 focus:border-yellow-500 text-lg font-bold mt-1 outline-none" value={currentItem.Avance || 0} onChange={e => {
                                                            let val = parseInt(e.target.value) || 0;
                                                            if (val > 100) val = 100;
                                                            // Tope del 90% mientras la tarea no tenga evidencias: antes se
                                                            // recortaba en silencio, ahora se avisa por qué.
                                                            if (val > 90 && !evidenciasOk) {
                                                                val = 90;
                                                                setAvisoTope(it.Id);
                                                            } else if (avisoTope === it.Id) {
                                                                setAvisoTope(null);
                                                            }
                                                            setEditForm({ ...editForm, Avance: val });
                                                        }} />
                                                        <span className="text-lg font-bold mt-1">%</span>
                                                    </div>

                                                    {!evidenciasOk && (
                                                        <div className={`mt-2 rounded-lg border px-2.5 py-2 text-[11px] font-bold leading-snug ${avisoTope === it.Id
                                                            ? 'bg-red-500/15 border-red-500/50 text-red-700 dark:text-red-300'
                                                            : (theme === 'dark' ? 'bg-amber-500/10 border-amber-500/40 text-amber-300' : 'bg-amber-50 border-amber-300 text-amber-800')}`}>
                                                            <span className="flex items-start gap-1.5">
                                                                <svg className="w-4 h-4 shrink-0 mt-[1px]" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.492-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                                                                <span>
                                                                    {avisoTope === it.Id
                                                                        ? 'No puedes marcar esta tarea al 100% todavía: primero carga una evidencia. Por eso el avance se quedó en 90%.'
                                                                        : 'Máximo 90% mientras la tarea no tenga evidencias. Sube al menos una en "Evidencias Cargadas" para poder llegar al 100%.'}
                                                                </span>
                                                            </span>
                                                        </div>
                                                    )}
                                                </>
                                            ) : (
                                                <span className={`font-black text-2xl drop-shadow ${estadoTarea.sinPlan ? 'text-red-600 dark:text-red-400' : 'text-yellow-600 dark:text-yellow-400'}`}>{isInactive ? 0 : (it.Avance || 0)}%</span>
                                            )}
                                        </div>

                                         {!isInactive && (
                                            <div className="col-span-1 lg:col-span-6 border-t border-slate-200 dark:border-slate-800 pt-3">
                                                <div className="flex justify-between items-center mb-2">
                                                    <span className="text-slate-900 dark:text-slate-200 text-[10px] font-bold uppercase tracking-wider flex items-center gap-2">
                                                        Evidencias Cargadas
                                                        {evidenciasPresence[it.Id] ? (
                                                            <span className="bg-green-500/15 text-green-700 dark:text-green-400 border border-green-500/40 px-1.5 py-0.5 rounded-full text-[9px] font-black tracking-normal uppercase flex items-center gap-1">
                                                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                                                                Con Evidencias
                                                            </span>
                                                        ) : (
                                                            <span className="bg-slate-400/10 text-slate-500 dark:text-slate-400 border border-slate-400/30 px-1.5 py-0.5 rounded-full text-[9px] font-black tracking-normal uppercase">
                                                                Sin Evidencias
                                                            </span>
                                                        )}
                                                    </span>
                                                    <div className="flex gap-2">
                                                        {evidenciasItem[it.Id] && evidenciasItem[it.Id].length > 0 && (
                                                            <button onClick={() => { setModalEvidences(evidenciasItem[it.Id]); setActiveEvidenciaIndex(0); }} className="text-[10px] bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 px-2 py-1 rounded border border-yellow-500/30 transition-colors shadow flex items-center gap-1 font-semibold">
                                                                Ver Visualizador
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className={`space-y-3 p-3 rounded-lg border ${theme==='dark'?'bg-slate-950/40 border-slate-800':'bg-slate-100 border-slate-200'}`}>
                                                    {cargandoEvidencias[it.Id] ? (
                                                        <span className="text-yellow-500 text-xs italic block text-center">Consultando servidor...</span>
                                                    ) : (
                                                        <div className="flex flex-wrap gap-3">
                                                            {(!evidenciasItem[it.Id] || evidenciasItem[it.Id].length === 0) ? (
                                                                <span className="text-slate-900 dark:text-slate-200 font-bold text-xs italic">Aún no se han cargado evidencias para esta tarea.</span>
                                                            ) : (
                                                                evidenciasItem[it.Id].map(ev => (
                                                                    <div key={ev.Id} className="relative group border border-slate-200 dark:border-slate-800 rounded-md p-1 bg-white dark:bg-slate-900 shadow-lg">
                                                                        {ev.isImage ? (
                                                                            <img src={ev.Data} className="h-16 w-16 object-cover rounded cursor-pointer hover:opacity-80 transition-opacity" onClick={() => { setModalEvidences(evidenciasItem[it.Id]); setActiveEvidenciaIndex(evidenciasItem[it.Id].findIndex(e => e.Id === ev.Id)); }} />
                                                                        ) : (
                                                                            <div className="h-16 w-16 flex flex-col items-center justify-center text-[10px] font-bold text-slate-900 dark:text-slate-200 font-bold rounded cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-center" onClick={() => { setModalEvidences(evidenciasItem[it.Id]); setActiveEvidenciaIndex(evidenciasItem[it.Id].findIndex(e => e.Id === ev.Id)); }}>
                                                                                DOC
                                                                            </div>
                                                                        )}
                                                                        {!isFinalizado && puedeGestionar && (
                                                                            <button onClick={() => eliminarEvidencia(it.Id, ev)} className="absolute -top-2 -right-2 bg-red-600 hover:bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold opacity-0 group-hover:opacity-100 transition-opacity shadow-md">&times;</button>
                                                                        )}
                                                                    </div>
                                                                ))
                                                            )}
                                                        </div>
                                                    )}

                                                    {!isFinalizado && puedeGestionar && (
                                                        <div className={`pt-2 border-t ${theme==='dark'?'border-slate-800':'border-slate-200'}`}>
                                                            <input type="file" multiple className="text-[10px] text-slate-900 dark:text-slate-200 font-bold w-full file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-[10px] file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-500 transition-all cursor-pointer block" onChange={(e) => handleFileUpload(it.Id, e)} accept="image/*,.pdf,.doc,.docx,.xls,.xlsx" disabled={isUploading} />
                                                            {isUploading && <span className="text-yellow-500 text-xs mt-1 block font-semibold">Procesando y subiendo archivo(s)... no cierres la pestaña.</span>}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                     {!isInactive && (
                                        <div className="col-span-1 lg:col-span-6 mt-5 pt-4 border-t border-slate-200 dark:border-slate-800">
                                            <div className="flex justify-between items-center mb-3">
                                                <span className="text-slate-900 dark:text-slate-200 text-[10px] font-bold uppercase tracking-wider">Historial de Comentarios</span>
                                                {!isFinalizado && isAdmin && !isEditing && (
                                                    <button onClick={() => toggleAlert(it)} className={`text-[10px] font-bold px-2 py-1 rounded border shadow-sm ${showAlert ? 'bg-red-500/20 text-red-400 border-red-500/50' : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-200 border-slate-300 dark:border-slate-700'} transition-colors`}>
                                                        {showAlert ? 'Quitar Alerta' : 'Marcar Alerta'}
                                                    </button>
                                                )}
                                            </div>

                                            <div className="space-y-2 mb-4 max-h-40 overflow-y-auto pr-2">
                                                {(!it.HistorialComentarios || it.HistorialComentarios.length === 0) ? (
                                                    <p className="text-slate-900 dark:text-slate-200 font-bold text-xs italic">No hay comentarios.</p>
                                                ) : (
                                                    it.HistorialComentarios.map((com, index) => (
                                                        <div key={index} className={`p-3 rounded-lg border ${theme==='dark'?'bg-slate-950/20 border-slate-800':'bg-white border-slate-200'}`}>
                                                            <div className="flex justify-between items-center mb-1 border-b border-slate-200 dark:border-slate-800 pb-1">
                                                                <span className="text-yellow-600 dark:text-yellow-500 font-bold text-xs">{com.autor}</span>
                                                                <span className="text-slate-900 dark:text-slate-200 font-bold text-[10px]">{new Date(com.fecha).toLocaleString()}</span>
                                                            </div>
                                                            <p className="text-slate-900 dark:text-slate-200 font-bold text-sm whitespace-pre-wrap">{com.texto}</p>
                                                        </div>
                                                    ))
                                                )}
                                            </div>

                                            {!isFinalizado && puedeGestionar && (
                                                <div className="flex gap-2">
                                                    <textarea
                                                        className={`${inputClasses} text-xs`}
                                                        rows="1"
                                                        placeholder="Escribe un comentario..."
                                                        value={nuevosComentarios[it.Id] || ''}
                                                        onChange={(e) => setNuevosComentarios({ ...nuevosComentarios, [it.Id]: e.target.value })}
                                                    ></textarea>
                                                    <button
                                                        onClick={() => handleAgregarComentario(it.Id)}
                                                        disabled={!nuevosComentarios[it.Id] || !nuevosComentarios[it.Id].trim()}
                                                        className="bg-blue-600 hover:bg-blue-500 disabled:bg-slate-400 text-white text-xs font-bold px-4 rounded transition-colors shadow"
                                                    >
                                                        Agregar
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                <div className="flex flex-col gap-2 min-w-[110px] justify-start pt-2 border-t lg:border-t-0 lg:border-l border-slate-200 dark:border-slate-800 lg:pl-4">
                                    {isFinalizado ? (
                                        <span className="px-4 py-2.5 rounded-xl text-xs font-black text-center w-full shadow-md border bg-slate-500/10 border-slate-500/20 text-slate-900 dark:text-slate-200 font-bold flex items-center justify-center gap-1">
                                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                                            Finalizado
                                        </span>
                                    ) : isInactive ? (
                                        <button 
                                            onClick={() => handleReactivarItem(it.Id)} 
                                            className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all w-full shadow-md border ${
                                                theme === 'dark' 
                                                    ? 'bg-green-600 hover:bg-green-500 text-white border-green-700' 
                                                    : 'bg-green-500 hover:bg-green-600 text-white border-green-600'
                                            }`}
                                        >
                                            {"Reactivar"}
                                        </button>
                                    ) : isEditing ? (
                                        <>
                                            <button onClick={handleSaveEdit} className="bg-green-500/20 hover:bg-green-500/40 text-green-600 dark:text-green-300 border border-green-500/30 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors w-full shadow-sm">Listo</button>
                                            <button onClick={handleCancelEdit} className="bg-gray-500/20 hover:bg-gray-500/40 text-gray-600 dark:text-gray-300 border border-gray-500/30 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors w-full shadow-sm">Cancelar</button>
                                        </>
                                    ) : (
                                        puedeGestionar && <button onClick={() => handleStartEdit(it)} className="bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-300 border border-blue-500/20 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors w-full shadow-sm">Editar</button>
                                    )}
                                    {!isInactive && !isFinalizado && isAdmin && (
                                        <button
                                            onClick={() => openInactivateModal(it.Id)}
                                            className="bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-355 border border-red-500/20 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors w-full shadow-sm"
                                        >
                                            Inactivar
                                        </button>
                                    )}
                                </div>

                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="mt-8 flex flex-col items-center justify-center gap-4">
                <button 
                    onClick={() => setShowGanttModal(true)} 
                    className="bg-yellow-500 hover:bg-yellow-400 text-black font-extrabold py-3.5 px-8 rounded-xl transition-all shadow-lg flex items-center gap-2"
                >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 13v-1m4 1v-3m4 3V8M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                    </svg>
                    {"Ver Gantt Detallado"}
                </button>
            </div>

            <div className={`${cardClass} border p-6 rounded-3xl mt-8`}>
                <h3 className={`text-xl font-medium mb-4 flex items-center gap-2 ${theme === 'dark' ? 'text-yellow-400' : 'text-amber-700'}`}>
                    <svg className="w-6 h-6 inline-block" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg> Comentario General del Checklist
                </h3>
                {(!isFinalizado && isAdmin) ? (
                    <div className="space-y-3">
                        <textarea
                            className={`${inputClasses} text-sm`}
                            rows="3"
                            value={generalComment}
                            onChange={e => setGeneralComment(e.target.value)}
                            placeholder={"Escribe un comentario general..."}
                        ></textarea>
                        <button onClick={handleSaveGeneralComment} className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-6 rounded-lg text-xs transition-colors shadow">
                            Guardar Comentario General
                        </button>
                    </div>
                ) : (
                    <div className={`p-4 rounded-xl border min-h-[80px] ${theme==='dark'?'bg-slate-950/40 border-slate-800':'bg-slate-50 border-slate-200'}`}>
                        {generalComment ? (
                            <p className="whitespace-pre-wrap">{generalComment}</p>
                        ) : (
                            <p className="text-slate-900 dark:text-slate-200 font-bold italic">Sin comentarios generales por el momento.</p>
                        )}
                    </div>
                )}
            </div>

            {modalEvidences && modalEvidences.length > 0 && activeEvidenciaIndex !== null && ReactDOM.createPortal(
                // Va en un portal a document.body y por encima de los botones flotantes
                // para que la cabecera con el boton de cerrar siempre quede visible.
                <div
                    className="fixed inset-0 z-[10000] flex flex-col bg-black/95 backdrop-blur-md animate-[fadeIn_0.2s_ease-out]"
                    onClick={() => setModalEvidences(null)}
                >
                    <div className="flex justify-between items-center p-4 text-white border-b border-slate-800" onClick={(e) => e.stopPropagation()}>
                        <div className="font-bold tracking-widest text-sm text-yellow-400 uppercase">
                            Evidencia del Checklist ({activeEvidenciaIndex + 1} de {modalEvidences.length})
                        </div>
                        <button onClick={() => setModalEvidences(null)} title="Cerrar (Esc)" className="flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white font-bold px-4 py-2 rounded-xl border border-red-400/40 shadow-lg transition-colors">
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                            Cerrar
                        </button>
                    </div>
                    <div className="flex-1 flex items-center justify-center p-4 relative overflow-hidden">
                        {modalEvidences.length > 1 && (
                            <button onClick={(e) => { e.stopPropagation(); setActiveEvidenciaIndex(p => p === 0 ? modalEvidences.length - 1 : p - 1); }} className="absolute left-4 p-4 bg-black/60 hover:bg-black/90 text-white rounded-full transition-colors z-10 border border-slate-800">
                                <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                            </button>
                        )}

                        {modalEvidences[activeEvidenciaIndex].isImage ? (
                            <img src={modalEvidences[activeEvidenciaIndex].Data} alt="Evidencia" onClick={(e) => e.stopPropagation()} className="max-h-[90vh] max-w-[90vw] object-contain drop-shadow-2xl rounded-lg" />
                        ) : (
                            <div className="flex flex-col items-center justify-center space-y-6 bg-slate-900 p-10 rounded-2xl border border-slate-800 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                                <svg className="w-24 h-24 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                <div className="text-white text-lg font-bold text-center">Este documento (PDF, Word, Excel, etc.) requiere abrirse en una pestaña nueva.</div>
                                <div className="flex gap-3">
                                    <button onClick={() => {
                                        const ev = modalEvidences[activeEvidenciaIndex];
                                        const data = ev.Data;
                                        if (!data) return;
                                        if (ev.source === 'file' || /^https?:/i.test(data)) {
                                            // Archivo real en SharePoint: se abre directamente en una pestaña nueva.
                                            window.open(data, '_blank');
                                        } else {
                                            const win = window.open();
                                            win.document.write(`<iframe src="${data}" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>`);
                                        }
                                    }} className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-6 rounded-xl shadow-[0_0_15px_rgba(37,99,235,0.5)] transition-colors flex items-center gap-2">
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                                        Abrir Documento
                                    </button>
                                    <button onClick={() => setModalEvidences(null)} className="bg-slate-700 hover:bg-slate-600 text-white font-bold py-3 px-6 rounded-xl transition-colors border border-slate-600">
                                        Cerrar
                                    </button>
                                </div>
                            </div>
                        )}

                        {modalEvidences.length > 1 && (
                            <button onClick={(e) => { e.stopPropagation(); setActiveEvidenciaIndex(p => p === modalEvidences.length - 1 ? 0 : p + 1); }} className="absolute right-4 p-4 bg-black/60 hover:bg-black/90 text-white rounded-full transition-colors z-10 border border-slate-800">
                                <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                            </button>
                        )}
                    </div>
                </div>,
                document.body
            )}

            {/* Visor a pantalla completa de las fotos de los equipos a incorporar.
                En la tarjeta las fotos van recortadas (object-cover); aqui se ven
                completas, con flechas y Esc para cerrar. */}
            {fotoModal && fotoModal.fotos.length > 0 && ReactDOM.createPortal(
                <div
                    className="fixed inset-0 z-[10000] flex flex-col bg-black/95 backdrop-blur-md animate-[fadeIn_0.2s_ease-out]"
                    onClick={() => setFotoModal(null)}
                >
                    <div className="flex justify-between items-center p-4 text-white border-b border-slate-800" onClick={(e) => e.stopPropagation()}>
                        <div className="font-bold tracking-widest text-sm text-yellow-400 uppercase">
                            Fotos del equipo ({fotoModal.idx + 1} de {fotoModal.fotos.length})
                        </div>
                        <button onClick={() => setFotoModal(null)} title="Cerrar (Esc)" className="flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white font-bold px-4 py-2 rounded-xl border border-red-400/40 shadow-lg transition-colors">
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                            Cerrar
                        </button>
                    </div>
                    <div className="flex-1 flex items-center justify-center p-4 relative overflow-hidden">
                        {fotoModal.fotos.length > 1 && (
                            <button
                                onClick={(e) => { e.stopPropagation(); setFotoModal(p => ({ ...p, idx: (p.idx - 1 + p.fotos.length) % p.fotos.length })); }}
                                className="absolute left-4 p-4 bg-black/60 hover:bg-black/90 text-white rounded-full transition-colors z-10 border border-slate-800"
                            >
                                <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                            </button>
                        )}

                        <img
                            src={fotoModal.fotos[fotoModal.idx]}
                            alt={`Equipo ${fotoModal.idx + 1}`}
                            onClick={(e) => e.stopPropagation()}
                            className="max-h-[85vh] max-w-[90vw] object-contain drop-shadow-2xl rounded-lg"
                        />

                        {fotoModal.fotos.length > 1 && (
                            <button
                                onClick={(e) => { e.stopPropagation(); setFotoModal(p => ({ ...p, idx: (p.idx + 1) % p.fotos.length })); }}
                                className="absolute right-4 p-4 bg-black/60 hover:bg-black/90 text-white rounded-full transition-colors z-10 border border-slate-800"
                            >
                                <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                            </button>
                        )}
                    </div>
                    {fotoModal.fotos.length > 1 && (
                        <div className="flex justify-center gap-2 pb-5" onClick={(e) => e.stopPropagation()}>
                            {fotoModal.fotos.map((f, i) => (
                                <button key={i} onClick={() => setFotoModal(p => ({ ...p, idx: i }))} className={`rounded-lg overflow-hidden border-2 transition-all ${i === fotoModal.idx ? 'border-yellow-400 scale-105' : 'border-white/25 opacity-60 hover:opacity-100'}`}>
                                    <img src={f} alt={`Miniatura ${i + 1}`} className="h-14 w-20 object-cover" />
                                </button>
                            ))}
                        </div>
                    )}
                </div>,
                document.body
            )}

            {showRejectModal && ReactDOM.createPortal(
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-[fadeIn_0.15s_ease-out]" onClick={() => setShowRejectModal(false)}>
                    <div className="bg-slate-800 border border-white/20 p-6 rounded-2xl max-w-md w-full shadow-2xl text-white" onClick={(e) => e.stopPropagation()}>
                        <h3 className="text-lg font-medium text-red-400 mb-3 flex items-center gap-2">
                            No aprobar incorporación
                        </h3>
                        <p className="text-xs text-white mb-3 font-bold">
                            Escribe el motivo por el cual esta incorporación no fue aprobada. El creador lo verá para poder corregirla.
                        </p>
                        <textarea
                            className="w-full bg-slate-950/80 text-white border border-slate-700 focus:border-red-400 rounded-lg px-3 py-2 outline-none text-sm"
                            rows="4"
                            placeholder="Ej. Faltan las fechas de plan en varias tareas, el responsable no corresponde, etc."
                            value={rejectComment}
                            onChange={(e) => setRejectComment(e.target.value)}
                        />
                        <div className="flex gap-2 justify-end mt-4">
                            <button onClick={() => { setShowRejectModal(false); setRejectComment(''); }} className="bg-white/10 hover:bg-white/20 text-white font-bold px-4 py-2 rounded-lg text-sm transition-colors border border-white/20">Cancelar</button>
                            <button onClick={handleRechazar} className="bg-red-600 hover:bg-red-500 text-white font-bold px-4 py-2 rounded-lg text-sm transition-colors border border-red-400/30">Confirmar rechazo</button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {inactivatingItemId && ReactDOM.createPortal(
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-[fadeIn_0.15s_ease-out]">
                    <div className="bg-gray-800 border border-white/20 p-6 rounded-2xl max-w-md w-full shadow-2xl text-white">
                        <h3 className="text-lg font-medium text-yellow-400 mb-3 flex items-center gap-2">
                            {"⚠ Inactivar Tarea"}
                        </h3>
                        <p className="text-xs text-white mb-4 font-bold">
                            {"¿Por qué lo vas a inactivar? Por favor ingrese una justificación. Esta acción quedará registrada bajo su usuario corporativo."}
                        </p>
                        <textarea
                            className="w-full bg-slate-905 border border-slate-700 rounded-lg p-3 text-sm outline-none focus:border-yellow-400 mb-4 text-white bg-slate-900"
                            rows="3"
                            placeholder={"Razón de inactivación..."}
                            value={inactivateReasonText}
                            onChange={(e) => setInactivateReasonText(e.target.value)}
                            required
                        />
                        <div className="flex justify-end gap-3 text-xs font-bold">
                            <button
                                onClick={() => { setInactivatingItemId(null); setInactivateReasonText(''); }}
                                className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleConfirmInactivate}
                                className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-lg transition-colors shadow-lg"
                            >
                                Inactivar
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {tipoObjetivo && ReactDOM.createPortal(
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-[fadeIn_0.15s_ease-out]" onClick={() => !cambiandoTipo && setTipoObjetivo(null)}>
                    <div className="bg-slate-800 border border-white/20 p-6 rounded-2xl max-w-md w-full shadow-2xl text-white" onClick={(e) => e.stopPropagation()}>
                        <h3 className="text-lg font-medium text-amber-400 mb-3">Cambiar el tipo de checklist</h3>
                        <p className="text-xs text-white mb-3 font-bold">
                            Este checklist pasará de <span className="text-amber-300">{checklist.Tipo || 'Sin tipo'}</span> a{' '}
                            <span className="text-amber-300">{getTipoChecklist(tipoObjetivo)?.label}</span>.
                        </p>
                        <ul className="text-xs text-slate-200 font-semibold list-disc pl-5 space-y-1 mb-4">
                            <li>Se eliminan las {checklist.items.length} actividades actuales y se cargan las {getTipoChecklist(tipoObjetivo)?.items.length} de la plantilla correcta.</li>
                            <li>Se pierden avances, responsables, alertas y comentarios de cada tarea.</li>
                            <li>Las evidencias ya subidas quedan en la carpeta del tipo anterior y dejan de verse aquí.</li>
                            <li>El comentario general, los metadatos y el % histórico del checklist se conservan.</li>
                        </ul>
                        <div className="flex gap-2 justify-end">
                            <button
                                onClick={() => setTipoObjetivo(null)}
                                disabled={cambiandoTipo}
                                className="bg-white/10 hover:bg-white/20 text-white font-bold px-4 py-2 rounded-lg text-sm transition-colors border border-white/20 disabled:opacity-50"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleConfirmCambioTipo}
                                disabled={cambiandoTipo}
                                className="bg-amber-600 hover:bg-amber-500 text-white font-bold px-4 py-2 rounded-lg text-sm transition-colors border border-amber-400/30 disabled:opacity-50 disabled:cursor-wait"
                            >
                                {cambiandoTipo ? 'Cambiando...' : 'Sí, cambiar el tipo'}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {showGanttModal && ReactDOM.createPortal(
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 animate-[fadeIn_0.15s_ease-out]">
                    <div className={`w-full max-w-6xl max-h-[90vh] overflow-y-auto p-6 rounded-3xl border shadow-2xl relative ${theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                        <button 
                            onClick={() => setShowGanttModal(false)} 
                            className={`absolute top-4 right-4 p-2 rounded-full transition-colors ${theme === 'dark' ? 'hover:bg-white/10 text-white' : 'hover:bg-slate-100 text-slate-900'}`}
                        >
                            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                        <div className="mt-4">
                            <GanttChart items={checklist.items} />
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default CheckListDetalle;
