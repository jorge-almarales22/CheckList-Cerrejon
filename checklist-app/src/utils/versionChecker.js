import Swal from 'sweetalert2';

// ---------------------------------------------------------------------------
// Deteccion de nuevas versiones y actualizacion automatica.
//
// En cada build se genera dist/version.json ({"version": "<timestamp>"}) y se
// copia al export de SharePoint. Este modulo consulta ese archivo con
// cache: 'no-store' (evita que el navegador sirva una copia vieja) y compara
// con la version guardada en localStorage la primera vez que cargo la app.
// Si difieren, muestra un modal SweetAlert2 persistente con "Actualizar ahora".
// ---------------------------------------------------------------------------

const VERSION_KEY = 'app_version';
// Intervalo de verificacion en segundo plano (ms). 5 minutos.
const CHECK_INTERVAL = 5 * 60 * 1000;

// Lee la version guardada localmente (null si es la primera carga).
const getLocalVersion = () => {
    try {
        return localStorage.getItem(VERSION_KEY);
    } catch {
        return null;
    }
};

// Guarda la version local (solo si el storage esta disponible).
const setLocalVersion = (version) => {
    try {
        localStorage.setItem(VERSION_KEY, version);
    } catch {
        // Sin storage: no se puede persistir, se ignora.
    }
};

// Consulta version.json en el servidor (sin cache).
const fetchServerVersion = async () => {
    const res = await fetch(`./version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status} consultando version.json`);
    const json = await res.json();
    return json?.version || null;
};

// Muestra el modal de actualizacion y, al confirmar, guarda la version nueva
// y fuerza una recarga limpia (timestamp en la URL para saltar la cache).
const mostrarModalActualizacion = (serverVersion) => {
    Swal.fire({
        title: '¡Nueva versión disponible!',
        text: 'Se ha desplegado una actualización del sistema con mejoras y correcciones.',
        icon: 'info',
        allowOutsideClick: false,
        allowEscapeKey: false,
        showCancelButton: false,
        confirmButtonText: 'Actualizar ahora',
        confirmButtonColor: '#d97706'
    }).then((result) => {
        if (result.isConfirmed) {
            setLocalVersion(serverVersion);
            window.location.href = window.location.pathname + '?v=' + Date.now();
        }
    });
};

// Verifica una vez: si hay version nueva, muestra el modal.
export const verificarVersion = async () => {
    try {
        const serverVersion = await fetchServerVersion();
        if (!serverVersion) return;
        const localVersion = getLocalVersion();
        if (localVersion !== serverVersion) {
            mostrarModalActualizacion(serverVersion);
        }
    } catch (err) {
        // version.json puede no existir en dev o en despliegues viejos:
        // se ignora silenciosamente (no romper la app por esto).
        console.warn('No se pudo verificar la versión de la aplicación:', err.message);
    }
};

// Verifica al cargar y luego en segundo plano cada CHECK_INTERVAL ms.
// Tambien verifica cuando la pestana recupera el foco (visibilitychange).
export const iniciarVerificadorVersion = () => {
    verificarVersion();
    const intervalId = setInterval(verificarVersion, CHECK_INTERVAL);
    const onVisibility = () => {
        if (document.visibilityState === 'visible') verificarVersion();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
        clearInterval(intervalId);
        document.removeEventListener('visibilitychange', onVisibility);
    };
};