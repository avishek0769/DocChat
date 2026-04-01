import { useEffect, useState } from "react";
import { Sidebar } from "../components/Sidebar";
import {
    Key,
    Trash2,
    AlertCircle,
    Eye,
    EyeOff,
    Plus,
    Network,
} from "lucide-react";
import {
    createApiKey,
    deleteApiKey,
    getApiKeyCount,
    getApiKeys,
    type ApiKeyItem,
    type Provider,
} from "../lib/api";

interface ApiKey {
    id: string;
    name: string;
    keyMasked: string;
    provider: string;
    createdAt?: string;
    models?: string[];
}

const PROVIDERS: Array<{ label: string; value: Provider }> = [
    { label: "OpenAI", value: "OPENAI" },
    { label: "Anthropic", value: "ANTHROPIC" },
    { label: "xAI", value: "XAI" },
    { label: "Google", value: "GOOGLE" },
    { label: "OpenRouter", value: "OPENROUTER" },
];

const PROVIDER_LABEL: Record<Provider, string> = {
    OPENAI: "OpenAI",
    ANTHROPIC: "Anthropic",
    GOOGLE: "Google",
    XAI: "xAI",
    OPENROUTER: "OpenRouter",
};

const toUiApiKey = (key: ApiKeyItem): ApiKey => ({
    id: key.id,
    name: key.name,
    keyMasked: key.formattedKey,
    provider: PROVIDER_LABEL[key.provider] || key.provider,
    createdAt: key.createdAt,
    models: key.models,
});

const Settings = () => {
    const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
    const [apiKeyCount, setApiKeyCount] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState("");

    const [newKeyName, setNewKeyName] = useState("");
    const [newKeyValue, setNewKeyValue] = useState("");
    const [selectedProvider, setSelectedProvider] = useState<Provider | "">("");
    const [showKey, setShowKey] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const loadApiKeys = async () => {
        setIsLoading(true);
        setError("");
        try {
            const [listData, countData] = await Promise.all([
                getApiKeys(),
                getApiKeyCount(),
            ]);
            setApiKeys((listData.apiKeys || []).map(toUiApiKey));
            setApiKeyCount(countData.count || 0);
        } catch (err) {
            setError(
                err instanceof Error ? err.message : "Failed to load API keys.",
            );
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadApiKeys();
    }, []);

    // Auto-detect provider based on key prefix
    const handleKeyChange = (val: string) => {
        setNewKeyValue(val);
        if (!val) return;

        let detected = "";
        if (val.startsWith("sk-ant")) detected = "ANTHROPIC";
        else if (val.startsWith("sk-proj-") || val.startsWith("sk-"))
            detected = "OPENAI";
        else if (val.startsWith("xai-")) detected = "XAI";
        else if (val.startsWith("AIza")) detected = "GOOGLE";

        if (
            detected &&
            detected !== selectedProvider &&
            detected in PROVIDER_LABEL
        ) {
            setSelectedProvider(detected as Provider);
        }
    };

    const handleProviderChange = (val: string) => {
        setSelectedProvider((val as Provider) || "");
    };

    const handleSaveKey = async () => {
        if (!newKeyName || !newKeyValue || !selectedProvider) return;

        setIsSaving(true);
        setError("");
        try {
            await createApiKey({
                key: newKeyValue,
                name: newKeyName,
                provider: selectedProvider,
            });
            setNewKeyName("");
            setNewKeyValue("");
            setSelectedProvider("");
            setShowKey(false);
            await loadApiKeys();
        } catch (err) {
            setError(
                err instanceof Error ? err.message : "Failed to save API key.",
            );
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteKey = async (id: string) => {
        setError("");
        try {
            await deleteApiKey(id);
            await loadApiKeys();
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Failed to delete API key.",
            );
        }
    };

    return (
        <div className="min-h-screen bg-[#0b0b0f] text-gray-50 flex font-sans selection:bg-accent-purple/30">
            <Sidebar />

            <main className="flex-1 p-8 lg:p-12 overflow-y-auto w-full">
                <div className="max-w-4xl mx-auto space-y-12">
                    <header>
                        <h1 className="text-3xl font-bold mb-2">Settings</h1>
                        <p className="text-gray-400 text-sm">
                            Configure your AI preferences and API access.
                        </p>
                    </header>

                    {error && (
                        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                            {error}
                        </div>
                    )}

                    <div>
                        <div className="flex items-start gap-3 text-sm text-gray-400 bg-accent-blue/5 p-4 rounded-xl border border-accent-blue/10">
                            <AlertCircle className="w-4 h-4 text-accent-blue shrink-0 mt-1.5" />
                            <div className="space-y-1">
                                <p className="font-medium text-gray-200 text-lg">
                                    Security & Transparency
                                </p>
                                <p className="leading-relaxed">
                                    Your API keys are stored using
                                    industry-standard
                                    <strong className="text-gray-300">
                                        {" "}
                                        encryption
                                    </strong>{" "}
                                    to ensure they are protected within our
                                    database. To maintain full transparency, our
                                    entire codebase is open-sourced, allowing
                                    you to independently verify our security
                                    practices and how your data is handled.
                                </p>
                            </div>
                        </div>
                    </div>

                    <section className="space-y-6">
                        <div className="flex items-center gap-3 border-b border-white/10 pb-4">
                            <Key className="w-6 h-6 text-accent-blue" />
                            <h2 className="text-xl font-semibold text-gray-200">
                                API Keys Configuration
                            </h2>
                        </div>

                        {/* Add New Key Form */}
                        <div className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-6 relative overflow-hidden flex flex-col">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="w-10 h-10 rounded-lg bg-accent-blue/10 flex items-center justify-center border border-accent-blue/20 text-accent-blue">
                                    <Network className="w-5 h-5" />
                                </div>
                                <h3 className="text-lg font-medium text-gray-200">
                                    Add New Key
                                </h3>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 relative z-10">
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium text-gray-400">
                                        Key Name
                                    </label>
                                    <input
                                        type="text"
                                        value={newKeyName}
                                        onChange={(e) =>
                                            setNewKeyName(e.target.value)
                                        }
                                        placeholder="e.g. Production OpenAI Key"
                                        className="w-full bg-[#111] border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-accent-blue/50"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="block text-sm font-medium text-gray-400">
                                        API Key
                                    </label>
                                    <div className="relative flex items-center">
                                        <input
                                            type={showKey ? "text" : "password"}
                                            value={newKeyValue}
                                            onChange={(e) =>
                                                handleKeyChange(e.target.value)
                                            }
                                            placeholder="sk-... (Auto-detects provider)"
                                            className="w-full bg-[#111] border border-white/10 rounded-lg pl-4 pr-12 py-2.5 text-white focus:outline-none focus:border-accent-blue/50 font-mono text-sm"
                                        />
                                        <button
                                            onClick={() => setShowKey(!showKey)}
                                            className="absolute right-4 text-gray-500 hover:text-white transition-colors"
                                        >
                                            {showKey ? (
                                                <EyeOff className="w-4 h-4" />
                                            ) : (
                                                <Eye className="w-4 h-4" />
                                            )}
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium text-gray-400">
                                        Provider
                                    </label>
                                    <select
                                        value={selectedProvider}
                                        onChange={(e) =>
                                            handleProviderChange(e.target.value)
                                        }
                                        className="w-full bg-[#111] border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-accent-blue/50 appearance-none"
                                    >
                                        <option value="">
                                            Select a provider...
                                        </option>
                                        {PROVIDERS.map((p) => (
                                            <option
                                                key={p.value}
                                                value={p.value}
                                            >
                                                {p.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="pt-4 border-t border-white/5 mt-4 relative z-10 flex justify-end">
                                <button
                                    onClick={handleSaveKey}
                                    disabled={
                                        isSaving ||
                                        !newKeyName ||
                                        !newKeyValue ||
                                        !selectedProvider
                                    }
                                    className="bg-accent-blue hover:bg-blue-600 disabled:opacity-50 disabled:bg-gray-700 disabled:cursor-not-allowed text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 justify-center shrink-0 w-full sm:w-auto"
                                >
                                    <Plus className="w-4 h-4" />
                                    {isSaving
                                        ? "Saving..."
                                        : "Save Key Configuration"}
                                </button>
                            </div>
                        </div>

                        {/* Saved Keys List */}
                        <div className="space-y-3 mt-8">
                            <h3 className="text-md font-medium text-gray-300 flex items-center gap-2 mb-4">
                                Saved Keys
                                <span className="px-2 py-0.5 rounded-full bg-white/10 text-xs font-mono">
                                    {apiKeyCount}
                                </span>
                            </h3>

                            {isLoading ? (
                                <div className="p-8 text-center bg-white/1 border border-white/5 border-dashed rounded-xl text-sm text-gray-400">
                                    Loading API keys...
                                </div>
                            ) : apiKeys.length > 0 ? (
                                apiKeys.map((key) => (
                                    <div
                                        key={key.id}
                                        className="flex flex-col sm:flex-row sm:items-center justify-between bg-white/2 border border-white/5 rounded-xl p-4 gap-4"
                                    >
                                        <div className="flex flex-col gap-1">
                                            <div className="flex items-center gap-2">
                                                <h4 className="font-medium text-gray-200">
                                                    {key.name}
                                                </h4>
                                                <span className="px-2 py-0.5 rounded text-xs font-medium bg-white/10 text-accent-blue">
                                                    {key.provider}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-3 text-sm">
                                                <span className="text-gray-500 font-mono">
                                                    {key.keyMasked}
                                                </span>
                                            </div>
                                            <div className="flex flex-wrap gap-1.5 pt-1">
                                                {(key.models || []).length >
                                                0 ? (
                                                    key.models?.map((model) => (
                                                        <span
                                                            key={model}
                                                            className="px-2 py-0.5 rounded text-xs bg-white/5 border border-white/10 text-gray-300"
                                                        >
                                                            {model}
                                                        </span>
                                                    ))
                                                ) : (
                                                    <span className="text-xs text-gray-500">
                                                        No models configured for
                                                        this key.
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        <button
                                            onClick={() =>
                                                handleDeleteKey(key.id)
                                            }
                                            className="p-2 bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20 transition-colors self-end sm:self-auto shrink-0"
                                            title="Delete Key"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))
                            ) : (
                                <div className="p-8 text-center bg-white/1 border border-white/5 border-dashed rounded-xl">
                                    <Key className="w-6 h-6 text-gray-600 mx-auto mb-3" />
                                    <p className="text-sm text-gray-400">
                                        No API keys configured yet.
                                    </p>
                                </div>
                            )}
                        </div>
                    </section>
                </div>
            </main>
        </div>
    );
};

export default Settings;
