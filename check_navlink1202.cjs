const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('Navlink1202/data/vps.db');
db.all("SELECT name FROM sqlite_master WHERE type='table';", (err, tables) => {
    if (err) { console.error(err); return; }
    console.log('Tables:', JSON.stringify(tables, null, 2));
    db.get("SELECT COUNT(*) as cnt FROM vps_servers;", (err, row) => {
        if (err) console.log('vps_servers error:', err.message);
        else console.log('vps_servers count:', row);
    });
});

