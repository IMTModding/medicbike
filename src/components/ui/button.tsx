import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold ring-offset-background transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-5 [&_svg]:shrink-0 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default: "bg-gradient-to-r from-primary to-primary-glow text-primary-foreground hover:shadow-xl hover:shadow-primary/30 shadow-lg shadow-primary/25 hover:-translate-y-0.5",
        destructive: "bg-gradient-to-r from-destructive to-destructive-glow text-destructive-foreground hover:shadow-xl hover:shadow-destructive/30 shadow-lg shadow-destructive/25 hover:-translate-y-0.5",
        outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground hover:border-primary/50",
        secondary: "bg-gradient-to-r from-secondary to-accent text-secondary-foreground hover:shadow-lg hover:shadow-secondary/20 hover:-translate-y-0.5",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        success: "bg-gradient-to-r from-success to-success-glow text-success-foreground hover:shadow-xl hover:shadow-success/30 shadow-lg shadow-success/25 hover:-translate-y-0.5",
        available: "bg-gradient-to-r from-success to-success-glow text-success-foreground shadow-lg shadow-success/30 hover:shadow-xl hover:shadow-success/40 hover:-translate-y-0.5",
        unavailable: "bg-gradient-to-r from-urgent to-urgent-glow text-urgent-foreground shadow-lg shadow-urgent/30 hover:shadow-xl hover:shadow-urgent/40 hover:-translate-y-0.5",
        admin: "bg-gradient-to-r from-admin to-admin-glow text-admin-foreground hover:shadow-xl hover:shadow-admin/30 shadow-lg shadow-admin/25 hover:-translate-y-0.5",
        creator: "bg-gradient-to-r from-creator to-creator-glow text-creator-foreground hover:shadow-xl hover:shadow-creator/30 shadow-lg shadow-creator/25 hover:-translate-y-0.5",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-12 rounded-lg px-8 text-base",
        xl: "h-14 rounded-xl px-6 text-lg",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
