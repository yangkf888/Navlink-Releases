import { getDatabase } from '../index.js';

export class DockerImageUpdateDAO {
    /**
     * 保存或更新镜像状态
     */
    static async save(data) {
        const db = getDatabase();
        const { imageName, hasUpdate, localDigest, remoteDigest, error } = data;

        return new Promise((resolve, reject) => {
            db.run(`
                INSERT INTO docker_image_updates (image_name, has_update, local_digest, remote_digest, error, last_check_at)
                VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(image_name) DO UPDATE SET
                    has_update = excluded.has_update,
                    local_digest = excluded.local_digest,
                    remote_digest = excluded.remote_digest,
                    error = excluded.error,
                    last_check_at = CURRENT_TIMESTAMP
            `, [imageName, hasUpdate ? 1 : 0, localDigest, remoteDigest, error], (err) => {
                if (err) return reject(err);
                resolve();
            });
        });
    }

    /**
     * 获取所有持久化的更新状态
     */
    static async getAll() {
        const db = getDatabase();
        return new Promise((resolve, reject) => {
            db.all('SELECT * FROM docker_image_updates', [], (err, rows) => {
                if (err) return reject(err);
                // 转换回前端期望的布尔值
                resolve(rows.map(row => ({
                    ...row,
                    imageName: row.image_name,
                    hasUpdate: row.has_update === 1
                })));
            });
        });
    }

    /**
     * 删除指定镜像的更新记录
     */
    static async remove(imageName) {
        const db = getDatabase();
        return new Promise((resolve, reject) => {
            db.run('DELETE FROM docker_image_updates WHERE image_name = ?', [imageName], (err) => {
                if (err) return reject(err);
                resolve();
            });
        });
    }
}
