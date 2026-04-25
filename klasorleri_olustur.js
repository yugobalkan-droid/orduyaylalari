import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const yaylalar = [
  'persembe', 'cambasi', 'keyfalan', 'argin', 'alankent', 
  'korgan', 'topcam', 'duzoba', 'turnalik', 'toygar', 
  'yesilce', 'cukuralan', 'zile', 'gondelic', 'kurtunlu'
];

const baseDir = path.join(__dirname, 'public', 'yaylalar');

// Ana klasoru olustur
if (!fs.existsSync(baseDir)) {
  fs.mkdirSync(baseDir, { recursive: true });
}

// Her yayla icin alt klasorleri olustur
yaylalar.forEach(y => {
  const dir = path.join(baseDir, y);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  // Bilgi mesaji birak
  fs.writeFileSync(
    path.join(dir, 'bilgi.txt'), 
    'Bu klasore 1.jpg, 2.jpg, 3.jpg, 4.jpg isimleriyle tam 4 adet resim atin. Sisteme otomatik yansiyacaktir.'
  );
});

console.log("-------------------------------------------------");
console.log("✅ BASARILI! public/yaylalar/ icinde tum klasorler olusturuldu.");
console.log("Lutfen kendi sectiginiz 100% gercek fotoğraflari");
console.log("ilgili klasorlere (orn: public/yaylalar/persembe/1.jpg) atin.");
console.log("-------------------------------------------------");
