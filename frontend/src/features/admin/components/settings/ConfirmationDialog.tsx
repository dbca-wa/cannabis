import React from "react";
import { AlertTriangle, Shield, Settings } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";

interface ConfirmationDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    description: string;
    confirmText?: string;
    cancelText?: string;
    variant?: "default" | "destructive" | "warning";
    environment?: string;
    isLoading?: boolean;
    changes?: Array<{
        field: string;
        oldValue: string;
        newValue: string;
    }>;
}

const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
    isOpen,
    onClose,
    onConfirm,
    title,
    description,
    confirmText = "Confirm",
    cancelText = "Cancel",
    variant = "default",
    environment,
    isLoading = false,
    changes = [],
}) => {
    const getVariantIcon = () => {
        switch (variant) {
            case "destructive":
                return <AlertTriangle className="h-5 w-5 text-red-500" />;
            case "warning":
                return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
            default:
                return <Settings className="h-5 w-5 text-blue-500" />;
        }
    };

    const getEnvironmentBadge = () => {
        if (!environment) return null;

        const envConfig = {
            production: { color: "destructive", label: "PRODUCTION" },
            staging: { color: "secondary", label: "STAGING" },
            development: { color: "outline", label: "DEVELOPMENT" },
            local: { color: "outline", label: "LOCAL" },
        } as const;

        const config = envConfig[environment.toLowerCase() as keyof typeof envConfig];
        if (!config) return null;

        return (
            <Badge variant={config.color} className="mb-2">
                <Shield className="h-3 w-3 mr-1" />
                {config.label}
            </Badge>
        );
    };

    const isProductionEnvironment = environment?.toLowerCase() === "production";

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <div className="flex items-center gap-2">
                        {getVariantIcon()}
                        <DialogTitle>{title}</DialogTitle>
                    </div>
                    {getEnvironmentBadge()}
                    <DialogDescription className="text-left">
                        {description}
                        {isProductionEnvironment && (
                            <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                                <strong>Production Warning:</strong> These changes will immediately affect the live system.
                            </div>
                        )}
                    </DialogDescription>
                </DialogHeader>

                {changes.length > 0 && (
                    <div className="space-y-2">
                        <h4 className="text-sm font-medium">Changes to be made:</h4>
                        <div className="space-y-1 max-h-32 overflow-y-auto">
                            {changes.map((change, index) => (
                                <div key={index} className="text-xs bg-gray-50 p-2 rounded">
                                    <div className="font-medium">{change.field}:</div>
                                    <div className="text-gray-600">
                                        <span className="line-through">{change.oldValue}</span>
                                        {" → "}
                                        <span className="text-green-600">{change.newValue}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <DialogFooter className="flex gap-2">
                    <Button
                        variant="outline"
                        onClick={onClose}
                        disabled={isLoading}
                    >
                        {cancelText}
                    </Button>
                    <Button
                        variant={variant === "destructive" ? "destructive" : "default"}
                        onClick={onConfirm}
                        disabled={isLoading}
                    >
                        {isLoading ? "Processing..." : confirmText}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default ConfirmationDialog;