'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Package, AlertTriangle, ArrowLeft } from 'lucide-react'
import { AdminResourceTemplate } from '@/components/AdminResourceTemplate'
import { API_URL } from '@/lib/api-config'

export default function ProductsPage() {
    const [categories, setCategories] = useState<{ label: string, value: string }[]>([])
    const [suppliers, setSuppliers] = useState<{ label: string, value: string }[]>([])
    const apiUrl = API_URL

    useEffect(() => {
        const fetchSuppliers = async () => {
            try {
                if (!apiUrl) return
                const token = localStorage.getItem('token')
                if (!token) return
                const res = await fetch(`${apiUrl}/admin/suppliers`, {
                    method: 'GET',
                    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                    credentials: 'include',
                    cache: 'no-store'
                })
                const data = await res.json()
                if (Array.isArray(data)) {
                    setSuppliers(data.map((s: any) => ({
                        label: s.email ? `${s.name} — ${s.email}` : s.name,
                        value: s.id.toString()
                    })))
                }
            } catch (err) {
                console.error(err)
            }
        }
        fetchSuppliers()
    }, [apiUrl])

    useEffect(() => {
        const fetchCategories = async () => {
            try {
                const cacheKey = 'adminProductsCategories'
                const cacheTimeKey = 'adminProductsCategoriesTimestamp'
                const cached = localStorage.getItem(cacheKey)
                const cachedAt = localStorage.getItem(cacheTimeKey)
                const now = Date.now()
                const cacheTtl = 15 * 60 * 1000

                if (cached && cachedAt && now - parseInt(cachedAt) < cacheTtl) {
                    const parsed = JSON.parse(cached)
                    if (Array.isArray(parsed)) {
                        setCategories(parsed)
                    }
                }

                if (!apiUrl) throw new Error('API URL not defined')
                const token = localStorage.getItem('token')
                if (!token) return

                const res = await fetch(`${apiUrl}/admin/categories`, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    credentials: 'include',
                    cache: 'no-store'
                })
                const data = await res.json()
                if (Array.isArray(data)) {
                    const mapped = data.map((c: any) => ({ label: c.name, value: c.id.toString() }))
                    setCategories(mapped)
                    try {
                        localStorage.setItem(cacheKey, JSON.stringify(mapped))
                        localStorage.setItem(cacheTimeKey, now.toString())
                    } catch (e) {
                        console.warn('LocalStorage quota exceeded for categories cache.')
                    }
                }
            } catch (err) {
                console.error(err)
            }
        }
        fetchCategories()
    }, [apiUrl])

    return (
        <Suspense fallback={<div className="p-8 text-center text-purple-600 font-black uppercase tracking-widest animate-pulse">Initializing Assets...</div>}>
            <ProductsContent categories={categories} suppliers={suppliers} />
        </Suspense>
    )
}

function ProductsContent({ categories, suppliers }: { categories: { label: string, value: string }[], suppliers: { label: string, value: string }[] }) {
    const searchParams = useSearchParams()
    const filter = searchParams.get('filter')

    return (
        <AdminResourceTemplate
            title={filter === 'low_stock' ? "Low Stock Alerts" : "Asset Portfolio"}
            description={filter === 'low_stock' ? "Critical inventory levels requiring immediate attention." : "Manage your high-end inventory and product catalog."}
            icon={Package}
            resourceName="Products"
            apiPath="/admin/products"
            csvPath="/csv/products"
            showBulkDelete={true}
            serverPaginated={true}
            serverParams={filter === 'low_stock' ? { low_stock: '1' } : undefined}
            headerActions={
                filter === 'low_stock' ? (
                    <Link
                        href="/admin/products"
                        className="px-5 py-3 rounded-2xl bg-white border border-purple-100 text-purple-700 font-black uppercase text-[10px] tracking-widest shadow-sm hover:bg-purple-50 transition-all flex items-center gap-2"
                    >
                        <ArrowLeft size={16} />
                        Back to All Assets
                    </Link>
                ) : (
                    <Link
                        href="/admin/products?filter=low_stock"
                        className="px-5 py-3 rounded-2xl bg-red-50 border border-red-100 text-red-600 font-black uppercase text-[10px] tracking-widest shadow-sm hover:bg-red-100 transition-all flex items-center gap-2"
                    >
                        <AlertTriangle size={16} />
                        View Low Stock
                    </Link>
                )
            }
            columns={[
                { label: 'Item Identity', key: 'name' },
                { label: 'Classification', key: 'category_name' },
                { label: 'Barcode', key: 'barcode' },
                { label: 'Stock Level', key: 'stock' },
                { label: 'Market Price', key: 'price', align: 'right' },
            ]}
            fields={[
                { label: 'Product Title', key: 'name', type: 'text', required: true },
                { label: 'Stock Keeping Unit (SKU)', key: 'sku', type: 'text', required: true },
                { label: 'Universal Barcode', key: 'barcode', type: 'text' },
                { label: 'Brand / Vineyard', key: 'brand', type: 'text' },
                {
                    label: 'Primary Classification',
                    key: 'categoryId',
                    type: 'select',
                    options: categories,
                    required: true
                },
                {
                    label: 'Supplier (for purchase orders)',
                    key: 'supplierId',
                    type: 'select',
                    options: suppliers
                },
                { label: 'Market Price ($)', key: 'price', type: 'number', required: true },
                { label: 'Maximum Retail Price (MRP)', key: 'mrp', type: 'number' },
                { label: 'Inventory Count', key: 'stock', type: 'number', required: true },
                { label: 'Bottle size (e.g. 750ml)', key: 'bottleSize', type: 'text' },
                { label: 'Safety Stock Limit', key: 'lowStockThreshold', type: 'number' },
                { label: 'Age Restricted (Alcohol)', key: 'isAlcohol', type: 'checkbox' }
            ]}
        />
    )
}
