export function StatusTile({ label, value, className = '' }: { label: string; value?: string; className?: string }) {
    const EMPTY = '—'
    return (
        <div className={`card p-4 ${className}`}>
            <p className="text-xs text-neutral-600">{label}</p>
            <p className="mt-1 text-xl font-semibold">{value ?? EMPTY}</p>
        </div>
    )
}