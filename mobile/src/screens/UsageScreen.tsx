import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { getLifetimeTokens } from "../api/endpoints";
import { useAuth } from "../auth/AuthContext";
import { colors } from "../theme";
import type { LifetimeTokens } from "../types";

export default function UsageScreen() {
    const { user, signOut } = useAuth();
    const [usage, setUsage] = useState<LifetimeTokens | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let mounted = true;
        getLifetimeTokens()
            .then((data) => {
                if (mounted) setUsage(data);
            })
            .catch((e: unknown) => {
                if (mounted) setError(e instanceof Error ? e.message : "Failed to load usage");
            })
            .finally(() => {
                if (mounted) setLoading(false);
            });
        return () => {
            mounted = false;
        };
    }, []);

    const input = usage?._sum.inputTokens ?? 0;
    const output = usage?._sum.outputTokens ?? 0;
    const cost = usage?._sum.estimatedCostUsd ?? 0;

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            <View style={styles.profile}>
                <Text style={styles.name}>{user?.fullname ?? user?.username ?? "Account"}</Text>
                {user?.email ? <Text style={styles.email}>{user.email}</Text> : null}
            </View>

            <Text style={styles.heading}>Lifetime usage</Text>
            {error ? <Text style={styles.error}>{error}</Text> : null}

            {loading ? (
                <ActivityIndicator color={colors.primary} size="large" style={styles.loading} />
            ) : (
                <>
                    <Stat label="Input tokens" value={input.toLocaleString()} />
                    <Stat label="Output tokens" value={output.toLocaleString()} />
                    <Stat label="Total tokens" value={(input + output).toLocaleString()} />
                    <Stat label="Estimated cost" value={`$${cost.toFixed(4)}`} />
                </>
            )}

            <TouchableOpacity style={styles.signOut} onPress={() => void signOut()}>
                <Text style={styles.signOutText}>Sign out</Text>
            </TouchableOpacity>
        </ScrollView>
    );
}

function Stat({ label, value }: { label: string; value: string }) {
    return (
        <View style={styles.card}>
            <Text style={styles.cardLabel}>{label}</Text>
            <Text style={styles.cardValue}>{value}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: 16 },
    profile: { marginBottom: 24 },
    name: { color: colors.text, fontSize: 20, fontWeight: "700" },
    email: { color: colors.muted, fontSize: 14, marginTop: 4 },
    heading: { color: colors.text, fontSize: 18, fontWeight: "700", marginBottom: 16 },
    error: { color: colors.danger, fontSize: 13, marginBottom: 12 },
    loading: { marginTop: 24 },
    card: {
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 12,
        padding: 18,
        marginBottom: 12,
    },
    cardLabel: { color: colors.muted, fontSize: 13 },
    cardValue: { color: colors.text, fontSize: 24, fontWeight: "700", marginTop: 6 },
    signOut: {
        borderWidth: 1,
        borderColor: colors.danger,
        borderRadius: 10,
        paddingVertical: 14,
        alignItems: "center",
        marginTop: 24,
    },
    signOutText: { color: colors.danger, fontWeight: "600", fontSize: 15 },
});
