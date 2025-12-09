const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(process.cwd(), 'data', 'vps.db');
const db = new sqlite3.Database(dbPath);
db.all("SELECT name FROM sqlite_master WHERE type='table';", (err, tables) => {
    if (err) console.error(err);
    else console.log(JSON.stringify(tables, null, 2));
});

