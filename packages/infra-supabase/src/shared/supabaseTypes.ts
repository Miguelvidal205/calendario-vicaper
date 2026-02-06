export type AppointmentRow = {
  id: string;
  terreno_id: string;
  assigned_user_id: string;
  lead_id: string | null;
  title: string | null;
  notes: string | null;
  status: "scheduled" | "completed" | "no_show" | "cancelled";
  starts_at: string;
  ends_at: string;
  created_at: string;
  updated_at: string;
};
