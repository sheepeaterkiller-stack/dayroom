/*!
 * Live2D Widget
 * https://github.com/stevenjoezhang/live2d-widget
 */

// Recommended to use absolute path for live2d_path parameter
// live2d_path 参数建议使用绝对路径
const live2d_path = '/waifu/';

// Method to encapsulate asynchronous resource loading
// 封装异步加载资源的方法
function loadExternalResource(url, type) {
  return new Promise((resolve, reject) => {
    let tag;

    if (type === 'css') {
      tag = document.createElement('link');
      tag.rel = 'stylesheet';
      tag.href = url;
    }
    else if (type === 'js') {
      tag = document.createElement('script');
      tag.type = 'module';
      tag.src = url;
    }
    if (tag) {
      tag.onload = () => resolve(url);
      tag.onerror = () => reject(url);
      document.head.appendChild(tag);
    }
  });
}

(async () => {
  // 旧版本"退出即禁用"状态清理：现在退出=隐藏，可随时召唤
  localStorage.removeItem('waifu-disabled');

  // If you are concerned about display issues on mobile devices, you can use screen.width to determine whether to load
  // 如果担心手机上显示效果不佳，可以根据屏幕宽度来判断是否加载
  // 手机端隐藏看板娘（dayroom 惯例：宽度≤700 或触摸设备）
  if (window.innerWidth <= 700 || window.matchMedia('(pointer: coarse)').matches) return;

  // Avoid cross-origin issues with image resources
  // 避免图片资源跨域问题
  const OriginalImage = window.Image;
  window.Image = function(...args) {
    const img = new OriginalImage(...args);
    img.crossOrigin = "anonymous";
    return img;
  };
  window.Image.prototype = OriginalImage.prototype;
  // Load waifu.css and waifu-tips.js
  // 加载 waifu.css 和 waifu-tips.js
  await Promise.all([
    loadExternalResource(live2d_path + 'waifu.css', 'css'),
    loadExternalResource(live2d_path + 'waifu-tips.js', 'js')
  ]);
  // For detailed usage of configuration options, see README.en.md
  // 配置选项的具体用法见 README.md
  // 预取一言缓存：页面加载后后台拉一句，让看板娘"一言"按钮秒出
  window.__hitokotoCache = null;
  fetch('https://v1.hitokoto.cn')
    .then(r => r.json())
    .then(j => { window.__hitokotoCache = j; })
    .catch(() => {});

  const currentTheme = localStorage.getItem('theme_mode') || 'night';
  const initialModelId = currentTheme === 'day' ? 1 : 0;
  localStorage.setItem('modelId', initialModelId.toString());

  window.switchThemeMascot = async function(theme) {
    const targetId = theme === 'day' ? 1 : 0;
    localStorage.setItem('modelId', targetId.toString());
    const waifuEl = document.getElementById('waifu');
    if (window.__live2dModelManager) {
      if (window.__live2dModelManager.modelId !== targetId) {
        if (waifuEl) waifuEl.classList.add('switching');
        window.__live2dModelManager.modelId = targetId;
        window.__live2dModelManager.modelTexturesId = 0;
        const msg = targetId === 1 
          ? "汪汪！进入白天啦，小柴犬 Wanko 陪你开启元气满满的时光！(U・ω・U)" 
          : "喵呜~ 夜深了，小黑猫 Hijiki 陪你度过宁静夜晚 (ฅ'ω'ฅ)";
        try {
          await new Promise(r => setTimeout(r, 220));
          await window.__live2dModelManager.loadModel(msg);
        } catch (e) {
          console.error("switch mascot error", e);
        } finally {
          setTimeout(() => {
            if (waifuEl) waifuEl.classList.remove('switching');
          }, 180);
        }
      }
    }
  };

  initWidget({
    waifuPath: live2d_path + 'waifu-tips.json',
    // cdnPath: 'https://fastly.jsdelivr.net/gh/fghrsh/live2d_api/',
    cubism2Path: live2d_path + 'live2d.min.js',
    cubism5Path: 'https://cubism.live2d.com/sdk-web/cubismcore/live2dcubismcore.min.js',
    tools: ['hitokoto', 'interact', 'care', 'switch-model', 'asteroids', 'quit'],
    logLevel: 'warn',
    drag: false,
    showToggleAfterQuit: true, // 退出=隐藏，保留召唤按钮
    modelId: initialModelId,
  });

  // 长按拖动（按住 500ms 后可拖动，贴底横向移动）
  (function() {
    const MAX_PRESS = 500;
    let timer = null, dragging = false, moved = false;
    let startX = 0, startLeft = 0;

    function bind(waifu) {
      waifu.addEventListener('mousedown', function(e) {
        if (e.button !== 0) return;
        moved = false;
        startX = e.clientX;
        startLeft = waifu.getBoundingClientRect().left;
        clearTimeout(timer);
        timer = setTimeout(function() { dragging = true; }, MAX_PRESS);
      });

      window.addEventListener('mousemove', function(e) {
        if (!dragging) return;
        const dx = e.clientX - startX;
        if (Math.abs(dx) > 3) moved = true;
        let left = startLeft + dx;
        const maxLeft = window.innerWidth - waifu.offsetWidth;
        left = Math.max(0, Math.min(maxLeft, left));
        waifu.style.left = left + 'px';
      });

      function endDrag() {
        clearTimeout(timer);
        if (!dragging) return;
        dragging = false;
        if (moved) {
          // 拖动过：吞掉本次 click，避免误触"摸她"反应
          waifu.addEventListener('click', swallowClick, { once: true });
        }
      }
      function swallowClick(ev) { ev.stopPropagation(); ev.preventDefault(); }
      window.addEventListener('mouseup', endDrag);
    }

    (function poll() {
      const w = document.getElementById('waifu');
      if (w) bind(w);
      else setTimeout(poll, 300);
    })();
  })();
})();

console.log(`\n%cLive2D%cWidget%c\n`, 'padding: 8px; background: #cd3e45; font-weight: bold; font-size: large; color: white;', 'padding: 8px; background: #ff5450; font-size: large; color: #eee;', '');

/*
く__,.ヘヽ.        /  ,ー､ 〉
         ＼ ', !-─‐-i  /  /´
         ／｀ｰ'       L/／｀ヽ､
       /   ／,   /|   ,   ,       ',
     ｲ   / /-‐/  ｉ  L_ ﾊ ヽ!   i
      ﾚ ﾍ 7ｲ｀ﾄ   ﾚ'ｧ-ﾄ､!ハ|   |
        !,/7 '0'     ´0iソ|    |
        |.从"    _     ,,,, / |./    |
        ﾚ'| i＞.､,,__  _,.イ /   .i   |
          ﾚ'| | / k_７_/ﾚ'ヽ,  ﾊ.  |
            | |/i 〈|/   i  ,.ﾍ |  i  |
           .|/ /  ｉ：    ﾍ!    ＼  |
            kヽ>､ﾊ    _,.ﾍ､    /､!
            !'〈//｀Ｔ´', ＼ ｀'7'ｰr'
            ﾚ'ヽL__|___i,___,ンﾚ|ノ
                ﾄ-,/  |___./
                'ｰ'    !_,.:
*/
