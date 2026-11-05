"use client";

import { useState, useRef } from "react";
import {
  FileText,
  Upload,
  CheckCircle,
  Clock,
  XCircle,
  X,
  Loader2,
  ExternalLink,
  Shield,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useUpload } from "@/hooks/useUpload";
import { useAuthStore } from "@/store/authStore";
import { updateShop } from "@/hooks/useApi";

interface VerificationDocs {
  businessLicense?: string;
  taxCertificate?: string;
  nationalId?: string;
  other?: string[];
}

interface ShopData {
  shop?: {
    id: string;
    status: string;
    verificationDocuments?: VerificationDocs;
    verificationNotes?: string;
    rejectedReason?: string;
    verifiedAt?: string;
  };
}

interface Props {
  shopData: ShopData | null;
  refetch: () => void;
}

const DOC_TYPES = [
  { key: "businessLicense", label: "Business License", description: "Official business registration document" },
  { key: "taxCertificate", label: "Tax Certificate", description: "Tax compliance certificate" },
  { key: "nationalId", label: "National ID / Passport", description: "Owner's identification document" },
] as const;

export default function VerificationSection({ shopData, refetch }: Props) {
  const { user } = useAuthStore();
  const shop = shopData?.shop;
  const [uploading, setUploading] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const { upload: uploadFile } = useUpload({ folder: "pakalale/verification" });
  const [docs, setDocs] = useState<VerificationDocs>(
    shop?.verificationDocuments || {}
  );

  const status = shop?.status || "pending";
  const isVerified = status === "verified";
  const isRejected = status === "rejected";
  const hasDocs = docs.businessLicense || docs.taxCertificate || docs.nationalId;

  const handleUpload = async (key: string) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*,.pdf";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      setUploading(key);
      try {
        const result = await uploadFile(file);
        if (result?.url) {
          setDocs((prev) => ({ ...prev, [key]: result.url }));
        }
      } catch (err) {
        console.error("Upload failed:", err);
      } finally {
        setUploading(null);
      }
    };
    input.click();
  };

  const handleSave = async () => {
    if (!user?.id || !shop?.id) return;
    setSaving(true);
    try {
      await updateShop(user.id, {
        verificationDocuments: docs,
      });
      refetch();
    } catch (err) {
      console.error("Failed to save documents:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = (key: string) => {
    setDocs((prev) => {
      const next = { ...prev };
      delete next[key as keyof VerificationDocs];
      return next;
    });
  };

  return (
    <Card className="bg-card border-border overflow-hidden">
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-brand" />
            <div>
              <h3 className="text-sm font-semibold">Shop Verification</h3>
              <p className="text-[10px] text-muted-foreground">
                Upload documents to get verified
              </p>
            </div>
          </div>
          <Badge
            variant="secondary"
            className={`text-[10px] ${
              isVerified
                ? "bg-emerald-500/10 text-emerald-500"
                : isRejected
                ? "bg-destructive/10 text-destructive"
                : hasDocs
                ? "bg-orange-500/10 text-orange-500"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {isVerified ? (
              <><CheckCircle className="h-2.5 w-2.5 mr-0.5" /> Verified</>
            ) : isRejected ? (
              <><XCircle className="h-2.5 w-2.5 mr-0.5" /> Rejected</>
            ) : hasDocs ? (
              <><Clock className="h-2.5 w-2.5 mr-0.5" /> Under Review</>
            ) : (
              "Not Verified"
            )}
          </Badge>
        </div>

        {/* Rejection Reason */}
        {isRejected && shop?.rejectedReason && (
          <div className="p-3 bg-destructive/5 border border-destructive/20 rounded-lg">
            <p className="text-[10px] font-medium text-destructive mb-1">
              Why was this rejected?
            </p>
            <p className="text-xs text-destructive">{shop.rejectedReason}</p>
          </div>
        )}

        {/* Verified Message */}
        {isVerified && (
          <div className="p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-lg">
            <p className="text-xs text-emerald-500 font-medium">
              ✓ Your shop is verified! Customers will see a verified badge on your profile.
            </p>
          </div>
        )}

        {/* Document Uploads */}
        <div className="space-y-3">
          {DOC_TYPES.map(({ key, label, description }) => {
            const storedUrl = docs[key as keyof VerificationDocs];
            const url = Array.isArray(storedUrl) ? storedUrl[0] : storedUrl;
            const isUploading = uploading === key;

            return (
              <div
                key={key}
                className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg"
              >
                <div className="h-9 w-9 bg-primary/10 rounded-lg flex items-center justify-center shrink-0">
                  <FileText className="h-4 w-4 text-brand" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium">{label}</p>
                  <p className="text-[10px] text-muted-foreground">{description}</p>
                  {url && (
                    <div className="flex items-center gap-1 mt-1">
                      <CheckCircle className="h-2.5 w-2.5 text-emerald-500" />
                      <span className="text-[10px] text-emerald-500">Uploaded</span>
                    </div>
                  )}
                </div>
                <div className="shrink-0">
                  {url ? (
                    <div className="flex items-center gap-1">
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                      >
                        <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                      </a>
                      {!isVerified && (
                        <button
                          onClick={() => handleRemove(key)}
                          className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors"
                        >
                          <X className="h-3.5 w-3.5 text-destructive" />
                        </button>
                      )}
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-[10px]"
                      onClick={() => handleUpload(key)}
                      disabled={isUploading || isVerified}
                    >
                      {isUploading ? (
                        <Loader2 className="h-3 w-3 animate-spin mr-1" />
                      ) : (
                        <Upload className="h-3 w-3 mr-1" />
                      )}
                      Upload
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Save Button */}
        {hasDocs && !isVerified && (
          <Button
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            ) : (
              <FileText className="h-4 w-4 mr-1" />
            )}
            {saving ? "Submitting..." : "Submit for Verification"}
          </Button>
        )}

        {!hasDocs && !isVerified && (
          <p className="text-[10px] text-muted-foreground text-center">
            Upload at least one document to request verification
          </p>
        )}
      </CardContent>
    </Card>
  );
}
