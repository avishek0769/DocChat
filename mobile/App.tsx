import { StatusBar } from "expo-status-bar";
import { NavigationContainer, DarkTheme } from "@react-navigation/native";

import { AuthProvider } from "./src/auth/AuthContext";
import RootNavigator from "./src/navigation";
import { colors } from "./src/theme";

const navTheme = {
    ...DarkTheme,
    colors: {
        ...DarkTheme.colors,
        background: colors.background,
        card: colors.surface,
        text: colors.text,
        border: colors.border,
        primary: colors.primary,
    },
};

export default function App() {
    return (
        <AuthProvider>
            <NavigationContainer theme={navTheme}>
                <RootNavigator />
            </NavigationContainer>
            <StatusBar style="light" />
        </AuthProvider>
    );
}
