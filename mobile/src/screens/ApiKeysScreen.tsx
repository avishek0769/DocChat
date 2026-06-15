import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Modal,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { createApiKey, deleteApiKey, getApiKeys } from "../api/endpoints";
import { colors } from "../theme";
import type { RootStackParamList } from "../navigation";
import type { ApiKeyItem, Provider } from "../types";

type Props = NativeStackScreenProps<RootStackParamList, "ApiKeys">;

const PROVIDERS: Provider[] = ["OPENAI", "ANTHROPIC", "GOOGLE", "XAI", "OPENROUTER"];

export default function ApiKeysScreen({ navigation }: Props) {
    const [keys, setKeys] = useState<ApiKeyItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [modalVisible, setModalVisible] = useState(false);
    const [name, setName] = useState("");
    const [provider, setProvider] = useState<Provider>("OPENAI");
    const [secret, setSecret] = useState("");
    const [showSecret, setShowSecret] = useState(false);
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);

    const load = useCallback(async () => {
        try {
            setError(null);
            const { apiKeys } = await getApiKeys();
            setKeys(apiKeys ?? []);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to load API keys");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    useLayoutEffect(() => {
        navigation.setOptions({
            headerRight: () => (
                <TouchableOpacity onPress={() => setModalVisible(true)}>
                    <Text style={styles.headerAction}>Add</Text>
                </TouchableOpacity>
            ),
        });
    }, [navigation]);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        void load();
    }, [load]);

    const resetForm = () => {
        setName("");
        setProvider("OPENAI");
        setSecret("");
        setShowSecret(false);
        setFormError(null);
    };

    const onAdd = async () => {
        if (!name.trim() || !secret.trim()) {
            setFormError("Enter a name and the API key.");
            return;
        }
        setSaving(true);
        setFormError(null);
        try {
            await createApiKey({ name: name.trim(), provider, key: secret.trim() });
            setModalVisible(false);
            resetForm();
            await load();
        } catch (e) {
            setFormError(e instanceof Error ? e.message : "Failed to add key");
        } finally {
            setSaving(false);
        }
    };

    const confirmDelete = (item: ApiKeyItem) => {
        Alert.alert("Delete key", `Delete "${item.name}"?`, [
            { text: "Cancel", style: "cancel" },
            {
                text: "Delete",
                style: "destructive",
                onPress: () => {
                    setKeys((prev) => prev.filter((k) => k.id !== item.id));
                    deleteApiKey(item.id).catch(() => void load());
                },
            },
        ]);
    };

    if (loading) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator color={colors.primary} size="large" />
            </View>
        );
    }

    return (
        <>
            <FlatList
                style={styles.container}
                contentContainerStyle={keys.length === 0 ? styles.emptyContainer : styles.listContent}
                data={keys}
                keyExtractor={(item) => item.id}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
                }
                ListEmptyComponent={
                    <Text style={styles.empty}>
                        {error ?? 'No API keys yet. Tap "Add" to connect a provider.'}
                    </Text>
                }
                renderItem={({ item }) => (
                    <TouchableOpacity style={styles.row} onLongPress={() => confirmDelete(item)}>
                        <View style={styles.rowMain}>
                            <Text style={styles.rowTitle}>{item.name}</Text>
                            <Text style={styles.rowKey}>{item.formattedKey}</Text>
                            {item.models?.length ? (
                                <Text style={styles.rowModels}>
                                    {item.models.length} model{item.models.length === 1 ? "" : "s"}
                                </Text>
                            ) : null}
                        </View>
                        <View style={styles.providerBadge}>
                            <Text style={styles.providerText}>{item.provider}</Text>
                        </View>
                    </TouchableOpacity>
                )}
                ListFooterComponent={
                    keys.length > 0 ? <Text style={styles.hint}>Long-press a key to delete it.</Text> : null
                }
            />

            <Modal
                visible={modalVisible}
                animationType="slide"
                transparent
                onRequestClose={() => setModalVisible(false)}
            >
                <View style={styles.modalBackdrop}>
                    <View style={styles.modalCard}>
                        <Text style={styles.modalTitle}>Add API key</Text>

                        <Text style={styles.label}>Provider</Text>
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.providerRow}
                        >
                            {PROVIDERS.map((p) => (
                                <TouchableOpacity
                                    key={p}
                                    style={[styles.providerChip, p === provider && styles.providerChipActive]}
                                    onPress={() => setProvider(p)}
                                >
                                    <Text
                                        style={[
                                            styles.providerChipText,
                                            p === provider && styles.providerChipTextActive,
                                        ]}
                                    >
                                        {p}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>

                        <TextInput
                            style={styles.input}
                            placeholder="Key name (e.g. Personal)"
                            placeholderTextColor={colors.muted}
                            value={name}
                            onChangeText={setName}
                        />
                        <View style={styles.secretRow}>
                            <TextInput
                                style={styles.secretInput}
                                placeholder="API key"
                                placeholderTextColor={colors.muted}
                                secureTextEntry={!showSecret}
                                autoCapitalize="none"
                                autoCorrect={false}
                                value={secret}
                                onChangeText={setSecret}
                            />
                            <TouchableOpacity
                                style={styles.toggle}
                                onPress={() => setShowSecret((prev) => !prev)}
                                accessibilityRole="button"
                                accessibilityLabel={showSecret ? "Hide key" : "Show key"}
                            >
                                <Text style={styles.toggleText}>{showSecret ? "Hide" : "Show"}</Text>
                            </TouchableOpacity>
                        </View>

                        {formError ? <Text style={styles.error}>{formError}</Text> : null}

                        <View style={styles.modalActions}>
                            <TouchableOpacity
                                style={styles.secondaryButton}
                                onPress={() => {
                                    setModalVisible(false);
                                    resetForm();
                                }}
                                disabled={saving}
                            >
                                <Text style={styles.secondaryText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.primaryButton, saving && styles.disabled]}
                                onPress={onAdd}
                                disabled={saving}
                            >
                                {saving ? (
                                    <ActivityIndicator color={colors.primaryText} />
                                ) : (
                                    <Text style={styles.primaryText}>Add key</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    listContent: { padding: 16 },
    emptyContainer: { flexGrow: 1, alignItems: "center", justifyContent: "center", padding: 32 },
    centered: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
    empty: { color: colors.muted, textAlign: "center", fontSize: 15, lineHeight: 22 },
    headerAction: { color: colors.primary, fontSize: 15, fontWeight: "600", paddingHorizontal: 4 },
    hint: { color: colors.muted, fontSize: 12, textAlign: "center", marginTop: 8 },
    row: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
    },
    rowMain: { flex: 1, marginRight: 12 },
    rowTitle: { color: colors.text, fontSize: 16, fontWeight: "600" },
    rowKey: { color: colors.muted, fontSize: 13, marginTop: 4, fontFamily: "monospace" },
    rowModels: { color: colors.muted, fontSize: 12, marginTop: 4 },
    providerBadge: {
        backgroundColor: colors.background,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 8,
        paddingHorizontal: 8,
        paddingVertical: 4,
    },
    providerText: { color: colors.primary, fontSize: 11, fontWeight: "700" },
    modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
    modalCard: {
        backgroundColor: colors.surface,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 24,
        borderTopWidth: 1,
        borderColor: colors.border,
    },
    modalTitle: { color: colors.text, fontSize: 20, fontWeight: "700", marginBottom: 16 },
    label: { color: colors.muted, fontSize: 13, marginBottom: 8 },
    providerRow: { gap: 8, paddingBottom: 16 },
    providerChip: {
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 16,
        paddingHorizontal: 12,
        paddingVertical: 6,
        backgroundColor: colors.background,
    },
    providerChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    providerChipText: { color: colors.muted, fontSize: 12 },
    providerChipTextActive: { color: colors.primaryText, fontWeight: "600" },
    input: {
        backgroundColor: colors.background,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 12,
        color: colors.text,
        marginBottom: 12,
    },
    secretRow: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: colors.background,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 10,
    },
    secretInput: { flex: 1, paddingHorizontal: 14, paddingVertical: 12, color: colors.text },
    toggle: { paddingHorizontal: 14, paddingVertical: 12 },
    toggleText: { color: colors.primary, fontWeight: "600", fontSize: 13 },
    error: { color: colors.danger, fontSize: 13, marginTop: 12 },
    modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: 12, marginTop: 24 },
    secondaryButton: { paddingVertical: 12, paddingHorizontal: 18 },
    secondaryText: { color: colors.muted, fontWeight: "600" },
    primaryButton: {
        backgroundColor: colors.primary,
        borderRadius: 10,
        paddingVertical: 12,
        paddingHorizontal: 22,
        minWidth: 96,
        alignItems: "center",
    },
    primaryText: { color: colors.primaryText, fontWeight: "600" },
    disabled: { opacity: 0.6 },
});
