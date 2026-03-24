const fs = require('fs');
let content = fs.readFileSync('src/pages/Dashboard.tsx', 'utf8');

const startStr = '                            {/* API Key Toggle and Select */}';
const endStr = '                        {/* Modal Footer */}';

const startIndex = content.indexOf(startStr);
const endIndex = content.indexOf(endStr);

if (startIndex !== -1 && endIndex !== -1) {
    const stringReplace = content.substring(startIndex, endIndex);

    const newStr = `                            {/* Model Selection */}
                            <div className="pt-4 border-t border-white/5 space-y-4">
                                {apiKeys.length > 0 ? (
                                    <div className="space-y-1.5">
                                        <label className="text-sm font-medium text-gray-300">
                                            Select Model{" "}
                                        </label>
                                        <select
                                            value={selectedModel}
                                            onChange={(e) => setSelectedModel(e.target.value)}
                                            className="w-full bg-[#111] border border-white/10 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-accent-blue/50 appearance-none"
                                        >
                                            <option value="" disabled>Select a model...</option>
                                            {apiKeys.flatMap(key => PROVIDER_MODELS[key.provider] || []).map(m => (
                                                <option key={m} value={m}>{m}</option>
                                            ))}
                                        </select>
                                    </div>
                                ) : (
                                    <div className="p-3 bg-white/5 border border-white/10 rounded-xl space-y-2">
                                        <p className="text-sm text-gray-300">
                                            Default Hosted Model
                                        </p>
                                        <p className="text-xs text-gray-400 leading-relaxed">
                                            Note: You can add your own API key in Settings for using more models and waive off usage limits.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>

`;

    content = content.substring(0, startIndex) + newStr + content.substring(endIndex);
    fs.writeFileSync('src/pages/Dashboard.tsx', content);
    console.log('Replaced block successfully');
} else {
    console.log('Start or end string not found');
}
