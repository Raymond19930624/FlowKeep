
"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker } from "react-day-picker"
import { zhTW } from "date-fns/locale"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  const [month, setMonth] = React.useState(props.selected as Date || props.month || props.defaultMonth || new Date());
  
  React.useEffect(() => {
    if (props.selected && props.selected instanceof Date) {
      setMonth(props.selected);
    }
  }, [props.selected]);

  const currentYear = new Date().getFullYear();

  return (
    <DayPicker
      locale={zhTW}
      weekStartsOn={1}
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-4",
        caption: "flex justify-center pt-1 relative items-center",
        caption_label: "hidden",
        caption_dropdowns: "flex flex-row-reverse justify-center gap-1",
        nav: "space-x-1 flex items-center",
        nav_button: cn(
          buttonVariants({ variant: "outline" }),
          "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100"
        ),
        nav_button_previous: "absolute left-1",
        nav_button_next: "absolute right-1",
        table: "w-full border-collapse space-y-1",
        head_row: "flex",
        head_cell:
          "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]",
        row: "flex w-full mt-2",
        cell: "h-9 w-9 text-center text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
        day: cn(
          buttonVariants({ variant: "ghost" }),
          "h-9 w-9 p-0 font-normal aria-selected:opacity-100"
        ),
        day_range_end: "day-range-end",
        day_selected:
          "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
        day_today: "bg-accent text-accent-foreground",
        day_outside:
          "day-outside text-muted-foreground aria-selected:bg-accent/50 aria-selected:text-muted-foreground",
        day_disabled: "text-muted-foreground opacity-50",
        day_range_middle:
          "aria-selected:bg-accent aria-selected:text-accent-foreground",
        day_hidden: "invisible",
        ...classNames,
      }}
      month={month}
      onMonthChange={setMonth}
      components={{
        IconLeft: ({ ...props }) => <ChevronLeft className="h-4 w-4" {...props} />,
        IconRight: ({ ...props }) => <ChevronRight className="h-4 w-4" {...props} />,
        Dropdown: (dropdownProps) => {
            const { name, value, onChange, children } = dropdownProps as any;
            const options = React.Children.toArray(children) as React.ReactElement<React.HTMLProps<HTMLOptionElement>>[];
            const selected = options.find((child) => child.props.value === value);
            const handleChange = (newValue: string) => {
              const event = {
                target: { value: newValue },
              } as React.ChangeEvent<HTMLSelectElement>;
              onChange?.(event);
            };

            let triggerDisplay: React.ReactNode;
            if (name === 'months') {
              triggerDisplay = `${Number(value) + 1}月`;
            } else if (name === 'years') {
              triggerDisplay = `${value}年`;
            } else {
              triggerDisplay = selected?.props.children;
            }

            return (
              <Select
                value={value?.toString()}
                onValueChange={(value) => {
                  handleChange(value);
                }}
              >
                <SelectTrigger className="h-7 w-auto px-2 py-1 text-sm focus:ring-0">
                  <SelectValue>
                    {triggerDisplay}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent position="popper" className="max-h-60">
                  {options.map((option) => {
                    let optionDisplay: React.ReactNode;
                     if (name === 'months') {
                        optionDisplay = `${Number(option.props.value) + 1}月`;
                    } else if (name === 'years') {
                        optionDisplay = `${option.props.value}年`;
                    } else {
                        optionDisplay = option.props.children;
                    }
                    return (
                        <SelectItem
                          key={option.props.value}
                          value={option.props.value?.toString() ?? ""}
                        >
                         {optionDisplay}
                        </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            );
        },
      }}
      captionLayout="dropdown-buttons"
      fromYear={currentYear - 20}
      toYear={currentYear + 5}
      {...props}
    />
  )
}
Calendar.displayName = "Calendar"

export { Calendar }
