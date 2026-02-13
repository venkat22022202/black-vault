"use client";

import { Settings, User, Bell, CreditCard, Shield } from "lucide-react";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
          <Settings className="w-6 h-6 text-text-secondary" />
          Settings
        </h1>
        <p className="text-sm text-text-secondary mt-1">
          Manage your account, notifications, and billing.
        </p>
      </div>

      <div className="grid gap-4 max-w-2xl">
        {[
          {
            icon: User,
            title: "Profile",
            description: "Update your display name, bio, and avatar",
          },
          {
            icon: Bell,
            title: "Notifications",
            description: "Configure budget alerts and activity digests",
          },
          {
            icon: CreditCard,
            title: "Billing",
            description: "Manage your plan and payment methods",
          },
          {
            icon: Shield,
            title: "Security",
            description: "Two-factor authentication and session management",
          },
        ].map((item) => (
          <div
            key={item.title}
            className="flex items-center gap-4 rounded-xl border border-void-300 bg-void-50 p-5 hover:border-void-400 transition-all cursor-pointer"
          >
            <div className="w-10 h-10 rounded-lg bg-void-200 flex items-center justify-center">
              <item.icon className="w-5 h-5 text-text-muted" />
            </div>
            <div>
              <div className="text-sm font-medium text-text-primary">
                {item.title}
              </div>
              <div className="text-xs text-text-muted">{item.description}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
