import { cn } from "@/lib/utils";
import { type ButtonHTMLAttributes, forwardRef } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "outline" | "ghost" | "destructive";
  size?: "sm" | "md" | "lg" | "icon";
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "md", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed",
          variant === "default" && "bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500",
          variant === "outline" && "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 focus:ring-blue-500",
          variant === "ghost" && "text-gray-600 hover:bg-gray-100 hover:text-gray-900 focus:ring-gray-500",
          variant === "destructive" && "bg-red-600 text-white hover:bg-red-700 focus:ring-red-500",
          size === "sm" && "px-3 py-1.5 text-xs",
          size === "md" && "px-4 py-2 text-sm",
          size === "lg" && "px-5 py-2.5 text-sm",
          size === "icon" && "p-2",
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
