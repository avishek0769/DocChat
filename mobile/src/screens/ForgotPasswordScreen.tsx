import { useState } from "react";
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { resetPassword, sendResetCode } from "../api/endpoints";
import { colors } from "../theme";
import type { RootStackParamList } from "../navigation";

type Props = NativeStackScreenProps<RootStackParamList, "ForgotPassword">;

type Step = "request" | "reset" | "done";

export default function ForgotPasswordScreen({ navigation }: Props) {
    const [step, setStep] = useState<Step>("request");
    const [email, setEmail] = useState("");
    const [code, setCode] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

    const onSendCode = async () => {
        if (!isValidEmail(email)) {
            setError("Enter a valid email address.");
            return;
        }
        setError(null);
        setLoading(true);
        try {
            await sendResetCode(email.trim());
            setStep("reset");
        } catch (e) {
            setError(e instanceof Error ? e.message : "Could not send reset code");
        } finally {
            setLoading(false);
        }
    };

    const onReset = async () => {
        if (!code.trim() || password.length < 6) {
            setError("Enter the code and a 6+ character new password.");
            return;
        }
        setError(null);
        setLoading(true);
        try {
            await resetPassword(email.trim(), code.trim(), password);
            setStep("done");
        } catch (e) {
            setError(e instanceof Error ? e.message : "Could not reset password");
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
            <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
                {step === "request" ? (
                    <>
                        <Text style={styles.heading}>Reset your password</Text>
                        <Text style={styles.subtitle}>
                            Enter your account email and we&apos;ll send you a reset code.
                        </Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Email"
                            placeholderTextColor={colors.muted}
                            autoCapitalize="none"
                            autoCorrect={false}
                            keyboardType="email-address"
                            value={email}
                            onChangeText={setEmail}
                        />
                        {error ? <Text style={styles.error}>{error}</Text> : null}
                        <TouchableOpacity
                            style={[styles.button, loading && styles.buttonDisabled]}
                            onPress={onSendCode}
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator color={colors.primaryText} />
                            ) : (
                                <Text style={styles.buttonText}>Send reset code</Text>
                            )}
                        </TouchableOpacity>
                    </>
                ) : step === "reset" ? (
                    <>
                        <Text style={styles.heading}>Enter new password</Text>
                        <Text style={styles.subtitle}>We sent a code to {email}.</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Reset code"
                            placeholderTextColor={colors.muted}
                            keyboardType="number-pad"
                            value={code}
                            onChangeText={setCode}
                        />
                        <View style={styles.passwordRow}>
                            <TextInput
                                style={styles.passwordInput}
                                placeholder="New password (min 6 characters)"
                                placeholderTextColor={colors.muted}
                                secureTextEntry={!showPassword}
                                autoCapitalize="none"
                                autoCorrect={false}
                                value={password}
                                onChangeText={setPassword}
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
                            onPress={onReset}
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator color={colors.primaryText} />
                            ) : (
                                <Text style={styles.buttonText}>Reset password</Text>
                            )}
                        </TouchableOpacity>
                    </>
                ) : (
                    <>
                        <Text style={styles.heading}>Password updated</Text>
                        <Text style={styles.subtitle}>
                            Your password has been reset. You can now sign in with your new password.
                        </Text>
                        <TouchableOpacity
                            style={styles.button}
                            onPress={() => navigation.navigate("SignIn")}
                        >
                            <Text style={styles.buttonText}>Back to sign in</Text>
                        </TouchableOpacity>
                    </>
                )}
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: 24, flexGrow: 1, justifyContent: "center" },
    heading: { color: colors.text, fontSize: 24, fontWeight: "700", marginBottom: 8 },
    subtitle: { color: colors.muted, fontSize: 14, lineHeight: 20, marginBottom: 20 },
    input: {
        backgroundColor: colors.surface,
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
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 10,
        marginBottom: 12,
    },
    passwordInput: { flex: 1, paddingHorizontal: 14, paddingVertical: 12, color: colors.text },
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
});
