/* ============================================================
   AMAN PATROL — live backend configuration
   Connects the app to the coordinator's Supabase project.
   The anon key is PUBLIC BY DESIGN (it ships inside the app);
   the database's row-level security rules protect the data.
   Add ?demo=1 to the URL to force the offline demo instead.
   ============================================================ */
window.AMAN_SUPABASE = {
  url: "https://jiblxujefjivbawgutgg.supabase.co",
  anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImppYmx4dWplZmppdmJhd2d1dGdnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEwMDg3ODQsImV4cCI6MjEwNjU4NDc4NH0.F1wReB9FPoo7_JxHWLMQ9kR8FRYSgNKdMQTKRZ2MzQ4"
};
