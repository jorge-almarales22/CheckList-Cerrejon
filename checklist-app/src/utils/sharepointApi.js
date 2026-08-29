import { SITE_URL, AC_SITE_URL, SGIA_SITE_URL, JERARQUIA_LIST, ENTREGABLES_BASE, TIPO_FOLDER_MAP } from '../data/constants';

export const getRequestDigest = async () => {
    const res = await fetch(`${SITE_URL}/_api/contextinfo`, {
        method: 'POST',
        headers: { "Accept": "application/json;odata=verbose" },
        credentials: 'same-origin'
    });
    const data = await res.json();
    return data.d.GetContextWebInformation.FormDigestValue;
};

export const getEntityType = async (listName) => {
    const res = await fetch(`${SITE_URL}/_api/web/lists/getbytitle('${listName}')`, {
        headers: { "Accept": "application/json;odata=verbose" },
        credentials: "same-origin"
    });
    const json = await res.json();
    return json.d.ListItemEntityTypeFullName;
};

export const saveToSPList = async (listName, data, digest) => {
    const entityType = await getEntityType(listName);
    const res = await fetch(`${SITE_URL}/_api/web/lists/getbytitle('${listName}')/items`, {
        method: 'POST',
        headers: {
            "Accept": "application/json;odata=verbose",
            "Content-Type": "application/json;odata=verbose",
            "X-RequestDigest": digest
        },
        credentials: 'same-origin',
        body: JSON.stringify({ "__metadata": { "type": entityType }, ...data })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} error saving to ${listName}`);
    return res.json();
};

export const updateSPListItem = async (listName, itemId, data, digest) => {
    const entityType = await getEntityType(listName);
    const res = await fetch(`${SITE_URL}/_api/web/lists/getbytitle('${listName}')/items(${itemId})`, {
        method: 'POST',
        headers: {
            "Accept": "application/json;odata=verbose",
            "Content-Type": "application/json;odata=verbose",
            "X-RequestDigest": digest,
            "X-HTTP-Method": "MERGE",
            "If-Match": "*"
        },
        credentials: 'same-origin',
        body: JSON.stringify({ "__metadata": { "type": entityType }, ...data })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} error updating ${listName}`);
};

export const deleteSPListItem = async (listName, itemId, digest) => {
    const res = await fetch(`${SITE_URL}/_api/web/lists/getbytitle('${listName}')/items(${itemId})`, {
        method: 'POST',
        headers: {
            "Accept": "application/json;odata=verbose",
            "X-RequestDigest": digest,
            "X-HTTP-Method": "DELETE",
            "If-Match": "*"
        },
        credentials: 'same-origin'
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} error deleting ${listName}`);
};

// ---------------------------------------------------------------------------
// Entregables como ARCHIVOS en la biblioteca de documentos del sitio raiz SGIA.
// Antes se guardaban en base64 dentro de la lista EvidenciasChecklist, lo que
// saturaba el almacenamiento. Ahora se suben como archivos reales a
// /Documentos compartidos/Incorporación/Entregables/{Checklist Tipo}/{Nombre del Checklist}/.
// ---------------------------------------------------------------------------

// Limpia un texto para usarlo como nombre de carpeta/archivo en SharePoint
// (elimina caracteres no permitidos y comillas que rompen las cadenas OData).
export const sanitizeSPName = (name) =>
    (name || '')
        .replace(/[~"#%&*:<>?/\\{|}']/g, ' ')
        .replace(/\s+/g, ' ')
        .trim() || 'SinNombre';

// Ruta server-relative de la carpeta de entregables de un checklist concreto.
export const getEntregablesFolderUrl = (tipo, checklistName) => {
    const tipoFolder = TIPO_FOLDER_MAP[(tipo || '').toUpperCase()] || 'Checklist Proyectos';
    return `${ENTREGABLES_BASE}/${tipoFolder}/${sanitizeSPName(checklistName)}`;
};

// Alias historico: el codigo y los datos existentes hablan de "evidencias".
export const getEvidenciasFolderUrl = getEntregablesFolderUrl;

// Crea una carpeta (idempotente). Si ya existe, SharePoint responde 400/409 y
// se considera exito. La ruta se DECODIFICA antes de enviarla a addUsingPath
// (SharePoint exige texto plano con "/" reales, no %2F ni %20).
// La biblioteca de entregables vive en el sitio raiz SGIA, no en el sitio "ac".
export const ensureFolder = async (serverRelativeUrl, digest, siteUrl = SGIA_SITE_URL) => {
    const cleanPath = decodeURIComponent(serverRelativeUrl);
    try {
        const res = await fetch(`${siteUrl}/_api/web/folders/addUsingPath(DecodedUrl='${cleanPath}')`, {
            method: 'POST',
            headers: {
                "Accept": "application/json;odata=verbose",
                "Content-Type": "application/json;odata=verbose",
                "X-RequestDigest": digest
            },
            credentials: 'same-origin'
        });
        // 200/201 = creada; 400/409 = ya existia (idempotente).
        return res.ok || res.status === 400 || res.status === 409;
    } catch {
        return false;
    }
};

// Sube un archivo binario (ArrayBuffer/Uint8Array) a una carpeta del document library.
// La ruta de la carpeta se codifica con encodeURIComponent (slashes %2F),
// consistente con listFolderFiles/listFolderSubfolders que SI funcionan.
// Usar decodeURIComponent aqui causaba HTTP 404 (carpeta no encontrada).
export const uploadFileToFolder = async (folderUrl, fileName, body, digest, siteUrl = SGIA_SITE_URL) => {
    const url = `${siteUrl}/_api/web/GetFolderByServerRelativeUrl('${encodeURIComponent(folderUrl)}')/Files/add(url='${encodeURIComponent(fileName)}',overwrite=true)`;
    const res = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/octet-stream',
            'X-RequestDigest': digest,
            'Accept': 'application/json;odata=verbose'
        },
        body,
        credentials: 'same-origin'
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} subiendo ${fileName}`);
    return res.json();
};

// Lista los archivos de una carpeta. Devuelve [] si la carpeta aún no existe.
export const listFolderFiles = async (folderUrl, siteUrl = SGIA_SITE_URL) => {
    const url = `${siteUrl}/_api/web/GetFolderByServerRelativeUrl('${encodeURIComponent(folderUrl)}')/Files?$select=Name,ServerRelativeUrl,TimeCreated,TimeLastModified,Length&$top=5000`;
    const res = await fetch(url, {
        headers: { "Accept": "application/json;odata=verbose" },
        credentials: 'same-origin'
    });
    if (!res.ok) return [];
    const json = await res.json();
    return json.d?.results || [];
};

// Lista las subcarpetas de una carpeta. Devuelve [] si la carpeta aún no existe.
export const listFolderSubfolders = async (folderUrl, siteUrl = SGIA_SITE_URL) => {
    const url = `${siteUrl}/_api/web/GetFolderByServerRelativeUrl('${encodeURIComponent(folderUrl)}')/Folders?$select=Name,ServerRelativeUrl&$top=5000`;
    const res = await fetch(url, {
        headers: { "Accept": "application/json;odata=verbose" },
        credentials: 'same-origin'
    });
    if (!res.ok) return [];
    const json = await res.json();
    return json.d?.results || [];
};

// Lista TODOS los archivos bajo una carpeta, incluyendo los de todas sus
// subcarpetas a cualquier profundidad, en UNA sola llamada REST.
// SharePoint devuelve los archivos de la carpeta y de sus subcarpetas con el
// endpoint /Files (recursivo por defecto). Devuelve [] si la carpeta no existe.
export const listFolderFilesRecursive = async (folderUrl, siteUrl = SGIA_SITE_URL) => {
    const url = `${siteUrl}/_api/web/GetFolderByServerRelativeUrl('${encodeURIComponent(folderUrl)}')/Files?$select=Name,ServerRelativeUrl,TimeCreated,TimeLastModified,Length&$top=5000`;
    const res = await fetch(url, {
        headers: { "Accept": "application/json;odata=verbose" },
        credentials: 'same-origin'
    });
    if (!res.ok) return [];
    const json = await res.json();
    return json.d?.results || [];
};

// Envía un archivo a la papelera de reciclaje del sitio.
export const recycleFile = async (fileRef, digest, siteUrl = SGIA_SITE_URL) => {
    const url = `${siteUrl}/_api/web/GetFileByServerRelativeUrl('${encodeURIComponent(fileRef)}')/recycle()`;
    const res = await fetch(url, {
        method: 'POST',
        headers: { "Accept": "application/json;odata=verbose", "X-RequestDigest": digest },
        credentials: 'same-origin'
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} eliminando archivo`);
};

// Envía una carpeta (y su contenido) a la papelera de reciclaje del sitio.
export const recycleFolder = async (folderRef, digest, siteUrl = SGIA_SITE_URL) => {
    const url = `${siteUrl}/_api/web/GetFolderByServerRelativeUrl('${encodeURIComponent(folderRef)}')/recycle()`;
    const res = await fetch(url, {
        method: 'POST',
        headers: { "Accept": "application/json;odata=verbose", "X-RequestDigest": digest },
        credentials: 'same-origin'
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} eliminando carpeta`);
};

// Renombra un archivo dentro de su carpeta usando MoveTo (flag 1 = overwrite).
// nuevoNombre debe incluir la extensión.
// Nota: newurl debe ir con la ruta DECODIFICADA (slashes "/" limpios, no %2F)
// para que SharePoint la interprete como ruta y no como nombre invalido.
export const renameFile = async (fileRef, nuevoNombre, digest, siteUrl = SGIA_SITE_URL) => {
    const origen = decodeURIComponent(fileRef);
    const carpeta = origen.substring(0, origen.lastIndexOf('/'));
    const destino = `${carpeta}/${nuevoNombre.trim()}`;
    const url = `${siteUrl}/_api/web/GetFileByServerRelativeUrl('${origen}')/moveto(newurl='${destino}',flags=1)`;
    const res = await fetch(url, {
        method: 'POST',
        headers: {
            "Accept": "application/json;odata=verbose",
            "X-RequestDigest": digest,
            "IF-MATCH": "*"
        },
        credentials: 'same-origin'
    });
    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`HTTP ${res.status} renombrando archivo: ${errText}`);
    }
    return true;
};

// Renombra una carpeta usando MoveTo (flag 1 = overwrite).
// Nota: newurl debe ir con la ruta DECODIFICADA (slashes "/" limpios, no %2F)
// para que SharePoint la interprete como ruta y no como nombre invalido.
export const renameFolder = async (folderRef, nuevoNombre, digest, siteUrl = SGIA_SITE_URL) => {
    const origen = decodeURIComponent(folderRef);
    const padre = origen.substring(0, origen.lastIndexOf('/'));
    const destino = `${padre}/${nuevoNombre.trim()}`;
    const url = `${siteUrl}/_api/web/GetFolderByServerRelativeUrl('${origen}')/moveto(newurl='${destino}',flags=1)`;
    const res = await fetch(url, {
        method: 'POST',
        headers: {
            "Accept": "application/json;odata=verbose",
            "X-RequestDigest": digest,
            "IF-MATCH": "*"
        },
        credentials: 'same-origin'
    });
    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`HTTP ${res.status} renombrando carpeta: ${errText}`);
    }
    return true;
};

// Mueve un archivo a otra carpeta (misma biblioteca). carpetaDestinoUrl es la
// ruta server-relative de la carpeta destino (sin el nombre del archivo).
// Metodo directo y limpio: descarga el blob ($value), lo sube a la carpeta
// destino y recicla el original. Evita SP.MoveCopyUtil (HTTP 500 en este
// tenant) y los problemas de encoding de moveto/MoveToUsingPath (HTTP 400).
export const moveFile = async (fileRef, carpetaDestinoUrl, digest, siteUrl = SGIA_SITE_URL) => {
    const srcUrl = decodeURIComponent(fileRef);
    const nombre = srcUrl.substring(srcUrl.lastIndexOf('/') + 1);
    const destUrl = `${decodeURIComponent(carpetaDestinoUrl)}/${nombre}`;
    const carpetaDestino = destUrl.substring(0, destUrl.lastIndexOf('/'));

    // 1) Descargar el contenido binario del archivo origen.
    const blob = await downloadFileContent(srcUrl, siteUrl);
    const body = await blob.arrayBuffer();
    // 2) Subir el archivo a la carpeta destino (overwrite=true).
    await uploadFileToFolder(carpetaDestino, nombre, body, digest, siteUrl);
    // 3) Enviar el archivo original a la papelera de reciclaje.
    await recycleFile(srcUrl, digest, siteUrl);
    return true;
};

// Mueve una carpeta (con todo su contenido) a otra carpeta de la misma
// biblioteca. Usa MoveToUsingPath con rutas decodificadas (slashes "/" reales,
// no %2F) para evitar HTTP 400.
export const moveFolder = async (folderRef, carpetaDestinoUrl, digest, siteUrl = SGIA_SITE_URL) => {
    const origen = decodeURIComponent(folderRef);
    const nombre = origen.substring(origen.lastIndexOf('/') + 1);
    const destino = `${decodeURIComponent(carpetaDestinoUrl)}/${nombre}`;
    const url = `${siteUrl}/_api/web/GetFolderByServerRelativeUrl('${origen}')/MoveToUsingPath(DecodedUrl='${destino}',Overwrite=@a1)?@a1=true`;
    const res = await fetch(url, {
        method: 'POST',
        headers: {
            "Accept": "application/json;odata=verbose",
            "Content-Type": "application/json;odata=verbose",
            "X-RequestDigest": digest,
            "IF-MATCH": "*"
        },
        credentials: 'same-origin'
    });
    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`HTTP ${res.status} moviendo carpeta: ${errText}`);
    }
    return true;
};

// Descarga el contenido binario de un archivo (GET no requiere digest).
// Devuelve un Blob listo para <a download>.
export const downloadFileContent = async (fileRef, siteUrl = SGIA_SITE_URL) => {
    const url = `${siteUrl}/_api/web/GetFileByServerRelativeUrl('${encodeURIComponent(fileRef)}')/$value`;
    const res = await fetch(url, {
        headers: { "Accept": "application/octet-stream" },
        credentials: 'same-origin'
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} descargando archivo`);
    return res.blob();
};

// ---------------------------------------------------------------------------
// Lista JerarquiaL (sitio raiz SGIA): fuente oficial de Gerencia, Gerencia
// abreviada y Superintendencia para los selects de metadatos del checklist.
// ---------------------------------------------------------------------------

// Titulos visibles de las columnas que necesitamos de JerarquiaL.
const JERARQUIA_COLS = {
    gerencia: 'GERENCIA',
    abreviada: 'G_ABREVIADA',
    superintendencia: 'SUPERINTENDENCIA'
};

// SharePoint no usa el titulo visible en la API REST: codifica los caracteres
// especiales (p.ej. "G_ABREVIADA" -> "G_x005f_ABREVIADA"). Por eso resolvemos
// el nombre real de cada columna contra /fields antes de pedir los items.
const getFieldNames = async (siteUrl, listName, titles) => {
    const url = `${siteUrl}/_api/web/lists/getbytitle('${listName}')/fields?$select=Title,EntityPropertyName,InternalName&$filter=Hidden eq false&$top=500`;
    const res = await fetch(url, { headers: { "Accept": "application/json;odata=verbose" }, credentials: 'same-origin' });
    if (!res.ok) throw new Error(`HTTP ${res.status} leyendo columnas de ${listName}`);
    const json = await res.json();
    const fields = json.d?.results || [];
    const norm = (s) => (s || '').trim().toUpperCase();

    const map = {};
    titles.forEach(title => {
        const f = fields.find(x => norm(x.Title) === norm(title))
            || fields.find(x => norm(x.InternalName) === norm(title))
            || fields.find(x => norm(x.Title).startsWith(norm(title)));
        // Si no aparece, usamos el titulo tal cual: el $select fallara de forma
        // visible en consola en vez de devolver datos silenciosamente vacios.
        map[title] = f ? f.EntityPropertyName : title;
    });
    return map;
};

// Trae todos los items de una lista siguiendo la paginacion de SharePoint
// (el tope duro por peticion es 5000 filas).
const getAllListItems = async (siteUrl, listName, selectCols) => {
    let url = `${siteUrl}/_api/web/lists/getbytitle('${listName}')/items?$select=${selectCols.join(',')}&$top=5000`;
    const all = [];
    let guard = 0;
    while (url && guard++ < 20) {
        const res = await fetch(url, { headers: { "Accept": "application/json;odata=verbose" }, credentials: 'same-origin' });
        if (!res.ok) throw new Error(`HTTP ${res.status} leyendo ${listName}`);
        const json = await res.json();
        all.push(...(json.d?.results || []));
        url = json.d?.__next || null;
    }
    return all;
};

// Valores unicos, sin vacios y ordenados alfabeticamente.
const distinctSorted = (rows, key) =>
    [...new Set(rows.map(r => (r[key] || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));

// Diccionario abreviatura -> nombre completo de la gerencia. Los clientes no
// conocen las siglas (GASOC, GCMTO...), asi que en los selects y en las tortas
// del dashboard mostramos tambien el nombre. Se queda con la primera coincidencia
// no vacia porque en JerarquiaL la misma gerencia se repite en muchas filas.
const mapaAbreviadaANombre = (rows, keyAbrev, keyNombre) => {
    const map = {};
    rows.forEach(r => {
        const abrev = (r[keyAbrev] || '').trim();
        const nombre = (r[keyNombre] || '').trim();
        if (abrev && nombre && !map[abrev]) map[abrev] = nombre;
    });
    return map;
};

// Opciones de los selects de metadatos. Devuelve listas ya deduplicadas porque
// en JerarquiaL cada fila es una division, asi que gerencias y superintendencias
// se repiten muchas veces.
export const fetchJerarquiaOpciones = async () => {
    const titles = Object.values(JERARQUIA_COLS);
    const fieldMap = await getFieldNames(SGIA_SITE_URL, JERARQUIA_LIST, titles);
    const rows = await getAllListItems(SGIA_SITE_URL, JERARQUIA_LIST, titles.map(t => fieldMap[t]));

    return {
        gerencias: distinctSorted(rows, fieldMap[JERARQUIA_COLS.gerencia]),
        gerenciasAbreviadas: distinctSorted(rows, fieldMap[JERARQUIA_COLS.abreviada]),
        superintendencias: distinctSorted(rows, fieldMap[JERARQUIA_COLS.superintendencia]),
        nombrePorAbreviada: mapaAbreviadaANombre(
            rows,
            fieldMap[JERARQUIA_COLS.abreviada],
            fieldMap[JERARQUIA_COLS.gerencia]
        )
    };
};

// Estado inicial compartido por los componentes que consumen JerarquiaL, para
// que ninguno olvide inicializar alguna de las llaves.
export const JERARQUIA_VACIA = { gerencias: [], gerenciasAbreviadas: [], superintendencias: [], nombrePorAbreviada: {} };

// Etiqueta visible de una gerencia: "GASOC - Gerencia de Asociados". Si no hay
// nombre completo (valor viejo, lista incompleta) se muestra solo la sigla.
export const etiquetaGerencia = (abreviada, nombrePorAbreviada) => {
    if (!abreviada) return '';
    const nombre = nombrePorAbreviada?.[abreviada];
    return nombre && nombre !== abreviada ? `${abreviada} - ${nombre}` : abreviada;
};

// Un checklist guardado puede tener un valor que ya no existe en JerarquiaL.
// Lo anteponemos a las opciones para no perderlo al editar los metadatos.
export const conValorActual = (opciones, valor) =>
    valor && !opciones.includes(valor) ? [valor, ...opciones] : opciones;

// Convierte un dataURL (base64, p.ej. imagen comprimida) a Uint8Array para subirlo como binario.
export const dataUrlToUint8Array = (dataUrl) => {
    const base64 = dataUrl.split(',')[1] || '';
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
};
