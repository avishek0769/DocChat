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

import { register, sendVerificationCode, verifyEmail } from "../api/endpoints";
import { useAuth } from "../auth/AuthContext";
import { colors } from "../theme";
import type { RootStackParamList } from "../navigation";

type Props = NativeStackScreenProps<RootStackParamList, "SignUp">;

type Step = "details" | "verify";

export default function SignUpScreen({ navigation }: Props) {
    const { signIn } = useAuth();
    const [step, setStep] = useState<Step>("details");

    const [fullname, setFullname] = useState("");
    const [username, setUsername] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [code, setCode] = useState("");

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

    const onSendCode = async () => {
        if (!fullname.trim() || !username.trim() || !isValidEmail(email) || password.length < 6) {
            setError("Fill all fields with a valid email and a 6+ character password.");
            return;
        }
        setError(null);
        setLoading(true);
        try {
            await sendVerificationCode(email.trim());
            setStep("verify");
        } catch (e) {
            setError(e instanceof Error ? e.message : "Could not send verification code");
        } finally {
            setLoading(false);
        }
    };

    const onVerifyAndCreate = async () => {
        if (!code.trim()) {
            setError("Enter the verification code from your email.");
            return;
        }
        setError(null);
        setLoading(true);
        try {
            await verifyEmail(email.trim(), code.trim());
            await register({
                fullname: fullname.trim(),
                username: username.trim(),
                email: email.trim(),
                password,
            });
            // Account is ready — sign the user straight in.
            await signIn(email.trim(), password);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Could not create your account");
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
                {step === "details" ? (
                    <>
                        <Text style={styles.heading}>Create your account</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Full name"
                            placeholderTextColor={colors.muted}
                            value={fullname}
                            onChangeText={setFullname}
                        />
                        <TextInput
                            style={styles.input}
                            placeholder="Username"
                            placeholderTextColor={colors.muted}
                            autoCapitalize="none"
                            autoCorrect={false}
                            value={username}
                            onChangeText={setUsername}
                        />
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
                        <View style={styles.passwordRow}>
                            <TextInput
                                style={styles.passwordInput}
                                placeholder="Password (min 6 characters)"
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
                            onPress={onSendCode}
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator color={colors.primaryText} />
                            ) : (
                                <Text style={styles.buttonText}>Send verification code</Text>
                            )}
                        </TouchableOpacity>
                    </>
                ) : (
                    <>
                        <Text style={styles.heading}>Verify your email</Text>
                        <Text style={styles.subtitle}>
                            We sent a code to {email}. Enter it below to finish creating your account.
                        </Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Verification code"
                            placeholderTextColor={colors.muted}
                            keyboardType="number-pad"
                            value={code}
                            onChangeText={setCode}
                        />

                        {error ? <Text style={styles.error}>{error}</Text> : null}

                        <TouchableOpacity
                            style={[styles.button, loading && styles.buttonDisabled]}
                            onPress={onVerifyAndCreate}
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator color={colors.primaryText} />
                            ) : (
                                <Text style={styles.buttonText}>Verify &amp; create account</Text>
                            )}
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.linkRow}
                            onPress={() => {
                                setStep("details");
                                setError(null);
                            }}
                            disabled={loading}
                        >
                            <Text style={styles.link}>Change details</Text>
                        </TouchableOpacity>
                    </>
                )}

                <View style={styles.footer}>
                    <Text style={styles.footerText}>Already have an account? </Text>
                    <TouchableOpacity onPress={() => navigation.navigate("SignIn")}>
                        <Text style={styles.link}>Sign in</Text>
                    </TouchableOpacity>
                </View>
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
    linkRow: { alignSelf: "center", marginTop: 16 },
    link: { color: colors.primary, fontWeight: "600", fontSize: 14 },
    footer: { flexDirection: "row", justifyContent: "center", alignItems: "center", marginTop: 28 },
    footerText: { color: colors.muted, fontSize: 14 },
});
