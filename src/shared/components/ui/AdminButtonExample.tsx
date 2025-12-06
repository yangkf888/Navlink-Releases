import React, { useState } from 'react';
import { Button, ToggleButton, ButtonGroup } from './AdminButton';
import { Icon } from '../common/Icon';

/**
 * 后台按钮UI系统使用示例
 * 此文件仅用于展示,不在实际页面中使用
 */

export const AdminButtonExample: React.FC = () => {
    const [selectedTab, setSelectedTab] = useState('tab1');
    const [loading, setLoading] = useState(false);
    const [toggleStates, setToggleStates] = useState({
        option1: true,
        option2: false,
        option3: false
    });

    const handleLoadingTest = () => {
        setLoading(true);
        setTimeout(() => setLoading(false), 2000);
    };

    return (
        <div className="p-8 space-y-12 bg-gray-50">
            {/* 标题 */}
            <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">后台按钮UI系统</h1>
                <p className="text-gray-600">统一的按钮样式设计,确保整个后台界面风格一致</p>
            </div>

            {/* 1. 基础按钮变体 */}
            <section className="bg-white p-6 rounded-xl shadow-sm">
                <h2 className="text-xl font-bold mb-4 text-gray-800">1. 基础按钮变体</h2>
                <div className="space-y-4">
                    <div className="flex items-center gap-4 flex-wrap">
                        <Button variant="primary">主要操作</Button>
                        <Button variant="secondary">次要操作</Button>
                        <Button variant="success">成功/确认</Button>
                        <Button variant="danger">危险提示</Button>
                        <Button variant="danger-solid">危险操作</Button>
                        <Button variant="warning">警告</Button>
                        <Button variant="ghost">幽灵按钮</Button>
                        <Button variant="outline">轮廓按钮</Button>
                        <Button variant="selected">选中状态</Button>
                        <Button variant="link">链接样式</Button>
                    </div>
                </div>
            </section>

            {/* 2. 按钮尺寸 */}
            <section className="bg-white p-6 rounded-xl shadow-sm">
                <h2 className="text-xl font-bold mb-4 text-gray-800">2. 按钮尺寸</h2>
                <div className="flex items-center gap-4">
                    <Button size="xs">超小按钮</Button>
                    <Button size="sm">小按钮</Button>
                    <Button size="md">中等按钮</Button>
                    <Button size="lg">大按钮</Button>
                </div>
            </section>

            {/* 3. 带图标的按钮 */}
            <section className="bg-white p-6 rounded-xl shadow-sm">
                <h2 className="text-xl font-bold mb-4 text-gray-800">3. 带图标的按钮</h2>
                <div className="space-y-4">
                    <div className="flex items-center gap-4">
                        <Button icon={<Icon icon="fa-solid fa-plus" />}>添加</Button>
                        <Button variant="danger" icon={<Icon icon="fa-solid fa-trash" />}>删除</Button>
                        <Button variant="secondary" icon={<Icon icon="fa-solid fa-download" />}>下载</Button>
                        <Button variant="success" icon={<Icon icon="fa-solid fa-check" />}>保存</Button>
                    </div>
                    <div className="flex items-center gap-4">
                        <Button icon={<Icon icon="fa-solid fa-arrow-right" />} iconPosition="right">
                            下一步
                        </Button>
                        <Button variant="outline" icon={<Icon icon="fa-solid fa-search" />}>
                            搜索
                        </Button>
                    </div>
                </div>
            </section>

            {/* 4. 加载状态 */}
            <section className="bg-white p-6 rounded-xl shadow-sm">
                <h2 className="text-xl font-bold mb-4 text-gray-800">4. 加载状态</h2>
                <div className="flex items-center gap-4">
                    <Button loading={loading} onClick={handleLoadingTest}>
                        {loading ? '加载中...' : '点击测试加载'}
                    </Button>
                    <Button variant="success" loading>保存中...</Button>
                    <Button variant="danger-solid" loading>删除中...</Button>
                </div>
            </section>

            {/* 5. 禁用状态 */}
            <section className="bg-white p-6 rounded-xl shadow-sm">
                <h2 className="text-xl font-bold mb-4 text-gray-800">5. 禁用状态</h2>
                <div className="flex items-center gap-4 flex-wrap">
                    <Button disabled>主要按钮</Button>
                    <Button variant="secondary" disabled>次要按钮</Button>
                    <Button variant="success" disabled>成功按钮</Button>
                    <Button variant="danger-solid" disabled>危险按钮</Button>
                    <Button variant="ghost" disabled>幽灵按钮</Button>
                    <Button variant="outline" disabled>轮廓按钮</Button>
                </div>
            </section>

            {/* 6. 切换按钮 */}
            <section className="bg-white p-6 rounded-xl shadow-sm">
                <h2 className="text-xl font-bold mb-4 text-gray-800">6. 切换按钮 (ToggleButton)</h2>
                <div className="space-y-4">
                    <div className="flex items-center gap-4">
                        <ToggleButton 
                            active={toggleStates.option1}
                            onClick={() => setToggleStates(s => ({ ...s, option1: !s.option1 }))}
                        >
                            选项一
                        </ToggleButton>
                        <ToggleButton 
                            active={toggleStates.option2}
                            onClick={() => setToggleStates(s => ({ ...s, option2: !s.option2 }))}
                        >
                            选项二
                        </ToggleButton>
                        <ToggleButton 
                            active={toggleStates.option3}
                            onClick={() => setToggleStates(s => ({ ...s, option3: !s.option3 }))}
                        >
                            选项三
                        </ToggleButton>
                    </div>
                    <p className="text-sm text-gray-500">
                        当前选中: {Object.entries(toggleStates).filter(([_, v]) => v).map(([k]) => k).join(', ') || '无'}
                    </p>
                </div>
            </section>

            {/* 7. 按钮组 */}
            <section className="bg-white p-6 rounded-xl shadow-sm">
                <h2 className="text-xl font-bold mb-4 text-gray-800">7. 按钮组 (ButtonGroup)</h2>
                <div className="space-y-4">
                    <ButtonGroup>
                        <Button 
                            variant={selectedTab === 'tab1' ? 'selected' : 'secondary'}
                            onClick={() => setSelectedTab('tab1')}
                        >
                            纯色背景
                        </Button>
                        <Button 
                            variant={selectedTab === 'tab2' ? 'selected' : 'secondary'}
                            onClick={() => setSelectedTab('tab2')}
                        >
                            图片背景
                        </Button>
                        <Button 
                            variant={selectedTab === 'tab3' ? 'selected' : 'secondary'}
                            onClick={() => setSelectedTab('tab3')}
                        >
                            渐变背景
                        </Button>
                    </ButtonGroup>
                    <p className="text-sm text-gray-500">当前Tab: {selectedTab}</p>
                </div>
            </section>

            {/* 8. 全宽按钮 */}
            <section className="bg-white p-6 rounded-xl shadow-sm">
                <h2 className="text-xl font-bold mb-4 text-gray-800">8. 全宽按钮</h2>
                <div className="space-y-3 max-w-md">
                    <Button fullWidth>全宽主要按钮</Button>
                    <Button variant="secondary" fullWidth>全宽次要按钮</Button>
                    <Button variant="danger-solid" fullWidth icon={<Icon icon="fa-solid fa-trash" />}>
                        全宽危险按钮
                    </Button>
                </div>
            </section>

            {/* 9. 实际应用场景 */}
            <section className="bg-white p-6 rounded-xl shadow-sm">
                <h2 className="text-xl font-bold mb-4 text-gray-800">9. 实际应用场景</h2>
                
                {/* 9.1 表单操作栏 */}
                <div className="mb-6">
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">表单操作栏</h3>
                    <div className="flex items-center gap-3 justify-end">
                        <Button variant="secondary">取消</Button>
                        <Button variant="primary">保存</Button>
                    </div>
                </div>

                {/* 9.2 数据表格操作 */}
                <div className="mb-6">
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">数据表格操作</h3>
                    <div className="flex items-center gap-2">
                        <Button size="sm" icon={<Icon icon="fa-solid fa-plus" />}>新增</Button>
                        <Button size="sm" variant="secondary" icon={<Icon icon="fa-solid fa-edit" />}>编辑</Button>
                        <Button size="sm" variant="danger" icon={<Icon icon="fa-solid fa-trash" />}>删除</Button>
                        <Button size="sm" variant="ghost" icon={<Icon icon="fa-solid fa-download" />}>导出</Button>
                    </div>
                </div>

                {/* 9.3 确认对话框 */}
                <div className="mb-6">
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">确认对话框</h3>
                    <div className="border border-gray-200 rounded-lg p-4 max-w-sm">
                        <p className="text-sm text-gray-700 mb-4">确定要删除这条数据吗?此操作不可恢复。</p>
                        <div className="flex items-center gap-3 justify-end">
                            <Button variant="secondary" size="sm">取消</Button>
                            <Button variant="danger-solid" size="sm">确认删除</Button>
                        </div>
                    </div>
                </div>

                {/* 9.4 设置页面切换 */}
                <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">设置页面切换</h3>
                    <div className="bg-gray-50 p-3 rounded-lg inline-flex gap-2">
                        <ToggleButton active size="sm">纯色背景</ToggleButton>
                        <ToggleButton active={false} size="sm">图片背景</ToggleButton>
                    </div>
                </div>
            </section>

            {/* 设计规范说明 */}
            <section className="bg-blue-50 p-6 rounded-xl border border-blue-200">
                <h2 className="text-xl font-bold mb-4 text-blue-900">📐 设计规范</h2>
                <div className="space-y-3 text-sm text-blue-800">
                    <div className="flex items-start gap-2">
                        <span className="font-semibold min-w-[100px]">选中状态:</span>
                        <span>统一使用红底白字 (bg-red-500 text-white)</span>
                    </div>
                    <div className="flex items-start gap-2">
                        <span className="font-semibold min-w-[100px]">主要操作:</span>
                        <span>使用蓝色 primary 按钮</span>
                    </div>
                    <div className="flex items-start gap-2">
                        <span className="font-semibold min-w-[100px]">危险操作:</span>
                        <span>使用红色 danger-solid 按钮,并确认二次提示</span>
                    </div>
                    <div className="flex items-start gap-2">
                        <span className="font-semibold min-w-[100px]">次要操作:</span>
                        <span>使用 secondary 或 ghost 按钮</span>
                    </div>
                    <div className="flex items-start gap-2">
                        <span className="font-semibold min-w-[100px]">圆角统一:</span>
                        <span>xs=rounded, sm=rounded-md, md/lg=rounded-lg</span>
                    </div>
                    <div className="flex items-start gap-2">
                        <span className="font-semibold min-w-[100px]">过渡动画:</span>
                        <span>所有按钮 transition-all duration-200</span>
                    </div>
                    <div className="flex items-start gap-2">
                        <span className="font-semibold min-w-[100px]">焦点状态:</span>
                        <span>focus:ring-2 focus:ring-offset-2 focus:ring-blue-500</span>
                    </div>
                </div>
            </section>
        </div>
    );
};

export default AdminButtonExample;
