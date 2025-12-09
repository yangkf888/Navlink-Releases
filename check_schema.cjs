const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(process.cwd(), 'plugins/vps/data', 'vps.db');
const db = new sqlite3.Database(dbPath);
db.all("PRAGMA table_info(groups);", (err, rows) => {
    if (err) console.error(err);
    else console.log(JSON.stringify(rows, null, 2));
});

