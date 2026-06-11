/** Root navigator: gates the authenticated stack behind the sign-in screen. */
import { ActivityIndicator, View } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { useAuth } from "./auth/AuthContext";
import { colors } from "./theme";
import SignInScreen from "./screens/SignInScreen";
import ChatsScreen from "./screens/ChatsScreen";
import ChatScreen from "./screens/ChatScreen";
import UsageScreen from "./screens/UsageScreen";

export type RootStackParamList = {
    SignIn: undefined;
    Chats: undefined;
    Chat: { chatId: string; name: string };
    Usage: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
    const { status } = useAuth();

    if (status === "loading") {
        return (
            <View
                style={{
                    flex: 1,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: colors.background,
                }}
            >
                <ActivityIndicator color={colors.primary} size="large" />
            </View>
        );
    }

    return (
        <Stack.Navigator
            screenOptions={{
                headerStyle: { backgroundColor: colors.surface },
                headerTintColor: colors.text,
                contentStyle: { backgroundColor: colors.background },
            }}
        >
            {status === "authenticated" ? (
                <>
                    <Stack.Screen name="Chats" component={ChatsScreen} options={{ title: "DocChat" }} />
                    <Stack.Screen name="Chat" component={ChatScreen} />
                    <Stack.Screen name="Usage" component={UsageScreen} options={{ title: "Usage" }} />
                </>
            ) : (
                <Stack.Screen name="SignIn" component={SignInScreen} options={{ headerShown: false }} />
            )}
        </Stack.Navigator>
    );
}
