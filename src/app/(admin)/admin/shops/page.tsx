"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Store,
  Search,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  FileText,
  ExternalLink,
  Star,
  Package,
  MapPin,
  X,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import ImageWithFallback from "@/components/ImageWithFallback";
import { DEFAULT_SHOP_COVER } from "@/lib/placeholders";
import { useAuthStore } from "@/store/authStore";
import { formatTimeAgo } from "@/lib/formatTime";

interface ShopData {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  ownerName: string;
  ownerEmail: string;
  locationId: string;
  status: string;
  profileImage: string;
  coverImage: string;
  specialties: string[];
  rating: number;
  totalReviews: number;
  productCount: number;
  verificationDocuments?: {
    businessLicense?: string;
    taxCertificate?: string;
    nationalId?: string;
    other?: string[];
  };
  verificationNotes?: string;
  rejectedReason?: string;
  verifiedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export default function AdminShopsPage() {
  const { user } = useAuthStore();
  const [shops, setShops] = useState<ShopData[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("pending");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedShop, setSelectedShop] = useState<ShopData | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [imageViewer, setImageViewer] = useState<string | null>(null);

  const fetchShops = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    const params = new URLSearchParams({ userId: user.id, page: String(page), limit: "20" });
    if (statusFilter) params.set("status", statusFilter);
    if (searchQuery) params.set("search", searchQuery);

    try {
      const res = await fetch(`/api/admin/shops?${params}`);
      const data = await res.json();
      setShops(data.shops || []);
      setTotalPages(data.totalPages || 1);
      setTotal(data.total || 0);
    } catch {
      console.error("Failed to fetch shops");
    } finally {
      setLoading(false);
    }
  }, [user?.id, statusFilter, searchQuery, page]);

  useEffect(() => {
    fetchShops();
  }, [fetchShops]);

  const handleAction = async (shopId: string, action: "verify" | "reject", reason?: string) => {
    if (!user?.id) return;
    setActionLoading(shopId);
    try {
      const res = await fetch("/api/admin/shops", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, shopId, action, reason }),
      });
      if (res.ok) {
        setSelectedShop(null);
        setRejectReason("");
        fetchShops();
      }
    } catch {
      console.error("Failed to update shop");
    } finally {
      setActionLoading(null);
    }
  };

  const statusConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
    pending: { label: "Pending", color: "text-orange-500 bg-orange-500/10", icon: Clock },
    verified: { label: "Verified", color: "text-emerald-500 bg-emerald-500/10", icon: CheckCircle },
    rejected: { label: "Rejected", color: "text-destructive bg-destructive/10", icon: XCircle },
  };

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Store className="h-5 w-5 text-brand" />
            Shop Verification
          </h1>
          <p className="text-xs text-muted-foreground">{total} shops {statusFilter ? `with status "${statusFilter}"` : "total"}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search shops..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
            className="pl-10"
          />
        </div>
      </div>

      {/* Status Tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {(["pending", "verified", "rejected"] as const).map((status) => {
          const cfg = statusConfig[status];
          const Icon = cfg.icon;
          return (
            <button
              key={status}
              onClick={() => { setStatusFilter(status); setPage(1); }}
              className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-medium transition-colors flex items-center gap-1 ${
                statusFilter === status ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              <Icon className="h-3 w-3" />
              {cfg.label}
            </button>
          );
        })}
      </div>

      {/* Shop List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-brand" />
        </div>
      ) : shops.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Store className="h-10 w-10 mx-auto mb-3 opacity-50" />
          <p className="text-sm font-medium">No shops found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {shops.map((shop) => {
            const cfg = statusConfig[shop.status] || statusConfig.pending;
            const Icon = cfg.icon;
            return (
              <Card
                key={shop.id}
                className="bg-card border-border hover:border-primary/20 transition-colors cursor-pointer"
                onClick={() => setSelectedShop(shop)}
              >
                <CardContent className="p-3">
                  <div className="flex items-start gap-3">
                    <Avatar className="h-10 w-10 shrink-0">
                      <AvatarImage src={shop.profileImage} alt={shop.name} />
                      <AvatarFallback className="bg-primary/10 text-brand text-sm">
                        {shop.name?.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-sm truncate">{shop.name}</h3>
                        <Badge variant="secondary" className={`text-[9px] shrink-0 ${cfg.color}`}>
                          <Icon className="h-2.5 w-2.5 mr-0.5" />
                          {cfg.label}
                        </Badge>
                      </div>
                      <p className="text-[10px] text-muted-foreground mb-1">
                        Owner: {shop.ownerName} · {shop.ownerEmail}
                      </p>
                      <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                        {shop.locationId && (
                          <span className="flex items-center gap-0.5">
                            <MapPin className="h-2.5 w-2.5" /> {shop.locationId}
                          </span>
                        )}
                        <span className="flex items-center gap-0.5">
                          <Package className="h-2.5 w-2.5" /> {shop.productCount} products
                        </span>
                        {shop.rating && (
                          <span className="flex items-center gap-0.5">
                            <Star className="h-2.5 w-2.5 text-yellow-400 fill-yellow-400" /> {shop.rating}
                          </span>
                        )}
                        <span>{formatTimeAgo(shop.createdAt)}</span>
                      </div>
                      {shop.verificationDocuments && (
                        <div className="flex items-center gap-1 mt-1.5">
                          <FileText className="h-2.5 w-2.5 text-muted-foreground" />
                          <span className="text-[10px] text-muted-foreground">
                            {[
                              shop.verificationDocuments.businessLicense && "License",
                              shop.verificationDocuments.taxCertificate && "Tax Cert",
                              shop.verificationDocuments.nationalId && "National ID",
                            ].filter(Boolean).join(" · ") || "No documents"}
                          </span>
                        </div>
                      )}
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
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </Button>
          <span className="text-xs text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      )}

      {/* Shop Detail Modal */}
      {selectedShop && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setSelectedShop(null)}>
          <div
            className="bg-card rounded-t-xl sm:rounded-xl w-full sm:max-w-lg max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Cover */}
            <div className="h-32 w-full overflow-hidden rounded-t-xl relative">
              <ImageWithFallback src={selectedShop.coverImage} fallbackSrc={DEFAULT_SHOP_COVER} alt={`${selectedShop.name} cover`} className="w-full h-full object-cover" />
              <button onClick={() => setSelectedShop(null)} className="absolute top-2 right-2 bg-black/50 rounded-full p-1">
                <X className="h-4 w-4 text-white" />
              </button>
              </div>

            <div className="p-4 space-y-4">
              {/* Shop Info */}
              <div className="flex items-center gap-3">
                <Avatar className="h-14 w-14">
                  <AvatarImage src={selectedShop.profileImage || DEFAULT_SHOP_COVER} alt={selectedShop.name} />
                  <AvatarFallback className="bg-primary/10 text-brand">{selectedShop.name?.charAt(0)}</AvatarFallback>
                </Avatar>
                <div>
                  <h2 className="font-bold">{selectedShop.name}</h2>
                  <p className="text-xs text-muted-foreground">Owner: {selectedShop.ownerName}</p>
                  <p className="text-[10px] text-muted-foreground">{selectedShop.ownerEmail}</p>
                </div>
              </div>

              <p className="text-xs text-muted-foreground">{selectedShop.description}</p>

              {/* Verification Documents */}
              <div>
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                  <FileText className="h-4 w-4" />
                  Verification Documents
                </h3>
                {selectedShop.verificationDocuments ? (
                  <div className="space-y-2">
                    {selectedShop.verificationDocuments.businessLicense && (
                      <DocLink label="Business License" url={selectedShop.verificationDocuments.businessLicense} onView={setImageViewer} />
                    )}
                    {selectedShop.verificationDocuments.taxCertificate && (
                      <DocLink label="Tax Certificate" url={selectedShop.verificationDocuments.taxCertificate} onView={setImageViewer} />
                    )}
                    {selectedShop.verificationDocuments.nationalId && (
                      <DocLink label="National ID" url={selectedShop.verificationDocuments.nationalId} onView={setImageViewer} />
                    )}
                    {selectedShop.verificationDocuments.other?.map((doc, i) => (
                      <DocLink key={i} label={`Document ${i + 1}`} url={doc} onView={setImageViewer} />
                    ))}
                    {!selectedShop.verificationDocuments.businessLicense &&
                      !selectedShop.verificationDocuments.taxCertificate &&
                      !selectedShop.verificationDocuments.nationalId &&
                      (!selectedShop.verificationDocuments.other || selectedShop.verificationDocuments.other.length === 0) && (
                      <p className="text-xs text-muted-foreground">No documents uploaded yet</p>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">No documents uploaded yet</p>
                )}
              </div>

              {/* Admin Notes */}
              {selectedShop.verificationNotes && (
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-[10px] font-medium mb-1">Admin Notes</p>
                  <p className="text-xs text-muted-foreground">{selectedShop.verificationNotes}</p>
                </div>
              )}

              {/* Rejected Reason */}
              {selectedShop.rejectedReason && (
                <div className="p-3 bg-destructive/5 border border-destructive/20 rounded-lg">
                  <p className="text-[10px] font-medium text-destructive mb-1">Rejection Reason</p>
                  <p className="text-xs text-destructive">{selectedShop.rejectedReason}</p>
                </div>
              )}

              {/* Actions */}
              {selectedShop.status === "pending" && (
                <div className="space-y-3">
                  <Textarea
                    placeholder="Rejection reason (optional, required for rejection)"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    rows={2}
                    className="resize-none text-xs"
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="flex-1 bg-emerald-600 text-white hover:bg-emerald-700"
                      onClick={() => handleAction(selectedShop.id, "verify")}
                      disabled={actionLoading === selectedShop.id}
                    >
                      {actionLoading === selectedShop.id ? (
                        <Loader2 className="h-3 w-3 animate-spin mr-1" />
                      ) : (
                        <CheckCircle className="h-3 w-3 mr-1" />
                      )}
                      Verify Shop
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="flex-1"
                      onClick={() => handleAction(selectedShop.id, "reject", rejectReason)}
                      disabled={actionLoading === selectedShop.id || !rejectReason}
                    >
                      {actionLoading === selectedShop.id ? (
                        <Loader2 className="h-3 w-3 animate-spin mr-1" />
                      ) : (
                        <XCircle className="h-3 w-3 mr-1" />
                      )}
                      Reject
                    </Button>
                  </div>
                </div>
              )}

              {selectedShop.status === "rejected" && (
                <Button
                  size="sm"
                  className="w-full bg-emerald-600 text-white hover:bg-emerald-700"
                  onClick={() => handleAction(selectedShop.id, "verify")}
                  disabled={actionLoading === selectedShop.id}
                >
                  {actionLoading === selectedShop.id ? (
                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                  ) : (
                    <CheckCircle className="h-3 w-3 mr-1" />
                  )}
                  Verify Anyway
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Image Viewer */}
      {imageViewer && (
        <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4" onClick={() => setImageViewer(null)}>
          <img src={imageViewer} alt="Document" className="max-w-full max-h-[90vh] rounded-lg object-contain" />
          <button onClick={() => setImageViewer(null)} className="absolute top-4 right-4 bg-white/20 rounded-full p-2">
            <X className="h-5 w-5 text-white" />
          </button>
        </div>
      )}
    </div>
  );
}

function DocLink({ label, url, onView }: { label: string; url: string; onView: (url: string) => void }) {
  const isImage = /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(url);
  return (
    <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
      <span className="text-xs flex-1">{label}</span>
      {isImage ? (
        <button
          onClick={() => onView(url)}
          className="text-[10px] text-brand hover:underline flex items-center gap-0.5"
        >
          <Eye className="h-3 w-3" /> View
        </button>
      ) : (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[10px] text-brand hover:underline flex items-center gap-0.5"
        >
          <ExternalLink className="h-3 w-3" /> Open
        </a>
      )}
    </div>
  );
}
