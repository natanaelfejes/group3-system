type DeskStateTagProps = {
    deskState: string;
};

export default function DeskStateTag({ deskState }: DeskStateTagProps) {

    const stateStyles: Record<string, { tag: string; dot: string }> = {
        "Error": {
            tag: "bg-[#292929] text-white border border-[#292929]",
            dot: "bg-white"
        },
        "Needs attention": {
            tag: "bg-white text-[#292929] border border-[#292929]",
            dot: "bg-[#292929]"
        },
        "Offline": {
            tag: "bg-white text-[#666666] border border-dashed border-[#D3D3D3]",
            dot: "bg-[#E5E5E5]"
        },
        "Ok": {
            tag: "bg-[#E7E7E7] text-[#292929] border border-transparent",
            dot: "bg-[#292929]"
        }
    };

    // Determine styling based on deskState
    const styling = stateStyles[deskState] ?? stateStyles["Offline"];

    return (
        <div className={`
            inline-flex items-center gap-2
            rounded-full px-3 py-1
            text-sm font-medium
            ${styling.tag}
        `}>
            <span className={`h-2 w-2 shrink-0 rounded-full ${styling.dot}`} />
            <p>{deskState}</p>
        </div>
    );
}
