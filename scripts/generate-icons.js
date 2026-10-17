const fs = require('fs');
const path = require('path');

const iconsDir = path.join(__dirname, '..', 'public', 'icons');
console.log('Icons are managed in:', iconsDir);
console.log('Available icons: source-icon.jpg, icon-512.png, icon-192.png, icon-maskable.png, icon.svg, favicon.png');
