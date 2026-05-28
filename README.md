# ST-StoryPhone / ST-PhoningPhone

SillyTavern 第三方 UI Extension。它不是 JS-Slash-Runner 脚本，也不是独立手机模拟器，而是主剧情的第二前端：主对话负责线下主线，小手机负责线上社交支线，二者共享同一个事件记忆、时间线和可见性系统。

## 文件结构

```text
000-ST-StoryPhone/
├─ manifest.json
├─ index.js
├─ app.js
├─ core.js
├─ st-bridge.js
├─ style.css
└─ profiles/
   └─ default.json
```

## 当前功能

- 手机桌面：Phoning-inspired 风格，浅蓝、浅粉、像素按钮，不使用外链图片或真人素材。
- 微信私聊：文字、图片、表情包文字贴纸、后台生成回复，事件写入 `phone_private_chat`。
- 群聊：群成员由 profile `groups` 配置，消息写入 `phone_group_chat`，只对群成员可见。
- 朋友圈：支持图文发布、点赞、评论、刷新生成、可见范围设置。
- 论坛：白色 Threads-like 信息流，公开帖写入 `phone_forum`。
- 日历 / 备忘录：写入统一事件记忆，备忘录默认 `user_only`。
- 角色侧屏：默认 `player_visible / char_private`，不等于 `{{user}}` 已知；同步给 user 必须填写剧情原因。
- Phone Entries：可新建、复制、启用/禁用、删除、导入单条 JSON、导出全部。
- 调试面板：显示 storyClock、最近事件、可见/禁止信息、命中的 Phone Entries / Lore 条目、pendingEvents，并提供可见性测试按钮。

## 0.4.1 新增

- 朋友圈发布支持：公开、好友可见、仅选中可见、选中不可见、仅自己可见。
- 可见/不可见对象来自当前 Phone Profile 的主角、NPC 和群聊配置。
- 朋友圈发布、点赞、评论都会带着同一份可见范围写入事件，避免默认全员知道。
- UI 覆盖层改为更接近 Phoning 桌面、微信朋友圈和白色 Threads 信息流的方向。

## 0.4.2 修复

- 完整手机成功挂载后会自动移除旧的 fallback shell，避免左侧旧手机面板让人误以为完整手机没有打开。

## 事件结构

所有主对话事件和手机事件都会写入 `sharedStoryState.eventLog`：

```json
{
  "id": "string",
  "source": "main_chat | phone_private_chat | phone_group_chat | phone_moments | phone_forum | phone_calendar | phone_memo | phone_system_push | character_side_screen",
  "type": "string",
  "actor": "string",
  "target": "string|null",
  "content": "string",
  "media": [],
  "timestamp": { "storyDay": "Day 1", "timeText": "清晨 08:16", "orderIndex": 1 },
  "visibility": {
    "system": true,
    "user": false,
    "char": false,
    "npcs": [],
    "groups": [],
    "public": false,
    "player": false
  },
  "consequences": [],
  "status": "active"
}
```

## 调试 API

```js
STStoryPhoneKnowledge.buildContextForSpeaker('char')
STStoryPhoneKnowledge.resolveVisibleContext('npc_id')
STStoryPhoneKnowledge.auditKnowledgeConsistency('生成文本', 'npc_id')
STStoryPhoneKnowledge.buildPromptWithVisibilityBoundary('npc_id', 'npc_chat', {})
STStoryPhoneKnowledge.getRelevantPhoneEntries({ taskType: 'npc_chat', speakerId: 'char' })
STStoryPhoneKnowledge.getRelevantMainLore({ taskType: 'forum', speakerId: 'system' })
STStoryPhoneKnowledge.schedulerEnqueue({ content: '提醒' }, { afterTurns: 2 })
STStoryPhoneKnowledge.schedulerTick('主对话推进')
```

## Profile 示例

```json
{
  "extensions": {
    "ST-StoryPhone": {
      "displayName": "Default Story Phone",
      "targetPhoneOwner": "{{char}}",
      "currentChar": { "id": "char", "name": "{{char}}", "knows": [], "doesNotKnow": [] },
      "friends": [
        { "id": "classmate", "name": "同学", "role": "同班同学", "knows": [], "doesNotKnow": [], "relations": [] }
      ],
      "groups": [
        { "id": "default_group", "name": "朋友小群", "members": ["user", "char", "classmate"] }
      ],
      "phoneEntries": [
        {
          "id": "char_online_style",
          "title": "角色线上语气",
          "type": "character_online_style",
          "enabled": true,
          "priority": 10,
          "linkedTargets": {
            "characters": ["char"],
            "npcs": [],
            "groups": [],
            "apps": ["wechat", "moments"],
            "forumBoards": [],
            "relationshipStages": [],
            "tags": []
          },
          "linkedLorebookEntries": [],
          "triggerKeywords": [],
          "content": "只描述手机侧说话习惯，不重复主世界书设定。",
          "notes": ""
        }
      ]
    }
  }
}
```

## 后台生成

默认优先使用 SillyTavern 当前环境提供的 `generateQuietPrompt()`。如果环境没有后台生成接口，会显示：

```text
后台生成接口未接入
```

不会自动 fallback 到主聊天。设置页保留本地 fallback 开关，但默认关闭。也可以手动填写 OpenAI-compatible API；扩展只会把可见上下文发送到你配置的接口。

## 安装

本地调试路径：

```text
SillyTavern/public/scripts/extensions/third-party/000-ST-StoryPhone
```

GitHub 安装：

```text
Extensions -> Install Extension
https://github.com/fruit00001144-sys/000-ST-StoryPhone
```

## 排查

- 确认目录下直接有 `manifest.json`，不要多套一层文件夹。
- 扩展管理里点击“更新已启用项”，再刷新浏览器缓存。
- 如果只看到 fallback 面板，点击“重试完整手机”。
- 浏览器控制台搜索 `ST-StoryPhone full app failed to load` 或 `ST-StoryPhone boot failed`。
- `0.4.1` 保留气泡事件阻断，避免点击手机按钮时聚焦 SillyTavern 主输入框。
