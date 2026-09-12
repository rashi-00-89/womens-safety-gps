import { useState, useEffect } from 'react'
import { MapContainer, TileLayer, GeoJSON, Popup, Marker, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import MarkerClusterGroup from 'react-leaflet-cluster'

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

function SearchBar() {
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

function App() {
  const [hexagons, setHexagons] = useState([])
  const [facilities, setFacilities] = useState([])
  const [loading, setLoading] = useState(true)

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
        <SearchBar />

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
    </div>
  )
}

export default App