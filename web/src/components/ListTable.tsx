type ListTableProps<T extends object> = {
    listItems: T[]
    tableHeaders: string[]

}

export function ListTable<T extends object>({listItems, tableHeaders}: ListTableProps<T>)  {

    return (
        <>
            <table
                className="w-full mt-3.5 table-fixed border-separate border-spacing-y-7 text-left font-sans text-[20px] px-2.5">

                <thead className="bg-neutral-100">
                <tr className="text-[18px] font-medium ">
                    {tableHeaders.map((tableHeader) => (
                        <th className=" top-0 z-20 h-[54px] rounded-l-[10px] px-[18px] font-medium max-md:left-0">
                            {tableHeader.toString()}
                        </th>
                    ))}
                    <th className="sticky top-0 z-10 rounded-r-[10px]  px-[18px]">
                    </th>

                </tr>
                </thead>
                <tbody>

                {listItems.map((item: T, rowindex: number) => (
                <tr key={rowindex} >
                    {Object.entries(item).map(([propertyName, value]) => (
                        <td key={propertyName} className="border-b max-md:sticky max-md:left-0 max-md:z-10">
                            {String(value ?? "-")}
                        </td>
                    ))}
                    <td className="border-b ">
                        <button type="button"
                                className="inline-flex h-[60px] w-[123px] items-center justify-center gap-2 rounded-[9px]  font-medium transition-colors hover:bg-[#d6d6d6] hover:text-[#1A1A1A]">
                            View <span aria-hidden="true">→</span>
                        </button>
                    </td>
                </tr>
                ))}

                </tbody>
            </table>
        </>
    )
}