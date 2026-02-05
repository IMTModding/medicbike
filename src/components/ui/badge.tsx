import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-gradient-to-r from-primary to-primary-glow text-primary-foreground shadow-sm shadow-primary/20 hover:shadow-md hover:shadow-primary/30",
        secondary: "border-transparent bg-gradient-to-r from-secondary to-accent text-secondary-foreground hover:shadow-sm",
        destructive: "border-transparent bg-gradient-to-r from-destructive to-destructive-glow text-destructive-foreground shadow-sm shadow-destructive/20 hover:shadow-md hover:shadow-destructive/30",
        outline: "text-foreground border-border/50",
        success: "border-transparent bg-gradient-to-r from-success to-success-glow text-success-foreground shadow-sm shadow-success/20 hover:shadow-md hover:shadow-success/30",
        warning: "border-transparent bg-gradient-to-r from-warning to-warning-glow text-warning-foreground shadow-sm shadow-warning/20 hover:shadow-md hover:shadow-warning/30",
        admin: "border-transparent bg-gradient-to-r from-admin to-admin-glow text-admin-foreground shadow-sm shadow-admin/20 hover:shadow-md hover:shadow-admin/30",
        creator: "border-transparent bg-gradient-to-r from-creator to-creator-glow text-creator-foreground shadow-sm shadow-creator/20 hover:shadow-md hover:shadow-creator/30",
        urgent: "border-transparent bg-gradient-to-r from-urgent to-urgent-glow text-urgent-foreground shadow-sm shadow-urgent/20 hover:shadow-md hover:shadow-urgent/30 animate-pulse",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
