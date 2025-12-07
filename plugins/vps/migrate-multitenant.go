package main

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

// 数据库模型定义
type Group struct {
	ID        string `gorm:"primaryKey"`
	TenantID  string `gorm:"index:idx_groups_tenant;index:idx_groups_tenant_user"`
	UserID    string `gorm:"index:idx_groups_user;index:idx_groups_tenant_user"`
	Name      string
	CreatedAt string
}

type Server struct {
	ID        string `gorm:"primaryKey"`
	TenantID  string `gorm:"index:idx_servers_tenant;index:idx_servers_tenant_user"`
	UserID    string `gorm:"index:idx_servers_user;index:idx_servers_tenant_user"`
	Name      string
	CreatedAt string
}

type SnippetCategory struct {
	ID        string `gorm:"primaryKey"`
	TenantID  string `gorm:"index:idx_snippet_categories_tenant;index:idx_snippet_categories_tenant_user"`
	UserID    string `gorm:"index:idx_snippet_categories_user;index:idx_snippet_categories_tenant_user"`
	Name      string
	CreatedAt string
}

type Snippet struct {
	ID        string `gorm:"primaryKey"`
	TenantID  string `gorm:"index:idx_snippets_tenant;index:idx_snippets_tenant_user"`
	UserID    string `gorm:"index:idx_snippets_user;index:idx_snippets_tenant_user"`
	Title     string
	CreatedAt string
}

func main() {
	fmt.Println("🔧 VPS插件多租户数据库迁移")
	fmt.Println("=====================================")

	// 获取数据库路径
	executable, err := os.Executable()
	if err != nil {
		panic("failed to get executable path")
	}
	pluginDir := filepath.Dir(executable)
	projectDir := filepath.Dir(filepath.Dir(pluginDir))
	dataDir := filepath.Join(projectDir, "data")
	dbPath := filepath.Join(dataDir, "vps.db")

	fmt.Printf("数据库路径: %s\n", dbPath)
	fmt.Println("=====================================")

	// 连接数据库
	db, err := gorm.Open(sqlite.Open(dbPath), &gorm.Config{})
	if err != nil {
		panic("failed to connect database: " + err.Error())
	}

	// 1. 为 groups 表添加字段
	fmt.Println("\n1. 为 groups 表添加多租户字段...")
	if err := db.Migrator().AddColumn(&Group{}, "TenantID"); err != nil {
		fmt.Printf("   ⚠️  添加 tenant_id 失败(可能已存在): %v\n", err)
	} else {
		fmt.Println("   ✅ 添加 tenant_id 成功")
	}
	if err := db.Migrator().AddColumn(&Group{}, "UserID"); err != nil {
		fmt.Printf("   ⚠️  添加 user_id 失败(可能已存在): %v\n", err)
	} else {
		fmt.Println("   ✅ 添加 user_id 成功")
	}

	// 2. 为 servers 表添加字段
	fmt.Println("\n2. 为 servers 表添加多租户字段...")
	if err := db.Migrator().AddColumn(&Server{}, "TenantID"); err != nil {
		fmt.Printf("   ⚠️  添加 tenant_id 失败(可能已存在): %v\n", err)
	} else {
		fmt.Println("   ✅ 添加 tenant_id 成功")
	}
	if err := db.Migrator().AddColumn(&Server{}, "UserID"); err != nil {
		fmt.Printf("   ⚠️  添加 user_id 失败(可能已存在): %v\n", err)
	} else {
		fmt.Println("   ✅ 添加 user_id 成功")
	}

	// 3. 为 snippet_categories 表添加字段
	fmt.Println("\n3. 为 snippet_categories 表添加多租户字段...")
	if err := db.Migrator().AddColumn(&SnippetCategory{}, "TenantID"); err != nil {
		fmt.Printf("   ⚠️  添加 tenant_id 失败(可能已存在): %v\n", err)
	} else {
		fmt.Println("   ✅ 添加 tenant_id 成功")
	}
	if err := db.Migrator().AddColumn(&SnippetCategory{}, "UserID"); err != nil {
		fmt.Printf("   ⚠️  添加 user_id 失败(可能已存在): %v\n", err)
	} else {
		fmt.Println("   ✅ 添加 user_id 成功")
	}

	// 4. 为 snippets 表添加字段
	fmt.Println("\n4. 为 snippets 表添加多租户字段...")
	if err := db.Migrator().AddColumn(&Snippet{}, "TenantID"); err != nil {
		fmt.Printf("   ⚠️  添加 tenant_id 失败(可能已存在): %v\n", err)
	} else {
		fmt.Println("   ✅ 添加 tenant_id 成功")
	}
	if err := db.Migrator().AddColumn(&Snippet{}, "UserID"); err != nil {
		fmt.Printf("   ⚠️  添加 user_id 失败(可能已存在): %v\n", err)
	} else {
		fmt.Println("   ✅ 添加 user_id 成功")
	}

	// 5. 设置默认值为 'default'
	fmt.Println("\n5. 设置已有数据的默认租户...")
	db.Exec("UPDATE groups SET tenant_id = 'default' WHERE tenant_id IS NULL OR tenant_id = ''")
	db.Exec("UPDATE servers SET tenant_id = 'default' WHERE tenant_id IS NULL OR tenant_id = ''")
	db.Exec("UPDATE snippet_categories SET tenant_id = 'default' WHERE tenant_id IS NULL OR tenant_id = ''")
	db.Exec("UPDATE snippets SET tenant_id = 'default' WHERE tenant_id IS NULL OR tenant_id = ''")
	fmt.Println("   ✅ 默认租户设置完成")

	// 6. 创建索引
	fmt.Println("\n6. 创建多租户索引...")
	db.Migrator().CreateIndex(&Group{}, "TenantID")
	db.Migrator().CreateIndex(&Group{}, "UserID")
	db.Migrator().CreateIndex(&Server{}, "TenantID")
	db.Migrator().CreateIndex(&Server{}, "UserID")
	db.Migrator().CreateIndex(&SnippetCategory{}, "TenantID")
	db.Migrator().CreateIndex(&SnippetCategory{}, "UserID")
	db.Migrator().CreateIndex(&Snippet{}, "TenantID")
	db.Migrator().CreateIndex(&Snippet{}, "UserID")
	fmt.Println("   ✅ 索引创建完成")

	// 7. 统计数据
	fmt.Println("\n📊 数据统计:")
	var groupCount, serverCount, categoryCount, snippetCount int64
	db.Model(&Group{}).Count(&groupCount)
	db.Model(&Server{}).Count(&serverCount)
	db.Model(&SnippetCategory{}).Count(&categoryCount)
	db.Model(&Snippet{}).Count(&snippetCount)
	fmt.Printf("   分组总数: %d\n", groupCount)
	fmt.Printf("   服务器总数: %d\n", serverCount)
	fmt.Printf("   代码片段分类: %d\n", categoryCount)
	fmt.Printf("   代码片段: %d\n", snippetCount)

	fmt.Println("\n=====================================")
	fmt.Println("🎉 VPS插件多租户迁移完成!")
	fmt.Println("=====================================")
}
