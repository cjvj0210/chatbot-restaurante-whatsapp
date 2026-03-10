import mysql from 'mysql2/promise';
const conn = await mysql.createConnection(process.env.DATABASE_URL || '');
const [rows] = await conn.execute('DESCRIBE orders');
for (const r of rows) console.log(r.Field, r.Type, r.Null);
await conn.end();
