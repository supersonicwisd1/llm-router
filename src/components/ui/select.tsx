'use client';

import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SelectProps {
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
  children: React.ReactNode;
}

export interface SelectTriggerProps {
  className?: string;
  children: React.ReactNode;
}

export interface SelectContentProps {
  className?: string;
  children: React.ReactNode;
  onSelect?: (value: string) => void;
}

export interface SelectItemProps {
  value: string;
  children: React.ReactNode;
  onSelect?: (value: string) => void;
}

export interface SelectValueProps {
  children?: React.ReactNode;
}

const Select = React.forwardRef<HTMLDivElement, SelectProps>(
  ({ value, onValueChange, disabled, children }, ref) => {
    const [isOpen, setIsOpen] = React.useState(false);
    const [selectedValue, setSelectedValue] = React.useState(value);

    const handleSelect = (newValue: string) => {
      setSelectedValue(newValue);
      onValueChange(newValue);
      setIsOpen(false);
    };

    return (
      <div ref={ref} className="relative">
        <div
          className={cn(
            "flex items-center justify-between w-full px-3 py-2 text-sm border rounded-md cursor-pointer",
            "bg-zinc-800 border-zinc-700 text-white",
            disabled && "opacity-50 cursor-not-allowed"
          )}
          onClick={() => !disabled && setIsOpen(!isOpen)}
        >
          <span>{selectedValue}</span>
          <ChevronDown className="h-4 w-4" />
        </div>
        
        {isOpen && (
          <div className="absolute z-50 w-full mt-1 bg-zinc-800 border border-zinc-700 rounded-md shadow-lg">
            {React.Children.map(children, (child) => {
              if (React.isValidElement(child) && child.type === SelectContent) {
                return React.cloneElement(child, {
                  onSelect: handleSelect
                } as SelectContentProps);
              }
              return child;
            })}
          </div>
        )}
      </div>
    );
  }
);
Select.displayName = 'Select';

const SelectTrigger = React.forwardRef<HTMLDivElement, SelectTriggerProps>(
  ({ className, children }, ref) => {
    return (
      <div ref={ref} className={cn("", className)}>
        {children}
      </div>
    );
  }
);
SelectTrigger.displayName = 'SelectTrigger';

const SelectContent = React.forwardRef<HTMLDivElement, SelectContentProps & { onSelect?: (value: string) => void }>(
  ({ className, children, onSelect }, ref) => {
    return (
      <div ref={ref} className={cn("py-1", className)}>
        {React.Children.map(children, (child) => {
          if (React.isValidElement(child) && child.type === SelectItem) {
            return React.cloneElement(child, {
              onSelect
            } as SelectItemProps);
          }
          return child;
        })}
      </div>
    );
  }
);
SelectContent.displayName = 'SelectContent';

const SelectItem = React.forwardRef<HTMLDivElement, SelectItemProps & { onSelect?: (value: string) => void }>(
  ({ value, children, onSelect }, ref) => {
    return (
      <div
        ref={ref}
        className="px-3 py-2 text-sm text-white hover:bg-zinc-700 cursor-pointer"
        onClick={() => onSelect?.(value)}
      >
        {children}
      </div>
    );
  }
);
SelectItem.displayName = 'SelectItem';

const SelectValue = React.forwardRef<HTMLSpanElement, SelectValueProps>(
  ({ children }, ref) => {
    return (
      <span ref={ref}>
        {children}
      </span>
    );
  }
);
SelectValue.displayName = 'SelectValue';

export { Select, SelectTrigger, SelectContent, SelectItem, SelectValue };
