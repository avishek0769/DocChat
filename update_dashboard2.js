const fs = require('fs');
let code = fs.readFileSync('src/pages/Dashboard.tsx', 'utf8');

// Wipe states
code = code.replace(/    const \[useOwnKey, setUseOwnKey\] = useState\(false\);\n/g, '');
code = code.replace(/    const \[selectedKeyId, setSelectedKeyId\] = useState\(""\);\n/g, '');
code = code.replace(/    \/\/ Inline new key form\n/g, '');
code = code.replace(/    const \[newKeyName, setNewKeyName\] = useState\(""\);\n/g, '');
code = code.replace(/    const \[newKeyValue, setNewKeyValue\] = useState\(""\);\n/g, '');
code = code.replace(/    const \[selectedProvider, setSelectedProvider\] = useState\(""\);\n/g, '');
code = code.replace(/    const \[showKeyValue, setShowKeyValue\] = useState\(false\);\n/g, '');

// Wipe functions
code = code.replace(/    \/\/ Auto-detect provider based on key prefix\n    const handleKeyChange = \([\s\S]*?    };\n\n/g, '');
code = code.replace(/    const handleProviderChange = \([\s\S]*?    };\n\n/g, '');
code = code.replace(/    const handleSaveInlineKey = \(\) => \{[\s\S]*?    };\n\n/g, '');

// Reset uses in chat create
code = code.replace(/        setUseOwnKey\(false\);\n/g, '');
code = code.replace(/        setSelectedKeyId\(""\);\n/g, '');

// Update disable logic
code = code.replace(/    const isStartDisabled =[\s\S]*?!chatUrl \|\| \(useOwnKey && \(apiKeys\.length === 0 \|\| !selectedKeyId\)\);/g, '    const isStartDisabled = !chatUrl || (apiKeys.length > 0 && !selectedModel);');

// Replace JSX
const startMarker = '{/* API Key Toggle and Select */}';
const endMarker = '{/* Modal Footer */}';
const startIdx = code.indexOf(startMarker);
const endIdx = code.indexOf(endMarker, startIdx); // FIXED

if (startIdx !== -1 && endIdx !== -1) {
    const before = code.substring(0, startIdx);
    const after = code.substring(endIdx);

    const replacement = `{/* Configuration */}
                            <div className="pt-2 border-t border-white/5 space-y-4">
                                {apiKeys.length > 0 ? (
                                    <div className="space-y-1.5">
                                        <label className="text-sm font-medium text-gray-300">
                                            Model <span className="text-red-400">*</span>
                                        </label>
                                        <select
                                            value={selectedModel}
                                            onChange={(e) => setSelectedModel(e.target.value)}
                                            className="w-full bg-[#111] border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-accent-blue/50"
                                        >
                                            <option value="" disabled>Select a model...</option>
                                            {Array.from(new Set(apiKeys.flatMap(k => PROVIDER_MODELS[k.provider] || []))).map(model => (
                                                <option key={model} value={model}>{model}</option>
                                            ))}
                                        </select>
                                    </div>
                                ) : (
                                    <div className="p-3 bg-white/5 border border-white/10 rounded-xl">
                                        <p className="text-sm text-gray-300 font-medium">Default Hosted Model</p>
                                        <p className="text-xs text-gray-500 mt-1">Note: You can add your own API key in Settings to choose other models and waive off usage limits.</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        `;

    code = before + replacement + after;
}

fs.writeFileSync('src/pages/Dashboard.tsx', code);
