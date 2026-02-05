"use client";

import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import esLocale from "@fullcalendar/core/locales/es";

export default function CalendarView({ events }: { events: any[] }) {
  return (
    <div className="calendar-container shadow-sm border-none p-0 overflow-hidden">
      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        headerToolbar={{
          left: "prev,next today",
          center: "title",
          right: "dayGridMonth,timeGridWeek,timeGridDay",
        }}
        events={events}
        locale={esLocale}
        height="700px"
        eventClassNames="event-pill border-none text-xs font-bold px-2 py-1 shadow-sm"
        dayMaxEvents={true}
        slotMinTime="08:00:00"
        slotMaxTime="20:00:00"
      />
      <style jsx global>{`
        .fc { --fc-border-color: #f1f5f9; --fc-button-bg-color: #2563eb; --fc-button-border-color: #2563eb; font-family: inherit; }
        .fc .fc-toolbar-title { font-size: 1.1rem; font-weight: 700; color: #1e293b; }
        .fc .fc-col-header-cell { background: #f8fafc; padding: 10px 0; font-size: 12px; text-transform: uppercase; color: #64748b; }
        .fc-theme-standard td, .fc-theme-standard th { border: 1px solid #f1f5f9 !important; }
        .fc .fc-daygrid-day.fc-day-today { background: #eff6ff !important; }
      `}</style>
    </div>
  );
}