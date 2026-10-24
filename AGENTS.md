## 项目文件位置

游戏原文件在：

```text
F:\Patricks.Parabox_inject_debug
```

已经注入了 BepInEx，你可以按照：

```text
F:\parabox_web\BepInEx.md
```

来注入代码观察游戏行为。

日志在：

```text
F:\Patricks.Parabox_inject_debug\BepInEx\LogOutput.log
```

## 注意事项

不要动：

```text
F:\SteamLibrary\steamapps\common
```

中的内容。

## 备份文件

游戏压缩包在：

```text
F:\BaiduNetdiskDownload\compressed
```

目录，作为注入坏了的保底恢复。

## AssetRipper 导出

AssetRipper 的导出在：

```text
F:\AssetRipper_win_x64\parabox
```

里面有AssetRipper自动恢复的unity工程文件。

## dnSpy MCP

你还可以使用 dnSpy MCP 来查看：

```text
Assembly-CSharp.dll
```

反编译后的 C# 代码部分。

## 项目目标

使用 Web 技术栈复刻 Patrick's Parabox。

它必须完美无瑕，确保游戏本身逻辑被 1：1 复刻。

## 工作方式

你应该 /loop整个项目，并让一个独立的 sub-agents 进行视觉检查。

你可以使用 chrome-devtools-mcp 来调试 Web 部分。

## 技术栈

使用：

```text
TypeScript + Vite + PixiJS 8
```

完成这项工作。

## 选择 TypeScript 的原因

选择 TypeScript，是因为游戏包含递归世界、嵌套箱子和复杂状态引用，静态类型可以减少对象关系、状态传递和重构时的错误。

## 选择 PixiJS 的原因

选择 PixiJS，是因为它是成熟的高性能 2D 渲染库，支持场景树、遮罩、RenderTexture 和离屏渲染，适合实现“箱子内部显示另一个世界”的递归画面。

相比完整游戏引擎，它限制更少，更方便按照原游戏逻辑自行组织递归结构。

## 选择 Vite 的原因

选择 Vite，是因为它配置简单、开发启动快，并能稳定地完成 TypeScript 项目的开发、热更新和生产构建。

## 架构要求

游戏逻辑必须使用纯 TypeScript 实现，并与 PixiJS 渲染层分离。

不要引入物理引擎、ECS 或 React 来管理游戏对象。

本项目是基于网格和确定性规则的 2D 益智游戏，这些额外框架只会增加复杂度。

---

在每做完某一个模块功能后，git提交一次