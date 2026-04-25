import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataFilePath = path.join(__dirname, 'src', 'data', 'yaylalar.js');
const yaylalarDir = path.join(__dirname, 'public', 'yaylalar');

// yaylalar.js dosyasini oku
let fileContent = fs.readFileSync(dataFilePath, 'utf-8');

// module'den array'i parse etmemiz gerekiyor, fakat bunu regex ile veya yeni dosya uretip degistirebiliriz
// Bunun yerine yaylalar listesini bir nesne olarak dinamik alalim ve guncelleyelim
const regex = /export const yaylalar = (\[[\s\S]*?\]);/;
const match = fileContent.match(regex);

if (match && match[1]) {
  try {
    // eval guvenli degildir normalde ama kendi dosyamiz oldugu icin kullanabiliriz
    let yaylalarData = eval(match[1]);

    const validExtensions = ['.jpg', '.jpeg', '.png', '.webp'];

    yaylalarData = yaylalarData.map(yayla => {
      // Klasor adini URL'den veya name'den bulalim
      // Ornek imageUrl: "/yaylalar/persembe/1.jpg", buradan klasor adi "persembe"
      const folderMatch = yayla.imageUrl.match(/\/yaylalar\/([^/]+)\//);
      if (!folderMatch) return yayla;

      const folderName = folderMatch[1];
      const folderPath = path.join(yaylalarDir, folderName);

      if (fs.existsSync(folderPath)) {
        const files = fs.readdirSync(folderPath);
        // Sadece gecerli resim uzantilarina sahip dosyalari al
        let imageFiles = files.filter(file => validExtensions.includes(path.extname(file).toLowerCase()));
        
        // Sayisal olarak sirala (1.jpg, 2.png vs.)
        imageFiles.sort((a, b) => {
          const numA = parseInt(a.split('.')[0]) || 0;
          const numB = parseInt(b.split('.')[0]) || 0;
          return numA - numB;
        });

        if (imageFiles.length > 0) {
          yayla.imageUrl = `/yaylalar/${folderName}/${imageFiles[0]}`;
          yayla.gallery = imageFiles.map(img => `/yaylalar/${folderName}/${img}`);
        } else {
          yayla.imageUrl = `/yaylalar/${folderName}/1.jpg`; // varsayilan
          yayla.gallery = [`/yaylalar/${folderName}/1.jpg`, `/yaylalar/${folderName}/2.jpg`, `/yaylalar/${folderName}/3.jpg`, `/yaylalar/${folderName}/4.jpg`];
        }
      }
      return yayla;
    });

    // Yeni veriyi JSON'a cevirip dosyaya yaz
    const newDataString = JSON.stringify(yaylalarData, null, 2);
    const newContent = fileContent.replace(regex, `export const yaylalar = ${newDataString};`);
    
    fs.writeFileSync(dataFilePath, newContent, 'utf-8');
    console.log("✅ BASARILI! src/data/yaylalar.js dosyasi mevcut resimlerin uzantilarina gore guncellendi.");

  } catch (err) {
    console.error("Hata:", err);
  }
} else {
  console.log("yaylalar listesi yaylalar.js icinde bulunamadi.");
}
