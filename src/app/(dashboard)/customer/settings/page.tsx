"use client";

import { useState, useRef, useEffect } from "react";
import { useUpload } from "@/hooks/useUpload";
import UploadProgressBar from "@/components/UploadProgressBar";
import { useRouter } from "next/navigation";
import { User, Bell, Shield, LogOut, Camera, Mail, Phone, MapPin, Loader2, Check, Image } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

export default function SettingsPage() {
  const router = useRouter();
  const { user, logout, updateUser } = useAuthStore();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(user?.avatar || null);
  const { upload: uploadAvatar, uploading: avatarUploading, progress: avatarProgress } = useUpload({ folder: "pakalale/avatars", type: "image" });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [profileData, setProfileData] = useState({
    firstName: user?.firstName || "",
    lastName: user?.lastName || "",
    email: user?.email || "",
    phone: user?.phone || "",
    location: user?.location || "",
    bio: user?.bio || "",
  });
  const [interestedCategories, setInterestedCategories] = useState<string[]>(user?.interestedCategories || []);
  const [showCategories, setShowCategories] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [locationSharing, setLocationSharing] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(user?.location || "");
  const [locationLoading, setLocationLoading] = useState(false);

  // Check notification permission on mount
  useEffect(() => {
    if (typeof Notification !== "undefined") {
      setNotificationsEnabled(Notification.permission === "granted");
    }
  }, []);

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      alert("Please select an image file");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert("Image must be less than 5MB");
      return;
    }

    // Upload to Cloudinary
    const result = await uploadAvatar(file);
    if (result?.url) {
      setAvatarPreview(result.url);
    }
  };

  const handleSave = async () => {
    if (!user?.id) return;
    setSaving(true);
    try {
      const res = await fetch("/api/user/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          ...profileData,
          avatar: avatarPreview || undefined,
          interestedCategories,
        }),
      });
      const data = await res.json();
      if (res.ok && data.user) {
        updateUser(data.user);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } catch (e) {
      console.error("Failed to save profile:", e);
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => { logout(); router.push("/"); };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-background/90 backdrop-blur-lg border-b border-border">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="w-16" />
          <h1 className="text-sm font-bold">Settings</h1>
          <div className="w-16" />
        </div>
      </header>

      <div className="px-4 py-4 max-w-2xl mx-auto space-y-4">
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

        <Tabs defaultValue="profile">
          <TabsList className="grid w-full grid-cols-3 mb-4">
            <TabsTrigger value="profile" className="text-xs"><User className="h-3.5 w-3.5 mr-1" />Profile</TabsTrigger>
            <TabsTrigger value="notifications" className="text-xs"><Bell className="h-3.5 w-3.5 mr-1" />Alerts</TabsTrigger>
            <TabsTrigger value="privacy" className="text-xs"><Shield className="h-3.5 w-3.5 mr-1" />Privacy</TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="space-y-4">
            <Card className="bg-card border-border">
              <CardContent className="p-4">
                {/* Avatar Section */}
                <div className="flex items-center gap-4 mb-4">
                  <div className="relative group cursor-pointer" onClick={handleAvatarClick}>
                    <Avatar className="h-16 w-16">
                      {avatarPreview ? (
                        <img src={avatarPreview} alt="Profile" className="h-full w-full object-cover rounded-full" />
                      ) : (
                        <AvatarFallback className="bg-gradient-to-br from-primary to-amber-golden text-primary-foreground text-lg">
                          {profileData.firstName[0]}{profileData.lastName[0]}
                        </AvatarFallback>
                      )}
                    </Avatar>
                    <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Camera className="h-5 w-5 text-white" />
                    </div>
                    <div className="absolute -bottom-1 -right-1 p-1 bg-primary text-primary-foreground rounded-full hover:bg-primary/80">
                      <Camera className="h-3 w-3" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold">{profileData.firstName} {profileData.lastName}</h3>
                    <p className="text-xs text-muted-foreground">Click photo to change</p>
                    <UploadProgressBar uploading={avatarUploading} progress={avatarProgress} className="mt-2" />
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </div>

                {avatarPreview && (
                  <div className="mb-4 p-3 bg-muted/50 rounded-lg flex items-center gap-3">
                    <Image className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground flex-1">New photo selected</span>
                    <button
                      onClick={() => setAvatarPreview(null)}
                      className="text-xs text-destructive hover:text-destructive/80"
                    >
                      Remove
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">First Name</Label>
                    <Input value={profileData.firstName} onChange={(e) => setProfileData({ ...profileData, firstName: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Last Name</Label>
                    <Input value={profileData.lastName} onChange={(e) => setProfileData({ ...profileData, lastName: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input value={profileData.email} disabled className="pl-10 bg-muted/50" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Phone</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input value={profileData.phone} onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })} className="pl-10" placeholder="+260 9X XXX XXXX" />
                    </div>
                  </div>
                  <div className="sm:col-span-2 space-y-1.5">
                    <Label className="text-xs">Location</Label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input value={profileData.location} onChange={(e) => setProfileData({ ...profileData, location: e.target.value })} className="pl-10" placeholder="e.g. Soweto Market, Lusaka" />
                    </div>
                  </div>
                  <div className="sm:col-span-2 space-y-1.5">
                    <Label className="text-xs">Bio</Label>
                    <Textarea value={profileData.bio} onChange={(e) => setProfileData({ ...profileData, bio: e.target.value })} rows={3} placeholder="Tell us about yourself..." className="resize-none" />
                  </div>
                </div>

                {/* Interested Categories */}
                <div className="mt-4 space-y-2">
                  <Label className="text-xs">Interests</Label>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {interestedCategories.map((cat) => (
                      <span key={cat} className="flex items-center gap-1 text-xs bg-primary/10 text-brand rounded-full px-2 py-1">
                        {cat}
                        <button onClick={() => setInterestedCategories((prev) => prev.filter((c) => c !== cat))} className="ml-0.5">
                          <span className="text-brand/60 hover:text-brand">x</span>
                        </button>
                      </span>
                    ))}
                    {interestedCategories.length === 0 && <span className="text-xs text-muted-foreground">No interests selected</span>}
                  </div>
                  <button onClick={() => setShowCategories(!showCategories)} className="text-xs text-brand hover:text-brand/80">
                    {showCategories ? "Hide options" : "+ Add interests"}
                  </button>
                  {showCategories && (
                    <div className="flex flex-wrap gap-1.5 p-2 bg-muted/50 rounded-lg">
                      {["Electronics", "Fashion", "Food & Groceries", "Health & Beauty", "Home & Garden", "Sports", "Automotive", "Phone Accessories", "Jewelry", "Baby & Kids", "Furniture", "Books", "Toys"].filter((c) => !interestedCategories.includes(c)).map((cat) => (
                        <button key={cat} onClick={() => setInterestedCategories((prev) => [...prev, cat])} className="px-2 py-1 bg-background border border-border rounded text-[10px] hover:border-primary/50 transition-colors">
                          + {cat}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <Button
                  className="mt-4 bg-primary text-primary-foreground hover:bg-primary/90"
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : saved ? <Check className="h-4 w-4 mr-2" /> : null}
                  {saving ? "Saving..." : saved ? "Saved!" : "Save Changes"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notifications">
            <Card className="bg-card border-border">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between py-2">
                  <div>
                    <span className="text-sm font-medium">Push Notifications</span>
                    <p className="text-[10px] text-muted-foreground">Get notified about deals, messages, and updates</p>
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
                {["Deal Updates", "New Messages", "Order Status", "Promotions"].map((item) => (
                  <div key={item} className="flex items-center justify-between py-2 pl-4 border-l-2 border-border">
                    <span className="text-sm">{item}</span>
                    <input type="checkbox" defaultChecked disabled={!notificationsEnabled} className="accent-primary rounded" />
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="privacy">
            <Card className="bg-card border-border">
              <CardContent className="p-4 space-y-4">
                <div className="flex items-center justify-between py-2">
                  <div>
                    <span className="text-sm font-medium">Location Sharing</span>
                    <p className="text-[10px] text-muted-foreground">Allow the app to use your GPS location</p>
                  </div>
                  <button
                    onClick={() => {
                      if (!locationSharing) {
                        setLocationLoading(true);
                        if (navigator.geolocation) {
                          navigator.geolocation.getCurrentPosition(
                            (position) => {
                              setLocationSharing(true);
                              setLocationLoading(false);
                              // Reverse geocode to get location name
                              fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${position.coords.latitude}&lon=${position.coords.longitude}`)
                                .then((r) => r.json())
                                .then((data) => {
                                  const city = data.address?.suburb || data.address?.city || data.address?.town || data.address?.village || "";
                                  const country = data.address?.country || "";
                                  const locationName = city ? `${city}, ${country}` : currentLocation || "Lusaka, Zambia";
                                  setCurrentLocation(locationName);
                                  // Save to profile
                                  if (user?.id) {
                                    fetch("/api/user/profile", {
                                      method: "PUT",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify({ userId: user.id, location: locationName }),
                                    });
                                    updateUser({ location: locationName });
                                  }
                                })
                                .catch(() => {});
                            },
                            () => {
                              setLocationLoading(false);
                              alert("Location access denied. Please enable location in your browser settings.");
                            },
                            { enableHighAccuracy: true, timeout: 10000 }
                          );
                        } else {
                          setLocationLoading(false);
                          alert("Geolocation is not supported by this browser.");
                        }
                      } else {
                        setLocationSharing(false);
                      }
                    }}
                    disabled={locationLoading}
                    className={`relative w-11 h-6 rounded-full transition-colors ${locationSharing ? "bg-primary" : "bg-muted"}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${locationSharing ? "translate-x-5" : ""}`} />
                  </button>
                </div>
                {locationSharing && currentLocation && (
                  <div className="p-3 bg-muted/50 rounded-lg flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-brand" />
                    <span className="text-xs text-muted-foreground">{currentLocation}</span>
                  </div>
                )}
                <div className="flex items-center justify-between py-2">
                  <div>
                    <span className="text-sm font-medium">Profile Visibility</span>
                    <p className="text-[10px] text-muted-foreground">Show your profile to other users</p>
                  </div>
                  <button className="relative w-11 h-6 rounded-full bg-primary">
                    <span className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full translate-x-5" />
                  </button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Button variant="ghost" className="mt-6 w-full text-destructive hover:text-destructive hover:bg-destructive/10" onClick={handleLogout}>
          <LogOut className="h-4 w-4 mr-2" />Sign Out
        </Button>
      </div>
    </div>
  );
}
