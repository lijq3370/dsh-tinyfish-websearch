# dsh-tinyfish-websearch 安装指南（接收方）

把这个插件装进你的 DeepSeek Harness（DSH），默认 web 搜索就会替换为 **TinyFish**：
免费搜索（30 次/分钟），模型无关、不消耗 LLM 额度，还带一个设置页可以随时改 API Key。

> 本指南面向使用者。插件原理、配置项等完整说明见同目录的 [README.md](./README.md)。

## 前提

- 已安装 DSH，并已有 `web` profile（跑过 `dsh web`）。
- 准备一个 TinyFish API Key：到 [tinyfish.ai](https://www.tinyfish.ai) 注册，**免费、不用绑卡**（注册后即可获取 key）。

## 步骤 1：安装插件

任选一种来源，在你的终端执行（不需要进任何目录）：

```sh
# npm 发布后
dsh plugin --profile web add dsh-tinyfish-websearch

# 或 GitHub 托管后
dsh plugin --profile web add github:lijq3370/dsh-tinyfish-websearch

# 或拿到的是插件文件夹（本地路径）
dsh plugin --profile web add /绝对/路径/tinyfish-websearch
```

装完**不需要手动改任何配置文件**：插件会作为 bundle 自动进入 profile，并自动完成"注册 TinyFish provider + 把默认搜索切到 TinyFish"。

## 步骤 2：重启 dsh web

在你启动 dsh 的终端里 Ctrl+C 停掉，重新运行：

```sh
dsh web
```

重启后设置页侧边栏会出现 **「TinyFish 搜索」** 入口。

## 步骤 3：配置 API Key

任选一种（推荐第一种）：

**方式 A：设置页填写（推荐）**
打开 **设置 → TinyFish 搜索** → 在输入框粘贴 API Key → 保存。下次搜索立即生效，无需再重启。

**方式 B：环境变量**
在启动 `dsh web` 的环境里：

```sh
export TINYFISH_API_KEY=你的key
```

**方式 C：写入 `$DSH_HOME/.env`**

```sh
echo 'TINYFISH_API_KEY=你的key' >> ~/.dsh/.env
```

## 步骤 4：验证

在任意会话里让 agent 搜一个话题（例如"DeepSeek Harness"）。能返回带来源链接的结果即成功。

没配 key 时会看到明确报错：`TinyFish search has no API key; set it in Settings → TinyFish 搜索 or export TINYFISH_API_KEY`——按步骤 3 配置即可。

## 常见问题

| 现象 | 处理 |
| --- | --- |
| 设置页没有「TinyFish 搜索」入口 | 没有重启过 `dsh web`，重启即可 |
| 搜索报 "has no API key" | 还没配置 key，见步骤 3 |
| 搜索报 HTTP 429 | 超过免费档限速（30 次/分钟），稍等再试 |
| 想换回 DSH 默认搜索 | 见下方"切回默认搜索" |

## 切回默认搜索

在你的 `~/.dsh/profiles/web/cordis.patch.yml` 末尾加：

```yaml
- id: web
  config:
    searchProvider: deepseek-official
```

重启 `dsh web` 即恢复 DSH 默认搜索（open-code-go / zen 原生搜索）。

## 卸载

```sh
dsh plugin --profile web remove dsh-tinyfish-websearch
```

会同时从依赖和 bundle 层移除。卸载后默认搜索自动回到 `deepseek-official`（如果之前没覆盖过的话），重启 `dsh web` 生效。
