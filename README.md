# dsh-tinyfish-websearch

DeepSeek Harness (DSH) 插件：将 DSH 默认的 Web 搜索引擎替换为 **TinyFish**。

- ⚡ **搜索免费**：免费档 30 次/分钟，不消耗模型额度，免绑卡
- 🔌 **即装即用**：自动注册 provider 并替换默认搜索引擎
- 🎛️ **可视配置与测试**：设置页面支持输入 Key、一键保存与在线调用测试

---

## 1. 安装

在终端中执行以下命令（自动加入 DSH bundle 补丁层）：

```sh
dsh plugin --profile web add dsh-tinyfish-websearch
```

安装完成后，重启 `dsh web` 生效（若使用后台服务托管，执行 `systemctl --user restart dsh-web`）。

---

## 2. 配置

打开 DSH Web 界面，进入 **设置 → TinyFish 搜索**：

1. **获取 Key**：前往 [tinyfish.ai](https://www.tinyfish.ai) 注册获取 API Key（免费、无需信用卡）。
2. **保存 Key**：在输入框粘贴 Key，点击 **保存**。
3. **测试连接**：点击 **测试** 按钮，系统会向 TinyFish 发送实时探测请求并返回延迟与状态，验证配置是否成功。

> *(可选备用方式)*：也可在环境启动前通过环境变量设置：
> ```sh
> export TINYFISH_API_KEY=你的TinyFishKey
> ```
> 或写入 `~/.dsh/.env`：
> ```sh
> echo 'TINYFISH_API_KEY=你的TinyFishKey' >> ~/.dsh/.env
> ```

---

## 切换回默认搜索 / 卸载

- **临时切回默认搜索**：在 `~/.dsh/profiles/web/cordis.patch.yml` 添加：
  ```yaml
  - id: web
    config:
      searchProvider: deepseek-official
  ```
- **完全卸载**：
  ```sh
  dsh plugin --profile web remove dsh-tinyfish-websearch
  ```

---

## License

[MIT](./LICENSE)
