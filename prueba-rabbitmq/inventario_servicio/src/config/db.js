const path = require("node:path");
const mysql = require("mysql2/promise");

require("dotenv").config({
    path: path.resolve(__dirname, "../../.env")
});

const requeridas = [
    "DB_HOST",
    "DB_PORT",
    "DB_USER",
    "DB_PASSWORD",
    "DB_NAME"
];

for (const nombre of requeridas) {
    if (!process.env[nombre]) {
        throw new Error(`Falta configurar ${nombre} en .env`);
    }
}

const puerto = Number(process.env.DB_PORT);

if (!Number.isInteger(puerto) || puerto < 1 || puerto > 65535) {
    throw new Error("DB_PORT debe ser un puerto válido.");
}

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: puerto,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 5,
    queueLimit: 20,
    connectTimeout: 10000,
    charset: "utf8mb4",
    timezone: "Z"
});

module.exports = pool;