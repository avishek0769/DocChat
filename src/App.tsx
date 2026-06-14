import { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import LandingPage from "./pages/LandingPage";
import { ProtectedRoute, PublicOnlyRoute } from "./components/ProtectedRoute";
import { isAuthenticated } from "./lib/auth";

// Lazy load route pages
const Dashboard = lazy(() => import("./pages/Dashboard"));
const AllChats = lazy(() => import("./pages/AllChats"));
const Settings = lazy(() => import("./pages/Settings"));
const SignIn = lazy(() => import("./pages/SignIn"));
const SignUp = lazy(() => import("./pages/SignUp"));
const Profile = lazy(() => import("./pages/Profile"));
const ChatPage = lazy(() =>
    import("./pages/ChatPage").then((module) => ({ default: module.ChatPage }))
);
const SharedChatPage = lazy(() =>
    import("./pages/SharedChatPage").then((module) => ({
        default: module.SharedChatPage,
    }))
);
const Usage = lazy(() =>
    import("./pages/Usage").then((module) => ({ default: module.Usage }))
);
const AdminOverview = lazy(() => import("./pages/AdminOverview"));
const AdminUsers = lazy(() => import("./pages/AdminUsers"));
const AdminUserDetail = lazy(() => import("./pages/AdminUserDetail"));
const AdminUsage = lazy(() => import("./pages/AdminUsage"));
const AdminIngestion = lazy(() => import("./pages/AdminIngestion"));

function App() {
    return (
        <BrowserRouter>
            <Suspense
                fallback={
                    <div className="min-h-screen bg-[#0b0b0f] flex items-center justify-center">
                        <div className="w-8 h-8 border-2 border-accent-blue/30 border-t-accent-blue rounded-full animate-spin" />
                    </div>
                }
            >
                <Routes>
            <Route
                path="/"
                element={
                    isAuthenticated() ? (
                    <Navigate to="/dashboard" replace />
                     ) : (
                    <LandingPage/>
                    )
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
            </Suspense>
        </BrowserRouter>
    );
}

export default App;
