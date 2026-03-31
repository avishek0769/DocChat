import { BrowserRouter, Routes, Route } from "react-router-dom";
import LandingPage from "./pages/LandingPage";
import Dashboard from "./pages/Dashboard";
import AllChats from "./pages/AllChats";
import Settings from "./pages/Settings";
import SignIn from "./pages/SignIn";
import SignUp from "./pages/SignUp";
import Profile from "./pages/Profile";
import { ChatPage } from "./pages/ChatPage";
import { Usage } from "./pages/Usage";
import { ProtectedRoute, PublicOnlyRoute } from "./components/ProtectedRoute";

function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route
                    path="/dashboard"
                    element={
                        <ProtectedRoute>
                            <Dashboard />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/chats"
                    element={
                        <ProtectedRoute>
                            <AllChats />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/chat/:id"
                    element={
                        <ProtectedRoute>
                            <ChatPage />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/usage"
                    element={
                        <ProtectedRoute>
                            <Usage />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/settings"
                    element={
                        <ProtectedRoute>
                            <Settings />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/signin"
                    element={
                        <PublicOnlyRoute>
                            <SignIn />
                        </PublicOnlyRoute>
                    }
                />
                <Route
                    path="/signup"
                    element={
                        <PublicOnlyRoute>
                            <SignUp />
                        </PublicOnlyRoute>
                    }
                />
                <Route
                    path="/profile"
                    element={
                        <ProtectedRoute>
                            <Profile />
                        </ProtectedRoute>
                    }
                />
            </Routes>
        </BrowserRouter>
    );
}

export default App;
