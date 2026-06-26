'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import { Bell, Search, User, Loader2, Menu } from 'lucide-react'
import { API_URL } from '@/lib/api-config'

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const router = useRouter()
    const pathname = usePathname()
    const [isAuthenticating, setIsAuthenticating] = useState(true)
    const [user, setUser] = useState<{ name: string; role: string } | null>(null)
    const [mobileNavOpen, setMobileNavOpen] = useState(false)

    useEffect(() => {
        const checkAuth = async () => {
            const token = localStorage.getItem('token')
            const apiUrl = API_URL

            if (!token && pathname !== '/admin/login') {
                router.replace('/admin/login')
                return
            }

            if (token && pathname !== '/admin/login') {
                if (!apiUrl) {
                    setIsAuthenticating(false);
                    return;
                }
                try {
                    const res = await fetch(`${apiUrl}/auth/me`, {
                        method: 'GET',
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        },
                        credentials: 'include',
                        cache: 'no-store'
                    })

                    if (res.ok) {
                        const data = await res.json()
                        const role = data.user.role?.toUpperCase()
                        if (role !== 'OWNER' && role !== 'MANAGER') {
                            router.replace('/')
                            return
                        }
                        setUser(data.user)
                        // Sync local storage just in case
                        localStorage.setItem('user', JSON.stringify(data.user))
                    } else {
                        localStorage.removeItem('token')
                        localStorage.removeItem('user')
                        router.replace('/admin/login')
                    }
                } catch (e) {
                    // Silent fail on network errors or auth failures
                } finally {
                    setIsAuthenticating(false)
                }
            } else {
                setIsAuthenticating(false)
            }
        }

        checkAuth()
    }, [pathname, router])

    if (isAuthenticating && pathname !== '/admin/login') {
        return (
            <div className="h-screen w-full flex flex-col items-center justify-center bg-white gap-4">
                <Loader2 className="w-12 h-12 text-primary animate-spin" />
                <p className="text-[10px] font-black uppercase tracking-[0.4em] text-purple-600">Securing Session...</p>
            </div>
        )
    }

    if (pathname === '/admin/login') {
        return <>{children}</>
    }

    // Don't render anything if not an admin (redirection is handled in useEffect)
    if (!user || (user.role?.toUpperCase() !== 'OWNER' && user.role?.toUpperCase() !== 'MANAGER')) {
        return null
    }

    return (
        <div className="flex min-h-screen bg-white">
            <Sidebar mobileOpen={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />
            {/* Mobile drawer backdrop */}
            {mobileNavOpen && (
                <div className="lg:hidden fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={() => setMobileNavOpen(false)} />
            )}
            <div className="flex-1 flex flex-col h-screen overflow-hidden min-w-0">
                {/* Top Header */}
                <header className="h-20 flex items-center justify-between px-4 lg:px-10 border-b border-purple-50 bg-white/80 backdrop-blur-xl sticky top-0 z-20">
                    <div className="flex items-center gap-3 lg:gap-6">
                        <button
                            onClick={() => setMobileNavOpen(true)}
                            className="lg:hidden w-10 h-10 rounded-xl bg-purple-50/50 border border-purple-100 flex items-center justify-center text-purple-700 hover:text-primary"
                            title="Menu"
                        >
                            <Menu size={20} />
                        </button>
                        <h1 className="text-base lg:text-xl font-bold font-outfit text-dark uppercase tracking-tight">System Intelligence</h1>
                        <div className="hidden md:flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-50/50 border border-purple-100 focus-within:border-primary/40 transition-colors group">
                            <Search size={18} className="text-purple-600 group-focus-within:text-primary transition-colors" />
                            <input
                                type="text"
                                placeholder="Search records..."
                                className="bg-transparent border-none outline-none text-sm text-purple-900 placeholder:text-purple-600 w-64 font-semibold"
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <button className="w-10 h-10 rounded-xl bg-purple-50/50 border border-purple-100 flex items-center justify-center text-purple-600 hover:text-primary hover:bg-primary/5 transition-all relative">
                            <Bell size={20} />
                            <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-primary rounded-full border-2 border-white shadow-sm" />
                        </button>
                        <div className="flex items-center gap-3 pl-4 border-l border-purple-100">
                            <div className="text-right hidden sm:block">
                                <p className="text-sm font-bold text-primary leading-none">{user?.name || 'Admin User'}</p>
                                <p className="text-[10px] text-purple-600 font-black uppercase tracking-widest mt-1">{user?.role || 'Operator'}</p>
                            </div>
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary to-accent p-[1.5px]">
                                <div className="w-full h-full rounded-[9px] bg-white flex items-center justify-center overflow-hidden">
                                    <User size={20} className="text-primary" />
                                </div>
                            </div>
                        </div>
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto p-6 bg-[#faf8fc] custom-scrollbar">
                    {children}
                </main>
            </div>
        </div>
    )
}
