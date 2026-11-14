"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { KeyRound, LogOut, MapPin, UserRound } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import AccountHeading from "@/components/account/AccountHeading";

export default function SettingsPage() {
  const router = useRouter();
  const { user, logout, updateUser } = useAuthStore();
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

  const handleLogout = () => { logout(); router.push("/"); };

  return (
    <>
      <AccountHeading title="Settings" description="Appearance, alerts, privacy and sign-in." />
      <div className="max-w-2xl space-y-4">
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

        <h2 className="pt-2 text-sm font-semibold">Notifications</h2>
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

        <h2 className="pt-2 text-sm font-semibold">Privacy</h2>
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

        <h2 className="pt-2 text-sm font-semibold">Account</h2>
        <Card className="bg-card border-border">
          <CardContent className="divide-y divide-border p-0">
            <Link href="/customer/profile" className="flex items-center gap-3 p-4 text-sm font-medium hover:bg-muted/50">
              <UserRound className="h-4 w-4 text-brand" /> Edit profile
            </Link>
            <Link href="/forgot-password" className="flex items-center gap-3 p-4 text-sm font-medium hover:bg-muted/50">
              <KeyRound className="h-4 w-4 text-brand" /> Change password
              <span className="ml-auto text-xs text-muted-foreground">We email you a link</span>
            </Link>
          </CardContent>
        </Card>

        <Button variant="ghost" className="w-full text-destructive hover:text-destructive hover:bg-destructive/10" onClick={handleLogout}>
          <LogOut className="h-4 w-4 mr-2" />Sign Out
        </Button>
      </div>
    </>
  );
}
