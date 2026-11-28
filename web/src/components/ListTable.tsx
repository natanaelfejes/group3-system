import {DeskListItem} from "../pages/maintenance/DeskListItem.tsx";
import type {ReactNode} from "react";

type ListTableProps<T extends object> = {
    listItems: T[]
    tableHeaders: string[]
    actionElement?: (item: T) => ReactNode;

}

export function ListTable<T extends object>({listItems, tableHeaders, actionElement}: ListTableProps<T>)  {

    return (
        <>
            <div className=" min-h-0 max-h-[370px] overflow-y-auto overflow-x-auto">
            <table
                className="w-full mt-3.5 table-fixed border-separate border-spacing-y-7 text-left font-sans text-[20px] px-2.5 ">

                <thead className="sticky top-0 z-20 bg-neutral-100">
                <tr className="text-[18px] font-medium ">
                    {tableHeaders.map((tableHeader, index) => {
                        if(index == 0) {
                            return (
                                <th key={index} className=" top-0 z-20 h-[54px] rounded-l-[10px] px-[18px] font-medium max-md:left-0">
                                {tableHeader.toString()}
                                </th>
                            )
                        }
                        else {
                            return (
                                <th key={index} className=" top-0 z-20 h-[54px] px-[18px] font-medium max-md:left-0">
                                    {tableHeader.toString()}
                                </th>
                            )
                        }
                    }
                    )
                    }
                    <th className="sticky top-0 z-10 rounded-r-[10px]  px-[18px]">
                    </th>
                </tr>
                </thead>
                <tbody>

                {listItems.map((item: T, rowindex: number) => (
                    <DeskListItem<T> item={item} rowIndex={rowindex} action={actionElement} />
                ))}
                </tbody>
            </table>
            </div>
        </>
    )
}