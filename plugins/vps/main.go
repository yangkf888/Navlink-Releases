package main

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"github.com/pkg/sftp"
	"golang.org/x/crypto/ssh"
	"gorm.io/gorm"
)

// --- Database Models ---

type Group struct {
	ID          string    `gorm:"primaryKey" json:"id"`
	TenantID    string    `gorm:"index:idx_groups_tenant;index:idx_groups_tenant_user" json:"tenant_id"`
	UserID      string    `gorm:"index:idx_groups_user;index:idx_groups_tenant_user" json:"user_id"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	SortOrder   int       `json:"sort_order"`
	CreatedAt   time.Time `json:"created_at"`
}

type Server struct {
	ID            string    `gorm:"primaryKey" json:"id"`
	TenantID      string    `gorm:"index:idx_servers_tenant;index:idx_servers_tenant_user" json:"tenant_id"`
	UserID        string    `gorm:"index:idx_servers_user;index:idx_servers_tenant_user" json:"user_id"`
	GroupID       *string   `json:"group_id"`
	Name          string    `json:"name"`
	Description   string    `json:"description"`
	Host          string    `json:"host"`
	Port          int       `json:"port"`
	Username      string    `json:"username"`
	Password      string    `json:"password,omitempty"`    // Encrypted
	PrivateKey    string    `json:"private_key,omitempty"` // Encrypted
	AuthType      string    `json:"auth_type"`             // password or key
	Status        string    `json:"status"`                // online, offline
	Latency       int64     `json:"latency"`               // ms
	LastCheckTime time.Time `json:"last_check_time"`
	OSInfo        string    `json:"os_info"`
	CPUInfo       string    `json:"cpu_info"`
	MemInfo       string    `json:"mem_info"`
	DiskInfo      string    `json:"disk_info"`
	CreatedAt     time.Time `json:"created_at"`
}

type SnippetCategory struct {
	ID        string    `gorm:"primaryKey" json:"id"`
	TenantID  string    `gorm:"index:idx_snippet_categories_tenant;index:idx_snippet_categories_tenant_user" json:"tenant_id"`
	UserID    string    `gorm:"index:idx_snippet_categories_user;index:idx_snippet_categories_tenant_user" json:"user_id"`
	Name      string    `json:"name"`
	SortOrder int       `json:"sort_order"`
	CreatedAt time.Time `json:"created_at"`
}

type Snippet struct {
	ID          string    `gorm:"primaryKey" json:"id"`
	TenantID    string    `gorm:"index:idx_snippets_tenant;index:idx_snippets_tenant_user" json:"tenant_id"`
	UserID      string    `gorm:"index:idx_snippets_user;index:idx_snippets_tenant_user" json:"user_id"`
	Category    string    `json:"category"` // Legacy field, keeping for compatibility
	CategoryID  *string   `json:"category_id"`
	Title       string    `json:"title"`
	Command     string    `json:"command"`
	Description string    `json:"description"`
	CreatedAt   time.Time `json:"created_at"`
}

// --- Globals ---
var db *gorm.DB
var encryptionKey = []byte("0123456789abcdef0123456789abcdef") // TODO: Load from env

// --- WebSocket ---
var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

// --- Utils ---

// 提取用户上下文(从 Gateway 传递的 Header)
func getUserContext(c *gin.Context) (tenantID string, userID string, err error) {
	tenantID = c.GetHeader("X-Nav-Tenant-Id")
	if tenantID == "" {
		tenantID = "default"
	}

	userID = c.GetHeader("X-Nav-User-Id")
	if userID == "" {
		// 开发模式: 使用默认用户 (允许直连插件调试)
		if os.Getenv("DEV_MODE") == "true" || os.Getenv("PORT") != "" {
			return "default", "dev-user-001", nil
		}
		return "", "", fmt.Errorf("missing user context: X-Nav-User-Id header required")
	}

	return tenantID, userID, nil
}

func encrypt(text string) string {
	if text == "" {
		return ""
	}
	block, err := aes.NewCipher(encryptionKey)
	if err != nil {
		return ""
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return ""
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return ""
	}
	ciphertext := gcm.Seal(nonce, nonce, []byte(text), nil)
	return hex.EncodeToString(ciphertext)
}

func decrypt(text string) string {
	if text == "" {
		return ""
	}
	data, err := hex.DecodeString(text)
	if err != nil {
		return ""
	}
	block, err := aes.NewCipher(encryptionKey)
	if err != nil {
		return ""
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return ""
	}
	nonceSize := gcm.NonceSize()
	if len(data) < nonceSize {
		return ""
	}
	nonce, ciphertext := data[:nonceSize], data[nonceSize:]
	plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return ""
	}
	return string(plaintext)
}

func initDB() {
	var err error
	// Store in centralized data directory instead of plugin-local data directory
	// Get the project directory (three levels up from executable)
	executable, err := os.Executable()
	if err != nil {
		panic("failed to get executable path")
	}
	pluginDir := filepath.Dir(executable)
	projectDir := filepath.Dir(filepath.Dir(pluginDir)) // navlink-next directory
	dataDir := filepath.Join(projectDir, "data")

	// Ensure the data directory exists
	if _, err := os.Stat(dataDir); os.IsNotExist(err) {
		os.MkdirAll(dataDir, 0755)
	}

	dbPath := filepath.Join(dataDir, "vps.db")
	db, err = gorm.Open(sqlite.Open(dbPath), &gorm.Config{})
	if err != nil {
		panic("failed to connect database")
	}

	db.AutoMigrate(&Group{}, &Server{}, &SnippetCategory{}, &Snippet{})
}

func main() {
	initDB()

	r := gin.Default()

	config := cors.DefaultConfig()
	config.AllowAllOrigins = true
	config.AllowHeaders = []string{"Origin", "Content-Length", "Content-Type", "Authorization", "X-Nav-User-Id", "X-Nav-Tenant-Id"}
	r.Use(cors.New(config))

	api := r.Group("/api")
	{
		api.GET("/status", func(c *gin.Context) {
			c.JSON(200, gin.H{"status": "active", "service": "vps-plugin-go", "version": "1.0.0"})
		})

		// 健康检查端点 (供ServiceRegistry使用)
		api.GET("/health", func(c *gin.Context) {
			c.JSON(200, gin.H{"status": "healthy", "service": "vps"})
		})

		// Groups
		api.GET("/groups", getGroups)
		api.POST("/groups", createGroup)
		api.PUT("/groups/:id", updateGroup)
		api.DELETE("/groups/:id", deleteGroup)

		// Servers
		api.GET("/servers", getServers)
		api.GET("/servers/:id", getServer)
		api.POST("/servers", createServer)
		api.PUT("/servers/:id", updateServer)
		api.DELETE("/servers/:id", deleteServer)
		api.POST("/servers/check", checkServers)

		// Snippets
		api.GET("/snippets", getSnippets)
		api.POST("/snippets", createSnippet)
		api.PUT("/snippets/:id", updateSnippet)
		api.DELETE("/snippets/:id", deleteSnippet)

		// Snippet Categories
		api.GET("/snippet-categories", getSnippetCategories)
		api.POST("/snippet-categories", createSnippetCategory)
		api.PUT("/snippet-categories/:id", updateSnippetCategory)
		api.DELETE("/snippet-categories/:id", deleteSnippetCategory)
	}

	r.GET("/ws", func(c *gin.Context) {
		handleWebSocket(c.Writer, c.Request)
	})

	r.Static("/assets", "./frontend/dist/assets")
	r.StaticFile("/", "./frontend/dist/index.html")

	port := os.Getenv("PORT")
	if port == "" {
		port = "0"
	}

	addr := fmt.Sprintf(":%s", port)
	if port == "0" {
		addr = ":0"
	}

	fmt.Printf("VPS Plugin (Go) starting on %s\n", addr)

	// 启动HTTP服务器
	listener, err := net.Listen("tcp", addr)
	if err != nil {
		panic(err)
	}
	actualPort := listener.Addr().(*net.TCPAddr).Port
	fmt.Printf("VPS Plugin listening on port %d\n", actualPort)

	// 向Gateway注册服务
	go registerToGateway(actualPort)

	// 启动服务
	if err := http.Serve(listener, r); err != nil {
		panic(err)
	}
}

// 向Gateway注册服务
func registerToGateway(port int) {
	gatewayURL := os.Getenv("GATEWAY_URL")
	if gatewayURL == "" {
		gatewayURL = "http://127.0.0.1:3001"
	}

	registrationData := map[string]interface{}{
		"id":          "vps",
		"name":        "VPS管理",
		"version":     "1.0.0",
		"url":         fmt.Sprintf("http://127.0.0.1:%d", port),
		"routes":      []string{"/api/groups", "/api/servers", "/api/snippets", "/api/snippet-categories"},
		"healthCheck": "/api/health",
	}

	data, _ := json.Marshal(registrationData)

	// 重试逻辑
	for i := 0; i < 5; i++ {
		time.Sleep(time.Second * time.Duration(i))

		resp, err := http.Post(
			fmt.Sprintf("%s/api/registry/register", gatewayURL),
			"application/json",
			strings.NewReader(string(data)),
		)

		if err == nil && resp.StatusCode == 200 {
			fmt.Printf("✓ VPS Plugin registered to Gateway at port %d\n", port)
			resp.Body.Close()
			return
		}

		if err != nil {
			fmt.Printf("× Registration attempt %d failed: %v\n", i+1, err)
		} else {
			fmt.Printf("× Registration attempt %d failed: HTTP %d\n", i+1, resp.StatusCode)
			resp.Body.Close()
		}
	}

	fmt.Println("⚠ Failed to register to Gateway after 5 attempts")
}

// --- Handlers ---

// Groups
func getGroups(c *gin.Context) {
	tenantID, userID, err := getUserContext(c)
	if err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	var groups []Group
	db.Where("tenant_id = ? AND user_id = ?", tenantID, userID).Order("sort_order asc").Find(&groups)
	c.JSON(200, groups)
}

func createGroup(c *gin.Context) {
	tenantID, userID, err := getUserContext(c)
	if err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	var group Group
	if err := c.ShouldBindJSON(&group); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}
	group.ID = uuid.New().String()
	group.TenantID = tenantID
	group.UserID = userID
	group.CreatedAt = time.Now()
	db.Create(&group)
	c.JSON(201, group)
}

func updateGroup(c *gin.Context) {
	tenantID, userID, err := getUserContext(c)
	if err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	var group Group
	if err := db.Where("id = ? AND tenant_id = ? AND user_id = ?", c.Param("id"), tenantID, userID).First(&group).Error; err != nil {
		c.JSON(404, gin.H{"error": "Group not found or access denied"})
		return
	}
	var input Group
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}
	db.Model(&group).Updates(input)
	c.JSON(200, group)
}

func deleteGroup(c *gin.Context) {
	tenantID, userID, err := getUserContext(c)
	if err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	result := db.Where("id = ? AND tenant_id = ? AND user_id = ?", c.Param("id"), tenantID, userID).Delete(&Group{})
	if result.RowsAffected == 0 {
		c.JSON(404, gin.H{"error": "Group not found or access denied"})
		return
	}
	c.JSON(200, gin.H{"success": true})
}

// Servers
func getServers(c *gin.Context) {
	tenantID, userID, err := getUserContext(c)
	if err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	var servers []Server
	db.Where("tenant_id = ? AND user_id = ?", tenantID, userID).Order("created_at desc").Find(&servers)
	// Hide secrets
	for i := range servers {
		servers[i].Password = ""
		servers[i].PrivateKey = ""
	}
	c.JSON(200, servers)
}

func getServer(c *gin.Context) {
	tenantID, userID, err := getUserContext(c)
	if err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	var server Server
	if err := db.Where("id = ? AND tenant_id = ? AND user_id = ?", c.Param("id"), tenantID, userID).First(&server).Error; err != nil {
		c.JSON(404, gin.H{"error": "Server not found or access denied"})
		return
	}
	// Hide secrets
	server.Password = ""
	server.PrivateKey = ""
	c.JSON(200, server)
}

func createServer(c *gin.Context) {
	tenantID, userID, err := getUserContext(c)
	if err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	var server Server
	if err := c.ShouldBindJSON(&server); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}
	server.ID = uuid.New().String()
	server.TenantID = tenantID
	server.UserID = userID
	server.CreatedAt = time.Now()
	if server.Port == 0 {
		server.Port = 22
	}
	if server.Password != "" {
		server.Password = encrypt(server.Password)
	}
	if server.PrivateKey != "" {
		server.PrivateKey = encrypt(server.PrivateKey)
	}
	db.Create(&server)
	server.Password = ""
	server.PrivateKey = ""
	c.JSON(201, server)
}

func updateServer(c *gin.Context) {
	tenantID, userID, err := getUserContext(c)
	if err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	var server Server
	if err := db.Where("id = ? AND tenant_id = ? AND user_id = ?", c.Param("id"), tenantID, userID).First(&server).Error; err != nil {
		c.JSON(404, gin.H{"error": "Server not found or access denied"})
		return
	}
	var input Server
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	if input.Password != "" {
		input.Password = encrypt(input.Password)
	} else {
		input.Password = server.Password // Keep existing
	}
	if input.PrivateKey != "" {
		input.PrivateKey = encrypt(input.PrivateKey)
	} else {
		input.PrivateKey = server.PrivateKey // Keep existing
	}

	db.Model(&server).Updates(input)
	server.Password = ""
	server.PrivateKey = ""
	c.JSON(200, server)
}

func deleteServer(c *gin.Context) {
	tenantID, userID, err := getUserContext(c)
	if err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	result := db.Where("id = ? AND tenant_id = ? AND user_id = ?", c.Param("id"), tenantID, userID).Delete(&Server{})
	if result.RowsAffected == 0 {
		c.JSON(404, gin.H{"error": "Server not found or access denied"})
		return
	}
	c.JSON(200, gin.H{"success": true})
}

func checkServers(c *gin.Context) {
	tenantID, userID, err := getUserContext(c)
	if err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	var req struct {
		IDs []string `json:"ids"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		// If empty, check all?
	}

	var servers []Server
	if len(req.IDs) > 0 {
		db.Where("tenant_id = ? AND user_id = ?", tenantID, userID).Find(&servers, req.IDs)
	} else {
		db.Where("tenant_id = ? AND user_id = ?", tenantID, userID).Find(&servers)
	}

	results := make([]map[string]interface{}, 0)
	for _, s := range servers {
		start := time.Now()
		conn, err := net.DialTimeout("tcp", fmt.Sprintf("%s:%d", s.Host, s.Port), 5*time.Second)
		status := "offline"
		var latency int64 = 0
		if err == nil {
			status = "online"
			latency = time.Since(start).Milliseconds()
			conn.Close()

			// If online and missing info, try to fetch via SSH
			if s.OSInfo == "" || s.CPUInfo == "" {
				go fetchSystemInfo(s)
			}
		}

		db.Model(&s).Updates(map[string]interface{}{
			"status":          status,
			"latency":         latency,
			"last_check_time": time.Now(),
		})

		results = append(results, map[string]interface{}{
			"id":      s.ID,
			"status":  status,
			"latency": latency,
		})
	}
	c.JSON(200, results)
}

func fetchSystemInfo(s Server) {
	fmt.Printf("[SystemInfo] Starting fetch for server %s (%s)\n", s.Name, s.Host)

	// Decrypt password/key
	password := decrypt(s.Password)
	privateKey := decrypt(s.PrivateKey)

	config := &ssh.ClientConfig{
		User:            s.Username,
		HostKeyCallback: ssh.InsecureIgnoreHostKey(),
		Timeout:         10 * time.Second,
	}

	if s.AuthType == "key" {
		signer, err := ssh.ParsePrivateKey([]byte(privateKey))
		if err == nil {
			config.Auth = []ssh.AuthMethod{ssh.PublicKeys(signer)}
		} else {
			fmt.Printf("[SystemInfo] Key parse error for %s: %v\n", s.Name, err)
		}
	} else {
		config.Auth = []ssh.AuthMethod{ssh.Password(password)}
	}

	client, err := ssh.Dial("tcp", fmt.Sprintf("%s:%d", s.Host, s.Port), config)
	if err != nil {
		fmt.Printf("[SystemInfo] SSH Dial error for %s: %v\n", s.Name, err)
		return
	}
	defer client.Close()

	session, err := client.NewSession()
	if err != nil {
		fmt.Printf("[SystemInfo] Session error for %s: %v\n", s.Name, err)
		return
	}
	defer session.Close()

	// Combined command to get all info
	// We use 'sh -c' to ensure shell features are available
	// We add '2>/dev/null' to suppress stderr from interfering
	cmd := `
	export TERM=dumb;
	(grep PRETTY_NAME /etc/os-release | cut -d= -f2 | tr -d '"' || uname -s) 2>/dev/null;
	echo "|||";
	nproc 2>/dev/null;
	echo "|||";
	(free -m | awk '/^Mem:/{print $2}') 2>/dev/null;
	echo "|||";
	(df -h / | awk 'NR==2{print $2}') 2>/dev/null
	`
	output, err := session.CombinedOutput(cmd)
	if err != nil {
		fmt.Printf("[SystemInfo] Command error for %s: %v\n", s.Name, err)
		return
	}

	outputStr := string(output)
	// fmt.Printf("[SystemInfo] Output for %s: %q\n", s.Name, outputStr)

	parts := strings.Split(outputStr, "|||")
	if len(parts) >= 4 {
		updates := map[string]interface{}{
			"os_info":   strings.TrimSpace(parts[0]),
			"cpu_info":  strings.TrimSpace(parts[1]) + " Cores",
			"mem_info":  strings.TrimSpace(parts[2]) + " MB",
			"disk_info": strings.TrimSpace(parts[3]),
		}
		fmt.Printf("[SystemInfo] Updating DB for %s: %+v\n", s.Name, updates)
		if err := db.Model(&s).Updates(updates).Error; err != nil {
			fmt.Printf("[SystemInfo] DB Update error for %s: %v\n", s.Name, err)
		} else {
			fmt.Printf("[SystemInfo] DB Update success for %s\n", s.Name)
		}
	} else {
		fmt.Printf("[SystemInfo] Invalid output format for %s\n", s.Name)
	}
}

// Snippets
func getSnippets(c *gin.Context) {
	tenantID, userID, err := getUserContext(c)
	if err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	var snippets []Snippet
	db.Where("tenant_id = ? AND user_id = ?", tenantID, userID).Order("category asc, title asc").Find(&snippets)
	c.JSON(200, snippets)
}

func createSnippet(c *gin.Context) {
	tenantID, userID, err := getUserContext(c)
	if err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	var snippet Snippet
	if err := c.ShouldBindJSON(&snippet); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}
	snippet.ID = uuid.New().String()
	snippet.TenantID = tenantID
	snippet.UserID = userID
	snippet.CreatedAt = time.Now()
	db.Create(&snippet)
	c.JSON(201, snippet)
}

func updateSnippet(c *gin.Context) {
	tenantID, userID, err := getUserContext(c)
	if err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	var snippet Snippet
	if err := db.Where("id = ? AND tenant_id = ? AND user_id = ?", c.Param("id"), tenantID, userID).First(&snippet).Error; err != nil {
		c.JSON(404, gin.H{"error": "Snippet not found or access denied"})
		return
	}
	var input Snippet
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}
	db.Model(&snippet).Updates(input)
	c.JSON(200, snippet)
}

func deleteSnippet(c *gin.Context) {
	tenantID, userID, err := getUserContext(c)
	if err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	result := db.Where("id = ? AND tenant_id = ? AND user_id = ?", c.Param("id"), tenantID, userID).Delete(&Snippet{})
	if result.RowsAffected == 0 {
		c.JSON(404, gin.H{"error": "Snippet not found or access denied"})
		return
	}
	c.JSON(200, gin.H{"success": true})
}

// Snippet Categories
func getSnippetCategories(c *gin.Context) {
	tenantID, userID, err := getUserContext(c)
	if err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	var categories []SnippetCategory
	db.Where("tenant_id = ? AND user_id = ?", tenantID, userID).Order("sort_order asc").Find(&categories)
	c.JSON(200, categories)
}

func createSnippetCategory(c *gin.Context) {
	tenantID, userID, err := getUserContext(c)
	if err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	var category SnippetCategory
	if err := c.ShouldBindJSON(&category); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}
	category.ID = uuid.New().String()
	category.TenantID = tenantID
	category.UserID = userID
	category.CreatedAt = time.Now()
	db.Create(&category)
	c.JSON(201, category)
}

func updateSnippetCategory(c *gin.Context) {
	tenantID, userID, err := getUserContext(c)
	if err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	var category SnippetCategory
	if err := db.Where("id = ? AND tenant_id = ? AND user_id = ?", c.Param("id"), tenantID, userID).First(&category).Error; err != nil {
		c.JSON(404, gin.H{"error": "Category not found or access denied"})
		return
	}
	var input SnippetCategory
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}
	db.Model(&category).Updates(input)
	c.JSON(200, category)
}

func deleteSnippetCategory(c *gin.Context) {
	tenantID, userID, err := getUserContext(c)
	if err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	result := db.Where("id = ? AND tenant_id = ? AND user_id = ?", c.Param("id"), tenantID, userID).Delete(&SnippetCategory{})
	if result.RowsAffected == 0 {
		c.JSON(404, gin.H{"error": "Category not found or access denied"})
		return
	}
	c.JSON(200, gin.H{"success": true})
}

// --- SSH Handler ---

func handleWebSocket(w http.ResponseWriter, r *http.Request) {
	defer func() {
		if r := recover(); r != nil {
			fmt.Println("Recovered from panic in handleWebSocket:", r)
		}
	}()

	fmt.Println("WS Handler Reached for serverId:", r.URL.Query().Get("serverId")) // Debug Log
	serverId := r.URL.Query().Get("serverId")
	if serverId == "" {
		http.Error(w, "Missing serverId", 400)
		return
	}

	// Get Server Info
	var server Server
	if err := db.First(&server, "id = ?", serverId).Error; err != nil {
		fmt.Println("Server not found in DB") // Debug
		http.Error(w, "Server not found", 404)
		return
	}
	fmt.Println("Server found:", server.Name) // Debug

	// Decrypt secrets
	password := ""
	if server.Password != "" {
		password = decrypt(server.Password)
	}
	privateKey := ""
	if server.PrivateKey != "" {
		privateKey = decrypt(server.PrivateKey)
	}
	fmt.Println("Secrets decrypted") // Debug

	// Determine connection type: "terminal" (default) or "control"
	connType := r.URL.Query().Get("type")

	// SSH Config
	config := &ssh.ClientConfig{
		User:            server.Username,
		HostKeyCallback: ssh.InsecureIgnoreHostKey(), // TODO: Handle host keys properly
		Timeout:         10 * time.Second,
	}

	if server.AuthType == "key" && privateKey != "" {
		signer, err := ssh.ParsePrivateKey([]byte(privateKey))
		if err != nil {
			http.Error(w, "Invalid private key", 500)
			return
		}
		config.Auth = []ssh.AuthMethod{ssh.PublicKeys(signer)}
	} else {
		config.Auth = []ssh.AuthMethod{ssh.Password(password)}
	}

	// Upgrade WebSocket
	ws, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}
	defer ws.Close()

	// Connect to SSH
	addr := fmt.Sprintf("%s:%d", server.Host, server.Port)
	client, err := ssh.Dial("tcp", addr, config)
	if err != nil {
		ws.WriteMessage(websocket.TextMessage, []byte(fmt.Sprintf("\r\nSSH Connection Failed: %v\r\n", err)))
		return
	}
	defer client.Close()

	// Handle Control Connection (Monitoring, SFTP)
	if connType == "control" {
		handleControlConnection(ws, client)
		return
	}

	// Handle Terminal Connection (Raw Pipe)
	session, err := client.NewSession()
	if err != nil {
		ws.WriteMessage(websocket.TextMessage, []byte("Failed to create session: "+err.Error()))
		return
	}
	defer session.Close()

	// Request PTY
	modes := ssh.TerminalModes{
		ssh.ECHO:          1,
		ssh.TTY_OP_ISPEED: 14400,
		ssh.TTY_OP_OSPEED: 14400,
	}
	if err := session.RequestPty("xterm", 24, 80, modes); err != nil {
		ws.WriteMessage(websocket.TextMessage, []byte("Failed to request PTY: "+err.Error()))
		return
	}

	// Pipe Stdin/Stdout/Stderr
	stdin, _ := session.StdinPipe()
	stdout, _ := session.StdoutPipe()
	stderr, _ := session.StderrPipe()

	var mu sync.Mutex
	wrapper := wsWrapper{ws, &mu}

	go func() {
		// Read from WS and write to SSH Stdin
		for {
			mt, p, err := ws.ReadMessage()
			if err != nil {
				break
			}

			// Handle Resize (JSON Text Message)
			if mt == websocket.TextMessage {
				var msg struct {
					Type string `json:"type"`
					Cols int    `json:"cols"`
					Rows int    `json:"rows"`
				}
				// Try to parse as JSON
				if err := json.Unmarshal(p, &msg); err == nil && msg.Type == "resize" {
					// fmt.Printf("Resizing terminal to %dx%d\n", msg.Cols, msg.Rows)
					if err := session.WindowChange(msg.Rows, msg.Cols); err != nil {
						// fmt.Printf("WindowChange error: %v\n", err)
					}
					continue // Do not pipe resize message to stdin
				}
			}

			// Pipe Binary/Other messages to Stdin
			if _, err := stdin.Write(p); err != nil {
				break
			}
		}
	}()

	go func() {
		// Combine stdout and stderr
		io.Copy(wrapper, stdout)
	}()
	go func() {
		io.Copy(wrapper, stderr)
	}()

	// Start Shell
	if err := session.Shell(); err != nil {
		ws.WriteMessage(websocket.TextMessage, []byte("Failed to start shell: "+err.Error()))
		return
	}

	// Wait for session to finish
	session.Wait()
}

// Control Message Structure
type ControlMessage struct {
	Type    string          `json:"type"`
	Payload json.RawMessage `json:"payload"`
}

// Monitoring Data Structure
type MonitorData struct {
	CPU  float64 `json:"cpu"`
	Mem  MemInfo `json:"mem"`
	Disk int     `json:"disk"`
	Net  NetInfo `json:"net"`
}

type MemInfo struct {
	Total int `json:"total"`
	Used  int `json:"used"`
}

type NetInfo struct {
	Up   float64 `json:"up"`
	Down float64 `json:"down"`
}

func handleControlConnection(ws *websocket.Conn, client *ssh.Client) {
	var mu sync.Mutex // Mutex for WS writes

	// Initialize SFTP Client
	sftpClient, err := sftp.NewClient(client)
	if err != nil {
		fmt.Println("Failed to create SFTP client:", err)
		return
	}
	defer sftpClient.Close()

	// Channel to signal stop monitoring
	stopMonitor := make(chan bool)
	isMonitoring := false

	defer func() {
		if isMonitoring {
			close(stopMonitor)
		}
	}()

	for {
		var msg ControlMessage
		err := ws.ReadJSON(&msg)
		if err != nil {
			break
		}

		if strings.HasPrefix(msg.Type, "sftp:") {
			go handleSFTPMessage(ws, &mu, sftpClient, msg)
		} else {
			switch msg.Type {
			case "monitor:start":
				if !isMonitoring {
					isMonitoring = true
					go startMonitoring(ws, client, &mu, stopMonitor)
				}
			case "monitor:stop":
				if isMonitoring {
					isMonitoring = false
					stopMonitor <- true
				}
			}
		}
	}
}

func handleSFTPMessage(ws *websocket.Conn, mu *sync.Mutex, client *sftp.Client, msg ControlMessage) {
	var response interface{}
	var errorMsg string

	switch msg.Type {
	case "sftp:list":
		var payload struct {
			Path string `json:"path"`
		}
		json.Unmarshal(msg.Payload, &payload)
		files, err := client.ReadDir(payload.Path)
		if err != nil {
			errorMsg = err.Error()
		} else {
			fileList := make([]map[string]interface{}, 0)
			for _, f := range files {
				fileList = append(fileList, map[string]interface{}{
					"name":    f.Name(),
					"size":    f.Size(),
					"mode":    f.Mode().String(),
					"modTime": f.ModTime(),
					"isDir":   f.IsDir(),
				})
			}
			response = fileList
		}

	case "sftp:read":
		var payload struct {
			Path string `json:"path"`
		}
		json.Unmarshal(msg.Payload, &payload)
		f, err := client.Open(payload.Path)
		if err != nil {
			errorMsg = err.Error()
		} else {
			defer f.Close()
			content, err := io.ReadAll(f)
			if err != nil {
				errorMsg = err.Error()
			} else {
				response = string(content)
			}
		}

	case "sftp:write":
		var payload struct {
			Path    string `json:"path"`
			Content string `json:"content"`
		}
		json.Unmarshal(msg.Payload, &payload)
		f, err := client.Create(payload.Path)
		if err != nil {
			errorMsg = err.Error()
		} else {
			defer f.Close()
			_, err = f.Write([]byte(payload.Content))
			if err != nil {
				errorMsg = err.Error()
			} else {
				response = "ok"
			}
		}

	case "sftp:delete":
		var payload struct {
			Path string `json:"path"`
		}
		json.Unmarshal(msg.Payload, &payload)
		// Try removing as file first, then directory
		err := client.Remove(payload.Path)
		if err != nil {
			err = client.RemoveDirectory(payload.Path)
		}
		if err != nil {
			errorMsg = err.Error()
		} else {
			response = "ok"
		}

	case "sftp:rename":
		var payload struct {
			OldPath string `json:"oldPath"`
			NewPath string `json:"newPath"`
		}
		json.Unmarshal(msg.Payload, &payload)
		err := client.Rename(payload.OldPath, payload.NewPath)
		if err != nil {
			errorMsg = err.Error()
		} else {
			response = "ok"
		}

	case "sftp:mkdir":
		var payload struct {
			Path string `json:"path"`
		}
		json.Unmarshal(msg.Payload, &payload)
		err := client.Mkdir(payload.Path)
		if err != nil {
			errorMsg = err.Error()
		} else {
			response = "ok"
		}

	case "sftp:upload:chunk":
		var payload struct {
			Path     string `json:"path"`
			Content  string `json:"content"`
			Position int64  `json:"position"`
			IsLast   bool   `json:"isLast"`
		}
		json.Unmarshal(msg.Payload, &payload)

		// Decode base64
		data, err := base64.StdEncoding.DecodeString(payload.Content)
		if err != nil {
			errorMsg = "Failed to decode base64: " + err.Error()
			break
		}

		// Open or create file
		var f *sftp.File
		if payload.Position == 0 {
			// First chunk - create new file
			f, err = client.Create(payload.Path)
		} else {
			// Subsequent chunks - open for append
			f, err = client.OpenFile(payload.Path, os.O_WRONLY|os.O_APPEND)
		}

		if err != nil {
			errorMsg = "Failed to open file: " + err.Error()
			break
		}
		defer f.Close()

		// Write chunk
		_, err = f.Write(data)
		if err != nil {
			errorMsg = "Failed to write chunk: " + err.Error()
		} else {
			response = "ok"
		}

	case "sftp:download":
		var payload struct {
			Path string `json:"path"`
		}
		json.Unmarshal(msg.Payload, &payload)

		f, err := client.Open(payload.Path)
		if err != nil {
			errorMsg = err.Error()
		} else {
			defer f.Close()
			content, err := io.ReadAll(f)
			if err != nil {
				errorMsg = err.Error()
			} else {
				// Get filename from path
				filename := filepath.Base(payload.Path)
				// Encode as base64
				encoded := base64.StdEncoding.EncodeToString(content)
				// Send response with filename
				mu.Lock()
				ws.WriteJSON(map[string]interface{}{
					"type":     "sftp:download:response",
					"data":     encoded,
					"filename": filename,
				})
				mu.Unlock()
				return // Early return to avoid double response
			}
		}
	}

	// Send Response
	mu.Lock()
	defer mu.Unlock()

	respData := map[string]interface{}{
		"type": msg.Type + ":response",
	}

	if errorMsg != "" {
		respData["error"] = errorMsg
	} else {
		respData["data"] = response
	}

	ws.WriteJSON(respData)
}

func startMonitoring(ws *websocket.Conn, client *ssh.Client, mu *sync.Mutex, stop <-chan bool) {
	ticker := time.NewTicker(2 * time.Second)
	defer ticker.Stop()

	var prevNetRx, prevNetTx float64
	var prevCpuTotal, prevCpuIdle float64
	var lastCheckTime time.Time

	for {
		select {
		case <-stop:
			return
		case <-ticker.C:
			// Execute monitoring commands
			// Combined command to reduce round-trips
			cmd := `cat /proc/stat | grep '^cpu '; echo "|||"; free -m; echo "|||"; df -h / | tail -1; echo "|||"; cat /proc/net/dev`
			session, err := client.NewSession()
			if err != nil {
				continue
			}
			output, err := session.CombinedOutput(cmd)
			session.Close()
			if err != nil {
				continue
			}

			// Parse Output
			parts := strings.Split(string(output), "|||")
			if len(parts) < 4 {
				continue
			}

			// 1. CPU
			cpuFields := strings.Fields(parts[0])
			var cpuUsage float64
			if len(cpuFields) >= 5 {
				user, _ := strconv.ParseFloat(cpuFields[1], 64)
				nice, _ := strconv.ParseFloat(cpuFields[2], 64)
				system, _ := strconv.ParseFloat(cpuFields[3], 64)
				idle, _ := strconv.ParseFloat(cpuFields[4], 64)
				total := user + nice + system + idle

				if prevCpuTotal > 0 {
					totalDiff := total - prevCpuTotal
					idleDiff := idle - prevCpuIdle
					if totalDiff > 0 {
						cpuUsage = ((totalDiff - idleDiff) / totalDiff) * 100
					}
				}
				prevCpuTotal = total
				prevCpuIdle = idle
			}

			// 2. Memory
			memLines := strings.Split(strings.TrimSpace(parts[1]), "\n")
			var memTotal, memUsed int
			if len(memLines) >= 2 {
				memFields := strings.Fields(memLines[1]) // Mem: line
				if len(memFields) >= 3 {
					memTotal, _ = strconv.Atoi(memFields[1])
					memUsed, _ = strconv.Atoi(memFields[2])
				}
			}

			// 3. Disk
			diskFields := strings.Fields(strings.TrimSpace(parts[2]))
			var diskUsage int
			if len(diskFields) >= 5 {
				diskUsage, _ = strconv.Atoi(strings.TrimSuffix(diskFields[4], "%"))
			}

			// 4. Network
			netLines := strings.Split(strings.TrimSpace(parts[3]), "\n")
			var rx, tx float64
			for _, line := range netLines {
				if strings.Contains(line, ":") {
					fields := strings.Fields(strings.Split(line, ":")[1])
					if len(fields) >= 9 {
						r, _ := strconv.ParseFloat(fields[0], 64)
						t, _ := strconv.ParseFloat(fields[8], 64)
						rx += r
						tx += t
					}
				}
			}

			var netUp, netDown float64
			now := time.Now()
			if !lastCheckTime.IsZero() {
				duration := now.Sub(lastCheckTime).Seconds()
				if duration > 0 {
					netDown = (rx - prevNetRx) / duration
					netUp = (tx - prevNetTx) / duration
				}
			}
			prevNetRx = rx
			prevNetTx = tx
			lastCheckTime = now

			// Send Data
			data := MonitorData{
				CPU:  cpuUsage, // TODO: Fix CPU calc
				Mem:  MemInfo{Total: memTotal, Used: memUsed},
				Disk: diskUsage,
				Net:  NetInfo{Up: netUp, Down: netDown},
			}

			mu.Lock()
			ws.WriteJSON(map[string]interface{}{
				"type": "monitor:data",
				"data": data,
			})
			mu.Unlock()
		}
	}
}

// Helper to wrap websocket for io.Reader/Writer interface
type wsWrapper struct {
	*websocket.Conn
	mu *sync.Mutex
}

func (w wsWrapper) Write(p []byte) (n int, err error) {
	w.mu.Lock()
	defer w.mu.Unlock()
	// fmt.Printf("Writing WS message: %d bytes\n", len(p)) // Debug log
	err = w.Conn.WriteMessage(websocket.BinaryMessage, p)
	if err != nil {
		fmt.Printf("WS Write Error: %v\n", err)
	}
	return len(p), err
}

func (w wsWrapper) Read(p []byte) (n int, err error) {
	// This is tricky because ReadMessage returns a whole message
	// We might need a buffer.
	// For now, let's simplify and just handle the copy loop manually in handleWebSocket
	return 0, nil
}
