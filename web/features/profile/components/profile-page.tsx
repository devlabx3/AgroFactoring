"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { DashboardSkeleton } from "@/features/dashboard/components/skeletons/dashboard-skeleton";
import { apiGet, apiPost, ApiError } from "@/lib/api-client";
import { User, Wallet, Envelope, Warning, SpinnerGap, Check } from "@phosphor-icons/react";
import { motion } from "motion/react";

interface ProfileData {
  id: string;
  role: string;
  username: string;
  wallet_address: string | null;
  full_name: string | null;
  email: string | null;
}

export function ProfilePage() {
  const t = useTranslations("profile");
  const tc = useTranslations("common");
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [walletAddress, setWalletAddress] = useState("");

  useEffect(() => {
    apiGet<{ success: boolean; profile: ProfileData }>("/api/profile")
      .then((res) => {
        setProfile(res.profile);
        setFullName(res.profile.full_name ?? "");
        setEmail(res.profile.email ?? "");
        setWalletAddress(res.profile.wallet_address ?? "");
      })
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : "Error");
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const res = await apiPost<{ success: boolean; profile: ProfileData }>(
        "/api/profile/update",
        {
          full_name: fullName,
          email,
          wallet_address: walletAddress,
        }
      );
      setProfile(res.profile);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <DashboardSkeleton />;
  if (!profile) return <p className="text-danger">{error ?? "Error"}</p>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <Badge variant={profile.role === "exporter" ? "default" : "success"}>
          {tc(`roles.${profile.role}`)}
        </Badge>
      </div>

      {success && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 rounded-md bg-success/10 p-3 text-sm text-success"
        >
          <Check weight="bold" className="h-4 w-4 shrink-0" />
          {t("saved")}
        </motion.div>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-md bg-danger/10 p-3 text-sm text-danger">
          <Warning weight="duotone" className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Profile form */}
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>{t("sectionTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Username (read-only) */}
          <div className="space-y-2">
            <Label htmlFor="username">{t("username")}</Label>
            <div className="relative">
              <User weight="duotone" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
              <Input
                id="username"
                value={profile.username}
                disabled
                className="pl-10 bg-muted/30"
              />
            </div>
            <p className="text-xs text-text-muted">{t("usernameHint")}</p>
          </div>

          {/* Full name */}
          <div className="space-y-2">
            <Label htmlFor="fullName">{t("fullName")}</Label>
            <Input
              id="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder={t("fullNamePlaceholder")}
            />
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="email">{t("email")}</Label>
            <div className="relative">
              <Envelope weight="duotone" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("emailPlaceholder")}
                className="pl-10"
              />
            </div>
          </div>

          {/* Wallet address */}
          <div className="space-y-2">
            <Label htmlFor="walletAddress">{t("walletAddress")}</Label>
            <div className="relative">
              <Wallet weight="duotone" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
              <Input
                id="walletAddress"
                value={walletAddress}
                onChange={(e) => setWalletAddress(e.target.value)}
                placeholder={t("walletPlaceholder")}
                className="pl-10 font-mono text-sm"
              />
            </div>
            <p className="text-xs text-text-muted">{t("walletHint")}</p>
          </div>

          {/* Save button */}
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving ? (
              <>
                <SpinnerGap className="h-4 w-4 animate-spin" />
                {t("saving")}
              </>
            ) : (
              t("save")
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}