"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Image from "next/image";
import { apiPost } from "@/lib/api-client";
import { CloudRain, Thermometer, SpinnerGap, Check } from "@phosphor-icons/react";
import { toast } from "sonner";

const weatherSchema = z.object({
  temperature_c: z.coerce.number().min(-50).max(60),
  rainfall_mm: z.coerce.number().min(0).max(500),
});

type WeatherFormData = z.infer<typeof weatherSchema>;

interface WeatherPanelProps {
  contractId: string;
  disabled?: boolean;
  emulatorActive?: boolean;
}

function randomWeather(): WeatherFormData {
  return {
    temperature_c: Math.round((15 + Math.random() * 20) * 10) / 10,
    rainfall_mm: Math.round(Math.random() * 30 * 10) / 10,
  };
}

export function WeatherPanel({ contractId, disabled, emulatorActive }: WeatherPanelProps) {
  const t = useTranslations("emulator");
  const queryClient = useQueryClient();
  const autoSendRef = useRef(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<WeatherFormData>({
    resolver: zodResolver(weatherSchema) as never,
    defaultValues: { temperature_c: 22, rainfall_mm: 0 },
  });

  const mutation = useMutation({
    mutationFn: (data: WeatherFormData) =>
      apiPost("/api/data/weather", {
        contract_id: contractId,
        ...data,
      }),
    onSuccess: () => {
      if (!autoSendRef.current) toast.success(t("weather.success"));
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (err) => {
      if (!autoSendRef.current)
        toast.error(err instanceof Error ? err.message : t("error"));
    },
  });

  // Auto-generate a reading every 60s while the emulator is running
  useEffect(() => {
    if (!emulatorActive) return;
    const interval = setInterval(() => {
      autoSendRef.current = true;
      mutation.mutate(randomWeather(), {
        onSettled: () => { autoSendRef.current = false; },
      });
    }, 60_000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emulatorActive, contractId]);

  return (
    <Card>
      <CardHeader className="flex flex-col items-center gap-2 pb-2">
        <Image src="/weather.png" alt="" width={108} height={108} className="object-contain drop-shadow-md" />
        <CardTitle className="text-sm font-medium text-text-secondary">
          {t("weather.title")}
        </CardTitle>
        {emulatorActive && (
          <span className="flex items-center gap-1.5 text-[10px] text-success">
            <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
            {t("weather.autoActive")}
          </span>
        )}
      </CardHeader>
      <CardContent>
        <form
          onSubmit={handleSubmit((data: WeatherFormData) => mutation.mutate(data))}
          className="space-y-3"
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="temperature" className="text-xs">
                <Thermometer className="mr-1 inline h-3 w-3" weight="duotone" />
                {t("weather.temperature")}
              </Label>
              <Input
                id="temperature"
                type="number"
                step="0.1"
                {...register("temperature_c")}
                error={!!errors.temperature_c}
                disabled={disabled}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rainfall" className="text-xs">
                <CloudRain className="mr-1 inline h-3 w-3" weight="duotone" />
                {t("weather.rainfall")}
              </Label>
              <Input
                id="rainfall"
                type="number"
                step="0.1"
                {...register("rainfall_mm")}
                error={!!errors.rainfall_mm}
                disabled={disabled}
              />
            </div>
          </div>
          <Button
            type="submit"
            size="sm"
            className="w-full"
            disabled={mutation.isPending || disabled}
          >
            {mutation.isPending ? (
              <SpinnerGap className="mr-2 h-4 w-4 animate-spin" />
            ) : mutation.isSuccess ? (
              <Check className="mr-2 h-4 w-4" weight="bold" />
            ) : null}
            {t("weather.submit")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
