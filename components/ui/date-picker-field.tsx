"use client";

import * as React from "react";
import { format, parse, isValid } from "date-fns";
import { CalendarIcon } from "lucide-react";

import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const ISO = "yyyy-MM-dd";

function parseISODate(value?: string | null): Date | undefined {
  if (!value) return undefined;
  const parsed = parse(value, ISO, new Date());
  return isValid(parsed) ? parsed : undefined;
}

function toISODate(date: Date): string {
  return format(date, ISO);
}

export function DatePickerField({
  id,
  name,
  value,
  defaultValue,
  onChange,
  placeholder = "Pick a date",
  disabled,
  required,
  min,
  max,
  className,
  buttonClassName,
  align = "start",
}: {
  id?: string;
  name?: string;
  /** Controlled ISO date `yyyy-MM-dd`. */
  value?: string;
  defaultValue?: string;
  onChange?: (iso: string) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  /** ISO min/max bounds. */
  min?: string;
  max?: string;
  className?: string;
  buttonClassName?: string;
  align?: "start" | "center" | "end";
}) {
  const isControlled = value !== undefined;
  const [open, setOpen] = React.useState(false);
  const [internal, setInternal] = React.useState(defaultValue ?? "");
  const iso = isControlled ? value ?? "" : internal;
  const selected = parseISODate(iso);
  const minDate = parseISODate(min);
  const maxDate = parseISODate(max);

  const setIso = (next: string) => {
    if (!isControlled) setInternal(next);
    onChange?.(next);
  };

  return (
    <div className={cn("w-full min-w-0", className)}>
      {name ? <input type="hidden" name={name} value={iso} required={required} /> : null}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            disabled={disabled}
            aria-required={required}
            className={cn(
              "h-10 w-full min-w-0 shrink justify-start overflow-hidden rounded-xl border-border/80 bg-muted/45 px-2.5 text-left text-sm font-normal shadow-sm hover:bg-muted/60 sm:px-3.5",
              !iso && "text-muted-foreground",
              buttonClassName
            )}
          >
            <CalendarIcon className="size-4 shrink-0 text-muted-foreground" />
            {selected ? (
              <span className="min-w-0 truncate tabular-nums">{format(selected, "dd MMM yyyy")}</span>
            ) : (
              <span className="min-w-0 truncate">{placeholder}</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align={align}
          className="w-auto overflow-hidden rounded-2xl border-border/70 p-0 shadow-xl"
        >
          <Calendar
            mode="single"
            selected={selected}
            defaultMonth={selected ?? maxDate ?? minDate ?? new Date()}
            captionLayout="dropdown"
            disabled={[
              ...(minDate ? [{ before: minDate }] : []),
              ...(maxDate ? [{ after: maxDate }] : []),
            ]}
            onSelect={(date) => {
              if (!date) return;
              setIso(toISODate(date));
              setOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
