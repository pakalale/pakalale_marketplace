"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Users,
  Search,
  Loader2,
  Shield,
  Store,
  UserCheck,
  Trash2,
  MoreVertical,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuthStore } from "@/store/authStore";
import { formatTimeAgo } from "@/lib/formatTime";

interface UserData {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  avatar: string;
  isVerified: boolean;
  location: string;
  phone: string;
  lastActiveAt: string;
  shopName?: string;
  shopStatus?: string;
  createdAt: string;
}

export default function AdminUsersPage() {
  const { user } = useAuthStore();
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    const params = new URLSearchParams({ userId: user.id, page: String(page), limit: "20" });
    if (roleFilter) params.set("role", roleFilter);
    if (searchQuery) params.set("search", searchQuery);

    try {
      const res = await fetch(`/api/admin/users?${params}`);
      const data = await res.json();
      setUsers(data.users || []);
      setTotalPages(data.totalPages || 1);
      setTotal(data.total || 0);
    } catch {
      console.error("Failed to fetch users");
    } finally {
      setLoading(false);
    }
  }, [user?.id, roleFilter, searchQuery, page]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleAction = async (targetUserId: string, action: string, value?: string) => {
    if (!user?.id) return;
    setActionLoading(targetUserId);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminId: user.id, targetUserId, action, value }),
      });
      if (res.ok) {
        setSelectedUser(null);
        fetchUsers();
      }
    } catch {
      console.error("Failed to update user");
    } finally {
      setActionLoading(null);
    }
  };

  const roleConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
    admin: { label: "Admin", color: "text-red-500 bg-red-500/10", icon: Shield },
    shop_owner: { label: "Shop Owner", color: "text-brand bg-primary/10", icon: Store },
    customer: { label: "Customer", color: "text-blue-500 bg-blue-500/10", icon: UserCheck },
  };

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-6xl mx-auto">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Users className="h-5 w-5 text-brand" />
          User Management
        </h1>
        <p className="text-xs text-muted-foreground">{total} users total</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
            className="pl-10"
          />
        </div>
      </div>

      {/* Role Tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {(["", "customer", "shop_owner", "admin"] as const).map((role) => {
          const cfg = role ? roleConfig[role] : null;
          const Icon = cfg?.icon || Users;
          return (
            <button
              key={role || "all"}
              onClick={() => { setRoleFilter(role); setPage(1); }}
              className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-medium transition-colors flex items-center gap-1 ${
                roleFilter === role ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              <Icon className="h-3 w-3" />
              {role === "" ? "All" : cfg?.label || role}
            </button>
          );
        })}
      </div>

      {/* User List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-brand" />
        </div>
      ) : users.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Users className="h-10 w-10 mx-auto mb-3 opacity-50" />
          <p className="text-sm font-medium">No users found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {users.map((u) => {
            const cfg = roleConfig[u.role] || roleConfig.customer;
            const Icon = cfg.icon;
            return (
              <Card
                key={u.id}
                className="bg-card border-border hover:border-primary/20 transition-colors cursor-pointer"
                onClick={() => setSelectedUser(u)}
              >
                <CardContent className="p-3">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10 shrink-0">
                      <AvatarImage src={u.avatar} alt={u.firstName} />
                      <AvatarFallback className="bg-muted text-xs font-bold">
                        {u.firstName?.charAt(0)}{u.lastName?.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <h3 className="font-semibold text-sm truncate">
                          {u.firstName} {u.lastName}
                        </h3>
                        <Badge variant="secondary" className={`text-[9px] shrink-0 ${cfg.color}`}>
                          <Icon className="h-2.5 w-2.5 mr-0.5" />
                          {cfg.label}
                        </Badge>
                        {u.isVerified && (
                          <Badge variant="secondary" className="text-[9px] bg-emerald-500/10 text-emerald-500">
                            Verified
                          </Badge>
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground truncate">{u.email}</p>
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                        {u.location && <span>{u.location}</span>}
                        {u.shopName && <span>· {u.shopName}</span>}
                        <span>· Joined {formatTimeAgo(u.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <span className="text-xs text-muted-foreground">Page {page} of {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      )}

      {/* User Detail Modal */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setSelectedUser(null)}>
          <div
            className="bg-card rounded-t-xl sm:rounded-xl w-full sm:max-w-md max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 space-y-4">
              <div className="flex items-center gap-3">
                <Avatar className="h-14 w-14">
                  <AvatarImage src={selectedUser.avatar} alt={selectedUser.firstName} />
                  <AvatarFallback className="bg-muted text-lg font-bold">
                    {selectedUser.firstName?.charAt(0)}{selectedUser.lastName?.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h2 className="font-bold">{selectedUser.firstName} {selectedUser.lastName}</h2>
                  <p className="text-xs text-muted-foreground">{selectedUser.email}</p>
                  <div className="flex items-center gap-1 mt-1">
                    <Badge variant="secondary" className={`text-[9px] ${roleConfig[selectedUser.role]?.color || ""}`}>
                      {roleConfig[selectedUser.role]?.label || selectedUser.role}
                    </Badge>
                    {selectedUser.isVerified && (
                      <Badge variant="secondary" className="text-[9px] bg-emerald-500/10 text-emerald-500">
                        Verified
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-2 bg-muted/50 rounded-lg">
                  <p className="text-[10px] text-muted-foreground">Location</p>
                  <p className="font-medium">{selectedUser.location || "Not set"}</p>
                </div>
                <div className="p-2 bg-muted/50 rounded-lg">
                  <p className="text-[10px] text-muted-foreground">Phone</p>
                  <p className="font-medium">{selectedUser.phone || "Not set"}</p>
                </div>
                <div className="p-2 bg-muted/50 rounded-lg">
                  <p className="text-[10px] text-muted-foreground">Last Active</p>
                  <p className="font-medium">{selectedUser.lastActiveAt ? formatTimeAgo(selectedUser.lastActiveAt) : "Never"}</p>
                </div>
                <div className="p-2 bg-muted/50 rounded-lg">
                  <p className="text-[10px] text-muted-foreground">Joined</p>
                  <p className="font-medium">{formatTimeAgo(selectedUser.createdAt)}</p>
                </div>
              </div>

              {selectedUser.shopName && (
                <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg">
                  <p className="text-[10px] text-muted-foreground mb-1">Shop</p>
                  <p className="text-xs font-medium">{selectedUser.shopName}</p>
                  <Badge
                    variant="secondary"
                    className={`text-[9px] mt-1 ${
                      selectedUser.shopStatus === "verified" ? "bg-emerald-500/10 text-emerald-500" :
                      selectedUser.shopStatus === "rejected" ? "bg-destructive/10 text-destructive" :
                      "bg-orange-500/10 text-orange-500"
                    }`}
                  >
                    {selectedUser.shopStatus || "pending"}
                  </Badge>
                </div>
              )}

              {/* Actions */}
              <div className="space-y-2">
                {selectedUser.role !== "admin" && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    onClick={() => handleAction(selectedUser.id, "setRole", selectedUser.role === "shop_owner" ? "customer" : "shop_owner")}
                    disabled={actionLoading === selectedUser.id}
                  >
                    {actionLoading === selectedUser.id ? (
                      <Loader2 className="h-3 w-3 animate-spin mr-1" />
                    ) : selectedUser.role === "shop_owner" ? (
                      <><UserCheck className="h-3 w-3 mr-1" /> Demote to Customer</>
                    ) : (
                      <><Store className="h-3 w-3 mr-1" /> Promote to Shop Owner</>
                    )}
                  </Button>
                )}

                {selectedUser.role !== "admin" && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    onClick={() => handleAction(selectedUser.id, "setVerified", selectedUser.isVerified ? "false" : "true")}
                    disabled={actionLoading === selectedUser.id}
                  >
                    {selectedUser.isVerified ? "Remove Verified Status" : "Mark as Verified"}
                  </Button>
                )}

                {selectedUser.id !== user?.id && (
                  <Button
                    size="sm"
                    variant="destructive"
                    className="w-full"
                    onClick={() => {
                      if (confirm(`Delete ${selectedUser.firstName} ${selectedUser.lastName}? This cannot be undone.`)) {
                        handleAction(selectedUser.id, "delete");
                      }
                    }}
                    disabled={actionLoading === selectedUser.id}
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    Delete User
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
