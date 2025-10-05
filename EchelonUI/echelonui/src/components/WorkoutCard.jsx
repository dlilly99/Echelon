import { useEffect, useMemo, useState } from "react";
import {
  Card, CardContent, CardHeader, Button, Stack, Typography, Badge
} from "@mui/material";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { DateCalendar } from "@mui/x-date-pickers/DateCalendar";
import { PickersDay } from "@mui/x-date-pickers/PickersDay";
import { format } from "date-fns";

export default function CalendarCard() {
  const [selected, setSelected] = useState(new Date());
  const [finished, setFinished] = useState([]); // ["YYYY-MM-DD", ...]

  const finishedSet = useMemo(() => new Set(finished), [finished]);

  useEffect(() => {
    fetch("http://localhost:8787/api/completions")
      .then(r => r.json())
      .then(d => d.ok && setFinished(d.dates || []))
      .catch(() => {});
  }, []);

  const DayWithDot = (props) => {
    const { day, outsideCurrentMonth, ...other } = props;
    const key = format(day, "yyyy-MM-dd");
    const showDot = finishedSet.has(key);
    return (
      <Badge
        overlap="circular"
        variant="dot"
        color="primary"
        invisible={!showDot}
        sx={{ "& .MuiBadge-dot": { width: 6, height: 6, borderRadius: "50%" } }}
      >
        <PickersDay day={day} outsideCurrentMonth={outsideCurrentMonth} {...other} />
      </Badge>
    );
  };

  async function markCompleted() {
    const iso = format(selected, "yyyy-MM-dd");
    const r = await fetch("http://localhost:8787/api/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: iso }),
    });
    const d = await r.json();
    if (d.ok) setFinished((prev) => (prev.includes(iso) ? prev : [...prev, iso]));
  }

  return (
    <Card sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <CardHeader title="Workout Calendar" subheader="Blue dot = completed" />
      <CardContent sx={{ flex: 1 }}>
        <LocalizationProvider dateAdapter={AdapterDateFns}>
          <DateCalendar
            value={selected}
            onChange={(v) => v && setSelected(v)}
            slots={{ day: DayWithDot }}
          />
        </LocalizationProvider>
        <Stack direction="row" spacing={2} alignItems="center" mt={1}>
          <Button variant="contained" onClick={markCompleted}>Mark completed</Button>
          <Typography variant="body2" color="text.secondary">
            {format(selected, "yyyy-MM-dd")}
          </Typography>
        </Stack>
      </CardContent>
    </Card>
  );
}
