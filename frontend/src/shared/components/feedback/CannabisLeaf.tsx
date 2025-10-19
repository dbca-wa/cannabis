// Cannabis Leaf SVG Component
const CannabisLeaf = ({ size = 60, className = "", style = {} }) => (
	<svg
		width={size}
		height={size}
		viewBox="0 0 100 100"
		className={className}
		style={style}
	>
		<defs>
			<linearGradient
				id="leafGradient"
				x1="0%"
				y1="0%"
				x2="100%"
				y2="100%"
			>
				<stop offset="0%" stopColor="#22c55e" /> {/* Light green */}
				<stop offset="50%" stopColor="#16a34a" /> {/* Medium green */}
				<stop offset="100%" stopColor="#15803d" /> {/* Dark green */}
			</linearGradient>
		</defs>

		{/* Classic 7-pointed cannabis leaf */}
		<g transform="translate(50,50)">
			{/* Center leaflet */}
			<path
				d="M0,-35 Q-3,-25 -2,-10 Q-1,0 0,5 Q1,0 2,-10 Q3,-25 0,-35 Z"
				fill="url(#leafGradient)"
			/>

			{/* Left leaflets */}
			<path
				d="M-8,-30 Q-12,-22 -10,-8 Q-8,0 -6,3 Q-4,-2 -5,-12 Q-6,-22 -8,-30 Z"
				fill="url(#leafGradient)"
				transform="rotate(-15)"
			/>
			<path
				d="M-15,-25 Q-18,-18 -16,-6 Q-14,0 -12,2 Q-10,-3 -11,-10 Q-13,-18 -15,-25 Z"
				fill="url(#leafGradient)"
				transform="rotate(-30)"
			/>
			<path
				d="M-20,-18 Q-22,-12 -20,-4 Q-18,0 -16,1 Q-14,-2 -15,-6 Q-17,-12 -20,-18 Z"
				fill="url(#leafGradient)"
				transform="rotate(-50)"
			/>

			{/* Right leaflets */}
			<path
				d="M8,-30 Q12,-22 10,-8 Q8,0 6,3 Q4,-2 5,-12 Q6,-22 8,-30 Z"
				fill="url(#leafGradient)"
				transform="rotate(15)"
			/>
			<path
				d="M15,-25 Q18,-18 16,-6 Q14,0 12,2 Q10,-3 11,-10 Q13,-18 15,-25 Z"
				fill="url(#leafGradient)"
				transform="rotate(30)"
			/>
			<path
				d="M20,-18 Q22,-12 20,-4 Q18,0 16,1 Q14,-2 15,-6 Q17,-12 20,-18 Z"
				fill="url(#leafGradient)"
				transform="rotate(50)"
			/>
		</g>
	</svg>
);

// Usage Examples:
// <CannabisLeaf size={60} />
// <CannabisLeaf size={120} className="pulse-glow" />
// <CannabisLeaf size={80} style={{ filter: 'drop-shadow(0 0 10px green)' }} />

// Props:
// - size: number (default: 60) - Width and height in pixels
// - className: string - Additional CSS classes
// - style: object - Inline styles

export default CannabisLeaf;
