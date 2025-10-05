import { useMemo, useState } from "react";
import {
  Card, CardHeader, CardContent, IconButton,
  Grid, Box, Typography, Stack, Tooltip
} from "@mui/material";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";

// Format a Date -> 'YYYY-MM-DD' (local, not UTC)
function dateKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function daysInMonth(year, monthIndex) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

// Build a 6x7 grid (42 cells) with either a Date or null
function buildMonthMatrix(viewDate) {
  const y = viewDate.getFullYear();
  const m = viewDate.getMonth(); // 0-11
  const first = new Date(y, m, 1);
  const startWeekday = first.getDay(); // 0=Sun .. 6=Sat
  const count = daysInMonth(y, m);

  const cells = Array(42).fill(null);
  for (let i = 0; i < count; i++) {
    cells[startWeekday + i] = new Date(y, m, i + 1);
  }
  return cells;
}

export default function CalendarCard({ workouts = [] }) {
  const [view, setView] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  });

  // Create a set of completed dates from the workouts prop
  const completed = useMemo(() => {
    return new Set(workouts.map(w => dateKey(new Date(w.createdAt))));
  }, [workouts]);

  const todayKey = dateKey(new Date());
  const matrix = useMemo(() => buildMonthMatrix(view), [view]);
  const monthLabel = view.toLocaleString(undefined, { month: "long", year: "numeric" });
  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const prevMonth = () => {
    const d = new Date(view);
    d.setMonth(d.getMonth() - 1);
    setView(d);
  };
  const nextMonth = () => {
    const d = new Date(view);
    d.setMonth(d.getMonth() + 1);
    setView(d);
  };

  return (
    <Card sx={{ height: "100%" }}>
      <CardHeader
        title="Activity Calendar"
        subheader="Workouts are marked with a dot"
        action={
          <Stack direction="row" spacing={0.5}>
            <IconButton size="small" onClick={prevMonth}><ChevronLeftIcon /></IconButton>
            <IconButton size="small" onClick={nextMonth}><ChevronRightIcon /></IconButton>
          </Stack>
        }
      />
      <CardContent sx={{ pt: 0, flex: 1, display: "flex", flexDirection: "column" }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
          <Typography variant="subtitle2" color="text.secondary">{monthLabel}</Typography>
        </Stack>

        {/* Weekday header */}
        <Grid container columns={7} spacing={1} sx={{ mb: 0.5 }}>
          {weekdays.map((w) => (
            <Grid item xs={1} key={w}>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: "block", textAlign: "center", fontWeight: 600 }}
              >
                {w}
              </Typography>
            </Grid>
          ))}
        </Grid>

        {/* 6x7 calendar grid */}
        <Grid container columns={7} spacing={1} sx={{ userSelect: "none" }}>
          {matrix.map((d, i) => {
            const isInMonth = !!d;
            const k = isInMonth ? dateKey(d) : "";
            const isToday = k === todayKey;
            const isDone = isInMonth && completed.has(k);

            return (
              <Grid item xs={1} key={i}>
                <Box
                  sx={{
                    height: 68,
                    borderRadius: 1.2,
                    border: "1px solid",
                    borderColor: isInMonth ? "rgba(255,255,255,0.08)" : "transparent",
                    bgcolor: isInMonth ? "background.paper" : "transparent",
                    opacity: isInMonth ? 1 : 0,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    position: "relative",
                  }}
                >
                  {isInMonth && (
                    <>
                      <Typography variant="body2" sx={{ fontWeight: isToday ? 700 : 500 }}>
                        {d.getDate()}
                      </Typography>
                      {isDone && (
                        <Box
                          sx={{
                            mt: 0.5,
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            bgcolor: "primary.main",
                          }}
                        />
                      )}
                      {isToday && (
                        <Box
                          sx={{
                            position: "absolute",
                            inset: 0,
                            borderRadius: 1.2,
                            border: "1px solid",
                            borderColor: "primary.main",
                            pointerEvents: "none",
                          }}
                        />
                      )}
                    </>
                  )}
                </Box>
              </Grid>
            );
          })}
        </Grid>
      </CardContent>
    </Card>
  );
}
