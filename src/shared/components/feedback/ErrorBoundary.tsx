import { Component, type ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCcw } from "lucide-react";

interface Props { children: ReactNode; fallbackMessage?: string; }
interface State { hasError: boolean; error?: Error; }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <Card className="border-destructive/30 m-4">
          <CardContent className="p-6 text-center space-y-3">
            <AlertTriangle className="h-10 w-10 text-destructive mx-auto" />
            <h3 className="font-display font-semibold text-foreground">حدث خطأ غير متوقع</h3>
            <p className="text-sm text-muted-foreground">{this.props.fallbackMessage || "حاول تحديث الصفحة"}</p>
            <Button variant="outline" className="gap-2" onClick={() => this.setState({ hasError: false })}>
              <RefreshCcw className="h-4 w-4" /> إعادة المحاولة
            </Button>
          </CardContent>
        </Card>
      );
    }
    return this.props.children;
  }
}
