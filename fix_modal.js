const fs = require('fs');
let code = fs.readFileSync('src/pages/Dashboard.tsx', 'utf8');

const s1 = code.indexOf('{/* API Key Toggle and Select */}');
const s2 = code.indexOf('{/* Modal Footer */}', s1);

if (s1 !== -1 && s2 !== -1) {
    const linesBefore = code.substring(0, code.lastIndexOf('\n', s1));
    const linesAfter = code.substring(code.lastIndexOf('\n', s2));

    const replacementUI = `              {/* Configuration */}
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
                      {apiKeys.flatMap(k => PROVIDER_MODELS[k.provider] || []).map(model => (
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
            </div>`;
            
    code = linesBefore + '\n' + replacementUI + linesAfter;
}

let lines = code.split('\n');
let filtered = [];
let skipFunc = false;

for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    
    // vars
    if (l.includes('const [useOwnKey, setUseOwnKey]')) continue;
    if (l.includes('const [selectedKeyId, setSelectedKeyId]')) continue;
    if (l.includes('const [newKeyName, setNewKeyName]')) continue;
    if (l.includes('const [newKeyValue, setNewKeyValue]')) continue;
    if (l.includes('const [selectedProvider, setSelectedProvider]')) continue;
    if (l.includes('const [showKeyValue, setShowKeyValue]')) continue;
    if (l.includes('// Inline new key form')) continue;
    
    // handleCreateChat stuff
    if (l.includes('setUseOwnKey(false)')) continue;
    if (l.includes('setSelectedKeyId("")')) continue;
    
    // Functions auto detect
    if (l.includes('// Auto-detect provider based on key prefix')) {
        skipFunc = true;
        continue;
    }
    if (skipFunc && l.includes('const handleCreateChat')) {
        skipFunc = false;
        // don't skip the actual line of handleCreateChat
    }
    if (skipFunc) continue;

    // fix isStartDisabled
    if (l.includes('const isStartDisabled =') && lines[i+1] && lines[i+1].includes('!chatUrl || (useOwnKey')) {
        filtered.push("    const isStartDisabled = !chatUrl || (apiKeys.length > 0 && !selectedModel);");
        i++; // skip next line
        continue;
    }

    filtered.push(l);
}

fs.writeFileSync('src/pages/Dashboard.tsx', filtered.join('\n'));
console.log("Replaced stuff successfully.");
