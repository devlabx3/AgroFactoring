import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function LoginLoading() {
  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="space-y-2 text-center">
        <Skeleton className="mx-auto h-8 w-8 rounded-lg" />
        <Skeleton className="mx-auto h-6 w-40" />
        <Skeleton className="mx-auto h-4 w-56" />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-10 w-full" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-10 w-full" />
        </div>
        <Skeleton className="h-10 w-full" />
      </CardContent>
    </Card>
  );
}
