import { generateQuiet, getCurrentCharacterSummary, getPersonaSummary, getRecentChat } from './st-bridge.js';

const STORAGE_KEY = 'st_story_phone_v2_state';

function safeStorageGet(key, fallback = '') {
    try {
        return localStorage.getItem(key) ?? fallback;
    } catch (error) {
        console.warn('ST-StoryPhone: localStorage get failed', key, error);
        return fallback;
    }
}

function safeStorageSet(key, value) {
    try {
        localStorage.setItem(key, value);
        return true;
    } catch (error) {
        console.warn('ST-StoryPhone: localStorage set failed', key, error);
        return false;
    }
}

function tryParseJson(text, fallback) {
    try {
        return JSON.parse(text);
    } catch {
        return fallback;
    }
}

export const SOURCES = {
    MAIN_CHAT: 'main_chat',
    WECHAT: 'phone_wechat',
    MOMENTS: 'phone_moments',
    FORUM: 'phone_forum',
    CALENDAR: 'phone_calendar',
    MEMO: 'phone_memo',
    TARGET_PHONE: 'target_phone',
};

export function nowClock(orderIndex) {
    return {
        storyDay: '当前剧情日',
        timeText: '当前剧情时间',
        orderIndex,
    };
}

export function normalizeVisibility(input = {}) {
    if (input.system === true) {
        return {
            system: true,
            user: Boolean(input.user),
            char: Boolean(input.char),
            npcs: Array.isArray(input.npcs) ? input.npcs : [],
            public: Boolean(input.public),
        };
    }
    return {
        system: true,
        user: true,
        char: Boolean(input.char),
        npcs: Array.isArray(input.npcs) ? input.npcs : [],
        public: Boolean(input.public),
    };
}

export function createDefaultState() {
    return {
        version: 2,
        storyClock: nowClock(0),
        eventLog: [],
        pendingEvents: [],
        knowledgeGraph: [],
        phoneEvents: [],
        settings: {
            apiEndpoint: safeStorageGet('st_story_phone_api_endpoint', ''),
            apiKey: '',
            apiModel: safeStorageGet('st_story_phone_api_model', ''),
            fallbackEnabled: false,
            injectIntoMainContext: true,
        },
        phone: {
            chats: {
                char: [
                    { sender: 'npc', text: '这里是手机内消息，不会直接进入主聊天。', at: Date.now() },
                ],
            },
            moments: [
                { id: 'm1', author: '同学A', avatar: '🌿', text: '今天走廊那边好像有点热闹。', liked: false, comments: [] },
                { id: 'm2', author: '社团号', avatar: '📷', text: '下午活动室开放，借器材记得登记。', liked: true, comments: ['收到'] },
            ],
            forumPosts: [
                { id: 'f1', title: '今天教学楼侧门是不是临时锁了？', body: '有人知道原因吗？别乱传，可能只是后勤维修。', floors: ['1L：我也看到了。', '2L：别上升，等通知吧。'] },
            ],
            memos: [],
            calendar: [],
        },
        profile: {
            currentChar: { id: 'char', name: '{{char}}', knows: [], doesNotKnow: [] },
            friends: [
                { id: 'char', name: '目标角色', avatar: '🐼', knows: [], doesNotKnow: [] },
                { id: 'classmate', name: '同学A', avatar: '🌿', knows: [], doesNotKnow: [] },
                { id: 'club', name: '社团号', avatar: '📷', knows: [], doesNotKnow: [] },
            ],
            publicChannels: ['forum', 'moments'],
        },
    };
}

export class StoryPhoneCore {
    constructor() {
        this.state = this.load();
        this.syncProfile();
    }

    load() {
        try {
            const defaults = createDefaultState();
            const stored = tryParseJson(safeStorageGet(STORAGE_KEY, 'null'), {}) || {};
            return {
                ...defaults,
                ...stored,
                settings: { ...defaults.settings, ...(stored.settings || {}) },
                phone: { ...defaults.phone, ...(stored.phone || {}) },
                profile: { ...defaults.profile, ...(stored.profile || {}) },
            };
        } catch {
            return createDefaultState();
        }
    }

    save() {
        const persisted = JSON.parse(JSON.stringify(this.state));
        if (persisted?.settings) persisted.settings.apiKey = '';
        safeStorageSet(STORAGE_KEY, JSON.stringify(persisted));
    }

    syncProfile() {
        const character = getCurrentCharacterSummary();
        this.state.profile.currentChar.name = character.name;
        this.state.profile.currentChar.id = 'char';
        this.state.profile.friends[0].name = character.name || '目标角色';
        this.save();
    }

    nextClock() {
        const orderIndex = Number(this.state.storyClock.orderIndex || 0) + 1;
        this.state.storyClock = nowClock(orderIndex);
        return this.state.storyClock;
    }

    getHostCharId() {
        return this.state.profile?.currentChar?.id || 'char';
    }

    channelFromSource(source, type = '') {
        if (source === SOURCES.WECHAT) return type === 'group_message' || type === 'group_chat' ? 'wechat_group' : 'wechat_private';
        if (source === SOURCES.MOMENTS) return 'moments';
        if (source === SOURCES.FORUM) return 'forum';
        if (source === SOURCES.CALENDAR) return 'calendar';
        if (source === SOURCES.MEMO) return 'memo';
        if (source === SOURCES.TARGET_PHONE) return 'target_phone';
        if (source === SOURCES.MAIN_CHAT) return 'main_chat';
        return source || '';
    }

    resolveBasicKnownBy(event) {
        const channel = event.channel || this.channelFromSource(event.source, event.type);
        const actorId = event.actorId || event.actor || 'system';
        const targetId = event.targetId ?? event.target ?? null;
        const groupId = event.groupId || event.meta?.groupId || null;
        if (channel === 'wechat_private') return [...new Set(['system', actorId, targetId].filter(Boolean))];
        if (channel === 'wechat_group') {
            const group = (this.state.profile?.groups || []).find((item) => item.id === groupId);
            return [...new Set(['system', ...(group?.members || [groupId])].filter(Boolean))];
        }
        return [...new Set(['system', actorId].filter(Boolean))];
    }

    addEvent(event) {
        const source = event.source;
        const channel = event.channel || this.channelFromSource(source, event.type);
        const actorId = event.actorId || event.actor || 'user';
        const targetId = event.targetId ?? event.target ?? null;
        const next = {
            id: event.id || `evt_${Date.now()}_${Math.random().toString(16).slice(2)}`,
            source,
            type: event.type || 'event',
            hostCharId: this.getHostCharId(),
            speakerId: event.speakerId || actorId,
            actorId,
            targetId,
            groupId: event.groupId || event.meta?.groupId || null,
            channel,
            actor: actorId,
            target: targetId,
            content: event.content || '',
            knownBy: this.resolveBasicKnownBy({ ...event, source, channel, actorId, targetId }),
            timestamp: event.timestamp || this.nextClock(),
            visibility: normalizeVisibility(event.visibility),
            consequences: Array.isArray(event.consequences) ? event.consequences : [],
            status: event.status || 'active',
        };
        this.state.eventLog.push(next);
        if (next.source !== SOURCES.MAIN_CHAT) this.state.phoneEvents.push(next);
        this.save();
        return next;
    }

    canSee(event, speakerId) {
        if (speakerId === 'system') return true;
        if (Array.isArray(event.knownBy) && event.knownBy.includes(speakerId)) return true;
        const visibility = normalizeVisibility(event.visibility);
        if (speakerId === 'user') return visibility.user;
        if (speakerId === 'char') return visibility.public || visibility.char;
        return visibility.public || visibility.npcs.includes(speakerId);
    }

    buildContextForSpeaker(speakerId) {
        const visible = this.state.eventLog.filter((event) => this.canSee(event, speakerId));
        const forbidden = this.state.eventLog.filter((event) => !this.canSee(event, speakerId));
        return {
            visibleMainEvents: visible.filter((event) => event.source === SOURCES.MAIN_CHAT),
            visiblePhoneEvents: visible.filter((event) => event.source !== SOURCES.MAIN_CHAT),
            knownFacts: visible.map((event) => event.content).filter(Boolean),
            unknownFacts: [],
            forbiddenFacts: forbidden.map((event) => event.content).filter(Boolean),
        };
    }

    auditKnowledgeConsistency(generatedContent, speakerId, context = this.buildContextForSpeaker(speakerId)) {
        const text = String(generatedContent || '');
        const issues = context.forbiddenFacts
            .filter((fact) => fact && fact.length > 8 && text.includes(fact.slice(0, Math.min(40, fact.length))))
            .map((fact) => ({
                type: 'forbidden_knowledge',
                detail: `speaker ${speakerId} 提到了不可见信息：${fact}`,
                suggestedFix: '删去该信息，或改为角色只基于可见事实反应。',
            }));

        return {
            ok: issues.length === 0,
            issues,
            safeContentSuggestion: issues.length ? '请仅使用可见信息重写。' : null,
        };
    }

    mainContextSummary(speakerId = 'char') {
        const context = this.buildContextForSpeaker(speakerId);
        if (!context.visiblePhoneEvents.length && !context.forbiddenFacts.length) return '';
        return [
            '[ST-StoryPhone hidden context]',
            `speaker=${speakerId} 只能使用 visiblePhoneEvents。禁止提及 forbiddenFacts。`,
            `visiblePhoneEvents=${JSON.stringify(context.visiblePhoneEvents.slice(-8))}`,
            `forbiddenFacts=${JSON.stringify(context.forbiddenFacts.slice(-8))}`,
        ].join('\n');
    }

    async generatePhoneContent(taskType, payload = {}) {
        const speakerId = payload.speakerId || payload.npcId || 'system';
        const visibleContext = this.buildContextForSpeaker(speakerId);
        const prompt = [
            '你是 ST-StoryPhone 后台生成器。只输出 JSON。',
            `taskType=${taskType}`,
            `payload=${JSON.stringify(payload)}`,
            `character=${JSON.stringify(getCurrentCharacterSummary())}`,
            `persona=${JSON.stringify(getPersonaSummary())}`,
            `recentChat=${JSON.stringify(getRecentChat())}`,
            `visibleContext=${JSON.stringify(visibleContext)}`,
            '禁止使用 forbiddenFacts。内容真实克制，不狗血，不全知全能。',
        ].join('\n');

        if (this.state.settings.apiEndpoint) {
            try {
                const data = await this.callConfiguredApi(prompt, { taskType, payload, visibleContext });
                return { ok: true, text: typeof data === 'string' ? data : JSON.stringify(data) };
            } catch (error) {
                return { ok: false, message: `自定义 API 调用失败：${error.message}` };
            }
        }

        return generateQuiet(prompt);
    }

    getApiHeaders() {
        const headers = { 'Content-Type': 'application/json' };
        if (this.state.settings.apiKey) headers.Authorization = `Bearer ${this.state.settings.apiKey}`;
        return headers;
    }

    getChatCompletionsUrl() {
        const endpoint = String(this.state.settings.apiEndpoint || '').trim().replace(/\/+$/, '');
        if (!endpoint) return '';
        if (endpoint.endsWith('/chat/completions')) return endpoint;
        if (endpoint.endsWith('/v1')) return `${endpoint}/chat/completions`;
        if (endpoint.includes('/v1/')) return `${endpoint}/chat/completions`;
        return `${endpoint}/v1/chat/completions`;
    }

    async callConfiguredApi(prompt, extra = {}) {
        if (!this.state.settings.apiEndpoint) throw new Error('API URL 为空');

        if (!this.state.settings.apiModel) {
            const response = await fetch(this.state.settings.apiEndpoint, {
                method: 'POST',
                headers: this.getApiHeaders(),
                body: JSON.stringify({ ...extra, prompt }),
            });
            const raw = await response.text();
            const data = tryParseJson(raw, { text: raw });
            if (!response.ok) throw new Error(data.error?.message || `${response.status} ${response.statusText}`);
            return data;
        }

        const response = await fetch(this.getChatCompletionsUrl(), {
            method: 'POST',
            headers: this.getApiHeaders(),
            body: JSON.stringify({
                model: this.state.settings.apiModel,
                messages: [
                    { role: 'system', content: '你是 ST-StoryPhone 手机后台生成器。只输出 JSON，不要 Markdown。' },
                    { role: 'user', content: prompt },
                ],
                temperature: 0.7,
            }),
        });
        const raw = await response.text();
        const data = tryParseJson(raw, { text: raw });
        if (!response.ok) throw new Error(data.error?.message || `${response.status} ${response.statusText}`);
        return data.choices?.[0]?.message?.content || data;
    }

    async testApiConnection() {
        if (!this.state.settings.apiEndpoint) return { ok: false, message: '请先填写 API URL' };
        try {
            if (this.state.settings.apiModel) {
                await this.callConfiguredApi('请只输出 {"ok":true,"message":"pong"}。', { taskType: 'connection_test' });
                return { ok: true, message: 'API 测试成功' };
            }

            const response = await fetch(this.state.settings.apiEndpoint, {
                method: 'POST',
                headers: this.getApiHeaders(),
                body: JSON.stringify({ taskType: 'connection_test', payload: {}, prompt: 'ping' }),
            });
            if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
            return { ok: true, message: 'API 测试成功' };
        } catch (error) {
            return { ok: false, message: `API 测试失败：${error.message}` };
        }
    }

    setApiSettings({ endpoint, key, model }) {
        this.state.settings.apiEndpoint = endpoint || '';
        this.state.settings.apiKey = key || '';
        this.state.settings.apiModel = model || '';
        safeStorageSet('st_story_phone_api_endpoint', this.state.settings.apiEndpoint);
        safeStorageSet('st_story_phone_api_model', this.state.settings.apiModel);
        this.save();
    }

    setApiEndpoint(endpoint) {
        this.state.settings.apiEndpoint = endpoint;
        safeStorageSet('st_story_phone_api_endpoint', endpoint);
        this.save();
    }
}
