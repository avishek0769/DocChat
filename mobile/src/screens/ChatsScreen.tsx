import { useCallback, useLayoutEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Modal,
    RefreshControl,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { createChat, deleteChat, getChats } from "../api/endpoints";
import { colors } from "../theme";
import type { RootStackParamList } from "../navigation";
import type { ChatItem } from "../types";

type Props = NativeStackScreenProps<RootStackParamList, "Chats">;

export default function ChatsScreen({ navigation }: Props) {
    const [chats, setChats] = useState<ChatItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [modalVisible, setModalVisible] = useState(false);
    const [docsUrl, setDocsUrl] = useState("");
    const [isVectorLess, setIsVectorLess] = useState(false);
    const [creating, setCreating] = useState(false);
    const [createError, setCreateError] = useState<string | null>(null);

    const load = useCallback(async () => {
        try {
            setError(null);
            const data = await getChats();
            setChats(Array.isArray(data) ? data : []);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to load chats");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            void load();
        }, [load]),
    );

    useLayoutEffect(() => {
        navigation.setOptions({
            headerRight: () => (
                <View style={styles.headerRight}>
                    <TouchableOpacity onPress={() => setModalVisible(true)}>
                        <Text style={styles.headerAction}>New</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => navigation.navigate("ApiKeys")}>
                        <Text style={styles.headerAction}>Keys</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => navigation.navigate("Usage")}>
                        <Text style={styles.headerAction}>Account</Text>
                    </TouchableOpacity>
                </View>
            ),
        });
    }, [navigation]);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        void load();
    }, [load]);

    const onCreate = async () => {
        const url = docsUrl.trim();
        if (!url) {
            setCreateError("Enter a documentation URL.");
            return;
        }
        setCreating(true);
        setCreateError(null);
        try {
            await createChat({ docsUrl: url, isVectorLess });
            setModalVisible(false);
            setDocsUrl("");
            setIsVectorLess(false);
            await load();
        } catch (e) {
            setCreateError(e instanceof Error ? e.message : "Failed to create chat");
        } finally {
            setCreating(false);
        }
    };

    const confirmDelete = (chat: ChatItem) => {
        Alert.alert("Delete chat", `Delete "${chat.name}"? This cannot be undone.`, [
            { text: "Cancel", style: "cancel" },
            {
                text: "Delete",
                style: "destructive",
                onPress: () => {
                    setChats((prev) => prev.filter((c) => c.id !== chat.id));
                    deleteChat(chat.id).catch(() => void load());
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
                contentContainerStyle={chats.length === 0 ? styles.emptyContainer : styles.listContent}
                data={chats}
                keyExtractor={(item) => item.id}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
                }
                ListEmptyComponent={
                    <Text style={styles.empty}>
                        {error ?? 'No chats yet. Tap "New" to ingest a documentation URL.'}
                    </Text>
                }
                renderItem={({ item }) => (
                    <TouchableOpacity
                        style={styles.row}
                        onPress={() => navigation.navigate("Chat", { chatId: item.id, name: item.name })}
                        onLongPress={() => confirmDelete(item)}
                    >
                        <View style={styles.rowMain}>
                            <Text style={styles.rowTitle} numberOfLines={1}>
                                {item.name}
                            </Text>
                            {item.chatSources?.[0]?.documentationUrl ? (
                                <Text style={styles.rowSub} numberOfLines={1}>
                                    {item.chatSources[0].documentationUrl}
                                </Text>
                            ) : null}
                        </View>
                        <Text style={[styles.status, statusStyle(item.status)]}>{item.status}</Text>
                    </TouchableOpacity>
                )}
            />

            <Modal
                visible={modalVisible}
                animationType="slide"
                transparent
                onRequestClose={() => setModalVisible(false)}
            >
                <View style={styles.modalBackdrop}>
                    <View style={styles.modalCard}>
                        <Text style={styles.modalTitle}>New chat</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="https://docs.example.com"
                            placeholderTextColor={colors.muted}
                            autoCapitalize="none"
                            autoCorrect={false}
                            keyboardType="url"
                            value={docsUrl}
                            onChangeText={setDocsUrl}
                        />
                        <View style={styles.switchRow}>
                            <Text style={styles.switchLabel}>Vectorless (TreeIndex) mode</Text>
                            <Switch value={isVectorLess} onValueChange={setIsVectorLess} />
                        </View>
                        {createError ? <Text style={styles.error}>{createError}</Text> : null}
                        <View style={styles.modalActions}>
                            <TouchableOpacity
                                style={styles.secondaryButton}
                                onPress={() => setModalVisible(false)}
                                disabled={creating}
                            >
                                <Text style={styles.secondaryText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.primaryButton, creating && styles.disabled]}
                                onPress={onCreate}
                                disabled={creating}
                            >
                                {creating ? (
                                    <ActivityIndicator color={colors.primaryText} />
                                ) : (
                                    <Text style={styles.primaryText}>Create</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </>
    );
}

function statusStyle(status: ChatItem["status"]) {
    if (status === "READY") return { color: colors.success };
    if (status === "FAILED") return { color: colors.danger };
    return { color: colors.muted };
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    listContent: { padding: 16 },
    emptyContainer: { flexGrow: 1, alignItems: "center", justifyContent: "center", padding: 32 },
    centered: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
    empty: { color: colors.muted, textAlign: "center", fontSize: 15, lineHeight: 22 },
    headerRight: { flexDirection: "row", gap: 16 },
    headerAction: { color: colors.primary, fontSize: 15, fontWeight: "600", paddingHorizontal: 4 },
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
    rowSub: { color: colors.muted, fontSize: 12, marginTop: 4 },
    status: { fontSize: 11, fontWeight: "700" },
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
    input: {
        backgroundColor: colors.background,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 12,
        color: colors.text,
    },
    switchRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginTop: 16,
    },
    switchLabel: { color: colors.text, fontSize: 14 },
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
