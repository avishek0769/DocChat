import { Navigate } from "react-router-dom";
import { isAuthenticated } from "../lib/auth";
import type { JSX } from "react";

type Props = {
    children: JSX.Element;
};

export const ProtectedRoute = ({ children }: Props) => {
    if (!isAuthenticated()) {
        return <Navigate to="/signin" replace />;
    }

    return children;
};

export const PublicOnlyRoute = ({ children }: Props) => {
    if (isAuthenticated()) {
        return <Navigate to="/dashboard" replace />;
    }

    return children;
};
