"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { Task } from "@/types/task";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { StatCard } from "@/components/stat-card";
import { Badge } from "@/components/ui/badge";
import { Search, Download, CalendarIcon, X, ChevronLeft, ChevronRight } from "lucide-react";
import { format, subDays, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";

// FOH Keywords - if these appear, suggest FOH (takes priority over BOH)
const FOH_KEYWORDS = [
  "plumber", "electrician", "tradesman", "handyman", "cleaner", "gardener",
  "book", "booking", "reserve", "reservation",
  "appointment", "availability",
  "confirm", "chase", "follow up", "follow-up"
];

// BOH Keywords for auto-categorisation (more specific, removed generic ones)
const BOH_KEYWORDS = [
  "research", "investigate", "explore", "compare", "review", "enquiry", "inquiry", "quote", "quotes",
  "itinerary", "accommodation", "hotel", "flight", "flights", "trip", "travel",
  "birthday planning", "wedding planning", "party planning", "gift ideas", "present ideas",
  "insurance", "application", "registration", "contract", "renewal",
  "property", "house", "renovation"
];

type SuggestionType = "boh" | "foh" | null;

function checkCategorySuggestion(taskName: string, taskDescription: string): SuggestionType {
  const text = `${taskName} ${taskDescription}`.toLowerCase();

  // Priority 1: Check for FOH keywords first
  const hasFohKeyword = FOH_KEYWORDS.some(keyword => text.includes(keyword.toLowerCase()));
  if (hasFohKeyword) {
    return "foh";
  }

  // Priority 2: Check for BOH keywords
  const hasBohKeyword = BOH_KEYWORDS.some(keyword => text.includes(keyword.toLowerCase()));
  if (hasBohKeyword) {
    return "boh";
  }

  // No suggestion - leave for manual classification
  return null;
}

type DatePreset = "all" | "today" | "7days" | "30days" | "thisMonth" | "lastMonth" | "custom";
type StatFilter = "all" | "boh" | "foh" | "unclassified";

const ITEMS_PER_PAGE = 20;

export function TasksTable() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filteredTasks, setFilteredTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  // Filter states
  const [assistantFilter, setAssistantFilter] = useState<string>("all");
  const [clientFilter, setClientFilter] = useState<string>("all");
  const [bohFohFilter, setBohFohFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [statFilter, setStatFilter] = useState<StatFilter>("all");

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);

  // Date filter states
  const [datePreset, setDatePreset] = useState<DatePreset>("all");
  const [dateRange, setDateRange] = useState<DateRange | undefined>();

  // Selection states
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Unique values for filters
  const [assistants, setAssistants] = useState<string[]>([]);
  const [clients, setClients] = useState<string[]>([]);

  // Stats
  const stats = useMemo(() => {
    const bohCount = tasks.filter((t) => t.boh).length;
    const fohCount = tasks.filter((t) => t.foh).length;
    const unclassifiedCount = tasks.filter((t) => !t.boh && !t.foh).length;
    const total = tasks.length;
    return {
      total,
      boh: bohCount,
      bohPercentage: total > 0 ? (bohCount / total) * 100 : 0,
      foh: fohCount,
      fohPercentage: total > 0 ? (fohCount / total) * 100 : 0,
      unclassified: unclassifiedCount,
      unclassifiedPercentage: total > 0 ? (unclassifiedCount / total) * 100 : 0,
    };
  }, [tasks]);

  // Category suggestions map (BOH or FOH)
  const categorySuggestions = useMemo(() => {
    const suggestions = new Map<string, SuggestionType>();
    tasks.forEach((task) => {
      const suggestion = checkCategorySuggestion(task.task_name, task.task_description);
      // Only suggest if the task isn't already marked with that category
      if (suggestion === "boh" && !task.boh) {
        suggestions.set(task.id, "boh");
      } else if (suggestion === "foh" && !task.foh) {
        suggestions.set(task.id, "foh");
      }
    });
    return suggestions;
  }, [tasks]);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching tasks:", error);
    } else if (data) {
      setTasks(data);
      const uniqueAssistants = [...new Set(data.map((t) => t.assistant).filter(Boolean))];
      const uniqueClients = [...new Set(data.map((t) => t.client).filter(Boolean))];
      setAssistants(uniqueAssistants);
      setClients(uniqueClients);
    }
    setLoading(false);
  }, []);

  // Get date range from preset
  const getDateRangeFromPreset = useCallback((preset: DatePreset): { from: Date | undefined; to: Date | undefined } => {
    const now = new Date();
    switch (preset) {
      case "today":
        return { from: new Date(now.setHours(0, 0, 0, 0)), to: new Date() };
      case "7days":
        return { from: subDays(now, 7), to: new Date() };
      case "30days":
        return { from: subDays(now, 30), to: new Date() };
      case "thisMonth":
        return { from: startOfMonth(now), to: endOfMonth(now) };
      case "lastMonth":
        const lastMonth = subMonths(now, 1);
        return { from: startOfMonth(lastMonth), to: endOfMonth(lastMonth) };
      default:
        return { from: undefined, to: undefined };
    }
  }, []);

  // Apply filters
  useEffect(() => {
    let result = tasks;

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (t) =>
          t.task_name?.toLowerCase().includes(query) ||
          t.task_description?.toLowerCase().includes(query)
      );
    }

    // Assistant filter
    if (assistantFilter !== "all") {
      result = result.filter((t) => t.assistant === assistantFilter);
    }

    // Client filter
    if (clientFilter !== "all") {
      result = result.filter((t) => t.client === clientFilter);
    }

    // BOH/FOH filter
    if (bohFohFilter === "boh") {
      result = result.filter((t) => t.boh === true);
    } else if (bohFohFilter === "foh") {
      result = result.filter((t) => t.foh === true);
    } else if (bohFohFilter === "both") {
      result = result.filter((t) => t.boh === true && t.foh === true);
    } else if (bohFohFilter === "none") {
      result = result.filter((t) => t.boh === false && t.foh === false);
    }

    // Date filter
    const effectiveDateRange = datePreset === "custom" ? dateRange : getDateRangeFromPreset(datePreset);
    if (effectiveDateRange?.from) {
      result = result.filter((t) => {
        const taskDate = new Date(t.created_at);
        const from = effectiveDateRange.from!;
        const to = effectiveDateRange.to || new Date();
        return taskDate >= from && taskDate <= to;
      });
    }

    // Stat card filter
    if (statFilter === "boh") {
      result = result.filter((t) => t.boh === true);
    } else if (statFilter === "foh") {
      result = result.filter((t) => t.foh === true);
    } else if (statFilter === "unclassified") {
      result = result.filter((t) => t.boh === false && t.foh === false);
    }

    setFilteredTasks(result);
    setCurrentPage(1); // Reset to first page when filters change
  }, [tasks, searchQuery, assistantFilter, clientFilter, bohFohFilter, datePreset, dateRange, getDateRangeFromPreset, statFilter]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const updateTaskField = async (
    taskId: string,
    field: "boh" | "foh",
    value: boolean
  ) => {
    setUpdating(taskId);
    const { error } = await supabase
      .from("tasks")
      .update({ [field]: value })
      .eq("id", taskId);

    if (error) {
      console.error(`Error updating ${field}:`, error);
    } else {
      setTasks((prev) =>
        prev.map((task) =>
          task.id === taskId ? { ...task, [field]: value } : task
        )
      );
    }
    setUpdating(null);
  };

  // Bulk update
  const bulkUpdateField = async (field: "boh" | "foh", value: boolean) => {
    const taskIds = Array.from(selectedTasks);
    if (taskIds.length === 0) return;

    setUpdating("bulk");
    const { error } = await supabase
      .from("tasks")
      .update({ [field]: value })
      .in("id", taskIds);

    if (error) {
      console.error(`Error bulk updating ${field}:`, error);
    } else {
      setTasks((prev) =>
        prev.map((task) =>
          selectedTasks.has(task.id) ? { ...task, [field]: value } : task
        )
      );
      setSelectedTasks(new Set());
    }
    setUpdating(null);
  };

  // Bulk delete
  const bulkDelete = async () => {
    const taskIds = Array.from(selectedTasks);
    if (taskIds.length === 0) return;

    setUpdating("bulk");
    const { error } = await supabase
      .from("tasks")
      .delete()
      .in("id", taskIds);

    if (error) {
      console.error("Error deleting tasks:", error);
    } else {
      setTasks((prev) => prev.filter((task) => !selectedTasks.has(task.id)));
      setSelectedTasks(new Set());
    }
    setUpdating(null);
    setShowDeleteConfirm(false);
  };

  // Selection handlers
  const toggleTaskSelection = (taskId: string) => {
    setSelectedTasks((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(taskId)) {
        newSet.delete(taskId);
      } else {
        newSet.add(taskId);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    const currentPageIds = paginatedTasks.map((t) => t.id);
    const allCurrentPageSelected = currentPageIds.every((id) => selectedTasks.has(id));

    if (allCurrentPageSelected) {
      // Deselect all on current page
      setSelectedTasks((prev) => {
        const newSet = new Set(prev);
        currentPageIds.forEach((id) => newSet.delete(id));
        return newSet;
      });
    } else {
      // Select all on current page
      setSelectedTasks((prev) => {
        const newSet = new Set(prev);
        currentPageIds.forEach((id) => newSet.add(id));
        return newSet;
      });
    }
  };

  // Export CSV
  const exportCSV = () => {
    const headers = ["Task Name", "Description", "Client", "Assistant", "BOH", "FOH", "Created At"];
    const rows = filteredTasks.map((t) => [
      `"${(t.task_name || "").replace(/"/g, '""')}"`,
      `"${(t.task_description || "").replace(/"/g, '""')}"`,
      `"${(t.client || "").replace(/"/g, '""')}"`,
      `"${(t.assistant || "").replace(/"/g, '""')}"`,
      t.boh ? "Yes" : "No",
      t.foh ? "Yes" : "No",
      t.created_at ? format(new Date(t.created_at), "yyyy-MM-dd HH:mm") : "",
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `blckbx-tasks-${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
  };

  // Pagination calculations
  const totalPages = Math.ceil(filteredTasks.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, filteredTasks.length);
  const paginatedTasks = filteredTasks.slice(startIndex, endIndex);

  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-blckbx-black/50 text-lg">Loading tasks...</p>
      </div>
    );
  }

  return (
    <TooltipProvider>
    <div className="space-y-6">
      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          label="Total Tasks"
          value={stats.total}
          isActive={statFilter === "all"}
          onClick={() => setStatFilter("all")}
        />
        <StatCard
          label="BOH Tasks"
          value={stats.boh}
          percentage={stats.bohPercentage}
          isActive={statFilter === "boh"}
          onClick={() => setStatFilter("boh")}
        />
        <StatCard
          label="FOH Tasks"
          value={stats.foh}
          percentage={stats.fohPercentage}
          isActive={statFilter === "foh"}
          onClick={() => setStatFilter("foh")}
        />
        <StatCard
          label="Unclassified"
          value={stats.unclassified}
          percentage={stats.unclassifiedPercentage}
          subtitle="Neither BOH nor FOH"
          isActive={statFilter === "unclassified"}
          onClick={() => setStatFilter("unclassified")}
        />
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-blckbx-black/40" />
        <Input
          placeholder="Search tasks by name or description..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 bg-white border-blckbx-sand-dark h-11"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-blckbx-black/40 hover:text-blckbx-black"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-4 pb-4 border-b border-blckbx-sand-dark">
        <div className="w-48">
          <label className="text-xs text-blckbx-black/60 uppercase tracking-wider mb-1.5 block">
            Assistant
          </label>
          <Select value={assistantFilter} onValueChange={setAssistantFilter}>
            <SelectTrigger className="bg-white border-blckbx-sand-dark">
              <SelectValue placeholder="All Assistants" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Assistants</SelectItem>
              {assistants.map((assistant) => (
                <SelectItem key={assistant} value={assistant}>
                  {assistant}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="w-48">
          <label className="text-xs text-blckbx-black/60 uppercase tracking-wider mb-1.5 block">
            Client
          </label>
          <Select value={clientFilter} onValueChange={setClientFilter}>
            <SelectTrigger className="bg-white border-blckbx-sand-dark">
              <SelectValue placeholder="All Clients" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Clients</SelectItem>
              {clients.map((client) => (
                <SelectItem key={client} value={client}>
                  {client}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="w-48">
          <label className="text-xs text-blckbx-black/60 uppercase tracking-wider mb-1.5 block">
            Status
          </label>
          <Select value={bohFohFilter} onValueChange={setBohFohFilter}>
            <SelectTrigger className="bg-white border-blckbx-sand-dark">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="boh">BOH Only</SelectItem>
              <SelectItem value="foh">FOH Only</SelectItem>
              <SelectItem value="both">Both BOH & FOH</SelectItem>
              <SelectItem value="none">Neither</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Date Filter */}
        <div className="w-48">
          <label className="text-xs text-blckbx-black/60 uppercase tracking-wider mb-1.5 block">
            Date Range
          </label>
          <Select value={datePreset} onValueChange={(v) => setDatePreset(v as DatePreset)}>
            <SelectTrigger className="bg-white border-blckbx-sand-dark">
              <SelectValue placeholder="All Time" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="7days">Last 7 Days</SelectItem>
              <SelectItem value="30days">Last 30 Days</SelectItem>
              <SelectItem value="thisMonth">This Month</SelectItem>
              <SelectItem value="lastMonth">Last Month</SelectItem>
              <SelectItem value="custom">Custom Range</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Custom Date Range Picker */}
        {datePreset === "custom" && (
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-64 justify-start text-left font-normal bg-white border-blckbx-sand-dark",
                  !dateRange && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateRange?.from ? (
                  dateRange.to ? (
                    <>
                      {format(dateRange.from, "LLL dd, y")} -{" "}
                      {format(dateRange.to, "LLL dd, y")}
                    </>
                  ) : (
                    format(dateRange.from, "LLL dd, y")
                  )
                ) : (
                  <span>Pick a date range</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                initialFocus
                mode="range"
                defaultMonth={dateRange?.from}
                selected={dateRange}
                onSelect={setDateRange}
                numberOfMonths={2}
              />
            </PopoverContent>
          </Popover>
        )}

        {/* Export Button */}
        <Button
          variant="outline"
          onClick={exportCSV}
          className="ml-auto bg-white border-blckbx-sand-dark hover:bg-blckbx-sand-dark/30 text-blckbx-black"
        >
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Results count */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-blckbx-black/50">
          Showing {filteredTasks.length > 0 ? startIndex + 1 : 0}-{endIndex} of {filteredTasks.length} tasks
          {filteredTasks.length !== tasks.length && ` (filtered from ${tasks.length})`}
        </p>
        {selectedTasks.size > 0 && (
          <p className="text-sm text-[#6B1488] font-medium">
            {selectedTasks.size} task{selectedTasks.size !== 1 ? "s" : ""} selected
          </p>
        )}
      </div>

      {/* Table */}
      <div className="rounded-md border border-blckbx-sand-dark overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-blckbx-sand-dark/70 hover:bg-blckbx-sand-dark/70">
              <TableHead className="w-[50px]">
                <Checkbox
                  checked={paginatedTasks.length > 0 && paginatedTasks.every((t) => selectedTasks.has(t.id))}
                  onCheckedChange={toggleSelectAll}
                  className="border-blckbx-black/30 data-[state=checked]:bg-[#6B1488] data-[state=checked]:border-[#6B1488]"
                />
              </TableHead>
              <TableHead className="w-[200px] text-blckbx-black/70 font-medium text-xs uppercase tracking-wider">
                Task Name
              </TableHead>
              <TableHead className="min-w-[300px] text-blckbx-black/70 font-medium text-xs uppercase tracking-wider">
                Description
              </TableHead>
              <TableHead className="text-blckbx-black/70 font-medium text-xs uppercase tracking-wider">
                Client
              </TableHead>
              <TableHead className="text-blckbx-black/70 font-medium text-xs uppercase tracking-wider">
                Assistant
              </TableHead>
              <TableHead className="w-[100px] text-center text-blckbx-black/70 font-medium text-xs uppercase tracking-wider">
                BOH
              </TableHead>
              <TableHead className="w-[80px] text-center text-blckbx-black/70 font-medium text-xs uppercase tracking-wider">
                FOH
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedTasks.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-blckbx-black/50">
                  No tasks found.
                </TableCell>
              </TableRow>
            ) : (
              paginatedTasks.map((task) => (
                <TableRow
                  key={task.id}
                  className={cn(
                    "bg-white hover:bg-blckbx-sand-dark/30 transition-colors",
                    selectedTasks.has(task.id) && "bg-[#6B1488]/5"
                  )}
                >
                  <TableCell>
                    <Checkbox
                      checked={selectedTasks.has(task.id)}
                      onCheckedChange={() => toggleTaskSelection(task.id)}
                      className="border-blckbx-black/30 data-[state=checked]:bg-[#6B1488] data-[state=checked]:border-[#6B1488]"
                    />
                  </TableCell>
                  <TableCell className="font-medium text-blckbx-black max-w-[200px]">
                    <Tooltip delayDuration={0}>
                      <TooltipTrigger asChild>
                        <span className="block truncate cursor-pointer">{task.task_name}</span>
                      </TooltipTrigger>
                      <TooltipContent
                        side="top"
                        className="max-w-[400px] text-sm bg-blckbx-black text-blckbx-sand px-4 py-3 rounded-xl shadow-xl border-0"
                        sideOffset={8}
                      >
                        {task.task_name}
                      </TooltipContent>
                    </Tooltip>
                  </TableCell>
                  <TableCell className="text-blckbx-black/70">
                    {task.task_description}
                  </TableCell>
                  <TableCell className="text-blckbx-black/80">{task.client}</TableCell>
                  <TableCell className="text-blckbx-black/80">{task.assistant}</TableCell>
                  <TableCell className="text-center">
                    <div className="flex flex-col items-center gap-1">
                      <Switch
                        checked={task.boh}
                        onCheckedChange={(checked) =>
                          updateTaskField(task.id, "boh", checked)
                        }
                        disabled={updating === task.id || updating === "bulk"}
                        className="data-[state=checked]:bg-blckbx-black data-[state=unchecked]:bg-blckbx-sand-dark"
                      />
                      {categorySuggestions.get(task.id) === "boh" && (
                        <Badge
                          className="text-[10px] px-1.5 py-0 bg-[#6B1488]/10 text-[#6B1488] border-[#6B1488]/20 hover:bg-[#6B1488]/20"
                          variant="outline"
                        >
                          Suggested
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex flex-col items-center gap-1">
                      <Switch
                        checked={task.foh}
                        onCheckedChange={(checked) =>
                          updateTaskField(task.id, "foh", checked)
                        }
                        disabled={updating === task.id || updating === "bulk"}
                        className="data-[state=checked]:bg-blckbx-black data-[state=unchecked]:bg-blckbx-sand-dark"
                      />
                      {categorySuggestions.get(task.id) === "foh" && (
                        <Badge
                          className="text-[10px] px-1.5 py-0 bg-[#6B1488]/10 text-[#6B1488] border-[#6B1488]/20 hover:bg-[#6B1488]/20"
                          variant="outline"
                        >
                          Suggested
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-4">
          <p className="text-sm text-blckbx-black/50">
            Page {currentPage} of {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage === 1}
              className="bg-white border-blckbx-sand-dark hover:bg-blckbx-sand-dark/30 disabled:opacity-50 text-blckbx-black"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>

            {/* Page number buttons */}
            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(page => {
                  // Show first page, last page, current page, and pages adjacent to current
                  return page === 1 ||
                         page === totalPages ||
                         Math.abs(page - currentPage) <= 1;
                })
                .map((page, index, array) => {
                  // Add ellipsis if there's a gap
                  const showEllipsisBefore = index > 0 && array[index - 1] !== page - 1;
                  return (
                    <div key={page} className="flex items-center gap-1">
                      {showEllipsisBefore && (
                        <span className="px-2 text-blckbx-black/40">...</span>
                      )}
                      <Button
                        variant={currentPage === page ? "default" : "outline"}
                        size="sm"
                        onClick={() => goToPage(page)}
                        className={cn(
                          "min-w-[36px]",
                          currentPage === page
                            ? "bg-blckbx-black text-blckbx-sand hover:bg-blckbx-black/90"
                            : "bg-white border-blckbx-sand-dark hover:bg-blckbx-sand-dark/30 text-blckbx-black"
                        )}
                      >
                        {page}
                      </Button>
                    </div>
                  );
                })}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="bg-white border-blckbx-sand-dark hover:bg-blckbx-sand-dark/30 disabled:opacity-50 text-blckbx-black"
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* Bulk Actions Bar */}
      {selectedTasks.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-blckbx-black text-blckbx-sand rounded-lg shadow-2xl px-6 py-4 flex items-center gap-4 z-50">
          <span className="text-sm">
            {selectedTasks.size} task{selectedTasks.size !== 1 ? "s" : ""} selected
          </span>
          <div className="h-6 w-px bg-blckbx-sand/20" />
          <Button
            size="sm"
            variant="cta"
            onClick={() => bulkUpdateField("boh", true)}
            disabled={updating === "bulk"}
          >
            Mark as BOH
          </Button>
          <Button
            size="sm"
            variant="cta"
            onClick={() => bulkUpdateField("foh", true)}
            disabled={updating === "bulk"}
          >
            Mark as FOH
          </Button>
          <div className="h-6 w-px bg-blckbx-sand/20" />
          {showDeleteConfirm ? (
            <>
              <span className="text-sm text-red-400">Delete {selectedTasks.size} tasks?</span>
              <Button
                size="sm"
                variant="ghost"
                onClick={bulkDelete}
                disabled={updating === "bulk"}
                className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
              >
                Confirm
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowDeleteConfirm(false)}
                className="text-blckbx-sand/70 hover:text-blckbx-sand hover:bg-blckbx-sand/10"
              >
                Cancel
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={updating === "bulk"}
              className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
            >
              Delete
            </Button>
          )}
          <div className="h-6 w-px bg-blckbx-sand/20" />
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setSelectedTasks(new Set())}
            className="text-blckbx-sand/70 hover:text-blckbx-sand hover:bg-blckbx-sand/10"
          >
            Clear Selection
          </Button>
        </div>
      )}
    </div>
    </TooltipProvider>
  );
}
