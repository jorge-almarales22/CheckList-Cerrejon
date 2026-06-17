import React, { useState, useEffect, useRef } from 'react';
import { SITE_URL } from '../data/constants';
import { getRequestDigest } from '../utils/sharepointApi';

const PeoplePicker = ({ value, onChange, placeholder, className, readOnly }) => {
    const [query, setQuery] = useState(value || '');
    const [results, setResults] = useState([]);
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const wrapperRef = useRef(null);

    useEffect(() => {
        setQuery(value || '');
    }, [value]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (!query || query === value || readOnly) {
            setResults([]);
            return;
        }

        const delayDebounceFn = setTimeout(async () => {
            setLoading(true);
            try {
                const digest = await getRequestDigest();
                const response = await fetch(`${SITE_URL}/_api/SP.UI.ApplicationPages.ClientPeoplePickerWebServiceInterface.clientPeoplePickerSearchUser`, {
                    method: 'POST',
                    headers: {
                        "Accept": "application/json;odata=verbose",
                        "Content-Type": "application/json;odata=verbose",
                        "X-RequestDigest": digest
                    },
                    credentials: 'same-origin',
                    body: JSON.stringify({
                        queryParams: {
                            __metadata: { type: "SP.UI.ApplicationPages.ClientPeoplePickerQueryParameters" },
                            AllowEmailAddresses: true,
                            AllowMultipleEntities: false,
                            AllUrlZones: false,
                            MaximumEntitySuggestions: 10,
                            PrincipalSource: 15,
                            PrincipalType: 1,
                            QueryString: query
                        }
                    })
                });
                const data = await response.json();
                const parsedResults = JSON.parse(data.d.ClientPeoplePickerSearchUser);
                setResults(parsedResults);
                setIsOpen(true);
            } catch (error) {
                console.error("Error searching users:", error);
            } finally {
                setLoading(false);
            }
        }, 500);

        return () => clearTimeout(delayDebounceFn);
    }, [query, value, readOnly]);

    const handleSelect = (user) => {
        const email = user.EntityData.Email || user.Key;
        setQuery(email);
        setIsOpen(false);
        onChange(email);
    };

    return (
        <div className="relative w-full" ref={wrapperRef}>
            <input
                type="text"
                className={`${className} ${readOnly ? 'bg-transparent border-transparent' : ''}`}
                placeholder={placeholder || "Buscar usuario AD..."}
                value={query}
                onChange={(e) => {
                    setQuery(e.target.value);
                    if (e.target.value !== value) onChange('');
                }}
                onFocus={() => { if (results.length > 0 && !readOnly) setIsOpen(true); }}
                readOnly={readOnly}
                required={!readOnly}
            />
            {loading && <div className="absolute right-3 top-3 w-4 h-4 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin"></div>}
            {isOpen && results.length > 0 && (
                <ul className="absolute z-[999] min-w-[300px] left-0 bg-gray-800 border border-white/20 rounded-lg mt-1 max-h-60 overflow-y-auto shadow-2xl">
                    {results.map((user, idx) => (
                        <li
                            key={idx}
                            className="px-4 py-3 hover:bg-white/10 cursor-pointer border-b border-white/5 last:border-0 flex items-center gap-3"
                            onClick={() => handleSelect(user)}
                        >
                            <img
                                src={`https://glencore.sharepoint.com/_layouts/15/userphoto.aspx?size=S&accountname=${user.EntityData.Email || user.Key}`}
                                alt={user.DisplayText}
                                className="w-10 h-10 rounded-full border border-white/20 object-cover bg-gray-700"
                                onError={(e) => { e.target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='%23ccc' viewBox='0 0 24 24'%3E%3Cpath d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'/%3E%3C/svg%3E"; }}
                            />
                            <div className="flex flex-col">
                                <span className="text-white font-bold text-sm leading-tight">{user.DisplayText}</span>
                                <span className="text-white/50 text-xs">{user.EntityData.Email || user.Key}</span>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

export default PeoplePicker;
