import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { getApiKeys, getChatMessages, sendMessage } from "../api/endpoints";
import { colors } from "../theme";
import type { RootStackParamList } from "../navigation";
import type { ChatMessageItem } from "../types";

type Props = NativeStackScreenProps<RootStackParamList, "Chat">;

type Selection = { provider: string; model: string } | null;

export default function ChatScreen({ route, navigation }: Props) {
    const { chatId, name } = route.params;
    const [messages, setMessages] = useState<ChatMessageItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [prompt, setPrompt] = useState("");
    const [sending, setSending] = useState(false);
    const [selection, setSelection] = useState<Selection>(null);
    const listRef = useRef<FlatList<ChatMessageItem>>(null);

    useLayoutEffect(() => {
        navigation.setOptions({ title: name });
    }, [navigation, name]);

    const load = useCallback(async () => {
        try {
            setError(null);
            const [{ messages: loaded }, { apiKeys }] = await Promise.all([
                getChatMessages(chatId),
                getApiKeys().catch(() => ({ apiKeys: [] })),
            ]);
            setMessages(loaded ?? []);
            const firstKey = apiKeys?.[0];
            if (firstKey?.models?.[0]) {
                setSelection({ provider: firstKey.provider, model: firstKey.models[0] });
            }
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to load messages");
        } finally {
            setLoading(false);
        }
    }, [chatId]);

    useEffect(() => {
        void load();
    }, [load]);

    const onSend = async () => {
        const userPrompt = prompt.trim();
        if (!userPrompt || sending) return;
        if (!selection) {
            setError("Add an API key on the DocChat web app to send messages.");
            return;
        }

        setSending(true);
        setError(null);
        setPrompt("");

        const optimistic: ChatMessageItem = {
            id: `pending-${messages.length}`,
            chatId,
            userPrompt,
            llmResponse: "",
            llmModel: selection.model,
            createdAt: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, optimistic]);

        try {
            const reply = await sendMessage({
                chatId,
                userPrompt,
                model: selection.model,
                provider: selection.provider,
            });
            setMessages((prev) =>
                prev.map((m) => (m.id === optimistic.id ? { ...m, llmResponse: reply } : m)),
            );
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to send message");
            setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
            setPrompt(userPrompt);
        } finally {
            setSending(false);
        }
    };

    if (loading) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator color={colors.primary} size="large" />
            </View>
        );
    }

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            keyboardVerticalOffset={90}
        >
            <FlatList
                ref={listRef}
                contentContainerStyle={styles.listContent}
                data={messages}
                keyExtractor={(item) => item.id}
                onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
                ListEmptyComponent={
                    <Text style={styles.empty}>Ask a question about this documentation.</Text>
                }
                renderItem={({ item }) => (
                    <View style={styles.turn}>
                        <View style={[styles.bubble, styles.userBubble]}>
                            <Text style={styles.userText}>{item.userPrompt}</Text>
                        </View>
                        {item.llmResponse ? (
                            <View style={[styles.bubble, styles.assistantBubble]}>
                                <Text style={styles.assistantText}>{item.llmResponse}</Text>
                            </View>
                        ) : (
                            <View style={[styles.bubble, styles.assistantBubble]}>
                                <ActivityIndicator color={colors.muted} />
                            </View>
                        )}
                    </View>
                )}
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <View style={styles.composer}>
                <TextInput
                    style={styles.input}
                    placeholder="Type a message"
                    placeholderTextColor={colors.muted}
                    value={prompt}
                    onChangeText={setPrompt}
                    multiline
                />
                <TouchableOpacity
                    style={[styles.sendButton, (sending || !prompt.trim()) && styles.sendDisabled]}
                    onPress={onSend}
                    disabled={sending || !prompt.trim()}
                >
                    <Text style={styles.sendText}>{sending ? "…" : "Send"}</Text>
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    centered: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
    listContent: { padding: 16, flexGrow: 1 },
    empty: { color: colors.muted, textAlign: "center", marginTop: 40 },
    turn: { marginBottom: 16 },
    bubble: { borderRadius: 12, padding: 12, marginBottom: 8, maxWidth: "90%" },
    userBubble: { backgroundColor: colors.primary, alignSelf: "flex-end" },
    userText: { color: colors.primaryText, fontSize: 15 },
    assistantBubble: {
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        alignSelf: "flex-start",
    },
    assistantText: { color: colors.text, fontSize: 15, lineHeight: 21 },
    error: { color: colors.danger, fontSize: 13, paddingHorizontal: 16, paddingBottom: 6 },
    composer: {
        flexDirection: "row",
        alignItems: "flex-end",
        padding: 12,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        backgroundColor: colors.surface,
    },
    input: {
        flex: 1,
        maxHeight: 120,
        backgroundColor: colors.background,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 10,
        color: colors.text,
        marginRight: 10,
    },
    sendButton: {
        backgroundColor: colors.primary,
        borderRadius: 10,
        paddingHorizontal: 18,
        paddingVertical: 12,
    },
    sendDisabled: { opacity: 0.5 },
    sendText: { color: colors.primaryText, fontWeight: "600" },
});
