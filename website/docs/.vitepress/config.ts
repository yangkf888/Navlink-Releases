import { defineConfig } from 'vitepress'

export default defineConfig({
    // 站点配置
    title: 'NavLink',
    description: '开源智能导航站 - 自托管、可定制、功能强大',
    lang: 'zh-CN',

    // 部署配置
    base: '/',

    // Head 配置
    head: [
        ['link', { rel: 'icon', href: '/logo.png' }],
        ['meta', { name: 'theme-color', content: '#646cff' }],
        ['meta', { name: 'og:type', content: 'website' }],
        ['meta', { name: 'og:title', content: 'NavLink - 开源智能导航站' }],
        ['meta', { name: 'og:description', content: '自托管、可定制、功能强大的现代化导航站' }],
        ['meta', { name: 'og:image', content: '/index1.jpg' }],
    ],

    // 主题配置
    themeConfig: {
        // Logo
        logo: '/logo.png',
        siteTitle: 'NavLink',

        // 导航栏
        nav: [
            { text: '首页', link: '/' },
            { text: '快速开始', link: '/guide/getting-started' },
            { text: '功能特性', link: '/features/' },
            { text: '插件系统', link: '/plugins/' },
            { text: 'Chrome 插件', link: 'https://github.com/txwebroot/Navlink-Releases/raw/refs/heads/main/chrome-extension.zip' },
            { text: '更新日志', link: '/changelog' },
            {
                text: '相关链接',
                items: [
                    { text: 'GitHub Releases', link: 'https://github.com/txwebroot/Navlink-Releases' },
                    { text: 'Docker 镜像', link: 'https://github.com/txwebroot/navlink-releases/pkgs/container/navlink-releases' }
                ]
            }
        ],

        // 侧边栏 - 包含页内锚点作为二级目录
        sidebar: {
            '/guide/': [
                {
                    text: '入门指南',
                    items: [
                        {
                            text: '快速开始',
                            link: '/guide/getting-started',
                            items: [
                                { text: 'Docker 部署', link: '/guide/getting-started#docker-部署' },
                                { text: '验证部署', link: '/guide/getting-started#验证部署' }
                            ]
                        },
                        {
                            text: 'Docker 部署详解',
                            link: '/guide/docker-deploy',
                            items: [
                                { text: '完整 docker-compose.yml', link: '/guide/docker-deploy#完整-docker-compose-yml' },
                                { text: '环境变量说明', link: '/guide/docker-deploy#环境变量说明' },
                                { text: '数据目录说明', link: '/guide/docker-deploy#数据目录说明' },
                                { text: '反向代理配置', link: '/guide/docker-deploy#反向代理配置' },
                                { text: '升级指南', link: '/guide/docker-deploy#升级指南' }
                            ]
                        },
                        {
                            text: '配置说明',
                            link: '/guide/configuration',
                            items: [
                                { text: '基础设置', link: '/guide/configuration#基础设置' },
                                { text: '搜索配置', link: '/guide/configuration#搜索配置' },
                                { text: '分类与链接', link: '/guide/configuration#分类与链接' },
                                { text: 'AI 配置', link: '/guide/configuration#ai-配置' }
                            ]
                        },
                        { text: '常见问题', link: '/guide/faq' }
                    ]
                }
            ],
            '/features/': [
                {
                    text: '功能特性',
                    items: [
                        { text: '功能概览', link: '/features/' },
                        {
                            text: '聚合搜索',
                            link: '/features/search',
                            items: [
                                { text: '多引擎搜索', link: '/features/search#多引擎搜索' },
                                { text: '拼音匹配', link: '/features/search#拼音匹配' },
                                { text: '历史记录', link: '/features/search#历史记录' }
                            ]
                        },
                        {
                            text: '智能导航',
                            link: '/features/navigation',
                            items: [
                                { text: '多级分类', link: '/features/navigation#多级分类' },
                                { text: '链接管理', link: '/features/navigation#链接管理' },
                                { text: '链接健康检测', link: '/features/navigation#链接健康检测' },
                                { text: '访问控制', link: '/features/navigation#访问控制' }
                            ]
                        },
                        {
                            text: 'AI 助手',
                            link: '/features/ai-chat',
                            items: [
                                { text: '支持的 AI 提供商', link: '/features/ai-chat#支持的-ai-提供商' },
                                { text: '配置 AI', link: '/features/ai-chat#配置-ai' },
                                { text: '知识库增强', link: '/features/ai-chat#知识库增强-rag' }
                            ]
                        },
                        {
                            text: '主题定制',
                            link: '/features/customization',
                            items: [
                                { text: '主题配色', link: '/features/customization#主题配色' },
                                { text: '背景设置', link: '/features/customization#背景设置' },
                                { text: '导航栏样式', link: '/features/customization#导航栏样式' },
                                { text: '侧边栏', link: '/features/customization#侧边栏' }
                            ]
                        },
                        {
                            text: '后台管理',
                            link: '/features/admin',
                            items: [
                                { text: '分类管理', link: '/features/admin#分类管理' },
                                { text: '数据管理', link: '/features/admin#数据管理' },
                                { text: '链接健康', link: '/features/admin#链接健康' },
                                { text: '系统升级', link: '/features/admin#系统升级' }
                            ]
                        }
                    ]
                }
            ],
            '/plugins/': [
                {
                    text: '插件系统',
                    items: [
                        { text: '插件概述', link: '/plugins/' },
                        {
                            text: 'Docker 管理',
                            link: '/plugins/docker',
                            items: [
                                { text: '容器管理', link: '/plugins/docker#-容器管理' },
                                { text: '镜像管理', link: '/plugins/docker#-镜像管理' },
                                { text: '远程连接', link: '/plugins/docker#-远程连接' }
                            ]
                        },
                        {
                            text: 'VPS 运维',
                            link: '/plugins/vps',
                            items: [
                                { text: '资源监控', link: '/plugins/vps#-资源监控' },
                                { text: '分组管理', link: '/plugins/vps#-分组管理' },
                                { text: 'Web SSH 终端', link: '/plugins/vps#-web-ssh-终端' },
                                { text: '命令片段', link: '/plugins/vps#-命令片段-snippets' }
                            ]
                        },
                        {
                            text: '订阅监控',
                            link: '/plugins/sub',
                            items: [
                                { text: '订阅追踪', link: '/plugins/sub#-订阅追踪' },
                                { text: 'SSL/域名监控', link: '/plugins/sub#-ssl-域名监控' },
                                { text: '多渠道通知', link: '/plugins/sub#-多渠道通知' }
                            ]
                        },
                        {
                            text: '知识库 (KB-RAG)',
                            link: '/plugins/kbrag',
                            items: [
                                { text: '网页收藏', link: '/plugins/kbrag#-网页收藏' },
                                { text: '向量检索', link: '/plugins/kbrag#-向量检索' },
                                { text: 'AI 问答', link: '/plugins/kbrag#-ai-问答' }
                            ]
                        }
                    ]
                }
            ]
        },

        // 社交链接
        socialLinks: [
            { icon: 'github', link: 'https://github.com/txwebroot/Navlink-Releases' }
        ],

        // 页脚
        footer: {
            message: '基于 Docker 一键部署',
            copyright: 'Copyright © 2024 NavLink'
        },

        // 搜索
        search: {
            provider: 'local',
            options: {
                translations: {
                    button: {
                        buttonText: '搜索文档',
                        buttonAriaLabel: '搜索文档'
                    },
                    modal: {
                        noResultsText: '未找到相关结果',
                        resetButtonTitle: '清除查询条件',
                        footer: {
                            selectText: '选择',
                            navigateText: '切换'
                        }
                    }
                }
            }
        },

        // 最后更新时间
        lastUpdated: {
            text: '最后更新于',
            formatOptions: {
                dateStyle: 'short',
                timeStyle: 'short'
            }
        },

        // 文档页脚导航
        docFooter: {
            prev: '上一页',
            next: '下一页'
        },

        // 大纲配置 - 禁用右侧目录，让内容区更宽
        outline: false,

        // 禁用右侧aside
        aside: false,

        // 返回顶部
        returnToTopLabel: '返回顶部'
    },

    // Markdown 配置
    markdown: {
        lineNumbers: true,
        image: {
            lazyLoading: true
        }
    },

    // 构建配置
    vite: {
        server: {
            port: 5175
        }
    }
})
