import { createClient } from '@supabase/supabase-js';

// ---------------------- Supabase Client ----------------------
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("❌ Supabase credentials missing!");
}

// Create Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ---------------------- Generate Explore HTML ----------------------
async function generateExploreHTML() {
  const { data: bots, error } = await supabase.from('sites').select('*');

  if (error) {
    console.error("Error fetching bots:", error.message);
    return `<h1 style="color:red;">Error fetching bots: ${error.message}</h1>`;
  }

  let botHTML = '';
  bots.forEach((bot) => {
    const filesObj = bot.files || {};
    const botFile = filesObj['bot.js'] || '// No bot file';

    botHTML += `
    <div class="bot">
      <h2>${bot.name}</h2>
      <p>${bot.description}</p>
      <pre>${botFile}</pre>
    </div>
    `;
  });

  return `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Explore Bots</title>
<style>
body { font-family: Arial, sans-serif; padding: 20px; background: #f0f0f0; }
.bot { background: #fff; padding: 10px; margin-bottom: 15px; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);}
pre { background: #eee; padding: 10px; border-radius: 5px; overflow-x: auto; }
</style>
</head>
<body>
<h1>Explore Bots</h1>
${botHTML || '<p>No bots found yet.</p>'}
</body>
</html>
`;
}

// ---------------------- Netlify Function Handler ----------------------
export async function handler(event, context) {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "text/plain" },
      body: "Supabase environment variables not set."
    };
  }

  try {
    const html = await generateExploreHTML();
    return {
      statusCode: 200,
      headers: { "Content-Type": "text/html" },
      body: html
    };
  } catch (err) {
    console.error(err);
    return {
      statusCode: 500,
      headers: { "Content-Type": "text/plain" },
      body: "Error generating explore page."
    };
  }
}
