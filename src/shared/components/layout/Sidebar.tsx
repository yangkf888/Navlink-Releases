import { Category } from '@/shared/types';
import { Icon } from '@/shared/components/common/Icon';
import { useLayout } from '@/shared/context/LayoutContext';
import { getContrastColor } from '@/shared/utils/color';

const Sidebar = ({
  config,
  activeCategory,
  onScrollTo,
  mobileOpen,
  setMobileOpen,
  isAuthenticated = false
}: any) => {
  const { sidebarContent, collapsed, toggleCollapsed } = useLayout();
  // console.log('Sidebar Render:', { sidebarContent, activeCategory, isAuthenticated });

  // Filter categories based on authentication status
  const categories = (config.categories || []).filter((cat: Category) => isAuthenticated || !cat.hidden);

  // Dynamic width based on collapsed state
  const widthClass = collapsed ? 'w-[68px]' : 'w-[220px]';

  const desktopClass = `
    hidden lg:flex flex-col flex-shrink-0
    sticky top-[80px] h-[calc(100vh-100px)]
    bg-transparent transition-all duration-300 ease-in-out
    ${widthClass}
`;

  const mobileClass = `
    fixed inset-y-0 left-0 w-[240px] bg-white z-[100] shadow-2xl transform transition-transform duration-300 ease-in-out
    ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
lg:hidden flex flex-col
  `;

  const bgColor = config.theme?.backgroundColor || '#f1f2f3';
  const isDarkBg = getContrastColor(bgColor) === '#ffffff';

  // 修正：移动端侧边栏背景固定为白色，所以必须区分对待文字颜色
  const getResponsiveColors = (isDesktop: boolean) => {
    // 桌面端跟随全站背景，移动端固定使用浅色背景下的文字颜色
    const darkText = 'rgba(75, 85, 99, 1)';
    const lightText = 'rgba(255, 255, 255, 0.7)';

    const textColor = (isDesktop && isDarkBg) ? lightText : darkText;
    const activeContrast = getContrastColor(config.theme?.primaryColor || '#f1404b');

    return { textColor, activeContrast };
  };

  const Content = ({ isDesktop = false }: { isDesktop?: boolean }) => {
    const { textColor, activeContrast } = getResponsiveColors(isDesktop);

    return (
      <>
        {/* Mobile Header */}
        <div className="lg:hidden h-[60px] flex items-center px-6 border-b border-gray-100">
          <span className="text-lg font-bold text-gray-800">导航菜单</span>
          <button onClick={() => setMobileOpen(false)} className="ml-auto text-gray-400"><Icon icon="fa-solid fa-times" /></button>
        </div>

        {/* Menu Items */}
        <div className="flex-1 overflow-y-auto custom-scrollbar py-2 pr-2">
          {sidebarContent ? (
            /* Dynamic Sidebar Content */
            <div className="w-full px-2" style={{ color: textColor }}>
              {sidebarContent}
            </div>
          ) : (
            /* Default Category Navigation */
            <nav className="space-y-1">
              {categories.map((cat: Category) => (
                <button
                  key={cat.id}
                  onClick={() => {
                    onScrollTo(cat.id);
                    if (window.innerWidth < 1024) setMobileOpen(false);
                  }}
                  className={`
                  w-full flex items-center px-4 py-3 text-[14px] font-medium rounded-lg transition-all duration-200 group
                  ${activeCategory === cat.id
                      ? 'bg-[var(--theme-primary)]'
                      : 'hover:bg-gray-100/50 hover:shadow-sm'
                    }
                  ${collapsed && isDesktop ? 'justify-center px-0' : ''}
                `}
                  style={{
                    color: activeCategory === cat.id
                      ? activeContrast
                      : textColor
                  }}
                  title={collapsed ? cat.name : ''}
                >
                  <div className={`${collapsed && isDesktop ? 'text-lg w-auto mr-0' : 'w-6 text-center mr-2'} flex items-center justify-center`}
                    style={{
                      color: activeCategory === cat.id
                        ? activeContrast
                        : textColor
                    }}
                  >
                    <Icon icon={cat.icon} />
                  </div>
                  {(!collapsed || !isDesktop) && <span>{cat.name}</span>}
                  {(!collapsed || !isDesktop) && <div className="ml-auto opacity-0 group-hover:opacity-100 text-xs"><Icon icon="fa-solid fa-angle-right" /></div>}
                </button>
              ))}
            </nav>
          )}
        </div>

        {/* Footer / Collapse Button */}
        < div className="p-4 mt-auto lg:mt-0" >
          <div className="flex items-center justify-between bg-white lg:bg-transparent rounded-lg p-2 lg:p-0">
            <button
              onClick={toggleCollapsed}
              className={`text-sm font-medium flex items-center transition-colors ${collapsed && isDesktop ? 'mx-auto' : ''} `}
              style={{ color: textColor }}
              onMouseEnter={(e) => e.currentTarget.style.color = 'var(--theme-primary)'}
              onMouseLeave={(e) => e.currentTarget.style.color = textColor}
              title={collapsed ? "展开" : "收起"}
            >
              {collapsed && isDesktop ? (
                <Icon icon="fa-solid fa-right-to-bracket" />
              ) : (
                <>
                  <Icon icon="fa-solid fa-right-from-bracket" className="mr-1" /> 收起
                </>
              )}
            </button>
          </div>
        </div >
      </>
    );
  };

  return (
    <>
      <div className={desktopClass}>
        <Content isDesktop={true} />
      </div>
      <div className={mobileClass}>
        <Content isDesktop={false} />
      </div>
      {mobileOpen && <div className="fixed inset-0 bg-black/40 z-[90] lg:hidden backdrop-blur-sm" onClick={() => setMobileOpen(false)}></div>}
    </>
  );
};

// Export directly without React.memo to ensure Context updates always trigger re-render
export default Sidebar;
