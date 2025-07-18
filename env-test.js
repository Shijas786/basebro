require('dotenv').config();

console.log("✅ ENV LOADED:");
console.log("SUPABASE_URL:", process.env.SUPABASE_URL);
console.log("SUPABASE_ANON_KEY exists?", !!process.env.SUPABASE_ANON_KEY);
