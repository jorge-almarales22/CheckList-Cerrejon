import React, { useState, useEffect } from 'react';
import Dashboard from './components/Dashboard';
import { SITE_URL } from './data/constants';
import { iniciarVerificadorVersion } from './utils/versionChecker';

const App = () => {
    const [user, setUser] = useState(null);
    const [userName, setUserName] = useState('');
    const [role, setRole] = useState(null);
    const [loading, setLoading] = useState(true);

    // Deteccion de nuevas versiones: consulta version.json (sin cache) al
    // cargar, cada 5 minutos y cuando la pestana recupera el foco. Si hay una
    // version nueva desplegada, muestra un modal SweetAlert2 para recargar
    // limpio (evita problemas de cache en usuarios con versiones viejas).
    useEffect(() => {
        const detener = iniciarVerificadorVersion();
        return () => detener();
    }, []);

    useEffect(() => {
        const initUser = async () => {
            try {
                const res = await fetch(`${SITE_URL}/_api/web/currentuser?$select=Email,Title`, {
                    headers: { "Accept": "application/json;odata=verbose" },
                    credentials: 'same-origin'
                });
                const data = await res.json();
                const userEmail = data.d.Email || data.d.Title;

                setUser(userEmail);
                setUserName(data.d.Title || userEmail);
                const admins = ['jorge.almarales.ext@cerrejon.com', 'samir.tenorio.ext@cerrejon.com', 'dilson.zuleta.ext@cerrejon.com', 'gary.hernandez@cerrejon.com', 'roberto.lequerica@cerrejon.com', 'jose.c.barrios@cerrejon.com'];
                setRole(admins.includes(userEmail.toLowerCase()) ? 'Administrador' : 'Responsable');
            } catch (error) {
                console.error("Error fetching current user:", error);
                alert("No se pudo autenticar con SharePoint.");
            } finally {
                setLoading(false);
            }
        };
        initUser();
    }, []);

    if (loading) return <div className="text-white text-center mt-20 font-bold text-xl">Autenticando con Microsoft 365...</div>;
    if (!user) return <div className="text-white text-center mt-20">Error de autenticaci&oacute;n con el sistema de la empresa.</div>;

    return <Dashboard user={user} userName={userName} role={role} onLogout={() => alert("Tu sesi\u00f3n est\u00e1 vinculada a tu cuenta de Microsoft. Para cerrar sesi\u00f3n, debes salir de tu cuenta corporativa en el navegador.")} />;
};

export default App;
