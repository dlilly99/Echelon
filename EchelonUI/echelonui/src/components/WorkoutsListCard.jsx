import { useEffect, useState } from "react";
import {
  Card, CardHeader, CardContent, CardActions,
  List, ListItemButton, ListItemText, Button, Typography
} from "@mui/material";
import { useNavigate } from "react-router-dom";

export default function WorkoutsListCard() {
  const [items, setItems] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const nav = useNavigate();
  const userId = 'anon';

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`/api/workouts?userId=${encodeURIComponent(userId)}`);
        const d = await r.json();
        if (r.ok && d.ok) setItems(d.workouts);
      } catch {}
    })();
  }, []);

  return (
    <Card sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <CardHeader title="Previous Workouts" subheader="Pick one and start a session" />
      <CardContent sx={{ flex: 1, overflow: "auto", pt: 0 }}>
        {items.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No workouts yet. Generate one first.
          </Typography>
        ) : (
          <List dense disablePadding>
            {items.map((w) => (
              <ListItemButton
                key={w._id}
                selected={selectedId === w._id}
                onClick={() => setSelectedId(w._id)}
              >
                <ListItemText
                  primary={w.prompt}
                  secondary={new Date(w.createdAt).toLocaleString()}
                  primaryTypographyProps={{ noWrap: true }}
                  secondaryTypographyProps={{ noWrap: true }}
                />
              </ListItemButton>
            ))}
          </List>
        )}
      </CardContent>
      <CardActions sx={{ p: 2, pt: 0 }}>
        <Button
          variant="contained"
          disabled={!selectedId}
          onClick={() => nav(`/session/${selectedId}`)}
          fullWidth
        >
          Start
        </Button>
      </CardActions>
    </Card>
  );
}
