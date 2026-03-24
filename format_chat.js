const fs = require('fs');
let code = fs.readFileSync('src/pages/ChatPage.tsx', 'utf8');

// 1. Add tokens to MOCK_DOCS
code = code.replace(
    /size: "1\.2 MB",/,
    'size: "1.2 MB",\n    tokens: "845k",'
);

// 2. Update Data Processed to Tokens Used
code = code.replace(
    /Data Processed/g,
    'Tokens Used'
);

code = code.replace(
    /\{MOCK_DOCS\.size\}/g,
    '{MOCK_DOCS.tokens}'
);

// 3. Beautify the dropdown
const oldDropdown = `<div className="hidden sm:flex items-center gap-2 mr-2">
                                <span className="text-xs text-gray-500 font-medium">Model:</span>
                                <select 
                                    value={selectedModel}
                                    onChange={(e) => setSelectedModel(e.target.value)}
                                    className="bg-[#1a1a24] border border-white/10 rounded-lg px-2 py-1 text-xs text-gray-300 focus:outline-none focus:border-accent-blue/50 focus:ring-1 focus:ring-accent-blue/50"
                                >
                                    {availableModels.map(m => (
                                        <option key={m} value={m}>{m}</option>
                                    ))}
                                </select>
                            </div>`;

const newDropdown = `<div className="hidden sm:flex items-center gap-2 mr-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg pl-3 pr-1 py-1 focus-within:border-accent-blue/50 focus-within:ring-1 focus-within:ring-accent-blue/50 transition-all cursor-pointer">
                                <span className="text-xs text-gray-400 font-medium tracking-wide">Model</span>
                                <div className="w-px h-3.5 bg-white/20"></div>
                                <select 
                                    value={selectedModel}
                                    onChange={(e) => setSelectedModel(e.target.value)}
                                    className="bg-transparent border-none text-xs font-medium text-gray-200 focus:outline-none cursor-pointer appearance-none pr-5 py-0.5 focus:ring-0"
                                    style={{
                                        backgroundImage: "url(\\\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%239CA3AF'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E\\\")",
                                        backgroundPosition: "right center",
                                        backgroundRepeat: "no-repeat",
                                        backgroundSize: "14px"
                                    }}
                                >
                                    {availableModels.map(m => (
                                        <option key={m} value={m} className="bg-[#1a1a24] text-gray-200 py-1">{m}</option>
                                    ))}
                                </select>
                            </div>`;

code = code.replace(oldDropdown, newDropdown);

fs.writeFileSync('src/pages/ChatPage.tsx', code);
console.log('Modifications applied!');
