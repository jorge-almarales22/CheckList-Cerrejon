import { useEffect, useState } from 'react';

// Los filtros de la app se comportan como los de Excel: lo que el usuario deja
// seleccionado sigue ahi al cambiar de vista, recargar o volver dias despues.
// Se guardan en localStorage porque son preferencias de pantalla de ESE usuario
// en ESE navegador: nunca datos del checklist, que viven solo en SharePoint.
const PREFIJO = 'incorporaciones.filtros.';

// Los filtros multi-seleccion son Set, que JSON.stringify convierte en {}. Se
// marcan al guardar para poder reconstruirlos al leer.
const serializar = (valor) => {
    if (valor instanceof Set) return { __set: [...valor] };
    if (valor && typeof valor === 'object' && !Array.isArray(valor)) {
        return Object.fromEntries(Object.entries(valor).map(([k, v]) => [k, serializar(v)]));
    }
    return valor;
};

const deserializar = (valor) => {
    if (valor && typeof valor === 'object' && !Array.isArray(valor)) {
        if (Array.isArray(valor.__set)) return new Set(valor.__set);
        return Object.fromEntries(Object.entries(valor).map(([k, v]) => [k, deserializar(v)]));
    }
    return valor;
};

const leer = (clave, valorInicial) => {
    try {
        const crudo = window.localStorage.getItem(PREFIJO + clave);
        if (crudo === null) return valorInicial;
        return deserializar(JSON.parse(crudo));
    } catch {
        // Modo incognito, almacenamiento bloqueado o JSON corrupto: se arranca limpio.
        return valorInicial;
    }
};

// useState que recuerda su valor entre visitas. `clave` identifica el filtro;
// en el detalle se incluye el id del checklist para que cada incorporacion
// conserve los suyos (un responsable filtrado en una no existe en otra).
export const useFiltroPersistente = (clave, valorInicial) => {
    const [valor, setValor] = useState(() => leer(clave, valorInicial));

    useEffect(() => {
        try {
            window.localStorage.setItem(PREFIJO + clave, JSON.stringify(serializar(valor)));
        } catch {
            // Sin almacenamiento los filtros siguen funcionando, solo no se recuerdan.
        }
    }, [clave, valor]);

    return [valor, setValor];
};
