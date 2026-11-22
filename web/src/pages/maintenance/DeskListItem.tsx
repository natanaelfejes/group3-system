import type {ReactNode} from "react";

type DeskListItemProps<T extends object> = {
    item: T;
    rowIndex: number;
    action?: ReactNode
}
export function DeskListItem<T extends object>({item, rowIndex, action}: DeskListItemProps<T>) {
    return(
        <tr key={rowIndex} >
            {Object.entries(item).map(([propertyName, value]) => (
                <td key={propertyName} className="border-b max-md:sticky max-md:left-0 max-md:z-10">
                    {String(value ?? "-")}
                </td>
            ))}
            <td className="border-b ">
                {action}
            </td>
        </tr>
    );
}