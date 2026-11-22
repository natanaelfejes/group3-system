import { PageHeader } from '../../components/PageHeader.tsx'
import {useEffect, useState} from "react";
import {StatusTile} from "../../components/StatusTile.tsx";
import {Section} from "../../components/Section.tsx";
import {ListTable} from "../../components/ListTable.tsx";
import Desk from "../../../Model/Desk.ts"

// This is the Desks page maintenance sees
export function MaintenanceDesksPage() {


    //=== Just for testing purposes of the UI. Remove later =====
    const [allDesksCategories, setAllDesksCategories] = useState<Map<string, number>>(new Map<string, number>());
    const [allDesks, setAllDesks] = useState<Desk[]>(new Array<Desk>());

    useEffect(() => {
        const desks: Desk[] = [
            new Desk("a3f9c2d1-7b45-4e8a-9c12-5d6f0a2b8e31", "Desk 1", "John Smith", "Ok", "", 42),
            new Desk("b7e2a4f9-1c83-4d6b-8a55-2f9e0c7d3b14", "Desk 2", "Emma Johnson", "Ok", "", 36),
            new Desk("c9d1e5a7-3f62-4b8c-9d21-6a4e2f0b7c83", "Desk 3", "Michael Brown", "Error", "Motor controller communication failure", 12),
            new Desk("d2a8f4c6-9b15-4e7d-8c32-1f5a9b0e6d74", "Desk 4", "Olivia Williams", "Disconnected", "Connection to desk controller lost", 0),
            new Desk("e5c3b9a1-6d47-4f2e-9a83-7b0c1d5e4f26", "Desk 5", "James Davis", "Ok", "", 58),
            new Desk("f1b7d3e9-2a65-4c8f-8e14-9d6b0a3c5f72", "Desk 6", "Sophia Miller", "Needs Attention", "Desk height calibration required", 23),
            new Desk("a8e4c2b6-5f91-4d7a-9b36-2c0e5f8a1d43", "Desk 7", "William Wilson", "Ok", "", 47),
            new Desk("b3f6a9d2-8c14-4e5b-8d72-0a7f1c9e4b65", "Desk 8", "Isabella Moore", "Error", "Height sensor returned invalid value", 8),
            new Desk("c6d2f8a4-1e75-4b9c-9f23-5a0d7e1b6c84", "Desk 9", "Benjamin Taylor", "Ok", "", 31),
            new Desk("d9a5e1c7-4b82-4f6d-8a13-7c2e0b9f5d64", "Desk 10", "Mia Anderson", "Disconnected", "Device heartbeat timeout", 15),
            new Desk("e2b8d4f6-7a31-4c9e-9d52-3f0b6a1c8e75", "Desk 11", "Lucas Thomas", "Ok", "", 64),
            new Desk("f5c1a7e3-9d46-4b2f-8c81-6e0a3d7b5f92", "Desk 12", "Charlotte Jackson", "Needs Attention", "Unusual motor resistance detected", 19),
            new Desk("a1d7b3f9-6c24-4e8a-9f35-2b0d5c7e1a64", "Desk 13", "Henry White", "Ok", "", 53),
            new Desk("b4e9c5a2-3f81-4d7b-8e62-9a0c1f6d5b73", "Desk 14", "Amelia Harris", "Error", "Desk movement blocked by obstacle", 6),
            new Desk("c7a2f6d8-5b13-4e9c-9a47-1d0f3b8e6c25", "Desk 15", "Alexander Martin", "Ok", "", 39),
            new Desk("d1f8b4e6-2c95-4a7d-8f31-5e0b9c2a6d74", "Desk 16", "Harper Thompson", "Needs Attention", "Firmware update recommended", 27),
            new Desk("e4c9a1f7-8d32-4b6e-9c15-3a0f7d2b5e86", "Desk 17", "Daniel Garcia", "Ok", "", 71),
            new Desk("f7b3d5a9-1e64-4c8f-8a72-6d0b2e9c5f13", "Desk 18", "Evelyn Martinez", "Disconnected", "Network connection unavailable", 4),
            new Desk("a2e6c8f4-7b19-4d5a-9e83-0c3f6b1d8a52", "Desk 19", "Matthew Robinson", "Ok", "", 45),
            new Desk("b5d9f1a3-4c72-4e6b-8d25-7f0a2c9e1b64", "Desk 20", "Abigail Clark", "Error", "Motor overload protection triggered", 11),
        ];

        const deskCounts = new Map<string, number>();

        if(!deskCounts.get("All")) {
            deskCounts.set("All", desks.length)
        }

        desks.forEach((desk: Desk) => {
            const currentCount = deskCounts.get(desk.Status) ?? 0;
            deskCounts.set(desk.Status, currentCount + 1);
        });


        setAllDesksCategories(deskCounts);
        setAllDesks(desks);
    }, []);

    //===============


  return (
    <>
        <div className="hidden md:block">
            <PageHeader title="Desks" description="Desk errors and which desks need maintenance." />
        </div>
        <div className="h-full flex-col justify-between">
            <div className="grid grid-cols-1 gap-4 md:col-span-2 md:grid-cols-[repeat(var(--columns),minmax(0,1fr))]"
                 style={{
                     "--columns": allDesksCategories.size
                 } as React.CSSProperties}>
                {Array.from(allDesksCategories.entries()).map(([status, count]) => (
                    <StatusTile label={status} value={count.toString()} />
                ))}
            </div>

            <Section title="DeskList" className=" md:col-span-2 md:block md:mt-5.5" action={<input id="sit_minutes" name="sit_minutes" type="text" className="input" placeholder="Search desk" />}>
                <ListTable<Desk> listItems={allDesks} tableHeaders={allDesks.length != 0 ? Object.keys(allDesks[0]): []}
                                 actionElement={<button onClick={() => console.log("Button trigger")} type="button" className="inline-flex h-[60px] w-[123px] items-center justify-center gap-2 rounded-[9px]  font-medium transition-colors hover:bg-[#d6d6d6] hover:text-[#1A1A1A]">
                    View <span aria-hidden="true">→</span>
                    </button>}
                />
            </Section>
        </div>
    </>
  )
}
