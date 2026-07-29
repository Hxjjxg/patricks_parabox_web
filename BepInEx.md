# Unity Mono + BepInEx 5 插件开发

以下默认已经完成：

 BepInEx 5 已安装并能正常加载插件
 .NET SDK 和 BepInEx 模板已安装
 已确认游戏 Unity 版本

---

## 1. 创建插件项目

例如：

```powershell
dotnet new bepinex5plugin -n AgentObserver -T netstandard2.0 -U 2021.3.18
cd AgentObserver
```

较老的游戏可以尝试：

```powershell
-T net35
```

---

## 2. 引用游戏 DLL

建议在项目中创建：

```text
AgentObserver
├─ AgentObserver.csproj
├─ Plugin.cs
└─ lib
   └─ Assembly-CSharp.dll
```

将游戏中的：

```text
游戏目录MyGame_DataManagedAssembly-CSharp.dll
```

复制到项目的 `lib` 目录。

在 `.csproj` 中加入：

```xml
ItemGroup
  Reference Include=Assembly-CSharp
    HintPathlibAssembly-CSharp.dllHintPath
    PrivatefalsePrivate
  Reference
ItemGroup
```

如果游戏代码位于其他 DLL 中，按相同方式继续添加引用。

不要复制或引用整个 `Managed` 目录，也不要额外引用：

```text
mscorlib.dll
netstandard.dll
System.Runtime.dll
```

---

## 3. 插件入口

将 `Plugin.cs` 修改为：

```csharp
using BepInEx;
using HarmonyLib;

namespace AgentObserver;

[BepInPlugin(
    com.example.agentobserver,
    Agent Observer,
    1.0.0
)]
public sealed class Plugin  BaseUnityPlugin
{
    private Harmony _harmony;

    private void Awake()
    {
        _harmony = new Harmony(
            com.example.agentobserver
        );

        _harmony.PatchAll();

        Logger.LogInfo(Agent Observer loaded);
    }

    private void OnDestroy()
    {
        _harmony.UnpatchSelf();
    }
}
```

插件 GUID 应保持唯一，发布后尽量不要修改。

---

## 4. 使用配置文件

例如增加启用开关：

```csharp
using BepInEx.Configuration;

private ConfigEntrybool _enabled = null!;

private void Awake()
{
    _enabled = Config.Bind(
        General,
        Enabled,
        true,
        是否启用插件
    );

    if (!_enabled.Value)
    {
        return;
    }
}
```

首次运行后会生成：

```text
BepInExconfigcom.example.agentobserver.cfg
```

---

## 5. 使用 Harmony 修改游戏方法

假设游戏中存在：

```csharp
public class Agent
{
    public void TakeDamage(float amount)
    {
    }
}
```

创建补丁：

```csharp
using HarmonyLib;

namespace AgentObserver;

[HarmonyPatch(typeof(Agent), nameof(Agent.TakeDamage))]
internal static class AgentPatch
{
    [HarmonyPrefix]
    private static void Prefix(ref float amount)
    {
        PluginLog.Info($Damage {amount});

         修改参数
         amount = 0.5f;
    }

    [HarmonyPostfix]
    private static void Postfix()
    {
        PluginLog.Info(TakeDamage finished);
    }
}
```

为了方便其他类输出日志，可以在插件类中保存日志对象：

```csharp
using BepInEx.Logging;

internal static class PluginLog
{
    internal static ManualLogSource Source = null!;

    internal static void Info(object message)
    {
        Source.LogInfo(message);
    }
}
```

然后在 `Awake()` 中初始化：

```csharp
PluginLog.Source = Logger;
```

如果方法存在重载，需要指定参数类型：

```csharp
[HarmonyPatch(
    typeof(TargetClass),
    nameof(TargetClass.SetValue),
    new[] { typeof(int) }
)]
```

---

## 6. 定时执行代码

不要在 `Update()` 中每帧进行大量对象搜索。

可以设置执行间隔：

```csharp
private float _nextScanTime;

private void Update()
{
    if (Time.unscaledTime  _nextScanTime)
    {
        return;
    }

    _nextScanTime = Time.unscaledTime + 1f;

    ScanAgents();
}

private void ScanAgents()
{
    var agents =
        UnityEngine.Object.FindObjectsOfTypeAgent();

    Logger.LogInfo($Agent count {agents.Length});
}
```

更推荐通过游戏自身的管理器或单例获取对象，而不是反复扫描整个场景。

---

## 7. 编译和部署

编译：

```powershell
dotnet build -c Release
```

输出通常位于：

```text
binReleasenetstandard2.0AgentObserver.dll
```

将 DLL 放入：

```text
游戏目录BepInExpluginsAgentObserver
```

也可以在 `.csproj` 中增加自动复制：

```xml
PropertyGroup
  GameDirDGamesMyGameGameDir
  PluginDir
    $(GameDir)BepInExpluginsAgentObserver
  PluginDir
PropertyGroup

Target Name=DeployPlugin
        AfterTargets=Build
        Condition=Exists('$(GameDir)BepInEx')

  MakeDir Directories=$(PluginDir) 

  Copy
    SourceFiles=$(TargetPath)
    DestinationFolder=$(PluginDir)
    SkipUnchangedFiles=true 
Target
```

之后每次执行：

```powershell
dotnet build -c Release
```

都会自动部署插件。

编译和复制前建议先退出游戏，避免 DLL 被占用。

---

## 8. 常见问题

### 找不到游戏类型

检查：

 是否引用了正确版本的 `Assembly-CSharp.dll`
 类型是否在其他 DLL 中
 命名空间是否正确
 游戏更新后类名或方法签名是否变化

### Harmony 找不到方法

检查：

 类名和方法名
 参数类型和数量
 是否存在重载
 方法是否在父类中

### 插件没有加载

查看：

```text
BepInExLogOutput.log
```

确认：

 DLL 位于 `BepInExplugins`
 插件类继承 `BaseUnityPlugin`
 存在 `BepInPlugin`
 没有缺失第三方依赖

---

推荐的开发循环：

```text
反编译查看游戏代码
→ 确认类和方法签名
→ 编写 Harmony 补丁
→ dotnet build -c Release
→ 启动游戏查看日志
```
