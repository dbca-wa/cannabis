import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { DollarSign, Mail, Server } from "lucide-react";

// Loading skeleton for the System Info Card
export const SystemInfoCardSkeleton: React.FC = () => {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Server className="h-5 w-5" />
                        <span>System Information</span>
                        <Skeleton className="h-6 w-20" />
                    </div>
                    <Skeleton className="h-8 w-24" />
                </CardTitle>
                <CardDescription>
                    <Skeleton className="h-4 w-64" />
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-6">
                    {/* Environment Overview */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <Skeleton className="h-4 w-4" />
                            <Skeleton className="h-5 w-32" />
                        </div>
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-3/4" />

                        {/* Expandable section placeholder */}
                        <div className="flex items-center gap-1">
                            <Skeleton className="h-4 w-4" />
                            <Skeleton className="h-4 w-48" />
                        </div>
                    </div>

                    <div className="border-t pt-6">
                        {/* Audit Information */}
                        <div className="space-y-3">
                            <div className="flex items-center gap-2">
                                <Skeleton className="h-4 w-4" />
                                <Skeleton className="h-5 w-24" />
                            </div>

                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Skeleton className="h-4 w-12" />
                                    <Skeleton className="h-4 w-20" />
                                </div>
                                <div className="flex items-center justify-between">
                                    <Skeleton className="h-4 w-8" />
                                    <Skeleton className="h-4 w-32" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};

// Loading skeleton for the Email Settings Card
export const EmailSettingsCardSkeleton: React.FC = () => {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Mail className="h-5 w-5" />
                    <span>Email Configuration</span>
                    <Skeleton className="h-6 w-20" />
                </CardTitle>
                <CardDescription>
                    <Skeleton className="h-4 w-56" />
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-6">
                    {/* Email Routing Status */}
                    <div className="p-4 border rounded-lg bg-muted/50">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <Skeleton className="h-4 w-4" />
                                <Skeleton className="h-5 w-24" />
                                <Skeleton className="h-6 w-16" />
                            </div>
                        </div>
                        <Skeleton className="h-4 w-full mb-3" />

                        {/* Toggle section */}
                        <div className="flex items-center justify-between">
                            <div className="space-y-1">
                                <Skeleton className="h-4 w-48" />
                                <Skeleton className="h-3 w-64" />
                            </div>
                            <Skeleton className="h-6 w-11 rounded-full" />
                        </div>
                    </div>

                    {/* Admin Email Configuration */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <Skeleton className="h-4 w-32" />
                            <Skeleton className="h-4 w-4" />
                        </div>
                        <div className="flex items-center gap-3">
                            <Skeleton className="h-11 flex-1" />
                            <Skeleton className="h-9 w-16" />
                        </div>
                    </div>

                    <div className="pt-4 border-t">
                        <Skeleton className="h-10 w-36" />
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};

// Loading skeleton for the Pricing Settings Card
export const PricingSettingsCardSkeleton: React.FC = () => {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5" />
                    <span>Pricing Configuration</span>
                </CardTitle>
                <CardDescription>
                    <Skeleton className="h-4 w-72" />
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {/* Pricing fields grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {Array.from({ length: 6 }).map((_, index) => (
                            <div key={index} className="space-y-1">
                                <div className="flex items-center gap-2">
                                    <Skeleton className="h-4 w-24" />
                                    <Skeleton className="h-3 w-3" />
                                </div>
                                <Skeleton className="h-6 w-16" />
                                <Skeleton className="h-3 w-full" />
                            </div>
                        ))}
                    </div>

                    <div className="pt-4 border-t">
                        <Skeleton className="h-10 w-40" />
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};

// Combined loading skeleton for the entire admin page
export const AdminPageSkeleton: React.FC = () => {
    return (
        <div className="container mx-auto p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Skeleton className="h-6 w-6" />
                    <Skeleton className="h-8 w-32" />
                </div>
                <div className="flex items-center gap-3">
                    <Skeleton className="h-9 w-32" />
                </div>
            </div>

            {/* Settings cards */}
            <div className="grid gap-6">
                <SystemInfoCardSkeleton />
                <EmailSettingsCardSkeleton />
                <PricingSettingsCardSkeleton />
            </div>
        </div>
    );
};