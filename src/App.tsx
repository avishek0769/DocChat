import { BrowserRouter, Routes, Route } from "react-router-dom";
import LandingPage from "./pages/LandingPage";
import Dashboard from "./pages/Dashboard";
import AllChats from "./pages/AllChats";
import Settings from "./pages/Settings";
import SignIn from "./pages/SignIn";
import SignUp from "./pages/SignUp";
import Profile from "./pages/Profile";
import { ChatPage } from "./pages/ChatPage";
import { SharedChatPage } from "./pages/SharedChatPage";
import { Usage } from "./pages/Usage";
import AdminOverview from "./pages/AdminOverview";
import AdminUsers from "./pages/AdminUsers";
import AdminUserDetail from "./pages/AdminUserDetail";
import AdminUsage from "./pages/AdminUsage";
import AdminIngestion from "./pages/AdminIngestion";
import { ProtectedRoute, PublicOnlyRoute } from "./components/ProtectedRoute";

function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route
                    path="/"
                    element={
                        <PublicOnlyRoute>
                            <LandingPage />
                        </PublicOnlyRoute>
                    }
                />
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
                    path="/shared/:shareToken"
                    element={<SharedChatPage />}
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
                    path="/admin"
                    element={
                        <ProtectedRoute adminOnly>
                            <AdminOverview />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/admin/users"
                    element={
                        <ProtectedRoute adminOnly>
                            <AdminUsers />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/admin/users/:userId"
                    element={
                        <ProtectedRoute adminOnly>
                            <AdminUserDetail />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/admin/usage"
                    element={
                        <ProtectedRoute adminOnly>
                            <AdminUsage />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/admin/ingestion"
                    element={
                        <ProtectedRoute adminOnly>
                            <AdminIngestion />
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
