'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Image from 'next/image'
import {
    BarChart3,
    Package,
    Tag,
    Users,
    ShoppingBag,
    LogOut,
    ChevronRight,
    Users2,
    Handshake,
    TicketPercent,
    History,
    RotateCcw,
    Activity
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useEffect, useState } from 'react'
import { animate } from 'animejs'

const menuItems = [
    { href: '/admin', icon: BarChart3, label: 'Dashboard' },
    { href: '/admin/products', icon: Package, label: 'Products' },
    { href: '/admin/categories', icon: Tag, label: 'Categories' },
    { href: '/admin/sales', icon: History, label: 'Sales History' },
    { href: '/admin/refunds', icon: RotateCcw, label: 'Reversal Logs' },
    { href: '/admin/purchase-orders', icon: ShoppingBag, label: 'Purchase Orders' },
    { href: '/admin/suppliers', icon: Handshake, label: 'Suppliers' },
    { href: '/admin/promotions', icon: TicketPercent, label: 'Promotions' },
    { href: '/admin/customers', icon: Users2, label: 'Customers' },
    { href: '/admin/users', icon: Users, label: 'Team Members' },
    { href: '/admin/audit-logs', icon: Activity, label: 'Audit Trail', ownerOnly: true },
]

export default function Sidebar({ mobileOpen = false, onClose }: { mobileOpen?: boolean; onClose?: () => void }) {
    const pathname = usePathname()
    const [userRole, setUserRole] = useState<string | null>(null)

    useEffect(() => {
        try {
            const user = JSON.parse(localStorage.getItem('user') || '{}')
            setUserRole(user.role || null)
        } catch (e) {
            setUserRole(null)
        }

        animate('.sidebar-item', {
            translateX: [-20, 0],
            opacity: [0, 1],
            delay: (el: any, i: number) => i * 50,
            ease: 'outExpo',
            duration: 800
        })
    }, [])

    const handleLogout = () => {
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        window.location.href = '/admin/login'
    }

    const filteredItems = menuItems.filter(item => {
        if (item.ownerOnly && userRole !== 'OWNER') return false
        return true
    })

    return (
        <aside className={cn(
            "w-80 max-w-[82vw] h-screen bg-[#09090B] border-r border-white/5 rounded-r-[40px] flex flex-col p-6 overflow-y-auto shadow-2xl",
            "fixed inset-y-0 left-0 z-50 transition-transform duration-300 lg:sticky lg:top-0 lg:z-auto lg:translate-x-0",
            mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}>
            <div className="flex items-center gap-4 px-2 mb-10">
                <div className="h-10 relative flex items-center justify-center bg-primary rounded-xl border border-white/10 px-3 transition-all shadow-lg shadow-primary/20">
                    <Image
                        src="/logo.avif"
                        alt="Spirited Logo"
                        width={120}
                        height={40}
                        className="h-full w-auto object-contain filter drop-shadow-[0_0_8px_rgba(255,255,255,0.1)]"
                    />
                </div>
                <div className="flex flex-col">
                    <h2 className="text-xl font-black font-outfit text-white tracking-widest leading-tight uppercase">Spirited</h2>
                    <span className="text-[9px] text-purple-400 font-black uppercase tracking-[0.2em] opacity-80">Control Center</span>
                </div>
            </div>

            <nav className="flex-1 space-y-1.5">
                {filteredItems.map((item) => {
                    const isActive = pathname === item.href
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            onClick={onClose}
                            className={cn(
                                "sidebar-item flex items-center justify-between group px-4 py-3.5 rounded-2xl transition-all duration-300",
                                isActive
                                    ? "bg-primary text-white shadow-lg shadow-primary/20"
                                    : "text-purple-300/60 hover:text-white hover:bg-white/5 border border-transparent"
                            )}
                        >
                            <div className="flex items-center gap-3">
                                <item.icon size={20} className={cn("transition-transform duration-300", isActive ? "scale-110 opacity-100" : "opacity-40 group-hover:scale-110 group-hover:opacity-100")} />
                                <span className="font-semibold">{item.label}</span>
                            </div>
                            <ChevronRight size={14} className={cn("transition-transform duration-300", isActive ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0")} />
                        </Link>
                    )
                })}
            </nav>

            <div className="mt-auto pt-6 border-t border-white/5">
                <button
                    onClick={handleLogout}
                    className="sidebar-item w-full flex items-center gap-3 px-4 py-4 rounded-2xl text-purple-300/40 hover:text-red-400 hover:bg-red-400/5 transition-all duration-300 group"
                >
                    <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center group-hover:bg-red-400/10 transition-colors border border-white/5">
                        <LogOut size={18} />
                    </div>
                    <span className="font-semibold">Sign Out</span>
                </button>
            </div>
        </aside>
    )
}
