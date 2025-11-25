import './App.css'
import { Button } from './components/ui/button'
import { Card } from './components/ui/card'
import { Input } from './components/ui/input'
import { Label } from './components/ui/label'
import L from 'leaflet'
import { useCallback, useEffect, useRef, useState } from 'react'
import 'leaflet/dist/leaflet.css'
import { quickSort } from './utils/quick-sort-results'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './components/ui/select'

interface MapMarker {
  lat: number
  lon: number
  label: string
  description: string
}

interface CityData {
  input: string
  lat: number
  lon: number
}

interface ReverseGeocode {
  locality?: string
  country?: string
  postalCode?: string
}

export interface ApiResponse {
  cityA: CityData
  cityB: CityData
  cityC: CityData
  midpoint: {
    lat: number
    lon: number
    reverse?: ReverseGeocode
  }
  distances_km: {
    A_to_M: number
    B_to_M: number
    C_to_M: number
  }
  graph: {
    paths: {
      A_to_B_via_M: string[]
      A_to_C_via_M: string[]
      B_to_C_via_M: string[]
    }
  }
}

interface FormData {
  cityA: string
  cityB: string
  cityC: string
}

function App() {
  const [formData, setFormData] = useState<FormData>({
    cityA: '',
    cityB: '',
    cityC: ''
  })
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string>('')
  const [mapMarkers, setMapMarkers] = useState<MapMarker[]>([])
  const [allResults, setAllResults] = useState<ApiResponse[]>([])
  const [loadingResults, setLoadingResults] = useState<boolean>(false)
  const [sortOrder, setSortOrder] = useState<'default' | 'asc' | 'desc'>('default')
  
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<L.Map | null>(null)
  const markersLayerRef = useRef<L.LayerGroup | null>(null)

  useEffect(() => {
    if (!mapRef.current || typeof window === 'undefined') return

    if ((mapRef.current as any)._leaflet_id) {
      return
    }

    const map = L.map(mapRef.current, {
      center: [0, 0],
      zoom: 2,
      zoomControl: true,
      scrollWheelZoom: true,
    })

    mapInstanceRef.current = map

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map)

    markersLayerRef.current = L.layerGroup().addTo(map)

    return () => {
      map.remove()
    }
  }, [])

  useEffect(() => {
    fetchAllResults()
  }, [])

  useEffect(() => {
    if (!mapInstanceRef.current || !markersLayerRef.current || mapMarkers.length === 0) return

    markersLayerRef.current.clearLayers()

  mapMarkers.forEach((marker) => {
    const isMiddle = marker.label === 'Ponto Médio'
    
    if (isMiddle) {
      L.circleMarker([marker.lat, marker.lon], {
        radius: 10,
        fillColor: '#ef4444',
        color: '#fff',
        weight: 2,
        opacity: 1,
        fillOpacity: 0.8
      })
        .bindPopup(`<strong>${marker.label}</strong><br>${marker.description}`)
        .addTo(markersLayerRef.current!)
    } else {
      L.marker([marker.lat, marker.lon])
        .bindPopup(`<strong>${marker.label}</strong><br>${marker.description}`)
        .addTo(markersLayerRef.current!)
    }
  })

    if (mapMarkers.length === 4) {
      L.polyline(
        [
          [mapMarkers[0].lat, mapMarkers[0].lon],
          [mapMarkers[3].lat, mapMarkers[3].lon],
          [mapMarkers[1].lat, mapMarkers[1].lon],
          [mapMarkers[2].lat, mapMarkers[2].lon],
        ],
        { weight: 3, color: '#3b82f6' }
      ).addTo(markersLayerRef.current!)
    }

    const bounds = L.latLngBounds(mapMarkers.map(m => [m.lat, m.lon]))
    mapInstanceRef.current.fitBounds(bounds, { padding: [30, 30] })
  }, [mapMarkers])

  const fetchAllResults = async () => {
    setLoadingResults(true)
    try {
      const response = await fetch('http://127.0.0.1:5000/api/results')
      const data = await response.json()
      
      if (response.ok) {
        setAllResults(Array.isArray(data) ? data : [])
      }
    } catch (err) {
      console.error('Error fetching results:', err)
    } finally {
      setLoadingResults(false)
    }
  }

  const getSortedResults = useCallback((): ApiResponse[] => {
    if (sortOrder === 'default') {
      return allResults.slice().reverse()
    }
    const sortedArray = allResults.slice()
    quickSort(sortedArray, 0, sortedArray.length - 1, sortOrder === 'asc')
    return sortedArray
  }, [allResults, sortOrder])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target
    setFormData(prev => ({
      ...prev,
      [id]: value
    }))
  }

  const handleSubmit = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    
    try {
      const response = await fetch('http://127.0.0.1:5000/api/midpoint', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData)
      })
      
      const data = await response.json()
      console.log('Resposta da API:', data)

      if (!response.ok) {
        setError(data.error || 'Erro desconhecido.')
        return
      }

      const latA = data.cityA.lat
      const lonA = data.cityA.lon
      const latB = data.cityB.lat
      const lonB = data.cityB.lon
      const latC = data.cityC.lat
      const lonC = data.cityC.lon
      const latM = data.midpoint.lat
      const lonM = data.midpoint.lon

      const coords = [latA, lonA, latB, lonB, latC, lonC, latM, lonM]
      if (coords.some((v) => typeof v !== 'number' || Number.isNaN(v))) {
        console.error('Coordenadas inválidas:', coords)
        setError('Coordenadas inválidas retornadas pela API.')
        return
      }

      const rev = data.midpoint.reverse || {}
      const revLocality = rev.locality || ''
      const revCountry = rev.country || ''
      const revPostal = rev.postalCode || ''
      const revStr = [revLocality, revPostal, revCountry].filter(Boolean).join(', ')

      setMapMarkers([
        { lat: latA, lon: lonA, label: 'Cidade A', description: data.cityA.input },
        { lat: latB, lon: lonB, label: 'Cidade B', description: data.cityB.input },
        { lat: latC, lon: lonC, label: 'Cidade C', description: data.cityC.input },
        { lat: latM, lon: lonM, label: 'Ponto Médio', description: revStr || 'Centroide entre A, B e C' }
      ])

      await fetchAllResults()
    } catch (err) {
      console.error(err)
      setError('Erro na requisição ou no frontend.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className='relative grid grid-cols-5 gap-x-14 w-full min-h-screen m-auto bg-neutral-900 p-14 pt-32 font-mono'>
      <h1 className='absolute left-1/2 -translate-x-1/2 text-5xl top-6 text-transparent bg-clip-text bg-linear-to-br from-neutral-200 to-neutral-500 font-bold h-24'>
        Half Way
      </h1>
      <div className='col-span-1 flex flex-col gap-3 text-white'>
         <h2 className='text-3xl font-semibold text-transparent bg-clip-text bg-linear-to-br from-neutral-200 to-neutral-500'>Sobre</h2>

         <p className='text-neutral-300'>Este projeto desenvolve uma ferramenta para identificar a localização estratégica de um aeroporto capaz de atender três cidades ou pontos escolhidos pelo usuário. O sistema utiliza o conceito de grafos para interpretar o mapa, onde cada localidade é vista como um ponto e as ligações entre eles são tratadas como conexões diretas.</p>
         <p className='text-neutral-300'>Diferente de um GPS que segue as curvas das estradas, o programa traça linhas retas para representar a distância e a relação entre esses locais. Ao receber os três pontos de interesse, o algoritmo analisa essa rede de conexões lineares para calcular matematicamente onde fica o ponto de equilíbrio.</p>
         <p className="text-neutral-300">O objetivo final é apontar o local central que, considerando essas ligações diretas, ofereça a menor distância combinada para todos os envolvidos, facilitando o acesso ao aeroporto de forma igualitária.</p>
      </div>

      <div className='text-white col-span-3 h-full w-full flex flex-col gap-6'>
        <div className='flex flex-col gap-5'>
          <div className='flex flex-col gap-2'>
            <Label htmlFor='cityA'>Cidade A:</Label>
            <Input 
              id='cityA' 
              value={formData.cityA}
              onChange={handleInputChange}
              placeholder='Ex: Av Atlântica, Rio de Janeiro, Brasil' 
              className='border-neutral-500 focus-visible:border-neutral-400'
              required
            />
          </div>

          <div className='flex flex-col gap-2'>
            <Label htmlFor='cityB'>Cidade B:</Label>
            <Input 
              id='cityB' 
              value={formData.cityB}
              onChange={handleInputChange}
              placeholder='Ex: Av Paulista, São Paulo, Brasil' 
              className='border-neutral-500 focus-visible:border-neutral-400'
              required
            />
          </div>

          <div className='flex flex-col gap-2'>
            <Label htmlFor='cityC'>Cidade C:</Label>
            <Input 
              id='cityC' 
              value={formData.cityC}
              onChange={handleInputChange}
              placeholder='Ex: Belo Horizonte, Minas Gerais, Brasil' 
              className='border-neutral-500 focus-visible:border-neutral-400'
              required
            />
          </div>

          <Button 
            onClick={handleSubmit}
            variant="secondary" 
            className='w-32 cursor-pointer'
            disabled={loading}
          >
            {loading ? 'Calculando...' : 'Calcular'}
          </Button>
        </div>
        {error && (
          <div className='text-red-400 font-bold p-4 bg-red-950/30 rounded-lg border border-red-800'>
            {error}
          </div>
        )}
        <Card className='h-[500px] mt-4 bg-neutral-800 overflow-hidden p-0'>
          <div ref={mapRef} className='w-full h-full' />
        </Card>
      </div>

      <div className='col-span-1 flex flex-col gap-3'>
        <div className='flex items-center justify-between'>
          <h2 className='text-2xl font-semibold text-transparent bg-clip-text bg-linear-to-br from-neutral-200 to-neutral-500'>
            Histórico
          </h2>
          
          {allResults.length > 0 && (
            <Select value={sortOrder} onValueChange={(value) => setSortOrder(value as 'default' | 'asc' | 'desc')}>
              <SelectTrigger className='w-32 bg-neutral-800 border-neutral-600 text-neutral-200'>
                <SelectValue placeholder='Ordenar' />
              </SelectTrigger>
              <SelectContent className='bg-neutral-800 border-neutral-600'>
                <SelectItem value='default' className='text-neutral-200 focus:bg-neutral-700'>Padrão</SelectItem>
                <SelectItem value='asc' className='text-neutral-200 focus:bg-neutral-700'>A-Z</SelectItem>
                <SelectItem value='desc' className='text-neutral-200 focus:bg-neutral-700'>Z-A</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>

        <div className='flex flex-col gap-1 overflow-y-auto max-h-[calc(100vh-200px)]'>
          {loadingResults ? (
            <p className='text-neutral-400 text-sm'>Carregando...</p>
          ) : allResults.length === 0 ? (
            <p className='text-neutral-400 text-sm'>Nenhum resultado ainda.</p>
          ) : (
            getSortedResults().map((resultItem, index) => (
              <Card
                key={index}
                className='p-2 bg-neutral-800 border-neutral-700 cursor-pointer hover:bg-neutral-700 transition-colors gap-3'
                onClick={() => {
                  const latA = resultItem.cityA.lat
                  const lonA = resultItem.cityA.lon
                  const latB = resultItem.cityB.lat
                  const lonB = resultItem.cityB.lon
                  const latC = resultItem.cityC.lat
                  const lonC = resultItem.cityC.lon
                  const latM = resultItem.midpoint.lat
                  const lonM = resultItem.midpoint.lon

                  const rev = resultItem.midpoint.reverse || {}
                  const revLocality = rev.locality || ''
                  const revCountry = rev.country || ''
                  const revPostal = rev.postalCode || ''
                  const revStr = [revLocality, revPostal, revCountry].filter(Boolean).join(', ')

                  setMapMarkers([
                    { lat: latA, lon: lonA, label: 'Cidade A', description: resultItem.cityA.input },
                    { lat: latB, lon: lonB, label: 'Cidade B', description: resultItem.cityB.input },
                    { lat: latC, lon: lonC, label: 'Cidade C', description: resultItem.cityC.input },
                    { lat: latM, lon: lonM, label: 'Ponto Médio', description: revStr || 'Centroide entre A, B e C' }
                  ])
                }}
              >
                <div className='text-sm text-neutral-200 space-y-1'>
                  <div className='truncate'>
                    <span className='text-neutral-400'>A:</span> {resultItem.cityA.input}
                  </div>
                  <div className='truncate'>
                    <span className='text-neutral-400'>B:</span> {resultItem.cityB.input}
                  </div>
                  <div className='truncate'>
                    <span className='text-neutral-400'>C:</span> {resultItem.cityC.input}
                  </div>
                </div>
                <div className='pt-2 border-t border-neutral-600'>
                  <span className='text-xs flex text-neutral-400 font-extralight'>
                    {resultItem.midpoint.reverse?.locality 
                      ? `Ponto médio: ${resultItem.midpoint.reverse.locality} ${resultItem.midpoint.lat.toFixed(4)}°, ${resultItem.midpoint.lon.toFixed(4)}°`
                      : `Ponto médio: ${resultItem.midpoint.lat.toFixed(4)}°, ${resultItem.midpoint.lon.toFixed(4)}°`
                    }                  
                  </span>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

export default App