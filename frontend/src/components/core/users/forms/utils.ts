// Display names for frontend
export const POLICE_SENIORITY_OPTIONS = [
	"officer",
	"probationary_constable",
	"constable",
	"detective",
	"first_class_constable",
	"senior_constable",
	"detective_senior_constable",
	"conveying_officer",
] as const;

// Display mapping for better UX
export const SENIORITY_DISPLAY_MAP = {
	officer: "Officer",
	probationary_constable: "Probationary Constable",
	constable: "Constable",
	detective: "Detective",
	first_class_constable: "First Class Constable",
	senior_constable: "Senior Constable",
	detective_senior_constable: "Detective Senior Constable",
	conveying_officer: "Conveying Officer",
} as const;

// Backend to frontend mapping
export const BACKEND_TO_FRONTEND_SENIORITY = {
	unset: "officer", // Default to officer if unset
	officer: "officer",
	probationary_constable: "probationary_constable",
	constable: "constable",
	detective: "detective",
	first_class_constable: "first_class_constable",
	senior_constable: "senior_constable",
	detective_senior_constable: "detective_senior_constable",
	conveying_officer: "conveying_officer",
} as const;

// Item type display mapping
export const ITEM_TYPE_DISPLAY_MAP = {
	seed: "Seed/s",
	seedling: "Seedling/s",
	plant: "Plant/s",
	plant_striking: "Plant Striking/s",
	poppy_capsule: "Poppy Capsule/s",
	stem: "Stem/s",
	root_ball: "Root Ball/s",
	mushroom: "Mushroom/s",
	tin: "Tin/s",
	unknown: "Unknown",
} as const;

// Determination options display mapping
export const DETERMINATION_DISPLAY_MAP = {
	degraded: "Degraded",
	cannabis: "Cannabis Sativa",
} as const;
