import * as React from 'react';
import { useState, useRef, useCallback, useMemo } from 'react';
import Map, { Marker, Popup, Source, Layer, NavigationControl } from 'react-map-gl/maplibre';
import { yaylalar } from './data/yaylalar';
import { ilceler } from './data/ilceler';
import 'maplibre-gl/dist/maplibre-gl.css';
import okulLogo from '../okullogo.png';
import tubitakLogo from '../tubitak-4006-seeklogo.png';
import landingBg from '../persembe-yaylasi-aybasti.jpg';


// Haversine mesafe hesaplama (km) (Yakın ilçeyi bulmak için hala gerekli)
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Dünya yarıçapı (km)
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// OSRM API ile Gerçek Karayolu Rotası
async function fetchOSRMRoute(startLng, startLat, endLng, endLat) {
  const url = `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson`;
  try {
    const response = await fetch(url);
    const data = await response.json();
    if (data.code === 'Ok' && data.routes.length > 0) {
      return {
        geometry: data.routes[0].geometry,
        distance: data.routes[0].distance // Metre cinsinden
      };
    }
  } catch(e) {
    console.error("OSRM error:", e);
  }
  return null;
}

// Tamamen ücretsiz MapLibre Stil Objesi
const mapStyle = {
  version: 8,
  sources: {
    // Ücretsiz Esri Uydu Görüntüleri
    'satellite': {
      type: 'raster',
      tiles: [
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
      ],
      tileSize: 256,
      attribution: 'Esri World Imagery'
    },
    // Ücretsiz AWS Terrarium Yükseklik Verisi (3D Dağlar)
    'terrain': {
      type: 'raster-dem',
      tiles: [
        'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'
      ],
      encoding: 'terrarium',
      tileSize: 256
    }
  },
  layers: [
    {
      id: 'satellite-layer',
      type: 'raster',
      source: 'satellite',
      minzoom: 0,
      maxzoom: 22
    }
  ],
  terrain: {
    source: 'terrain',
    exaggeration: 1.5 // Dağların yükseltisini 1.5 kat vurgula
  }
};

const routeLayer = {
  id: 'route',
  type: 'line',
  source: 'route',
  layout: {
    'line-join': 'round',
    'line-cap': 'round'
  },
  paint: {
    'line-color': ['get', 'color'],
    'line-width': 4,
    'line-opacity': 0.8
  }
};

const routeSymbolLayer = {
  id: 'route-labels',
  type: 'symbol',
  source: 'route',
  layout: {
    'symbol-placement': 'line-center',
    'text-field': ['get', 'distance'],
    'text-size': 26, // Çok daha büyük punto
    'text-offset': [0, -1]
  },
  paint: {
    'text-color': '#ffffff',
    'text-halo-color': '#000000',
    'text-halo-width': 3
  }
};

export default function App() {
  const mapRef = useRef();
  const [selectedYayla, setSelectedYayla] = useState(null);
  const [hoverInfo, setHoverInfo] = useState(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [popupMode, setPopupMode] = useState(null); // 'menu', 'gallery'
  const [isRouting, setIsRouting] = useState(false);
  const [showLanding, setShowLanding] = useState(true);

  
  const [nearestDistrict, setNearestDistrict] = useState(null);
  const [distToMerkez, setDistToMerkez] = useState(null);
  const [routeData, setRouteData] = useState(null);
  const [routeLabels, setRouteLabels] = useState([]); // [ {lng, lat, text, color} ]
  const [targetDistricts, setTargetDistricts] = useState([]); // [id1, id2] highlight targets
  const [viewMode, setViewMode] = useState('map'); // 'map' or 'panel'
  const [totalDistance, setTotalDistance] = useState(null);
  
  const [orduBorder, setOrduBorder] = useState(null);

  const merkez = useMemo(() => ilceler.find(i => i.isMerkez), []);

  // Seçilen yaylayı listenin en başına taşıyan memoized liste
  const sortedYaylalar = useMemo(() => {
    if (!selectedYayla) return yaylalar;
    const others = yaylalar.filter(y => y.id !== selectedYayla.id);
    return [selectedYayla, ...others];
  }, [selectedYayla]);

  React.useEffect(() => {
    // Ordu il sınırlarını ücretsiz OpenStreetMap (Nominatim) üzerinden çekelim
    fetch('https://nominatim.openstreetmap.org/search?state=Ordu&country=Turkey&polygon_geojson=1&format=json')
      .then(res => res.json())
      .then(data => {
        if (data && data.length > 0 && data[0].geojson) {
          setOrduBorder({
            type: 'FeatureCollection',
            features: [
              {
                type: 'Feature',
                properties: {},
                geometry: data[0].geojson
              }
            ]
          });
        }
      })
      .catch(err => console.error("Sınır verisi çekilemedi:", err));
  }, []);

  // Başlangıç görünümü: Ordu genel bakış
  const initialViewState = {
    longitude: 37.60, 
    latitude: 40.75,  
    zoom: 9.5,
    pitch: 45,
    bearing: 10
  };

  const onSelectYayla = useCallback((yayla) => {
    setSelectedYayla(yayla);
    setPopupMode('menu'); // Tıklandığında önce menü açılsın
    setRouteData(null);
    
    mapRef.current?.flyTo({
      center: [yayla.longitude, yayla.latitude],
      zoom: 12,
      pitch: 65,
      bearing: 30,
      duration: 2000,
      essential: true
    });
  }, []);

  const handleCalculateRoute = async () => {
    if (!selectedYayla) return;
    setIsRouting(true);
    setPopupMode(null); // Rota çizilirken menüyü kapat
    
    // 1. Önce kuş uçuşu mesafeyle en yakın ilçeyi bul
    let minDistance = Infinity;
    let nearest = null;
    ilceler.forEach(ilce => {
      const dist = calculateDistance(selectedYayla.latitude, selectedYayla.longitude, ilce.latitude, ilce.longitude);
      if (dist < minDistance) {
        minDistance = dist;
        nearest = ilce;
      }
    });

    // 2. OSRM API'den gerçek rotaları çek
    // Yayla -> En Yakın İlçe
    const route1 = await fetchOSRMRoute(selectedYayla.longitude, selectedYayla.latitude, nearest.longitude, nearest.latitude);
    // En Yakın İlçe -> İl Merkezi (Merkez)
    const route2 = await fetchOSRMRoute(nearest.longitude, nearest.latitude, merkez.longitude, merkez.latitude);

    setIsRouting(false);

    if (route1 && route2) {
      const nearestKm = (route1.distance / 1000).toFixed(1) + ' km';
      const merkezKm = (route2.distance / 1000).toFixed(1) + ' km';
      const totalKm = ((route1.distance + route2.distance) / 1000).toFixed(1) + ' km';

      setNearestDistrict({ ...nearest, distance: nearestKm });
      setDistToMerkez(merkezKm);
      setTotalDistance(totalKm);

      // Etiketler için orta noktaları hesapla
      const getMidpoint = (geometry) => {
        const coords = geometry.coordinates;
        return coords[Math.floor(coords.length / 2)];
      };

      const mid1 = getMidpoint(route1.geometry);
      const mid2 = getMidpoint(route2.geometry);

      setRouteLabels([
        { lng: mid1[0], lat: mid1[1], text: nearestKm, color: '#f97316', ilceId: nearest.id },
        { lng: mid2[0], lat: mid2[1], text: merkezKm, color: '#ef4444', ilceId: merkez.id }
      ]);

      setTargetDistricts([nearest.id, merkez.id]);

      const routeGeojson = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: { color: '#f97316' }, // Turuncu (Yayla-İlçe)
            geometry: route1.geometry
          },
          {
            type: 'Feature',
            properties: { color: '#ef4444' }, // Kırmızı (İlçe-İl)
            geometry: route2.geometry
          }
        ]
      };
      setRouteData(routeGeojson);

      // Yolları görebilmek için kamerayı uzaklaştır
      mapRef.current?.flyTo({
        center: [selectedYayla.longitude, selectedYayla.latitude],
        zoom: 9.0,
        pitch: 45,
        bearing: 0,
        duration: 2500,
        essential: true
      });
    }
  };

  if (showLanding) {
    return (
      <div className="landing-page" style={{ backgroundImage: `url(${landingBg})` }}>
        <div className="landing-overlay"></div>
        <div className="landing-header">
          <div className="logos-left">
            <img src={tubitakLogo} alt="TÜBİTAK 4006 Logo" className="tubitak-img" />
          </div>
          <div className="school-info">
            <img src={okulLogo} alt="Alankent ÇPAL Logo" className="school-logo" />
            <div className="school-name">ALANKENT ÇOK PROGRAMLI<br/>ANADOLU LİSESİ</div>
          </div>
        </div>
        
        <div className="landing-content">
          <h1 className="main-title">ORDU YAYLA VE ORMAN <br/> CBS MODELİ</h1>
          <p className="main-subtitle">
            DOĞAL MİRASIMIZI SÜRDÜRÜLEBİLİR GELECEK İÇİN <br/>
            DİJİTALLEŞTİRİYORUZ
          </p>
          <button className="explore-btn" onClick={() => setShowLanding(false)}>
            KEŞFET
          </button>
        </div>

        <div className="landing-footer">
          <div className="footer-icons">
            <span>🌲</span>
            <span>🏔️</span>
            <span>🛰️</span>
            <span>📊</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* Sol Menü - Sidebar */}
      <div className="sidebar">
        <div className="sidebar-header">
          <button className="home-btn" onClick={() => setShowLanding(true)}>
            🏠 Anasayfaya Dön
          </button>
        </div>

        <div className="view-controls">
          <button 
            className={`view-btn ${viewMode === 'map' ? 'active' : ''}`}
            onClick={() => setViewMode('map')}
          >
            🗺️ Harita Görünümü
          </button>
          <button 
            className={`view-btn ${viewMode === 'panel' ? 'active' : ''}`}
            onClick={() => setViewMode('panel')}
          >
            📋 Panel Görünümü
          </button>
        </div>

        <h1>Ordu Yaylaları</h1>
        <div className="yayla-list">
          {sortedYaylalar.map((yayla) => (
            <React.Fragment key={yayla.id}>
              <div 
                className={`yayla-card ${selectedYayla?.id === yayla.id ? 'active' : ''}`}
                onClick={() => onSelectYayla(yayla)}
              >
                <img src={yayla.imageUrl} alt={yayla.name} />
                <div className="yayla-card-info">
                  <h3>{yayla.name}</h3>
                  <span>🏔️ {yayla.altitude}</span>
                </div>
              </div>

              {/* Seçilen Yayla Detay Paneli - Hemen Altında Açılır */}
              {selectedYayla?.id === yayla.id && (
                <div className="selected-detail-inline">
                  <div className="detail-meta">
                    <span className="detail-badge">📍 Ordu</span>
                    <span className="detail-badge">🏔️ {selectedYayla.altitude}</span>
                  </div>
                  
                  {nearestDistrict && (
                    <div className="distance-info">
                      <div className="dist-item nearest">
                        <strong>{nearestDistrict.name}:</strong> {nearestDistrict.distance}
                      </div>
                      <div className="dist-item merkez">
                        <strong>Altınordu:</strong> {distToMerkez}
                      </div>
                      <div className="dist-item total" style={{marginTop: '4px', paddingTop: '4px', borderTop: '1px solid rgba(255,255,255,0.1)'}}>
                        <strong style={{color: '#4ade80'}}>Toplam Mesafe:</strong> <span style={{color: '#4ade80', fontWeight: '900'}}>{totalDistance}</span>
                      </div>
                    </div>
                  )}
                  
                  {isRouting && (
                    <div className="distance-info" style={{background: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa', border: 'none'}}>
                      Rota Hesaplanıyor... ⏳
                    </div>
                  )}
                  <p>{selectedYayla.description}</p>
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
        )}
      </div>

      {/* 3D Harita - MapLibre */}
      <Map
        ref={mapRef}
        initialViewState={initialViewState}
        mapStyle={mapStyle} // Ücretsiz özel stilimiz
        style={{ width: '100%', height: '100%' }}
        maxPitch={85} // MapLibre'de kamerayı daha fazla eğebilmek için
      >
        <NavigationControl position="bottom-right" visualizePitch={true} />
        
        {/* Ordu İl Sınırı */}
        {orduBorder && (
          <Source id="ordu-border-source" type="geojson" data={orduBorder}>
            <Layer
              id="ordu-border-layer"
              type="line"
              paint={{
                'line-color': '#fde047', // Sarımsı bir sınır
                'line-width': 2,
                'line-opacity': 0.6,
                'line-dasharray': [2, 2]
              }}
            />
            <Layer
              id="ordu-border-fill"
              type="fill"
              paint={{
                'fill-color': '#fde047',
                'fill-opacity': 0.05
              }}
            />
          </Source>
        )}

        {/* Rota Çizgileri */}
        {routeData && (
          <Source id="route-source" type="geojson" data={routeData}>
            <Layer {...routeLayer} />
          </Source>
        )}

        {/* KM Etiketleri - Haritadan kaldırıldı, ilçe isminin altına taşındı */}

        {/* İlçe İşaretçileri - Rota çizildiğinde sadece hedef ilçeleri göster */}
        {ilceler
          .filter(ilce => targetDistricts.length === 0 || targetDistricts.includes(ilce.id))
          .map((ilce) => {
            // Bu ilçe için mesafe etiketini bul
            const label = routeLabels.find(l => l.ilceId === ilce.id);

            return (
              <Marker 
                key={`ilce-${ilce.id}`}
                longitude={ilce.longitude} 
                latitude={ilce.latitude}
                anchor="bottom"
              >
                <div className={`ilce-marker ${ilce.isMerkez ? 'merkez' : ''} ${targetDistricts.includes(ilce.id) ? 'highlighted' : ''}`}>
                  <span className="ilce-icon">🏛️</span>
                  <div className="ilce-label-container">
                    <span className="ilce-name">{ilce.name}</span>
                    {label && (
                      <span className="ilce-distance-tag" style={{ color: label.color }}>
                        {label.text}
                      </span>
                    )}
                  </div>
                </div>
              </Marker>
            );
          })}

        {/* Yayla İşaretçileri (Markers) */}
        {(!selectedYayla ? yaylalar : [selectedYayla]).map((yayla) => (
          <Marker 
            key={`yayla-${yayla.id}`}
            longitude={yayla.longitude} 
            latitude={yayla.latitude}
            anchor="center"
            offset={[0, 0]} // Yolun tam başladığı noktada durması için offset sıfırlandı
            onClick={(e) => {
              e.originalEvent.stopPropagation();
              onSelectYayla(yayla);
            }}
          >
            <div 
              className={`custom-marker ${selectedYayla?.id === yayla.id ? 'active' : ''}`}
              onMouseEnter={() => setHoverInfo(yayla)}
              onMouseLeave={() => setHoverInfo(null)}
            >
              🏔️
            </div>
          </Marker>
        ))}

        {/* Hover olduğunda isim gösterimi */}
        {hoverInfo && (
          <Popup
            longitude={hoverInfo.longitude}
            latitude={hoverInfo.latitude}
            offset={[0, -35]}
            closeButton={false}
            closeOnClick={false}
            anchor="bottom"
          >
            <div style={{ fontWeight: 'bold', color: 'black' }}>{hoverInfo.name}</div>
          </Popup>
        )}

        {/* Seçilen Yayla Menü Popup */}
        {selectedYayla && popupMode === 'menu' && (
          <Popup
            longitude={selectedYayla.longitude}
            latitude={selectedYayla.latitude}
            offset={[0, -35]}
            closeButton={true}
            onClose={() => setPopupMode(null)}
            anchor="bottom"
            className="menu-popup"
          >
            <div className="menu-container">
              <div className="menu-title">{selectedYayla.name}</div>
              <button 
                className="menu-button" 
                onClick={(e) => { e.stopPropagation(); setPopupMode('gallery'); setCurrentImageIndex(0); }}
              >
                📸 Fotoğraflar
              </button>
              <button 
                className="menu-button" 
                onClick={(e) => { e.stopPropagation(); handleCalculateRoute(); }}
              >
                🛣️ Uzaklık (Rota Çiz)
              </button>
              <button className="menu-button disabled">⛺ Kamp Alanları</button>
            </div>
          </Popup>
        )}

        {/* Full-Screen Gallery Modal */}
        {selectedYayla && popupMode === 'gallery' && (
          <div className="gallery-modal" onClick={() => setPopupMode('menu')}>
            <div className="gallery-content" onClick={e => e.stopPropagation()}>
              <button className="close-gallery" onClick={() => setPopupMode('menu')}>✕</button>
              
              <div className="gallery-main-view">
                <button className="nav-btn prev" onClick={() => setCurrentImageIndex(prev => prev === 0 ? selectedYayla.gallery.length - 1 : prev - 1)}>❮</button>
                <img src={selectedYayla.gallery[currentImageIndex]} alt={selectedYayla.name} className="main-image" />
                <button className="nav-btn next" onClick={() => setCurrentImageIndex(prev => (prev + 1) % selectedYayla.gallery.length)}>❯</button>
              </div>

              <div className="gallery-bottom-strip">
                <div className="gallery-title">
                  <h2>{selectedYayla.name}</h2>
                  <span>{currentImageIndex + 1} / {selectedYayla.gallery.length}</span>
                </div>
                <div className="gallery-thumbs">
                  {selectedYayla.gallery.map((img, idx) => (
                    <img 
                      key={idx} 
                      src={img} 
                      className={idx === currentImageIndex ? 'active' : ''}
                      onClick={() => setCurrentImageIndex(idx)}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </Map>
    </div>
  );
}
