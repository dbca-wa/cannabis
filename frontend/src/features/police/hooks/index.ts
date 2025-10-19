// Police Stations Hooks
export {
	useStations,
	useStation,
	useCreateStation,
	useUpdateStation,
	useDeleteStation,
	stationsQueryKeys,
} from "./usePoliceStations";

// Police Officers Hooks
export {
	usePoliceOfficers,
	usePoliceOfficer,
	useCreatePoliceOfficer,
	useUpdatePoliceOfficer,
	useDeletePoliceOfficer,
	policeOfficersQueryKeys,
} from "./usePoliceOfficers";

// Search Hooks
export {
	useStationSearch,
	type StationSearchResult,
	type UseStationSearchOptions,
} from "./useStationSearch";
export { useStationById } from "./useStationById";
export {
	useOfficerSearch,
	type OfficerSearchResult,
	type UseOfficerSearchOptions,
} from "./useOfficerSearch";
export { useOfficerById } from "./useOfficerById";
