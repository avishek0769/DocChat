import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Sidebar } from "../components/Sidebar";
import { getAdminUsers, type AdminUserItem } from "../lib/api";

const AdminUsers = () => {
    const [page, setPage] = useState(1);
    const limit = 10;
    const [users, setUsers] = useState<AdminUserItem[]>([]);
    const [totalPages, setTotalPages] = useState(1);
    const [error, setError] = useState("");

    useEffect(() => {
        const load = async () => {
            setError("");
            try {
                const res = await getAdminUsers(page, limit);
                setUsers(res.data || []);
                setTotalPages(res.pagination?.totalPages || 1);
            } catch (err) {
                setError(err instanceof Error ? err.message : "Failed to load users.");
            }
        };
        load();
    }, [page]);

    return (
        <div className="min-h-screen bg-[#0b0b0f] text-gray-50 flex font-sans">
            <Sidebar />
            <main className="flex-1 p-8 lg:p-12 overflow-y-auto w-full">
                <div className="max-w-6xl mx-auto space-y-8">
                    <header>
                        <h1 className="text-3xl font-bold mb-2">Users</h1>
                        <p className="text-gray-400 text-sm">Browse platform users and open a detail view.</p>
                    </header>
                    {error && <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>}
                    <section className="p-6 rounded-xl bg-white/2 border border-white/5 overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-gray-400 border-b border-white/5">
                                    <th className="text-left pb-3 font-medium">User</th>
                                    <th className="text-left pb-3 font-medium">Email</th>
                                    <th className="text-left pb-3 font-medium">Role</th>
                                    <th className="text-right pb-3 font-medium">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {users.map((user) => (
                                    <tr key={user.id} className="hover:bg-white/2">
                                        <td className="py-3 text-white">{user.fullname || user.username || user.id}</td>
                                        <td className="py-3 text-gray-400">{user.email || "—"}</td>
                                        <td className="py-3 text-gray-400">{user.isAdmin ? "Admin" : "User"}</td>
                                        <td className="py-3 text-right">
                                            <Link className="text-accent-blue hover:underline" to={`/admin/users/${user.id}`}>
                                                View user
                                            </Link>
                                        </td>
                                    </tr>
                                ))}
                                {!users.length && (
                                    <tr><td className="py-10 text-center text-gray-500" colSpan={4}>No users found.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </section>
                    <div className="flex items-center justify-between">
                        <button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="px-4 py-2 rounded-lg bg-white/5 disabled:opacity-50">Prev</button>
                        <span className="text-sm text-gray-400">Page {page} of {totalPages}</span>
                        <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="px-4 py-2 rounded-lg bg-white/5 disabled:opacity-50">Next</button>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default AdminUsers;
