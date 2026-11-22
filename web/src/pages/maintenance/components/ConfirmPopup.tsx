type ConfirmationPopupProps = {
    deskId: number;
    onCancel: () => void;
    onConfirm: () => void;
};

export function ConfirmPopup({ deskId, onCancel, onConfirm }: ConfirmationPopupProps) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-sm rounded-[10px] bg-white p-5 shadow-lg sm:p-6">

                <h2 className="text-[16px] font-semibold text-neutral-900">
                    Power off Desk {deskId}?
                </h2>

                <p className="mt-3 text-[12px] leading-relaxed text-neutral-500">
                    The desk stops responding to all controls, presets and routines
                    until maintenance turns it back on. Matous will be notified.
                </p>

                <div className="mt-4 flex justify-end gap-2">
                    <button
                        onClick={onCancel}
                        className="rounded-md border border-neutral-200 px-4 py-2 text-[12px] text-neutral-900 hover:bg-neutral-100"
                    >
                        Cancel
                    </button>

                    <button
                        onClick={onConfirm}
                        className="rounded-md bg-neutral-800 px-4 py-2 text-[12px] text-white hover:bg-neutral-700"
                    >
                        Power off
                    </button>
                </div>
            </div>
        </div>
    );
}