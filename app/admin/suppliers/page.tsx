'use client'

import { useState } from 'react'
import { Handshake, FileText } from 'lucide-react'
import { AdminResourceTemplate } from '@/components/AdminResourceTemplate'
import { SupplierPurchaseOrderModal } from '@/components/SupplierPurchaseOrderModal'

interface SupplierRow {
    id: number
    name: string
    email?: string | null
    [key: string]: any
}

export default function SuppliersPage() {
    const [poSupplier, setPoSupplier] = useState<SupplierRow | null>(null)

    return (
        <>
            <AdminResourceTemplate
                title="Strategic Partners"
                description="Manage your product suppliers and procurement contacts."
                icon={Handshake}
                resourceName="Suppliers"
                apiPath="/admin/suppliers"
                showBulkDelete={true}
                renderActions={(supplier) => (
                    <button
                        type="button"
                        onClick={() => setPoSupplier(supplier as SupplierRow)}
                        title="Create purchase order email"
                        className="px-3 h-9 rounded-xl bg-primary text-white border border-primary text-[9px] font-black uppercase tracking-widest shadow-sm shadow-primary/20 hover:bg-primary/90 transition-all flex items-center gap-1.5"
                    >
                        <FileText size={13} />
                        Create PO
                    </button>
                )}
                columns={[
                    { label: 'Entity Name', key: 'name' },
                    { label: 'Contact Person', key: 'contactName' },
                    { label: 'Email', key: 'email' },
                    { label: 'Phone', key: 'phone' }
                ]}
                fields={[
                    { label: 'Entity Name', key: 'name', type: 'text', required: true },
                    { label: 'Contact Person', key: 'contactName', type: 'text' },
                    { label: 'Email Address', key: 'email', type: 'email' },
                    { label: 'Mobile Number', key: 'phone', type: 'text' },
                    { label: 'Business Address', key: 'address', type: 'textarea' },
                    { label: 'Contractual Terms', key: 'terms', type: 'textarea' }
                ]}
            />

            {poSupplier && (
                <SupplierPurchaseOrderModal supplier={poSupplier} onClose={() => setPoSupplier(null)} />
            )}
        </>
    )
}
