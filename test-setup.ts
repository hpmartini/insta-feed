// Tests never touch disk or network: in-memory DB, no Gemini key.
process.env.DB_PATH = ":memory:";
delete process.env.GEMINI_API_KEY;
