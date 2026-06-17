import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { calcularCumplimiento } from '../utils/calculations';
import { notificarTeams } from '../utils/notifications';
import { getRequestDigest, saveToSPList, updateSPListItem, deleteSPListItem } from '../utils/sharepointApi';
import { fileToBase64, comprimirImagen } from '../utils/imageCompression';
import PeoplePicker from './PeoplePicker';
import DashboardCharts from './DashboardCharts';
import GanttChart from './GanttChart';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

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

    const [filterResponsable, setFilterResponsable] = useState('');
    const [filterAlertaOnly, setFilterAlertaOnly] = useState(false);

    const [showAddTaskForm, setShowAddTaskForm] = useState(false);
    const [newTaskData, setNewTaskData] = useState({
        actividades: '',
        entregable: '',
        nombreResponsable: '',
        fechaBaselineInicio: new Date().toISOString().split('T')[0],
        fechaBaselineFin: ''
    });

    const [modalEvidences, setModalEvidences] = useState(null);
    const [activeEvidenciaIndex, setActiveEvidenciaIndex] = useState(0);

    const [showGanttModal, setShowGanttModal] = useState(false);
    const [evidenciasPresence, setEvidenciasPresence] = useState({});

    const isAdmin = role === 'Administrador';

    const fetchEvidencePresence = async () => {
        try {
            const res = await fetch(`${SITE_URL}/_api/web/lists/getbytitle('EvidenciasChecklist')/items?$select=ID_Registro&$top=5000`, {
                headers: { "Accept": "application/json;odata=verbose" }, credentials: "same-origin"
            });
            const json = await res.json();
            const results = json.d?.results || [];
            const presenceMap = {};
            results.forEach(r => {
                if (r.ID_Registro) presenceMap[r.ID_Registro] = true;
            });
            setEvidenciasPresence(presenceMap);
        } catch (err) {
            console.error("Error consultando presencia de evidencias:", err);
        }
    };

    const editingIdRef = useRef(editingId);
    useEffect(() => {
        editingIdRef.current = editingId;
    }, [editingId]);

    useEffect(() => {
        const fetchDetails = async (isBackgroundPoll = false) => {
            try {
                const listRes = await fetch(`${SITE_URL}/_api/web/lists/getbytitle('DB_CHECKLIST_APP')/items?$filter=Title eq '${checklistId}'`, {
                    headers: { "Accept": "application/json;odata=verbose" }, credentials: "same-origin"
                });
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
                        fetchEvidencePresence();
                    } else {
                        setChecklist({ ...parsedData, SharePointId: row.Id });
                        setGeneralComment(parsedData.ComentarioGeneral || '');
                        fetchEvidencePresence();
                    }
                }
            } catch (error) {
                console.error("Error loading details:", error);
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

    const cargarEvidencias = async (itemId) => {
        setCargandoEvidencias(prev => ({ ...prev, [itemId]: true }));
        try {
            const res = await fetch(`${SITE_URL}/_api/web/lists/getbytitle('EvidenciasChecklist')/items?$filter=ID_Registro eq '${itemId}'&$select=Id,Data,Title`, {
                headers: { "Accept": "application/json;odata=verbose" }, credentials: "same-origin"
            });
            const json = await res.json();
            const list = json.d.results || [];
            setEvidenciasItem(prev => ({ ...prev, [itemId]: list }));
            setEvidenciasPresence(prev => ({ ...prev, [itemId]: list.length > 0 }));
        } catch (error) {
            console.error("Error cargando evidencias", error);
        }
        setCargandoEvidencias(prev => ({ ...prev, [itemId]: false }));
    };

    const handleFileUpload = async (itemId, e) => {
        const files = Array.from(e.target.files);
        if (!files.length) return;
        setIsUploading(true);
        try {
            const digest = await getRequestDigest();
            for (let file of files) {
                let base64Data = "";

                if (file.type.startsWith('image/')) {
                    base64Data = await comprimirImagen(file, 1024, 0.6);
                } else {
                    const maxSize = 2 * 1024 * 1024;
                    if (file.size > maxSize) {
                        alert(`El archivo "${file.name}" supera el límite de 2MB. SharePoint no puede procesar documentos de texto tan pesados por esta vía.`);
                        continue;
                    }
                    base64Data = await fileToBase64(file);
                }

                if (base64Data) {
                    await saveToSPList('EvidenciasChecklist', {
                        Title: `Evidencia_${itemId}_${Date.now()}`,
                        ID_Registro: itemId.toString(),
                        Data: base64Data
                    }, digest);
                }
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

    const eliminarEvidencia = async (itemId, evidenciaId) => {
        if (!window.confirm("¿Seguro que deseas eliminar esta evidencia?")) return;
        try {
            const digest = await getRequestDigest();
            await deleteSPListItem('EvidenciasChecklist', evidenciaId, digest);
            await cargarEvidencias(itemId);
        } catch (error) {
            console.error("Error eliminando evidencia", error);
            alert("Fallo al eliminar.");
        }
    };

    const handleStartEdit = (item) => {
        setEditingId(item.Id);
        setEditForm({ ...item });
    };

    const handleFinalizar = async () => {
        if (!window.confirm('¿Estás seguro de finalizar este checklist? Una vez finalizado no podrá ser editado.')) return;
        try {
            const digest = await getRequestDigest();
            const hoy = new Date().toISOString().split('T')[0];
            const updatedChecklist = {
                ...checklist,
                Estado: 'Finalizado',
                Metadata: { ...checklist.Metadata, fechaFinDiligenciamiento: hoy }
            };
            await updateSPListItem('DB_CHECKLIST_APP', checklist.SharePointId, {
                Data: JSON.stringify(updatedChecklist)
            }, digest);
            setChecklist(updatedChecklist);
        } catch (error) {
            alert('Error finalizando el checklist.');
            console.error(error);
        }
    };

    const handleDescargarPDF = async () => {
        try {
            const container = document.createElement('div');
            container.style.cssText = 'position:absolute;left:-9999px;top:0;width:750px;padding:30px;font-family:sans-serif;color:#1f2937;background:#fff;';

            const titulo = document.createElement('h1');
            titulo.textContent = `Checklist: ${checklist.Name}`;
            titulo.style.cssText = 'font-size:24px;font-weight:800;margin-bottom:6px;color:#1e3a5f;border-bottom:3px solid #eab308;padding-bottom:10px;';
            container.appendChild(titulo);

            const meta = document.createElement('p');
            meta.style.cssText = 'font-size:11px;color:#64748b;margin-bottom:20px;';
            const tipo = checklist.Tipo || '';
            const fechaFin = checklist.Metadata?.fechaFinDiligenciamiento || new Date().toISOString().split('T')[0];
            const activas = checklist.items.filter(it => (it.Estado || it.estado) !== 'Inactivo');
            meta.textContent = `Tipo: ${tipo} | Finalizado: ${fechaFin} | Tareas: ${activas.length}`;
            container.appendChild(meta);

            activas.forEach((it, i) => {
                const card = document.createElement('div');
                card.style.cssText = 'border:2px solid #e2e8f0;border-radius:10px;padding:16px;margin-bottom:14px;background:#f8fafc;';

                const header = document.createElement('div');
                header.style.cssText = 'display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;';
                const num = document.createElement('span');
                num.style.cssText = 'background:#eab308;color:#fff;font-weight:800;font-size:11px;padding:3px 10px;border-radius:6px;flex-shrink:0;';
                num.textContent = `#${i + 1}`;
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

            const nombreArchivo = `${(checklist.Name || 'checklist').replace(/[^a-z0-9]/gi, '_')}.pdf`;
            pdf.save(nombreArchivo);

            try {
                const arrayBuffer = pdf.output('arraybuffer');
                const digest = await getRequestDigest();
                const uploadUrl = `${SITE_URL}/_api/web/GetFolderByServerRelativeUrl('/sites/co-lmn-sgia/checklist/SiteAssets/CheckList-Cerrejon/PDFs')/Files/add(url='${encodeURIComponent(nombreArchivo)}',overwrite=true)`;
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
            }
        } catch (error) {
            alert('Error generando el PDF.');
            console.error(error);
        }
    };

    const handleSaveEdit = async () => {
        const tieneEvidenciasCargadas = (evidenciasItem[editForm.Id] && evidenciasItem[editForm.Id].length > 0) || evidenciasPresence[editForm.Id];
        if (parseInt(editForm.Avance) > 90 && !tieneEvidenciasCargadas) {
            alert("Error: No puedes guardar un avance superior al 90% sin antes haber cargado al menos una evidencia.");
            return;
        }

        try {
            const digest = await getRequestDigest();
            const updatedItems = checklist.items.map(it => it.Id === editForm.Id ? {
                ...it,
                Descripcion: editForm.Descripcion,
                NombreResponsable: editForm.NombreResponsable,
                Entregable: editForm.Entregable,
                FechaInicio: editForm.FechaInicio,
                FechaFin: editForm.FechaFin,
                Avance: editForm.Avance ? editForm.Avance.toString() : "0",
                Alerta: editForm.Alerta || "No"
            } : it);
            const updatedChecklist = { ...checklist, items: updatedItems };

            await updateSPListItem('DB_CHECKLIST_APP', checklist.SharePointId, {
                Data: JSON.stringify(updatedChecklist)
            }, digest);
            setChecklist(updatedChecklist);
            setEditingId(null);
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
            const updatedChecklist = { ...checklist, items: updatedItems };

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
            const updatedChecklist = { ...checklist, items: updatedItems };

            await updateSPListItem('DB_CHECKLIST_APP', checklist.SharePointId, {
                Data: JSON.stringify(updatedChecklist)
            }, digest);
            setChecklist(updatedChecklist);
        } catch (error) {
            alert("Error reactivando el item.");
            console.error(error);
        }
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

            if (targetItem && targetItem.NombreResponsable && targetItem.NombreResponsable.toLowerCase() !== currentUser.toLowerCase()) {
                notificarTeams(
                    "Nuevo Comentario",
                    targetItem.NombreResponsable,
                    `El usuario ${currentUser} ha comentado en tu tarea "${targetItem.Descripcion}": ${text}`,
                    checklist.Name
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

            if (newAlerta === "Si" && item.NombreResponsable && item.NombreResponsable.toLowerCase() !== currentUser.toLowerCase()) {
                notificarTeams(
                    "Alerta Activada",
                    item.NombreResponsable,
                    `El usuario ${currentUser} ha marcado una alerta en tu tarea: "${item.Descripcion}".`,
                    checklist.Name
                );
            }
        } catch (error) { console.error(error); }
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
            const updatedChecklist = { ...checklist, items: updatedItems };

            await updateSPListItem('DB_CHECKLIST_APP', checklist.SharePointId, {
                Data: JSON.stringify(updatedChecklist)
            }, digest);

            setChecklist(updatedChecklist);
            setShowAddTaskForm(false);
            setNewTaskData({
                actividades: '',
                entregable: '',
                nombreResponsable: '',
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
    if (!checklist) return <div className="text-center text-white mt-20">Checklist no encontrado.</div>;

    const checklistEstado = checklist.Estado || '';
    const isFinalizado = checklistEstado === 'Finalizado';
    const activas = checklist.items.filter(it => (it.Estado || it.estado) !== 'Inactivo');
    const inactivas = checklist.items.filter(it => (it.Estado || it.estado) === 'Inactivo');
    const listadoOrdenado = [...activas, ...inactivas];
    const allTasksComplete = activas.length > 0 && activas.every(it => parseInt(it.Avance || it.avance || 0) === 100);

    const listadoResponsablesUnicos = [...new Set(checklist.items.map(it => it.NombreResponsable).filter(Boolean))].sort();

    let itemsFiltrados = listadoOrdenado;
    if (filterResponsable) {
        itemsFiltrados = itemsFiltrados.filter(it => it.NombreResponsable === filterResponsable);
    }
    if (filterAlertaOnly) {
        itemsFiltrados = itemsFiltrados.filter(it => it.Alerta === 'Si');
    }

    return (
        <div className="max-w-[95%] mx-auto animate-[fadeIn_0.3s_ease-out]">
            <div className={`${cardClass} border p-6 rounded-3xl mb-6 flex justify-between items-center flex-wrap gap-3`}>
                <div className="flex items-center gap-3">
                    <h2 className="text-3xl font-extrabold mb-1"><span className={theme==='dark' ? 'text-yellow-400' : 'text-amber-600'}>{"Checklist:"}</span> {checklist.Name}</h2>
                    {isFinalizado && <span className="bg-green-500/20 text-green-500 dark:text-green-400 px-3 py-1 rounded-full text-xs font-extrabold border border-green-500/30 whitespace-nowrap">FINALIZADO</span>}
                </div>
                <div className="flex items-center gap-2">
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
                    <button className={`${theme === 'dark' ? 'bg-white/10 hover:bg-white/20 border-white/30 text-white' : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700'} border py-2 px-4 rounded-lg flex items-center gap-2 font-semibold transition-colors`} onClick={onAtras}>
                        &larr; {"Volver"}
                    </button>
                </div>
            </div>

            {checklist.Metadata && (
                <div className={`border rounded-2xl overflow-hidden text-sm mb-8 shadow-lg ${theme === 'dark' ? 'border-slate-800 bg-slate-900/60' : 'border-slate-200 bg-white'}`}>
                    <div className={`flex flex-col md:flex-row border-b ${theme === 'dark' ? 'border-slate-800' : 'border-slate-200'}`}>
                        <div className={`w-full md:w-1/3 p-5 border-r flex flex-col gap-2 ${theme === 'dark' ? 'border-slate-800' : 'border-slate-200'}`}>
                            <span className="font-extrabold text-[10px] uppercase tracking-widest text-slate-500 mb-2">DESCRIPCIÓN DE EQUIPO(S) A INCORPORAR</span>
                            {checklist.Metadata.equipos.map((eq, idx) => (
                                <div key={idx} className={`p-3 rounded-lg border text-xs whitespace-pre-wrap ${theme === 'dark' ? 'bg-slate-950/40 border-slate-800 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'}`}>{eq || '-'}</div>
                            ))}
                            {((checklist.Metadata.imagenesEquipo && checklist.Metadata.imagenesEquipo.length > 0) || checklist.Metadata.imagenEquipo) && (
                                <div className={`mt-3 pt-3 border-t ${theme === 'dark' ? 'border-slate-800' : 'border-slate-200'}`}>
                                    <span className="font-bold text-[10px] uppercase tracking-wider text-slate-500 block mb-2">FOTOS DEL EQUIPO</span>
                                    <div className="flex flex-wrap gap-2">
                                        {checklist.Metadata.imagenesEquipo ? (
                                            checklist.Metadata.imagenesEquipo.map((img, idx) => (
                                                <img key={idx} src={img} alt="Equipo" className="max-h-24 rounded-lg border border-slate-300 dark:border-slate-700 object-cover shadow-lg" />
                                            ))
                                        ) : (
                                            <img src={checklist.Metadata.imagenEquipo} alt="Equipo" className="max-h-24 rounded-lg border border-slate-300 dark:border-slate-700 object-cover shadow-lg" />
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="w-full md:w-2/3 flex flex-col">
                            <div className={`grid grid-cols-12 border-b font-bold text-[10px] uppercase tracking-wider text-slate-500 ${theme === 'dark' ? 'border-slate-800 bg-slate-950/40' : 'border-slate-200 bg-slate-100'}`}>
                                <div className={`col-span-3 p-3 border-r ${theme === 'dark' ? 'border-slate-800' : 'border-slate-200'} flex items-center`}>ROL</div>
                                <div className={`col-span-4 p-3 border-r ${theme === 'dark' ? 'border-slate-800' : 'border-slate-200'} flex items-center`}>Área</div>
                                <div className="col-span-5 p-3 flex items-center">Nombre representante</div>
                            </div>
                            {['lider', 'custodio', 'operador', 'mantenedor'].map((roleKey) => (
                                <div
                                    key={roleKey}
                                    className={`grid grid-cols-12 border-b items-stretch ${theme === 'dark' ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-white'}`}
                                >
                                    <div className={`col-span-3 p-3 border-r font-bold text-[10px] uppercase flex items-center ${theme === 'dark' ? 'border-slate-800 bg-slate-950/20 text-yellow-100' : 'border-slate-200 bg-slate-100/50 text-slate-700'}`}>
                                        {roleKey === 'lider' ? 'LÍDER DE PROYECTO' : roleKey}
                                    </div>
                                    <div className={`col-span-4 p-3 border-r ${theme === 'dark' ? 'border-slate-800 text-slate-300' : 'border-slate-200 text-slate-800'} flex items-center text-xs`}>
                                        {checklist.Metadata.roles[roleKey].area || '-'}
                                    </div>
                                    <div className={`col-span-5 p-3 flex items-center gap-3 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-800'}`}>
                                        {checklist.Metadata.roles[roleKey].persona ? (
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
                                        ) : <span className="text-slate-400 text-xs italic">-</span>}
                                    </div>
                                </div>
                            ))}

                            <div className={`grid grid-cols-12 border-b items-stretch ${theme === 'dark' ? 'border-slate-800 bg-slate-950/20' : 'border-slate-200 bg-slate-50'}`}>
                                <div className={`col-span-3 p-3 border-r font-bold text-[10px] uppercase flex items-center ${theme === 'dark' ? 'border-slate-800 text-yellow-100' : 'border-slate-200 text-slate-600'}`}>GERENCIA</div>
                                <div className="col-span-9 p-3 flex items-center text-xs font-semibold">{checklist.Metadata?.gerencia || '-'}</div>
                            </div>
                            <div className={`grid grid-cols-12 border-b items-stretch ${theme === 'dark' ? 'border-slate-800 bg-slate-950/20' : 'border-slate-200 bg-slate-50'}`}>
                                <div className={`col-span-3 p-3 border-r font-bold text-[10px] uppercase flex items-center ${theme === 'dark' ? 'border-slate-800 text-yellow-100' : 'border-slate-200 text-slate-600'}`}>SUPERINTENDENCIA</div>
                                <div className="col-span-9 p-3 flex items-center text-xs font-semibold">{checklist.Metadata?.superintendencia || '-'}</div>
                            </div>
                            <div className={`grid grid-cols-12 items-stretch ${theme === 'dark' ? 'border-slate-800 bg-slate-950/20' : 'border-slate-200 bg-slate-50'}`}>
                                <div className={`col-span-3 p-3 border-r font-bold text-[10px] uppercase flex items-center ${theme === 'dark' ? 'border-slate-800 text-yellow-100' : 'border-slate-200 text-slate-600'}`}>UNIDAD DE PROCESO</div>
                                <div className="col-span-9 p-3 flex items-center text-xs font-semibold">{checklist.Metadata?.unidadProceso || '-'}</div>
                            </div>
                        </div>
                    </div>
                    <div className={`flex flex-col md:flex-row border border-b-0 ${theme === 'dark' ? 'bg-slate-950/20 border-slate-800' : 'bg-slate-100/50 border-slate-200'}`}>
                        <div className={`w-full md:w-1/3 flex border-b md:border-b-0 ${theme === 'dark' ? 'border-slate-800' : 'border-slate-200'}`}>
                            <div className={`w-1/2 p-3 font-bold text-[10px] uppercase flex flex-col justify-center border-r text-slate-400 dark:text-slate-500 ${theme === 'dark' ? 'border-slate-800' : 'border-slate-200'}`}>
                                Inicio Diligenciamiento
                                <span className="text-slate-700 dark:text-slate-300 text-xs mt-1">
                                    {checklist.Metadata.fechaInicioDiligenciamiento || '-'}
                                </span>
                            </div>
                            <div className={`w-1/2 p-3 font-bold text-[10px] uppercase flex flex-col justify-center border-r text-slate-400 dark:text-slate-500 ${theme === 'dark' ? 'border-slate-800' : 'border-slate-200'}`}>
                                Fin Diligenciamiento
                                <span className="text-slate-700 dark:text-slate-300 text-xs mt-1">
                                    {checklist.Metadata.fechaFinDiligenciamiento || '-'}
                                </span>
                            </div>
                        </div>
                        <div className="w-full md:w-2/3 flex">
                            <div className="w-full p-4 text-xs">
                                <span className="font-bold text-[10px] uppercase text-slate-400 dark:text-slate-500 block mb-1">
                                    Comentarios Generales Metadatos:
                                </span>
                                <span className="text-slate-600 dark:text-slate-300 whitespace-pre-wrap font-semibold">
                                    {checklist.Metadata.comentarios || '-'}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className={`${cardClass} border p-5 rounded-2xl mb-6 flex flex-col md:flex-row gap-4 items-center justify-between`}>
                <div className="flex flex-col md:flex-row gap-4 flex-1 w-full">
                    <div className="flex flex-col w-full md:w-1/3">
                        <span className="text-[10px] uppercase font-bold text-slate-500 mb-1">{"Filtrar por Responsable"}</span>
                        <select className={`${inputClasses} text-xs font-semibold`} value={filterResponsable} onChange={(e) => setFilterResponsable(e.target.value)}>
                            <option value="">{"Todos los Responsables"}</option>
                            {listadoResponsablesUnicos.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                    </div>
                    <div className="flex items-center gap-2 mt-4 md:mt-0">
                        <input type="checkbox" id="detAlertCheckbox" checked={filterAlertaOnly} onChange={(e) => setFilterAlertaOnly(e.target.checked)} className="accent-yellow-500 cursor-pointer h-4 w-4" />
                        <label htmlFor="detAlertCheckbox" className="text-xs font-bold text-slate-600 dark:text-slate-300 cursor-pointer">{"Mostrar solo tareas en Alerta"}</label>
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
                                <label className={`block text-xs font-bold mb-1 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>{"Descripción de la Tarea"}</label>
                                <textarea className={inputClasses + " text-xs"} value={newTaskData.actividades} onChange={(e) => setNewTaskData({ ...newTaskData, actividades: e.target.value })} rows="2" required></textarea>
                            </div>
                            <div className="md:col-span-4">
                                <label className={`block text-xs font-bold mb-1 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>Responsable</label>
                                <PeoplePicker className={inputClasses + " text-xs"} value={newTaskData.nombreResponsable} onChange={(val) => setNewTaskData(prev => ({ ...prev, nombreResponsable: val }))} />
                            </div>
                            <div className="md:col-span-4">
                                <label className={`block text-xs font-bold mb-1 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>Entregable</label>
                                <input type="text" className={inputClasses + " text-xs"} value={newTaskData.entregable} onChange={(e) => setNewTaskData({ ...newTaskData, entregable: e.target.value })} required></input>
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-xs font-bold text-blue-500 dark:text-blue-300 mb-1">Plan Inicio (Baseline)</label>
                                <input type="date" className={inputClasses + " text-xs"} value={newTaskData.fechaBaselineInicio} onChange={(e) => setNewTaskData({ ...newTaskData, fechaBaselineInicio: e.target.value })} required></input>
                            </div>
                            <div className="md:col-span-2">
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
                {itemsFiltrados.map((it, idx) => {
                    const isEditing = editingId === it.Id;
                    const currentItem = isEditing ? editForm : it;
                    const isMyTask = currentUser === it.NombreResponsable;
                    const isInactive = (it.Estado || it.estado) === 'Inactivo';
                    const showAlert = it.Alerta === "Si";

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
                                                ? (theme === 'dark' ? 'bg-slate-800 text-slate-400' : 'bg-slate-200 text-slate-600') 
                                                : showAlert ? 'bg-red-500 text-white' 
                                                : 'bg-amber-600 text-white shadow'
                                        }`}>
                                            #{idx + 1}
                                        </span>
                                        {isEditing ? (
                                            <textarea className={`${inputClasses} text-sm font-semibold`} rows="2" value={currentItem.Descripcion} onChange={e => setEditForm({ ...editForm, Descripcion: e.target.value })} />
                                        ) : (
                                            <div className="flex flex-col flex-1">
                                                <h4 className={`text-lg font-bold leading-snug break-words text-[15px] ${
                                                    isInactive 
                                                        ? (theme === 'dark' ? 'text-slate-400 line-through decoration-slate-500/80' : 'text-slate-500 line-through decoration-slate-400') 
                                                        : showAlert ? 'text-red-200' 
                                                        : theme==='dark'?'text-yellow-400':'text-slate-800'
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
                                            <span className={`block text-[10px] font-bold uppercase tracking-wider mb-1 ${isInactive ? 'text-slate-500' : 'text-slate-400 dark:text-slate-500'}`}>{"Responsable"}</span>
                                            {isEditing ? (
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
                                                    <span className={`font-semibold text-xs break-all ${isInactive ? (theme === 'dark' ? 'text-slate-300' : 'text-slate-750') : ''}`}>{it.NombreResponsable}</span>
                                                </div>
                                            )}
                                        </div>

                                        <div className="col-span-1">
                                            <span className={`block text-[10px] font-bold uppercase tracking-wider mb-1 ${isInactive ? 'text-slate-500' : 'text-slate-400 dark:text-slate-500'}`}>{"Entregable"}</span>
                                            <span className={`font-semibold text-xs break-words ${isInactive ? (theme === 'dark' ? 'text-slate-300' : 'text-slate-750') : ''}`}>{it.Entregable || '-'}</span>
                                        </div>

                                        <div className="col-span-1 md:col-span-2 lg:col-span-1">
                                            <span className={`block text-[10px] font-bold uppercase tracking-wider mb-1 ${isInactive ? 'text-slate-500' : 'text-slate-400 dark:text-slate-500'}`}>Fechas Plan</span>
                                            <div className={`p-2 rounded border shadow-inner ${theme==='dark'?'bg-slate-950 border-slate-850':'bg-slate-100 border-slate-200 text-slate-700'}`}>
                                                <span className="font-semibold block text-[11px]"><span className="text-blue-500 dark:text-blue-300 font-bold w-4 inline-block">I:</span> {it.FechaBaselineInicio || '-'}</span>
                                                <span className="font-semibold block text-[11px] mt-1"><span className="text-blue-500 dark:text-blue-300 font-bold w-4 inline-block">F:</span> {it.FechaBaselineFin || '-'}</span>
                                            </div>
                                        </div>

                                        <div className="col-span-1 md:col-span-2 lg:col-span-1">
                                            <span className={`block text-[10px] font-bold uppercase tracking-wider mb-1 ${isInactive ? 'text-slate-500' : 'text-slate-400 dark:text-slate-500'}`}>Fechas Reales</span>
                                            {isEditing ? (
                                                <div className="flex flex-col gap-1.5 mt-1">
                                                    <div className="flex items-center gap-1.5 text-xs"><span className="w-4 font-bold text-yellow-500">I:</span><input type="date" className="bg-transparent border-none text-xs w-full" value={currentItem.FechaInicio ? currentItem.FechaInicio.substring(0, 10) : ''} onChange={e => setEditForm({ ...editForm, FechaInicio: e.target.value })} /></div>
                                                    <div className="flex items-center gap-1.5 text-xs"><span className="w-4 font-bold text-yellow-500">F:</span><input type="date" className="bg-transparent border-none text-xs w-full" value={currentItem.FechaFin ? currentItem.FechaFin.substring(0, 10) : ''} onChange={e => setEditForm({ ...editForm, FechaFin: e.target.value })} /></div>
                                                </div>
                                            ) : (
                                                <div className={`p-2 rounded border shadow-inner ${theme==='dark'?'bg-slate-950 border-slate-850':'bg-slate-105 border-slate-200 text-slate-700 bg-slate-100'}`}>
                                                    <span className="font-semibold block text-[11px]"><span className="text-yellow-600 dark:text-yellow-400 font-bold w-4 inline-block">I:</span> {it.FechaInicio ? it.FechaInicio.substring(0, 10) : '-'}</span>
                                                    <span className="font-semibold block text-[11px] mt-1"><span className="text-yellow-600 dark:text-yellow-400 font-bold w-4 inline-block">F:</span> {it.FechaFin ? it.FechaFin.substring(0, 10) : '-'}</span>
                                                </div>
                                            )}
                                        </div>

                                        <div className="col-span-1">
                                            <span className={`block text-[10px] font-bold uppercase tracking-wider mb-1 ${isInactive ? 'text-slate-500' : 'text-slate-400 dark:text-slate-500'}`}>Avance Esperado</span>
                                            <span className="text-green-500 font-black text-2xl drop-shadow">{isInactive ? 0 : calcularCumplimiento(it.FechaInicio, it.FechaFin)}%</span>
                                        </div>

                                        <div className="col-span-1">
                                            <span className={`block text-[10px] font-bold uppercase tracking-wider mb-1 ${isInactive ? 'text-slate-500' : 'text-slate-400 dark:text-slate-500'}`}>Avance Real</span>
                                            {isEditing ? (
                                                <input type="number" className="w-20 bg-transparent border-b border-slate-300 focus:border-yellow-500 text-lg font-bold mt-1 outline-none" value={currentItem.Avance || 0} onChange={e => {
                                                    let val = parseInt(e.target.value) || 0;
                                                    if (val > 90 && (!evidenciasItem[it.Id] || evidenciasItem[it.Id].length === 0) && !evidenciasPresence[it.Id]) val = 90;
                                                    setEditForm({ ...editForm, Avance: val });
                                                }} />
                                            ) : (
                                                <span className="text-yellow-600 dark:text-yellow-400 font-black text-2xl drop-shadow">{isInactive ? 0 : (it.Avance || 0)}%</span>
                                            )}
                                        </div>

                                         {!isInactive && (
                                            <div className="col-span-1 lg:col-span-6 border-t border-slate-200 dark:border-slate-800 pt-3">
                                                <div className="flex justify-between items-center mb-2">
                                                    <span className="text-slate-400 dark:text-slate-500 text-[10px] font-bold uppercase tracking-wider flex items-center gap-2">
                                                        Evidencias Cargadas
                                                        {evidenciasPresence[it.Id] && (
                                                            <span className="bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20 px-1.5 py-0.5 rounded text-[9px] font-black tracking-normal uppercase">
                                                                Tiene Evidencias
                                                            </span>
                                                        )}
                                                    </span>
                                                    <div className="flex gap-2">
                                                        {evidenciasItem[it.Id] && evidenciasItem[it.Id].length > 0 && (
                                                            <button onClick={() => { setModalEvidences(evidenciasItem[it.Id]); setActiveEvidenciaIndex(0); }} className="text-[10px] bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 px-2 py-1 rounded border border-yellow-500/30 transition-colors shadow flex items-center gap-1 font-semibold">
                                                                Ver Visualizador
                                                            </button>
                                                        )}
                                                        <button onClick={() => cargarEvidencias(it.Id)} className="text-[10px] bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-300 px-2 py-1 rounded border border-blue-500/30 transition-colors shadow font-semibold">
                                                            &#8635; Cargar / Actualizar
                                                        </button>
                                                    </div>
                                                </div>

                                                <div className={`space-y-3 p-3 rounded-lg border ${theme==='dark'?'bg-slate-950/40 border-slate-850':'bg-slate-100 border-slate-200'}`}>
                                                    {cargandoEvidencias[it.Id] ? (
                                                        <span className="text-yellow-500 text-xs italic block text-center">Consultando servidor...</span>
                                                    ) : (
                                                        <div className="flex flex-wrap gap-3">
                                                            {(!evidenciasItem[it.Id] || evidenciasItem[it.Id].length === 0) ? (
                                                                <span className="text-slate-400 text-xs italic">Debes hacer clic en "Actualizar" para ver las evidencias, o no se ha cargado ninguna.</span>
                                                            ) : (
                                                                evidenciasItem[it.Id].map(ev => (
                                                                    <div key={ev.Id} className="relative group border border-slate-200 dark:border-slate-800 rounded-md p-1 bg-white dark:bg-slate-900 shadow-lg">
                                                                        {ev.Data && ev.Data.startsWith('data:image') ? (
                                                                            <img src={ev.Data} className="h-16 w-16 object-cover rounded cursor-pointer hover:opacity-80 transition-opacity" onClick={() => { setModalEvidences(evidenciasItem[it.Id]); setActiveEvidenciaIndex(evidenciasItem[it.Id].findIndex(e => e.Id === ev.Id)); }} />
                                                                        ) : (
                                                                            <div className="h-16 w-16 flex flex-col items-center justify-center text-[10px] font-bold text-slate-500 rounded cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-850 transition-colors text-center" onClick={() => { setModalEvidences(evidenciasItem[it.Id]); setActiveEvidenciaIndex(evidenciasItem[it.Id].findIndex(e => e.Id === ev.Id)); }}>
                                                                                DOC
                                                                            </div>
                                                                        )}
                                                                        {!isFinalizado && (isAdmin || isMyTask) && (
                                                                            <button onClick={() => eliminarEvidencia(it.Id, ev.Id)} className="absolute -top-2 -right-2 bg-red-600 hover:bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold opacity-0 group-hover:opacity-100 transition-opacity shadow-md">&times;</button>
                                                                        )}
                                                                    </div>
                                                                ))
                                                            )}
                                                        </div>
                                                    )}

                                                    {!isFinalizado && (isMyTask || isAdmin) && (
                                                        <div className={`pt-2 border-t ${theme==='dark'?'border-slate-800':'border-slate-200'}`}>
                                                            <input type="file" multiple className="text-[10px] text-slate-500 w-full file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-[10px] file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-500 transition-all cursor-pointer block" onChange={(e) => handleFileUpload(it.Id, e)} accept="image/*,.pdf,.doc,.docx,.xls,.xlsx" disabled={isUploading} />
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
                                                <span className="text-slate-400 dark:text-slate-500 text-[10px] font-bold uppercase tracking-wider">Historial de Comentarios</span>
                                                {!isFinalizado && isAdmin && !isEditing && (
                                                    <button onClick={() => toggleAlert(it)} className={`text-[10px] font-bold px-2 py-1 rounded border shadow-sm ${showAlert ? 'bg-red-500/20 text-red-400 border-red-500/50' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'} transition-colors`}>
                                                        {showAlert ? 'Quitar Alerta' : 'Marcar Alerta'}
                                                    </button>
                                                )}
                                            </div>

                                            <div className="space-y-2 mb-4 max-h-40 overflow-y-auto pr-2">
                                                {(!it.HistorialComentarios || it.HistorialComentarios.length === 0) ? (
                                                    <p className="text-slate-400 text-xs italic">No hay comentarios.</p>
                                                ) : (
                                                    it.HistorialComentarios.map((com, index) => (
                                                        <div key={index} className={`p-3 rounded-lg border ${theme==='dark'?'bg-slate-950/20 border-slate-850':'bg-white border-slate-200'}`}>
                                                            <div className="flex justify-between items-center mb-1 border-b border-slate-200 dark:border-slate-800 pb-1">
                                                                <span className="text-yellow-600 dark:text-yellow-500 font-bold text-xs">{com.autor}</span>
                                                                <span className="text-slate-400 text-[10px]">{new Date(com.fecha).toLocaleString()}</span>
                                                            </div>
                                                            <p className="text-slate-700 dark:text-slate-300 text-sm whitespace-pre-wrap">{com.texto}</p>
                                                        </div>
                                                    ))
                                                )}
                                            </div>

                                            {!isFinalizado && (isAdmin || isMyTask) && (
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
                                        <span className="px-4 py-2.5 rounded-xl text-xs font-black text-center w-full shadow-md border bg-slate-500/10 border-slate-500/20 text-slate-500 dark:text-slate-400 flex items-center justify-center gap-1">
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
                                            <button onClick={() => { setEditingId(null); setEditForm({}); }} className="bg-gray-500/20 hover:bg-gray-500/40 text-gray-600 dark:text-gray-300 border border-gray-500/30 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors w-full shadow-sm">Cancelar</button>
                                        </>
                                    ) : (
                                        (isAdmin || isMyTask) && <button onClick={() => handleStartEdit(it)} className="bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-300 border border-blue-500/20 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors w-full shadow-sm">Editar</button>
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

            <DashboardCharts items={checklist.items} theme={theme} />

            <div className={`${cardClass} border p-6 rounded-3xl mt-8`}>
                <h3 className={`text-xl font-bold mb-4 flex items-center gap-2 ${theme === 'dark' ? 'text-yellow-400' : 'text-amber-700'}`}>
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
                            <p className="text-slate-400 italic">Sin comentarios generales por el momento.</p>
                        )}
                    </div>
                )}
            </div>

            {modalEvidences && modalEvidences.length > 0 && activeEvidenciaIndex !== null && (
                <div className="fixed inset-0 z-[120] flex flex-col bg-black/95 backdrop-blur-md animate-[fadeIn_0.2s_ease-out]">
                    <div className="flex justify-between items-center p-4 text-white border-b border-slate-800">
                        <div className="font-bold tracking-widest text-sm text-yellow-400 uppercase">
                            Evidencia del Checklist ({activeEvidenciaIndex + 1} de {modalEvidences.length})
                        </div>
                        <button onClick={() => setModalEvidences(null)} className="bg-white/10 p-2 rounded-full hover:text-red-500 transition-colors">
                            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>
                    <div className="flex-1 flex items-center justify-center p-4 relative overflow-hidden">
                        {modalEvidences.length > 1 && (
                            <button onClick={() => setActiveEvidenciaIndex(p => p === 0 ? modalEvidences.length - 1 : p - 1)} className="absolute left-4 p-4 bg-black/60 hover:bg-black/90 text-white rounded-full transition-colors z-10 border border-slate-800">
                                <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                            </button>
                        )}

                        {modalEvidences[activeEvidenciaIndex].Data?.startsWith('data:image') ? (
                            <img src={modalEvidences[activeEvidenciaIndex].Data} alt="Evidencia" className="max-h-[90vh] max-w-[90vw] object-contain drop-shadow-2xl rounded-lg" />
                        ) : (
                            <div className="flex flex-col items-center justify-center space-y-6 bg-slate-900 p-10 rounded-2xl border border-slate-800 shadow-2xl">
                                <svg className="w-24 h-24 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                <div className="text-white/70 text-lg font-medium text-center">Este documento (PDF, Word, Excel, etc.) requiere abrirse en una pestaña nueva.</div>
                                <button onClick={() => {
                                    const data = modalEvidences[activeEvidenciaIndex].Data;
                                    if (data) {
                                        const win = window.open();
                                        win.document.write(`<iframe src="${data}" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>`);
                                    }
                                }} className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-6 rounded-xl shadow-[0_0_15px_rgba(37,99,235,0.5)] transition-colors flex items-center gap-2">
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                                    Abrir Documento
                                </button>
                            </div>
                        )}

                        {modalEvidences.length > 1 && (
                            <button onClick={() => setActiveEvidenciaIndex(p => p === modalEvidences.length - 1 ? 0 : p + 1)} className="absolute right-4 p-4 bg-black/60 hover:bg-black/90 text-white rounded-full transition-colors z-10 border border-slate-800">
                                <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                            </button>
                        )}
                    </div>
                </div>
            )}

            {inactivatingItemId && ReactDOM.createPortal(
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-[fadeIn_0.15s_ease-out]">
                    <div className="bg-gray-800 border border-white/20 p-6 rounded-2xl max-w-md w-full shadow-2xl text-white">
                        <h3 className="text-lg font-bold text-yellow-400 mb-3 flex items-center gap-2">
                            {"⚠ Inactivar Tarea"}
                        </h3>
                        <p className="text-xs text-white/80 mb-4 font-normal">
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

            {showGanttModal && ReactDOM.createPortal(
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 animate-[fadeIn_0.15s_ease-out]">
                    <div className={`w-full max-w-6xl max-h-[90vh] overflow-y-auto p-6 rounded-3xl border shadow-2xl relative ${theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                        <button 
                            onClick={() => setShowGanttModal(false)} 
                            className={`absolute top-4 right-4 p-2 rounded-full transition-colors ${theme === 'dark' ? 'hover:bg-white/10 text-white/70' : 'hover:bg-slate-100 text-slate-700'}`}
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
