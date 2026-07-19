/* ============================================================
   THE PINK CHRONICLES — Supabase connection
   Fill these two values in after you create your Supabase
   project (see SETUP.md). Same values go in the Admin site too.
   ============================================================ */
const SUPABASE_URL = "https://dvvftwxttdffsrhevxwv.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_zEkGaekQbViTETnWU_GdTQ_3xgPqpe-";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
