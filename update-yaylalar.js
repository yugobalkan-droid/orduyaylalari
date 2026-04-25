const fs = require('fs');

const file = 'c:\\Users\\HARUN BERNA MUTLU\\yayla harita proje\\ordu-3d-harita\\src\\data\\yaylalar.js';
let content = fs.readFileSync(file, 'utf8');

// The real photos we will use as secondary photos
const realPhotos = [
  "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Ordu_per%C5%9Fembe_yaylas%C4%B1.jpg/800px-Ordu_per%C5%9Fembe_yaylas%C4%B1.jpg",
  "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a2/Per%C5%9Fembe_Yaylas%C4%B1_Menderesleri.jpg/800px-Per%C5%9Fembe_Yaylas%C4%B1_Menderesleri.jpg",
  "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4b/%C3%87amba%C5%9F%C4%B1_Yaylas%C4%B1.jpg/800px-%C3%87amba%C5%9F%C4%B1_Yaylas%C4%B1.jpg"
];

// Replace all galleries with the item's own imageUrl + the real photos
// We need to parse it or use regex. Since it's a JS file, we can require it, modify, and rewrite.

const data = content.match(/export const yaylalar = (\[[\s\S]*\]);/);
if (data) {
  let yaylalar = eval(data[1]);
  yaylalar = yaylalar.map(y => {
    // If it doesn't have an imageUrl or if it's the unsplash one, let's keep the google maps one
    // The current file has the google maps URL in 'imageUrl' for almost all of them, except maybe Topçam which we changed.
    
    let gallery = [];
    if (y.imageUrl && y.imageUrl.includes('maps.googleapis')) {
      gallery.push(y.imageUrl);
    } else if (y.imageUrl) {
      gallery.push(y.imageUrl);
    }
    
    // Add real photos
    gallery.push(realPhotos[0]);
    gallery.push(realPhotos[1]);
    gallery.push(realPhotos[2]);
    
    return { ...y, gallery };
  });

  const newContent = "export const yaylalar = " + JSON.stringify(yaylalar, null, 2) + ";\n";
  fs.writeFileSync(file, newContent, 'utf8');
  console.log('Updated yaylalar.js');
}
