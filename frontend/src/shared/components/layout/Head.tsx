// Component for setting the Title on the tab using React Helmet

import { Helmet, HelmetProvider } from "react-helmet-async";

interface IProps {
	title?: string;
	isStandalone?: boolean;
	description?: string;
	keywords?: string;
	url?: string;
}

export const Head = ({
	title,
	isStandalone,
	description,
	keywords,
	url,
}: IProps) => {
	// Base name
	const baseName = "cannabis";
	const baseSite = `https://${baseName}.dbca.wa.gov.au/`;

	// Keywords
	const defaultKeywords = `${baseName[0].toUpperCase()}${baseName.slice(
		1
	)}, Certificates, Science, Determinations, Police, DBCA, Department of Biodiversity, Conservation and Attractions`;

	// Image
	const imageString = "/dbca.jpg";
	const imageStringAbsolute = `${baseSite}dbca.jpg`;

	// Description
	const defaultDescription = `${baseName[0].toUpperCase()}${baseName.slice(
		1
	)} | DBCA | Department of Biodiversity, Conservation and Attractions | Western Australia`;
	// Functions
	const getDescription = () => {
		const baseDescription = defaultDescription;

		return description ? `${description}` : baseDescription;
	};

	const formatTitle = (rawTitle: string | undefined) => {
		if (!rawTitle) return "Loading...";
		const formattedTitle = isStandalone
			? rawTitle
			: `${baseName[0].toUpperCase()}${baseName.slice(1)} | ${rawTitle}`;
		return formattedTitle.substring(0, 60);
	};

	const getRobotsContent = (path: string) => {
		return "noindex, nofollow";
	};

	const getSitemapStructuredData = () => {
		return {
			"@context": "https://schema.org",
			"@type": "CollectionPage",
			"@id": baseSite,
			name: "Staff Directory",
			description: "Request Cannabis identification",
			isPartOf: {
				"@type": "WebSite",
				"@id": `${baseSite}#website`,
			},
		};
	};

	const getStructuredData = () => {
		// Main website structured data
		return {
			"@context": "https://schema.org",
			"@type": "WebSite",
			"@id": `${baseSite}#website`,
			name: `${baseName[0].toUpperCase()}${baseName.slice(1)}`,
			url: `${baseSite}`,
			potentialAction: {
				"@type": "SearchAction",
				target: {
					"@type": "EntryPoint",
					urlTemplate: `${baseSite}login`,
				},
			},
			mainEntityOfPage: getSitemapStructuredData(),
		};
	};

	// Final values
	const currentUrl = url || baseSite;
	const finalDescription = getDescription();
	const finalTitle = formatTitle(title);
	const finalKeywords = keywords
		? `${defaultKeywords}, ${keywords}`
		: defaultKeywords;

	return (
		<HelmetProvider>
			<Helmet>
				{/* JSON-LD */}
				<script type="application/ld+json">
					{JSON.stringify(getStructuredData())}
				</script>

				<title>{finalTitle}</title>
				<link rel="icon" type="image/jpg" href={imageString} />
				<link
					rel="alternate"
					type="application/json"
					href=""
					title="Staff Directory"
				/>
				<meta name="description" content={finalDescription} />
				<meta name="keywords" content={finalKeywords} />
				<meta httpEquiv="Cache-Control" content="max-age=3600" />
				<meta httpEquiv="Content-Language" content="en" />
				<meta name="sitemap" content={baseSite} />

				{/* Open Graph / Facebook */}
				<meta property="og:type" content="website" />
				<meta property="og:url" content={currentUrl} />
				<meta property="og:title" content={finalTitle} />
				<meta property="og:description" content={finalDescription} />
				<meta property="og:image" content={imageStringAbsolute} />
				{/* Twitter */}
				<meta property="twitter:card" content="summary_large_image" />
				<meta property="twitter:url" content={currentUrl} />
				<meta property="twitter:title" content={finalTitle} />
				<meta
					property="twitter:description"
					content={finalDescription}
				/>
				<meta property="twitter:image" content={imageStringAbsolute} />
				{/* Additional SEO tags */}
				<link rel="canonical" href={currentUrl} />
				<meta
					name="robots"
					content={getRobotsContent(window.location.pathname)}
				/>
				<meta
					name="googlebot"
					content={getRobotsContent(window.location.pathname)}
				/>
				<meta
					name="googlebot-news"
					content={getRobotsContent(window.location.pathname)}
				/>
				<meta
					name="slurp"
					content={getRobotsContent(window.location.pathname)}
				/>
				<meta
					name="bingbot"
					content={getRobotsContent(window.location.pathname)}
				/>
				<meta
					name="viewport"
					content="width=device-width, initial-scale=1"
				/>
				<meta
					httpEquiv="Content-Type"
					content="text/html; charset=utf-8"
				/>
				<meta
					name="viewport"
					content="width=device-width, initial-scale=1"
				/>
				<meta
					httpEquiv="Content-Type"
					content="text/html; charset=utf-8"
				/>
				<html lang="en" />
			</Helmet>
		</HelmetProvider>
	);
};
