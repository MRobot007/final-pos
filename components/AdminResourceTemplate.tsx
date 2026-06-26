'use client'

import { useState, useEffect, useMemo, useDeferredValue, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import {
    Plus,
    Search,
    Edit,
    Trash2,
    ChevronLeft,
    ChevronRight,
    ArrowUpDown,
    ArrowRight,
    Loader2,
    X,
    CheckCircle2
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { API_URL } from '@/lib/api-config'

interface Resource {
    id: number
    [key: string]: any
}

interface Field {
    label: string
    key: string
    type: 'text' | 'number' | 'email' | 'select' | 'textarea' | 'password' | 'checkbox' | 'datetime-local'
    options?: { label: string; value: any }[]
    required?: boolean
}

interface Column {
    label: string
    key: string
    align?: 'left' | 'center' | 'right'
    render?: (val: any, item: Resource) => React.ReactNode
}

interface PageProps {
    title: string
    description: string
    icon: any
    resourceName: string
    columns: Column[]
    apiPath: string
    fields?: Field[]
    renderActions?: (item: Resource) => React.ReactNode
    initialSearch?: string
    customFilter?: (data: Resource[]) => Resource[]
    headerActions?: React.ReactNode
}

export function AdminResourceTemplate({
    title,
    description,
    icon: Icon,
    resourceName,
    columns,
    apiPath,
    fields = [],
    renderActions,
    csvPath,
    showBulkDelete = false,
    initialSearch = '',
    customFilter,
    headerActions,
    serverPaginated = false,
    serverParams
}: PageProps & { csvPath?: string, showBulkDelete?: boolean, initialSearch?: string, customFilter?: (data: Resource[]) => Resource[], headerActions?: React.ReactNode, serverPaginated?: boolean, serverParams?: Record<string, string> }) {
    const [data, setData] = useState<Resource[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState(initialSearch)
    const [debouncedSearch, setDebouncedSearch] = useState('')
    const [currentPage, setCurrentPage] = useState(1)
    const pageSize = 25
    const [serverTotal, setServerTotal] = useState(0)
    const [showModal, setShowModal] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [editingId, setEditingId] = useState<number | null>(null)
    const [formData, setFormData] = useState<Record<string, any>>({})
    const [isCsvUploading, setIsCsvUploading] = useState(false)

    // Stable key so the inline serverParams object doesn't retrigger fetches every render.
    const serverParamsKey = serverParams ? JSON.stringify(serverParams) : ''

    const apiUrl = API_URL

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(search)
        }, 250)

        return () => clearTimeout(timer)
    }, [search])

    const fetchData = useCallback(async () => {
        try {
            const cacheKey = `resourceCache:${apiPath}`
            const cacheTimeKey = `resourceCacheTimestamp:${apiPath}`
            const now = Date.now()
            const cacheTtl = 5 * 60 * 1000
            let usedCache = false

            // Client cache only in client-paginated mode; server mode varies by page/search.
            if (!serverPaginated) {
                const cached = localStorage.getItem(cacheKey)
                const cachedAt = localStorage.getItem(cacheTimeKey)
                if (cached && cachedAt && now - parseInt(cachedAt) < cacheTtl) {
                    try {
                        const cachedData = JSON.parse(cached)
                        if (Array.isArray(cachedData)) {
                            setData(cachedData)
                            setLoading(false)
                            usedCache = true
                        }
                    } catch (e) {
                        usedCache = false
                    }
                }
            }

            if (!usedCache) {
                setLoading(true)
            }
            if (!apiUrl) throw new Error('API URL not defined')
            const token = localStorage.getItem('token')
            if (!token) return

            let url = `${apiUrl}${apiPath}`
            if (serverPaginated) {
                const params = new URLSearchParams()
                params.set('page', String(currentPage))
                params.set('limit', String(pageSize))
                const q = debouncedSearch.trim()
                if (q) params.set('q', q)
                if (serverParamsKey) {
                    const extra = JSON.parse(serverParamsKey) as Record<string, string>
                    Object.entries(extra).forEach(([k, v]) => params.set(k, v))
                }
                url += `?${params.toString()}`
            }

            const res = await fetch(url, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                cache: 'no-store'
            })

            const text = await res.text();
            let result = null;
            try {
                result = JSON.parse(text);
            } catch (e) {
                console.error(`Failed to parse ${resourceName} JSON:`, text);
            }

            if (!res.ok) {
                if (res.status === 401 || res.status === 403) {
                    console.warn(`${resourceName} access denied (403/401).`)
                } else {
                    console.error(`${resourceName} fetch failed:`, result?.error || 'Unknown error', result?.debug || '');
                }
                setData([])
                setLoading(false)
                return
            }

            let nextData: Resource[] = []
            if (Array.isArray(result)) {
                nextData = result
            } else if (result && typeof result === 'object') {
                const arrayKey = Object.keys(result).find(key => Array.isArray(result[key]))
                if (arrayKey) {
                    nextData = result[arrayKey]
                }
            }
            setData(nextData)
            if (serverPaginated && result && typeof result.total === 'number') {
                setServerTotal(result.total)
            }
            setLoading(false)
            if (!serverPaginated) {
                try {
                    localStorage.setItem(cacheKey, JSON.stringify(nextData))
                    localStorage.setItem(cacheTimeKey, now.toString())
                } catch (e) {
                    console.warn(`LocalStorage quota exceeded for ${resourceName}, skipping cache.`)
                }
            }
        } catch (err) {
            console.error(err)
            setData([])
            setLoading(false)
        }
    }, [apiUrl, apiPath, resourceName, serverPaginated, currentPage, debouncedSearch, serverParamsKey])

    useEffect(() => {
        fetchData()
    }, [fetchData])

    const handleAdd = () => {
        setEditingId(null)
        setFormData({})
        setShowModal(true)
    }

    const handleEdit = (item: Resource) => {
        setEditingId(item.id)
        const initialForm: any = {}
        fields.forEach(f => {
            initialForm[f.key] = item[f.key] !== undefined && item[f.key] !== null ? item[f.key] : ''
        })
        setFormData(initialForm)
        setShowModal(true)
    }

    const handleDelete = async (id: number) => {
        if (!confirm('Are you sure you want to delete this record?')) return
        try {
            if (!apiUrl) throw new Error('API URL not defined')
            const token = localStorage.getItem('token')
            if (!token) return

            const res = await fetch(`${apiUrl}${apiPath}/${id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                cache: 'no-store'
            })
            if (res.ok) {
                fetchData()
            } else {
                const err = await res.json()
                alert(err.error || 'Deletion failed')
            }
        } catch (err) {
            console.error(err)
            alert('An error occurred during deletion')
        }
    }

    const handleDeleteAll = async () => {
        if (!confirm('CRITICAL: This will permanently delete EVERY record in this resource. Are you absolutely certain?')) return
        try {
            const token = localStorage.getItem('token')
            const res = await fetch(`${apiUrl}${apiPath}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            })
            if (res.ok) {
                fetchData()
            } else {
                const err = await res.json()
                alert(err.error || 'Bulk deletion failed')
            }
        } catch (err) {
            console.error(err)
        }
    }

    const handleCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file || !csvPath) return

        setIsCsvUploading(true)
        try {
            const formData = new FormData()
            formData.append('file', file)
            const token = localStorage.getItem('token')
            const res = await fetch(`${apiUrl}${csvPath}`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            })
            const result = await res.json()
            if (res.ok) {
                alert(`Import Successful!\nImported: ${result.imported || 0} items\nUpdated: ${result.updated || 0} items`)
                fetchData()
            } else {
                alert(result.error || 'CSV Import failed')
            }
        } catch (err) {
            console.error(err)
            alert('CSV transmission error')
        } finally {
            setIsCsvUploading(false)
            e.target.value = ''
        }
    }

    const handleCsvExport = async () => {
        if (!csvPath) return
        try {
            const token = localStorage.getItem('token')
            const res = await fetch(`${apiUrl}${csvPath}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            })
            const blob = await res.blob()
            const url = window.URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `${resourceName.toLowerCase()}.csv`
            a.click()
            window.URL.revokeObjectURL(url)
        } catch (err) {
            console.error(err)
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsSubmitting(true)
        try {
            if (!apiUrl) throw new Error('API URL not defined')
            const token = localStorage.getItem('token')
            if (!token) return

            const res = await fetch(`${apiUrl}${apiPath}${editingId ? `/${editingId}` : ''}`, {
                method: editingId ? 'PUT' : 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData),
                credentials: 'include',
                cache: 'no-store'
            })

            if (res.ok) {
                setShowModal(false)
                fetchData()
            } else {
                const err = await res.json()
                alert(err.error || 'Operation failed')
            }
        } catch (err) {
            console.error(err)
        } finally {
            setIsSubmitting(false)
        }
    }

    const deferredSearch = useDeferredValue(debouncedSearch)
    const filteredData = useMemo(() => {
        // In server mode the API already filtered, searched, and paged this set.
        if (serverPaginated) return data

        let result = data

        if (customFilter) {
            result = customFilter(result)
        }

        const query = deferredSearch.trim().toLowerCase()
        if (!query) return result
        return result.filter(item =>
            Object.values(item).some(val =>
                String(val).toLowerCase().includes(query)
            )
        )
    }, [data, deferredSearch, customFilter, serverPaginated])

    const effectiveTotal = serverPaginated ? serverTotal : filteredData.length
    const totalPages = Math.max(1, Math.ceil(effectiveTotal / pageSize))
    const safePage = Math.min(currentPage, totalPages)
    const pagedData = useMemo(() => {
        if (serverPaginated) return filteredData
        const start = (safePage - 1) * pageSize
        return filteredData.slice(start, start + pageSize)
    }, [filteredData, safePage, serverPaginated])

    useEffect(() => {
        if (currentPage !== safePage) {
            setCurrentPage(safePage)
        }
    }, [currentPage, safePage])

    useEffect(() => {
        setCurrentPage(1)
    }, [apiPath, debouncedSearch, serverParamsKey])

    return (
        <div className="space-y-6 pb-8">
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6">
                <div>
                    <h2 className="text-2xl font-black text-black font-outfit uppercase tracking-tight">{title}</h2>
                    <p className="text-purple-500 mt-1 text-sm font-semibold">{description}</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <div className="relative group mr-2">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-purple-600 group-focus-within:text-primary transition-colors" size={18} />
                        <input
                            type="text"
                            placeholder={`Search ${resourceName}...`}
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="bg-white border border-purple-100 rounded-2xl pl-12 pr-6 py-3 w-64 focus:ring-2 focus:ring-primary/10 focus:border-primary/20 outline-none transition-all text-sm font-semibold text-purple-900 placeholder:text-purple-600"
                        />
                    </div>

                    {headerActions}

                    {csvPath && (
                        <>
                            <label className="px-5 py-3 rounded-2xl bg-white border border-green-100 text-green-600 font-black uppercase text-[10px] tracking-widest shadow-sm hover:bg-green-50 transition-all flex items-center gap-2 cursor-pointer">
                                {isCsvUploading ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />}
                                Import CSV
                                <input type="file" accept=".csv" className="hidden" onChange={handleCsvUpload} disabled={isCsvUploading} />
                            </label>
                            <button
                                onClick={handleCsvExport}
                                className="px-5 py-3 rounded-2xl bg-white border border-blue-100 text-blue-600 font-black uppercase text-[10px] tracking-widest shadow-sm hover:bg-blue-50 transition-all flex items-center gap-2"
                            >
                                Export CSV
                            </button>
                        </>
                    )}

                    {showBulkDelete && (
                        <button
                            onClick={handleDeleteAll}
                            className="px-5 py-3 rounded-2xl bg-white border border-red-100 text-red-600 font-black uppercase text-[10px] tracking-widest shadow-sm hover:bg-red-50 transition-all flex items-center gap-2"
                        >
                            <Trash2 size={16} />
                            Purge All
                        </button>
                    )}

                    {fields.length > 0 && (
                        <button
                            onClick={handleAdd}
                            className="premium-button flex items-center gap-2 uppercase text-[10px] tracking-widest font-black shadow-lg shadow-primary/20"
                        >
                            <Plus size={18} />
                            New {resourceName.slice(0, -1)}
                        </button>
                    )}
                </div>
            </div>

            <div className="bg-white rounded-2xl overflow-hidden border border-purple-100 shadow-sm">
                <div className="overflow-x-auto hidden lg:block">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-purple-100 bg-purple-50/50">
                                {columns.map((col, i) => (
                                    <th key={i} className={cn(
                                        "px-6 py-4 text-[10px] font-black text-purple-700 uppercase tracking-[0.2em]",
                                        col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : ''
                                    )}>
                                        {col.label}
                                    </th>
                                ))}
                                <th className="px-6 py-4 text-[10px] font-black text-purple-700 uppercase tracking-[0.2em] text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-purple-50">
                            {loading ? (
                                [...Array(5)].map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td colSpan={columns.length + 1} className="px-6 py-4 h-20 bg-purple-50/30" />
                                    </tr>
                                ))
                            ) : filteredData.length === 0 ? (
                                <tr>
                                    <td colSpan={columns.length + 1} className="px-8 py-20 text-center text-purple-600 font-bold uppercase tracking-[0.4em] text-[10px] opacity-60">
                                        No Records Found
                                    </td>
                                </tr>
                            ) : (
                                pagedData.map((item) => (
                                    <tr key={item.id} className="table-row group hover:bg-purple-50/80 transition-colors cursor-pointer border-l-2 border-l-transparent hover:border-l-primary">
                                        {columns.map((col, i) => {
                                            const val = col.key.split('.').reduce((obj, key) => obj?.[key], item)
                                            const displayVal = typeof val === 'object' ? JSON.stringify(val) : val
                                            return (
                                                <td key={i} className={cn(
                                                    "px-6 py-4",
                                                    col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : ''
                                                )}>
                                                    {col.render ? (
                                                        col.render(val, item)
                                                    ) : i === 0 ? (
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-9 h-9 rounded-lg bg-purple-50 border border-purple-100 flex items-center justify-center text-primary">
                                                                <Icon size={16} />
                                                            </div>
                                                            <span className="text-black font-black text-sm tracking-tight uppercase">{displayVal ?? 'N/A'}</span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-sm font-bold text-purple-900">{displayVal ?? '-'}</span>
                                                    )}
                                                </td>
                                            )
                                        })}
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                {renderActions && renderActions(item)}
                                                <button
                                                    onClick={() => handleEdit(item)}
                                                    className="w-9 h-9 rounded-xl bg-purple-50/50 border border-purple-100 flex items-center justify-center text-purple-800 hover:text-primary transition-all"
                                                >
                                                    <Edit size={14} />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(item.id)}
                                                    className="w-9 h-9 rounded-xl bg-purple-50/50 border border-purple-100 flex items-center justify-center text-purple-800 hover:text-red-500 transition-all"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Mobile card list (replaces the wide table on small screens — no horizontal scroll) */}
                <div className="lg:hidden p-3 space-y-2">
                    {loading ? (
                        [...Array(5)].map((_, i) => <div key={i} className="h-20 bg-purple-50/40 rounded-xl animate-pulse" />)
                    ) : filteredData.length === 0 ? (
                        <div className="py-12 text-center text-purple-600 font-bold uppercase tracking-[0.3em] text-[10px] opacity-60">No Records Found</div>
                    ) : (
                        pagedData.map((item) => {
                            const first = columns[0]
                            const firstVal = first ? first.key.split('.').reduce((obj, key) => obj?.[key], item) : undefined
                            const firstDisplay = typeof firstVal === 'object' ? JSON.stringify(firstVal) : firstVal
                            return (
                                <div key={item.id} className="bg-white border border-purple-100 rounded-xl p-3">
                                    <div className="flex items-center justify-between gap-2 mb-2">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <div className="w-8 h-8 rounded-lg bg-purple-50 border border-purple-100 flex items-center justify-center text-primary shrink-0">
                                                <Icon size={15} />
                                            </div>
                                            <span className="font-black text-sm text-black uppercase tracking-tight truncate">
                                                {first?.render ? first.render(firstVal, item) : (firstDisplay ?? 'N/A')}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1.5 shrink-0">
                                            {renderActions && renderActions(item)}
                                            <button onClick={() => handleEdit(item)} className="w-8 h-8 rounded-lg bg-purple-50/50 border border-purple-100 flex items-center justify-center text-purple-800 hover:text-primary transition-all">
                                                <Edit size={13} />
                                            </button>
                                            <button onClick={() => handleDelete(item.id)} className="w-8 h-8 rounded-lg bg-purple-50/50 border border-purple-100 flex items-center justify-center text-purple-800 hover:text-red-500 transition-all">
                                                <Trash2 size={13} />
                                            </button>
                                        </div>
                                    </div>
                                    {columns.length > 1 && (
                                        <div className="grid grid-cols-2 gap-x-3 gap-y-1 pl-10">
                                            {columns.slice(1).map((col, i) => {
                                                const v = col.key.split('.').reduce((obj, key) => obj?.[key], item)
                                                const dv = typeof v === 'object' ? JSON.stringify(v) : v
                                                return (
                                                    <div key={i} className="flex items-center justify-between gap-2 text-[11px] min-w-0">
                                                        <span className="text-purple-400 font-bold uppercase tracking-tight truncate">{col.label}</span>
                                                        <span className="text-black font-bold truncate">{col.render ? col.render(v, item) : (dv ?? '-')}</span>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    )}
                                </div>
                            )
                        })
                    )}
                </div>

                {!loading && pagedData.length > 0 && (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-4 border-t border-purple-100 bg-purple-50/30">
                        <div className="text-[10px] font-black uppercase tracking-widest text-purple-600">
                            Showing {(safePage - 1) * pageSize + 1}–{(safePage - 1) * pageSize + pagedData.length} of {effectiveTotal}
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={safePage === 1}
                                className={cn(
                                    "w-9 h-9 rounded-xl border flex items-center justify-center transition-colors",
                                    safePage === 1 ? "border-purple-100 text-purple-300" : "border-purple-200 text-purple-700 hover:bg-purple-50"
                                )}
                            >
                                <ChevronLeft size={16} />
                            </button>
                            <div className="text-[10px] font-black uppercase tracking-widest text-purple-700">
                                {safePage} / {totalPages}
                            </div>
                            <button
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={safePage === totalPages}
                                className={cn(
                                    "w-9 h-9 rounded-xl border flex items-center justify-center transition-colors",
                                    safePage === totalPages ? "border-purple-100 text-purple-300" : "border-purple-200 text-purple-700 hover:bg-purple-50"
                                )}
                            >
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Dynamic Form Modal */}
            {showModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 backdrop-blur-md bg-primary/20">
                    <div className="rounded-2xl p-8 w-full max-w-lg border border-purple-100 bg-white shadow-2xl">
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <h3 className="text-xl font-black text-black mb-1 font-outfit tracking-tight uppercase">
                                    {editingId ? 'Edit Record' : `New ${resourceName.slice(0, -1)}`}
                                </h3>
                                <p className="text-purple-500 text-sm">Fill in the details below.</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowModal(false)}
                                className="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center text-purple-600 hover:text-red-500 transition-colors relative z-50"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-5 relative z-10 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
                            {fields.map((field) => (
                                <div key={field.key} className="space-y-1.5">
                                    <label className="text-[10px] font-black text-purple-900 uppercase tracking-widest ml-1">{field.label}</label>
                                    {field.type === 'textarea' ? (
                                        <textarea
                                            value={formData[field.key] ?? ''}
                                            onChange={e => setFormData({ ...formData, [field.key]: e.target.value })}
                                            className="input-field w-full font-semibold min-h-[100px] py-3"
                                            required={field.required}
                                        />
                                    ) : field.type === 'select' ? (
                                        <select
                                            value={formData[field.key] ?? ''}
                                            onChange={e => setFormData({ ...formData, [field.key]: e.target.value })}
                                            className="input-field w-full font-semibold cursor-pointer"
                                            required={field.required}
                                        >
                                            <option value="">Select Option</option>
                                            {field.options?.map(opt => (
                                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                                            ))}
                                        </select>
                                    ) : field.type === 'checkbox' ? (
                                        <div className="flex items-center gap-3 py-2">
                                            <input
                                                type="checkbox"
                                                checked={!!formData[field.key]}
                                                onChange={e => setFormData({ ...formData, [field.key]: e.target.checked })}
                                                className="w-5 h-5 rounded border-purple-100 text-primary focus:ring-primary/20 accent-primary"
                                            />
                                            <span className="text-xs font-semibold text-purple-700">Enable / Confirm selection</span>
                                        </div>
                                    ) : (
                                        <input
                                            type={field.type}
                                            value={formData[field.key] ?? ''}
                                            onChange={e => setFormData({ ...formData, [field.key]: e.target.value })}
                                            className="input-field w-full font-semibold"
                                            required={field.required}
                                        />
                                    )}
                                </div>
                            ))}

                            <div className="flex gap-4 pt-6">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="flex-1 py-4 rounded-2xl bg-purple-50 border border-purple-100 text-purple-800 font-bold hover:bg-purple-100 transition-colors uppercase tracking-widest text-xs"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="flex-1 py-4 rounded-2xl bg-primary text-white font-black shadow-lg shadow-primary/20 hover:bg-opacity-90 transition-all uppercase tracking-widest text-xs flex items-center justify-center gap-2 group"
                                >
                                    {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle2 size={18} className="group-hover:rotate-12 transition-transform" />}
                                    {isSubmitting ? 'Processing...' : editingId ? 'Update Record' : 'Create Entry'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
