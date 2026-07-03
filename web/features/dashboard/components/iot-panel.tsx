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
import { Leaf, Drop, SpinnerGap, Check } from "@phosphor-icons/react";
import { toast } from "sonner";

const iotSchema = z.object({
  ndvi_index: z.coerce.number().min(0).max(1),
  soil_moisture: z.coerce.number().min(0).max(100),
});

type IoTFormData = z.infer<typeof iotSchema>;

interface IoTPanelProps {
  contractId: string;
  disabled?: boolean;
  emulatorActive?: boolean;
}

function randomIoT(): IoTFormData {
  return {
    ndvi_index: Math.round((0.4 + Math.random() * 0.5) * 100) / 100,
    soil_moisture: Math.round((20 + Math.random() * 60) * 10) / 10,
  };
}

export function IoTPanel({ contractId, disabled, emulatorActive }: IoTPanelProps) {
  const t = useTranslations("emulator");
  const queryClient = useQueryClient();
  const autoSendRef = useRef(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<IoTFormData>({
    resolver: zodResolver(iotSchema) as never,
    defaultValues: { ndvi_index: 0.7, soil_moisture: 45 },
  });

  const mutation = useMutation({
    mutationFn: (data: IoTFormData) =>
      apiPost("/api/data/iot", {
        contract_id: contractId,
        ...data,
      }),
    onSuccess: () => {
      if (!autoSendRef.current) toast.success(t("iot.success"));
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
      mutation.mutate(randomIoT(), {
        onSettled: () => { autoSendRef.current = false; },
      });
    }, 60_000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emulatorActive, contractId]);

  return (
    <Card>
      <CardHeader className="flex flex-col items-center gap-2 pb-2">
        <Image src="/iot-sensor.png" alt="" width={108} height={108} className="object-contain drop-shadow-md" />
        <CardTitle className="text-sm font-medium text-text-secondary">
          {t("iot.title")}
        </CardTitle>
        {emulatorActive && (
          <span className="flex items-center gap-1.5 text-[10px] text-success">
            <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
            {t("iot.autoActive")}
          </span>
        )}
      </CardHeader>
      <CardContent>
        <form
          onSubmit={handleSubmit((data: IoTFormData) => mutation.mutate(data))}
          className="space-y-3"
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ndvi" className="text-xs">
                <Leaf className="mr-1 inline h-3 w-3" weight="duotone" />
                {t("iot.ndvi")}
              </Label>
              <Input
                id="ndvi"
                type="number"
                step="0.01"
                {...register("ndvi_index")}
                error={!!errors.ndvi_index}
                disabled={disabled}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="moisture" className="text-xs">
                <Drop className="mr-1 inline h-3 w-3" weight="duotone" />
                {t("iot.soilMoisture")}
              </Label>
              <Input
                id="moisture"
                type="number"
                step="0.1"
                {...register("soil_moisture")}
                error={!!errors.soil_moisture}
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
            {t("iot.submit")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
