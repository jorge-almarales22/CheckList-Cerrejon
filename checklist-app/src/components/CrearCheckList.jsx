import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { AREAS, CHECKLIST_PROYECTOS_ITEMS, CHECKLIST_COMPRA_INSTALADA, CHECKLIST_EQUIPOS_NUEVOS_USADOS_ENSAMBLE, PREDEFINED_ITEMS } from '../data/constants';
import { getRequestDigest, saveToSPList } from '../utils/sharepointApi';
import { comprimirImagen } from '../utils/imageCompression';
import PeoplePicker from './PeoplePicker';

const CrearCheckList = ({ onAtras, currentUser, currentRole, templateType, theme }) => {
    const [nombreChecklist, setNombreChecklist] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [showAddItemForm, setShowAddItemForm] = useState(false);

    const [inactivatingItemId, setInactivatingItemId] = useState(null);
    const [inactivateReasonText, setInactivateReasonText] = useState('');
    const [backupItem, setBackupItem] = useState(null);

    const [acData, setAcData] = useState({ gerencias: [], superintendencias: [], unidades: [] });
    const [acLoading, setAcLoading] = useState(true);

    const openInactivateModal = (id) => {
        setInactivatingItemId(id);
        setInactivateReasonText('');
    };
    
    const getTipoFormulario = () => {
        if (templateType === 'proyectos') return 'PROYECTO';
        if (templateType === 'compra_instalada') return 'COMPRA INSTALADA';
        if (templateType === 'ensamble') return 'ENSAMBLE';
        return 'GENERAL';
    };

    const [metadata, setMetadata] = useState({
        equipos: [''],
        imagenesEquipo: [],
        roles: {
            lider: { area: '', persona: '' },
            custodio: { area: '', persona: '' },
            operador: { area: '', persona: '' },
            mantenedor: { area: '', persona: '' }
        },
        gerencia: '',
        superintendencia: '',
        unidadProceso: '',
        fechaInicioDiligenciamiento: new Date().toISOString().split('T')[0],
        fechaFinDiligenciamiento: 'Se completará al finalizar',
        comentarios: ''
    });

    const [items, setItems] = useState(() => {
        let sourceArray = [];
        if (templateType === 'proyectos') sourceArray = CHECKLIST_PROYECTOS_ITEMS;
        else if (templateType === 'compra_instalada') sourceArray = CHECKLIST_COMPRA_INSTALADA;
        else if (templateType === 'ensamble') sourceArray = CHECKLIST_EQUIPOS_NUEVOS_USADOS_ENSAMBLE;
        else sourceArray = PREDEFINED_ITEMS;

        const hoy = new Date().toISOString().split('T')[0];
        return sourceArray.map((act, idx) => ({
            id: Date.now() + Math.random().toString(36).substr(2, 5) + idx,
            actividades: act.tarea || act,
            entregable: act.entregable || '',
            nombreResponsable: '',
            avance: '0',
            fechaBaselineInicio: hoy,
            fechaBaselineFin: '',
            fechaInicio: hoy,
            fechaFin: '',
            isAlert: false,
            estado: 'Activo',
            inactivadoPor: '',
            inactivadoRazon: '',
            inactivadoFecha: ''
        }));
    });

    useEffect(() => {
        const fetchAcList = async () => {
            try {
                const AC_SITE_URL = "https://glencore.sharepoint.com/sites/co-lmn-sgia/ac";
                const res = await fetch(`${AC_SITE_URL}/_api/web/lists/getbytitle('EquiposAC')/items?$select=BranchGerencia,SiteSuperintendencia,UnidadProceso&$top=5000`, {
                    headers: { "Accept": "application/json;odata=verbose" },
                    credentials: 'same-origin'
                });
                const json = await res.json();
                const results = json.d?.results || [];

                const uniqueGerencias = [...new Set(results.map(r => r.BranchGerencia).filter(Boolean))].sort();
                const uniqueSuperintendencias = [...new Set(results.map(r => r.SiteSuperintendencia).filter(Boolean))].sort();
                const uniqueUnidades = [...new Set(results.map(r => r.UnidadProceso).filter(Boolean))].sort();

                setAcData({
                    gerencias: uniqueGerencias,
                    superintendencias: uniqueSuperintendencias,
                    unidades: uniqueUnidades
                });
            } catch (err) {
                console.error("Error fetching AC list:", err);
            } finally {
                setAcLoading(false);
            }
        };
        fetchAcList();
    }, []);

    const [formData, setFormData] = useState({
        actividades: '', entregable: '', nombreResponsable: '', avance: '0',
        fechaBaselineInicio: new Date().toISOString().split('T')[0], fechaBaselineFin: '',
        fechaInicio: new Date().toISOString().split('T')[0], fechaFin: '',
    });

    const [editingId, setEditingId] = useState(null);

    const handleMetadataRoleChange = (roleKey, field, value) => {
        setMetadata(prev => ({
            ...prev,
            roles: { ...prev.roles, [roleKey]: { ...prev.roles[roleKey], [field]: value } }
        }));
    };

    const handleMetadataEquipoChange = (index, value) => {
        const newEquipos = [...metadata.equipos];
        newEquipos[index] = value;
        setMetadata(prev => ({ ...prev, equipos: newEquipos }));
    };

    const addEquipo = () => {
        setMetadata(prev => ({ ...prev, equipos: [...prev.equipos, ''] }));
    };

    const handleItemEdit = (id, field, value) => {
        setItems(prev => prev.map(it => it.id === id ? { ...it, [field]: value } : it));
    };

    const handleAddItem = (e) => {
        e.preventDefault();
        const newItem = {
            ...formData,
            id: Date.now() + Math.random().toString(36).substr(2, 5),
            estado: 'Activo',
            inactivadoPor: '',
            inactivadoRazon: '',
            inactivadoFecha: ''
        };
        setItems([...items, newItem]);
        setFormData({
            actividades: '', entregable: '', nombreResponsable: '', avance: '0',
            fechaBaselineInicio: new Date().toISOString().split('T')[0], fechaBaselineFin: '',
            fechaInicio: new Date().toISOString().split('T')[0], fechaFin: ''
        });
        setShowAddItemForm(false);
    };

    const handleImageUpload = async (e) => {
        const files = Array.from(e.target.files);
        const currentImages = metadata.imagenesEquipo || [];
        if (currentImages.length >= 3) {
            alert("Máximo 3 fotos permitidas.");
            return;
        }
        const spacesLeft = 3 - currentImages.length;
        const filesToProcess = files.slice(0, spacesLeft);

        const processed = [];
        for (let file of filesToProcess) {
            try {
                const base64 = await comprimirImagen(file, 600, 0.4);
                processed.push(base64);
            } catch (err) {
                console.error("Error compressing image:", err);
            }
        }
        setMetadata(prev => ({
            ...prev,
            imagenesEquipo: [...(prev.imagenesEquipo || []), ...processed]
        }));
    };

    const handleRemoveImage = (index) => {
        setMetadata(prev => ({
            ...prev,
            imagenesEquipo: (prev.imagenesEquipo || []).filter((_, i) => i !== index)
        }));
    };

    const handleConfirmInactivate = () => {
        if (!inactivateReasonText.trim()) {
            alert('Por favor ingrese la razón de la inactivación.');
            return;
        }
        setItems(prev => prev.map(it => it.id === inactivatingItemId ? {
            ...it,
            estado: 'Inactivo',
            inactivadoPor: currentUser,
            inactivadoRazon: inactivateReasonText.trim(),
            inactivadoFecha: new Date().toISOString()
        } : it));
        setInactivatingItemId(null);
        setInactivateReasonText('');
    };

    const handleReactivarItem = (id) => {
        setItems(prev => prev.map(it => it.id === id ? {
            ...it,
            estado: 'Activo',
            inactivadoPor: '',
            inactivadoRazon: '',
            inactivadoFecha: ''
        } : it));
    };

    const handleGuardarChecklist = async () => {
        if (!nombreChecklist.trim()) { alert('Ingresa el nombre del checklist.'); return; }
        if (items.length === 0) { alert('Agrega al menos un ítem.'); return; }

        setIsSaving(true);
        const newChecklistId = 'CHK-' + Date.now();

        try {
            const digest = await getRequestDigest();
            const finalItems = items.map((it) => ({
                Id: it.id.toString(),
                Descripcion: it.actividades,
                NombreResponsable: it.nombreResponsable,
                Entregable: it.entregable,
                Avance: it.avance ? it.avance.toString() : "0",
                FechaBaselineInicio: it.fechaBaselineInicio,
                FechaBaselineFin: it.fechaBaselineFin,
                FechaInicio: it.fechaInicio,
                FechaFin: it.fechaFin,
                Alerta: "No",
                HistorialComentarios: [],
                Estado: it.estado || "Activo",
                InactivadoPor: it.inactivadoPor || "",
                InactivadoRazon: it.inactivadoRazon || "",
                InactivadoFecha: it.inactivadoFecha || ""
            }));

            const checklistData = {
                ID_x002d_checklist: newChecklistId,
                Name: nombreChecklist,
                ComentarioGeneral: "",
                Tipo: getTipoFormulario(),
                Metadata: metadata,
                items: finalItems
            };

            await saveToSPList('DB_CHECKLIST_APP', {
                Title: newChecklistId,
                Data: JSON.stringify(checklistData)
            }, digest);

            alert('Checklist guardado con éxito en SharePoint!');
            onAtras();

        } catch (error) {
            console.error("Error saving:", error);
            alert("Ocurrió un error guardando en SharePoint. Verifica la consola.");
        } finally {
            setIsSaving(false);
        }
    };

    const cardClass = theme === 'dark' 
        ? 'bg-slate-900 border-slate-800 text-slate-100 shadow-[0_0_20px_rgba(0,0,0,0.5)]' 
        : 'bg-white border-slate-200 text-slate-900 shadow-md shadow-slate-100';

    const inputClasses = theme === 'dark'
        ? "w-full bg-slate-950/80 text-white border border-slate-800 focus:border-yellow-400 rounded px-3 py-2 outline-none transition-all duration-300"
        : "w-full bg-slate-100/90 text-slate-900 border border-slate-300 focus:border-yellow-500 rounded px-3 py-2 outline-none transition-all duration-300";

    const tableBg = theme === 'dark' ? 'bg-slate-950/50' : 'bg-slate-50';

    let titlePrefix = templateType === 'proyectos' ? "Plantilla: Proyectos" : templateType === 'compra_instalada' ?
        "Plantilla: Compra Instalada" : templateType === 'ensamble' ? "Plantilla: Ensamble" : "Crear Nuevo Checklist";

    const activas = items.filter(it => it.estado !== 'Inactivo');
    const inactivas = items.filter(it => it.estado === 'Inactivo');
    const listadoOrdenado = [...activas, ...inactivas];

    return (
        <div className={`${cardClass} border p-8 rounded-3xl mt-8 mx-auto max-w-[95%] animate-[fadeIn_0.3s_ease-out]`}>
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-200 dark:border-slate-800">
                <h2 className={`text-2xl lg:text-3xl font-extrabold text-transparent bg-clip-text ${theme === 'dark' ? 'bg-gradient-to-r from-yellow-300 to-yellow-500' : 'bg-gradient-to-r from-amber-600 to-yellow-600'}`}>{titlePrefix}</h2>
                <button className={`${theme === 'dark' ? 'bg-white/10 hover:bg-white/20 border-white/30 text-white' : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700'} border text-sm font-semibold py-2 px-4 rounded-lg flex items-center gap-2 transition-colors shadow`} onClick={onAtras}>
                    <span>&larr;</span> {"Volver al Listado"}
                </button>
            </div>

            <div className="mb-8">
                <label className={`block text-sm font-semibold mb-2 ${theme === 'dark' ? 'text-yellow-400' : 'text-amber-700'}`}>{"Nombre del Checklist"}</label>
                <input type="text" className={`${inputClasses} text-lg font-bold`} placeholder="Ej. Nuevo Proyecto" value={nombreChecklist} onChange={(e) => setNombreChecklist(e.target.value)} required />
            </div>

            <div className={`border rounded-lg overflow-hidden text-sm mb-8 ${theme === 'dark' ? 'border-slate-800 bg-slate-900/40' : 'border-slate-200 bg-white'}`}>
                <div className={`flex flex-col md:flex-row border-b ${theme === 'dark' ? 'border-slate-800' : 'border-slate-200'}`}>
                    <div className={`w-full md:w-1/3 p-4 border-r flex flex-col gap-3 ${theme === 'dark' ? 'border-slate-800' : 'border-slate-200'}`}>
                        <span className="font-bold text-[10px] uppercase tracking-wider text-slate-500">{"DESCRIPCIÓN DE EQUIPO(S) A INCORPORAR"}</span>
                        {metadata.equipos.map((eq, idx) => (
                            <div key={idx} className="relative group w-full flex items-center">
                                <textarea 
                                    className={`${inputClasses} text-xs pr-14`} 
                                    placeholder={"Describe aquí un equipo a incorporar..."} 
                                    rows="2" 
                                    value={eq} 
                                    onChange={(e) => handleMetadataEquipoChange(idx, e.target.value)}
                                />
                                {idx > 0 && (
                                    <button 
                                        type="button"
                                        onClick={() => {
                                            const newEquipos = metadata.equipos.filter((_, i) => i !== idx);
                                            setMetadata(prev => ({ ...prev, equipos: newEquipos }));
                                        }}
                                        className="absolute right-2 px-2 py-1 text-red-500 hover:text-red-400 font-bold text-xs bg-slate-950/20 rounded border border-red-500/20"
                                    >
                                        {"Eliminar"}
                                    </button>
                                )}
                            </div>
                        ))}
                        <button onClick={addEquipo} className="bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold py-1.5 px-3 rounded self-start transition-colors border border-amber-500/20 shadow">{"Añadir otro activo"}</button>

                        <div className={`mt-3 pt-3 border-t ${theme === 'dark' ? 'border-slate-800' : 'border-slate-200'}`}>
                            <span className="font-bold text-[10px] uppercase tracking-wider text-slate-500 block mb-2">{"FOTO DEL EQUIPO (MÁX. 3)"}</span>
                            <div className="flex flex-wrap gap-2 mb-2">
                                {(metadata.imagenesEquipo || []).map((img, i) => (
                                    <div key={i} className="relative inline-block">
                                        <img src={img} alt="Preview" className="h-16 w-16 rounded border border-slate-300 dark:border-slate-700 object-cover shadow" />
                                        <button 
                                            type="button"
                                            onClick={() => handleRemoveImage(i)} 
                                            className="absolute -top-1.5 -right-1.5 bg-red-600 hover:bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold shadow-lg"
                                        >
                                            &times;
                                        </button>
                                    </div>
                                ))}
                            </div>
                            {(!metadata.imagenesEquipo || metadata.imagenesEquipo.length < 3) && (
                                <input type="file" accept="image/*" onChange={handleImageUpload} className="text-[10px] text-slate-500 w-full file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-[10px] file:font-semibold file:bg-amber-600 file:text-white hover:file:bg-amber-500 transition-all cursor-pointer" />
                            )}
                        </div>
                    </div>
                    <div className="w-full md:w-2/3 flex flex-col">
                        <div className={`grid grid-cols-12 border-b font-bold text-[10px] uppercase tracking-wider text-slate-500 ${theme === 'dark' ? 'border-slate-800 bg-slate-950/40' : 'border-slate-200 bg-slate-100/80'}`}>
                            <div className={`col-span-4 p-2 border-r ${theme === 'dark' ? 'border-slate-800' : 'border-slate-200'} flex items-center`}>ROL</div>
                            <div className={`col-span-4 p-2 border-r ${theme === 'dark' ? 'border-slate-800' : 'border-slate-200'} flex items-center`}>{"Área"}</div>
                            <div className="col-span-4 p-2 flex items-center">Nombre representante</div>
                        </div>
                        {['lider', 'custodio', 'operador', 'mantenedor'].map((roleKey) => (
                            <div key={roleKey} className={`grid grid-cols-12 border-b items-stretch ${theme === 'dark' ? 'border-slate-800' : 'border-slate-200'}`}>
                                <div className={`col-span-4 p-2 border-r font-bold text-[10px] uppercase flex items-center ${theme === 'dark' ? 'border-slate-800 bg-slate-950/20 text-yellow-100' : 'border-slate-200 bg-slate-100/50 text-slate-700'}`}>
                                    {roleKey === 'lider' ? 'LÍDER DE PROYECTO' : roleKey}
                                </div>
                                <div className={`col-span-4 p-2 border-r ${theme === 'dark' ? 'border-slate-800' : 'border-slate-200'} flex items-center`}>
                                    <select className={inputClasses + " text-xs py-1.5 px-2"} value={metadata.roles[roleKey].area} onChange={(e) => handleMetadataRoleChange(roleKey, 'area', e.target.value)}>
                                        <option value="">Seleccione</option>
                                        {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
                                    </select>
                                </div>
                                <div className="col-span-4 p-2 flex items-center">
                                    <PeoplePicker className={inputClasses + " text-xs py-1.5 px-2"} placeholder="Buscar persona..." value={metadata.roles[roleKey].persona} onChange={(val) => handleMetadataRoleChange(roleKey, 'persona', val)} />
                                </div>
                            </div>
                        ))}

                        <div className={`grid grid-cols-12 border-b items-stretch ${theme === 'dark' ? 'border-slate-800' : 'border-slate-200'}`}>
                            <div className={`col-span-4 p-2 border-r font-bold text-[10px] uppercase flex items-center ${theme === 'dark' ? 'border-slate-800 bg-slate-950/20 text-yellow-100' : 'border-slate-200 bg-slate-100/50 text-slate-700'}`}>{"Gerencia"}</div>
                            <div className={`col-span-8 p-2 flex items-center ${theme === 'dark' ? 'border-slate-800' : 'border-slate-200'}`}>
                                <select className={inputClasses + " text-xs py-1.5 px-2"} value={metadata.gerencia || ''} onChange={(e) => setMetadata(p => ({ ...p, gerencia: e.target.value }))}>
                                    <option value="">{acLoading ? "Cargando Gerencias..." : "Seleccione Gerencia"}</option>
                                    {acData.gerencias.map(g => <option key={g} value={g}>{g}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className={`grid grid-cols-12 border-b items-stretch ${theme === 'dark' ? 'border-slate-800' : 'border-slate-200'}`}>
                            <div className={`col-span-4 p-2 border-r font-bold text-[10px] uppercase flex items-center ${theme === 'dark' ? 'border-slate-800 bg-slate-950/20 text-yellow-100' : 'border-slate-200 bg-slate-100/50 text-slate-700'}`}>{"Superintendencia"}</div>
                            <div className={`col-span-8 p-2 flex items-center ${theme === 'dark' ? 'border-slate-800' : 'border-slate-200'}`}>
                                <select className={inputClasses + " text-xs py-1.5 px-2"} value={metadata.superintendencia || ''} onChange={(e) => setMetadata(p => ({ ...p, superintendencia: e.target.value }))}>
                                    <option value="">{acLoading ? "Cargando Superintendencias..." : "Seleccione Superintendencia"}</option>
                                    {acData.superintendencias.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className={`grid grid-cols-12 border-b items-stretch ${theme === 'dark' ? 'border-slate-800' : 'border-slate-200'}`}>
                            <div className={`col-span-4 p-2 border-r font-bold text-[10px] uppercase flex items-center ${theme === 'dark' ? 'border-slate-800 bg-slate-950/20 text-yellow-100' : 'border-slate-200 bg-slate-100/50 text-slate-700'}`}>{"Unidad de proceso"}</div>
                            <div className={`col-span-8 p-2 flex items-center ${theme === 'dark' ? 'border-slate-800' : 'border-slate-200'}`}>
                                <select className={inputClasses + " text-xs py-1.5 px-2"} value={metadata.unidadProceso || ''} onChange={(e) => setMetadata(p => ({ ...p, unidadProceso: e.target.value }))}>
                                    <option value="">{acLoading ? "Cargando Unidades de Proceso..." : "Seleccione Unidad de Proceso"}</option>
                                    {acData.unidades.map(u => <option key={u} value={u}>{u}</option>)}
                                </select>
                            </div>
                        </div>

                        <div className={`grid grid-cols-12 items-stretch ${theme === 'dark' ? 'bg-black/20' : 'bg-slate-50'}`}>
                            <div className={`col-span-4 p-2 border-r font-bold text-[10px] uppercase flex items-center ${theme === 'dark' ? 'border-slate-800 text-slate-300' : 'border-slate-200 text-slate-600'}`}>TIPO DE FORMULARIO:</div>
                            <div className="col-span-8 p-2 flex items-center">
                                <input type="text" className={`${inputClasses} bg-transparent border-none text-slate-500 font-bold cursor-not-allowed`} value={getTipoFormulario()} readOnly />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col">
                    <div className={`flex border-b ${theme === 'dark' ? 'border-slate-800 bg-black/25' : 'border-slate-200 bg-slate-100/30'}`}>
                        <div className={`w-1/3 p-3 font-bold text-xs flex items-center border-r ${theme === 'dark' ? 'border-slate-800' : 'border-slate-200'}`}>Fecha inicio diligenciamiento</div>
                        <div className="w-2/3 p-2"><input type="date" className={`${inputClasses} max-w-[200px]`} value={metadata.fechaInicioDiligenciamiento} onChange={(e) => setMetadata({ ...metadata, fechaInicioDiligenciamiento: e.target.value })} /></div>
                    </div>
                    <div className={`flex border-b ${theme === 'dark' ? 'border-slate-800 bg-black/25' : 'border-slate-200 bg-slate-100/30'}`}>
                        <div className={`w-1/3 p-3 font-bold text-xs flex items-center border-r ${theme === 'dark' ? 'border-slate-800' : 'border-slate-200'}`}>Fecha fin diligenciamiento</div>
                        <div className="w-2/3 p-2"><input type="text" className={`${inputClasses} max-w-[300px] cursor-not-allowed text-slate-400`} value={"Se completará al finalizar"} readOnly /></div>
                    </div>
                    <div className={`flex ${theme === 'dark' ? 'bg-black/10' : 'bg-transparent'}`}>
                        <div className={`w-1/3 p-3 font-bold text-xs flex items-center border-r ${theme === 'dark' ? 'border-slate-800' : 'border-slate-200'}`}>Comentarios</div>
                        <div className="w-2/3 p-2"><textarea className={`${inputClasses} text-xs`} rows="2" placeholder={"Escribe aquí cualquier observación..."} value={metadata.comentarios} onChange={(e) => setMetadata({ ...metadata, comentarios: e.target.value })}></textarea></div>
                    </div>
                </div>
            </div>

            <div className="flex justify-between items-center mb-4 border-b border-slate-200 dark:border-slate-800 pb-2">
                <h3 className={`text-lg font-bold ${theme === 'dark' ? 'text-yellow-400' : 'text-amber-700'}`}>{"Ítems de este Checklist ("}{items.length}{")"}</h3>
                <button onClick={() => setShowAddItemForm(!showAddItemForm)} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-lg border ${showAddItemForm ? 'bg-red-500/20 text-red-300 border-red-500/30 hover:bg-red-500/40' : 'bg-blue-600 hover:bg-blue-500 text-white border-blue-400/50'}`}>
                    {showAddItemForm ? 'Cancelar Agregar' : 'Agregar Nuevo Ítem'}
                </button>
            </div>

            {showAddItemForm && (
                <div className={`p-6 rounded-xl border mb-8 animate-[fadeIn_0.2s_ease-out] shadow ${theme === 'dark' ? 'bg-slate-900 border-blue-500/30' : 'bg-white border-blue-200 shadow-slate-200'}`}>
                    <form onSubmit={handleAddItem} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                            <div className="md:col-span-12">
                                <label className={`block text-xs font-bold mb-1 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>{"Descripción de Actividad"}</label>
                                <textarea className={inputClasses} value={formData.actividades} onChange={(e) => setFormData({ ...formData, actividades: e.target.value })} rows="2" required></textarea>
                            </div>
                            <div className="md:col-span-4">
                                <label className={`block text-xs font-bold mb-1 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>Responsable</label>
                                <PeoplePicker className={inputClasses} value={formData.nombreResponsable} onChange={(val) => setFormData(prev => ({ ...prev, nombreResponsable: val }))} />
                            </div>
                            <div className="md:col-span-4">
                                <label className={`block text-xs font-bold mb-1 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>Entregable</label>
                                <input type="text" className={inputClasses} value={formData.entregable} onChange={(e) => setFormData({ ...formData, entregable: e.target.value })} required></input>
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-xs font-bold text-blue-500 dark:text-blue-300 mb-1">Plan Inicio (Baseline)</label>
                                <input type="date" className={inputClasses} value={formData.fechaBaselineInicio} onChange={(e) => setFormData({ ...formData, fechaBaselineInicio: e.target.value })} required></input>
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-xs font-bold text-blue-500 dark:text-blue-300 mb-1">Plan Fin (Baseline)</label>
                                <input type="date" className={inputClasses} value={formData.fechaBaselineFin} onChange={(e) => setFormData({ ...formData, fechaBaselineFin: e.target.value })} required></input>
                            </div>
                        </div>
                        <div className="flex justify-end pt-2">
                            <button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-6 rounded shadow-lg transition-colors text-xs">{"Confirmar Ítem"}</button>
                        </div>
                    </form>
                </div>
            )}

            <div className="mb-8">
                {listadoOrdenado.length === 0 ? (
                    <div className={`text-center py-8 rounded-xl border border-dashed ${theme === 'dark' ? 'bg-slate-900 border-slate-800 text-slate-500' : 'bg-slate-50 border-slate-300 text-slate-400'}`}>
                        <p>Aún no hay ítems en este checklist.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {listadoOrdenado.map((it, idx) => {
                            const isInactive = it.estado === 'Inactivo';
                            const isEditing = editingId === it.id;

                            return (
                                <div 
                                    key={it.id} 
                                    className={`p-4 rounded-xl border transition-all ${
                                        isInactive 
                                            ? (theme === 'dark' ? 'border-dashed border-slate-700 bg-slate-950/70 shadow-sm' : 'border-dashed border-slate-300 bg-slate-100/95 shadow-sm') 
                                            : isEditing ? 'border-yellow-500 ring-2 ring-yellow-400/20' 
                                            : theme==='dark' ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-50/50 border-slate-200'
                                    }`}
                                >
                                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                                        
                                        <div className="flex-1 min-w-0 flex items-start gap-3">
                                            <span className={`text-xs font-bold px-2 py-1 rounded mt-0.5 ${
                                                isInactive 
                                                    ? (theme === 'dark' ? 'bg-slate-800 text-slate-400' : 'bg-slate-200 text-slate-600') 
                                                    : 'bg-amber-600 text-white shadow'
                                            }`}>
                                                #{idx + 1}
                                            </span>
                                            <div className="flex-1 min-w-0">
                                                {isEditing ? (
                                                    <textarea className={`${inputClasses} text-xs font-semibold`} value={it.actividades} onChange={(e) => handleItemEdit(it.id, 'actividades', e.target.value)} rows="2" />
                                                ) : (
                                                    <p className={`font-bold text-sm leading-snug break-words ${
                                                        isInactive 
                                                            ? (theme === 'dark' ? 'text-slate-400 line-through decoration-slate-500/80' : 'text-slate-500 line-through decoration-slate-450') 
                                                            : theme==='dark' ? 'text-yellow-400' : 'text-slate-800'
                                                    }`}>
                                                        {it.actividades}
                                                    </p>
                                                )}
                                                {isInactive && (
                                                    <div className={`text-xs font-bold mt-2 flex flex-wrap items-center gap-1 ${
                                                        theme === 'dark' ? 'text-red-400' : 'text-red-600'
                                                    }`} style={{ color: theme === 'light' ? '#b91c1c' : undefined }}>
                                                        <span>&#9888;</span>
                                                        <span>{"Inactivado por: "}</span>
                                                        <span className="underline font-semibold">{it.inactivadoPor}</span>
                                                        <span>{" - Causa: \""}{it.inactivadoRazon}{"\""}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {!isInactive && (
                                            <div className="flex flex-wrap lg:flex-nowrap items-center gap-6 text-xs min-w-fit">
                                                <div className="w-44">
                                                    <span className="text-slate-400 dark:text-slate-500 block text-[9px] font-bold uppercase tracking-wider mb-0.5">Responsable</span>
                                                    {isEditing ? (
                                                        <PeoplePicker className="bg-transparent text-xs outline-none" value={it.nombreResponsable} onChange={(val) => handleItemEdit(it.id, 'nombreResponsable', val)} />
                                                    ) : (
                                                        <span className="truncate block font-semibold max-w-[170px]" title={it.nombreResponsable}>{it.nombreResponsable || '-'}</span>
                                                    )}
                                                </div>
                                                <div className="w-36">
                                                    <span className="text-slate-400 dark:text-slate-500 block text-[9px] font-bold uppercase tracking-wider mb-0.5">Entregable</span>
                                                    <span className="truncate block font-semibold max-w-[140px]" title={it.entregable}>{it.entregable || '-'}</span>
                                                </div>
                                                <div className={`p-2 rounded border w-36 ${theme === 'dark' ? 'bg-slate-950 border-slate-800' : 'bg-slate-100 border-slate-300'}`}>
                                                    <span className="text-slate-400 dark:text-slate-500 block text-[9px] font-bold uppercase tracking-wider mb-0.5">Fechas Plan</span>
                                                    {isEditing ? (
                                                        <div className="space-y-1">
                                                            <div className="flex items-center gap-1"><span className="text-blue-500 dark:text-blue-300 font-bold">I:</span><input type="date" className="bg-transparent border-none text-[10px] w-full" value={it.fechaBaselineInicio} onChange={(e) => handleItemEdit(it.id, 'fechaBaselineInicio', e.target.value)} /></div>
                                                            <div className="flex items-center gap-1"><span className="text-blue-500 dark:text-blue-300 font-bold">F:</span><input type="date" className="bg-transparent border-none text-[10px] w-full" value={it.fechaBaselineFin} onChange={(e) => handleItemEdit(it.id, 'fechaBaselineFin', e.target.value)} /></div>
                                                        </div>
                                                    ) : (
                                                        <div className="text-[10px] font-semibold text-slate-600 dark:text-slate-400">
                                                            <span><span className="text-blue-500 dark:text-blue-300 font-bold">I:</span> {it.fechaBaselineInicio || '-'}</span>
                                                            <span className="block mt-0.5"><span className="text-blue-500 dark:text-blue-300 font-bold">F:</span> {it.fechaBaselineFin || '-'}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        <div className="flex items-center gap-2 min-w-[145px] justify-end">
                                            {isInactive ? (
                                                <button 
                                                    onClick={() => handleReactivarItem(it.id)} 
                                                    className={`px-3 py-1.5 rounded-xl text-xs font-black transition-colors w-full shadow-md border ${
                                                        theme === 'dark' 
                                                            ? 'bg-green-600 hover:bg-green-500 text-white border-green-700' 
                                                            : 'bg-green-500 hover:bg-green-600 text-white border-green-600'
                                                    }`}
                                                >
                                                    {"Reactivar"}
                                                </button>
                                            ) : isEditing ? (
                                                <div className="flex gap-1.5 w-full">
                                                    <button onClick={() => { setEditingId(null); setBackupItem(null); }} className="bg-green-500/20 hover:bg-green-500/40 text-green-600 dark:text-green-300 border border-green-500/30 px-3 py-1 rounded text-xs font-bold transition-colors flex-1 shadow-sm">
                                                        {"Listo"}
                                                    </button>
                                                    <button 
                                                        onClick={() => {
                                                            setItems(prev => prev.map(item => item.id === editingId ? backupItem : item));
                                                            setEditingId(null);
                                                            setBackupItem(null);
                                                        }} 
                                                        className="bg-red-500/20 hover:bg-red-500/40 text-red-600 dark:text-red-300 border border-red-500/30 px-3 py-1 rounded text-xs font-bold transition-colors flex-1 shadow-sm"
                                                    >
                                                        {"Cancelar"}
                                                    </button>
                                                </div>
                                            ) : (
                                                <>
                                                    <button onClick={() => { setEditingId(it.id); setBackupItem({ ...it }); }} className="bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-300 border border-blue-500/20 px-2.5 py-1.5 rounded text-xs font-bold transition-colors flex-1">{"Editar"}</button>
                                                    <button onClick={() => openInactivateModal(it.id)} className="bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-300 border border-red-500/20 px-2.5 py-1.5 rounded text-xs font-bold transition-colors flex-1">{"Inactivar"}</button>
                                                </>
                                            )}
                                        </div>

                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            <button onClick={handleGuardarChecklist} disabled={items.length === 0 || isSaving} className={`w-full font-extrabold text-lg py-4 rounded-xl shadow-lg transition-all duration-300 ${items.length > 0 && !isSaving ? 'bg-green-600 hover:bg-green-500 text-white hover:shadow-[0_0_20px_rgba(34,197,94,0.3)] hover:-translate-y-0.5' : 'bg-slate-300 text-slate-500 dark:bg-slate-800 dark:text-slate-600 cursor-not-allowed'}`}>
                {isSaving ? 'GUARDANDO EN SHAREPOINT...' : 'FINALIZAR Y GUARDAR CHECKLIST'}
            </button>

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
                            className="w-full bg-slate-900 text-white border border-slate-700 rounded-lg p-3 text-sm outline-none focus:border-yellow-400 mb-4"
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
                                {"Cancelar"}
                            </button>
                            <button
                                onClick={handleConfirmInactivate}
                                className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-lg transition-colors shadow-lg"
                            >
                                {"Inactivar"}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default CrearCheckList;
