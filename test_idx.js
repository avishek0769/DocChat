const fs = require('fs');
let code = fs.readFileSync('src/pages/Dashboard.tsx', 'utf8');
const startMarker = '{/* API Key Toggle and Select */}';
const endMarker = '{/* Modal Footer */}';
const startIdx = code.indexOf(startMarker);
const endIdx = code.indexOf(endMarker, startIdx);
console.log("startIdx:", startIdx, "endIdx:", endIdx);
