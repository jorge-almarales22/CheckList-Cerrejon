import React, { useState, useEffect, useRef } from 'react';

// Abre una URL en Microsoft Edge usando el protocolo microsoft-edge:
// Si el navegador actual ya es Edge, el protocolo abre una nueva pestaña.
// Como fallback, usa window.open.
const abrirEnEdge = (url) => {
    try {
        // Usar el protocolo microsoft-edge: que abre la URL en Edge
        window.location.href = `microsoft-edge:${url}`;
    } catch (e) {
        window.open(url, '_blank');
    }
};

// Estructura del navbar. Los items marcados con adminOnly solo se muestran a admins.
const NAV_ITEMS = [
    { texto: 'Inicio', url: 'https://glencore.sharepoint.com/sites/co-lmn-sgia/SitePages/Inicio.aspx', target: '_self' },
    { texto: 'Reclamos y NC', url: 'https://glencore.sharepoint.com/sites/co-lmn-ada/SitePages/Home.aspx', target: '_blank' },
    { texto: 'Asistente AM', url: 'asistente.aspx', target: '_self' },
    { texto: 'Boletines', url: 'https://glencore.sharepoint.com/sites/co-lmn-sgia/boletines/SitePages/inicio.aspx', target: '_blank' },
    { texto: 'Comité SGIA', url: 'https://glencore.sharepoint.com/sites/co-lmn-sgia/SitePages/marco_estrategico.aspx', target: '_blank' },
    {
        texto: 'Seguimiento y control', adminOnly: true, submenu: [
            { texto: 'Planes Maduración SGIA Áreas', url: 'planesGA.aspx', target: '_self' },
            { texto: 'Planes Captura Valor', url: 'https://glencore.sharepoint.com/sites/co-lmn-sgia/SitePages/planes_capv.aspx', target: '_self' },
        ]
    },
    {
        texto: 'Tableros', adminOnly: true, submenu: [
            { texto: 'Portafolio', edge: 'https://powerbi-prod-lmn.co.glencore.net/Reports/powerbi/Cerrejón/VP Ejecutivo de Operaciones/Mantenimiento/Gestión de activos/Gestión e Integridad de activos/Tablero MTO - Consulta De Equipos(Ellipse)' },
            { texto: 'Seguimiento a Gestión de Activos', edge: 'https://powerbi-prod-lmn.co.glencore.net/Reports/powerbi/Cerrejón/VP Ejecutivo de Operaciones/Mantenimiento/Gestión de activos/Gestión e Integridad de activos/SGIA - SEGUIMIENTO A GESTION DE ACTIVOS' },
            { texto: 'Tablero SGIA', edge: 'http://lmnqvs01/QvAJAXZfc/opendoc.htm?document=generales\mto-sgia.qvw&host=QVS@lmnqvs01' },
        ]
    },
    {
        texto: 'Herramientas', adminOnly: true, submenu: [
            {
                texto: 'Asset Management', submenu: [
                    { texto: 'CritiScore', url: 'https://glencore.sharepoint.com/sites/co-lmn-sgia/ac/SiteAssets/WebAC/home.aspx', target: '_blank' },
                    { texto: 'Autoevaluar Asset Management', url: 'https://glencore.sharepoint.com/sites/co-lmn-sgia/SitePages/herramienta AM-A/login.aspx', target: '_blank' },
                    { texto: 'Panel Asset Management', url: 'https://glencore.sharepoint.com/sites/co-lmn-sgia/SitePages/herramienta AM/index.aspx', target: '_blank' },
                ]
            },
            {
                texto: 'Work Management', submenu: [
                    { texto: 'Auto Evaluar Work Management', url: 'https://glencore.sharepoint.com/sites/co-lmn-sgia/SitePages/Herramienta/update.aspx', target: '_blank' },
                    { texto: 'Panel Work Management', url: 'https://glencore.sharepoint.com/sites/co-lmn-sgia/SitePages/AdminSopMTTO/index.aspx', target: '_blank' },
                    { texto: 'PriOTool (Prioridad de ordenes de trabajo)', url: 'https://glencore.sharepoint.com/sites/co-lmn-sgia/SitePages/prioridades/index.aspx', target: '_blank' },
                    { texto: 'Documentación Auditorias WM', url: 'https://glencore.sharepoint.com/sites/co-lmn-sgia/Documentacion Auditorias/Forms/AllItems.aspx', target: '_blank' },
                    { texto: 'Verificación de calidad del trabajo', url: 'observaciones/login-observaciones.aspx', target: '_blank' },
                    { texto: 'Efectividad de identificación del trabajo', url: 'https://glencore.sharepoint.com/sites/co-lmn-sgia/SitePages/inspecciones/panel.aspx', target: '_blank' },
                ]
            },
        ]
    },
    {
        texto: 'AM Framework', adminOnly: true, submenu: [
            { texto: 'Manual AMF', url: 'https://glencore.sharepoint.com/:b:/s/co-lmn-sgia/ETNMp5wIGsdJm0EqAv_fAtcBLyLjcgSuku8BQTkeNq2AEg?e=LddGbE', target: '_self' },
            {
                texto: 'Dirección Estratégica', submenu: [
                    { texto: 'Elemento 1: Liderazgo en la gestión de activos', url: 'https://glencore.sharepoint.com/sites/co-lmn-sgia/SitePages/am-framework.aspx?json=elemento_1.json', target: '_blank' },
                    { texto: 'Elemento 2: Gestión de personal', url: 'https://glencore.sharepoint.com/sites/co-lmn-sgia/SitePages/am-framework.aspx?json=elemento_2.json', target: '_blank' },
                ]
            },
            {
                texto: 'Planificación de activos', submenu: [
                    { texto: 'Elemento 3: Planificación de la gestión de activos', url: 'https://glencore.sharepoint.com/sites/co-lmn-sgia/SitePages/am-framework.aspx?json=elemento_3.json', target: '_blank' },
                ]
            },
            {
                texto: 'Incorporación de activos', submenu: [
                    { texto: 'Elemento 4: Creación, ingreso y entrega de insfraestructura', url: 'https://glencore.sharepoint.com/sites/co-lmn-sgia/SitePages/am-framework.aspx?json=elemento_4.json', target: '_blank' },
                    { texto: 'Elemento 5: Estrategia de operación y mantenimiento de los activos', url: 'https://glencore.sharepoint.com/sites/co-lmn-sgia/SitePages/am-framework.aspx?json=elemento_5.json', target: '_blank' },
                    { texto: 'Elemento 6: Gestión de creación, ingreso y entrega de equipos', url: 'https://glencore.sharepoint.com/sites/co-lmn-sgia/SitePages/am-framework.aspx?json=elemento_6.json', target: '_blank' },
                ]
            },
            {
                texto: 'Operación y mantenimiento', submenu: [
                    { texto: 'Elemento 7: Operar para la confiabilidad', url: 'https://glencore.sharepoint.com/sites/co-lmn-sgia/SitePages/am-framework.aspx?json=elemento_7.json', target: '_blank' },
                    { texto: 'Elemento 8: Work management', url: 'https://glencore.sharepoint.com/sites/co-lmn-sgia/SitePages/am-framework.aspx?json=elemento_8.json', target: '_blank' },
                    { texto: 'Elemento 9: Gestión de paradas mayores', url: 'https://glencore.sharepoint.com/sites/co-lmn-sgia/SitePages/am-framework.aspx?json=elemento_9.json', target: '_blank' },
                ]
            },
            {
                texto: 'Desincorporación de activos', submenu: [
                    { texto: 'Elemento 10: Desmantelamiento y enajenación de activos', url: 'https://glencore.sharepoint.com/sites/co-lmn-sgia/SitePages/am-framework.aspx?json=elemento_10.json', target: '_blank' },
                ]
            },
            {
                texto: 'Soporte y control', submenu: [
                    { texto: 'Elemento 11: Contratación y subcontratación', url: 'https://glencore.sharepoint.com/sites/co-lmn-sgia/SitePages/am-framework.aspx?json=elemento_11.json', target: '_blank' },
                    { texto: 'Elemento 12: Gestión de la información de activos', url: 'https://glencore.sharepoint.com/sites/co-lmn-sgia/SitePages/am-framework.aspx?json=elemento_12.json', target: '_blank' },
                    { texto: 'Elemento 13: Gestión de la cadena de suministros', url: 'https://glencore.sharepoint.com/sites/co-lmn-sgia/SitePages/am-framework.aspx?json=elemento_13.json', target: '_blank' },
                    { texto: 'Elemento 14: Gestión de riesgos y cumplimiento', url: 'https://glencore.sharepoint.com/sites/co-lmn-sgia/SitePages/am-framework.aspx?json=elemento_14.json', target: '_blank' },
                    { texto: 'Elemento 15: Control de costos de los activos', url: 'https://glencore.sharepoint.com/sites/co-lmn-sgia/SitePages/am-framework.aspx?json=elemento_15.json', target: '_blank' },
                    { texto: 'Elemento 16: Gestión de reportes y desempeño de activos', url: 'https://glencore.sharepoint.com/sites/co-lmn-sgia/SitePages/am-framework.aspx?json=elemento_16.json', target: '_blank' },
                    { texto: 'Elemento 17: Gestión de la mejora continua e innovación', url: 'https://glencore.sharepoint.com/sites/co-lmn-sgia/SitePages/am-framework.aspx?json=elemento_17.json', target: '_blank' },
                    { texto: 'Elemento 18: Monitoreo, auditoría y aseguramiento de la gestión de activos', url: 'https://glencore.sharepoint.com/sites/co-lmn-sgia/SitePages/am-framework.aspx?json=elemento_18.json', target: '_blank' },
                ]
            },
        ]
    },
];

// Los submenús siempre se abren hacia la izquierda para evitar el parpadeo
// de intentar abrir a la derecha y rebotar a la izquierda.
const useDropdownDirection = (isOpen) => {
    const ref = useRef(null);
    const direction = 'left'; // siempre izquierda
    return { ref, direction };
};

// Clases de color segun tema
const useNavTheme = (theme) => {
    const isDark = theme === 'dark';
    return {
        isDark,
        navBg: isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200',
        collapseBg: isDark ? 'bg-slate-900' : 'bg-white',
        linkText: isDark ? 'text-slate-200 hover:bg-yellow-500/10 hover:text-yellow-400' : 'text-slate-900 hover:bg-yellow-50 hover:text-amber-700',
        dropdownBg: isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200',
        togglerText: isDark ? 'text-slate-200 hover:bg-slate-800' : 'text-slate-900 hover:bg-slate-100',
        collapseBorder: isDark ? 'border-slate-700' : 'border-slate-200',
    };
};

// Renderiza un item de menú (link simple)
const NavLink = ({ item, theme }) => {
    const t = useNavTheme(theme);
    const handleClick = (e) => {
        if (item.edge) {
            e.preventDefault();
            abrirEnEdge(item.edge);
        }
    };
    return (
        <a
            href={item.edge ? '#' : item.url}
            target={item.target === '_blank' ? '_blank' : undefined}
            rel={item.target === '_blank' ? 'noopener noreferrer' : undefined}
            onClick={handleClick}
            className={`block px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap ${t.linkText}`}
        >
            {item.texto}
        </a>
    );
};

// Item de submenu (nivel 2+) con deteccion de direccion
const SubMenuItem = ({ sub, theme }) => {
    const t = useNavTheme(theme);
    const [isOpen, setIsOpen] = useState(false);
    const { ref, direction } = useDropdownDirection(isOpen);

    if (sub.submenu) {
        return (
            <li
                ref={ref}
                className="relative navbar-dropdown-item"
                onMouseEnter={() => { if (window.innerWidth >= 1024) setIsOpen(true); }}
                onMouseLeave={() => { if (window.innerWidth >= 1024) setIsOpen(false); }}
            >
                <a
                    href="#"
                    onClick={(e) => { e.preventDefault(); if (window.innerWidth < 1024) setIsOpen(!isOpen); }}
                    className={`flex items-center justify-between px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap ${t.linkText}`}
                >
                    <span>{sub.texto}</span>
                    <svg className="w-3 h-3 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                    </svg>
                </a>
                <ul className={`navbar-submenu border rounded-lg shadow-lg min-w-[260px] ${isOpen ? 'block' : 'hidden'} lg:absolute lg:top-0 ${t.dropdownBg} ${direction === 'left' ? 'lg:right-full' : 'lg:left-full'} navbar-submenu-hover`}>
                    {sub.submenu.map((sub2, s2idx) => (
                        <li key={s2idx}>
                            <NavLink item={sub2} theme={theme} />
                        </li>
                    ))}
                </ul>
            </li>
        );
    }
    return <NavLink item={sub} theme={theme} />;
};

// Item de dropdown de primer nivel con deteccion de direccion
const DropdownItem = ({ item, idx, openDropdown, setOpenDropdown, theme }) => {
    const t = useNavTheme(theme);
    const { ref, direction } = useDropdownDirection(openDropdown === idx);
    const isOpen = openDropdown === idx;

    const handleItemClick = () => {
        if (window.innerWidth < 1024) {
            setOpenDropdown(isOpen ? null : idx);
        }
    };

    return (
        <li
            ref={ref}
            className="relative navbar-nav-item navbar-has-dropdown"
            onMouseEnter={() => { if (window.innerWidth >= 1024) setOpenDropdown(idx); }}
            onMouseLeave={() => { if (window.innerWidth >= 1024) setOpenDropdown(null); }}
        >
            <button
                onClick={handleItemClick}
                className={`flex items-center justify-between w-full lg:w-auto px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap ${t.linkText}`}
                aria-expanded={isOpen}
            >
                <span>{item.texto}</span>
                <svg className={`w-3 h-3 ml-1.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
            </button>
            {/* Dropdown de primer nivel */}
            <div className={`${isOpen ? 'block' : 'hidden'} lg:navbar-dropdown`}>
                <ul className={`navbar-dropdown-menu border rounded-lg shadow-lg min-w-[260px] lg:absolute lg:top-full mt-1 lg:mt-0 ${t.dropdownBg} ${direction === 'left' ? 'lg:right-0' : 'lg:left-0'}`}>
                    {item.submenu.map((sub, sidx) => (
                        <SubMenuItem key={sidx} sub={sub} theme={theme} />
                    ))}
                </ul>
            </div>
        </li>
    );
};

const Navbar = ({ role, theme }) => {
    const [mobileOpen, setMobileOpen] = useState(false);
    const [openDropdown, setOpenDropdown] = useState(null);
    const navRef = useRef(null);
    const t = useNavTheme(theme);
    const isAdmin = role === 'Administrador';

    // Filtra items segun rol
    const visibleItems = NAV_ITEMS.filter(item => !item.adminOnly || isAdmin);

    // Cierra el menu movil al hacer click fuera
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (navRef.current && !navRef.current.contains(e.target)) {
                setMobileOpen(false);
                setOpenDropdown(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <nav
            ref={navRef}
            className={`navbar-sgia sticky top-0 z-[1000] border-b shadow-sm transition-colors duration-300 ${t.navBg}`}
        >
            <div className="max-w-full mx-auto px-3 md:px-6">
                <div className="flex items-center justify-between h-[60px] md:h-[75px]">
                    {/* Logo */}
                    <a
                        href="incorporaciones.aspx"
                        className="flex-shrink-0 flex items-center"
                        title="Cerrejón"
                    >
                        <img
                            src="Frontend/IMG/LOGO POLICROMIA.jpg"
                            alt="Cerrejón"
                            className="h-[40px] md:h-[55px] w-auto object-contain"
                            onError={(e) => { e.target.style.display = 'none'; }}
                        />
                    </a>

                    {/* Botón hamburguesa (movil) */}
                    <button
                        onClick={() => setMobileOpen(!mobileOpen)}
                        className={`lg:hidden p-2 rounded-lg transition-colors ${t.togglerText}`}
                        aria-label="Toggle navigation"
                        aria-expanded={mobileOpen}
                    >
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            {mobileOpen ? (
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                            ) : (
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                            )}
                        </svg>
                    </button>

                    {/* Menu principal */}
                    <div className={`navbar-collapse ${mobileOpen ? 'block' : 'hidden'} lg:block absolute lg:relative top-full lg:top-0 left-0 right-0 lg:w-auto border-b lg:border-b-0 shadow-lg lg:shadow-none ${t.collapseBg} ${t.collapseBorder}`}>
                        <ul className="flex flex-col lg:flex-row lg:items-center lg:gap-1 py-2 lg:py-0">
                            {visibleItems.map((item, idx) => (
                                item.submenu ? (
                                    <DropdownItem
                                        key={idx}
                                        item={item}
                                        idx={idx}
                                        openDropdown={openDropdown}
                                        setOpenDropdown={setOpenDropdown}
                                        theme={theme}
                                    />
                                ) : (
                                    <li key={idx} className="relative navbar-nav-item">
                                        <NavLink item={item} theme={theme} />
                                    </li>
                                )
                            ))}
                        </ul>
                    </div>
                </div>
            </div>
        </nav>
    );
};

export default Navbar;