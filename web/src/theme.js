import { ref } from 'vue';

const THEME_KEY = 'merindocs-theme';

// 初始主题：优先用户上次手动选择，否则跟随系统深浅色偏好
function initialTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === 'dark' || saved === 'light') return saved;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

const isDark = ref(initialTheme() === 'dark');

// 通过 <html data-theme="dark"> 驱动整站 CSS 变量
function applyTheme() {
  if (isDark.value) {
    document.documentElement.dataset.theme = 'dark';
  } else {
    delete document.documentElement.dataset.theme;
  }
}

// 模块加载即应用，与 index.html 里的防闪烁脚本保持一致
applyTheme();

// 正在播放扩散动画时忽略重复点击
let revealing = false;

// 以切换按钮为圆心做圆形扩散（CSS View Transitions）：
// 浏览器自动截取新旧两版整页快照，新快照从按钮处用圆形揭开，
// 圆内是完整的新主题页面（背景 + 文字 + 控件一起变），圆外保持旧页面
function toggleTheme(event) {
  if (revealing) return;
  revealing = true;
  const targetDark = !isDark.value;

  const el = event && event.currentTarget;
  const rect = el && el.getBoundingClientRect ? el.getBoundingClientRect() : null;
  // 快照是视口坐标系，按钮中心直接用视口坐标，无需处理滚动偏移
  const cx = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
  const cy = rect ? rect.top + rect.height / 2 : window.innerHeight / 2;
  // 半径取覆盖整个视口所需的最大值（到最远角落的距离）
  const maxR = Math.hypot(
    Math.max(cx, window.innerWidth - cx),
    Math.max(cy, window.innerHeight - cy)
  );

  // 圆心 / 半径通过 CSS 变量传给 ::view-transition-new(root) 的扩散动画
  const root = document.documentElement;
  root.style.setProperty('--vt-x', `${cx}px`);
  root.style.setProperty('--vt-y', `${cy}px`);
  root.style.setProperty('--vt-r', `${maxR}px`);

  const update = () => {
    isDark.value = targetDark;
    localStorage.setItem(THEME_KEY, targetDark ? 'dark' : 'light');
    applyTheme();
  };

  // 支持 View Transitions 且未开启「减少动态效果」时走圆形扩散，否则直接切换
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (document.startViewTransition && !reduceMotion) {
    const vt = document.startViewTransition(update);
    vt.finished.finally(() => {
      revealing = false;
    });
  } else {
    update();
    revealing = false;
  }
}

export { isDark, toggleTheme };
