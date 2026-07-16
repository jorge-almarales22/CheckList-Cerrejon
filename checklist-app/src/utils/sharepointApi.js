import { SITE_URL, AC_SITE_URL, EVIDENCIAS_BASE, TIPO_FOLDER_MAP } from '../data/constants';

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
// Evidencias como ARCHIVOS en la biblioteca de documentos (sitio "ac").
// Antes se guardaban en base64 dentro de la lista EvidenciasChecklist, lo que
// saturaba el almacenamiento. Ahora se suben como archivos reales a
// /Incorporaciones/Evidencias/{Checklist Tipo}/{Nombre del Checklist}/.
// ---------------------------------------------------------------------------

// Limpia un texto para usarlo como nombre de carpeta/archivo en SharePoint
// (elimina caracteres no permitidos y comillas que rompen las cadenas OData).
export const sanitizeSPName = (name) =>
    (name || '')
        .replace(/[~"#%&*:<>?/\\{|}']/g, ' ')
        .replace(/\s+/g, ' ')
        .trim() || 'SinNombre';

// Ruta server-relative de la carpeta de evidencias de un checklist concreto.
export const getEvidenciasFolderUrl = (tipo, checklistName) => {
    const tipoFolder = TIPO_FOLDER_MAP[(tipo || '').toUpperCase()] || 'Checklist Proyectos';
    return `${EVIDENCIAS_BASE}/${tipoFolder}/${sanitizeSPName(checklistName)}`;
};

// Crea una carpeta (idempotente). Si ya existe, SharePoint responde error y se ignora.
export const ensureFolder = async (serverRelativeUrl, digest) => {
    try {
        const res = await fetch(`${AC_SITE_URL}/_api/web/folders/addUsingPath(DecodedUrl='${encodeURIComponent(serverRelativeUrl)}')`, {
            method: 'POST',
            headers: { "Accept": "application/json;odata=verbose", "X-RequestDigest": digest },
            credentials: 'same-origin'
        });
        return res.ok;
    } catch {
        return false;
    }
};

// Sube un archivo binario (ArrayBuffer/Uint8Array) a una carpeta del document library.
export const uploadFileToFolder = async (folderUrl, fileName, body, digest) => {
    const url = `${AC_SITE_URL}/_api/web/GetFolderByServerRelativeUrl('${encodeURIComponent(folderUrl)}')/Files/add(url='${encodeURIComponent(fileName)}',overwrite=true)`;
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
export const listFolderFiles = async (folderUrl) => {
    const url = `${AC_SITE_URL}/_api/web/GetFolderByServerRelativeUrl('${encodeURIComponent(folderUrl)}')/Files?$select=Name,ServerRelativeUrl,TimeCreated&$top=5000`;
    const res = await fetch(url, {
        headers: { "Accept": "application/json;odata=verbose" },
        credentials: 'same-origin'
    });
    if (!res.ok) return [];
    const json = await res.json();
    return json.d?.results || [];
};

// Envía un archivo a la papelera de reciclaje del sitio.
export const recycleFile = async (fileRef, digest) => {
    const url = `${AC_SITE_URL}/_api/web/GetFileByServerRelativeUrl('${encodeURIComponent(fileRef)}')/recycle()`;
    const res = await fetch(url, {
        method: 'POST',
        headers: { "Accept": "application/json;odata=verbose", "X-RequestDigest": digest },
        credentials: 'same-origin'
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} eliminando archivo`);
};

// Convierte un dataURL (base64, p.ej. imagen comprimida) a Uint8Array para subirlo como binario.
export const dataUrlToUint8Array = (dataUrl) => {
    const base64 = dataUrl.split(',')[1] || '';
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
};
