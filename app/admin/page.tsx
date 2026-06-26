'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import Link from 'next/link'
import {
    Users,
    Package,
    DollarSign,
    ArrowUpRight,
    ArrowDownRight,
    Activity,
    ShoppingBag,
    AlertTriangle
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { API_URL } from '@/lib/api-config'
import { SalesLineChart } from '@/components/SalesLineChart'
import { ExportReportModal } from '@/components/ExportReportModal'

interface DashboardStats {
    totalProducts: number
    totalCategories: number
    totalSales: number
    lowStockProducts: number
    todaySales: number
    totalRevenue: number
    recentSales: any[]
    chartData: { label: string; value: number }[]
    trends: {
        revenue: number
        sales: number
        today: number
        products: number
    }
}

type ChartPeriod = 'today' | 'weekly' | 'monthly' | 'overall'

export default function DashboardPage() {
    const [data, setData] = useState<DashboardStats | null>(null)
    const [loading, setLoading] = useState(true)
    const [period, setPeriod] = useState<ChartPeriod>('weekly')
    const [chart, setChart] = useState<{ label: string; value: number }[]>([])
    const [chartLoading, setChartLoading] = useState(true)
    const [showExport, setShowExport] = useState(false)

    const apiUrl = API_URL

    const fetchDashboardData = useCallback(async () => {
        if (!apiUrl) throw new Error('API URL not defined')
        const token = localStorage.getItem('token')
        if (!token) {
            setLoading(false)
            return
        }

        try {
            const res = await fetch(`${apiUrl}/admin/stats`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                cache: 'no-store'
            })

            const text = await res.text()

            let result = null;
            try {
                result = JSON.parse(text)
            } catch (jsonErr) {
                console.error('Failed to parse stats JSON. Response text:', text)
                console.error('JSON Error:', jsonErr)
            }

            if (!res.ok || !result) {
                if (res.status !== 401 && res.status !== 403) {
                    console.error('Stats request failed', {
                        status: res.status,
                        error: result?.error,
                        userRole: result?.role,
                        requiredRoles: result?.required,
                        fullResponse: result
                    })
                }

                setLoading(false)
                return
            }

            setData(result)
            setLoading(false)
        } catch (err) {
            console.error('Dashboard fetch error:', err)
            setLoading(false)
        }
    }, [apiUrl])

    useEffect(() => {
        fetchDashboardData()
    }, [fetchDashboardData])

    // Sales chart: fetched per selected period (today / weekly / monthly / overall).
    const fetchChart = useCallback(async (p: ChartPeriod) => {
        if (!apiUrl) return
        const token = localStorage.getItem('token')
        if (!token) return
        try {
            setChartLoading(true)
            const res = await fetch(`${apiUrl}/admin/sales-chart?period=${p}`, {
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                credentials: 'include',
                cache: 'no-store'
            })
            if (res.ok) {
                const j = await res.json()
                setChart(Array.isArray(j?.chartData) ? j.chartData : [])
            }
        } catch (err) {
            console.error('Chart fetch error:', err)
        } finally {
            setChartLoading(false)
        }
    }, [apiUrl])

    useEffect(() => {
        fetchChart(period)
    }, [period, fetchChart])

    const chartData = useMemo(
        () => chart.map(item => ({ label: String(item.label ?? ''), value: Number(item.value ?? 0) })),
        [chart]
    )


    const stats = [
        {
            label: 'Total Revenue',
            value: data ? `$${(data.totalRevenue ?? 0).toLocaleString()}` : '$0.00',
            trend: data?.trends ? `${data.trends.revenue > 0 ? '+' : ''}${data.trends.revenue}%` : '0%',
            trendUp: data?.trends ? data.trends.revenue >= 0 : true,
            icon: DollarSign,
            color: 'primary'
        },
        {
            label: 'Total Orders',
            value: data ? (data.totalSales ?? 0).toString() : '0',
            trend: data?.trends ? `${data.trends.sales > 0 ? '+' : ''}${data.trends.sales}%` : '0%',
            trendUp: data?.trends ? data.trends.sales >= 0 : true,
            icon: ShoppingBag,
            color: 'accent'
        },
        {
            label: 'Total Products',
            value: data ? (data.totalProducts ?? 0).toString() : '0',
            trend: '0%',
            trendUp: true,
            icon: Package,
            color: 'purple'
        },
        {
            label: 'Sales Today',
            value: data ? (data.todaySales ?? 0).toString() : '0',
            trend: data?.trends ? `${data.trends.today > 0 ? '+' : ''}${data.trends.today}%` : '0%',
            trendUp: data?.trends ? data.trends.today >= 0 : true,
            icon: Activity,
            color: 'indigo'
        },
    ]

    return (
        <div className="space-y-4">
            {/* Welcome Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="animate-entry">
                    <h2 className="text-2xl font-black text-black font-outfit uppercase tracking-tight">Dashboard</h2>
                    <p className="text-purple-500 mt-1 text-sm font-semibold">Real-time performance metrics and business analytics.</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setShowExport(true)}
                        className="px-5 py-2.5 rounded-xl bg-white border border-purple-100 text-purple-700 font-black uppercase text-[10px] tracking-widest shadow-sm hover:bg-purple-50 transition-all"
                    >
                        Export Report
                    </button>
                    <Link href="/" className="premium-button flex items-center gap-2 uppercase text-[10px] tracking-widest font-black shadow-lg shadow-primary/20">
                        <ShoppingBag size={14} />
                        Launch POS
                    </Link>
                </div>
            </div>
            {/* Low Stock Alert */}
            {data && data.lowStockProducts > 0 && (
                <div className="bg-red-50 border border-red-100 rounded-2xl p-4 flex items-center justify-between animate-entry">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-red-500/10 text-red-600 flex items-center justify-center">
                            <AlertTriangle size={20} />
                        </div>
                        <div>
                            <h4 className="text-sm font-black text-red-600 uppercase tracking-tight">Inventory Alert</h4>
                            <p className="text-xs text-red-600 font-bold uppercase tracking-widest">{data.lowStockProducts} products are currently below safety stock levels.</p>
                        </div>
                    </div>
                    <Link href="/admin/products?filter=low_stock" className="px-5 py-2.5 bg-red-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-700 transition-all shadow-sm">
                        View Low Stock
                    </Link>
                </div>
            )}

            {/* Stats Grid */}
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 lg:gap-4">
                {stats.map((stat, i) => (
                    <div key={i} className="bg-white rounded-2xl p-4 lg:p-5 border border-purple-100 shadow-sm hover:shadow-md hover:border-primary/30 transition-all">
                        <div className="flex items-start justify-between mb-3 lg:mb-5">
                            <div className={cn(
                                "w-11 h-11 rounded-xl flex items-center justify-center",
                                stat.color === 'primary' ? "bg-primary/10 text-primary" :
                                    stat.color === 'accent' ? "bg-accent/10 text-accent" :
                                        stat.color === 'purple' ? "bg-purple-500/10 text-purple-600" :
                                            "bg-indigo-500/10 text-indigo-600"
                            )}>
                                <stat.icon size={22} />
                            </div>
                            <div className={cn(
                                "flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-tight",
                                stat.trendUp ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"
                            )}>
                                {stat.trendUp ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                                {stat.trend}
                            </div>
                        </div>
                        <p className="text-purple-500 text-[10px] font-black uppercase tracking-[0.15em] leading-none mb-1.5">{stat.label}</p>
                        <h3 className="text-xl lg:text-2xl font-black text-black font-outfit tracking-tight">{stat.value}</h3>
                    </div>
                ))}
            </div>

            {/* Main Analytics Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 pb-8">
                <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-purple-100 shadow-sm">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h3 className="text-lg font-black text-black font-outfit uppercase tracking-tight">Revenue Trajectory</h3>
                            <p className="text-purple-500 text-xs font-semibold">Sales over the selected period</p>
                        </div>
                        <select
                            value={period}
                            onChange={(e) => setPeriod(e.target.value as ChartPeriod)}
                            className="bg-purple-50/50 border border-purple-100 rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest text-purple-700 outline-none cursor-pointer hover:bg-purple-100 transition-colors"
                        >
                            <option value="today">Today</option>
                            <option value="weekly">Weekly (7 Days)</option>
                            <option value="monthly">Monthly (30 Days)</option>
                            <option value="overall">Overall</option>
                        </select>
                    </div>

                    <div className="h-[300px]">
                        {chartLoading ? (
                            <div className="w-full h-full flex items-center justify-center text-purple-400 font-black uppercase tracking-[0.3em] text-[10px] opacity-60 animate-pulse">
                                Loading…
                            </div>
                        ) : (
                            <SalesLineChart data={chartData} />
                        )}
                    </div>
                </div>

                <div className="bg-white rounded-2xl p-6 border border-purple-100 shadow-sm">
                    <h3 className="text-lg font-black text-black font-outfit mb-5 uppercase tracking-tight">Recent Sales</h3>
                    <div className="space-y-4">
                        {loading ? (
                            <div className="space-y-4">
                                {[...Array(5)].map((_, i) => (
                                    <div key={i} className="h-12 w-full bg-purple-50/50 rounded-xl animate-pulse" />
                                ))}
                            </div>
                        ) : data?.recentSales && data.recentSales.length > 0 ? (
                            data.recentSales.map((sale, i) => (
                                <div key={i} className="flex items-center justify-between group cursor-pointer border-l-2 border-l-transparent hover:border-l-primary pl-2 transition-all">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-purple-50/50 border border-purple-100 flex items-center justify-center text-[10px] font-black text-primary shadow-sm">
                                            #{sale.id}
                                        </div>
                                        <div>
                                            <p className="text-sm font-black text-primary uppercase tracking-tight">
                                                Order #{sale.id}
                                            </p>
                                            <p className="text-[10px] text-purple-600 font-black uppercase tracking-widest">
                                                {sale.created_at ? new Date(sale.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A'}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-black text-primary font-outfit tracking-tighter">${parseFloat(sale.total).toFixed(2)}</p>
                                        <p className="text-[9px] text-green-600 font-black uppercase tracking-widest opacity-80">Settled</p>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="py-20 text-center text-purple-600 font-black uppercase tracking-[0.3em] text-[10px] opacity-60">
                                No Recent Sales
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {showExport && <ExportReportModal onClose={() => setShowExport(false)} />}
        </div>
    )
}
