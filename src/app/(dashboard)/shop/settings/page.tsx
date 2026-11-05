"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import ShopNav from "@/components/ShopNav";
import {
  Settings,
  MapPin,
  Phone,
  Mail,
  Save,
  LogOut,
  Loader2,
  Camera,
  Store,
  Tag,
  X,
  ImageIcon,
  Bell,
} from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useShop, updateShop } from "@/hooks/useApi";
import { useUpload } from "@/hooks/useUpload";
import UploadProgressBar from "@/components/UploadProgressBar";
import VerificationSection from "@/components/VerificationSection";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

const ALL_SPECIALTIES = [
  "Electronics",
  "Fashion",
  "Food & Groceries",
  "Home & Garden",
  "Health & Beauty",
  "Sports",
  "Automotive",
  "Books",
  "Toys",
  "Baby & Kids",
  "Furniture",
  "Jewelry",
  "Phone Accessories",
  "Computer Repair",
  "Tailoring",
  "Photography",
  "Services",
];

export default function ShopSettingsPage() {
  const router = useRouter();
  const { user, logout, updateUser } = useAuthStore();
  const { data: shopData, loading, refetch } = useShop(user?.id || null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [shopForm, setShopForm] = useState({
    name: "",
    description: "",
    locationId: "",
    phone: "",
    email: "",
    specialties: [] as string[],
    coverImage: "",
    profileImage: "",
    hours: {
      monday: "08:00 - 18:00",
      tuesday: "08:00 - 18:00",
      wednesday: "08:00 - 18:00",
      thursday: "08:00 - 18:00",
      friday: "08:00 - 19:00",
      saturday: "09:00 - 19:00",
      sunday: "10:00 - 15:00",
    },
  });
  const [saving, setSaving] = useState(false);
  const { upload: uploadFile, uploading, progress: uploadProgress } = useUpload({ folder: "pakalale/shop" });
  const [locations, setLocations] = useState<
    Array<{ id: string; name: string; slug: string }>
  >([]);
  const [showSpecialtyPicker, setShowSpecialtyPicker] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  // Check notification permission on mount
  useEffect(() => {
    if (typeof Notification !== "undefined") {
      setNotificationsEnabled(Notification.permission === "granted");
    }
  }, []);

  // Fetch locations
  useEffect(() => {
    fetch("/api/locations")
      .then((r) => r.json())
      .then((data) => setLocations(data.locations || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (shopData?.shop) {
      const s = shopData.shop;
      const parseHours = (h: Record<string, { open: string; close: string; closed: boolean }> | undefined, day: string) => {
        if (h?.[day]) return `${h[day].open} - ${h[day].close}`;
        return "08:00 - 18:00";
      };
      setShopForm({
        name: s.name || "",
        description: s.description || "",
        locationId: s.locationId || "",
        phone: typeof s.contact === "object" ? s.contact.phone : "",
        email: typeof s.contact === "object" ? s.contact.email : "",
        specialties: s.specialties || [],
        coverImage: s.coverImage || "",
        profileImage: s.profileImage || "",
        hours: {
          monday: parseHours(s.hours, "monday"),
          tuesday: parseHours(s.hours, "tuesday"),
          wednesday: parseHours(s.hours, "wednesday"),
          thursday: parseHours(s.hours, "thursday"),
          friday: parseHours(s.hours, "friday"),
          saturday: parseHours(s.hours, "saturday"),
          sunday: parseHours(s.hours, "sunday"),
        },
      });
    }
  }, [shopData]);

  const handleLogout = () => {
    logout();
    router.push("/");
  };

  const handleImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    type: "profileImage" | "coverImage"
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const result = await uploadFile(file);
    if (result?.url) {
      setShopForm((p) => ({ ...p, [type]: result.url }));
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const toggleSpecialty = (specialty: string) => {
    setShopForm((p) => ({
      ...p,
      specialties: p.specialties.includes(specialty)
        ? p.specialties.filter((s) => s !== specialty)
        : [...p.specialties, specialty],
    }));
  };

  const handleSave = async () => {
    if (!user?.id) return;
    setSaving(true);
    try {
      await updateShop(user.id, {
        name: shopForm.name,
        description: shopForm.description,
        locationId: shopForm.locationId,
        contact: {
          phone: shopForm.phone,
          email: shopForm.email,
        },
        specialties: shopForm.specialties,
        coverImage: shopForm.coverImage,
        profileImage: shopForm.profileImage,
        hours: shopForm.hours,
      });
      // Sync profileImage to auth store so avatar updates everywhere
      if (shopForm.profileImage && shopForm.profileImage !== user.avatar) {
        updateUser({ avatar: shopForm.profileImage });
      }
      refetch();
    } catch (e) {
      console.error("Failed to save:", e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <ShopNav />
      <main className="p-3 sm:p-4 space-y-4 max-w-2xl mx-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Settings className="h-5 w-5 text-brand" />
            Shop Settings
          </h2>
          <Button variant="destructive" size="sm" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-1" />
            Logout
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-brand" />
          </div>
        ) : (
          <>
            {/* Profile Photo & Cover */}
            <Card className="bg-card border-border overflow-hidden">
              <CardContent className="p-0">
                {/* Cover Image */}
                <div className="relative h-32 bg-gradient-to-r from-primary/20 to-amber-golden/20">
                  {shopForm.coverImage && (
                    <img
                      src={shopForm.coverImage}
                      alt="Cover"
                      className="w-full h-full object-cover"
                    />
                  )}
                  {uploading && (
                    <div className="absolute bottom-0 left-0 right-0">
                      <UploadProgressBar uploading={uploading} progress={uploadProgress} showLabel={false} />
                    </div>
                  )}
                  <button
                    onClick={() => {
                      fileInputRef.current?.click();
                      fileInputRef.current?.setAttribute(
                        "data-type",
                        "coverImage"
                      );
                    }}
                    className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 hover:opacity-100 transition-opacity"
                  >
                    <Camera className="h-6 w-6 text-white" />
                  </button>
                </div>

                {/* Profile Photo */}
                <div className="px-4 -mt-10 relative">
                  <div className="relative w-20 h-20 rounded-full border-4 border-background overflow-hidden bg-muted">
                    {shopForm.profileImage ? (
                      <img
                        src={shopForm.profileImage}
                        alt="Profile"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Store className="h-8 w-8 text-muted-foreground" />
                      </div>
                    )}
                    <button
                      onClick={() => {
                        fileInputRef.current?.click();
                        fileInputRef.current?.setAttribute(
                          "data-type",
                          "profileImage"
                        );
                      }}
                      className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 hover:opacity-100 transition-opacity rounded-full"
                    >
                      <Camera className="h-4 w-4 text-white" />
                    </button>
                  </div>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const type = fileInputRef.current?.getAttribute(
                      "data-type"
                    ) as "profileImage" | "coverImage";
                    if (type) handleImageUpload(e, type);
                  }}
                />
              </CardContent>
            </Card>

            {/* Shop Details */}
            <Card className="bg-card border-border">
              <CardContent className="p-4 space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Shop Name</Label>
                  <Input
                    value={shopForm.name}
                    onChange={(e) =>
                      setShopForm((p) => ({ ...p, name: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Description</Label>
                  <Textarea
                    value={shopForm.description}
                    onChange={(e) =>
                      setShopForm((p) => ({
                        ...p,
                        description: e.target.value,
                      }))
                    }
                    rows={3}
                    className="resize-none"
                  />
                </div>

                {/* Specialties */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Specialties</Label>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {shopForm.specialties.map((s) => (
                      <Badge
                        key={s}
                        variant="secondary"
                        className="text-[10px] cursor-pointer hover:bg-destructive/10"
                        onClick={() => toggleSpecialty(s)}
                      >
                        {s}
                        <X className="h-2.5 w-2.5 ml-1" />
                      </Badge>
                    ))}
                  </div>
                  <button
                    onClick={() => setShowSpecialtyPicker(!showSpecialtyPicker)}
                    className="flex items-center gap-1.5 text-xs text-brand hover:text-brand/80"
                  >
                    <Tag className="h-3 w-3" />
                    {shopForm.specialties.length === 0
                      ? "Add specialties"
                      : "Add more"}
                  </button>
                  {showSpecialtyPicker && (
                    <div className="flex flex-wrap gap-1.5 p-2 bg-muted/50 rounded-lg">
                      {ALL_SPECIALTIES.filter(
                        (s) => !shopForm.specialties.includes(s)
                      ).map((s) => (
                        <button
                          key={s}
                          onClick={() => toggleSpecialty(s)}
                          className="px-2 py-1 bg-background border border-border rounded text-[10px] hover:border-primary/50 transition-colors"
                        >
                          + {s}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Location</Label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <select
                        value={shopForm.locationId}
                        onChange={(e) =>
                          setShopForm((p) => ({
                            ...p,
                            locationId: e.target.value,
                          }))
                        }
                        className="w-full pl-10 pr-4 py-2 bg-muted border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      >
                        <option value="">Select location</option>
                        {locations.map((loc) => (
                          <option key={loc.id} value={loc.id}>
                            {loc.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Phone</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        value={shopForm.phone}
                        onChange={(e) =>
                          setShopForm((p) => ({
                            ...p,
                            phone: e.target.value,
                          }))
                        }
                        className="pl-10"
                      />
                    </div>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="email"
                      value={shopForm.email}
                      onChange={(e) =>
                        setShopForm((p) => ({
                          ...p,
                          email: e.target.value,
                        }))
                      }
                      className="pl-10"
                    />
                  </div>
                </div>

                <Separator />

                {/* Notifications */}
                <div className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-2">
                    <Bell className="h-4 w-4 text-brand" />
                    <div>
                      <span className="text-sm font-medium">Push Notifications</span>
                      <p className="text-[10px] text-muted-foreground">Get notified about new deals and messages</p>
                    </div>
                  </div>
                  <button
                    onClick={async () => {
                      if (typeof Notification === "undefined") {
                        alert("Notifications are not supported in this browser");
                        return;
                      }
                      if (Notification.permission === "granted") {
                        setNotificationsEnabled(!notificationsEnabled);
                      } else if (Notification.permission !== "denied") {
                        const permission = await Notification.requestPermission();
                        setNotificationsEnabled(permission === "granted");
                      } else {
                        alert("Notifications are blocked. Please enable them in your browser settings.");
                      }
                    }}
                    className={`relative w-11 h-6 rounded-full transition-colors ${notificationsEnabled ? "bg-primary" : "bg-muted"}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${notificationsEnabled ? "translate-x-5" : ""}`} />
                  </button>
                </div>

                <Separator />

                {/* Working Hours */}
                <div>
                  <Label className="text-xs mb-2 block">Working Hours</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {(
                      Object.entries(shopForm.hours) as [
                        string,
                        string,
                      ][]
                    ).map(([day, hours]) => (
                      <div key={day} className="space-y-1">
                        <p className="text-[10px] text-muted-foreground capitalize">
                          {day}
                        </p>
                        <Input
                          value={hours}
                          onChange={(e) =>
                            setShopForm((p) => ({
                              ...p,
                              hours: { ...p.hours, [day]: e.target.value },
                            }))
                          }
                          className="text-xs"
                          placeholder="08:00 - 18:00"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <Button
                  className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  ) : (
                    <Save className="h-4 w-4 mr-1" />
                  )}
                  {saving ? "Saving..." : "Save Changes"}
                </Button>
              </CardContent>
            </Card>

            {/* Appearance */}
            <Card className="bg-card border-border">
              <CardContent className="p-4 space-y-3">
                <div>
                  <span className="text-sm font-medium">Appearance</span>
                  <p className="text-[10px] text-muted-foreground">
                    The light theme is applied everywhere by default. Switch back to the dark theme any time.
                  </p>
                </div>
                <ThemeToggle />
              </CardContent>
            </Card>

            {/* Verification Documents */}
            <VerificationSection shopData={shopData} refetch={refetch} />
          </>
        )}
      </main>
    </div>
  );
}
