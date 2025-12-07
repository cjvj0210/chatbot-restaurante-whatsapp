import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "./drizzle/schema.ts";

const connection = await mysql.createConnection(process.env.DATABASE_URL);
const db = drizzle(connection, { schema });

const settings = await db.select().from(schema.whatsappSettings);
console.log("WhatsApp Settings:", JSON.stringify(settings, null, 2));

await connection.end();
