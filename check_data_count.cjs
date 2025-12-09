const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(process.cwd(), 'data', 'vps.db');
const db = new sqlite3.Database(dbPath);
db.get("SELECT COUNT(*) as count FROM servers;", (err, row) => {
    if (err) console.error(err);
    else console.log(JSON.stringify(row));
});

