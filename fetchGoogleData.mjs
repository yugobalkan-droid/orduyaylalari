import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Kullanıcının Google Maps API Anahtarı
const API_KEY = "AIzaSyBN9CqI0lwmXzluOxWkYaXzOplgg9yWafM";

const yaylaIsimleri = [
  "Perşembe Yaylası",
  "Çambaşı Yaylası",
  "Keyfalan Yaylası",
  "Argın Yaylası",
  "Alankent Soğuk Obası",
  "Korgan Yaylası",
  "Topçam Yaylası",
  "Düzoba Yaylası",
  "Turnalık Yaylası",
  "Toygar Yaylası",
  "Yeşilce Yaylası",
  "Çukuralan Yaylası",
  "Zile Yaylası",
  "Göndeliç Yaylası",
  "Kürtünlü Yaylası"
];

// Fallback descriptions
const fallbackDescriptions = {
  "Perşembe Yaylası": "Ordu'nun Aybastı ilçesinde yer alan, menderesleriyle ünlü, doğal güzellikleri ve şenlikleriyle meşhur yayla.",
  "Çambaşı Yaylası": "Kabadüz ilçesi sınırlarında olan, Türkiye'nin en geniş yüzölçümüne sahip ve kış sporları merkezi bulunan yaylası.",
  "Keyfalan Yaylası": "Mesudiye ilçesinde bulunan, çam ormanlarıyla kaplı, bol oksijenli ve temiz havasıyla dikkat çeken yayla.",
  "Argın Yaylası": "Akkuş ilçesinde yer alan, bozulmamış doğası ve yöresel kültürü ile öne çıkan sakin bir yayla.",
  "Alankent Soğuk Obası": "Kabataş ilçesinde yer alan, adını serin ve temiz havasından alan, doğal bitki örtüsüyle büyüleyen yayla.",
  "Korgan Yaylası": "Korgan ilçesinde bulunan, her yıl düzenlenen yayla şenlikleri ile ünlü, geniş çayırlarıyla bilinen bir bölge.",
  "Topçam Yaylası": "Mesudiye sınırları içinde, çam ağaçlarının arasında yer alan sessiz ve huzurlu bir dinlenme noktası.",
  "Düzoba Yaylası": "Kumru ilçesinde konumlanan, geniş obaları ve hayvancılık kültürünün canlı olduğu şirin yayla.",
  "Turnalık Yaylası": "Kabadüz ilçesindeki Çambaşı yaylasına giderken uğranılan, doğasıyla büyüleyen eşsiz bir mola noktası.",
  "Toygar Yaylası": "Aybastı yöresinde yer alan, Perşembe yaylasına yakın konumuyla dikkat çeken güzel bir oba.",
  "Yeşilce Yaylası": "Mesudiye ilçesinde bulunan, yemyeşil doğası ve geleneksel evleriyle ön plana çıkan bir bölge.",
  "Çukuralan Yaylası": "Mesudiye'nin yüksek rakımlı, tertemiz havası ve soğuk su kaynaklarıyla bilinen yaylalarından.",
  "Zile Yaylası": "Mesudiye ilçesinde, uçsuz bucaksız çayırlarıyla doğa fotoğrafçıları için ideal bir yayla.",
  "Göndeliç Yaylası": "Kabadüz'de Çambaşı'na çok yakın konumda olan, doğallığını korumuş sakin bir yayla.",
  "Kürtünlü Yaylası": "Korgan ilçesine bağlı, yayla turizmi potansiyeli yüksek, etkileyici manzaralara sahip bir oba."
};

async function fetchGoogleData() {
  console.log("🚀 Google Maps'ten yayla verileri çekiliyor. Lütfen bekleyin...");
  const resultData = [];
  let idCounter = 1;

  for (const name of yaylaIsimleri) {
    console.log(`\n🔍 Aranıyor: ${name} (Ordu)`);
    const query = encodeURIComponent(`${name} Ordu`);
    const searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${query}&key=${API_KEY}`;
    
    try {
      const response = await fetch(searchUrl);
      const data = await response.json();
      
      if (data.status !== 'OK') {
        console.error(`⚠️ API Hatası (${name}): ${data.status} - ${data.error_message || ''}`);
      }

      if (data.results && data.results.length > 0) {
        const place = data.results[0];
        const lat = place.geometry.location.lat;
        const lng = place.geometry.location.lng;
        
        let gallery = [];
        if (place.photos && place.photos.length > 0) {
          // En fazla 4 gerçek fotoğraf al
          const numPhotos = Math.min(place.photos.length, 4);
          for (let i = 0; i < numPhotos; i++) {
            const photoRef = place.photos[i].photo_reference;
            gallery.push(`https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${photoRef}&key=${API_KEY}`);
          }
        } else {
           // Eğer fotoğraf yoksa Unsplash'ten placeholder atalım
           gallery.push("https://images.unsplash.com/photo-1542317805-4e782e4644da?auto=format&fit=crop&w=800&q=80");
        }
        
        const imageUrl = gallery[0]; // Ana fotoğraf galerinin ilki olsun
        
        resultData.push({
          id: idCounter++,
          name: name,
          description: fallbackDescriptions[name] || "Ordu'nun eşsiz doğası...",
          latitude: lat,
          longitude: lng,
          altitude: "1.500 m", // Google Text Search rakım dönmüyor, standart bir ibare koyuyoruz
          imageUrl: imageUrl,
          gallery: gallery
        });
        
        console.log(`✅ Bulundu! Koordinatlar: ${lat}, ${lng} | Fotoğraf Sayısı: ${gallery.length}`);
      } else {
        console.log(`❌ Bulunamadı: ${name}. Varsayılan eski koordinatlar kullanılacak.`);
        // Eğer Google'da bulamazsak eski veriyi kaybetmemek için varsayılan bir yapı ekleyelim
        resultData.push({
          id: idCounter++,
          name: name,
          description: fallbackDescriptions[name] || "Ordu'nun eşsiz doğası...",
          latitude: 40.75,
          longitude: 37.50,
          altitude: "1.500 m",
          imageUrl: "https://images.unsplash.com/photo-1542317805-4e782e4644da?auto=format&fit=crop&w=800&q=80",
          gallery: [
            "https://images.unsplash.com/photo-1542317805-4e782e4644da?auto=format&fit=crop&w=800&q=80"
          ]
        });
      }
    } catch (err) {
      console.error(`🚨 Hata oluştu: ${name}`, err.message);
    }
    
    // API limitlerine (Rate Limit) takılmamak için 500ms bekleyelim
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  // JSON objesini Javascript export formatına çevirelim
  const fileContent = `export const yaylalar = ${JSON.stringify(resultData, null, 2)};\n`;
  
  const outputPath = path.join(__dirname, 'src', 'data', 'yaylalar.js');
  fs.writeFileSync(outputPath, fileContent, 'utf-8');
  console.log(`\n🎉 İşlem başarıyla tamamlandı! ${resultData.length} yaylanın verisi güncellendi: ${outputPath}`);
}

fetchGoogleData();
