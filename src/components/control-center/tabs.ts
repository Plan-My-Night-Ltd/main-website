// The Control Center's sections. A plain module (not "use client") so the server
// page and the browser shell both get the real list: values imported from a
// "use client" file into a server component arrive as references, not data.

export const tabs = [
  { key: "overview", label: "Overview", ranged: true },
  { key: "people", label: "People", ranged: false },
  { key: "preferences", label: "Preferences", ranged: true },
  { key: "traffic", label: "Traffic", ranged: true },
  { key: "bookings", label: "Bookings", ranged: true },
  { key: "venues", label: "Venues", ranged: false },
] as const;

export type TabKey = (typeof tabs)[number]["key"];
export type PeopleFilter = "all" | "returning" | "booked" | "emails" | "inactive";
