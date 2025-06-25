// Table Related

// libs
import { observer } from "mobx-react";
import { RiPoliceCarFill } from "react-icons/ri";

// custom
import { useSearchFilterStore } from "@/stores/rootStore";
import { PoliceSeniority } from "@/types";
import {
	ResponsiveModal,
	ResponsiveModalContent,
	ResponsiveModalTrigger,
} from "@/components/ui/custom/ResponsiveModal";
import { Button } from "@/components/ui/button";

/*
    List of Orgs noted ===================
    (REMOVE double spaces in cell before check, replace with single space)
    (COMPARE on lowercase - org should be saved as lowercase)
    (Check uniques based on " of ", " OF ", or " Of " which isnt preceded by "Behalf", "BEHALF", "behalf")
    (CONVERT matches to Proper version)


    Gang Response Unit
    Bridgetown // Bridgetown Police Station
    West Metropolitan District Office
    Organised Crime Divisional Office
    Organized Crime

    Wheatbelt District Office
    South West District Office
    South East Metropolitan District Office
    South Metropolitan District Office
    Public Sector Investigations
    North West Metropolitan District Office
    South West Detectives Office
    Boyup Brook Police Station
    Armadale // ARMADALE, A/Dale
    Armadale Detectives // ARMADALE DETECTIVES, Arm Dets
    Belmont
    Collie // COLLIE
    Warwick // WARWICK
    Eucla // EUCLA POLICE
    Pemberton // Pemberton Police Station
    Wundowie
    Peel Dets
    Mirrabooka // M/Booka
    Mirrabooka Detectives // Mirrabooka Dets
    Margaret River // MARGARET RIVER
    Kwinana
    Geraldton // GERALDTON POLICE
    Geraldton Detectives // GERALDTON DETECTIVES
    Murdoch
    Murdoch Detectives // Murdoch Dets

    Bunbury Detectives
    Bunbury // BUNBURY POLICE, Bunbury Police
    Dongara
    Albany // Albany Police, ALBANY POLICE
    Albany Detectives // ALBANY DETECTIVES
    Denmark // DENMARK, DENMARK POLICE
    Midland
    Joondalup
    Joondalup DSG
    Joondalup Detectives
    Donnybrook
    Mandurah
    Mandurah IMU
    Mandurah Detectives // Mandurah Dets
    Bayswater // Bayswater Station
    Pingelly
    Northampton
    Rockingham // R'ham, Rockingham Police
    Cockburn


    Rockingham Detectives
    Fremantle // FREMANTLE POLICE
    Fremantle Detectives // FREMANTLE DETECTIVES, Frem Dets, Ftle Dets, FTLE DETS
    Organised Crime Investigations
    Kalgoorlie
    Stirling Detectives
    Dunsborough
    Australind
    Ballajura
    Major Incident Group
    Broome
    Morley
    Busselton // BUSSELTON
    Narrogin // NARROGIN
    Kununurra
    South Hedland // SOUTH HEDLAND
    Leederville
    Perth // Perth City, Perth City P
    Katanning
    Kiara
    Wanneroo
    Collie
    Dwellingup
    Breath Analysis Section
    Midland Dets // Mid Dets
    Midland TIG
    Kalgoorlie Detectives
    Child Abuse Unit
    Nannup
Lockridge
Wembley

City Dets
    CDTSG
    DRU
    Drug
    BAS
    TRG
    Morley Dets
    N/W Metro TIG
    OCI // O.C.I.
    Peel IMU
    Perth T.I.G.
    Joondalup TIG
    Mirrabooka TIG
    Mirrabooka DSG
    SM TIG // S/Metro TIG
    EM TIG
    Fremantle TIG
    Ftle DSG
    OMCG Taskforce // O.M.C.G TASKFORCE, O.M.C.G. TASKFORCE, OMCG T/F
    C.M.DSG
    C.M.TIG
    Cannington TIG // C'ton TIG
    Cannington DSG
    R/Ham DSG
    W.M.D.S.G.
    W.M.T.I.G.

    Mt Magnet
    Mt Hawthorn
*/

export interface IOrganisation {
	org_id: number;
	name: string;
}

export interface IPoliceUser {
	user_id: number;
	police_id: string; // sometimes PD123213, sometimes 234323
	org: IOrganisation;
	seniority: PoliceSeniority;
	sworn: boolean;
	first_name: string;
	last_name: string;
}

const PoliceUsersTable = observer(() => {
	const searchStore = useSearchFilterStore();

	return (
		<div className="flex flex-col w-full ">
			{/* Search Input */}
			{/* Add Button */}
			<div className="w-full flex flex-end justify-end">
				<ResponsiveModal>
					<ResponsiveModalTrigger asChild>
						<Button variant={"police"} className=" w-45">
							<RiPoliceCarFill />
							<span>Add Police</span>
						</Button>
					</ResponsiveModalTrigger>
					<ResponsiveModalContent side={"bottom"}>
						{/* <form>
								<Form></Form>
							</form> */}
					</ResponsiveModalContent>
				</ResponsiveModal>
			</div>
			<div>Police Users Table</div>
		</div>
	);
});

export default PoliceUsersTable;
