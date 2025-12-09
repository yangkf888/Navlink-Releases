const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('data/vps.db.empty_nodejs_init.bak');
db.all("SELECT name FROM sqlite_master WHERE type='table';", (err, tables) => {
    if (err) { console.error(err); return; }
    console.log('Backup tables:', JSON.stringify(tables, null, 2));
    db.get("SELECT COUNT(*) as cnt FROM vps_servers;", (err, row) => {
        if (err) console.log('Error:', err.message);
        else console.log('vps_servers count:', row);
    });
});

