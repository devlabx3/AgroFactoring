"use client";

import { useState } from "react";
import Image from "next/image";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { Warning, SpinnerGap, Lock, User, Eye, EyeSlash, UserCircle, Tractor } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useAuth } from "../hooks/use-auth";
import { loginSchema, type LoginFormData } from "../schemas/login-schema";

export function LoginForm() {
  const t = useTranslations("login");
  const { login } = useAuth();

  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    try {
      await login.mutateAsync(data);
    } catch {
      // Error handled by mutation state
    }
  };

  return (
    <Card className="w-full max-w-md border-0 shadow-xl">
      <CardHeader className="text-center pb-2">
        <div className="mx-auto mb-4">
          <Image
            src="/logo-full.png"
            alt="AgroFactoring"
            width={360}
            height={120}
            className="h-24 w-auto"
            priority
          />
        </div>
        <h1 className="text-xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-text-secondary">{t("subtitle")}</p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {login.error && (
            <div className="flex items-start gap-2 rounded-md bg-danger/10 p-3 text-sm text-danger">
              <Warning weight="duotone" className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                {login.error.message === "Credenciales invalidas" ||
                login.error.message === "Invalid credentials"
                  ? t("errors.invalidCredentials")
                  : t("errors.serverError")}
              </span>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="username">{t("username")}</Label>
            <div className="relative">
              <User weight="duotone" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
              <Input
                id="username"
                placeholder={t("usernamePlaceholder")}
                className="pl-10"
                error={!!errors.username}
                {...register("username")}
              />
            </div>
            {errors.username && (
              <p className="text-xs text-danger">
                {t("errors.usernameRequired")}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">{t("password")}</Label>
            <div className="relative">
              <Lock weight="duotone" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder={t("passwordPlaceholder")}
                className="pl-10 pr-10"
                error={!!errors.password}
                {...register("password")}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary"
              >
                {showPassword ? (
                  <EyeSlash weight="duotone" className="h-4 w-4" />
                ) : (
                  <Eye weight="duotone" className="h-4 w-4" />
                )}
              </button>
            </div>
            {errors.password && (
              <p className="text-xs text-danger">
                {t("errors.passwordRequired")}
              </p>
            )}
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={login.isPending}
          >
            {login.isPending ? (
              <>
                <SpinnerGap className="h-4 w-4 animate-spin" />
                {t("submitting")}
              </>
            ) : (
              t("submit")
            )}
          </Button>
        </form>

        <div className="mt-4 rounded-lg border border-border bg-muted/30 p-3">
          <p className="mb-2 text-center text-xs font-medium text-text-secondary">
            {t("demo.title")}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setValue("username", "exportador");
                setValue("password", "expo2024");
              }}
              className="flex flex-col items-center gap-1 rounded-md border border-border bg-background p-2 text-center transition hover:border-accent hover:bg-accent/5"
            >
              <UserCircle weight="duotone" className="h-6 w-6 text-accent" />
              <span className="text-xs font-medium">{t("demo.exporter")}</span>
              <span className="font-mono text-[10px] text-text-muted">exportador</span>
              <span className="font-mono text-[10px] text-text-muted">expo2024</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setValue("username", "agricultor");
                setValue("password", "agro2024");
              }}
              className="flex flex-col items-center gap-1 rounded-md border border-border bg-background p-2 text-center transition hover:border-success hover:bg-success/5"
            >
              <Tractor weight="duotone" className="h-6 w-6 text-success" />
              <span className="text-xs font-medium">{t("demo.farmer")}</span>
              <span className="font-mono text-[10px] text-text-muted">agricultor</span>
              <span className="font-mono text-[10px] text-text-muted">agro2024</span>
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
