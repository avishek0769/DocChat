import { useCallback, useLayoutEffect, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    RefreshControl,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { getChats } from "../api/endpoints";
import { useAuth } from "../auth/AuthContext";
import { colors } from "../theme";
import type { RootStackParamList } from "../navigation";
import type { ChatItem } from "../types";

type Props = NativeStackScreenProps<RootStackParamList, "Chats">;

export default function ChatsScreen({ navigation }: Props) {
    const { signOut } = useAuth();
    const [chats, setChats] = useState<ChatItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

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
                <TouchableOpacity onPress={() => navigation.navigate("Usage")}>
                    <Text style={styles.headerAction}>Usage</Text>
                </TouchableOpacity>
            ),
            headerLeft: () => (
                <TouchableOpacity onPress={() => void signOut()}>
                    <Text style={styles.headerAction}>Sign out</Text>
                </TouchableOpacity>
            ),
        });
    }, [navigation, signOut]);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        void load();
    }, [load]);

    if (loading) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator color={colors.primary} size="large" />
            </View>
        );
    }

    return (
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
                    {error ?? "No chats yet. Create one on the DocChat web app to get started."}
                </Text>
            }
            renderItem={({ item }) => (
                <TouchableOpacity
                    style={styles.row}
                    onPress={() => navigation.navigate("Chat", { chatId: item.id, name: item.name })}
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
});
