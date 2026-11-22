import {PageHeader} from "../../components/PageHeader.tsx";
import {Section} from "../../components/Section.tsx";
import {useEffect, useState} from "react";
import DeskStateTag from "./DeskStateTag.tsx";
import {ListTable} from "../../components/ListTable.tsx";
import Desk from "../../../Model/Desk.ts";
import Error from "../../../Model/Error.ts"
export function MaintenanceDeskPage() {

    /// ======= JUST FOR UI TESTING, CAN BE REMOVED
    const [deskProps, setDeskProps] = useState<Map<string, string>>(new Map<string, string>());
    const [deskErrors, setDeskErrors] = useState<Array<Error>>(new Array<Error>());

    useEffect(() => {

        const errors: Array<Error> =  [
            new Error("2026-11-22", "E-01", "Lost Connection to Controller", "Open"),
            new Error("2026-11-21", "E-02", "Broken Motor", "Open"),
            new Error("2026-11-20", "E-03", "Temperature Sensor Failure", "Fixed"),
            new Error("2026-11-19", "E-04", "Power Supply Interruption", "Fixed"),
            new Error("2026-11-18", "E-05", "Hydraulic Pressure Too Low", "Open"),
            new Error("2026-11-17", "E-06", "Emergency Stop Activated", "Fixed"),
            new Error("2026-11-16", "E-07", "Communication Timeout", "Open"),
            new Error("2026-11-15", "E-08", "Motor Overheating Detected", "Fixed"),
            new Error("2026-11-14", "E-09", "Position Sensor Malfunction", "Open"),
            new Error("2026-11-13", "E-10", "Controller Firmware Error", "Fixed"),
            new Error("2026-11-12", "E-11", "Cooling System Failure", "Open"),
            new Error("2026-11-11", "E-12", "Unexpected System Shutdown", "Fixed")
        ];

        const deskPropsMap = new Map<string, string>([
            ["Model", "Linak Simulator"],
            ["Current Height", "88 cm"],
            ["Total Activations", "4,210"],
            ["Last Seen", "Today"],
        ]);

        setDeskProps(deskPropsMap);
        setDeskErrors(errors);
    },[])
    /// ============

    return (
        <>
            <PageHeader title={"Desk 67"} description={"Assigned to Matous floor 2"}>
                <div className="flex justify-between align-center w-1/3 md:w-1/5" >
                    <DeskStateTag deskState="Error" />
                    <button type="button" className="btn flex-1 md:flex-none">Mark as fixed</button>
                    <button type="button" className="btn flex-1 md:flex-none">Power Off</button>
                </div>
            </PageHeader>
            <div className="w-full flex-col  justify-between" >
                <div className="card py-3.5 px-2 md:w-full w-full" >
                    <p> Likely needs maintenance</p>
                </div>
                <div className="grid gap-4 md:grid-cols-2 md:mt-3.5" >
                    <Section title={"Desk Info"} className="order-1 md:order-none" >
                       <div className="flex flex-col" >
                           {Array.from(deskProps).map(([key, value]) => (
                                   <div className="flex flex-row justify-between align-middle">
                                       <p className="text-s text-neutral-600">{key}</p>
                                       <p>{value}</p>
                                   </div>
                               )
                           )}
                       </div>
                    </Section>
                    <Section title={"Usage - last 14 Days"} className="order-2 md:order-none" >
                        <p> Likely needs maintenance</p>
                    </Section>
                </div>
                <Section title="Error History" className=" md:col-span-2 md:block md:mt-5.5" >
                    <ListTable<Error> listItems={deskErrors} tableHeaders={deskErrors.length != 0 ? Object.keys(deskErrors[0]): []}
                    />
                </Section>
            </div>
        </>
    )
}
