import MarkerClusterGroup from 'react-leaflet-cluster'
import { useState, useEffect, useRef } from 'react'
import { MapContainer, TileLayer, GeoJSON, Popup, Marker, useMap, useMapEvents, Polyline, CircleMarker } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const policeIcon = new L.DivIcon({
  html: `
    <svg width="32" height="42" viewBox="0 0 32 42" xmlns="http://www.w3.org/2000/svg">
      <path d="M16 0C7.163 0 0 7.163 0 16c0 11 16 26 16 26s16-15 16-26C32 7.163 24.837 0 16 0z" fill="#1a1a2e"/>
      <circle cx="16" cy="15" r="10.5" fill="none" stroke="white" stroke-width="1.5"/>
      <path d="M16 7l4 1.8v4c0 3-1.7 5-4 6-2.3-1-4-3-4-6v-4z" fill="white"/>
    </svg>
  `,
  className: '',
  iconSize: [32, 42],
  iconAnchor: [16, 42],
})

const hospitalIcon = new L.DivIcon({
  html: `
    <svg width="32" height="42" viewBox="0 0 32 42" xmlns="http://www.w3.org/2000/svg">
      <path d="M16 0C7.163 0 0 7.163 0 16c0 11 16 26 16 26s16-15 16-26C32 7.163 24.837 0 16 0z" fill="#dc2626"/>
      <circle cx="16" cy="15" r="10.5" fill="white"/>
      <rect x="13" y="8" width="6" height="14" fill="#dc2626"/>
      <rect x="9" y="12" width="14" height="6" fill="#dc2626"/>
    </svg>
  `,
  className: '',
  iconSize: [32, 42],
  iconAnchor: [16, 42],
})

function getColor(sri) {
  if (sri > 500) return '#dc2626'
  if (sri > 300) return '#f59e0b'
  return '#22c55e'
}

function getLabel(sri) {
  if (sri > 500) return 'High Risk'
  if (sri > 300) return 'Medium Risk'
  return 'Low Risk'
}
function RoutePlanner() {
  const [active, setActive] = useState(false)
  const [points, setPoints] = useState([])
  const [routes, setRoutes] = useState(null)
  const [loading, setLoading] = useState(false)
  const [alpha, setAlpha] = useState(8)
  const panelRef = useRef(null)

  useEffect(() => {
    if (panelRef.current) L.DomEvent.disableClickPropagation(panelRef.current)
  }, [])

  const fetchRoutes = async (pts, a) => {
    setLoading(true)
    try {
      const [p, q] = pts
      const url = `http://127.0.0.1:8000/safe-route?start_lat=${p[0]}&start_lon=${p[1]}&end_lat=${q[0]}&end_lon=${q[1]}&alpha=${a}`
      const res = await fetch(url)
      if (!res.ok) throw new Error('No route')
      setRoutes(await res.json())
    } catch {
      alert('Could not find a route for these points')
    }
    setLoading(false)
  }

  useMapEvents({
    click(e) {
      if (!active || points.length >= 2) return
      const next = [...points, [e.latlng.lat, e.latlng.lng]]
      setPoints(next)
      if (next.length === 2) fetchRoutes(next, alpha)
    },
  })

  const reset = () => { setPoints([]); setRoutes(null) }
  const extra = routes ? ((routes.safest.distance_km / routes.shortest.distance_km - 1) * 100).toFixed(1) : null
  const drop = routes ? ((1 - routes.safest.average_sri / routes.shortest.average_sri) * 100).toFixed(1) : null

  return (
    <>
      <div ref={panelRef} className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] bg-gray-800 text-white px-4 py-3 rounded-lg shadow-lg text-sm w-72">
        <button
          onClick={() => { setActive(!active); reset() }}
          className="w-full bg-emerald-600 hover:bg-emerald-700 rounded px-3 py-1 font-semibold"
        >
          {active ? 'Cancel' : 'Plan safe route'}
        </button>
        {active && (
          <div className="mt-2">
            <label className="text-gray-300">Safety priority: {alpha} {alpha === 0 && '(= shortest)'}</label>
            <input
              type="range" min="0" max="20" step="1" value={alpha}
              onChange={(e) => setAlpha(Number(e.target.value))}
              onMouseUp={() => points.length === 2 && fetchRoutes(points, alpha)}
              onTouchEnd={() => points.length === 2 && fetchRoutes(points, alpha)}
              className="w-full"
            />
          </div>
        )}
        {active && !routes && !loading && (
          <p className="mt-2 text-gray-300">
            {points.length === 0 ? 'Click the start point on the map' : 'Click the destination'}
          </p>
        )}
        {loading && <p className="mt-2 text-gray-300">Finding routes...</p>}
        {routes && (
          <div className="mt-2 space-y-1">
            <p><span className="text-blue-400 font-bold">Shortest:</span> {routes.shortest.distance_km} km, avg SRI {routes.shortest.average_sri}</p>
            <p><span className="text-green-400 font-bold">Safest:</span> {routes.safest.distance_km} km (+{extra}%), avg SRI {routes.safest.average_sri} (-{drop}%)</p>
            <button onClick={reset} className="mt-1 underline text-gray-300">Reset</button>
          </div>
        )}
      </div>

      {points.map((p, i) => (
        <CircleMarker key={i} center={p} radius={8}
          pathOptions={{ color: 'white', fillColor: i === 0 ? '#2563eb' : '#dc2626', fillOpacity: 1 }} />
      ))}
      {routes && (
        <>
          <Polyline positions={routes.shortest.coords} pathOptions={{ color: '#1d4ed8', weight: 5 }} />
          <Polyline positions={routes.safest.coords} pathOptions={{ color: '#065f46', weight: 5 }} />
        </>
      )}
    </>
  )
}
function SearchBar({ onFound }) {
  const [query, setQuery] = useState('')
  const map = useMap()

  const handleSearch = async (e) => {
    e.preventDefault()
    if (!query) return
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query + ', Bengaluru')}&format=json&limit=1`
    )
    const data = await res.json()
    if (data.length > 0) {
      const { lat, lon } = data[0]
      map.setView([parseFloat(lat), parseFloat(lon)], 15)
      if (onFound) onFound(parseFloat(lat), parseFloat(lon))
    } else {
      alert('Location not found')
    }
  }

  return (
    <form onSubmit={handleSearch} className="absolute top-4 right-4 z-[1000]">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search a place in Bengaluru..."
        className="px-4 py-2 rounded-lg shadow-lg w-72 outline-none"
      />
    </form>
  )
}

function Legend() {
  return (
    <div className="absolute bottom-6 left-4 z-[1000] bg-gray-800 text-white px-4 py-3 rounded-lg shadow-lg text-sm">
      <p className="font-semibold mb-2">Safety Risk Level</p>
      <div className="flex items-center gap-2 mb-1">
        <span className="w-4 h-4 rounded" style={{ backgroundColor: '#22c55e' }}></span>
        <span>Low Risk (0-300)</span>
      </div>
      <div className="flex items-center gap-2 mb-1">
        <span className="w-4 h-4 rounded" style={{ backgroundColor: '#f59e0b' }}></span>
        <span>Medium Risk (300-500)</span>
      </div>
      <div className="flex items-center gap-2 mb-2">
        <span className="w-4 h-4 rounded" style={{ backgroundColor: '#dc2626' }}></span>
        <span>High Risk (500+)</span>
      </div>
      <hr className="border-gray-600 my-2" />
      <div className="flex items-center gap-2 mb-1">
        <svg width="16" height="16" viewBox="0 0 32 32">
          <circle cx="16" cy="16" r="14" fill="#1a1a2e" />
          <path d="M16 8l4 1.8v4c0 3-1.7 5-4 6-2.3-1-4-3-4-6v-4z" fill="white" />
        </svg>
        <span>Police Station</span>
      </div>
      <div className="flex items-center gap-2">
        <svg width="16" height="16" viewBox="0 0 32 32">
          <circle cx="16" cy="16" r="14" fill="#dc2626" />
          <rect x="13" y="9" width="6" height="14" fill="white" />
          <rect x="9" y="13" width="14" height="6" fill="white" />
        </svg>
        <span>Hospital</span>
      </div>
    </div>
  )
}
function centroidOf(geometryStr) {
  const ring = JSON.parse(geometryStr).coordinates[0]
  const lon = ring.reduce((s, p) => s + p[0], 0) / ring.length
  const lat = ring.reduce((s, p) => s + p[1], 0) / ring.length
  return [lat, lon]
}

function ReportPanel({ report, onClose }) {
  const color = report.band === 'High Risk' ? 'bg-red-600' : report.band === 'Medium Risk' ? 'bg-amber-500' : 'bg-green-600'
  return (
    <div className="absolute right-4 top-20 bottom-6 w-80 z-[1000] bg-gray-800 text-white rounded-lg shadow-lg p-4 overflow-y-auto text-sm">
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-lg font-bold">Place Safety Report</h2>
        <button onClick={onClose} className="text-gray-300 text-xl">×</button>
      </div>
      <span className={`${color} px-2 py-1 rounded font-semibold`}>{report.band}</span>
      <p className="mt-3 text-3xl font-bold">{report.final_sri}<span className="text-base text-gray-400"> / 1000</span></p>
      <p className="text-gray-300">Safer than {report.safer_than_pct}% of Bengaluru</p>
      <div className="mt-3 space-y-1">
        <p>City average: {report.city_avg}</p>
        {report.neighbour_avg !== null && <p>Neighbouring areas: {report.neighbour_avg}</p>}
        <p>Crime score: {report.crime_sri}</p>
        <p>Emergency access score: {report.access_sri}</p>
        <p>Crime rate: {report.crime_rate_per_1000} per 1000 residents</p>
        <p>Population density: {report.population_density} / sq km</p>
      </div>
      <h3 className="mt-4 font-semibold">Nearest police stations</h3>
      {report.police.map((f, i) => <p key={i} className="text-gray-300">{f.km} km away</p>)}
      <h3 className="mt-3 font-semibold">Nearest hospitals</h3>
      {report.hospitals.map((f, i) => <p key={i} className="text-gray-300">{f.km} km away</p>)}
      <h3 className="mt-4 font-semibold">Key points</h3>
      <ul className="list-disc ml-5 text-gray-300">
        {report.notes.map((n, i) => <li key={i}>{n}</li>)}
      </ul>
    </div>
  )
}
function App() {
  const [hexagons, setHexagons] = useState([])
  const [facilities, setFacilities] = useState([])
  const [loading, setLoading] = useState(true)
  const [report, setReport] = useState(null)
  const openReport = async (lat, lon) => {
  try {
    const res = await fetch(`http://127.0.0.1:8000/place-report?lat=${lat}&lon=${lon}`)
    if (res.ok) setReport(await res.json())
  } catch (e) { console.error(e) }
}

  useEffect(() => {
    Promise.all([
      fetch('http://127.0.0.1:8000/all-hexagons').then(res => res.json()),
      fetch('http://127.0.0.1:8000/facilities').then(res => res.json())
    ])
      .then(([hexData, facilityData]) => {
        setHexagons(hexData)
        setFacilities(facilityData)
        setLoading(false)
      })
      .catch(err => {
        console.error('Error fetching data:', err)
        setLoading(false)
      })
  }, [])

  return (
    <div className="h-screen w-screen bg-gray-900 relative">
      <div className="absolute top-4 left-4 z-[1000] bg-gray-800 text-white px-6 py-3 rounded-lg shadow-lg">
        <h1 className="text-xl font-bold">🛡️ Sentinel</h1>
        <p className="text-sm text-gray-300">Bengaluru Safety Risk Map</p>
      </div>

      {loading && (
        <div className="absolute inset-0 z-[2000] flex items-center justify-center bg-gray-900 bg-opacity-80">
          <p className="text-white text-lg">Loading safety data...</p>
        </div>
      )}

      <MapContainer
        center={[12.9716, 77.5946]}
        zoom={12}
        className="h-full w-full"
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; OpenStreetMap contributors'
        />
        <SearchBar onFound={openReport} />
        <RoutePlanner />

        {hexagons.map((hex) => (
          <GeoJSON
            key={hex.hex_id}
            data={JSON.parse(hex.geometry)}
            style={{
              fillColor: getColor(hex.final_sri),
              fillOpacity: 0.5,
              color: getColor(hex.final_sri),
              weight: 1,
            }}
          >
            <Popup>
              <div>
                <p className="font-bold">{getLabel(hex.final_sri)}</p>
                <p>Safety Score: {hex.final_sri.toFixed(1)} / 1000</p>
                <p>Crime Score: {hex.crime_sri.toFixed(1)}</p>
                <p>Access Score: {hex.access_sri.toFixed(1)}</p>
                <button
  onClick={() => openReport(...centroidOf(hex.geometry))}
  className="mt-2 w-full bg-emerald-600 text-white rounded px-2 py-1"
>
  View full report
</button>
              </div>
            </Popup>
          </GeoJSON>
        ))}

<MarkerClusterGroup chunkedLoading>
  {facilities.map((f, idx) => (
    <Marker
      key={idx}
      position={[f.lat, f.lon]}
      icon={f.type === 'police' ? policeIcon : hospitalIcon}
    >
      <Popup>
        <p className="font-bold">{f.name}</p>
        <p className="capitalize">{f.type}</p>
      </Popup>
    </Marker>
  ))}
</MarkerClusterGroup>

      <Legend />
      </MapContainer>
      {report && <ReportPanel report={report} onClose={() => setReport(null)} />}
    </div>
  )
}

export default App