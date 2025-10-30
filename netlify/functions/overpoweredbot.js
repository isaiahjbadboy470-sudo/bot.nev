import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import readline from 'readline';

// ---------------------- Supabase Client ----------------------
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Supabase credentials not set!");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ---------------------- Helpers ----------------------
function generateAPIKey() {
  const randomBytes = crypto.randomBytes(32);
  const timestamp = Date.now().toString(36);
  return `${randomBytes.toString('base64url')}_${timestamp}`;
}

function moderateContent(files) {
  const harmfulPatterns = ["<script>alert", "eval(", "malicious"];
  for (let file of Object.values(files)) {
    for (let pattern of harmfulPatterns) {
      if (file.includes(pattern)) return true;
    }
  }
  return false;
}

function generateUserFiles(description, apiKey) {
  return {
    "bot.js": `// Auto-generated bot
const API_KEY = "${apiKey}";
const description = "${description}";

function respond(message) {
  return "You said: '" + message + "'. " + description;
}

process.stdin.on('data', (data) => {
  const msg = data.toString().trim();
  console.log("[Bot Reply]: " + respond(msg));
});

console.log("Bot is ready!");`
  };
}

// ---------------------- Bot Actions ----------------------
async function createBot(description) {
  const hash = `bot_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
  const apiKey = generateAPIKey();
  const files = generateUserFiles(description, apiKey);

  if (moderateContent(files)) return console.log("Bot contains harmful content. Creation aborted.");

  const newBot = {
    name: `Bot_${Date.now()}`,
    description,
    files,
    hash,
    created_at: new Date().toISOString(),
    api_key: apiKey
  };

  const { error } = await supabase.from('sites').insert(newBot);
  if (error) console.error("Failed to insert bot:", error.message);
  else console.log(`Bot created successfully!\n- ID/Hash: ${hash}\n- API Key: ${apiKey}\n- File: bot.js`);
}

async function listBots() {
  const { data: bots, error } = await supabase.from('sites').select('*').limit(10);
  if (error) return console.error("Error fetching bots:", error.message);
  if (!bots || bots.length === 0) return console.log("No bots found.");

  const list = bots.map(b => `- ${b.name} (ID: ${b.hash})`).join("\n");
  console.log(`Bots:\n${list}`);
}

// ---------------------- CLI Interface ----------------------
if (process.env.CLI_MODE === "true") {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  console.log("Overpowered Bot running...");
  console.log("Commands: !ping, !createbot <description>, !listbots");

  rl.on('line', async (input) => {
    const [cmd, ...args] = input.split(' ');

    if (cmd === '!ping') console.log('Pong!');
    else if (cmd === '!createbot') await createBot(args.join(' '));
    else if (cmd === '!listbots') await listBots();
    else console.log('Unknown command.');
  });
}

// ---------------------- Netlify Function Handler ----------------------
export async function handler(event, context) {
  const query = event.queryStringParameters || {};
  const { action, description, id } = query;

  if (action === 'listbots') {
    const { data: bots, error } = await supabase.from('sites').select('*');
    if (error) return { statusCode: 500, body: JSON.stringify({ error: error.message }) };

    const safeBots = bots.map(b => ({
      name: b.name,
      description: b.description,
      hash: b.hash,
      api_key: b.api_key,
      botFile: b.files['bot.js'] || '// No bot file'
    }));

    return { statusCode: 200, body: JSON.stringify(safeBots) };
  }

  if (action === 'getbot' && id) {
    const { data: bot, error } = await supabase.from('sites').select('*').eq('hash', id).single();
    if (error || !bot) return { statusCode: 404, body: JSON.stringify({ error: "Bot not found" }) };
    return { statusCode: 200, body: JSON.stringify({ ...bot, botFile: bot.files['bot.js'] || '// No bot file' }) };
  }

  if (action === 'createbot' && description) {
    await createBot(description);
    return { statusCode: 200, body: JSON.stringify({ message: "Bot created (check Supabase)" }) };
  }

  return { statusCode: 400, body: JSON.stringify({ error: "Invalid action" }) };
}
