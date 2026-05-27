(function () {
    'use strict';

    var EXTENSION_ID = 'ST-StoryPhone';
    var currentScript = document.currentScript && document.currentScript.src ? document.currentScript.src : '';
    var APP_SCRIPT = currentScript ? currentScript.replace(/index\.js(?:\?.*)?$/, 'app.js') : './app.js';

    function ready(callback) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', callback, { once: true });
        } else {
            callback();
        }
    }

    function makeBubble() {
        var old = document.getElementById('st-story-phone-launcher');
        if (old) return old;

        var button = document.createElement('button');
        button.id = 'st-story-phone-launcher';
        button.type = 'button';
        button.textContent = 'Phone';
        button.title = '打开 ST-StoryPhone';
        button.setAttribute('aria-label', '打开 ST-StoryPhone');
        button.style.position = 'fixed';
        button.style.left = '14px';
        button.style.top = '92px';
        button.style.zIndex = '2147483647';
        button.style.width = '96px';
        button.style.height = '54px';
        button.style.border = '4px solid #fff7b8';
        button.style.borderRadius = '18px';
        button.style.background = 'linear-gradient(145deg, #bfefff, #ffd3e5)';
        button.style.color = '#24314f';
        button.style.fontWeight = '900';
        button.style.fontSize = '15px';
        button.style.boxShadow = '0 12px 28px rgba(54, 80, 120, 0.26)';
        button.style.cursor = 'pointer';
        button.style.fontFamily = 'Verdana, sans-serif';
        button.style.pointerEvents = 'auto';

        document.body.appendChild(button);
        return button;
    }

    function makeFallbackPhone() {
        var old = document.getElementById('st-story-phone-fallback');
        if (old) {
            old.style.display = old.style.display === 'none' ? 'block' : 'none';
            return old;
        }

        var panel = document.createElement('section');
        panel.id = 'st-story-phone-fallback';
        panel.style.position = 'fixed';
        panel.style.left = '12px';
        panel.style.top = '154px';
        panel.style.zIndex = '2147483647';
        panel.style.width = 'min(340px, calc(100vw - 24px))';
        panel.style.maxHeight = 'calc(100vh - 190px)';
        panel.style.overflow = 'auto';
        panel.style.border = '4px solid #fff7b8';
        panel.style.borderRadius = '28px';
        panel.style.padding = '14px';
        panel.style.background = 'linear-gradient(145deg, #bfefff, #ffd3e5 55%, #fff9df)';
        panel.style.color = '#24314f';
        panel.style.boxShadow = '0 18px 44px rgba(54,80,120,.32)';
        panel.style.fontFamily = 'Verdana, sans-serif';
        panel.innerHTML = [
            '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">',
            '<strong>ST-StoryPhone</strong>',
            '<button id="st-story-phone-fallback-close" type="button">关闭</button>',
            '</div>',
            '<p style="font-weight:800;">小手机入口已加载。完整手机主体会继续尝试启动。</p>',
            '<button id="st-story-phone-fallback-load" type="button">打开完整手机</button>',
            '<button id="st-story-phone-fallback-bubble" type="button">重新显示气泡</button>',
            '<p style="font-size:12px;">如果这里能显示，说明扩展入口没问题，之前只是气泡被遮挡或完整主体加载失败。</p>',
        ].join('');
        document.body.appendChild(panel);
        document.getElementById('st-story-phone-fallback-close').addEventListener('click', function () {
            panel.style.display = 'none';
        });
        document.getElementById('st-story-phone-fallback-load').addEventListener('click', loadFullApp);
        document.getElementById('st-story-phone-fallback-bubble').addEventListener('click', function () {
            makeBubble();
            showToast('Phone 气泡已放到左上角');
        });
        return panel;
    }

    function mountDiagnosticsPanel() {
        var host = document.getElementById('extensions_settings') ||
            document.getElementById('extensions_settings2') ||
            document.querySelector('#extensions_settings, .extensions_settings, [id*="extensions_settings"]');
        if (!host || document.getElementById('st-story-phone-diagnostics')) return;

        var panel = document.createElement('div');
        panel.id = 'st-story-phone-diagnostics';
        panel.style.margin = '10px 0';
        panel.style.padding = '10px';
        panel.style.border = '2px solid #71cfff';
        panel.style.borderRadius = '12px';
        panel.style.background = '#fff9df';
        panel.style.color = '#24314f';
        panel.style.fontWeight = '800';
        panel.innerHTML = 'ST-StoryPhone launcher loaded. 如果主页面没有 Phone 气泡，请点这里：<button id="st-story-phone-force-bubble" type="button">显示/打开 Phone</button>';
        host.prepend(panel);

        var force = document.getElementById('st-story-phone-force-bubble');
        if (force) {
            force.addEventListener('click', function () {
                makeBubble();
                makeFallbackPhone();
                showToast('Phone 已放到左上角');
            });
        }
    }

    function showToast(text) {
        var old = document.getElementById('st-story-phone-toast');
        if (old) old.remove();

        var toast = document.createElement('div');
        toast.id = 'st-story-phone-toast';
        toast.textContent = text;
        toast.style.position = 'fixed';
        toast.style.right = '16px';
        toast.style.bottom = '164px';
        toast.style.zIndex = '100000';
        toast.style.maxWidth = '260px';
        toast.style.padding = '10px 12px';
        toast.style.border = '2px solid #24314f';
        toast.style.borderRadius = '14px';
        toast.style.background = '#fff9df';
        toast.style.color = '#24314f';
        toast.style.fontWeight = '800';
        toast.style.boxShadow = '4px 4px 0 #24314f';
        document.body.appendChild(toast);
        setTimeout(function () { toast.remove(); }, 3000);
    }

    function loadFullApp() {
        if (window.__STStoryPhoneAppLoaded) {
            if (window.STStoryPhoneDebug && window.STStoryPhoneDebug.resetUi) {
                window.STStoryPhoneDebug.resetUi();
            } else {
                makeFallbackPhone();
            }
            return;
        }

        window.__STStoryPhoneAppLoaded = true;
        var script = document.createElement('script');
        script.type = 'module';
        script.src = APP_SCRIPT + '?v=0.1.5';
        script.onload = function () {
            showToast('ST-StoryPhone 已打开');
            var launcher = document.getElementById('st-story-phone-launcher');
            if (launcher) launcher.remove();
        };
        script.onerror = function (error) {
            window.__STStoryPhoneAppLoaded = false;
            console.error('ST-StoryPhone full app failed to load:', error);
            showToast('手机主体加载失败，但气泡已工作。请看控制台错误。');
        };
        document.head.appendChild(script);
    }

    ready(function () {
        var bubble = makeBubble();
        bubble.addEventListener('click', loadFullApp);
        mountDiagnosticsPanel();
        setInterval(mountDiagnosticsPanel, 2000);
        window.STStoryPhoneLauncher = {
            load: loadFullApp,
            bubble: makeBubble,
            fallback: makeFallbackPhone,
            diagnostics: mountDiagnosticsPanel,
            version: '0.1.6',
        };
        console.info(EXTENSION_ID + ' launcher loaded');
    });
})();
