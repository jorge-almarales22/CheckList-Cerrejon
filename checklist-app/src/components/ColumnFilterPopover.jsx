import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * Popover reutilizable para filtros multi-select.
 * Mismo estilo y comportamiento que usan los encabezados de la tabla principal
 * de incorporaciones (CheckListAll): buscador, Todos/Ninguno, contador,
 * Limpiar y Aplicar; cierre con clic fuera o Escape; posicionamiento fijo
 * respecto al ancla (boton disparador).
 *
 * Props:
 *  - column:    { key, label }               Identidad y titulo del filtro.
 *  - values:    string[]                     Opciones mostradas.
 *  - selectedValues: string[]|Set<string>    Seleccion actual aplicada.
 *  - theme:     'light'|'dark'               Tema visual.
 *  - onApply:   (selected: Set<string>) => void  Notifica al pulsar Aplicar o
 *                                             al hacer clic fuera.
 *  - onClear:   opcional; si se omite, onApply(new Set()) se usa al pulsar Limpiar.
 *  - anchorRef: ref del boton ancla para posicionar el popover.
 */
export const ColumnFilterPopover = ({ column, values, selectedValues, theme, onApply, onClear, anchorRef }) => {
    const [search, setSearch] = useState('');
    const [selected, setSelected] = useState(() => new Set(selectedValues || []));
    const searchRef = useRef(null);
    const visibleValues = values.filter(value =>
        value.toLowerCase().includes(search.trim().toLowerCase())
    );

    useEffect(() => {
        // El listener de clic fuera se registra en el siguiente tick para no
        // capturar el mismo mousedown que abrio el popover y cerrarlo de inmediato.
        const id = window.setTimeout(() => searchRef.current?.focus(), 0);
        const applyAndClose = () => onApply(selected);
        const handleKeyDown = (event) => { if (event.key === 'Escape') applyAndClose(); };
        const handleOutsideClick = (event) => {
            const target = event.target;
            if (!target || !(target instanceof Element)) return;
            if (target.closest('.column-filter-popover')) return;
            if (anchorRef?.current && anchorRef.current.contains(target)) return;
            applyAndClose();
        };
        document.addEventListener('keydown', handleKeyDown);
        // El listener se pospone un ciclo para no reaccionar al mousedown que abrio
        // el popover. Si no, al dar clic en el boton se abre y se cierra al toque.
        const outsideId = window.setTimeout(() => {
            document.addEventListener('mousedown', handleOutsideClick);
        }, 0);
        return () => {
            window.clearTimeout(id);
            window.clearTimeout(outsideId);
            document.removeEventListener('keydown', handleKeyDown);
            document.removeEventListener('mousedown', handleOutsideClick);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [onApply, selected, anchorRef]);

    const toggleValue = (value) => {
        setSelected(previous => {
            const next = new Set(previous);
            if (next.has(value)) next.delete(value); else next.add(value);
            return next;
        });
    };

    const selectVisible = (shouldSelect) => {
        setSelected(previous => {
            const next = new Set(previous);
            visibleValues.forEach(value => shouldSelect ? next.add(value) : next.delete(value));
            return next;
        });
    };

    const handleClear = () => {
        if (onClear) onClear();
        else onApply(new Set());
    };

    return createPortal(
        <div
            className={`column-filter-popover ${theme === 'dark' ? 'column-filter-popover-dark' : ''}`}
            role="dialog"
            aria-label={`Filtrar ${column.label}`}
            onClick={event => event.stopPropagation()}
        >
            <div className={`column-filter-search-wrap ${theme === 'dark' ? 'column-filter-search-wrap-dark' : ''}`}>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="m21 21-4.35-4.35m1.35-5.15a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0Z" />
                </svg>
                <input
                    ref={searchRef}
                    value={search}
                    onChange={event => setSearch(event.target.value)}
                    placeholder="Buscar valor..."
                    autoComplete="off"
                />
            </div>
            <div className="column-filter-quick-actions">
                <button type="button" onClick={() => selectVisible(true)}>Todos</button>
                <button type="button" onClick={() => selectVisible(false)}>Ninguno</button>
            </div>
            <div className="column-filter-list" role="listbox" aria-label={`Valores de ${column.label}`}>
                {visibleValues.length === 0 ? (
                    <p className="column-filter-empty">Sin resultados</p>
                ) : visibleValues.map(value => (
                    <label key={value} className="column-filter-option">
                        <input
                            type="checkbox"
                            checked={selected.has(value)}
                            onChange={() => toggleValue(value)}
                        />
                        <span title={value}>{value}</span>
                    </label>
                ))}
            </div>
            <div className={`column-filter-footer ${theme === 'dark' ? 'column-filter-footer-dark' : ''}`}>
                <span>{selected.size} de {values.length} seleccionados</span>
                <button type="button" className="column-filter-clear" onClick={handleClear}>Limpiar</button>
                <button type="button" className="column-filter-apply" onClick={() => onApply(selected)}>Aplicar</button>
            </div>
        </div>,
        document.body
    );
};

/**
 * Boton disparador + popover controlado. Acepta un anchorRef opcional para
 * colocar el popover bajo el boton. Si no se pasa, el popover se coloca en la
 * esquina superior derecha (por ejemplo en celdas de tabla sin posicion propia).
 */
export const ColumnFilterTrigger = ({
    column,
    values,
    selectedValues,
    theme,
    onApply,
    onClear,
    className = ''
}) => {
    const buttonRef = useRef(null);
    const [isOpen, setIsOpen] = useState(false);
    const [popoverStyle, setPopoverStyle] = useState({});

    useEffect(() => {
        if (!isOpen) return undefined;
        const updatePosition = () => {
            const rect = buttonRef.current?.getBoundingClientRect();
            if (!rect) return;
            const width = Math.min(336, window.innerWidth - 24);
            const gap = 6;
            const below = window.innerHeight - rect.bottom - gap;
            const above = rect.top - gap;
            const opensAbove = below < 300 && above > below;
            const availableHeight = Math.max(220, (opensAbove ? above : below) - 12);
            const left = Math.min(Math.max(12, rect.left), window.innerWidth - width - 12);
            setPopoverStyle({
                left: `${left}px`,
                width: `${width}px`,
                ...(opensAbove ? { bottom: `${window.innerHeight - rect.top + gap}px` } : { top: `${rect.bottom + gap}px` }),
                maxHeight: `${availableHeight}px`
            });
        };
        updatePosition();
        window.addEventListener('resize', updatePosition);
        window.addEventListener('scroll', updatePosition, true);
        return () => {
            window.removeEventListener('resize', updatePosition);
            window.removeEventListener('scroll', updatePosition, true);
        };
    }, [isOpen]);

    const activeCount = selectedValues instanceof Set ? selectedValues.size : (selectedValues || []).length;

    return (
        <>
            <button
                ref={buttonRef}
                type="button"
                className={`filterable-header-button ${theme === 'dark' ? 'filterable-header-button-dark' : ''} ${activeCount > 0 ? 'filterable-header-button-active' : ''} ${className}`}
                onClick={() => setIsOpen(true)}
                aria-haspopup="dialog"
                aria-expanded={isOpen}
                title={`Filtrar ${column.label}`}
            >
                <span>{column.label}</span>
                {activeCount > 0 && <span className="filterable-header-badge">{activeCount}</span>}
                <svg className="filterable-header-icon" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M4 5h16l-6 7v5l-4 2v-7L4 5Z" />
                </svg>
            </button>
            {isOpen && (
                <ColumnFilterPopover
                    column={column}
                    values={values}
                    selectedValues={selectedValues}
                    theme={theme}
                    onApply={(selected) => {
                        onApply(selected);
                        setIsOpen(false);
                    }}
                    onClear={onClear}
                    anchorRef={buttonRef}
                />
            )}
        </>
    );
};