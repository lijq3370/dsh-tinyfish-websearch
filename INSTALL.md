# dsh-tinyfish-websearch 快速部署指南

本指南说明如何在 DeepSeek Harness (DSH) 中安装并配置 TinyFish 搜索插件。

---

## 1. 安装

在终端中执行：

```sh
dsh plugin --profile web add dsh-tinyfish-websearch
```

执行后重启 `dsh web` 生效（若使用后台服务托管，执行 `systemctl --user restart dsh-web`）。

---

## 2. 配置

打开浏览器访问 DSH Web 界面：

1. 进入 **设置 → TinyFish 搜索**。
2. 填入你的 TinyFish API Key（可在 [tinyfish.ai](https://www.tinyfish.ai) 免费获取，免绑卡）。
3. 点击 **保存**。
4. 点击 **测试** 按钮验证 API 是否工作正常。

完成！现在 DSH 中的所有网络搜索都会自动走 TinyFish 搜索引擎。
