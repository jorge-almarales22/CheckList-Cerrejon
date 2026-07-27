import React from 'react';

// Footer institucional de Cerrejón Colombia.
const Footer = ({ theme }) => {
    const isDark = theme === 'dark';
    const anio = new Date().getFullYear();

    return (
        <footer className={`mt-10 border-t ${isDark ? 'border-slate-800 text-slate-300' : 'border-slate-200 text-slate-700'}`}>
            <div className="max-w-[95%] mx-auto py-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
                    <div>
                        <h4 className={`font-black uppercase tracking-wider mb-2 ${isDark ? 'text-yellow-400' : 'text-amber-700'}`}>Cerrejón</h4>
                        <p className="font-semibold leading-relaxed">
                            Una empresa Glencore. Operación minera de carbón a cielo abierto en La Guajira, Colombia, comprometida con la minería responsable.
                        </p>
                    </div>
                    <div>
                        <h4 className={`font-black uppercase tracking-wider mb-2 ${isDark ? 'text-yellow-400' : 'text-amber-700'}`}>Gestión de Activos</h4>
                        <p className="font-semibold leading-relaxed">
                            Sistema de Gestión Integral de Activos (SGIA) — Incorporación de Activos.
                            Personas, sistemas y equipos para el ciclo de vida del activo.
                        </p>
                    </div>
                    <div>
                        <h4 className={`font-black uppercase tracking-wider mb-2 ${isDark ? 'text-yellow-400' : 'text-amber-700'}`}>Contacto</h4>
                        <p className="font-semibold leading-relaxed">La Guajira, Colombia</p>
                        <a href="https://www.cerrejon.com" target="_blank" rel="noopener noreferrer" className={`font-semibold underline ${isDark ? 'text-yellow-400 hover:text-yellow-300' : 'text-amber-700 hover:text-amber-600'}`}>www.cerrejon.com</a>
                    </div>
                </div>
                <div className={`mt-6 pt-4 border-t text-xs font-semibold text-center ${isDark ? 'border-slate-800 text-slate-400' : 'border-slate-200 text-slate-500'}`}>
                    © {anio} Cerrejón — Una empresa Glencore · Minería responsable · Todos los derechos reservados.
                </div>
            </div>
        </footer>
    );
};

export default Footer;
