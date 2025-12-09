# 生产环境配置保存500错误修复

## 问题现象

生产环境(端口3005)无法保存配置,返回500错误:
```
:3005/api/config: Failed to load resource: the server responded with a status of 500 (Internal Server Error)
Save failed: Ma: Failed to save configuration
```

**关键线索**:开发环境正常,只有生产环境出错

## 问题诊断

### 1. 检查容器日志

```bash
docker logs navlink-app | grep -i error
```

发现关键错误:
```
[SiteConfigDAO] 保存配置失败: Error: SQLITE_ERROR: table site_config has no column named config_data
```

### 2. 问题根源 ⭐

**数据库Schema不匹配!**

- **新代码**:使用`site_config.config_data`字段存储JSON配置
- **旧数据库**:只有旧字段(`logo_url`, `header_quote`等),**没有`config_data`字段**

这是典型的**数据库迁移问题**:
- ✅ 开发环境:数据库是新创建/导入的,有`config_data`字段
- ❌ 生产环境:数据库是旧版本,缺少`config_data`字段
- ✅ 新镜像代码:默认使用`config_data`字段

## 解决方案

### 方案1: 手动添加字段(已执行)

```bash
# 1. 在容器中执行SQL迁移
docker exec navlink-app node -e "
const sqlite3 = require('sqlite3').Database;
const db = new sqlite3('/app/data/navlink.db');
db.run('ALTER TABLE site_config ADD COLUMN config_data TEXT', (err) => {
    if (err) console.error('Error:', err.message);
    else console.log('✅ config_data column added');
    db.close();
});
"

# 2. 重启容器
docker restart navlink-app

# 3. 验证
# 访问http://localhost:3005,修改配置,查看是否保存成功
```

### 方案2: 使用迁移脚本(推荐用于未来)

创建数据库迁移脚本`server/scripts/migrate-db-schema.js`:

```javascript
#!/usr/bin/env node
import sqlite3 from 'sqlite3';
import fs from 'fs';

const DB_PATH = '/app/data/navlink.db';
const db = new sqlite3.Database(DB_PATH);

// 检查字段是否存在
db.all("PRAGMA table_info(site_config)", (err, columns) => {
    const hasConfigData = columns.some(col => col.name === 'config_data');
    
    if (!hasConfigData) {
        console.log('Adding config_data column...');
        db.run('ALTER TABLE site_config ADD COLUMN config_data TEXT', (err) => {
            if (err) console.error('Failed:', err);
            else console.log('✅ Migration complete');
            db.close();
        });
    } else {
        console.log('✅ Schema is up-to-date');
        db.close();
    }
});
```

在容器启动时自动运行:
```bash
# Dockerfile 或 docker-entrypoint.sh
node server/scripts/migrate-db-schema.js
```

## 为什么会发生这个问题?

### 数据库Schema演变

**V1.0 (旧版本)**:
```sql
CREATE TABLE site_config (
    id INTEGER PRIMARY KEY,
    logo_url TEXT,
    header_quote TEXT,
    background_image TEXT,
    ...
);
```

**V2.0 (新版本)**:
```sql
CREATE TABLE site_config (
    id INTEGER PRIMARY KEY,
    logo_url TEXT,         -- 保留旧字段
    header_quote TEXT,     -- 保留旧字段  
    config_data TEXT,      -- ✨ 新增:存储完整JSON配置
    ...
);
```

### CREATE TABLE IF NOT EXISTS 的局限

```sql
CREATE TABLE IF NOT EXISTS site_config (...);
```

这个语句只能:
- ✅ 创建不存在的表
- ❌ **不能**修改已存在表的结构

所以:
1. 首次部署 → 创建新表,包含`config_data`字段 ✅
2. 升级部署 → 表已存在,跳过创建,**不会添加新字段** ❌

## 最佳实践

### 1. 版本化数据库迁移

类似Rails migrations或Alembic:

```
server/migrations/
  001_create_initial_tables.sql
  002_add_config_data_column.sql
  003_add_theme_settings.sql
```

### 2. 迁移版本记录

```sql
CREATE TABLE schema_migrations (
    version INTEGER PRIMARY KEY,
    applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 在应用启动时检查
SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1;
```

### 3. 自动迁移脚本

```javascript
// server/database/migrate.js
export async function runMigrations() {
    const currentVersion = await getCurrentVersion();
    const migrations = await getPendingMigrations(currentVersion);
    
    for (const migration of migrations) {
        await migration.up();
        await recordMigration(migration.version);
    }
}
```

### 4. 健康检查包含Schema验证

```javascript
app.get('/health', (req, res) => {
    // 检查必需字段
    db.all("PRAGMA table_info(site_config)", (err, columns) => {
        const hasConfigData = columns.some(c => c.name === 'config_data');
        res.json({
            status: hasConfigData ? 'healthy' : 'schema_outdated',
            database: 'connected'
        });
    });
});
```

## 预防措施

### 1. 发布新版本时

创建升级文档:
```markdown
# v2.1.0 升级指南

**重要:数据库Schema变更**

升级步骤:
1. 备份数据库: `cp data/navlink.db data/navlink.db.backup`
2. 停止容器: `docker compose down`
3. 执行迁移: `docker compose run app node server/scripts/migrate-db.js`
4. 启动新版本: `docker compose up -d`
```

### 2. 在Dockerfile中

```dockerfile
# 添加自动迁移
COPY server/scripts/migrate-db.js /app/server/scripts/
RUN chmod +x /app/server/scripts/migrate-db.js

# 在entrypoint中执行
CMD node server/scripts/migrate-db.js && node server.js
```

### 3. 使用ORM工具

如Prisma、TypeORM、Sequelize,它们内置了migration管理。

## 验证修复

### 测试步骤

1. ✅ 访问生产环境: http://localhost:3005
2. ✅ 登录管理员账户
3. ✅ 修改配置(如网站标题)
4. ✅ 观察Console:
   ```
   [ConfigContext] 开始保存配置到服务器...
   [ConfigContext] ✅ 配置保存成功
   ```
5. ✅ 看到绿色Toast: `✅ 配置已保存`
6. ✅ 刷新页面,修改保留

### 确认数据库

```bash
# 进入容器
docker exec -it navlink-app sh

# 查看字段
node -e "
const db = require('sqlite3').Database('/app/data/navlink.db');
db.all('PRAGMA table_info(site_config)', (e, c) => {
    c.forEach(col => console.log(col.name));
});
"
# 应该看到 config_data
```

## 总结

- **问题**: 旧数据库缺少新字段`config_data`
- **原因**: `CREATE TABLE IF NOT EXISTS`不会更新已存在的表
- **解决**: 手动执行`ALTER TABLE ADD COLUMN`
- **预防**: 使用版本化迁移系统

**配置保存功能现已修复!** 🎉
