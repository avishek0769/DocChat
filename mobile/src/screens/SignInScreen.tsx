import { useState } from "react";
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { useAuth } from "../auth/AuthContext";
import { colors } from "../theme";
import type { RootStackParamList } from "../navigation";

type Props = NativeStackScreenProps<RootStackParamList, "SignIn">;

export default function SignInScreen({ navigation }: Props) {
    const { signIn } = useAuth();
    const [identifier, setIdentifier] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const onSubmit = async () => {
        if (!identifier.trim() || !password) {
            setError("Enter your email/username and password.");
            return;
        }
        setError(null);
        setLoading(true);
        try {
            await signIn(identifier, password);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Sign in failed");
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
            <View style={styles.card}>
                <Text style={styles.title}>DocChat</Text>
                <Text style={styles.subtitle}>Chat with your documentation</Text>

                <TextInput
                    style={styles.input}
                    placeholder="Email or username"
                    placeholderTextColor={colors.muted}
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="next"
                    value={identifier}
                    onChangeText={(text) => {
                        setIdentifier(text);
                        if (error) setError(null);
                    }}
                />
                <View style={styles.passwordRow}>
                    <TextInput
                        style={styles.passwordInput}
                        placeholder="Password"
                        placeholderTextColor={colors.muted}
                        secureTextEntry={!showPassword}
                        autoCapitalize="none"
                        autoCorrect={false}
                        returnKeyType="go"
                        value={password}
                        onChangeText={(text) => {
                            setPassword(text);
                            if (error) setError(null);
                        }}
                        onSubmitEditing={onSubmit}
                    />
                    <TouchableOpacity
                        style={styles.toggle}
                        onPress={() => setShowPassword((prev) => !prev)}
                        accessibilityRole="button"
                        accessibilityLabel={showPassword ? "Hide password" : "Show password"}
                    >
                        <Text style={styles.toggleText}>{showPassword ? "Hide" : "Show"}</Text>
                    </TouchableOpacity>
                </View>

                {error ? <Text style={styles.error}>{error}</Text> : null}

                <TouchableOpacity
                    style={[styles.button, loading && styles.buttonDisabled]}
                    onPress={onSubmit}
                    disabled={loading}
                >
                    {loading ? (
                        <ActivityIndicator color={colors.primaryText} />
                    ) : (
                        <Text style={styles.buttonText}>Sign in</Text>
                    )}
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.linkRow}
                    onPress={() => navigation.navigate("ForgotPassword")}
                >
                    <Text style={styles.link}>Forgot password?</Text>
                </TouchableOpacity>

                <View style={styles.footer}>
                    <Text style={styles.footerText}>Don&apos;t have an account? </Text>
                    <TouchableOpacity onPress={() => navigation.navigate("SignUp")}>
                        <Text style={styles.link}>Sign up</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
        justifyContent: "center",
        padding: 24,
    },
    card: {
        backgroundColor: colors.surface,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.border,
        padding: 24,
    },
    title: { color: colors.text, fontSize: 28, fontWeight: "700", textAlign: "center" },
    subtitle: { color: colors.muted, fontSize: 14, textAlign: "center", marginTop: 4, marginBottom: 24 },
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
    passwordRow: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: colors.background,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 10,
        marginBottom: 12,
    },
    passwordInput: {
        flex: 1,
        paddingHorizontal: 14,
        paddingVertical: 12,
        color: colors.text,
    },
    toggle: { paddingHorizontal: 14, paddingVertical: 12 },
    toggleText: { color: colors.primary, fontWeight: "600", fontSize: 13 },
    error: { color: colors.danger, fontSize: 13, marginBottom: 12 },
    button: {
        backgroundColor: colors.primary,
        borderRadius: 10,
        paddingVertical: 14,
        alignItems: "center",
        marginTop: 4,
    },
    buttonDisabled: { opacity: 0.6 },
    buttonText: { color: colors.primaryText, fontWeight: "600", fontSize: 16 },
    linkRow: { alignSelf: "center", marginTop: 16 },
    link: { color: colors.primary, fontWeight: "600", fontSize: 14 },
    footer: { flexDirection: "row", justifyContent: "center", alignItems: "center", marginTop: 20 },
    footerText: { color: colors.muted, fontSize: 14 },
});
