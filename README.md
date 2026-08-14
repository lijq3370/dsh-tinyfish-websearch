# dsh-tinyfish-websearch

DeepSeek Harness **bundle 插件**：注册一个 **TinyFish** 驱动的 `web_search` provider 进 `ctx.web` 能力缝，并**把 DSH 默认搜索替换为 TinyFish**（默认引擎是 base bundle 的 `deepseek-official`，本插件的补丁层将其覆盖为 `tinyfish`）。模型无关，不消耗 LLM 额度；TinyFish 搜索免费，不消耗 credits。带一个**设置页表单**，可在界面里填/改/删 API Key。

纯 ESM、零构建、**零 npm 运行时依赖**（provider 按 `ctx.web` 契约结构化实现，任何安装位置都能解析，不依赖模块兜底层）。

## 安装（接收方：一条命令）

```sh
# 本地目录（开发/内部分发）
pnpm dsh plugin --profile web add ./tinyfish-websearch

# npm 发布后
pnpm dsh plugin --profile web add dsh-tinyfish-websearch

# GitHub 托管后
pnpm dsh plugin --profile web add github:lijq3370/dsh-tinyfish-websearch
```

`dsh plugin` 只是 pnpm 转发器，等价于在 `$DSH_HOME/profiles/web` 里执行 `pnpm add <源>`；装完后自动完成两件事：

1. 该包声明了 `dsh.bundle.patch`，自动加入 profile 的 bundle 层（`dsh.profile.bundles`）；
2. bundle 补丁层（包内 `cordis.patch.yml`）自动插入 `tinyfish-websearch` 行，并把 `web` 行的 `searchProvider` 覆盖为 `tinyfish`。

**无需手动改 cordis.patch.yml。** 重启 `dsh web` 后：

- 设置页侧边栏出现 **「TinyFish 搜索」** 入口，界面填/改/删 API Key；
- `web_search` 工具走 TinyFish（默认搜索已被替换）。

## 切换回其他搜索引擎

在你的 `$DSH_HOME/profiles/web/cordis.patch.yml`（应用顺序晚于 bundle 层，优先）加一行即可覆盖：

```yaml
- id: web
  config:
    searchProvider: deepseek-official   # DSH 默认（zen/go 搜索），或 tavily / exa 等已注册 provider
```

## API Key（界面配置）

打开 **设置 → TinyFish 搜索**：密码框输入 key → 保存（写入 `$DSH_HOME/.credentials.yaml`，下次搜索立即生效，无需重启）；已配置时显示来源并可清除。

解析优先级（每次搜索惰性解析）：

1. 插件行的 `config.apiKey` 字面量（密钥落盘到配置）
2. 凭据 seam `TINYFISH_API_KEY`：进程环境变量 → `$DSH_HOME/.credentials.yaml` → `$DSH_HOME/.env`

注意：key 来自环境变量/.env 等只读层时，界面会提示不可修改（写会被凭据 seam 拒绝），需改环境变量。

## 配置

| 键 | 默认 | 含义 |
| --- | --- | --- |
| `apiKey` | 凭据 seam `TINYFISH_API_KEY` | TinyFish API key（字面量优先于界面/凭据） |
| `baseURL` | `https://api.search.tinyfish.ai` | Search API 地址（GET 根路径即操作） |
| `maxResults` | `5` | 结果数（1–20）；请求自带上限时以请求为准 |

## 工作原理

- **补丁层**（`cordis.patch.yml`，随 bundle 生效）：插入 `tinyfish-websearch` 行 + 覆盖 `web.searchProvider: tinyfish`。注意补丁按 id 整行替换 config，因此 `web` 行只 restate `searchProvider`；base bundle 当前也只设这一个键。
- **宿主半**（`index.js`）：`apply(ctx, config)` 调用 `ctx.web.registerSearchProvider(new TinyFishSearchProvider({...}))`，与随包的 `web-search-perplexity` / `web-search-deepseek` 同一注册点；key 经 `ctx.credentials` 惰性解析。
- **浏览器半**（`client.js`）：`settings.section` 槽位贡献「TinyFish 搜索」表单，经 `api.credentials.set/unset/describe`（RPC）读写凭据。
- `GET {baseURL}?query=…`，`X-API-Key` 鉴权；凭据请求拒绝跟随重定向（`redirect: 'error'`）。响应映射：`results[]` → `sources[]`（url/title/snippet/date → publishedAt），`maxResults` 上限由能力缝在回程强制截断。

## 手动验证

```sh
cd ~/.dsh/profiles/web/node_modules/dsh-tinyfish-websearch
TINYFISH_API_KEY=tf-… node --input-type=module -e "
  const m = await import('./index.js');
  const p = new m.TinyFishSearchProvider({ apiKey: process.env.TINYFISH_API_KEY, baseURL: m.TINYFISH_DEFAULT_BASE_URL, maxResults: 3 });
  console.log('available:', p.available());
  console.log(await p.search({ query: 'DeepSeek Harness' }));
"
```

## 限制

- TinyFish 免费档限速 30 req/min（按 key 计）；搜索请求不消耗 credits，但账号需能访问 Search API（注册即有）。
- 错误为带 `code` 属性的普通 `Error`（`WEB_PROVIDER_ERROR` / `WEB_ABORTED` / `WEB_PROVIDER_CREDENTIAL_MISSING`），非 `HarnessError` 类型；错误文本仍会透传模型，仅结构化错误元数据不完整。
- 浏览器半由 `dsh.client` 声明自动发现；插件集变更（新增 `dsh.client`）需要重启才被 client-modules 扫描到。
