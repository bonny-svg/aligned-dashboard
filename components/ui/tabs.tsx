"use client";

import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";

export const Tabs = TabsPrimitive.Root;

export function TabsList({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <TabsPrimitive.List
      className={cn(
        "flex space-x-1 border-b border-gray-200",
        className
      )}
    >
      {children}
    </TabsPrimitive.List>
  );
}

export function TabsTrigger({
  value,
  children,
  className,
}: {
  value: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <TabsPrimitive.Trigger
      value={value}
      className={cn(
        "px-4 py-2.5 text-sm font-medium text-gray-500 border-b-2 border-transparent -mb-px transition-colors",
        "hover:text-gray-700 hover:border-gray-300",
        "data-[state=active]:text-blue-600 data-[state=active]:border-blue-600",
        className
      )}
    >
      {children}
    </TabsPrimitive.Trigger>
  );
}

export function TabsContent({
  value,
  children,
  className,
}: {
  value: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <TabsPrimitive.Content
      value={value}
      className={cn("pt-5", className)}
    >
      {children}
    </TabsPrimitive.Content>
  );
}
